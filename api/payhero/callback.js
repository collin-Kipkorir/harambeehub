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
    const transactionId = resp.MpesaReceiptNumber || resp.MpesaReceipt || resp.transaction_id || resp.transaction || resp.id;
    const resultCode = resp.ResultCode || resp.resultCode || resp.Result || null;
    const status = resp.Status || resp.ResultDesc || resp.Status || '';
    const amount = resp.Amount || resp.amount || (resp.data && resp.data.amount) || 0;

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
      initFirebase();
      const db = admin.database();

      // Idempotency guard: if donation already completed, skip processing
      const donationRef = db.ref(`donations/${donationId}`);
      const donationSnap = await donationRef.once('value');
      const donation = donationSnap.val();
      if (donation && donation.status === 'completed') {
        console.log('Callback received for already completed donation:', donationId);
        return;
      }

      const success = (String(resultCode) === '0') || /success/i.test(String(status));
      if (!success) {
        await donationRef.update({ status: 'failed', transactionId, callbackBody: body });
        return;
      }

      // mark donation completed
      await donationRef.update({ status: 'completed', transactionId, completedAt: Date.now(), callbackBody: body });

      // update campaign totals
      const campaignRef = db.ref(`campaigns/${campaignId}`);
      const campaignSnap = await campaignRef.once('value');
      const campaign = campaignSnap.val() || {};
      const currentRaised = Number(campaign.raised || campaign.raisedAmount || 0);
      const raisedToAdd = Number(amount || 0);
      await campaignRef.update({
        raised: currentRaised + raisedToAdd,
        donors: (Number(campaign.donors || 0) + 1),
      });

      // update wallet
      const walletRef = db.ref(`wallets/${campaignId}/balance`);
      const walletSnap = await walletRef.once('value');
      const walletBalance = Number(walletSnap.val() || 0);
      await walletRef.set(walletBalance + raisedToAdd);

      return;
    } catch (err) {
      console.error('Error processing PayHero callback', err);
      return;
    }
  })();
}
