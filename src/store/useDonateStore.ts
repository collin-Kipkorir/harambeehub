import { create } from 'zustand';

interface DonateState {
  isModalOpen: boolean;
  campaignId: string | null;
  campaignTitle: string;
  amount: string;
  phone: string;
  status: 'idle' | 'pending' | 'success' | 'failed';
  openModal: (campaignId: string, campaignTitle: string) => void;
  closeModal: () => void;
  setAmount: (amount: string) => void;
  setPhone: (phone: string) => void;
  setStatus: (status: 'idle' | 'pending' | 'success' | 'failed') => void;
  reset: () => void;
}

export const useDonateStore = create<DonateState>((set) => ({
  isModalOpen: false,
  campaignId: null,
  campaignTitle: '',
  amount: '',
  phone: '',
  status: 'idle',
  openModal: (campaignId, campaignTitle) =>
    set({ isModalOpen: true, campaignId, campaignTitle, status: 'idle' }),
  closeModal: () =>
    set({ isModalOpen: false, campaignId: null, campaignTitle: '', amount: '', phone: '', status: 'idle' }),
  setAmount: (amount) => set({ amount }),
  setPhone: (phone) => set({ phone }),
  setStatus: (status) => set({ status }),
  reset: () => set({ amount: '', phone: '', status: 'idle' }),
}));
