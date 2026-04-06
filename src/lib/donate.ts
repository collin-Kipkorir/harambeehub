import { ref, push, set, get, update } from "firebase/database";
import { db } from "@/lib/firebase";

export const createDonation = async ({
  campaignId,
  amount,
  phone,
}: {
  campaignId: string;
  amount: number;
  phone: string;
}) => {
  const donationRef = push(ref(db, "donations"));

  await set(donationRef, {
    amount,
    campaignId,
    phone,
    status: "pending",
    createdAt: Date.now(),
  });

  // Link donation to campaign
  await set(ref(db, `campaignDonations/${campaignId}/${donationRef.key}`), true);

  return donationRef.key;
};

export const completeDonation = async ({
  donationId,
  campaignId,
  amount,
  transactionId,
}: {
  donationId: string;
  campaignId: string;
  amount: number;
  transactionId: string;
}) => {
  // Update donation status
  await update(ref(db, `donations/${donationId}`), {
    status: "completed",
    transactionId,
  });

  // Update campaign totals
  const campaignRef = ref(db, `campaigns/${campaignId}`);
  const snapshot = await get(campaignRef);
  const campaign = snapshot.val();

  if (campaign) {
    await update(campaignRef, {
      raised: (campaign.raised || campaign.raisedAmount || 0) + amount,
      donors: (campaign.donors || 0) + 1,
    });
  }
};

export const failDonation = async (donationId: string) => {
  await update(ref(db, `donations/${donationId}`), {
    status: "failed",
  });
};
