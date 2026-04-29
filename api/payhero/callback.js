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
      const payheroRef = resp.Reference || resp.reference || resp.CheckoutRequestID || resp.checkout_request_id || resp.MpesaReceiptNumber || null;
      if (payheroRef) {
        try {
          await db.ref(`payheroRefs/${String(payheroRef)}`).update({ donationId, campaignId, updatedAt: Date.now() });
          await db.ref(`donations/${donationId}/payheroRef`).set(String(payheroRef));
        } catch (mapErr) {
          console.warn('Failed to persist callback payhero reference mapping', mapErr?.message || mapErr);
        }
      }
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

      // Quick path: try to process the callback immediately (idempotent). This
      // gives faster UX while the queued worker provides reliable background processing.
      (async () => {
        try {
          const db = admin.database();
          const donationRef = db.ref(`donations/${donationId}`);
          const campaignRef = db.ref(`campaigns/${campaignId}`);

          // Determine if callback indicates a successful payment
          const respBody = resp || {};
          const resultCode = respBody.ResultCode || respBody.result_code || respBody.Result || null;
          const statusText = respBody.Status || respBody.ResultDesc || respBody.StatusDesc || respBody.result || '';
          const receipt = respBody.MpesaReceiptNumber || respBody.MpesaReceipt || respBody.Receipt || null;
          const quickSuccess = (String(resultCode) === '0') || (/success/i.test(String(statusText))) || Boolean(receipt);

          if (!quickSuccess) {
            console.log('Callback does not indicate success, deferring to queued worker', donationId);
            return;
          }

          // Load donation to obtain amount
          const donationSnap = await donationRef.once('value');
          const donation = donationSnap.val();

          // Idempotently mark donation completed
          await donationRef.transaction((current) => {
            if (!current) return current;
            if (current.status === 'completed') return current;
            return { ...current, status: 'completed', transactionId: receipt || null, completedAt: Date.now() };
          });

          // Atomically update campaign totals and mark processed donations to avoid double-counting
          await campaignRef.transaction((current) => {
            current = current || {};
            current._processedDonations = current._processedDonations || {};
            if (current._processedDonations[donationId]) return current; // already applied
            const MIN_AMOUNT = 50;
            const amount = Math.max(MIN_AMOUNT, Number((donation && donation.amount) || 0));
            if (amount > 0) {
              current.raised = (Number(current.raised || 0)) + amount;
              current.donors = (Number(current.donors || 0)) + 1;
            }
            current._processedDonations[donationId] = true;
            return current;
          });

          // Update the queued item to indicate immediate processing succeeded
          try {
            await db.ref(`webhook-queue/${queueRef.key}`).update({ processed: true, result: 'completed', processedAt: Date.now() });
          } catch (uErr) {
            console.warn('Failed to update webhook-queue item after immediate processing', uErr?.message || uErr);
          }

          console.log('Processed webhook immediately for donation', donationId);
        } catch (procErr) {
          console.error('Immediate processing of callback failed', procErr?.message || procErr);
          // leave the queued item for the worker to retry
        }
      })();
  })();
}
