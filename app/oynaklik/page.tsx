"use client";

// Gün-İçi Oynaklık Radarı — BIST hisseleri için önümüzdeki 1–2 saatin HAREKET
// BÜYÜKLÜĞÜ tahmini. Eğitilmiş Ridge modeli (ml/train_volatility.py) tarayıcıda
// çıkarım yapar. DÜRÜSTLÜK: yön (artış/azalış) tahmin EDİLMEZ — kanıtlanmış
// şekilde rastgele. Yalnız "ne kadar oynar" tahmin edilir (oynaklık kümelenmesi).

import { useCallback, useEffect, useState } from "react";
import type { Regime, VolPrediction } from "@/lib/volatility";

interface StockVol {
  ticker: string;
  name: string;
  note?: string;
  lastPrice: number | null;
  prevClose: number | null;
  dayChangePct: number | null;
  asof: number | null;
  h1: VolPrediction | null;
  h2: VolPrediction | null;
}
interface VolResponse {
  asof: string;
  exchangeTz: string;
  gran: string;
  meta: {
    h1: { r2: number; rho: number; rhoNaive: number; nTest: number };
    h2: { r2: number; rho: number; rhoNaive: number; nTest: number };
  };
  stocks: StockVol[];
}

const REGIME_TR: Record<Regime, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
};
const REGIME_COLOR: Record<Regime, { fg: string; bg: string }> = {
  low: { fg: "var(--text-dim)", bg: "rgba(154,166,192,0.12)" },
  normal: { fg: "var(--accent)", bg: "rgba(91,140,255,0.14)" },
  high: { fg: "var(--cash)", bg: "var(--cash-bg)" },
};

function RegimeBadge({ p }: { p: VolPrediction | null }) {
  if (!p) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const col = REGIME_COLOR[p.regime];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          padding: "2px 9px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          color: col.fg,
          background: col.bg,
        }}
      >
        {REGIME_TR[p.regime]}
      </span>
      <span style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        ±%{p.expectedMovePct.toFixed(2)}
      </span>
    </span>
  );
}

const GRANS: { id: string; label: string; desc: string }[] = [
  { id: "60m", label: "Saatlik bar", desc: "60dk · ~2 yıl veri" },
  { id: "5m", label: "5 dakikalık bar", desc: "5dk · ~3 ay veri, daha güncel" },
];

