import type { Metadata } from "next";
import "./globals.css";

const TITLE =
  "Dual Momentum Analiz — ETF · Hisse · Kripto · Sektör · Uluslararası · Emtia · Faktör · Tahvil";
const DESC =
  "Antonacci Dual Momentum: GEM + hisse/kripto/sektör/uluslararası/emtia/faktör/tahvil momentum evrenleri, eşit-ağırlık & risk-parity bileşik, interaktif backtest stüdyosu, Fama-French alpha ve tam risk analizi. Canlı, anahtarsız veri.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "dual momentum",
    "GEM",
    "global equities momentum",
    "Antonacci",
    "momentum stratejisi",
    "backtest",
    "risk parity",
    "Fama-French alpha",
    "varlık dağılımı",
  ],
  authors: [{ name: "saidterzi" }],
  icons: {
    icon:
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="86">📈</text></svg>'
      ),
  },
  openGraph: {
    title: TITLE,
    description: DESC,
    type: "website",
    locale: "tr_TR",
    siteName: "Dual Momentum Analiz",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESC,
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
