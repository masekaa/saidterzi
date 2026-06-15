import type { Metadata } from "next";

// /oynaklik için sayfa-özel metadata (kök layout'un Dual Momentum başlığını ezerek
// doğru sekme başlığı + SEO sağlar). Sayfa bir client component olduğu için
// metadata buradan, layout üzerinden veriliyor.
export const metadata: Metadata = {
  title: "Gün-İçi Oynaklık Radarı — BIST hisseleri için 1–2 saatlik hareket tahmini",
  description:
    "BIST hisselerinin önümüzdeki 1–2 saatte ne kadar oynayacağını (hareket büyüklüğünü) "
    + "tahmin eden kalibre model. Yön değil, oynaklık: düşük/normal/yüksek rejim, beklenen "
    + "% hareket ve TL bandı. Out-of-sample doğrulanmış, anahtarsız canlı veri.",
  alternates: { canonical: "/oynaklik" },
  openGraph: {
    title: "Gün-İçi Oynaklık Radarı — BIST",
    description:
      "BIST hisseleri için 1–2 saatlik oynaklık (hareket büyüklüğü) tahmini — kalibre, dürüst, canlı.",
    type: "website",
    locale: "tr_TR",
  },
};

export default function OynaklikLayout({ children }: { children: React.ReactNode }) {
  return children;
}
