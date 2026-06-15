import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Ana sayfa (Dual Momentum) + Gün-İçi Oynaklık Radarı (BIST) kanonik URL'leri.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/oynaklik`,
      changeFrequency: "hourly",
      priority: 0.8,
    },
  ];
}
