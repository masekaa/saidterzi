"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AnalysisResult,
  AssetMethodResult,
  BacktestResult,
  MethodResult,
  StrategyMetrics,
} from "@/lib/types";

const CURVE_COLORS = [
  "#22d3a6", // GEM (vurgu)
  "#60a5fa",
  "#f59e0b",
  "#c084fc",
  "#94a3b8",
  "#f472b6",
];

// Pozisyon bandı için varlık etiket + renk haritası (anahtar -> {label,color})
const POS_META: Record<string, { label: string; color: string }> = {
  spy: { label: "S&P 500", color: "#60a5fa" },
  qqq: { label: "NASDAQ 100", color: "#c084fc" },
  gld: { label: "Altın", color: "#f59e0b" },
  bil: { label: "Nakit (T-Bill)", color: "#64748b" },
};
function posMeta(key: string): { label: string; color: string } {
  return POS_META[key] ?? { label: key.toUpperCase(), color: "#94a3b8" };
}

function pct(x: number | null, d = 1): string {
  if (x == null || !isFinite(x)) return "—";
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;
}
function num(x: number | null, d = 2): string {
  if (x == null || !isFinite(x)) return "—";
  return x.toFixed(d);
}
function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function SignalBadge({ signal }: { signal?: "LONG" | "CASH" }) {
  if (!signal) return null;
  const isLong = signal === "LONG";
  return (
    <span className={`badge ${isLong ? "badge-long" : "badge-cash"}`}>
      <span className="dot" />
      {isLong ? "AL / TUT" : "NAKİT"}
    </span>
  );
}

function MethodRow({ a }: { a: AssetMethodResult }) {
  return (
    <div className={`mrow ${a.highlight ? "mrow-hl" : ""}`}>
      <div className="mrow-name">
        {a.assetName}
        {a.ticker && <span className="mrow-ticker">{a.ticker}</span>}
      </div>
      <div className="mrow-steps">
        {a.steps.map((s, i) => (
          <span className="chip" key={i}>
            <b>{s.label}:</b> {s.value}
          </span>
        ))}
      </div>
      <div className="mrow-result">
        <span className="mrow-result-text">{a.result}</span>
        <SignalBadge signal={a.signal} />
      </div>
      {a.note && <div className="mrow-note">{a.note}</div>}
    </div>
  );
}

