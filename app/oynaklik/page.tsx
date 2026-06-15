"use client";

// Gün-İçi Oynaklık Radarı — BIST hisseleri için önümüzdeki 1–2 saatin HAREKET
// BÜYÜKLÜĞÜ tahmini. Eğitilmiş Ridge modeli (ml/train_volatility.py) tarayıcıda
// çıkarım yapar. DÜRÜSTLÜK: yön (artış/azalış) tahmin EDİLMEZ — kanıtlanmış
// şekilde rastgele. Yalnız "ne kadar oynar" tahmin edilir (oynaklık kümelenmesi).

import { Fragment, useCallback, useEffect, useState } from "react";
import type { Driver, Regime, VolPrediction } from "@/lib/volatility";

interface StockVol {
  ticker: string;
  name: string;
  note?: string;
  lastPrice: number | null;
  prevClose: number | null;
  dayChangePct: number | null;
  asof: number | null;
  spark: number[];
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

// Gün-içi mini fiyat grafiği (son ~30 bar kapanışı). Yükseliş yeşil, düşüş kırmızı.
function Sparkline({ data }: { data: number[] }) {
  const w = 84;
  const h = 26;
  if (!data || data.length < 2) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 2) + 1;
    const y = h - 1 - ((v - min) / span) * (h - 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const up = data[data.length - 1] >= data[0];
  const color = up ? "var(--long)" : "var(--danger)";
  return (
    <svg width={w} height={h} style={{ display: "block" }} aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// Lineer modelin yerel açıklaması: en etkili sürücüler ↑ (yükseltir) / ↓ (düşürür).
function DriverList({ title, drivers }: { title: string; drivers: Driver[] }) {
  return (
    <div style={{ flex: "1 1 240px" }}>
      <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 4 }}>{title}</div>
      {drivers.map((d, i) => {
        const up = d.effect >= 0;
        return (
          <div key={i} style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
            <span style={{ color: up ? "var(--cash)" : "var(--long)", fontWeight: 700 }}>
              {up ? "↑" : "↓"}
            </span>{" "}
            {d.label}
          </div>
        );
      })}
    </div>
  );
}

const GRANS: { id: string; label: string; desc: string }[] = [
  { id: "60m", label: "Saatlik bar", desc: "60dk · ~2 yıl veri" },
  { id: "5m", label: "5 dakikalık bar", desc: "5dk · ~3 ay veri, daha güncel" },
];

// Üst özet şeridi: piyasa-geneli oynaklık seviyesi + en oynak/en sakin hisseler.
function SummaryStrip({ stocks }: { stocks: StockVol[] }) {
  const withH1 = stocks.filter((s) => s.h1);
  if (withH1.length === 0) return null;
  const high = withH1.filter((s) => s.h1!.regime === "high").length;
  const low = withH1.filter((s) => s.h1!.regime === "low").length;
  const normal = withH1.length - high - low;
  const total = withH1.length;
  // Piyasa hükmü
  let verdict: string;
  let vcolor: string;
  if (high >= total * 0.45) {
    verdict = "Bugün BIST geneli HAREKETLİ — oynaklık yüksek";
    vcolor = "var(--cash)";
  } else if (low >= total * 0.45) {
    verdict = "Bugün BIST geneli SAKİN — oynaklık düşük";
    vcolor = "var(--long)";
  } else {
    verdict = "Bugün BIST karışık — seçici oynaklık";
    vcolor = "var(--accent)";
  }
  // En oynak / en sakin 3 (stocks zaten beklenen harekete göre sıralı geliyor)
  const sorted = [...withH1].sort(
    (a, b) => b.h1!.expectedMovePct - a.h1!.expectedMovePct
  );
  const top = sorted.slice(0, 3);
  const calm = sorted.slice(-3).reverse();
  const nm = (s: StockVol) => `${s.ticker.replace(".IS", "")} ±%${s.h1!.expectedMovePct.toFixed(2)}`;

  const cell: React.CSSProperties = {
    flex: "1 1 220px",
    background: "var(--panel-2)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "12px 14px",
  };
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          background: "var(--panel-2)",
          border: `1px solid ${vcolor}`,
          borderLeft: `4px solid ${vcolor}`,
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 12,
          fontWeight: 700,
          color: vcolor,
          fontSize: 15,
        }}
      >
        {verdict}
        <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
          ({high} yüksek · {normal} normal · {low} düşük, {total} hisse)
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={cell}>
          <div style={{ fontSize: 12.5, color: "var(--cash)", fontWeight: 700, marginBottom: 6 }}>
            🔥 En oynak (1 saat)
          </div>
          {top.map((s) => (
            <div key={s.ticker} style={{ fontSize: 13.5, color: "var(--text)" }}>
              {nm(s)}
            </div>
          ))}
        </div>
        <div style={cell}>
          <div style={{ fontSize: 12.5, color: "var(--long)", fontWeight: 700, marginBottom: 6 }}>
            🧘 En sakin (1 saat)
          </div>
          {calm.map((s) => (
            <div key={s.ticker} style={{ fontSize: 13.5, color: "var(--text)" }}>
              {nm(s)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OynaklikPage() {
  const [data, setData] = useState<VolResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [gran, setGran] = useState("60m");
  const [open, setOpen] = useState<string | null>(null);

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

      {data && data.stocks.length > 0 && <SummaryStrip stocks={data.stocks} />}

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
                <th style={th}>Seyir</th>
                <th style={th}>1 saat içi oynaklık</th>
                <th style={th}>2 saat içi oynaklık</th>
              </tr>
            </thead>
            <tbody>
              {data.stocks.map((s) => (
                <Fragment key={s.ticker}>
                <tr
                  onClick={() => setOpen(open === s.ticker ? null : s.ticker)}
                  style={{
                    borderTop: "1px solid var(--border-soft)",
                    cursor: s.h1 ? "pointer" : "default",
                    background: open === s.ticker ? "var(--panel)" : "transparent",
                  }}
                >
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>
                      {s.h1 && (
                        <span style={{ color: "var(--text-faint)", fontSize: 11, marginRight: 6 }}>
                          {open === s.ticker ? "▾" : "▸"}
                        </span>
                      )}
                      {s.name}
                    </div>
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
                    <Sparkline data={s.spark} />
                  </td>
                  <td style={td}>
                    <RegimeBadge p={s.h1} />
                  </td>
                  <td style={td}>
                    <RegimeBadge p={s.h2} />
                  </td>
                </tr>
                {open === s.ticker && s.h1 && (
                  <tr style={{ background: "var(--panel)" }}>
                    <td colSpan={6} style={{ padding: "4px 14px 16px" }}>
                      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 8 }}>
                        Bu tahmini en çok belirleyen etkenler{" "}
                        <span style={{ color: "var(--cash)" }}>↑ oynaklığı yükseltiyor</span> ·{" "}
                        <span style={{ color: "var(--long)" }}>↓ düşürüyor</span> (lineer model katkıları):
                      </div>
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        <DriverList title="1 saat içi" drivers={s.h1.drivers} />
                        {s.h2 && <DriverList title="2 saat içi" drivers={s.h2.drivers} />}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
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
