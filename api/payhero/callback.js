const admin = require('firebase-admin');

function initFirebase() {
  if (admin.apps && admin.apps.length) return admin;
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const dbUrl = process.env.FIREBASE_DATABASE_URL;
  if (saJson) {
    const serviceAccount = JSON.parse(saJson);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL: dbUrl });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ databaseURL: dbUrl });
  } else {
    admin.initializeApp({ databaseURL: dbUrl });
  }
  return admin;
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const body = req.body || {};
  const resp = body.response || body;

  const external_reference = resp.ExternalReference || resp.external_reference || resp.Reference || resp.reference || (resp.metadata && resp.metadata.external_reference);
  const transactionId = resp.MpesaReceiptNumber || resp.MpesaReceipt || resp.transaction_id || resp.transaction || resp.id;
  const resultCode = resp.ResultCode || resp.resultCode || resp.Result || null;
  const status = resp.Status || resp.ResultDesc || resp.Status || '';
  const amount = resp.Amount || resp.amount || (resp.data && resp.data.amount) || 0;

  if (!external_reference) {
    console.warn('Callback missing external_reference', body);
    return res.status(400).json({ success: false, message: 'Missing external_reference' });
  }

  const parts = String(external_reference).split('|');
  const donationId = parts[0];
  const campaignId = parts[1];
  if (!donationId || !campaignId) {
    console.warn('Invalid external_reference format', external_reference);
    return res.status(400).json({ success: false, message: 'Invalid external_reference format' });
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
      return res.json({ success: true, message: 'Already processed' });
    }

    const success = (String(resultCode) === '0') || /success/i.test(String(status));
    if (!success) {
      await donationRef.update({ status: 'failed', transactionId, callbackBody: body });
      return res.json({ success: true, message: 'Donation marked failed' });
    }

    // mark donation completed
    await db.ref(`donations/${donationId}`).update({ status: 'completed', transactionId, completedAt: Date.now(), callbackBody: body });

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

    return res.json({ success: true });
  } catch (err) {
    console.error('Error processing PayHero callback', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
