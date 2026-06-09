import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Tek-sayfa uygulama; ana sayfa tek kanonik URL.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
