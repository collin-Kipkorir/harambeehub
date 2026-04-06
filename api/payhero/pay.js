const axios = require('axios');
const admin = require('firebase-admin');

// Initialize Firebase Admin once
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
    // Let firebase-admin attempt default credentials
    admin.initializeApp({ databaseURL: dbUrl });
  }
  return admin;
}

function normalizePhone(phone) {
  if (!phone) return phone;
  let p = phone.trim();
  // Remove leading +
  if (p.startsWith('+')) p = p.slice(1);
  // If starts with 0, convert to 254
  if (p.startsWith('0')) p = '254' + p.slice(1);
  // If already starts with 7 or 1 etc, assume missing country code (not safe) - leave as is
  return p;
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { amount, phone, external_reference, customer_name } = req.body || {};
  if (!amount || !phone || !external_reference) {
    return res.status(400).json({ success: false, message: 'Missing amount, phone or external_reference' });
  }

  // Support both PAYHERO_API_URL or PAYHERO_BASE_URL (from your Vercel vars)
  const PAYHERO_API_URL = process.env.PAYHERO_API_URL || (process.env.PAYHERO_BASE_URL ? `${process.env.PAYHERO_BASE_URL.replace(/\/$/, '')}/api/v2` : 'https://backend.payhero.co.ke/api/v2');
  // Accept either PAYHERO_API_KEY or PAYHERO_AUTH_TOKEN (your project has PAYHERO_AUTH_TOKEN)
  const PAYHERO_API_KEY = process.env.PAYHERO_API_KEY || process.env.PAYHERO_AUTH_TOKEN;
  const PAYHERO_CHANNEL_ID = process.env.PAYHERO_CHANNEL_ID;
  const PAYHERO_PROVIDER = process.env.PAYHERO_PROVIDER || 'm-pesa';
  // Allow explicit callback override via PAYHERO_CALLBACK_URL or fallback to CALLBACK_BASE_URL or Vercel URL
  const callbackBase = process.env.PAYHERO_CALLBACK_URL || process.env.CALLBACK_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  const callbackUrl = callbackBase ? (process.env.PAYHERO_CALLBACK_URL ? process.env.PAYHERO_CALLBACK_URL : `${callbackBase.replace(/\/$/, '')}/api/payhero/callback`) : undefined;

  if (!PAYHERO_API_KEY) {
    console.warn('PAYHERO_API_KEY not set');
  }

  // initialize firebase (not strictly needed for /pay but keeps parity)
  try { initFirebase(); } catch (e) { console.warn('firebase init failed in pay handler', e.message || e); }

  const payload = {
    amount,
    phone_number: normalizePhone(phone),
    channel_id: PAYHERO_CHANNEL_ID ? Number(PAYHERO_CHANNEL_ID) : undefined,
    provider: PAYHERO_PROVIDER,
    external_reference,
    customer_name: customer_name || `donor-${external_reference.split('|')[0]}`,
    callback_url: callbackUrl,
  };

  try {
    const response = await axios.post(`${PAYHERO_API_URL}/payments`, payload, {
      headers: { Authorization: `Bearer ${PAYHERO_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    return res.status(200).json({ success: true, data: response.data });
  } catch (err) {
    console.error('PayHero /payments error', err?.response?.data || err.message || err);
    return res.status(500).json({ success: false, message: err?.response?.data || err.message || 'PayHero request failed' });
  }
};
