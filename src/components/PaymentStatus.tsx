import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentStatusProps {
  status: 'idle' | 'pending' | 'success' | 'failed';
  onRetry?: () => void;
  onClose?: () => void;
}

export default function PaymentStatus({ status, onRetry, onClose }: PaymentStatusProps) {
  if (status === 'idle') return null;

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
            <div className="rounded-3xl border border-primary/15 bg-primary/5 px-5 py-6 space-y-5">
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-primary/15"
                  animate={{ scale: [1, 1.08, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary/80">
                  M-Pesa STK Push Sent
                </p>
                <p className="text-xl font-bold text-foreground">
                  Waiting for PIN authorization on your phone
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  We have sent the payment prompt to your M-Pesa line. Open the prompt on your phone and enter your PIN to finish the donation securely.
                </p>
              </div>

              <div className="grid gap-2 text-left">
                <div className="rounded-2xl bg-background/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 1</p>
                  <p className="text-sm font-medium text-foreground">Check your phone for the M-Pesa prompt</p>
                </div>
                <div className="rounded-2xl bg-background/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 2</p>
                  <p className="text-sm font-medium text-foreground">Enter your M-Pesa PIN to authorize the payment</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                This screen will update automatically after you approve or cancel the request.
              </p>
            </div>
            {/* removed manual check button - status will reflect updates from DB/callbacks */}
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
