# HarambeeHub PayHero server

This small Express server implements two endpoints used by the frontend to initiate M-Pesa STK push via PayHero and to receive PayHero callbacks.

Important: The PayHero API shape (paths/fields) may differ; adapt the endpoints to match your PayHero integration docs.

## Endpoints

- POST /api/payhero/pay
  - Body: { amount, phone, external_reference }
  - Calls PayHero to trigger an M-Pesa STK Push. Returns the provider response.

- POST /api/payhero/callback
  - PayHero posts transaction results here. The server parses `external_reference` (expected format: `donationId|campaignId`), updates the donation status in Firebase and increments the campaign raised amount and wallet balance.

## Setup

1. Copy `.env.example` to `.env` and fill values:

```
cp .env.example .env
# edit .env: set PAYHERO_API_URL, PAYHERO_API_KEY, CALLBACK_BASE_URL, and FIREBASE_SERVICE_ACCOUNT_PATH (or FIREBASE_SERVICE_ACCOUNT_JSON)
```

2. Install dependencies and run

```
cd server
npm install
npm run dev   # uses nodemon
# or
npm start
```

3. Ensure `CALLBACK_BASE_URL` is a public URL reachable by PayHero (use ngrok for local testing) such as `https://<your-ngrok>.ngrok.io`.

4. Configure PayHero to send callbacks to `https://your-public/callback/api/payhero/callback` (depending on your public URL).

## Notes

- The server uses the Firebase Admin SDK. Provide either `FIREBASE_SERVICE_ACCOUNT_PATH` (local path to JSON) or `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON string) and optionally `FIREBASE_DATABASE_URL`.
- The code updates `donations/<donationId>.status`, `campaigns/<campaignId>.raised`, `campaigns/<campaignId>.donors`, and `wallets/<campaignId>/balance`. Adjust to match your DB schema.
- Add verification against PayHero transaction endpoints if available for stronger guarantees.
