const PAYHERO_API_URL = 'http://localhost:5000/api';

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

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Payment request failed' }));
    throw new Error(error.message || 'Payment request failed');
  }

  return response.json() as Promise<{ success: boolean; message: string; checkout_request_id?: string }>;
};
