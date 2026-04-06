import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ImagePlus, Clock, MessageCircle } from 'lucide-react';
import { addCampaignToFirebase } from '@/lib/firebaseCampaigns';

export default function CreateCampaign() {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await addCampaignToFirebase({
        title,
        description,
        image: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=600&h=400&fit=crop',
        target: Number(target) || 100000,
        raised: 0,
        donors: 0,
        daysLeft: 30,
        organizer: title, // Will be replaced with user name when auth is added
        category: category || 'Other',
        status: 'pending',
        whatsappNumber: whatsapp,
      });

      setSubmitted(true);
      toast.success('Campaign submitted for review!', {
        description: 'An admin will review your fundraiser. You will be contacted via WhatsApp if any changes are needed.',
      });
    } catch {
      toast.error('Failed to submit campaign. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 pb-24 text-center space-y-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-4"
        >
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Under Review</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Your campaign has been submitted and is pending admin approval. Once approved, it will go live on the listing.
          </p>
          <div className="bg-muted/50 rounded-2xl border p-4 text-left space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageCircle className="w-4 h-4 text-primary" />
              WhatsApp Updates
            </div>
            <p className="text-xs text-muted-foreground">
              If corrections are needed, the admin will reach you on <span className="font-semibold text-foreground">{whatsapp}</span>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Start a Fundraiser</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create your campaign — it will be reviewed by an admin before going live
          </p>
        </div>

        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-accent mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Admin Approval Required</p>
            <p className="text-xs text-muted-foreground">
              All campaigns are reviewed before going live. You'll be contacted via WhatsApp if changes are needed.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors">
            <ImagePlus className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Tap to add a cover photo</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Campaign title</label>
            <Input placeholder="e.g. Help John with medical bills" value={title} onChange={(e) => setTitle(e.target.value)} className="h-12 rounded-xl text-base" required />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Target amount (KES)</label>
            <Input type="number" placeholder="e.g. 500000" value={target} onChange={(e) => setTarget(e.target.value)} className="h-12 rounded-xl text-base" required min={1000} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-12 rounded-xl text-base">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Medical">Medical</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
                <SelectItem value="Community">Community</SelectItem>
                <SelectItem value="Emergency">Emergency</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">WhatsApp Number</label>
            <Input type="tel" placeholder="e.g. 0712345678" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="h-12 rounded-xl text-base" required />
            <p className="text-xs text-muted-foreground">Admin will contact you here if corrections are needed for approval</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea placeholder="Tell people why you need help..." value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[120px] rounded-xl text-base" required />
          </div>

          <motion.div whileTap={{ scale: 0.98 }}>
            <Button type="submit" className="w-full h-14 rounded-2xl text-base font-bold" size="lg" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
}