export default function OynaklikPage() {
  const [data, setData] = useState<VolResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [gran, setGran] = useState("60m");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/volatility?gran=${gran}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Sunucu ${res.status}`);
      setData((await res.json()) as VolResponse);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, [gran]);

  useEffect(() => {
    load();
  }, [load]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });

  return (
    <main
      style={{
        maxWidth: 1040,
        margin: "0 auto",
        padding: "32px 20px 80px",
        color: "var(--text)",
      }}
    >
      <a href="/" style={{ color: "var(--accent)", fontSize: 14, textDecoration: "none" }}>
        ← Dual Momentum ana sayfa
      </a>

      <h1 style={{ fontSize: 28, margin: "14px 0 6px", fontWeight: 800 }}>
        Gün-İçi Oynaklık Radarı · BIST
      </h1>
      <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.6, margin: "0 0 18px" }}>
        Önümüzdeki <b>1–2 saatte</b> her hissenin ne kadar <b>oynayacağını</b> (hareket
        büyüklüğünü) tahmin eder. <b>Yön değil</b> — “artacak mı azalacak mı” sorusunu
        bilerek yanıtlamıyoruz, çünkü kısa-vade yön tahmini istatistiksel olarak{" "}
        <b>yazı-tura</b> (LightGBM, lojistik ve LSTM modellerinin hepsi “hep çoğunluğu
        söyle” baseline’ını geçemedi). Oynaklık ise gerçekten tahmin edilebilir.
      </p>

      {/* Dürüstlük / yöntem kutusu */}
      <div
        style={{
          background: "var(--panel-2)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "14px 16px",
          fontSize: 13.5,
          color: "var(--text-dim)",
          lineHeight: 1.65,
          marginBottom: 22,
        }}
      >
        <b style={{ color: "var(--text)" }}>Nasıl okunur?</b> Rejim <b>Yüksek</b> ise
        “önümüzdeki saatlerde sıçrama/oynaklık olasılığı yüksek” demektir — riski
        zamanlamak (örn. stop genişliği, pozisyon küçültme) için kullanışlıdır, yön
        sinyali değildir. <b>±%</b> değeri, o rejimdeki hisselerin geçmişte (out-of-sample)
        <b> gerçekleşen ortalama mutlak</b> 1-saatlik hareketidir.
        {data && (
          <div style={{ marginTop: 10, color: "var(--text-faint)", fontSize: 12.5 }}>
            Model doğruluğu (OOS, {data.meta.h1.nTest.toLocaleString("tr-TR")} test örneği):
            sıra-korelasyon ρ={data.meta.h1.rho.toFixed(2)} (naive geçmiş-oynaklık
            ρ={data.meta.h1.rhoNaive.toFixed(2)} → model naive’i geçiyor), R²=
            {data.meta.h1.r2.toFixed(2)}. <b>Yatırım tavsiyesi değildir.</b>
          </div>
        )}
      </div>

      {/* Granülerlik seçimi */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {GRANS.map((g) => {
          const active = g.id === gran;
          return (
            <button
              key={g.id}
              onClick={() => setGran(g.id)}
              disabled={loading && active}
              style={{
                background: active ? "var(--card)" : "transparent",
                color: active ? "var(--text)" : "var(--text-dim)",
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 9,
                padding: "8px 14px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
                lineHeight: 1.3,
              }}
            >
              {g.label}
              <span
                style={{
                  display: "block",
                  fontSize: 11.5,
                  fontWeight: 400,
                  color: "var(--text-faint)",
                }}
              >
                {g.desc}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <button
          onClick={load}
          disabled={loading}
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Yükleniyor…" : "Yenile"}
        </button>
        {data && (
          <span style={{ color: "var(--text-faint)", fontSize: 13 }}>
            Güncelleme: {fmtTime(data.asof)} · {data.exchangeTz}
          </span>
        )}
      </div>

      {err && (
        <div style={{ color: "var(--danger)", fontSize: 14, marginBottom: 16 }}>
          Veri alınamadı: {err}
        </div>
      )}

      {data && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--panel)", textAlign: "left" }}>
                <th style={th}>Hisse</th>
                <th style={{ ...th, textAlign: "right" }}>Fiyat</th>
                <th style={{ ...th, textAlign: "right" }}>Gün %</th>
                <th style={th}>1 saat içi oynaklık</th>
                <th style={th}>2 saat içi oynaklık</th>
              </tr>
            </thead>
            <tbody>
              {data.stocks.map((s) => (
                <tr key={s.ticker} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div style={{ color: "var(--text-faint)", fontSize: 12 }}>
                      {s.ticker.replace(".IS", "")} {s.note ? `· ${s.note}` : ""}
                    </div>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {s.lastPrice != null ? s.lastPrice.toFixed(2) : "—"}
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      color:
                        s.dayChangePct == null
                          ? "var(--text-faint)"
                          : s.dayChangePct >= 0
                          ? "var(--long)"
                          : "var(--danger)",
                    }}
                  >
                    {s.dayChangePct != null
                      ? `${s.dayChangePct >= 0 ? "+" : ""}${s.dayChangePct.toFixed(2)}`
                      : "—"}
                  </td>
                  <td style={td}>
                    <RegimeBadge p={s.h1} />
                  </td>
                  <td style={td}>
                    <RegimeBadge p={s.h2} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.stocks.length === 0 && !loading && (
        <p style={{ color: "var(--text-dim)", marginTop: 16 }}>
          Şu an veri yok (borsa kapalı olabilir — BIST seansı dışında gün-içi bar
          gelmez). Seans saatlerinde tekrar deneyin.
        </p>
      )}
    </main>
  );
}

const th: React.CSSProperties = {
  padding: "11px 14px",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--text-dim)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = { padding: "11px 14px", verticalAlign: "middle" };
