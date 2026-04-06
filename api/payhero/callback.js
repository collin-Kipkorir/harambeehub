import admin from 'firebase-admin';

function initFirebase() {
  if (admin.apps && admin.apps.length) return admin;
  const dbUrl = process.env.FIREBASE_DATABASE_URL;

  // Support either a direct JSON string in FIREBASE_SERVICE_ACCOUNT_JSON
  // or a base64-encoded JSON in FIREBASE_SERVICE_ACCOUNT_JSON_BASE64.
  let saString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || null;
  const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 || null;
  if (!saString && saBase64) {
    try {
      saString = Buffer.from(saBase64, 'base64').toString('utf8');
    } catch (err) {
      console.warn('Failed to decode FIREBASE_SERVICE_ACCOUNT_JSON_BASE64', err);
    }
  }

  if (saString) {
    const serviceAccount = JSON.parse(saString);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL: dbUrl });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // If running with GOOGLE_APPLICATION_CREDENTIALS set in the environment (rare on Vercel), let the SDK use it
    admin.initializeApp({ databaseURL: dbUrl });
  } else {
    // Fall back to initializing without explicit credentials; this will work only in some environments
    admin.initializeApp({ databaseURL: dbUrl });
  }
  return admin;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  // Acknowledge receipt immediately: PayHero requires a 200 OK quickly or it may retry.
  // We respond 200 as soon as possible, then process the callback asynchronously.
  // Note: some serverless platforms may suspend the function after response; if you need
  // guaranteed background processing use a push queue (Pub/Sub) or a Cloud Function triggered by DB writes.
  res.status(200).json({ success: true, message: 'received' });

  // Continue processing asynchronously. Errors are logged but do NOT change the HTTP response.
  (async () => {
    const body = req.body || {};
    const resp = body.response || body;

    const external_reference = resp.ExternalReference || resp.external_reference || resp.Reference || resp.reference || (resp.metadata && resp.metadata.external_reference);

    if (!external_reference) {
      console.warn('Callback missing external_reference', body);
      return;
    }

    const parts = String(external_reference).split('|');
    const donationId = parts[0];
    const campaignId = parts[1];
    if (!donationId || !campaignId) {
      console.warn('Invalid external_reference format', external_reference);
      return;
    }

    try {
      // initialize firebase and push a small queue item for reliable processing
      initFirebase();
      const db = admin.database();
      const queueRef = db.ref('webhook-queue').push();
      await queueRef.set({
        donationId,
        campaignId,
        receivedAt: Date.now(),
        processed: false,
        callbackBody: body,
      });
      console.log('Enqueued webhook', queueRef.key, donationId, campaignId);
    } catch (err) {
      console.error('Failed to enqueue webhook', err);
      return;
    }
  })();
}
