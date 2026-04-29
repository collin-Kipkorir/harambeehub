const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize the default app (uses service account from Firebase environment)
admin.initializeApp();

const getPayheroAuth = () => {
  // Prefer functions config, fallback to process.env
  const cfg = (functions.config && functions.config().payhero) || {};
  return cfg.auth_token || process.env.PAYHERO_AUTH_TOKEN || process.env.PAYHERO_API_KEY || null;
};

// Helper to determine success from callback body
function callbackIndicatesSuccess(resp) {
  if (!resp) return false;
  const resultCode = resp.ResultCode || resp.resultCode || resp.Result || null;
  const status = resp.Status || resp.ResultDesc || resp.Status || '';
  if (String(resultCode) === '0') return true;
  if (/success/i.test(String(status))) return true;
  return false;
}

// Try to derive a transaction reference from callback body
function pickReferenceFromResp(resp) {
  if (!resp) return null;
  return resp.reference || resp.Reference || resp.CheckoutRequestID || resp.MpesaReceiptNumber || resp.MpesaReceipt || resp.provider_reference || resp.ThirdPartyReference || resp.third_party_reference || null;
}

exports.processWebhookQueue = functions.database.ref('/webhook-queue/{itemId}').onCreate(async (snap, ctx) => {
  const data = snap.val();
  const itemId = ctx.params.itemId;
  const { donationId, campaignId, callbackBody } = data || {};

  const db = admin.database();
  const donationRef = db.ref(`donations/${donationId}`);
  const campaignRef = db.ref(`campaigns/${campaignId}`);
  const walletRef = db.ref(`wallets/${campaignId}/balance`);

  try {
    if (!donationId || !campaignId) {
      await snap.ref.update({ processed: false, error: 'missing donationId or campaignId', processedAt: Date.now() });
      console.warn('queue item missing ids', itemId, donationId, campaignId);
      return null;
    }

    // Check idempotency
    const donationSnap = await donationRef.once('value');
    const donation = donationSnap.val();
    if (donation && donation.status === 'completed') {
      await snap.ref.update({ processed: true, note: 'already completed', processedAt: Date.now() });
      console.log('Donation already completed, skipping', donationId);
      return null;
    }

    const resp = (callbackBody && callbackBody.response) || callbackBody || {};

    let success = callbackIndicatesSuccess(resp);

    // If callback does not indicate success, try to query PayHero transaction-status
    if (!success) {
      const reference = pickReferenceFromResp(resp);
      const auth = getPayheroAuth();
      if (reference && auth) {
        try {
          const authHeader = String(auth).startsWith('Basic ') ? String(auth) : `Basic ${auth}`;
          const url = `https://backend.payhero.co.ke/api/v2/transaction-status?reference=${encodeURIComponent(reference)}`;
          const r = await axios.get(url, { headers: { Authorization: authHeader }, timeout: 10000 });
          const body = r.data || {};
          const status = body.status || body.Status || '';
          if (/success/i.test(String(status))) {
            success = true;
          } else if (/failed/i.test(String(status))) {
            success = false;
          }
        } catch (err) {
          console.warn('transaction-status lookup failed', err?.response?.data || err.message || err);
        }
      }
    }

    if (!success) {
      // mark donation failed
      await donationRef.update({ status: 'failed', callbackBody, updatedAt: Date.now() });
      await snap.ref.update({ processed: true, result: 'failed', processedAt: Date.now() });
      console.log('Marked donation failed', donationId);
      return null;
    }

    // Success path: update donation and increment campaign and wallet using transactions
    await donationRef.update({ status: 'completed', transactionId: pickReferenceFromResp(resp) || resp.MpesaReceiptNumber || null, completedAt: Date.now(), callbackBody });

    // Update campaign atomically and mark the donation as processed to avoid double-counting.
    // Use amount from callback or donation; enforce minimum 1 Ksh for tests
  const MIN_AMOUNT = 50;
  const rawAmount = Number(resp.Amount || resp.amount || (donation && donation.amount) || 0);
  const amount = Math.max(MIN_AMOUNT, rawAmount);
    await campaignRef.transaction(curr => {
      curr = curr || {};
      curr._processedDonations = curr._processedDonations || {};
      // If this donation was already applied, skip
      if (curr._processedDonations[donationId]) return curr;
      if (amount > 0) {
        curr.raised = (Number(curr.raised || 0)) + amount;
        curr.donors = (Number(curr.donors || 0)) + 1;
      }
      curr._processedDonations[donationId] = true;
      return curr;
    });

    // Update wallet balance
    await walletRef.transaction(curr => (Number(curr || 0) + amount));

    await snap.ref.update({ processed: true, result: 'completed', processedAt: Date.now() });
    console.log('Processed queue item', itemId, donationId);
    return null;
  } catch (err) {
    console.error('Error processing queue item', itemId, err);
    await snap.ref.update({ processed: false, error: String(err), lastErrorAt: Date.now() });
    throw err; // let function retry if applicable
  }
});
