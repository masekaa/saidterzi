import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dual Momentum Analiz — ETF · Hisse · Kripto · Sektör · Uluslararası · Emtia · Faktör",
  description:
    "Antonacci Dual Momentum: GEM + hisse/kripto/sektör/uluslararası/emtia/faktör momentum evrenleri, eşit-ağırlık & risk-parity bileşik, interaktif backtest stüdyosu, Fama-French alpha ve tam risk analizi. Canlı, anahtarsız veri.",
  icons: {
    icon:
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="86">📈</text></svg>'
      ),
  },
};

export const viewport = {
  themeColor: "#0b0f1a",
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
