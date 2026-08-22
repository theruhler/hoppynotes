// HoppyNotes checkout verification + message delivery Worker.
//
// GET /?session_id=cs_...  ->  { unlocked, shareToken, messages }   (buyer)
// GET /?share=<token>      ->  { messages }                          (recipient)
//
// The full message library lives in messages.js and is only served here:
// buyers receive it after Stripe confirms their Checkout Session was paid,
// recipients through the opaque AES-GCM share token embedded in note links.
// The token encrypts the buyer's session id, so recipients can load the
// notes without ever learning the credential that unlocks creator access.
//
// Deploy with `wrangler deploy`, then: `wrangler secret put STRIPE_SECRET_KEY`.

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

async function mintShareToken(env, sessionId) {
  const key = await getTokenKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(sessionId)
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
      const sessionId = await readShareToken(env, shareToken);
      if (!sessionId || !sessionId.startsWith("cs_")) {
        return jsonResponse({ error: "invalid_share_token" }, 403, corsHeaders);
      }
      return jsonResponse({ messages: MESSAGES, occasions: OCCASIONS }, 200, corsHeaders);
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
