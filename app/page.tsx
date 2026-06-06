"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AnalysisResult,
  AssetMethodResult,
  BacktestResult,
  LookbackMatrix as LookbackData,
  MethodResult,
  SignalBoard as SignalBoardData,
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

function SignalBoard({ board }: { board: SignalBoardData }) {
  if (!board?.assets?.length) return null;
  return (
    <>
      <div className="section-label">
        Varlık Sinyal Panosu — her varlığın anahtar momentum sinyalleri
      </div>
      <div className="table-scroll">
        <table className="metrics signalboard">
          <thead>
            <tr>
              <th className="left">Varlık</th>
              <th>12-Ay Getiri</th>
              <th>T-Bill&apos;e Karşı (excess)</th>
              <th>Mutlak Sinyal</th>
              <th>Trend (12-Ay MA)</th>
              <th>52-Hafta Yakınlık</th>
            </tr>
          </thead>
          <tbody>
            {board.assets.map((a) => (
              <tr key={a.key} className={a.isGemWinner ? "row-hl" : ""}>
                <td className="left">
                  {a.name}
                  <span className="sb-ticker">{a.ticker}</span>
                  {a.isGemWinner && <span className="sb-winner">★ en güçlü</span>}
                </td>
                <td className={a.ret12m != null && a.ret12m < 0 ? "neg" : ""}>
                  {pct(a.ret12m)}
                </td>
                <td className={a.excessVsTbill != null && a.excessVsTbill < 0 ? "neg" : ""}>
                  {pct(a.excessVsTbill)}
                </td>
                <td>
                  <SignalBadge signal={a.absolute ?? undefined} />
                </td>
                <td>
                  {a.maAbove == null ? (
                    "—"
                  ) : (
                    <span className={a.maAbove ? "sb-up" : "sb-down"}>
                      {a.maAbove ? "▲ üstünde" : "▼ altında"}
                      {a.maGap != null && (
                        <span className="sb-gap"> ({pct(a.maGap)})</span>
                      )}
                    </span>
                  )}
                </td>
                <td>
                  {a.highProximity != null
                    ? `%${(a.highProximity * 100).toFixed(0)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        Excess = 12-ay getiri − T-Bill 12-ay getirisi (
        {pct(board.tbillRet12m)}). Mutlak sinyal excess&gt;0 ise AL/TUT. Trend:
        ay-sonu fiyat 12-ay basit hareketli ortalamanın üstünde mi. 52-hafta
        yakınlık: güncel fiyat / son 12 ayın en yüksek ay-sonu kapanışı.
      </p>
    </>
  );
}

function LookbackHeatmap({ data }: { data: LookbackData }) {
  if (!data?.assets?.length) return null;
  return (
    <>
      <div className="section-label">
        Look-back Duyarlılık — farklı geri-bakış pencerelerinde 12→1 ay getiri
      </div>
      <div className="chart-card">
        <div className="table-scroll">
          <table className="heatmap lookback">
            <thead>
              <tr>
                <th className="hm-year">Varlık</th>
                {data.windows.map((w) => (
                  <th key={w}>{w} ay</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.assets.map((a) => (
                <tr key={a.key}>
                  <td className="hm-year">
                    {a.name}
                    <span className="sb-ticker">{a.ticker}</span>
                  </td>
                  {a.rets.map((r, i) => (
                    <td
                      key={i}
                      style={r != null ? { background: heatColor(r) } : undefined}
                      title={r != null ? pct(r, 1) : ""}
                    >
                      {r != null ? (r * 100).toFixed(1) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="lb-tbill">
                <td className="hm-year">T-Bill (eşik)</td>
                {data.tbillRets.map((r, i) => (
                  <td key={i}>{r != null ? (r * 100).toFixed(1) : "—"}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="table-note">
          Her hücre o penceredeki total return (%). Mutlak momentum için varlık
          getirisi T-Bill eşik satırını geçmeli; göreceli momentum için aynı
          sütunda en yüksek varlık seçilir. Yeşil pozitif, kırmızı negatif.
        </p>
      </div>
    </>
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
  open,
  onToggle,
}: {
  m: MethodResult;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="method">
      <button className="method-head" onClick={onToggle}>
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
      <div className="chart-help">
        Çizgi ne kadar dik yukarıdaysa büyüme o kadar hızlı. Log ölçekte eşit
        dikey mesafe = eşit yüzde kazanç; bu yüzden farklı büyüklükteki
        stratejiler adil karşılaştırılır. Legend&apos;daki ×değer = dönem sonu
        toplam çarpan.
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
      <div className="chart-help">
        Her dikey dilim bir ay; renk o ay tutulan varlık. Renk değişimi =
        GEM&apos;in pozisyon değiştirdiği (rotasyon yaptığı) an. Legend&apos;daki
        %değer, o varlıkta geçirilen toplam zamanın oranı.
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
      <div className="chart-help">
        0 çizgisi = yeni zirve (yatırımcı en yüksek noktasında). Eğri ne kadar
        aşağıdaysa, o an zirveden o kadar uzakta/kayıpta demektir. Düz 0&apos;a
        dönüş = kayıpların telafi edildiği an. Dual momentum&apos;un amacı bu
        çukurları sığ tutmaktır.
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
      <div className="chart-help">
        Her hücre o ayın GEM getirisi (%). Renk yoğunluğu büyüklüğü gösterir:
        koyu yeşil güçlü kâr, koyu kırmızı güçlü zarar. Sağdaki <b>Yıl</b>{" "}
        sütunu yıllık bileşik getiri. Kırmızı kümeleri = stres dönemleri.
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

function RiskReturnChart({ rows }: { rows: StrategyMetrics[] }) {
  const pts = rows
    .map((s) => ({
      name: s.name,
      x: s.annualVol,
      y: s.cagr,
      sharpe: s.sharpe,
      hl: s.name.startsWith("GEM"),
    }))
    .filter(
      (p): p is { name: string; x: number; y: number; sharpe: number | null; hl: boolean } =>
        p.x != null && p.y != null && isFinite(p.x) && isFinite(p.y)
    );
  if (pts.length < 2) return null;

  const W = 820;
  const H = 360;
  const padL = 52;
  const padR = 120; // etiketler için sağ boşluk
  const padT = 16;
  const padB = 38;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xMax = Math.max(...pts.map((p) => p.x)) * 1.1;
  const yMin = Math.min(0, ...pts.map((p) => p.y));
  const yMax = Math.max(...pts.map((p) => p.y)) * 1.1;
  const ySpan = yMax - yMin || 1;

  const X = (v: number) => padL + (innerW * v) / (xMax || 1);
  const Y = (v: number) => padT + innerH * (1 - (v - yMin) / ySpan);

  const xTicks = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3].filter((v) => v <= xMax);
  const yTicks: number[] = [];
  for (let v = Math.floor(yMin * 20) / 20; v <= yMax; v += 0.05) yTicks.push(v);

  return (
    <div className="chart-card">
      <div className="chart-title">
        Risk–Getiri Dağılımı — yıllık volatilite (x) vs. CAGR (y) · sol-üst daha iyi
      </div>
      <div className="chart-help">
        Her nokta bir strateji. <b>Sol-üst köşe idealdir:</b> düşük volatilite +
        yüksek getiri. GEM&apos;in (yeşil) al-tut benchmark&apos;lara göre
        konumuna bak — kitabın tezi, dual momentum&apos;un sola-yukarı
        kaymasıdır (aynı/daha yüksek getiri, daha az risk).
      </div>
      <svg
        className="equity-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        {yTicks.map((v, i) => (
          <g key={`y${i}`}>
            <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} className="grid-line" />
            <text x={padL - 8} y={Y(v) + 3} className="axis-label" textAnchor="end">
              {(v * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        {xTicks.map((v, i) => (
          <text key={`x${i}`} x={X(v)} y={H - 14} className="axis-label" textAnchor="middle">
            {(v * 100).toFixed(0)}%
          </text>
        ))}
        <text x={(padL + W - padR) / 2} y={H - 2} className="axis-label" textAnchor="middle">
          Volatilite (yıllık)
        </text>
        {pts.map((p, i) => (
          <g key={i}>
            <circle
              cx={X(p.x)}
              cy={Y(p.y)}
              r={p.hl ? 7 : 5}
              className={p.hl ? "rr-dot rr-hl" : "rr-dot"}
            />
            <text
              x={X(p.x) + (p.hl ? 11 : 9)}
              y={Y(p.y) + 3}
              className={`rr-label ${p.hl ? "rr-label-hl" : ""}`}
            >
              {p.name.replace(" (Al-Tut)", "").replace(" (Dual Momentum)", "")}
            </text>
          </g>
        ))}
      </svg>
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

function MethodologyPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="howto">
      <button className="howto-head" onClick={() => setOpen((o) => !o)}>
        <span className="howto-title">
          📘 Nasıl çalışır? — GEM / Dual Momentum metodolojisi
        </span>
        <span className={`chevron ${open ? "up" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="howto-body">
          <p>
            <b>Dual Momentum (Çift Momentum)</b> iki basit kuralı birleştirir.
            Her ay sonu, son <b>12 ayın total return</b>'üne (temettü dahil)
            bakılır:
          </p>
          <ol>
            <li>
              <b>Göreceli momentum (relative):</b> Hisse varlıkları (S&amp;P 500
              vs NASDAQ vs Altın) karşılaştırılır, en güçlü getiriye sahip olan
              aday seçilir. Mantık: kazananlar kısa-orta vadede kazanmaya devam
              eder.
            </li>
            <li>
              <b>Mutlak momentum (absolute / trend filtresi):</b> Seçilen aday,
              risksiz faizi (<b>T-Bill</b>) geçiyor mu? Geçiyorsa o varlığa %100
              girilir; geçmiyorsa <b>nakde</b> (T-Bill/tahvil) kaçılır. Bu, ayı
              piyasalarında büyük düşüşlerden korur.
            </li>
          </ol>
          <p>
            İkisinin birleşimi = <b>Dual Momentum</b>. Pozisyon ayda bir
            gözden geçirilir (aylık rebalance); sinyal ay-sonu fiyatla üretilir,
            getiri ertesi ay gerçekleşir (lookahead bias yok).
          </p>
          <p className="howto-note">
            Bu uygulamadaki her sayı canlı Yahoo Finance verisinden hesaplanır.
            Yöntemlerin tam formülleri ve ara adımları aşağıdaki{" "}
            <b>Yöntem Hesaplamaları</b> bölümünde şeffaftır; teorik arka plan{" "}
            <code>dual-momentum-kapsam/</code> dokümanındadır.
          </p>
        </div>
      )}
    </div>
  );
}

function MethodsSection({ methods }: { methods: MethodResult[] }) {
  // İlk yöntem varsayılan açık.
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(methods.length ? [methods[0].id] : [])
  );
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const openAll = () => setOpenIds(new Set(methods.map((m) => m.id)));
  const closeAll = () => setOpenIds(new Set());

  // Kategoriye göre grupla (ilk görülme sırasını koru).
  const groups: { category: string; items: MethodResult[] }[] = [];
  for (const m of methods) {
    let g = groups.find((x) => x.category === m.category);
    if (!g) {
      g = { category: m.category, items: [] };
      groups.push(g);
    }
    g.items.push(m);
  }

  return (
    <>
      <div className="section-head">
        <div className="section-label">
          Yöntem Hesaplamaları (formül + adımlar şeffaf) · {methods.length} yöntem
        </div>
        <div className="section-actions">
          <button className="mini-btn" onClick={openAll}>
            Tümünü aç
          </button>
          <button className="mini-btn" onClick={closeAll}>
            Tümünü kapat
          </button>
        </div>
      </div>
      {groups.map((g) => (
        <div className="method-group" key={g.category}>
          <div className="method-group-head">
            {g.category}
            <span className="method-group-count">{g.items.length}</span>
          </div>
          <div className="methods">
            {g.items.map((m) => (
              <MethodCard
                key={m.id}
                m={m}
                open={openIds.has(m.id)}
                onToggle={() => toggle(m.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </>
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

  const exportJson = useCallback(() => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const stamp = data.generatedAt.slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dual-momentum-analiz-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data]);

  const exportCsv = useCallback(() => {
    if (!data) return;
    const fmt = (x: number | null) =>
      x == null || !isFinite(x) ? "" : x.toFixed(6);
    const lines: string[] = [];

    // Bölüm 1: Strateji metrikleri
    if (data.backtest) {
      lines.push("# Strateji Metrikleri");
      lines.push(
        "Strateji,Yillik_Aritmetik,CAGR,Volatilite,Sharpe,Max_Drawdown,Yuzde_Karli_Ay,Toplam_Getiri"
      );
      for (const s of data.backtest.strategies) {
        lines.push(
          [
            `"${s.name}"`,
            fmt(s.annualReturnArith),
            fmt(s.cagr),
            fmt(s.annualVol),
            fmt(s.sharpe),
            fmt(s.maxDrawdown),
            fmt(s.pctProfitMonths),
            fmt(s.totalReturn),
          ].join(",")
        );
      }
      lines.push("");
    }

    // Bölüm 2: Varlık sinyal panosu
    if (data.signals?.assets?.length) {
      lines.push("# Varlik Sinyal Panosu");
      lines.push(
        "Varlik,Ticker,Ret_12ay,Excess_vs_TBill,Mutlak_Sinyal,MA_Ustunde,MA_Gap,52h_Yakinlik"
      );
      for (const a of data.signals.assets) {
        lines.push(
          [
            `"${a.name}"`,
            a.ticker,
            fmt(a.ret12m),
            fmt(a.excessVsTbill),
            a.absolute ?? "",
            a.maAbove == null ? "" : a.maAbove ? "1" : "0",
            fmt(a.maGap),
            fmt(a.highProximity),
          ].join(",")
        );
      }
    }

    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const stamp = data.generatedAt.slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dual-momentum-metrikler-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data]);

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
          <button
            className="refresh-btn ghost"
            onClick={exportCsv}
            disabled={!data}
            title="Metrikleri ve sinyalleri CSV olarak indir"
          >
            ⭳ CSV
          </button>
          <button
            className="refresh-btn ghost"
            onClick={exportJson}
            disabled={!data}
            title="Tüm analizi JSON olarak indir"
          >
            ⭳ JSON
          </button>
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

          {/* Metodoloji açıklaması */}
          <MethodologyPanel />

          {/* Varlık Sinyal Panosu */}
          {data.signals && <SignalBoard board={data.signals} />}

          {/* Look-back Duyarlılık Matrisi */}
          {data.lookback && <LookbackHeatmap data={data.lookback} />}

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
              <RiskReturnChart rows={bt.strategies} />
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

          {/* Tüm Yöntemler — kategoriye göre gruplu */}
          <MethodsSection methods={data.methods} />

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
