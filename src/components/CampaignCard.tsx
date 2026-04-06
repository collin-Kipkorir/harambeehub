import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProgressBar from './ProgressBar';
import { useDonateStore } from '@/store/useDonateStore';
import type { Campaign } from '@/lib/campaigns';

interface CampaignCardProps {
  campaign: Campaign;
  index?: number;
}

export default function CampaignCard({ campaign, index = 0 }: CampaignCardProps) {
  const openModal = useDonateStore((s) => s.openModal);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="bg-card rounded-2xl overflow-hidden shadow-md border"
    >
      <Link to={`/campaign/${campaign.id}`}>
        <div className="relative">
          <img
            src={campaign.image}
            alt={campaign.title}
            className="w-full h-44 object-cover"
            loading="lazy"
          />
          <span className="absolute top-3 left-3 bg-card/90 backdrop-blur-sm text-xs font-semibold px-3 py-1 rounded-full text-foreground">
            {campaign.category}
          </span>
        </div>
      </Link>

      <div className="p-4 space-y-3">
        <Link to={`/campaign/${campaign.id}`}>
          <h3 className="font-bold text-foreground leading-tight line-clamp-2 hover:text-primary transition-colors">
            {campaign.title}
          </h3>
        </Link>

        <p className="text-sm text-muted-foreground">by {campaign.organizer}</p>

        <ProgressBar raised={campaign.raised} target={campaign.target} />

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {campaign.donors} donors
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {campaign.daysLeft} days left
          </span>
        </div>

        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            onClick={() => openModal(campaign.id, campaign.title)}
            className="w-full h-12 rounded-2xl font-bold text-base"
          >
            Donate Now
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
