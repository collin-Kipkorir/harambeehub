require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;
const PAYHERO_API_URL = process.env.PAYHERO_API_URL; // e.g. https://api.payhero.example
const PAYHERO_API_KEY = process.env.PAYHERO_API_KEY;
const CALLBACK_BASE_URL = process.env.CALLBACK_BASE_URL; // e.g. https://mydomain.com

if (!PAYHERO_API_URL || !PAYHERO_API_KEY) {
  console.warn('PAYHERO_API_URL or PAYHERO_API_KEY not set. PayHero calls will fail until configured.');
}

// Initialize Firebase Admin
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  } else {
    // Fallback to default credentials
    admin.initializeApp();
  }
} catch (err) {
  console.error('Failed to initialize Firebase Admin:', err.message || err);
  process.exit(1);
}

const db = admin.database();

const app = express();
app.use(cors());
app.use(express.json());

// POST /api/payhero/pay
// Body: { amount, phone, external_reference }
// Creates STK push through PayHero and returns the provider response
app.post('/api/payhero/pay', async (req, res) => {
  const { amount, phone, external_reference } = req.body || {};
  if (!amount || !phone || !external_reference) {
    return res.status(400).json({ success: false, message: 'Missing amount, phone, or external_reference' });
  }

  try {
    // Build PayHero request payload — adjust to your PayHero API contract
    const payload = {
      amount,
      phone,
      external_reference,
      callback_url: `${CALLBACK_BASE_URL}/api/payhero/callback`,
    };

    const response = await axios.post(`${PAYHERO_API_URL}/stk/push`, payload, {
      headers: {
        Authorization: `Bearer ${PAYHERO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    return res.json({ success: true, data: response.data });
  } catch (err) {
    console.error('PayHero STK push error:', err?.response?.data || err.message || err);
    const message = err?.response?.data?.message || err.message || 'PayHero request failed';
    return res.status(500).json({ success: false, message });
  }
});

// POST /api/payhero/callback
// PayHero will POST transaction results here
app.post('/api/payhero/callback', async (req, res) => {
  const body = req.body || {};

  // Example expected fields (adjust to PayHero callback shape):
  // { external_reference: "donationId|campaignId", transaction_id: "...", status: "SUCCESS" , amount: 100 }

  const external_reference = body.external_reference || body.reference || body.metadata?.external_reference;
  const transactionId = body.transaction_id || body.transaction || body.id || body.txn_id;
  const status = (body.status || body.transaction_status || '').toLowerCase();
  const amount = body.amount || body.value || (body.data && body.data.amount);

  if (!external_reference) {
    console.warn('Callback received without external_reference:', body);
    return res.status(400).json({ success: false, message: 'Missing external_reference' });
  }

  // Parse our external_reference format donationId|campaignId
  const parts = String(external_reference).split('|');
  const donationId = parts[0];
  const campaignId = parts[1];

  if (!donationId || !campaignId) {
    console.warn('Invalid external_reference format, expected donationId|campaignId:', external_reference);
    return res.status(400).json({ success: false, message: 'Invalid external_reference format' });
  }

  try {
    // Determine final outcome
    const success = status === 'success' || status === 'completed' || status === 'ok';

    if (!success) {
      // Mark donation as failed
      await db.ref(`donations/${donationId}`).update({ status: 'failed', transactionId });
      return res.json({ success: true, message: 'Donation marked as failed' });
    }

    // Optionally verify transaction using PayHero API (if endpoint available)
    // If you want to double-check the transaction details, uncomment and adjust the lines below.
    // try {
    //   const verify = await axios.get(`${PAYHERO_API_URL}/transactions/${transactionId}`, {
    //     headers: { Authorization: `Bearer ${PAYHERO_API_KEY}` },
    //   });
    //   // You can compare verify.data.amount with amount, etc.
    // } catch (e) {
    //   console.warn('PayHero verify failed, proceeding to update DB anyway');
    // }

    // Update donation: set completed and attach transaction id
    await db.ref(`donations/${donationId}`).update({ status: 'completed', transactionId, completedAt: Date.now() });

    // Update campaign totals (safe add)
    const campaignRef = db.ref(`campaigns/${campaignId}`);
    const campaignSnap = await campaignRef.once('value');
    const campaign = campaignSnap.val() || {};
    const currentRaised = Number(campaign.raised || campaign.raisedAmount || 0);
    const raisedToAdd = Number(amount || 0);
    await campaignRef.update({
      raised: currentRaised + raisedToAdd,
      donors: (Number(campaign.donors || 0) + 1),
    });

    // Update wallet balance under `wallets/<campaignId>/balance` (adjust to your schema)
    const walletRef = db.ref(`wallets/${campaignId}/balance`);
    const walletSnap = await walletRef.once('value');
    const walletBalance = Number(walletSnap.val() || 0);
    await walletRef.set(walletBalance + raisedToAdd);

    return res.json({ success: true, message: 'Donation completed and campaign updated' });
  } catch (err) {
    console.error('Error processing callback:', err?.message || err);
    return res.status(500).json({ success: false, message: 'Server error processing callback' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`PayHero server running on port ${PORT}`);
});
