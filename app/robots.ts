import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Arama motorları için robots.txt — tüm sayfaları taramaya izin ver + sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
