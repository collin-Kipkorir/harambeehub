import { ref, set, update, remove, push, get } from "firebase/database";
import { db } from "@/lib/firebase";
import type { Campaign, CampaignStatus } from "@/lib/campaigns";

export const addCampaignToFirebase = async (campaign: Omit<Campaign, "id">): Promise<string> => {
  const campaignRef = push(ref(db, "campaigns"));
  await set(campaignRef, {
    ...campaign,
    createdAt: Date.now(),
  });
  return campaignRef.key!;
};

export const updateCampaignStatus = async (id: string, status: CampaignStatus) => {
  await update(ref(db, `campaigns/${id}`), { status });
};

export const deleteCampaign = async (id: string) => {
  await remove(ref(db, `campaigns/${id}`));
};

export const updateCampaign = async (id: string, data: Partial<Campaign>) => {
  await update(ref(db, `campaigns/${id}`), data);
};

export const seedInitialCampaigns = async () => {
  const snapshot = await get(ref(db, "campaigns"));
  if (snapshot.exists()) return; // Already seeded

  const { campaigns } = await import("@/lib/campaigns");
  for (const c of campaigns) {
    await set(ref(db, `campaigns/${c.id}`), {
      title: c.title,
      description: c.description,
      image: c.image,
      target: c.target,
      raised: c.raised,
      donors: c.donors,
      daysLeft: c.daysLeft,
      organizer: c.organizer,
      category: c.category,
      status: c.status,
      whatsappNumber: c.whatsappNumber,
      createdAt: Date.now(),
    });
  }
};
