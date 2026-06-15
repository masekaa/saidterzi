"use client";

// Gün-İçi Oynaklık Radarı — BIST hisseleri için önümüzdeki 1–2 saatin HAREKET
// BÜYÜKLÜĞÜ tahmini. Eğitilmiş Ridge modeli (ml/train_volatility.py) tarayıcıda
// çıkarım yapar. DÜRÜSTLÜK: yön (artış/azalış) tahmin EDİLMEZ — kanıtlanmış
// şekilde rastgele. Yalnız "ne kadar oynar" tahmin edilir (oynaklık kümelenmesi).

import { Fragment, useCallback, useEffect, useState } from "react";
import type {
  Driver,
  Regime,
  VolPrediction,
  StockVol,
  VolResponse,
} from "@/lib/volatility";

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

function RegimeBadge({ p, price }: { p: VolPrediction | null; price?: number | null }) {
  if (!p) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const col = REGIME_COLOR[p.regime];
  // Beklenen simetrik fiyat bandı (yön değil, büyüklük): fiyat × (1 ∓ ±%).
  const m = p.expectedMovePct / 100;
  const band =
    price != null && price > 0
      ? `${(price * (1 - m)).toFixed(2)}–${(price * (1 + m)).toFixed(2)}`
      : null;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
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
        {p.borderline && (
          <span
            title="Tahmin bir rejim eşiğine çok yakın — rejim çağrısı sınırda, düşük güven"
            style={{ color: "var(--text-faint)", fontSize: 11 }}
          >
            ~sınırda
          </span>
        )}
      </span>
      {band && (
        <span
          style={{
            color: "var(--text-faint)",
            fontSize: 11.5,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ≈ {band} ₺
        </span>
      )}
      {p.rangePct && (
        <span
          style={{ color: "var(--text-faint)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}
          title="Bu rejimde gerçekleşen hareketin tipik aralığı (p25–p75)"
        >
          tipik %{p.rangePct[0].toFixed(2)}–%{p.rangePct[1].toFixed(2)}
        </span>
      )}
    </span>
  );
}

// Güvenilirlik eğrisi: tahmin edilen oynaklık (x) vs gerçekleşen (y), 10 OOS kova.
// Noktalar köşegene yakınsa model kalibre demektir.
function ReliabilityChart({ pts }: { pts: { pred: number; actual: number }[] }) {
  const W = 220;
  const H = 150;
  const pad = 28;
  if (!pts || pts.length < 2) return null;
  const xs = pts.map((p) => p.pred * 100);
  const ys = pts.map((p) => p.actual * 100);
  const lo = Math.min(...xs, ...ys);
  const hi = Math.max(...xs, ...ys);
  const span = hi - lo || 1;
  const sx = (v: number) => pad + ((v - lo) / span) * (W - pad - 6);
  const sy = (v: number) => H - pad - ((v - lo) / span) * (H - pad - 6);
  return (
    <svg width={W} height={H} role="img" aria-label="Model güvenilirlik eğrisi">
      {/* y=x köşegen (ideal kalibrasyon) */}
      <line
        x1={sx(lo)}
        y1={sy(lo)}
        x2={sx(hi)}
        y2={sy(hi)}
        stroke="var(--text-faint)"
        strokeDasharray="3 3"
        strokeWidth={1}
      />
      {/* nokta-çizgi */}
      <polyline
        points={pts.map((p) => `${sx(p.pred * 100)},${sy(p.actual * 100)}`).join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
      />
      {pts.map((p, i) => (
        <circle key={i} cx={sx(p.pred * 100)} cy={sy(p.actual * 100)} r={2.6} fill="var(--accent)" />
      ))}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-faint)">
        tahmin %
      </text>
      <text
        x={10}
        y={H / 2}
        textAnchor="middle"
        fontSize="10"
        fill="var(--text-faint)"
        transform={`rotate(-90 10 ${H / 2})`}
      >
        gerçekleşen %
      </text>
    </svg>
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

// Rejim geçmişi şeridi: son ~12 barın oynaklık rejimi (sol=eski, sağ=şimdi).
function RegimeHistory({ hist }: { hist: Regime[] }) {
  return (
    <div style={{ flex: "1 1 240px" }}>
      <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 6 }}>
        Son barlarda rejim seyri (sol = eski → sağ = şimdi)
      </div>
      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
        {hist.map((r, i) => (
          <div
            key={i}
            title={REGIME_TR[r]}
            style={{
              width: 14,
              height: 18,
              borderRadius: 3,
              background: REGIME_COLOR[r].fg,
              opacity: 0.35 + 0.65 * ((i + 1) / hist.length), // yeni barlar daha belirgin
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "var(--text-faint)" }}>
        {(["low", "normal", "high"] as Regime[]).map((r) => (
          <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span
              style={{ width: 9, height: 9, borderRadius: 2, background: REGIME_COLOR[r].fg, display: "inline-block" }}
            />
            {REGIME_TR[r]}
          </span>
        ))}
      </div>
    </div>
  );
}

const GRANS: { id: string; label: string; desc: string }[] = [
  { id: "60m", label: "Saatlik bar", desc: "60dk · ~2 yıl veri" },
  { id: "5m", label: "5 dakikalık bar", desc: "5dk · ~3 ay veri, daha güncel" },
];

type SortKey = "name" | "price" | "day" | "move1" | "move2";
// Sıralama için bir hissenin ilgili sayısal/metin değeri.
function sortValue(s: StockVol, k: SortKey): number | string {
  switch (k) {
    case "name":
      return s.name.toLocaleLowerCase("tr-TR");
    case "price":
      return s.lastPrice ?? -Infinity;
    case "day":
      return s.dayChangePct ?? -Infinity;
    case "move1":
      return s.h1?.expectedMovePct ?? -Infinity;
    case "move2":
      return s.h2?.expectedMovePct ?? -Infinity;
  }
}

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

// BIST Oynaklık Endeksi: hisseler-arası ortalama beklenen hareketin bar-bar seyri.
// Piyasa-geneli oynaklık ısınıyor mu soğuyor mu?
function MarketVolIndex({ hist }: { hist: number[] }) {
  if (!hist || hist.length < 3) return null;
  const W = 100, H = 34, pad = 2;
  const min = Math.min(...hist), max = Math.max(...hist);
  const span = max - min || 1;
  const pts = hist.map((v, i) => {
    const x = (i / (hist.length - 1)) * (W - 2 * pad) + pad;
    const y = H - pad - ((v - min) / span) * (H - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const first = hist[0], cur = hist[hist.length - 1];
  const rising = cur >= first;
  const deltaPct = first > 0 ? ((cur - first) / first) * 100 : 0;
  const col = rising ? "var(--cash)" : "var(--long)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "12px 16px",
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          BIST Oynaklık Endeksi
        </div>
        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
          hisseler-arası ort. beklenen 1s hareket
        </div>
      </div>
      <svg width={W} height={H} aria-hidden="true">
        <polyline points={pts.join(" ")} fill="none" stroke={col} strokeWidth={1.5} />
      </svg>
      <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
        <span style={{ color: "var(--text)", fontWeight: 700 }}>±%{cur.toFixed(2)}</span>{" "}
        <span style={{ color: col, fontWeight: 600 }}>
          {rising ? "▲" : "▼"} {deltaPct >= 0 ? "+" : ""}
          {deltaPct.toFixed(0)}%
        </span>
        <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
          {rising ? "oynaklık ısınıyor" : "oynaklık soğuyor"} (son barlar)
        </div>
      </div>
    </div>
  );
}

// "Yeni ısınanlar": son barlarda YÜKSEK orijime YENİ geçen hisseler (bir şey oluyor).
function NewlyHeated({ stocks }: { stocks: StockVol[] }) {
  const fresh = stocks.filter((s) => {
    const h = s.regimeHistory;
    if (!h || h.length < 4) return false;
    // Şimdi yüksek, ~3 bar önce yüksek değildi → yeni ısındı.
    return h[h.length - 1] === "high" && h[h.length - 3] !== "high";
  });
  if (fresh.length === 0) return null;
  const nm = (s: StockVol) => s.ticker.replace(".IS", "");
  return (
    <div
      style={{
        background: "var(--cash-bg)",
        border: "1px solid var(--cash)",
        borderRadius: 12,
        padding: "10px 16px",
        marginBottom: 16,
        fontSize: 14,
        color: "var(--text)",
        lineHeight: 1.55,
      }}
    >
      <b style={{ color: "var(--cash)" }}>🆕 Yeni ısınanlar:</b>{" "}
      {fresh.map(nm).join(", ")} — son saatlerde <b>yüksek oynaklığa</b> yeni geçtiler
      (sıçrama/haber olabilir; yön değil, hareket büyüklüğü).
    </div>
  );
}

// Sade-dil "şimdi ne yapmalı?" özeti — projenin Ayşe-teyze felsefesi, gün-içine uygulanmış.
function AdviceLine({ stocks, marketOpen }: { stocks: StockVol[]; marketOpen: boolean }) {
  const withH1 = stocks.filter((s) => s.h1);
  if (withH1.length === 0) return null;
  const total = withH1.length;
  const high = withH1.filter((s) => s.h1!.regime === "high").length;
  const low = withH1.filter((s) => s.h1!.regime === "low").length;
  const sorted = [...withH1].sort((a, b) => b.h1!.expectedMovePct - a.h1!.expectedMovePct);
  const top = sorted[0];
  const calm = sorted[sorted.length - 1];
  const nm = (s: StockVol) => s.ticker.replace(".IS", "");
  // Hacim sıçraması olan hisseler (oynaklığı teyit edebilir).
  const spikes = withH1
    .filter((s) => s.volRatio != null && s.volRatio >= 1.5)
    .sort((a, b) => (b.volRatio ?? 0) - (a.volRatio ?? 0));

  let tip: string;
  let accent: string;
  if (high >= total * 0.45) {
    tip = "Oynaklık yüksek — pozisyonları küçük tutmak ve stop’ları geniş bırakmak mantıklı.";
    accent = "var(--cash)";
  } else if (low >= total * 0.45) {
    tip = "Piyasa sakin — büyük sıçrama beklentisi düşük, dar bantlı hareket olası.";
    accent = "var(--long)";
  } else {
    tip = "Hareket seçici — geneli değil, tek tek hisseye bakmak gerekiyor.";
    accent = "var(--accent)";
  }
  const pre = marketOpen ? "Şu an" : "Son seansa göre";
  return (
    <div
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${accent}`,
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 16,
        fontSize: 14.5,
        lineHeight: 1.6,
        color: "var(--text)",
      }}
    >
      <b>📊 {pre} ne yapmalı?</b> {pre} BIST’te en hareketlisi{" "}
      <b style={{ color: "var(--cash)" }}>
        {nm(top)} (±%{top.h1!.expectedMovePct.toFixed(2)})
      </b>
      , en sakini{" "}
      <b style={{ color: "var(--long)" }}>
        {nm(calm)} (±%{calm.h1!.expectedMovePct.toFixed(2)})
      </b>
      . {tip}
      {spikes.length > 0 && (
        <>
          {" "}
          <span style={{ color: "var(--accent)" }}>
            🔊 Hacim sıçraması: {spikes.slice(0, 3).map(nm).join(", ")}
            {spikes.length > 3 ? ` +${spikes.length - 3}` : ""}
          </span>{" "}
          (hareketi teyit edebilir).
        </>
      )}{" "}
      <span style={{ color: "var(--text-faint)", fontSize: 12.5 }}>
        (Yön değil, hareket büyüklüğü; yatırım tavsiyesi değildir.)
      </span>
    </div>
  );
}

// Sektör-bazlı oynaklık: hangi sektörler şu an daha hareketli (1 saat beklenen).
function SectorBreakdown({ stocks }: { stocks: StockVol[] }) {
  const withH1 = stocks.filter((s) => s.h1 && s.note);
  if (withH1.length < 4) return null;
  const map = new Map<string, { sum: number; n: number }>();
  for (const s of withH1) {
    const k = s.note as string;
    const cur = map.get(k) ?? { sum: 0, n: 0 };
    cur.sum += s.h1!.expectedMovePct;
    cur.n += 1;
    map.set(k, cur);
  }
  const rows = Array.from(map.entries())
    .map(([sector, v]) => ({ sector, avg: v.sum / v.n, n: v.n }))
    .sort((a, b) => b.avg - a.avg);
  if (rows.length < 2) return null;
  const max = Math.max(...rows.map((r) => r.avg)) || 1;
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 18,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        Sektör oynaklığı (1 saat beklenen, ortalama)
      </div>
      <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 10 }}>
        Hangi sektörler şu an daha hareketli? Çubuk uzunluğu beklenen mutlak hareketle orantılı.
      </div>
      {rows.map((r) => (
        <div
          key={r.sector}
          style={{ display: "flex", alignItems: "center", gap: 10, margin: "5px 0" }}
        >
          <div style={{ width: 110, fontSize: 12.5, color: "var(--text-dim)", textAlign: "right" }}>
            {r.sector}{" "}
            <span style={{ color: "var(--text-faint)", fontSize: 11 }}>({r.n})</span>
          </div>
          <div style={{ flex: 1, background: "var(--panel)", borderRadius: 6, height: 16 }}>
            <div
              style={{
                width: `${(r.avg / max) * 100}%`,
                height: "100%",
                borderRadius: 6,
                background:
                  r.avg >= max * 0.8
                    ? "var(--cash)"
                    : r.avg >= max * 0.5
                    ? "var(--accent)"
                    : "var(--long)",
              }}
            />
          </div>
          <div
            style={{
              width: 56,
              fontSize: 12.5,
              color: "var(--text)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ±%{r.avg.toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  );
}

// Tıklanabilir, sıralı sütun başlığı.
function SortTh({
  label,
  k,
  align,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  k: SortKey;
  align?: "right";
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th
      onClick={() => onSort(k)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSort(k);
        }
      }}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      style={{
        padding: "11px 14px",
        fontSize: 12.5,
        fontWeight: 600,
        color: active ? "var(--text)" : "var(--text-dim)",
        whiteSpace: "nowrap",
        textAlign: align ?? "left",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {label}
      <span style={{ color: "var(--accent)", marginLeft: 5, fontSize: 11 }}>
        {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </th>
  );
}

export default function OynaklikPage() {
  const [data, setData] = useState<VolResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [gran, setGran] = useState("60m");
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rf, setRf] = useState<"all" | Regime>("all");
  const [sortKey, setSortKey] = useState<SortKey>("move1");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  };

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

  // Borsa açıkken otomatik yenile (önbellek TTL'i 3 dk; buna denk).
  const marketOpen = data?.marketOpen ?? false;
  useEffect(() => {
    if (!autoRefresh || !marketOpen) return;
    const id = setInterval(() => load(), 180_000);
    return () => clearInterval(id);
  }, [autoRefresh, marketOpen, load]);

  // Tercihleri (granülerlik, sıralama, rejim filtresi) hatırla.
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  useEffect(() => {
    // Öncelik: URL sorgu parametreleri (paylaşılabilir) > localStorage > varsayılan.
    let url: URLSearchParams | null = null;
    try {
      url = new URLSearchParams(window.location.search);
    } catch {
      /* yok say */
    }
    const fromUrl = (k: string) => url?.get(k) ?? null;
    try {
      const raw = localStorage.getItem("oynaklik:prefs");
      const p = raw ? JSON.parse(raw) : {};
      const gv = fromUrl("gran") ?? p.gran;
      const skv = fromUrl("sort") ?? p.sortKey;
      const sdv = fromUrl("dir") ?? p.sortDir;
      const rfv = fromUrl("rf") ?? p.rf;
      if (gv === "60m" || gv === "5m") setGran(gv);
      if (["name", "price", "day", "move1", "move2"].includes(skv)) setSortKey(skv);
      if (sdv === "asc" || sdv === "desc") setSortDir(sdv);
      if (["all", "low", "normal", "high"].includes(rfv)) setRf(rfv);
      if (typeof p.autoRefresh === "boolean") setAutoRefresh(p.autoRefresh);
    } catch {
      /* yok say */
    }
    setPrefsLoaded(true);
  }, []);
  useEffect(() => {
    if (!prefsLoaded) return; // ilk yüklemede ezme
    try {
      localStorage.setItem(
        "oynaklik:prefs",
        JSON.stringify({ gran, sortKey, sortDir, rf, autoRefresh })
      );
      // URL'i de güncelle (paylaşılabilir görünüm) — sayfa yeniden yüklenmez.
      const qs = new URLSearchParams({ gran, sort: sortKey, dir: sortDir, rf });
      window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
    } catch {
      /* yok say */
    }
  }, [prefsLoaded, gran, sortKey, sortDir, rf, autoRefresh]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });

  // Görüntülenen (filtre+sıralama uygulanmış) satırları CSV olarak indir.
  const downloadCsv = () => {
    const head = [
      "Sembol", "Hisse", "Sektor", "Fiyat", "Gun_%",
      "1s_Rejim", "1s_BeklenenHareket_%", "2s_Rejim", "2s_BeklenenHareket_%",
    ];
    const reg = (r?: Regime) => (r ? REGIME_TR[r] : "");
    const rows = sorted.map((s) =>
      [
        s.ticker.replace(".IS", ""),
        `"${s.name.replace(/"/g, '""')}"`,
        s.note ?? "",
        s.lastPrice != null ? s.lastPrice.toFixed(2) : "",
        s.dayChangePct != null ? s.dayChangePct.toFixed(2) : "",
        reg(s.h1?.regime),
        s.h1 ? s.h1.expectedMovePct.toFixed(2) : "",
        reg(s.h2?.regime),
        s.h2 ? s.h2.expectedMovePct.toFixed(2) : "",
      ].join(",")
    );
    const csv = "﻿" + [head.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bist_oynaklik_${gran}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const q = query.trim().toLocaleLowerCase("tr-TR");
  const filtered = (data?.stocks ?? []).filter((s) => {
    if (rf !== "all" && s.h1?.regime !== rf) return false;
    if (!q) return true;
    return (
      s.name.toLocaleLowerCase("tr-TR").includes(q) ||
      s.ticker.toLocaleLowerCase("tr-TR").includes(q)
    );
  });
  const sorted = [...filtered].sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    const cmp = typeof va === "string" ? va.localeCompare(vb as string, "tr") : va - (vb as number);
    return sortDir === "asc" ? cmp : -cmp;
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
        {data && data.meta.reliability.length > 1 && (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <ReliabilityChart pts={data.meta.reliability} />
            <div style={{ flex: "1 1 200px", fontSize: 12.5, color: "var(--text-faint)" }}>
              <b style={{ color: "var(--text-dim)" }}>Güvenilirlik eğrisi.</b> Test
              döneminde, modelin “düşük/yüksek oynaklık” dediği hisselerin{" "}
              <b>gerçekten</b> o kadar oynayıp oynamadığı. Noktalar kesik köşegene ne
              kadar yakınsa model o kadar kalibre — tahmin ettiği büyüklük gerçekleşene
              denk geliyor demektir.
            </div>
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
        {data && data.stocks.length > 0 && (
          <button
            onClick={downloadCsv}
            style={{
              background: "transparent",
              color: "var(--text-dim)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ⬇ CSV indir
          </button>
        )}
        <button
          onClick={() => {
            try {
              navigator.clipboard?.writeText(window.location.href);
            } catch {
              /* yok say */
            }
          }}
          title="Bu görünümün bağlantısını kopyala (granülerlik + filtre + sıralama)"
          style={{
            background: "transparent",
            color: "var(--text-dim)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          🔗 Bağlantıyı kopyala
        </button>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--text-dim)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            style={{ accentColor: "var(--accent)", cursor: "pointer" }}
          />
          Otomatik yenile {marketOpen ? "" : "(borsa açıkken)"}
        </label>
        {data && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: data.marketOpen ? "var(--long)" : "var(--text-dim)",
            }}
          >
            <span style={{ fontSize: 10 }}>{data.marketOpen ? "🟢" : "🔴"}</span>
            {data.marketOpen ? "Borsa açık" : "Borsa kapalı"}
          </span>
        )}
        {data && (
          <span style={{ color: "var(--text-faint)", fontSize: 13 }}>
            {data.marketOpen ? "Güncelleme" : "Son seans"}:{" "}
            {data.lastBar != null
              ? fmtTime(new Date(data.lastBar * 1000).toISOString())
              : fmtTime(data.asof)}{" "}
            · {data.exchangeTz}
          </span>
        )}
      </div>

      {data && !data.marketOpen && data.stocks.length > 0 && (
        <div
          style={{
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderLeft: "4px solid var(--cash)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            color: "var(--text-dim)",
            marginBottom: 16,
          }}
        >
          Borsa şu an kapalı — aşağıdaki tahminler <b>son seans kapanışı</b> verisine
          dayanıyor. Seans açıldığında (BIST ~10:00–18:00) canlı güncellenir.
        </div>
      )}

      {err && (
        <div style={{ color: "var(--danger)", fontSize: 14, marginBottom: 16 }}>
          Veri alınamadı: {err}
        </div>
      )}

      {data && data.stocks.length > 0 && (
        <AdviceLine stocks={data.stocks} marketOpen={data.marketOpen} />
      )}
      {data && data.marketVolHistory.length >= 3 && (
        <MarketVolIndex hist={data.marketVolHistory} />
      )}
      {data && data.stocks.length > 0 && <NewlyHeated stocks={data.stocks} />}
      {data && data.stocks.length > 0 && <SummaryStrip stocks={data.stocks} />}
      {data && data.stocks.length > 0 && <SectorBreakdown stocks={data.stocks} />}

      {data && data.stocks.length > 0 && (
        <div
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hisse ara (ör. THYAO, Garanti)…"
            aria-label="Hisse ara"
            style={{
              flex: "1 1 220px",
              maxWidth: 280,
              background: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13.5,
              color: "var(--text)",
            }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {([
              ["all", "Tümü"],
              ["high", "Yüksek"],
              ["normal", "Normal"],
              ["low", "Düşük"],
            ] as const).map(([id, label]) => {
              const active = rf === id;
              return (
                <button
                  key={id}
                  onClick={() => setRf(id)}
                  style={{
                    background: active ? "var(--card)" : "transparent",
                    color: active ? "var(--text)" : "var(--text-dim)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 999,
                    padding: "6px 13px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <span style={{ color: "var(--text-faint)", fontSize: 12.5 }}>
            {filtered.length}/{data.stocks.length} hisse
          </span>
        </div>
      )}

      {data && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflowX: "auto",
            overflowY: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: 640,
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: "var(--panel)", textAlign: "left" }}>
                <SortTh label="Hisse" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Fiyat" k="price" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Gün %" k="day" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th style={th}>Seyir</th>
                <SortTh label="1 saat içi oynaklık" k="move1" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="2 saat içi oynaklık" k="move2" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <Fragment key={s.ticker}>
                <tr
                  onClick={s.h1 ? () => setOpen(open === s.ticker ? null : s.ticker) : undefined}
                  onKeyDown={
                    s.h1
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpen(open === s.ticker ? null : s.ticker);
                          }
                        }
                      : undefined
                  }
                  tabIndex={s.h1 ? 0 : undefined}
                  role={s.h1 ? "button" : undefined}
                  aria-expanded={s.h1 ? open === s.ticker : undefined}
                  aria-label={s.h1 ? `${s.name} oynaklık etkenlerini göster` : undefined}
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
                      {s.volRatio != null && s.volRatio >= 1.5 && (
                        <span
                          title={`Son bar hacmi, son 12 barın ${s.volRatio.toFixed(1)}× ortalaması — hacim teyidi`}
                          style={{
                            marginLeft: 6,
                            padding: "1px 6px",
                            borderRadius: 999,
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "var(--accent)",
                            background: "rgba(91,140,255,0.14)",
                          }}
                        >
                          🔊 {s.volRatio.toFixed(1)}×
                        </span>
                      )}
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
                    <RegimeBadge p={s.h1} price={s.lastPrice} />
                  </td>
                  <td style={td}>
                    <RegimeBadge p={s.h2} price={s.lastPrice} />
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
                      {s.regimeHistory.length > 1 && (
                        <RegimeHistory hist={s.regimeHistory} />
                      )}
                      {s.h1 && s.typicalMovePct != null && s.typicalMovePct > 0 && (
                        <div style={{ flexBasis: "100%", marginTop: 10, fontSize: 13, color: "var(--text-dim)" }}>
                          {(() => {
                            const ratio = s.h1.expectedMovePct / s.typicalMovePct!;
                            const col =
                              ratio >= 1.3 ? "var(--cash)" : ratio <= 0.75 ? "var(--long)" : "var(--text)";
                            const word =
                              ratio >= 1.3 ? "normalden YÜKSEK" : ratio <= 0.75 ? "normalden DÜŞÜK" : "normal civarı";
                            return (
                              <>
                                Bağlam: bu hissenin tipik 1-bar hareketi ±%
                                {s.typicalMovePct!.toFixed(2)}; bugünkü beklenti{" "}
                                <b style={{ color: col }}>
                                  {ratio.toFixed(1)}× ({word})
                                </b>
                                .
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.stocks.length > 0 && filtered.length === 0 && (
        <p style={{ color: "var(--text-dim)", marginTop: 16, fontSize: 14 }}>
          Eşleşen hisse yok. Aramayı veya rejim filtresini değiştirin.
        </p>
      )}

      {data && data.stocks.length === 0 && !loading && (
        <div
          style={{
            color: "var(--text-dim)",
            marginTop: 16,
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 16px",
            lineHeight: 1.6,
          }}
        >
          <b style={{ color: "var(--text)" }}>Veri alınamadı.</b> Hiçbir hisse için
          bar dönmedi — bu genelde <b>geçici bir veri-kaynağı sorunu</b> (Yahoo
          erişimi) demektir. Borsa kapalı olsa bile son seansın barları gelir; yani
          bu, “borsa kapalı” değil “şu an veri yok” durumudur.{" "}
          <button
            onClick={load}
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "4px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            Tekrar dene
          </button>
        </div>
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
