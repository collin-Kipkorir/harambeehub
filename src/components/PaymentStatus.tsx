import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useDonateStore } from '@/store/useDonateStore';

interface PaymentStatusProps {
  status: 'idle' | 'pending' | 'success' | 'failed';
  donationId?: string | null;
  onRetry?: () => void;
  onClose?: () => void;
}

export default function PaymentStatus({ status, donationId, onRetry, onClose }: PaymentStatusProps) {
  const setStatus = useDonateStore((s) => s.setStatus);
  const [checking, setChecking] = useState(false);

  if (status === 'idle') return null;

  const checkStatus = async () => {
    try {
      setChecking(true);
      // Ask the server to check transaction-status for the current donation if present
      // We rely on donations being created with an external_reference of donationId|campaignId
      // The client will construct donationId from listening state (the modal stores the id locally)
      // A simple approach: call /api/payhero/status?donationId=<id> — the donate modal supplies the id via a data attribute on the page
      // However, we don't have donationId prop here; instead we ask the server to return latest known status for the current session.
      // To keep this minimal and safe, call the status endpoint without donationId — it will return an error if missing.
  const url = donationId ? `/api/payhero/status?donationId=${encodeURIComponent(donationId)}` : '/api/payhero/status';
  const resp = await fetch(url);
      if (!resp.ok) {
        console.warn('Status check failed', resp.status);
        return;
      }
      const json = await resp.json();
      // If server reports donationStatus, update local UI
      if (json?.donationStatus === 'completed') setStatus('success');
      if (json?.donationStatus === 'failed') setStatus('failed');
    } catch (err) {
      console.warn('Failed to check status', err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="text-center py-6 space-y-4"
      >
        {status === 'pending' && (
          <>
            <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
            <div>
              <p className="font-semibold text-foreground">Check your phone</p>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your M-Pesa PIN to complete the payment
              </p>
            </div>
            <div className="flex gap-2 justify-center mt-3">
              <Button onClick={checkStatus} size="sm" disabled={checking} variant="outline">
                {checking ? (
                  <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Checking</span>
                ) : (
                  <span className="inline-flex items-center gap-2"><RefreshCw className="w-4 h-4"/> Check status</span>
                )}
              </Button>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 10 }}
            >
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
            </motion.div>
            <div>
              <p className="font-bold text-xl text-foreground">Asante sana! 🎉</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your donation has been received successfully
              </p>
            </div>
            {onClose && (
              <Button onClick={onClose} className="w-full rounded-2xl h-12 mt-2">
                Done
              </Button>
            )}
          </>
        )}

        {status === 'failed' && (
          <>
            <XCircle className="w-16 h-16 text-destructive mx-auto" />
            <div>
              <p className="font-semibold text-foreground">Payment failed</p>
              <p className="text-sm text-muted-foreground mt-1">
                The transaction could not be completed. Please try again.
              </p>
            </div>
            {onRetry && (
              <Button onClick={onRetry} variant="outline" className="w-full rounded-2xl h-12">
                Try Again
              </Button>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
