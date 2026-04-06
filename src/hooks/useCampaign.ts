import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import type { Campaign } from "@/lib/campaigns";

export function useCampaign(campaignId: string | undefined) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) {
      setLoading(false);
      return;
    }

    const campaignRef = ref(db, `campaigns/${campaignId}`);

    const unsubscribe = onValue(campaignRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setCampaign({
          id: campaignId,
          title: val.title || "",
          description: val.description || "",
          image: val.image || val.coverImage || "",
          target: val.target || val.goalAmount || 0,
          raised: val.raised || val.raisedAmount || 0,
          donors: val.donors || 0,
          daysLeft: val.daysLeft || 30,
          organizer: val.organizer || "",
          category: val.category || "Other",
          status: val.status || "pending",
          whatsappNumber: val.whatsappNumber || "",
        });
      } else {
        setCampaign(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [campaignId]);

  return { campaign, loading };
}
