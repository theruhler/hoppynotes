# HoppyNotes

This is a **separate project** from the private "Bunny Notes" app built for personal use. It was scaffolded from the same base app but is intended for public/commercial distribution.

## What's different from the personal edition

- No PIN lock (a public product should not force a PIN on the recipient).
- No hardcoded names or Disney-referencing quotes — all 30 messages are original.
- Adds a "Create a note" screen: the buyer enters a recipient name and their own name, gets a shareable link, and can preview it before sending.
- Brand name: **HoppyNotes**.
- The bunny artwork is original work created by the project owner — full commercial rights, nothing to license.

## What's still needed before selling this

1. **Connect Stripe.** Payment gating is built in but needs your Stripe account wired up — see "Setting up checkout" below.
2. **Host separately from the personal app.** Do not deploy this into the same repo/Pages site as the private Bunny Notes app.

## Setting up checkout (Stripe Payment Link + verification Worker)

The "Create a note" screen is locked behind a one-time $1.99 unlock. Recipients opening a shared `?to=...&from=...` link always see their note for free — only creating is gated. Unlocks are verified server-side: a tiny Cloudflare Worker ([worker/worker.js](worker/worker.js)) checks with Stripe that the checkout session was actually paid before the app unlocks.

### 1. Deploy the verification Worker

```bash
cd worker
npx wrangler login          # first time only
npx wrangler deploy
npx wrangler secret put STRIPE_SECRET_KEY
```

For the secret, use a [restricted API key](https://dashboard.stripe.com/apikeys) with only **Checkout Sessions: Read** permission — the Worker never needs more. `ALLOWED_ORIGIN` in [worker/wrangler.jsonc](worker/wrangler.jsonc) is already set to the live site's origin (`https://theruhler.github.io`).

### 2. Create the Stripe Payment Link

1. In the [Stripe Dashboard](https://dashboard.stripe.com/), create a product "HoppyNotes" priced at **$1.99, one-time**.
2. Go to **Payment Links → New**, select that product.
3. Under **After payment**, choose **Don't show confirmation page → redirect customers to your website** and set the URL to:
   `https://theruhler.github.io/hoppynotes/?session_id={CHECKOUT_SESSION_ID}`
   (type `{CHECKOUT_SESSION_ID}` literally — Stripe substitutes the real session ID at redirect time).

### 3. Wire the app

In [app.js](app.js), fill in both `PAYWALL` fields:

- `paymentLinkUrl` — the Payment Link URL from step 2.
- `verifyEndpoint` — the Worker URL printed by `wrangler deploy` (e.g. `https://hoppynotes-verify.YOUR-SUBDOMAIN.workers.dev`).

### How it works

After paying, the buyer lands back on the site with `?session_id=cs_...`. The app strips it from the address bar and asks the Worker to verify it; the Worker confirms with Stripe that `payment_status` is `paid`, then returns three things: the unlock, the **full message library**, and an opaque **share token**. Fabricated or unpaid session IDs are rejected.

**The message library is the product, and it is not in the public files — or in this repository.** All 225 messages live in `worker/messages.js`, which is deliberately gitignored: it exists only on the development machine (keep a backup!) and inside the deployed Worker. A fresh clone of this repo cannot deploy the Worker until that file is restored from backup. The library is served only two ways: to buyers with a verified paid session, and to recipients through the share token embedded in note links (`&st=...`). The token is the buyer's session ID encrypted by the Worker (AES-GCM), so recipients can load the notes but never see the credential that unlocks creator access. The public site ships just 5 sample messages. To edit the library, edit `worker/messages.js` and run `wrangler deploy` again.

Practical notes:

- **Restoring access:** the unlock lives per-browser. A buyer who clears storage or switches devices can open their post-payment redirect link again — the Worker re-verifies the same paid session. Any link of the form `https://theruhler.github.io/hoppynotes/?session_id=<their session id>` works; sessions are listed in the Stripe Dashboard.
- **Remaining limitation:** a paying recipient's browser necessarily receives the messages to display them, so someone could capture the library from a note that was shared with them. That's the floor for any content that renders in a browser — but a non-paying visitor downloading the site now gets a shell with 5 samples, not the product.

## Run locally

```bash
python3 -m http.server 8090
```

Open http://localhost:8090/ and try the creator flow, or open with `?to=Jennifer&from=Bob` to preview a personalized note directly.

## Deploy

1. Create a new GitHub repository for this project (kept separate from the personal `bunny_notes` repo).
2. Push this folder's contents to that repository's `main` branch.
3. Enable GitHub Pages: Settings → Pages → Source → Deploy from a branch → `main` / root.
