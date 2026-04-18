import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDonateStore } from '@/store/useDonateStore';
import { initiatePayment } from '@/lib/payhero';
import { createDonation } from '@/lib/donate';
import PaymentStatus from './PaymentStatus';
import { motion } from 'framer-motion';
import { Smartphone } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useEffect, useRef, useState } from 'react';
import { useStatusPolling } from '@/hooks/useStatusPolling';

const suggestedAmounts = [50, 100, 500, 1000, 5000];

export default function DonateModal() {
  const {
    isModalOpen,
    closeModal,
    campaignId,
    campaignTitle,
    amount,
    phone,
    status,
    setAmount,
    setPhone,
    setStatus,
    reset,
  } = useDonateStore();

  const unsubRef = useRef<(() => void) | null>(null);
  const [providerRefLocal, setProviderRefLocal] = useState<string | null>(null);

  // start polling when we have a provider reference and are pending
  useStatusPolling(providerRefLocal, status === 'pending', {
    initialDelayMs: 3000,
    maxAttempts: 6,
    backoffFactor: 1.5,
    onSuccess: () => setStatus('success'),
  });

  // Clean up Firebase listener on unmount or modal close
  useEffect(() => {
    return () => {
      unsubRef.current?.();
    };
  }, []);

  const handlePay = async () => {
    if (!campaignId || !amount || !phone) return;

    setStatus('pending');

    try {
      // 1. Save donation to Firebase with status "pending"
      const donationId = await createDonation({
        campaignId,
        amount: Number(amount),
        phone,
      });

      if (!donationId) throw new Error('Failed to create donation');

  // keep a local copy so we can poll the status endpoint while waiting for callbacks
  // The provider reference is returned by the /payments call; we'll set it below.

      // 2. Listen for donation status changes in Firebase (callback will update this)
      const donationRef = ref(db, `donations/${donationId}/status`);
      unsubRef.current = onValue(donationRef, (snapshot) => {
        const donationStatus = snapshot.val();
        if (donationStatus === 'completed') {
          setStatus('success');
          unsubRef.current?.();
        } else if (donationStatus === 'failed') {
          setStatus('failed');
          unsubRef.current?.();
        }
      });

      // 3. Call backend to initiate STK push
      const payResp = await initiatePayment({
        amount: Number(amount),
        phone,
        campaignId,
        donationId,
      });

      // Try to extract a provider reference from the PayHero response and store locally
      const payData = payResp?.data || payResp;
      const possible = [
        payData?.reference,
        payData?.payment_reference,
        payData?.data?.reference,
        payData?.response?.Reference,
        payData?.checkout_request_id,
        payData?.CheckoutRequestID,
      ];
      const providerRef = possible.find(Boolean) || null;
      if (providerRef) setProviderRefLocal(String(providerRef));

      // Status will be updated by Firebase listener when callback is received
    } catch {
      setStatus('failed');
      unsubRef.current?.();
    }
  };

  const handleClose = () => {
    unsubRef.current?.();
    setProviderRefLocal(null);
    closeModal();
  };

  const isFormValid = amount && Number(amount) >= 1 && phone.length >= 10;

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md mx-auto rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
        <div className="bg-primary px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-primary-foreground text-lg font-bold">
              Donate to {campaignTitle}
            </DialogTitle>
            <p className="text-primary-foreground/80 text-sm mt-1">
              Secure M-Pesa payment via PayHero
            </p>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 pt-4">
          {status !== 'idle' ? (
            <PaymentStatus
              status={status}
              onRetry={() => {
                unsubRef.current?.();
                reset();
              }}
              onClose={handleClose}
            />
          ) : (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select amount (KES)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {suggestedAmounts.map((val) => (
                    <motion.button
                      key={val}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setAmount(String(val))}
                      className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        amount === String(val)
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted text-foreground hover:bg-muted/80'
                      }`}
                    >
                      {val.toLocaleString()}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Or enter custom amount (min KES 1)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 2500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12 rounded-xl text-base"
                  min={1}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  M-Pesa phone number
                </label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="0712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 rounded-xl text-base pl-10"
                    maxLength={13}
                  />
                </div>
              </div>

              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handlePay}
                  disabled={!isFormValid}
                  className="w-full h-14 rounded-2xl text-base font-bold shadow-lg"
                  size="lg"
                >
                  Pay KES {amount ? Number(amount).toLocaleString() : '0'} with M-Pesa
                </Button>
              </motion.div>

              <p className="text-xs text-center text-muted-foreground">
                🔒 Payments processed securely via PayHero
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