function MethodCard({
  m,
  defaultOpen,
}: {
  m: MethodResult;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="method">
      <button className="method-head" onClick={() => setOpen((o) => !o)}>
        <div className="method-head-left">
          <span className="method-title">{m.title}</span>
          <span className="method-cat">{m.category}</span>
        </div>
        <span className={`chevron ${open ? "up" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="method-body">
          <div className="formula">
            <span className="formula-tag">Formül</span>
            <code>{m.formula}</code>
          </div>
          <p className="method-desc">{m.description}</p>
          <div className="method-rows">
            {m.assets.map((a) => (
              <MethodRow key={a.assetKey} a={a} />
            ))}
          </div>
          <div className="method-summary">{m.summary}</div>
          {m.warnings && m.warnings.length > 0 && (
            <div className="method-warn">{m.warnings.join(" · ")}</div>
          )}
          <div className="bookref">📖 {m.bookRef}</div>
        </div>
      )}
    </div>
  );
}

function EquityChart({ bt }: { bt: BacktestResult }) {
  const curves = bt.equityCurves;
  const dates = bt.dates;
  if (!curves?.length || !dates?.length) return null;

  const W = 820;
  const H = 340;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const n = dates.length;
  // Log ölçek: tüm eğrilerdeki min/max çarpan.
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of curves) {
    for (const v of c.growth) {
      if (v > 0 && v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (!isFinite(lo) || !isFinite(hi) || lo <= 0) return null;
  const logLo = Math.log10(lo);
  const logHi = Math.log10(hi);
  const span = logHi - logLo || 1;

  const x = (i: number) => padL + (innerW * i) / Math.max(1, n - 1);
  const y = (v: number) =>
    padT + innerH * (1 - (Math.log10(Math.max(v, lo)) - logLo) / span);

  const path = (g: number[]) =>
    g
      .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");

  // Y ekseni: 1,2,5,10,20,50... düzeninde anlamlı çarpan çizgileri.
  const yTicks: number[] = [];
  for (let e = Math.floor(logLo); e <= Math.ceil(logHi); e++) {
    for (const m of [1, 2, 5]) {
      const val = m * Math.pow(10, e);
      if (val >= lo * 0.95 && val <= hi * 1.05) yTicks.push(val);
    }
  }

  // X ekseni: yıl başına bir etiket.
  const xTicks: { i: number; label: string }[] = [];
  let lastYear = "";
  dates.forEach((d, i) => {
    const yr = d.slice(0, 4);
    if (yr !== lastYear) {
      xTicks.push({ i, label: yr });
      lastYear = yr;
    }
  });
  const xTickStep = Math.ceil(xTicks.length / 10);
  const shownXTicks = xTicks.filter((_, idx) => idx % xTickStep === 0);

  return (
    <div className="chart-card">
      <div className="chart-title">
        Kümülatif Büyüme — 1$ yatırımın gelişimi (log ölçek)
      </div>
      <svg
        className="equity-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        {yTicks.map((v, idx) => (
          <g key={`y${idx}`}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(v)}
              y2={y(v)}
              className="grid-line"
            />
            <text x={padL - 8} y={y(v) + 3} className="axis-label" textAnchor="end">
              {v}×
            </text>
          </g>
        ))}
        {shownXTicks.map((t, idx) => (
          <text
            key={`x${idx}`}
            x={x(t.i)}
            y={H - 8}
            className="axis-label"
            textAnchor="middle"
          >
            {t.label}
          </text>
        ))}
        {curves.map((c, idx) => (
          <path
            key={c.name}
            d={path(c.growth)}
            className={`equity-line ${c.highlight ? "equity-hl" : ""}`}
            stroke={c.highlight ? CURVE_COLORS[0] : CURVE_COLORS[idx % CURVE_COLORS.length]}
          />
        ))}
      </svg>
      <div className="chart-legend">
        {curves.map((c, idx) => {
          const final = c.growth[c.growth.length - 1];
          return (
            <span className="legend-item" key={c.name}>
              <span
                className="legend-swatch"
                style={{
                  background: c.highlight
                    ? CURVE_COLORS[0]
                    : CURVE_COLORS[idx % CURVE_COLORS.length],
                }}
              />
              {c.name}
              <b className="legend-val">{final.toFixed(1)}×</b>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function PositionTimeline({ bt }: { bt: BacktestResult }) {
  const tl = bt.timeline;
  if (!tl?.length) return null;
  const W = 820;
  const H = 54;
  const padL = 52;
  const padR = 16;
  const innerW = W - padL - padR;
  const bw = innerW / tl.length;

  // Legendde görünen benzersiz pozisyonlar (sırayla).
  const seen: string[] = [];
  for (const p of tl) if (!seen.includes(p.key)) seen.push(p.key);

  // Yıl etiketleri.
  const xTicks: { i: number; label: string }[] = [];
  let lastYear = "";
  tl.forEach((p, i) => {
    const yr = p.date.slice(0, 4);
    if (yr !== lastYear) {
      xTicks.push({ i, label: yr });
      lastYear = yr;
    }
  });
  const step = Math.ceil(xTicks.length / 10);
  const shown = xTicks.filter((_, idx) => idx % step === 0);

  return (
    <div className="chart-card">
      <div className="chart-title">
        GEM Pozisyon Geçmişi — her ay hangi varlıkta tutuldu
      </div>
      <svg
        className="equity-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
      >
        {tl.map((p, i) => (
          <rect
            key={i}
            x={padL + i * bw}
            y={6}
            width={bw + 0.6}
            height={26}
            fill={posMeta(p.key).color}
          />
        ))}
        {shown.map((t, idx) => (
          <text
            key={idx}
            x={padL + t.i * bw}
            y={H - 6}
            className="axis-label"
            textAnchor="middle"
          >
            {t.label}
          </text>
        ))}
      </svg>
      <div className="chart-legend">
        {seen.map((k) => {
          const m = posMeta(k);
          const months = tl.filter((p) => p.key === k).length;
          const pctTime = ((months / tl.length) * 100).toFixed(0);
          return (
            <span className="legend-item" key={k}>
              <span className="legend-swatch" style={{ background: m.color }} />
              {m.label}
              <b className="legend-val">%{pctTime}</b>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function UnderwaterChart({ bt }: { bt: BacktestResult }) {
  const gem = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  if (!gem?.growth?.length) return null;

  // Drawdown serisi: growth/runningMax - 1 (<= 0).
  const dd: number[] = [];
  let peak = -Infinity;
  for (const v of gem.growth) {
    if (v > peak) peak = v;
    dd.push(v / peak - 1);
  }
  const minDD = Math.min(...dd);
  if (!isFinite(minDD) || minDD === 0) return null;

  const W = 820;
  const H = 180;
  const padL = 52;
  const padR = 16;
  const padT = 12;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = dd.length;

  const x = (i: number) => padL + (innerW * i) / Math.max(1, n - 1);
  const y = (v: number) => padT + innerH * (v / minDD); // 0 -> top, minDD -> bottom

  const area =
    `M${x(0).toFixed(1)},${y(0).toFixed(1)} ` +
    dd.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ") +
    ` L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} Z`;

  // Y çizgileri: 0, %25, %50... minDD'ye kadar.
  const yTicks: number[] = [];
  for (let p = 0; p >= minDD; p -= 0.1) yTicks.push(p);

  const xTicks: { i: number; label: string }[] = [];
  let lastYear = "";
  bt.dates.forEach((d, i) => {
    const yr = d.slice(0, 4);
    if (yr !== lastYear) {
      xTicks.push({ i, label: yr });
      lastYear = yr;
    }
  });
  const step = Math.ceil(xTicks.length / 10);
  const shown = xTicks.filter((_, idx) => idx % step === 0);

  return (
    <div className="chart-card">
      <div className="chart-title">
        GEM Drawdown (Underwater) — zirveden düşüş · en kötü {pct(minDD, 1)}
      </div>
      <svg
        className="equity-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        {yTicks.map((v, idx) => (
          <g key={idx}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(v)}
              y2={y(v)}
              className="grid-line"
            />
            <text
              x={padL - 8}
              y={y(v) + 3}
              className="axis-label"
              textAnchor="end"
            >
              {(v * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        <path d={area} className="underwater-area" />
        {shown.map((t, idx) => (
          <text
            key={idx}
            x={x(t.i)}
            y={H - 8}
            className="axis-label"
            textAnchor="middle"
          >
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function heatColor(r: number): string {
  // Getiriye göre yeşil/kırmızı yoğunluk (±%10 doygunluk).
  const cap = 0.1;
  const t = Math.max(-1, Math.min(1, r / cap));
  if (t >= 0)
    return `rgba(34, 211, 166, ${(0.12 + 0.55 * t).toFixed(3)})`;
  return `rgba(239, 68, 68, ${(0.12 + 0.55 * -t).toFixed(3)})`;
}

function MonthlyHeatmap({ bt }: { bt: BacktestResult }) {
  const gem = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  const g = gem?.growth;
  if (!g || g.length < 2 || bt.dates.length < 2) return null;

  // Aylık GEM getirisi: r[i] = g[i+1]/g[i]-1, tarih = bt.dates[i+1]
  type Cell = { year: number; month: number; r: number };
  const cells: Cell[] = [];
  for (let i = 0; i + 1 < g.length && i + 1 < bt.dates.length; i++) {
    const d = bt.dates[i + 1];
    cells.push({
      year: +d.slice(0, 4),
      month: +d.slice(5, 7),
      r: g[i + 1] / g[i] - 1,
    });
  }
  if (!cells.length) return null;

  const years: number[] = [];
  for (const c of cells) if (!years.includes(c.year)) years.push(c.year);
  years.sort((a, b) => a - b);

  const grid: Record<number, Record<number, number>> = {};
  const yearTot: Record<number, number> = {};
  for (const y of years) {
    grid[y] = {};
    yearTot[y] = 1;
  }
  for (const c of cells) {
    grid[c.year][c.month] = c.r;
    yearTot[c.year] *= 1 + c.r;
  }

  const MONTHS = ["O", "Ş", "M", "N", "May", "H", "T", "A", "Ey", "Ek", "K", "Ar"];

  return (
    <div className="chart-card">
      <div className="chart-title">
        GEM Aylık Getiri Isı Haritası — yıl × ay (yeşil: kâr, kırmızı: zarar)
      </div>
      <div className="table-scroll">
        <table className="heatmap">
          <thead>
            <tr>
              <th className="hm-year">Yıl</th>
              {MONTHS.map((m, i) => (
                <th key={i}>{m}</th>
              ))}
              <th className="hm-tot">Yıl</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y}>
                <td className="hm-year">{y}</td>
                {Array.from({ length: 12 }, (_, mi) => {
                  const r = grid[y][mi + 1];
                  return (
                    <td
                      key={mi}
                      style={r != null ? { background: heatColor(r) } : undefined}
                      title={r != null ? pct(r, 1) : ""}
                    >
                      {r != null ? (r * 100).toFixed(1) : ""}
                    </td>
                  );
                })}
                <td
                  className="hm-tot"
                  style={{ background: heatColor(yearTot[y] - 1) }}
                >
                  {((yearTot[y] - 1) * 100).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricsTable({ rows }: { rows: StrategyMetrics[] }) {
  return (
    <div className="table-scroll">
      <table className="metrics">
        <thead>
          <tr>
            <th className="left">Strateji</th>
            <th>Yıllık (arit.)</th>
            <th>CAGR</th>
            <th>Volatilite</th>
            <th>Sharpe</th>
            <th>Max DD</th>
            <th>% Kârlı Ay</th>
            <th>Toplam Getiri</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={i} className={i === 0 ? "row-hl" : ""}>
              <td className="left">{s.name}</td>
              <td>{pct(s.annualReturnArith)}</td>
              <td>{pct(s.cagr)}</td>
              <td>{pct(s.annualVol)}</td>
              <td className="strong">{num(s.sharpe)}</td>
              <td className="neg">{pct(s.maxDrawdown)}</td>
              <td>{s.pctProfitMonths != null ? num(s.pctProfitMonths, 0) : "—"}</td>
              <td>{pct(s.totalReturn, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analysis", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      setData((await res.json()) as AnalysisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const gem = data?.gem;
  const isCash = gem?.positionKey === "cash";
  const bt = data?.backtest;

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <h1 className="title">Dual Momentum Analiz Motoru</h1>
          <p className="subtitle">
            Altın · S&amp;P 500 · NASDAQ — Antonacci stratejilerinin canlı,
            şeffaf hesaplamaları (12 ay look-back, T-Bill eşiği)
          </p>
        </div>
        <div className="header-right">
          <button className="refresh-btn" onClick={load} disabled={loading}>
            {loading ? "Yükleniyor…" : "↻ Yenile"}
          </button>
          {data && (
            <span className="timestamp">
              Güncellendi: {fmtTime(data.generatedAt)}
            </span>
          )}
        </div>
      </div>

      {loading && !data && (
        <div className="state">
          <div className="spinner" />
          Piyasa verileri çekiliyor ve tüm yöntemler hesaplanıyor…
        </div>
      )}

      {error && (
        <div className="error-box">
          <b>Veri alınamadı.</b> {error}
          <br />
          <br />
          Yahoo Finance geçici olarak yanıt vermiyor olabilir; birkaç saniye
          sonra <b>Yenile</b>'ye basın.
        </div>
      )}

      {data && gem && (
        <>
          {/* GEM Önerisi */}
          <div className="hero">
            <p className="hero-label">GEM Önerisi — Bu Ay Tutulacak Pozisyon</p>
            <div className="hero-position">
              <span className="hero-asset">{gem.positionName}</span>
              <span
                className={`badge lg ${isCash ? "badge-cash" : "badge-long"}`}
              >
                <span className="dot" />
                {isCash ? "RİSKTEN KAÇ (NAKİT)" : "HİSSEDE KAL"}
              </span>
            </div>
            <p className="hero-rationale">{gem.rationale}</p>
          </div>

          {/* Backtest & Metrikler */}
          {bt && (
            <>
              <div className="section-label">
                Backtest &amp; Risk Metrikleri ({bt.startDate} → {bt.endDate},{" "}
                {bt.months} ay)
              </div>
              <EquityChart bt={bt} />
              <PositionTimeline bt={bt} />
              <UnderwaterChart bt={bt} />
              <MonthlyHeatmap bt={bt} />
              <MetricsTable rows={bt.strategies} />
              <p className="table-note">{bt.note}</p>
              {bt.strategies[0]?.timeInAsset && (
                <p className="table-note">
                  GEM zaman dağılımı:{" "}
                  {Object.entries(bt.strategies[0].timeInAsset)
                    .map(([k, v]) => `${k.toUpperCase()} %${v}`)
                    .join(" · ")}{" "}
                  · Yıllık ~{num(bt.strategies[0].switchesPerYear ?? null)} geçiş
                </p>
              )}
            </>
          )}

          {/* Tüm Yöntemler */}
          <div className="section-label">
            Yöntem Hesaplamaları (formül + adımlar şeffaf)
          </div>
          <div className="methods">
            {data.methods.map((m, i) => (
              <MethodCard key={m.id} m={m} defaultOpen={i === 0} />
            ))}
          </div>

          {data.warnings.length > 0 && (
            <div className="warnings">
              <b>Uyarılar:</b>
              <ul>
                {data.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="disclaimer">
            ⚠️ Yalnızca eğitim/bilgilendirme amaçlıdır; yatırım tavsiyesi
            değildir. Veriler Yahoo Finance'ten gecikmeli/yaklaşık olabilir.
            Tüm hesaplamalar kapsam dokümanındaki (dual-momentum-kapsam/)
            metodolojiye dayanır; backtest işlem maliyeti içermez ve geçmiş
            performans gelecek getiriyi garanti etmez.
          </p>
        </>
      )}

      <div className="footer">
        Kaynak metodoloji: Gary Antonacci, <i>Dual Momentum Investing</i>{" "}
        (2014). · Veri: Yahoo Finance · {data?.methods.length ?? 0} yöntem canlı
        hesaplanıyor
      </div>
    </div>
  );
}
