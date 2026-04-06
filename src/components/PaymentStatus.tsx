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
            <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
            <div>
              <p className="font-semibold text-foreground">Check your phone</p>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your M-Pesa PIN to complete the payment
              </p>
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
