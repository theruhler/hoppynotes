#!/usr/bin/env bash
# Copy to deploy-env.sh (gitignored), fill in, then before deploying run:
#   cd worker && source ./deploy-env.sh && npx wrangler whoami
#
# These two variables force Wrangler to use THIS Cloudflare account and
# ignore whatever browser session or default `wrangler login` is active —
# which is what keeps a personal project out of a company account.

# Personal Cloudflare account ID (Dashboard → Workers & Pages → Account ID).
export CLOUDFLARE_ACCOUNT_ID="paste-your-personal-account-id"

# API token from that same account:
#   My Profile → API Tokens → Create Token → "Edit Cloudflare Workers".
# Treat this like a password. Never commit it.
export CLOUDFLARE_API_TOKEN="paste-your-api-token"

if [ "${CLOUDFLARE_ACCOUNT_ID}" = "paste-your-personal-account-id" ]; then
  echo "deploy-env.sh still has placeholder values — fill them in first." >&2
fi
