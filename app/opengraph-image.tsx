import { ImageResponse } from "next/og";

// Dinamik Open Graph görseli (1200×630) — paylaşımlarda markalı kart.
// Next.js yerel next/og (Satori) ile üretilir; harici bağımlılık yok.
export const runtime = "edge";
export const alt =
  "Dual Momentum Analiz — 8 varlık evreni, canlı backtest ve risk analizi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "84px",
          background: "linear-gradient(135deg, #0a0e1a 0%, #16203a 100%)",
          color: "#e8edf7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 70 }}>📈</div>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            marginTop: 18,
            letterSpacing: "-0.02em",
          }}
        >
          Dual Momentum Analiz
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 31,
            color: "#9aa6c0",
            marginTop: 26,
            lineHeight: 1.4,
            maxWidth: 980,
          }}
        >
          8 varlık evreni · eşit-ağırlık &amp; risk-parity bileşik · interaktif
          backtest stüdyosu · kriz / bootstrap / dayanıklılık · Fama-French alpha
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 27,
            color: "#22d3a6",
            fontWeight: 700,
            marginTop: 40,
          }}
        >
          Antonacci GEM · canlı, anahtarsız veri
        </div>
      </div>
    ),
    size
  );
}
