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

        // Prefer a stored PayHero provider reference on the donation (saved at /payments time)
        // If present, use it to query PayHero. Otherwise fall back to building the
        // external_reference (donationId|campaignId) which PayHero may not recognize.
        if (!refToCheck) {
          if (donationSnapshot.payheroRef) {
            refToCheck = donationSnapshot.payheroRef;
          } else if (donationSnapshot.campaignId) {
            refToCheck = `${donationId}|${donationSnapshot.campaignId}`;
          }
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

    // If PayHero reports a successful transaction, perform an idempotent DB update so
    // clients see the donation as completed immediately.
    const transaction = response.data;

    // Determine if the transaction indicates success. PayHero responses vary, check a few shapes.
    let isSuccess = false;
    try {
      if (transaction) {
        if (transaction.success === true) isSuccess = true;
        const statusVal = (transaction.status || transaction.Status || '').toString().toUpperCase();
        if (statusVal === 'SUCCESS') isSuccess = true;
        const resp = transaction.response || transaction.data || transaction.body || null;
        if (resp) {
          const respStatus = (resp.Status || resp.status || '').toString().toUpperCase();
          const respCode = resp.ResultCode || resp.result_code || resp.resultCode;
          if (respStatus === 'SUCCESS' || Number(respCode) === 0) isSuccess = true;
        }
      }
    } catch (e) {
      console.warn('Failed to interpret PayHero transaction response', e?.message || e);
    }

    // If success, try to resolve donationId/campaignId from the refToCheck.
    try {
      let dId = null;
      let cId = null;
      // If the refToCheck contains our internal format (donationId|campaignId) use it
      if (refToCheck && String(refToCheck).includes('|')) {
        const parts = String(refToCheck).split('|');
        dId = parts[0];
        cId = parts[1];
      } else {
        // Otherwise, treat refToCheck as a PayHero provider reference and look up mapping
        try {
          const mapSnap = await db.ref(`payheroRefs/${String(refToCheck)}`).once('value');
          const mapping = mapSnap.val();
          if (mapping) {
            dId = mapping.donationId || null;
            cId = mapping.campaignId || null;
          }
        } catch (mapErr) {
          console.warn('Failed to read payheroRefs mapping', mapErr?.message || mapErr);
        }

        // If mapping not found, fall back to donationSnapshot if available
        if ((!dId || !cId) && donationSnapshot && donationSnapshot.campaignId) {
          dId = donationId || dId;
          cId = donationSnapshot.campaignId || cId;
        }
      }

      if (isSuccess && dId && cId) {
        const donationRef = db.ref(`donations/${dId}`);
        const campaignRef = db.ref(`campaigns/${cId}`);

        // Ensure we have the donation record (amount etc). If we started from a provider
        // reference we may not have loaded donationSnapshot earlier, so fetch it now.
        let donationRecord = donationSnapshot;
        if (!donationRecord) {
          try {
            const snap = await db.ref(`donations/${dId}`).once('value');
            donationRecord = snap.val();
          } catch (fetchErr) {
            console.warn('Failed to read donation record for amount', fetchErr?.message || fetchErr);
          }
        }

        // Update donation if not already completed
        await donationRef.transaction((current) => {
          if (!current) return current; // donation must exist
          if (current.status === 'completed') return; // already processed
          const txId = (transaction && (transaction.response?.MpesaReceiptNumber || transaction.checkout_request_id || transaction.reference || transaction.data?.reference)) || null;
          return { ...current, status: 'completed', transactionId: txId };
        });

        // Atomically update campaign totals while preventing double-counting by tracking processed donations
        await campaignRef.transaction((current) => {
          if (!current) return current || { raised: 0, donors: 0 };
          current._processedDonations = current._processedDonations || {};
          if (current._processedDonations[dId]) return current; // already applied
          const amount = Number(donationRecord?.amount || 0) || 0;
          // Only apply a positive amount
          if (amount > 0) {
            current.raised = (current.raised || 0) + amount;
            current.donors = (current.donors || 0) + 1;
          }
          current._processedDonations[dId] = true;
          return current;
        });
      }
    } catch (dbErr) {
      console.error('Failed to perform idempotent DB update after status check', dbErr?.message || dbErr);
    }

    return res.status(200).json({ success: true, donationStatus: donationSnapshot?.status || (isSuccess ? 'completed' : 'pending'), transactionStatus: transaction });
  } catch (err) {
    // Provide structured diagnostics in logs to make it easy to debug from Vercel
    console.error('PayHero /transaction-status error', {
      message: err?.message,
      status: err?.response?.status,
      data: err?.response?.data,
      url: PAYHERO_TX_STATUS_URL,
    });
    const errBody = err?.response?.data || err.message || 'PayHero request failed';
    return res.status(502).json({ success: false, message: errBody });
  }
}
