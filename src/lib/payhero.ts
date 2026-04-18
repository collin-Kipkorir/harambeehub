// In development the standalone server may run at localhost:5000; in production use relative /api (Vercel functions)
const PAYHERO_API_URL = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

export const initiatePayment = async (payload: {
  amount: number;
  phone: string;
  campaignId: string;
  donationId: string;
}) => {
  const response = await fetch(`${PAYHERO_API_URL}/payhero/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: payload.amount,
      phone: payload.phone,
      external_reference: `${payload.donationId}|${payload.campaignId}`,
    }),
  });

  // Parse JSON body when available
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message = json?.message || json?.error || json?.error_message || 'Payment request failed';
    throw new Error(message);
  }

  // Normalize and return a convenient shape for callers.
  // Try common fields that PayHero may return (varies by account / integration)
  const possible = [
    json?.reference,
    json?.payment_reference,
    json?.data?.reference,
    json?.response?.Reference,
    json?.checkout_request_id,
    json?.CheckoutRequestID,
  ];
  const reference = possible.find(Boolean) || null;

  return {
    success: true,
    message: json?.message || null,
    reference,
    raw: json,
  } as { success: boolean; message?: string | null; reference?: string | null; raw?: any };
};
