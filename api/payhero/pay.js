import axios from 'axios';
import admin from 'firebase-admin';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { amount, phone, external_reference, customer_name } = req.body || {};
  if (!amount || !phone || !external_reference) {
    return res.status(400).json({ success: false, message: 'Missing amount, phone or external_reference' });
  }

  // Build the exact PayHero payments endpoint. Prefer an explicit PAYHERO_PAYMENTS_URL,
  // fall back to PAYHERO_API_URL or PAYHERO_BASE_URL, otherwise use the official default.
  const PAYHERO_API_URL = process.env.PAYHERO_API_URL || (process.env.PAYHERO_BASE_URL ? `${process.env.PAYHERO_BASE_URL.replace(/\/$/, '')}/api/v2` : 'https://backend.payhero.co.ke/api/v2');
  const PAYHERO_PAYMENTS_URL = process.env.PAYHERO_PAYMENTS_URL || (process.env.PAYHERO_API_URL ? `${process.env.PAYHERO_API_URL.replace(/\/$/, '')}/payments` : (process.env.PAYHERO_BASE_URL ? `${process.env.PAYHERO_BASE_URL.replace(/\/$/, '')}/api/v2/payments` : 'https://backend.payhero.co.ke/api/v2/payments'));
  // Accept either PAYHERO_API_KEY or PAYHERO_AUTH_TOKEN (your project has PAYHERO_AUTH_TOKEN)
  const PAYHERO_API_KEY = process.env.PAYHERO_API_KEY || process.env.PAYHERO_AUTH_TOKEN;
  const PAYHERO_CHANNEL_ID = process.env.PAYHERO_CHANNEL_ID;
  const PAYHERO_PROVIDER = process.env.PAYHERO_PROVIDER || 'm-pesa';
  // Allow explicit callback override via PAYHERO_CALLBACK_URL or fallback to CALLBACK_BASE_URL or Vercel URL
  const callbackBase = process.env.PAYHERO_CALLBACK_URL || process.env.CALLBACK_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  const callbackUrl = callbackBase ? (process.env.PAYHERO_CALLBACK_URL ? process.env.PAYHERO_CALLBACK_URL : `${callbackBase.replace(/\/$/, '')}/api/payhero/callback`) : undefined;

  if (!PAYHERO_API_KEY) {
    console.error('PAYHERO_API_KEY (or PAYHERO_AUTH_TOKEN) not set in environment');
    return res.status(500).json({ success: false, message: 'PayHero auth token not configured' });
  }

  if (!PAYHERO_CHANNEL_ID) {
    console.error('PAYHERO_CHANNEL_ID not set in environment');
    return res.status(500).json({ success: false, message: 'PayHero channel id not configured' });
  }

  // initialize firebase (not strictly needed for /pay but keeps parity)
  try { initFirebase(); } catch (e) { console.warn('firebase init failed in pay handler', e.message || e); }

  // Ensure a minimum test amount of 1 Ksh is used to avoid zero/invalid payments
  const payload = {
    amount: Math.max(1, Number(amount)),
    phone_number: normalizePhone(phone),
    channel_id: Number(PAYHERO_CHANNEL_ID),
    provider: PAYHERO_PROVIDER,
    external_reference,
    customer_name: customer_name || `donor-${String(external_reference).split('|')[0]}`,
    callback_url: callbackUrl,
  };

  try {
    // PayHero expects a Basic auth token in the Authorization header. Allow callers to
    // provide the token either as the raw token or already prefixed with 'Basic '.
    const authHeader = String(PAYHERO_API_KEY).startsWith('Basic ') ? String(PAYHERO_API_KEY) : `Basic ${PAYHERO_API_KEY}`;

    // Post directly to the payments endpoint.
    // (This will be: https://backend.payhero.co.ke/api/v2/payments by default)
    const response = await axios.post(PAYHERO_PAYMENTS_URL, payload, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    // PayHero returns a body we should inspect for provider references regardless of status.
    const payheroData = response.data || {};
    const possibleRefs = [
      payheroData.reference,
      payheroData.payment_reference,
      payheroData.data && payheroData.data.reference,
      payheroData.response && payheroData.response.Reference,
      payheroData.checkout_request_id,
      payheroData.CheckoutRequestID,
      payheroData.external_reference,
    ];
    const payheroRef = possibleRefs.find(Boolean) || null;

    try {
      // Try to save mapping to Realtime DB if we have both a payheroRef and external_reference
      const admin = initFirebase();
      const db = admin.database();
      const ext = external_reference || null;
      if (payheroRef && ext) {
        const parts = String(ext).split('|');
        const donationId = parts[0];
        const campaignId = parts[1] || null;
        if (donationId) {
          await db.ref(`payheroRefs/${String(payheroRef)}`).set({ donationId, campaignId, createdAt: Date.now() });
          // Also attach the provider reference to the donation record so status checks that
          // start from donationId can find the provider reference rather than guessing.
          try {
            await db.ref(`donations/${donationId}/payheroRef`).set(String(payheroRef));
          } catch (innerErr) {
            console.warn('Failed to write payheroRef to donation record', innerErr?.message || innerErr);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to persist payhero reference mapping', e?.message || e);
    }

    // Always surface a top-level `reference` field for the client to consume
    const responseBody = { success: true, status: payheroData.status || (response.status === 201 ? 'QUEUED' : 'OK'), reference: payheroRef, data: payheroData };
    return res.status(response.status === 201 ? 201 : 200).json(responseBody);
  } catch (err) {
    console.error('PayHero /payments error', err?.response?.data || err.message || err);
    const errBody = err?.response?.data || err.message || 'PayHero request failed';
    // Return the upstream error body when available to aid debugging
    return res.status(502).json({ success: false, message: errBody });
  }
}
