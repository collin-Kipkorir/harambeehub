import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle, XCircle, MessageCircle, Clock, Eye, Send, Shield, Users,
  DollarSign, TrendingUp, Filter, PlusCircle, LogOut, Image, Pencil,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import ProgressBar from '@/components/ProgressBar';
import type { Campaign, CampaignStatus } from '@/lib/campaigns';
import { useCampaigns } from '@/hooks/useCampaigns';
import { updateCampaignStatus, addCampaignToFirebase, updateCampaign } from '@/lib/firebaseCampaigns';
import { useToast } from '@/hooks/use-toast';

type DisburseInfo = { campaign: Campaign; amount: string; phone: string };

export default function AdminPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { campaigns: campaignList, loading } = useCampaigns();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [disburseModal, setDisburseModal] = useState<DisburseInfo | null>(null);
  const [rejectModal, setRejectModal] = useState<Campaign | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    title: '', description: '', image: '', target: '', category: 'Medical',
    organizer: '', whatsappNumber: '', status: 'approved' as CampaignStatus,
  });
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);

  // Auth check
  if (sessionStorage.getItem('harambee_admin') !== 'true') {
    navigate('/admin-login');
    return null;
  }

  const filtered = campaignList.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.organizer.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pending = campaignList.filter((c) => c.status === 'pending');
  const approved = campaignList.filter((c) => c.status === 'approved');
  const totalRaised = campaignList.reduce((s, c) => s + c.raised, 0);
  const totalDonors = campaignList.reduce((s, c) => s + c.donors, 0);

  const handleUpdateStatus = async (id: string, status: CampaignStatus) => {
    await updateCampaignStatus(id, status);
    toast({
      title: status === 'approved' ? '✅ Campaign Approved' : '❌ Campaign Rejected',
      description: `Campaign has been ${status}.`,
    });
  };

  const contactOnWhatsApp = (phone: string, title: string, message?: string) => {
    const text = message || `Hi, regarding your HarambeeHub campaign "${title}" — `;
    window.open(`https://wa.me/${phone.replace(/^0/, '254')}?text=${encodeURIComponent(text)}`);
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    await handleUpdateStatus(rejectModal.id, 'rejected');
    if (rejectReason.trim()) {
      contactOnWhatsApp(rejectModal.whatsappNumber, rejectModal.title,
        `Hi, your HarambeeHub campaign "${rejectModal.title}" needs corrections before approval:\n\n${rejectReason}\n\nPlease update and resubmit.`);
    }
    setRejectModal(null);
    setRejectReason('');
  };

  const handleDisburse = () => {
    if (!disburseModal) return;
    toast({
      title: '💸 Disbursement Initiated',
      description: `KES ${Number(disburseModal.amount).toLocaleString()} sent to ${disburseModal.phone} for "${disburseModal.campaign.title}".`,
    });
    setDisburseModal(null);
  };

  const handleCreateCampaign = async () => {
    await addCampaignToFirebase({
      title: newCampaign.title,
      description: newCampaign.description,
      image: newCampaign.image || 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=600&h=400&fit=crop',
      target: Number(newCampaign.target) || 100000,
      raised: 0,
      donors: 0,
      daysLeft: 30,
      organizer: newCampaign.organizer,
      category: newCampaign.category,
      status: newCampaign.status,
      whatsappNumber: newCampaign.whatsappNumber,
    });
    setShowCreateModal(false);
    setNewCampaign({ title: '', description: '', image: '', target: '', category: 'Medical', organizer: '', whatsappNumber: '', status: 'approved' });
    toast({ title: '✅ Campaign Created', description: `"${newCampaign.title}" is now ${newCampaign.status}.` });
  };

  const handleEditCampaign = async () => {
    if (!editCampaign) return;
    await updateCampaign(editCampaign.id, {
      title: editCampaign.title,
      description: editCampaign.description,
      image: editCampaign.image,
      target: editCampaign.target,
      organizer: editCampaign.organizer,
      category: editCampaign.category,
      whatsappNumber: editCampaign.whatsappNumber,
      daysLeft: editCampaign.daysLeft,
    });
    setEditCampaign(null);
    toast({ title: '✅ Campaign Updated', description: `"${editCampaign.title}" has been updated.` });
  };

  const handleLogout = () => {
    sessionStorage.removeItem('harambee_admin');
    navigate('/admin-login');
  };

  const statusBadge = (status: CampaignStatus) => {
    const map: Record<CampaignStatus, { class: string; label: string }> = {
      pending: { class: 'text-accent border-accent/30 bg-accent/10', label: 'Pending' },
      approved: { class: 'text-primary border-primary/30 bg-primary/10', label: 'Live' },
      rejected: { class: 'text-destructive border-destructive/30 bg-destructive/10', label: 'Rejected' },
    };
    const s = map[status];
    return <Badge variant="outline" className={`rounded-full text-xs ${s.class}`}>{s.label}</Badge>;
  };

  const stats = [
    { label: 'Total Raised', value: `KES ${totalRaised.toLocaleString()}`, icon: DollarSign },
    { label: 'Total Donors', value: totalDonors.toLocaleString(), icon: Users },
    { label: 'Pending Review', value: pending.length.toString(), icon: Clock },
    { label: 'Live Campaigns', value: approved.length.toString(), icon: TrendingUp },
  ];

  const CampaignRow = ({ c }: { c: Campaign }) => (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <img src={c.image} alt={c.title} className="w-full sm:w-20 h-32 sm:h-20 rounded-xl object-cover shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-foreground text-sm leading-tight line-clamp-1">{c.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">by {c.organizer} · {c.category}</p>
              </div>
              {statusBadge(c.status)}
            </div>
            <ProgressBar raised={c.raised} target={c.target} />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{c.donors} donors</span><span>·</span>
              <span>{c.daysLeft} days left</span><span>·</span>
              <span>KES {c.raised.toLocaleString()} / {c.target.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex sm:flex-col gap-2 shrink-0">
            <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={() => setPreviewCampaign(c)}>
              <Eye className="w-3.5 h-3.5 mr-1" /> Preview
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={() => setEditCampaign({ ...c })}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
            {c.status === 'pending' && (
              <>
                <Button size="sm" className="rounded-xl h-8 text-xs font-bold flex-1 sm:flex-none" onClick={() => handleUpdateStatus(c.id, 'approved')}>
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs font-bold text-destructive border-destructive/30 hover:bg-destructive/10 flex-1 sm:flex-none" onClick={() => setRejectModal(c)}>
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                </Button>
              </>
            )}
            {c.status === 'approved' && c.raised > 0 && (
              <Button size="sm" className="rounded-xl h-8 text-xs font-bold" onClick={() => setDisburseModal({ campaign: c, amount: c.raised.toString(), phone: c.whatsappNumber })}>
                <Send className="w-3.5 h-3.5 mr-1" /> Disburse
              </Button>
            )}
            <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={() => contactOnWhatsApp(c.whatsappNumber, c.title)}>
              <MessageCircle className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Manage campaigns & disbursements</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="rounded-xl font-bold" onClick={() => setShowCreateModal(true)}>
            <PlusCircle className="w-4 h-4 mr-1" /> New Campaign
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="rounded-2xl">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <stat.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                  <p className="text-lg font-extrabold text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading campaigns from Firebase...</p>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <TabsList className="rounded-xl h-10 w-full sm:w-auto">
              <TabsTrigger value="all" className="rounded-lg text-xs font-bold" onClick={() => setStatusFilter('all')}>All ({campaignList.length})</TabsTrigger>
              <TabsTrigger value="pending" className="rounded-lg text-xs font-bold" onClick={() => setStatusFilter('pending')}>Pending ({pending.length})</TabsTrigger>
              <TabsTrigger value="approved" className="rounded-lg text-xs font-bold" onClick={() => setStatusFilter('approved')}>Live ({approved.length})</TabsTrigger>
              <TabsTrigger value="rejected" className="rounded-lg text-xs font-bold" onClick={() => setStatusFilter('rejected')}>Rejected ({campaignList.filter((c) => c.status === 'rejected').length})</TabsTrigger>
            </TabsList>
            <div className="relative flex-1 max-w-sm">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search campaigns…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl h-10" />
            </div>
          </div>
          {['all', 'pending', 'approved', 'rejected'].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-3">
              {filtered.map((c) => <CampaignRow key={c.id} c={c} />)}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewCampaign} onOpenChange={() => setPreviewCampaign(null)}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Campaign Preview</DialogTitle>
            <DialogDescription>Review all details before approving.</DialogDescription>
          </DialogHeader>
          {previewCampaign && (
            <div className="space-y-4">
              <img src={previewCampaign.image} alt={previewCampaign.title} className="w-full h-48 rounded-xl object-cover" />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground text-lg">{previewCampaign.title}</h3>
                  {statusBadge(previewCampaign.status)}
                </div>
                <p className="text-sm text-muted-foreground">by {previewCampaign.organizer} · {previewCampaign.category}</p>
                <p className="text-sm text-foreground leading-relaxed">{previewCampaign.description}</p>
                <ProgressBar raised={previewCampaign.raised} target={previewCampaign.target} />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Target</p>
                    <p className="font-bold text-foreground">KES {previewCampaign.target.toLocaleString()}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Raised</p>
                    <p className="font-bold text-foreground">KES {previewCampaign.raised.toLocaleString()}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Donors</p>
                    <p className="font-bold text-foreground">{previewCampaign.donors}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Days Left</p>
                    <p className="font-bold text-foreground">{previewCampaign.daysLeft}</p>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  <p className="font-bold text-foreground">{previewCampaign.whatsappNumber}</p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                {previewCampaign.status === 'pending' && (
                  <>
                    <Button className="rounded-xl font-bold" onClick={() => { handleUpdateStatus(previewCampaign.id, 'approved'); setPreviewCampaign(null); }}>
                      <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button variant="outline" className="rounded-xl font-bold text-destructive border-destructive/30" onClick={() => { setPreviewCampaign(null); setRejectModal(previewCampaign); }}>
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </>
                )}
                <Button variant="outline" className="rounded-xl" onClick={() => contactOnWhatsApp(previewCampaign.whatsappNumber, previewCampaign.title)}>
                  <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Campaign Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>Create a new campaign directly as admin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Campaign Title" value={newCampaign.title} onChange={(e) => setNewCampaign((p) => ({ ...p, title: e.target.value }))} className="rounded-xl" />
            <Textarea placeholder="Description" value={newCampaign.description} onChange={(e) => setNewCampaign((p) => ({ ...p, description: e.target.value }))} className="rounded-xl" rows={3} />
            <Input placeholder="Image URL (optional)" value={newCampaign.image} onChange={(e) => setNewCampaign((p) => ({ ...p, image: e.target.value }))} className="rounded-xl" />
            <Input placeholder="Target Amount (KES)" type="number" value={newCampaign.target} onChange={(e) => setNewCampaign((p) => ({ ...p, target: e.target.value }))} className="rounded-xl" />
            <Input placeholder="Organizer Name" value={newCampaign.organizer} onChange={(e) => setNewCampaign((p) => ({ ...p, organizer: e.target.value }))} className="rounded-xl" />
            <Input placeholder="WhatsApp Number (254...)" value={newCampaign.whatsappNumber} onChange={(e) => setNewCampaign((p) => ({ ...p, whatsappNumber: e.target.value }))} className="rounded-xl" />
            <div className="flex gap-2">
              <select value={newCampaign.category} onChange={(e) => setNewCampaign((p) => ({ ...p, category: e.target.value }))} className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm">
                {['Medical', 'Education', 'Community', 'Emergency'].map((cat) => <option key={cat}>{cat}</option>)}
              </select>
              <select value={newCampaign.status} onChange={(e) => setNewCampaign((p) => ({ ...p, status: e.target.value as CampaignStatus }))} className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm">
                <option value="approved">Go Live Immediately</option>
                <option value="pending">Save as Pending</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button className="rounded-xl font-bold" disabled={!newCampaign.title || !newCampaign.organizer} onClick={handleCreateCampaign}>
              <PlusCircle className="w-4 h-4 mr-1" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={!!rejectModal} onOpenChange={() => { setRejectModal(null); setRejectReason(''); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reject Campaign</DialogTitle>
            <DialogDescription>Provide a reason — it will be sent to the organizer via WhatsApp.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="e.g. Please provide clearer images and documentation…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="rounded-xl" rows={4} />
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => { setRejectModal(null); setRejectReason(''); }}>Cancel</Button>
            <Button className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleReject}>
              <XCircle className="w-4 h-4 mr-1" /> Reject & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disburse Modal */}
      <Dialog open={!!disburseModal} onOpenChange={() => setDisburseModal(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Disburse Funds</DialogTitle>
            <DialogDescription>Send collected funds to {disburseModal?.campaign.organizer} via M-Pesa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-semibold text-muted-foreground">Campaign</label><p className="text-sm font-bold text-foreground">{disburseModal?.campaign.title}</p></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Amount (KES)</label><Input type="number" value={disburseModal?.amount ?? ''} onChange={(e) => setDisburseModal((prev) => prev ? { ...prev, amount: e.target.value } : null)} className="rounded-xl mt-1" /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">M-Pesa Number</label><Input value={disburseModal?.phone ?? ''} onChange={(e) => setDisburseModal((prev) => prev ? { ...prev, phone: e.target.value } : null)} className="rounded-xl mt-1" placeholder="254712345678" /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDisburseModal(null)}>Cancel</Button>
            <Button className="rounded-xl" disabled={!disburseModal?.amount || Number(disburseModal?.amount) <= 0} onClick={handleDisburse}>
              <Send className="w-4 h-4 mr-1" /> Send KES {Number(disburseModal?.amount || 0).toLocaleString()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Modal */}
      <Dialog open={!!editCampaign} onOpenChange={() => setEditCampaign(null)}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>Update campaign details.</DialogDescription>
          </DialogHeader>
          {editCampaign && (
            <div className="space-y-3">
              <Input placeholder="Campaign Title" value={editCampaign.title} onChange={(e) => setEditCampaign({ ...editCampaign, title: e.target.value })} className="rounded-xl" />
              <Textarea placeholder="Description" value={editCampaign.description} onChange={(e) => setEditCampaign({ ...editCampaign, description: e.target.value })} className="rounded-xl" rows={3} />
              <Input placeholder="Image URL" value={editCampaign.image} onChange={(e) => setEditCampaign({ ...editCampaign, image: e.target.value })} className="rounded-xl" />
              <Input placeholder="Target Amount (KES)" type="number" value={editCampaign.target} onChange={(e) => setEditCampaign({ ...editCampaign, target: Number(e.target.value) })} className="rounded-xl" />
              <Input placeholder="Organizer Name" value={editCampaign.organizer} onChange={(e) => setEditCampaign({ ...editCampaign, organizer: e.target.value })} className="rounded-xl" />
              <Input placeholder="WhatsApp Number (254...)" value={editCampaign.whatsappNumber} onChange={(e) => setEditCampaign({ ...editCampaign, whatsappNumber: e.target.value })} className="rounded-xl" />
              <Input placeholder="Days Left" type="number" value={editCampaign.daysLeft} onChange={(e) => setEditCampaign({ ...editCampaign, daysLeft: Number(e.target.value) })} className="rounded-xl" />
              <select value={editCampaign.category} onChange={(e) => setEditCampaign({ ...editCampaign, category: e.target.value })} className="w-full rounded-xl border bg-background px-3 py-2 text-sm">
                {['Medical', 'Education', 'Community', 'Emergency'].map((cat) => <option key={cat}>{cat}</option>)}
              </select>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditCampaign(null)}>Cancel</Button>
            <Button className="rounded-xl font-bold" disabled={!editCampaign?.title} onClick={handleEditCampaign}>
              <Pencil className="w-4 h-4 mr-1" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
