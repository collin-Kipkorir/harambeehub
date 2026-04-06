import { motion } from 'framer-motion';

interface ProgressBarProps {
  raised: number;
  target: number;
  className?: string;
}

export default function ProgressBar({ raised, target, className = '' }: ProgressBarProps) {
  const percentage = Math.min((raised / target) * 100, 100);

  return (
    <div className={className}>
      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs">
        <span className="font-semibold text-foreground">
          KES {raised.toLocaleString()}
        </span>
        <span className="text-muted-foreground">
          {percentage.toFixed(0)}% of KES {target.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
