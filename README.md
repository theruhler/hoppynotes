# HoppyNotes

This is a **separate project** from the private "Bunny Notes" app built for personal use. It was scaffolded from the same base app but is intended for public/commercial distribution.

## What's different from the personal edition

- No PIN lock (a public product should not force a PIN on the recipient).
- No hardcoded names or Disney-referencing quotes — all 30 messages are original.
- Adds a "Create a note" screen: the buyer enters a recipient name and their own name, gets a shareable link, and can preview it before sending.
- Adds occasion greetings: birthdays, anniversaries, and holidays (see below).
- Brand name: **HoppyNotes**.
- The bunny artwork is original work created by the project owner — full commercial rights, nothing to license.

## What's still needed before selling this

1. **Connect Stripe.** Payment gating is built in but needs your Stripe account wired up — see "Setting up checkout" below.
2. **Host separately from the personal app.** Do not deploy this into the same repo/Pages site as the private Bunny Notes app.

## Occasion greetings

On a special day the note screen adds a headline banner above the note ("HOPPY BIRTHDAY JENNIFER!", "HAVE YOU SEEN MY PEEPS?") and moves themed notes to the front of the rotation. Banners cycle through their variants as the reader taps.

- **Birthday and anniversary** are set in Settings. Month and day are required; **the year is optional** — supply it and the banner shows the age ("HOPPY 36th BIRTHDAY"), leave it blank and you still get the day. Dates set by the buyer travel in the share link (`&bd=`, `&an=`), so the recipient's app knows them; the recipient can also change them in their own Settings.
- **Two holiday toggles**, both on by default. *Faith holidays*: Easter, Good Friday, Lent, Passover, Christmas Eve and Christmas. *Other holidays*: New Year's Eve and Day, Lunar New Year (with a special set for Years of the Rabbit), Valentine's, St. Patrick's, Mother's and Father's Day, Memorial Day, July 4th, Labor Day, Halloween, Thanksgiving.
- **Priority:** a birthday or anniversary always outranks a holiday, and any specific holiday outranks Lent — otherwise the 40-day Lent season would hide St. Patrick's Day, which falls inside it every year.
- Easter and its dependent days are computed (Gregorian computus), as are the floating US holidays. Lunar dates can't be derived arithmetically, so **Lunar New Year and Passover use verified tables in [app.js](app.js) that run through 2035** — after that those two are simply skipped, and the tables need extending. Everything else keeps working indefinitely.
- Greeting text is part of the paid library in `worker/messages.js`, so it needs a `wrangler deploy` to change, and it never appears for non-buyers.

## Tester (admin) unlocks

The owners can unlock the app on their own devices without paying, using private codes the Worker validates. There are no accounts or passwords — the code *is* the credential.

1. Generate a code per person (never reuse one between people):
   ```bash
   node -e 'console.log("hn_" + require("crypto").randomBytes(18).toString("base64url"))'
   ```
2. Store them all in one secret as `label:code` pairs:
   ```bash
   cd worker && npx wrangler secret put ADMIN_CODES
   # paste e.g.  mike:hn_xxxx,partner:hn_yyyy
   ```
3. Each person opens `https://theruhler.github.io/hoppynotes/?admin=<their code>` once on each device. The app verifies the code with the Worker, unlocks, and remembers it; the code is stripped from the address bar immediately.

Notes:

- Codes are checked server-side against the secret, so nothing in the public app can be edited to fake an unlock, and a code never appears in generated share links.
- **To revoke one person**, run `wrangler secret put ADMIN_CODES` again with that label removed. The others keep working.
- Unlock is per device: opening the link on the phone and the laptop is expected.
- Each use is logged (`wrangler tail` shows `admin_unlock` with the label), so you can see which code was used.
- **Testing the real purchase flow is separate.** Admin codes skip checkout entirely; to rehearse paying, use Stripe test mode (a test-mode Payment Link, the Worker's `STRIPE_SECRET_KEY` set to your test key, and card `4242 4242 4242 4242`).

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
