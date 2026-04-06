import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import CampaignCard from '@/components/CampaignCard';
import { useCampaigns } from '@/hooks/useCampaigns';
import { seedInitialCampaigns } from '@/lib/firebaseCampaigns';

const Index = () => {
  const { campaigns, loading } = useCampaigns();

  useEffect(() => {
    seedInitialCampaigns();
  }, []);

  const approved = campaigns.filter((c) => c.status === 'approved');
  const trending = approved.slice(0, 2);
  const urgent = approved.filter((c) => c.daysLeft <= 12);

  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="relative bg-primary overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-primary-foreground rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-lg mx-auto px-4 pt-10 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center gap-2 bg-primary-foreground/15 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <Heart className="w-3.5 h-3.5 text-accent" fill="currentColor" />
              <span className="text-xs font-semibold text-primary-foreground">
                Trusted by 10,000+ Kenyans
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-primary-foreground leading-tight">
              Give with <span className="text-accent">purpose.</span>
              <br />
              Change a life today.
            </h1>
            <p className="text-primary-foreground/80 text-sm leading-relaxed">
              Donate securely via M-Pesa in seconds. Every shilling counts.
            </p>
            <div className="flex gap-2 sm:gap-3">
              <Link to="/feed" className="flex-1 sm:flex-none">
                <Button
                  size="lg"
                  className="w-full sm:w-auto rounded-2xl h-11 sm:h-12 text-sm sm:text-base font-bold bg-accent text-accent-foreground hover:bg-accent/90 px-3 sm:px-4"
                >
                  Explore Causes
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <Link to="/create" className="flex-1 sm:flex-none">
                <Button
                  size="lg"
                  className="w-full sm:w-auto rounded-2xl h-11 sm:h-12 text-sm sm:text-base font-bold bg-primary-foreground text-primary hover:bg-primary-foreground/90 px-3 sm:px-4"
                >
                  Start Fundraiser
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-lg mx-auto px-4 -mt-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl shadow-lg border p-4 grid grid-cols-3 gap-4"
        >
          {[
            { label: 'Raised', value: `KES ${(campaigns.reduce((s, c) => s + c.raised, 0) / 1000000).toFixed(1)}M+` },
            { label: 'Campaigns', value: `${campaigns.length}+` },
            { label: 'Donors', value: `${campaigns.reduce((s, c) => s + c.donors, 0).toLocaleString()}+` },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-extrabold text-foreground text-lg">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Trending */}
      <section className="max-w-5xl mx-auto px-4 mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg text-foreground">Trending Now</h2>
          </div>
          <Link to="/feed" className="text-sm font-semibold text-primary">
            See all
          </Link>
        </div>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading campaigns...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trending.map((c, i) => (
              <CampaignCard key={c.id} campaign={c} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Urgent */}
      {urgent.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 mt-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
            </span>
            <h2 className="font-bold text-lg text-foreground">Urgent Appeals</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {urgent.map((c, i) => (
              <CampaignCard key={c.id} campaign={c} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Index;
