import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import type { Campaign } from "@/lib/campaigns";

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const campaignsRef = ref(db, "campaigns");

    const unsubscribe = onValue(campaignsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: Campaign[] = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          title: val.title || "",
          description: val.description || "",
          image: val.image || val.coverImage || "",
          target: val.target || val.goalAmount || 0,
          raised: val.raised || val.raisedAmount || 0,
          donors: val.donors || 0,
          daysLeft: val.daysLeft || 30,
          organizer: val.organizer || val.ownerId || "",
          category: val.category || "Other",
          status: val.status || "pending",
          whatsappNumber: val.whatsappNumber || "",
        }));
        setCampaigns(list);
      } else {
        setCampaigns([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { campaigns, loading };
}
