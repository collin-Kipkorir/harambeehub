import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Share2, Users, Clock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProgressBar from '@/components/ProgressBar';
import { useDonateStore } from '@/store/useDonateStore';
import { useCampaign } from '@/hooks/useCampaign';

export default function CampaignPage() {
  const { id } = useParams();
  const openModal = useDonateStore((s) => s.openModal);
  const { campaign, loading } = useCampaign(id);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">Loading campaign...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">Campaign not found</p>
      </div>
    );
  }

  const shareOnWhatsApp = () => {
    const url = window.location.href;
    const text = `Support this fundraiser 🙏 ${campaign.title} — ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  return (
    <div className="pb-32">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <img
          src={campaign.image}
          alt={campaign.title}
          className="w-full h-56 object-cover"
        />
      </motion.div>

      <div className="max-w-lg mx-auto px-4 -mt-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-3xl shadow-xl border p-5 space-y-4"
        >
          <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">
            {campaign.category}
          </span>

          <h1 className="text-xl font-extrabold text-foreground leading-tight">
            {campaign.title}
          </h1>

          <p className="text-sm text-muted-foreground">
            Organized by <span className="font-semibold text-foreground">{campaign.organizer}</span>
          </p>

          <ProgressBar raised={campaign.raised} target={campaign.target} />

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              {campaign.donors} donors
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 bg-card rounded-2xl border p-5"
        >
          <h2 className="font-bold text-foreground mb-2">About this fundraiser</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {campaign.description}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4 bg-primary/5 rounded-2xl border border-primary/20 p-4 flex items-start gap-3"
        >
          <Shield className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Verified Campaign</p>
            <p className="text-xs text-muted-foreground">
              This fundraiser has been reviewed and verified by HarambeeHub.
            </p>
          </div>
        </motion.div>
      </div>

      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t p-4 z-40">
        <div className="max-w-lg mx-auto flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="rounded-2xl h-14 px-4"
            onClick={shareOnWhatsApp}
          >
            <Share2 className="w-5 h-5" />
          </Button>
          <motion.div whileTap={{ scale: 0.98 }} className="flex-1">
            <Button
              size="lg"
              className="w-full rounded-2xl h-14 font-bold text-base"
              onClick={() => openModal(campaign.id, campaign.title)}
            >
              Donate Now
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
