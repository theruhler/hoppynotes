// HoppyNotes checkout verification + message delivery Worker.
//
// GET /?session_id=cs_...  ->  { unlocked, shareToken, messages }   (buyer)
// GET /?share=<token>      ->  { messages }                          (recipient)
// GET /?admin=<code>       ->  { unlocked, label, shareToken, ... }  (tester)
//
// The full message library lives in messages.js and is only served here:
// buyers receive it after Stripe confirms their Checkout Session was paid,
// recipients through the opaque AES-GCM share token embedded in note links.
// The token encrypts the buyer's session id, so recipients can load the
// notes without ever learning the credential that unlocks creator access.
//
// Admin codes let the owners test on their own devices without paying. They
// live in the ADMIN_CODES secret as "label:code,label:code" and are checked
// here, never in the public app. Remove a label and redeploy to revoke it.
//
// Deploy with `wrangler deploy`, then:
//   wrangler secret put STRIPE_SECRET_KEY
//   wrangler secret put ADMIN_CODES

import { MESSAGES, OCCASIONS } from "./messages.js";

let cachedTokenKey = null;

async function getTokenKey(env) {
  if (!cachedTokenKey) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${env.STRIPE_SECRET_KEY}:hoppynotes-share-v1`)
    );
    cachedTokenKey = await crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
      "encrypt",
      "decrypt"
    ]);
  }
  return cachedTokenKey;
}

function toBase64Url(bytes) {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  const binary = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

// Compares digests rather than raw strings so the check is constant time and
// leaks neither the code's contents nor its length.
async function secretEquals(a, b) {
  const [left, right] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

function parseAdminCodes(env) {
  return String(env.ADMIN_CODES || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const split = entry.indexOf(":");
      return split === -1
        ? { label: "tester", code: entry }
        : { label: entry.slice(0, split), code: entry.slice(split + 1) };
    })
    .filter((entry) => entry.code);
}

async function matchAdminCode(env, candidate) {
  let matched = null;
  for (const entry of parseAdminCodes(env)) {
    if (await secretEquals(entry.code, candidate)) {
      matched = entry;
    }
  }
  return matched;
}

async function mintShareToken(env, subject) {
  const key = await getTokenKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(subject)
  );
  const packed = new Uint8Array(iv.length + ciphertext.byteLength);
  packed.set(iv);
  packed.set(new Uint8Array(ciphertext), iv.length);
  return toBase64Url(packed);
}

async function readShareToken(env, token) {
  try {
    const packed = fromBase64Url(token);
    const key = await getTokenKey(env);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: packed.slice(0, 12) },
      key,
      packed.slice(12)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "GET") {
      return jsonResponse({ unlocked: false, error: "method_not_allowed" }, 405, corsHeaders);
    }

    const params = new URL(request.url).searchParams;

    // Recipient path: an opaque share token grants the message library only.
    const shareToken = params.get("share");
    if (shareToken) {
      const subject = await readShareToken(env, shareToken);
      if (!subject || !(subject.startsWith("cs_") || subject.startsWith("admin:"))) {
        return jsonResponse({ error: "invalid_share_token" }, 403, corsHeaders);
      }
      return jsonResponse({ messages: MESSAGES, occasions: OCCASIONS }, 200, corsHeaders);
    }

    // Owner/tester path: a private code unlocks the app without a purchase.
    const adminCode = params.get("admin");
    if (adminCode) {
      const entry = await matchAdminCode(env, adminCode);
      if (!entry) {
        console.error(JSON.stringify({ message: "admin_code_rejected" }));
        return jsonResponse({ unlocked: false, error: "invalid_admin_code" }, 403, corsHeaders);
      }
      console.log(JSON.stringify({ message: "admin_unlock", label: entry.label }));
      return jsonResponse(
        {
          unlocked: true,
          admin: true,
          label: entry.label,
          shareToken: await mintShareToken(env, `admin:${entry.label}`),
          messages: MESSAGES,
          occasions: OCCASIONS
        },
        200,
        corsHeaders
      );
    }

    // Buyer path: verify the checkout session with Stripe.
    const sessionId = params.get("session_id") || "";
    if (!/^cs_[A-Za-z0-9_]{10,}$/.test(sessionId)) {
      return jsonResponse({ unlocked: false, error: "invalid_session_id" }, 400, corsHeaders);
    }

    let session;
    try {
      const stripeResponse = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
        { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
      );
      if (stripeResponse.status === 404) {
        return jsonResponse({ unlocked: false, error: "unknown_session" }, 200, corsHeaders);
      }
      if (!stripeResponse.ok) {
        console.error(JSON.stringify({ message: "stripe_error", status: stripeResponse.status }));
        return jsonResponse({ unlocked: false, error: "stripe_error" }, 502, corsHeaders);
      }
      session = await stripeResponse.json();
    } catch (error) {
      console.error(JSON.stringify({ message: "stripe_unreachable", error: String(error) }));
      return jsonResponse({ unlocked: false, error: "stripe_unreachable" }, 502, corsHeaders);
    }

    if (session.payment_status !== "paid") {
      return jsonResponse({ unlocked: false }, 200, corsHeaders);
    }

    return jsonResponse(
      {
        unlocked: true,
        shareToken: await mintShareToken(env, sessionId),
        messages: MESSAGES,
        occasions: OCCASIONS
      },
      200,
      corsHeaders
    );
  }
};

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}
