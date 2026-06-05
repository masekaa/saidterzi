import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dual Momentum Analiz — Gold · S&P 500 · NASDAQ",
  description:
    "Antonacci Dual Momentum (GEM) stratejisine göre Altın, S&P 500 ve NASDAQ canlı analizi.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
