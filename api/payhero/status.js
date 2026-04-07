import axios from 'axios';
import admin from 'firebase-admin';

function initFirebase() {
  if (admin.apps && admin.apps.length) return admin;
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
  const dbUrl = process.env.FIREBASE_DATABASE_URL;

  let saString = saJson || null;
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
    admin.initializeApp({ databaseURL: dbUrl });
  } else {
    admin.initializeApp({ databaseURL: dbUrl });
  }
  return admin;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { donationId, reference } = req.query || {};

  // Initialize Firebase
  try { initFirebase(); } catch (e) { console.warn('firebase init failed in status handler', e.message || e); }

  const db = admin.database();

  let refToCheck = reference;
  let donationSnapshot = null;

  try {
    if (donationId) {
      const snap = await db.ref(`donations/${donationId}`).once('value');
      donationSnapshot = snap.val();
      if (donationSnapshot) {
        if (donationSnapshot.status && donationSnapshot.status !== 'pending') {
          return res.status(200).json({ success: true, donationStatus: donationSnapshot.status, donation: donationSnapshot });
        }

        // build external_reference if possible
        if (!refToCheck && donationSnapshot.campaignId) {
          refToCheck = `${donationId}|${donationSnapshot.campaignId}`;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to read donation', err?.message || err);
  }

  if (!refToCheck) {
    return res.status(400).json({ success: false, message: 'Missing donationId or reference to check' });
  }

  // Build PayHero transaction-status URL
  const PAYHERO_API_URL = process.env.PAYHERO_API_URL || (process.env.PAYHERO_BASE_URL ? `${process.env.PAYHERO_BASE_URL.replace(/\/$/, '')}/api/v2` : 'https://backend.payhero.co.ke/api/v2');
  const PAYHERO_TX_STATUS_URL = `${PAYHERO_API_URL.replace(/\/$/, '')}/transaction-status?reference=${encodeURIComponent(refToCheck)}`;
  const PAYHERO_API_KEY = process.env.PAYHERO_API_KEY || process.env.PAYHERO_AUTH_TOKEN;

  if (!PAYHERO_API_KEY) {
    return res.status(500).json({ success: false, message: 'PayHero auth token not configured' });
  }

  try {
    const authHeader = String(PAYHERO_API_KEY).startsWith('Basic ') ? String(PAYHERO_API_KEY) : `Basic ${PAYHERO_API_KEY}`;
    const response = await axios.get(PAYHERO_TX_STATUS_URL, { headers: { Authorization: authHeader }, timeout: 10000 });

    return res.status(200).json({ success: true, donationStatus: donationSnapshot?.status || 'pending', transactionStatus: response.data });
  } catch (err) {
    console.error('PayHero /transaction-status error', err?.response?.data || err.message || err);
    const errBody = err?.response?.data || err.message || 'PayHero request failed';
    return res.status(502).json({ success: false, message: errBody });
  }
}
