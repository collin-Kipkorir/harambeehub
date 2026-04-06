import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import CampaignCard from '@/components/CampaignCard';
import { useCampaigns } from '@/hooks/useCampaigns';

const categories = ['All', 'Medical', 'Education', 'Community', 'Emergency'];

export default function Feed() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const { campaigns, loading } = useCampaigns();

  const filtered = campaigns.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || c.category === activeCategory;
    const isApproved = c.status === 'approved';
    return matchesSearch && matchesCategory && isApproved;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24 space-y-4">
      <h1 className="text-2xl font-extrabold text-foreground">Explore</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search fundraisers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 rounded-2xl pl-10 text-base"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => (
          <motion.button
            key={cat}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {cat}
          </motion.button>
        ))}
      </div>

      {loading ? (
        <p className="text-center py-12 text-muted-foreground">Loading campaigns...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length > 0 ? (
            filtered.map((c, i) => <CampaignCard key={c.id} campaign={c} index={i} />)
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No campaigns found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
