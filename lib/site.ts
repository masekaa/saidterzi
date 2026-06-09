// Sitenin taban (mutlak) adresi — metadataBase, robots ve sitemap için tek
// kaynak. Öncelik: açık env (NEXT_PUBLIC_SITE_URL) → Vercel dağıtım URL'si →
// localhost. Sosyal platformlar ve arama motorları mutlak URL ister.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");
