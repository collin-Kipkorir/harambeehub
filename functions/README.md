# Firebase Functions for HarambeeHub

This folder contains a Firebase Cloud Function that processes PayHero webhook events enqueued into Realtime Database under `webhook-queue`.

Files:
- `index.js` — Cloud Function triggered on `webhook-queue/{itemId}` onCreate. It:
  - Verifies callback success (via callback body or PayHero `transaction-status`).
  - Marks donations completed/failed.
  - Atomically updates `campaigns/<id>/raised` and `wallets/<id>/balance`.

Quick deploy
1. Install Firebase CLI and login:
```bash
npm install -g firebase-tools
firebase login
```

2. From this `functions/` folder install deps and deploy:
```bash
cd functions
npm install
# Ensure you're in the correct Firebase project: firebase use --add
firebase deploy --only functions
```

Environment / secrets
- The function needs access to PayHero auth token for transaction-status lookups. Set it with:
```bash
firebase functions:config:set payhero.auth_token="Basic <your-token-or-raw-token>"
```
The code will also fall back to `process.env.PAYHERO_AUTH_TOKEN` if present.

Notes
- The function uses Firebase Admin SDK default credentials (service account tied to the project). Make sure the Firebase project and Realtime Database used match the app.
- This function will retry when it throws; errors are written to the queue item for debugging.
