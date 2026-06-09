import { ImageResponse } from "next/og";

// Dinamik Open Graph görseli (1200×630) — paylaşımlarda markalı kart.
// Next.js yerel next/og (Satori) ile üretilir; harici bağımlılık yok.
// NOT: Satori varsayılan fontla emoji render etmez → emoji yerine div'lerle
// çizilmiş bir grafik-çubuk motifi kullanıyoruz (glyph sorunu olmaz).
export const runtime = "edge";
export const alt =
  "Dual Momentum Analiz — 8 varlık evreni, canlı backtest ve risk analizi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BARS = [44, 66, 54, 82, 70, 96];

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
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 100 }}>
          {BARS.map((h, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                width: 30,
                height: h,
                borderRadius: 5,
                background: i === BARS.length - 1 ? "#22d3a6" : "#5b8cff",
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 74,
            fontWeight: 800,
            marginTop: 34,
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
            marginTop: 24,
            lineHeight: 1.4,
            maxWidth: 1000,
          }}
        >
          8 varlik evreni · esit-agirlik &amp; risk-parity bilesik · interaktif
          backtest studyosu · kriz / bootstrap / dayaniklilik · Fama-French alpha
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
          Antonacci GEM · canli, anahtarsiz veri
        </div>
      </div>
    ),
    size
  );
}
