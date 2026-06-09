"use client";

import {
  Component,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  AnalysisResult,
  AssetMethodResult,
  BacktestResult,
  EarningsMomentum as EarningsData,
  FactorAlpha,
  LookbackMatrix as LookbackData,
  MethodResult,
  SignalBoard as SignalBoardData,
  StockMomentum as StockMomentumData,
  StrategyMetrics,
  UniverseBundle,
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
  stock: { label: "Hisse Sepeti (Top-N)", color: "#22d3a6" },
  crypto: { label: "Kripto Sepeti (Top-N)", color: "#f7931a" },
  sector: { label: "Sektör Sepeti (Top-N)", color: "#a78bfa" },
  intl: { label: "Bölge Sepeti (Top-N)", color: "#38bdf8" },
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

// Kümülatif büyüme eğrisinden aylık getiri serisi
function growthToRets(g: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < g.length; i++) r.push(g[i] / g[i - 1] - 1);
  return r;
}

// Pearson korelasyon (iki getiri serisi)
function pearson(a: number[], b: number[]): number {
  const m = Math.min(a.length, b.length);
  if (m < 2) return 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < m; i++) {
    sa += a[i];
    sb += b[i];
  }
  const ma = sa / m;
  const mb = sb / m;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < m; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  return va && vb ? cov / Math.sqrt(va * vb) : 0;
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

function SignalBoard({
  board,
  title = "Varlık Sinyal Panosu — her varlığın anahtar momentum sinyalleri",
}: {
  board: SignalBoardData;
  title?: string;
}) {
  if (!board?.assets?.length) return null;
  return (
    <>
      <div className="section-label">{title}</div>
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

function StockMomentumBoard({ data }: { data: StockMomentumData }) {
  const [sortK, setSortK] = useState<"rank" | "excess" | "prox">("rank");
  if (!data?.stocks?.length) return null;
  const selectedCount = data.stocks.filter((s) => s.selected).length;
  const sorted = [...data.stocks];
  if (sortK === "excess")
    sorted.sort(
      (a, b) => (b.excessVsTbill ?? -Infinity) - (a.excessVsTbill ?? -Infinity)
    );
  else if (sortK === "prox")
    sorted.sort(
      (a, b) => (b.highProximity ?? -Infinity) - (a.highProximity ?? -Infinity)
    );
  const sh = (k: "rank" | "excess" | "prox") => (sortK === k ? " ▾" : "");
  return (
    <>
      <div className="section-label">
        Hisse Momentum Panosu — {data.stocks.length} büyük-cap hisse, göreceli
        sıralama (en güçlü top-{data.topN} seçilir)
      </div>
      <div className="table-scroll">
        <table className="metrics stockboard">
          <thead>
            <tr>
              <th
                className={`sortable ${sortK === "rank" ? "sorted" : ""}`}
                onClick={() => setSortK("rank")}
                title="Momentum sırasına göre"
              >
                #{sh("rank")}
              </th>
              <th className="left">Hisse</th>
              <th className="left">Sektör</th>
              <th>12-Ay Getiri</th>
              <th
                className={`sortable ${sortK === "excess" ? "sorted" : ""}`}
                onClick={() => setSortK("excess")}
              >
                T-Bill&apos;e Karşı{sh("excess")}
              </th>
              <th>Mutlak</th>
              <th
                className={`sortable ${sortK === "prox" ? "sorted" : ""}`}
                onClick={() => setSortK("prox")}
              >
                52-Hafta{sh("prox")}
              </th>
              <th>İvme</th>
              <th>Seçim</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.key} className={s.selected ? "row-hl" : ""}>
                <td className="rank">{s.rank ?? "—"}</td>
                <td className="left">
                  {s.name}
                  <span className="sb-ticker">{s.ticker}</span>
                </td>
                <td className="left sector">{s.sector}</td>
                <td className={s.ret12m != null && s.ret12m < 0 ? "neg" : ""}>
                  {pct(s.ret12m)}
                </td>
                <td className={s.excessVsTbill != null && s.excessVsTbill < 0 ? "neg" : ""}>
                  {pct(s.excessVsTbill)}
                </td>
                <td>
                  <SignalBadge signal={s.absolute ?? undefined} />
                </td>
                <td>
                  {s.highProximity != null
                    ? `%${(s.highProximity * 100).toFixed(0)}`
                    : "—"}
                </td>
                <td>
                  {s.accelerating == null ? (
                    "—"
                  ) : s.accelerating ? (
                    <span className="sb-up">▲ hızlanıyor</span>
                  ) : (
                    <span className="sb-down">▼ yavaşlıyor</span>
                  )}
                </td>
                <td>
                  {s.selected ? (
                    <span className="pill-sel">★ SEÇİLDİ</span>
                  ) : (
                    <span className="pill-no">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        <b>Göreceli momentum:</b> hisseler 12-ay getiriye göre sıralanır, en
        güçlü {data.topN} tanesi aday olur. <b>Mutlak momentum:</b> aday ancak
        12-ay getirisi T-Bill&apos;i ({pct(data.tbillRet12m)}) geçerse seçilir —
        şu an <b>{selectedCount}</b> hisse seçili. Dual momentum portföyü bu
        seçili hisselere eşit ağırlık verir; hiçbiri geçemezse nakitte kalınır.
        İvme = son 12 ayın log-fiyat kavisi (hızlanan trend daha kalıcı olur).
      </p>
    </>
  );
}

function EarningsMomentumPanel({ data }: { data: EarningsData }) {
  if (!data.enabled) {
    return (
      <>
        <div className="section-label">
          Earnings / Revenue Momentum (Chen 2014) — temel veri momentumu
        </div>
        <div className="chart-card earnings-off">
          <div className="eo-title">🔒 Etkinleştirmek için API anahtarı gerekli</div>
          <p className="chart-help">
            {data.reason} Adımlar: (1){" "}
            <b>financialmodelingprep.com</b> üzerinden ücretsiz API anahtarı al
            (250 istek/gün). (2) Vercel → proje → Settings → Environment
            Variables → <code>FMP_API_KEY</code> ekle. (3) Yeniden deploy et.
            Sonra her hissenin <b>yıllık gelir ve net kâr YoY büyümesi</b>{" "}
            çekilip momentum sıralaması burada görünür.
          </p>
        </div>
      </>
    );
  }
  const selectedCount = data.stocks.filter((s) => s.selected).length;
  return (
    <>
      <div className="section-label">
        Earnings / Revenue Momentum — yıllık gelir &amp; net kâr YoY büyümesi
        sıralaması
      </div>
      {data.note && <p className="table-note eo-note">ℹ️ {data.note}</p>}
      <div className="table-scroll">
        <table className="metrics stockboard">
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Hisse</th>
              <th>Gelir YoY (yıllık)</th>
              <th>Net Kâr YoY (yıllık)</th>
              <th>Seçim</th>
            </tr>
          </thead>
          <tbody>
            {data.stocks.map((s) => (
              <tr key={s.key} className={s.selected ? "row-hl" : ""}>
                <td className="rank">{s.rank ?? "—"}</td>
                <td className="left">
                  {s.name}
                  <span className="sb-ticker">{s.ticker}</span>
                </td>
                <td className={s.revenueYoY != null && s.revenueYoY < 0 ? "neg" : ""}>
                  {pct(s.revenueYoY)}
                </td>
                <td className={s.earningsYoY != null && s.earningsYoY < 0 ? "neg" : ""}>
                  {pct(s.earningsYoY)}
                </td>
                <td>
                  {s.selected ? (
                    <span className="pill-sel">★ SEÇİLDİ</span>
                  ) : (
                    <span className="pill-no">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        Gelir ve net kâr YoY büyümesinin sıra-ortalamasına göre birleşik
        momentum; en güçlü {data.topN} hisse seçilir ({selectedCount} seçili).
        Fiyat momentumu ile birlikte değerlendirildiğinde daha sağlam sinyal
        verir (Chen et al. 2014).
      </p>
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
      <button className="method-head" onClick={onToggle} aria-expanded={open}>
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
        role="img" aria-label="Finansal analiz grafiği; açıklama hemen üstteki başlık ve metinde"
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

function PositionTimeline({ bt, label = "GEM" }: { bt: BacktestResult; label?: string }) {
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
        {label} Pozisyon Geçmişi — her ay hangi varlıkta tutuldu
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
        role="img" aria-label="Finansal analiz grafiği; açıklama hemen üstteki başlık ve metinde"
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

function UnderwaterChart({ bt, label = "GEM" }: { bt: BacktestResult; label?: string }) {
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
        {label} Drawdown (Underwater) — zirveden düşüş · en kötü {pct(minDD, 1)}
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
        role="img" aria-label="Finansal analiz grafiği; açıklama hemen üstteki başlık ve metinde"
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

function MonthlyHeatmap({ bt, label = "GEM" }: { bt: BacktestResult; label?: string }) {
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
        {label} Aylık Getiri Isı Haritası — yıl × ay (yeşil: kâr, kırmızı: zarar)
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
        role="img" aria-label="Finansal analiz grafiği; açıklama hemen üstteki başlık ve metinde"
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

function AdvancedMetricsTable({ rows }: { rows: StrategyMetrics[] }) {
  return (
    <>
      <div className="section-label">
        Gelişmiş Risk Metrikleri (Sortino · çarpıklık · basıklık · CVaR ·
        drawdown süreleri)
      </div>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th className="left">Strateji</th>
              <th>Sortino</th>
              <th>Çarpıklık</th>
              <th>Basıklık</th>
              <th>CVaR %5 (aylık)</th>
              <th>DD Süre (ay)</th>
              <th>Toparlanma (ay)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={i} className={i === 0 ? "row-hl" : ""}>
                <td className="left">{s.name}</td>
                <td className="strong">{num(s.sortino)}</td>
                <td>{num(s.skewness)}</td>
                <td>{num(s.kurtosis)}</td>
                <td className="neg">{pct(s.cvar5)}</td>
                <td>{s.ddDurationMonths != null ? s.ddDurationMonths : "—"}</td>
                <td>
                  {s.ddRecoveryMonths != null ? (
                    s.ddRecoveryMonths
                  ) : (
                    <span className="neg" title="Henüz eski zirveye dönülmedi">
                      toparlanmadı
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        <b>Sortino:</b> getiriyi yalnızca aşağı-yön oynaklığına böler (Sharpe&apos;ın
        ceza vermediği yukarı oynaklığı görmezden gelir). <b>Çarpıklık&lt;0</b>{" "}
        sol kuyruk (ani büyük kayıp) riskine işaret eder. <b>Basıklık&gt;0</b>{" "}
        kalın kuyruklar (fat tails). <b>CVaR %5:</b> en kötü %5&apos;lik ayların
        ortalama getirisi (beklenen kuyruk kaybı). <b>DD süre/toparlanma:</b> en
        derin düşüşün tepe→dip ve dip→eski zirve ay sayısı.
      </p>
    </>
  );
}

function RollingReturnsChart({ bt, label = "GEM" }: { bt: BacktestResult; label?: string }) {
  const gem = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  const g = gem?.growth;
  const WIN = 12;
  if (!g || g.length < WIN + 2) return null;

  const vals: { i: number; r: number }[] = [];
  for (let i = WIN; i < g.length; i++) vals.push({ i, r: g[i] / g[i - WIN] - 1 });
  if (!vals.length) return null;

  const W = 820;
  const H = 220;
  const padL = 52;
  const padR = 16;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = g.length;

  const rs = vals.map((v) => v.r);
  const yMin = Math.min(0, ...rs);
  const yMax = Math.max(0, ...rs);
  const ySpan = yMax - yMin || 1;
  const X = (i: number) => padL + (innerW * i) / Math.max(1, n - 1);
  const Y = (v: number) => padT + innerH * (1 - (v - yMin) / ySpan);

  const line = vals
    .map((v, k) => `${k === 0 ? "M" : "L"}${X(v.i).toFixed(1)},${Y(v.r).toFixed(1)}`)
    .join(" ");

  const yTicks: number[] = [];
  for (let p = Math.ceil(yMin * 5) / 5; p <= yMax; p += 0.2) yTicks.push(p);

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
        {label} 12-Ay Rolling Getiri — kayan 1 yıllık pencere getirisi
      </div>
      <div className="chart-help">
        Her nokta o aydan geriye 12 ayın getirisi. 0 çizgisinin altına inen
        bölgeler = GEM&apos;in 1 yıllık kayıpta olduğu dönemler (nadir ve sığ
        olması beklenir).
      </div>
      <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Finansal analiz grafiği; açıklama hemen üstteki başlık ve metinde">
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={Y(v)}
              y2={Y(v)}
              className={Math.abs(v) < 1e-9 ? "grid-line zero" : "grid-line"}
            />
            <text x={padL - 8} y={Y(v) + 3} className="axis-label" textAnchor="end">
              {(v * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        <path d={line} className="equity-line equity-hl" stroke="#22d3a6" />
        {shown.map((t, idx) => (
          <text key={idx} x={X(t.i)} y={H - 8} className="axis-label" textAnchor="middle">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function ScatterGemVsBench({ bt, label = "GEM" }: { bt: BacktestResult; label?: string }) {
  const gem = bt.equityCurves.find((c) => c.highlight);
  const bench =
    bt.equityCurves.find((c) => c.name.startsWith("S&P")) ??
    bt.equityCurves.find((c) => !c.highlight);
  if (!gem || !bench || gem.growth.length < 3) return null;

  const m = Math.min(gem.growth.length, bench.growth.length);
  const pts: { x: number; y: number }[] = [];
  for (let i = 1; i < m; i++) {
    pts.push({
      x: bench.growth[i] / bench.growth[i - 1] - 1,
      y: gem.growth[i] / gem.growth[i - 1] - 1,
    });
  }
  if (pts.length < 3) return null;

  const W = 460;
  const H = 380;
  const pad = 44;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;
  const lim =
    Math.max(...pts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y)))) * 1.05 ||
    0.1;
  const X = (v: number) => pad + innerW * ((v + lim) / (2 * lim));
  const Y = (v: number) => pad + innerH * (1 - (v + lim) / (2 * lim));

  const benchName = bench.name.replace(" (Al-Tut)", "");

  return (
    <div className="chart-card">
      <div className="chart-title">
        Aylık Getiri Dağılımı — {label} (y) vs {benchName} (x)
      </div>
      <div className="chart-help">
        Her nokta bir ay. Köşegen (kesikli) = eşit getiri. <b>Sol-alt
        çeyrekte</b> (ikisi de düşüşte) GEM noktalarının köşegenin{" "}
        <b>üstünde</b> kalması = GEM&apos;in düşüş aylarında daha az kaybetmesi
        (downside koruması).
      </div>
      <svg
        className="equity-svg scatter"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img" aria-label="Finansal analiz grafiği; açıklama hemen üstteki başlık ve metinde"
      >
        <line x1={X(0)} y1={pad} x2={X(0)} y2={H - pad} className="grid-line zero" />
        <line x1={pad} y1={Y(0)} x2={W - pad} y2={Y(0)} className="grid-line zero" />
        <line
          x1={X(-lim)}
          y1={Y(-lim)}
          x2={X(lim)}
          y2={Y(lim)}
          className="diag-line"
        />
        {pts.map((p, i) => (
          <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={2.6} className="scatter-dot" />
        ))}
        <text x={W - pad} y={Y(0) - 6} className="axis-label" textAnchor="end">
          {benchName} aylık →
        </text>
        <text x={X(0) + 6} y={pad + 4} className="axis-label" textAnchor="start">
          ↑ GEM aylık
        </text>
      </svg>
    </div>
  );
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function BoxPlot({ bt }: { bt: BacktestResult }) {
  const curves = bt.equityCurves;
  if (!curves?.length) return null;

  const stats = curves.map((c) => {
    const rets: number[] = [];
    for (let i = 1; i < c.growth.length; i++)
      rets.push(c.growth[i] / c.growth[i - 1] - 1);
    rets.sort((a, b) => a - b);
    return {
      name: c.name,
      hl: !!c.highlight,
      min: rets[0],
      q1: quantile(rets, 0.25),
      med: quantile(rets, 0.5),
      q3: quantile(rets, 0.75),
      max: rets[rets.length - 1],
    };
  });
  if (!stats.length) return null;

  const W = 820;
  const rowH = 34;
  const padL = 150;
  const padR = 20;
  const padT = 24;
  const padB = 28;
  const H = padT + padB + stats.length * rowH;
  const innerW = W - padL - padR;

  const lo = Math.min(...stats.map((s) => s.min));
  const hi = Math.max(...stats.map((s) => s.max));
  const span = hi - lo || 1;
  const X = (v: number) => padL + (innerW * (v - lo)) / span;

  const xTicks: number[] = [];
  for (let p = Math.ceil(lo * 10) / 10; p <= hi; p += 0.1) xTicks.push(p);

  return (
    <div className="chart-card">
      <div className="chart-title">
        Aylık Getiri Dağılımı (Box Plot) — kutu: Q1–Q3, çizgi: medyan, bıyık:
        min–max
      </div>
      <div className="chart-help">
        Her satır bir strateji. Kutu ne kadar <b>dar</b>sa aylık getiriler o
        kadar istikrarlı. Kutunun ve bıyıkların sola uzanması (negatif bölge) =
        kayıp ayların büyüklüğü. GEM&apos;in kutusunu hisse al-tut ile
        karşılaştır.
      </div>
      <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Finansal analiz grafiği; açıklama hemen üstteki başlık ve metinde">
        {xTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={X(v)}
              x2={X(v)}
              y1={padT - 6}
              y2={H - padB}
              className={Math.abs(v) < 1e-9 ? "grid-line zero" : "grid-line"}
            />
            <text x={X(v)} y={H - padB + 16} className="axis-label" textAnchor="middle">
              {(v * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        {stats.map((s, i) => {
          const cy = padT + i * rowH + rowH / 2;
          return (
            <g key={i} className={s.hl ? "box-hl" : ""}>
              <text x={padL - 10} y={cy + 3} className="axis-label" textAnchor="end">
                {s.name.replace(" (Al-Tut)", "").replace(" (Dual Momentum)", "")}
              </text>
              {/* bıyık */}
              <line x1={X(s.min)} x2={X(s.max)} y1={cy} y2={cy} className="box-whisker" />
              <line x1={X(s.min)} x2={X(s.min)} y1={cy - 5} y2={cy + 5} className="box-whisker" />
              <line x1={X(s.max)} x2={X(s.max)} y1={cy - 5} y2={cy + 5} className="box-whisker" />
              {/* kutu */}
              <rect
                x={X(s.q1)}
                y={cy - 9}
                width={Math.max(1, X(s.q3) - X(s.q1))}
                height={18}
                className="box-rect"
              />
              {/* medyan */}
              <line x1={X(s.med)} x2={X(s.med)} y1={cy - 9} y2={cy + 9} className="box-median" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FactorAlphaPanel({ fa, subject = "GEM" }: { fa: FactorAlpha; subject?: string }) {
  const sig = Math.abs(fa.alphaTStat) >= 2;
  return (
    <>
      <div className="section-label">
        Faktör-Model Alpha (Fama-French 3) — risk-ayarlı fazla getiri
      </div>
      <div className="chart-card">
        <div className="fa-grid">
          <div className="fa-cell fa-hero">
            <div className="fa-label">Yıllık Alpha (α)</div>
            <div className={`fa-big ${fa.alphaAnnual >= 0 ? "pos" : "neg"}`}>
              {pct(fa.alphaAnnual)}
            </div>
            <div className="fa-sub">
              t = {num(fa.alphaTStat, 2)}{" "}
              {sig ? "(anlamlı, |t|≥2)" : "(zayıf, |t|<2)"}
            </div>
          </div>
          <div className="fa-cell">
            <div className="fa-label">Market β (Mkt-RF)</div>
            <div className="fa-val">{num(fa.betaMkt, 2)}</div>
          </div>
          <div className="fa-cell">
            <div className="fa-label">Size β (SMB)</div>
            <div className="fa-val">{num(fa.betaSmb, 2)}</div>
          </div>
          <div className="fa-cell">
            <div className="fa-label">Value β (HML)</div>
            <div className="fa-val">{num(fa.betaHml, 2)}</div>
          </div>
          <div className="fa-cell">
            <div className="fa-label">R²</div>
            <div className="fa-val">{(fa.rSquared * 100).toFixed(0)}%</div>
          </div>
        </div>
        <p className="chart-help">
          {subject}&apos;in aylık fazla getirisi 3 faktöre regrese edildi (
          {fa.nMonths} ay). <b>Alpha&gt;0</b> = faktörlerle açıklanamayan,
          stratejiye özgü getiri (Antonacci&apos;nin asıl iddiası).{" "}
          <b>Market β</b> piyasa duyarlılığı; strateji nakde kaçtığı için tipik
          olarak 1&apos;in altındadır.{" "}
          <b>R²</b> getirinin ne kadarının faktörlerce açıklandığı. Kaynak:{" "}
          {fa.source}.
        </p>
      </div>
    </>
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
      <button
        className="howto-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
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

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="csec">
      <button
        className="csec-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className={`chevron ${open ? "up" : ""}`}>▾</span>
      </button>
      {open && <div className="csec-body">{children}</div>}
    </div>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; label?: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError)
      return (
        <div className="error-box">
          {this.props.label ?? "Bu bölüm"} gösterilemedi (beklenmedik veri).
          Diğer bölümler etkilenmedi; <b>Yenile</b>&apos;yi deneyebilirsin.
        </div>
      );
    return this.props.children;
  }
}

function LoadingSkeleton() {
  return (
    <div className="skel-wrap" aria-busy="true" aria-label="Analiz yükleniyor">
      <div className="skel-row">
        <div className="spinner" />
        <span>
          ~68 sembol + Fama-French faktörleri çekiliyor ve 5 evren + bileşik
          hesaplanıyor; ilk yükleme birkaç saniye sürebilir (sonra 10 dk
          önbellekte).
        </span>
      </div>
      <div className="skel hero-skel" />
      <div className="skel-grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skel card-skel" />
        ))}
      </div>
      <div className="skel block-skel" />
      <div className="skel block-skel" />
    </div>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 800);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      className="back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Sayfa başına dön"
      title="Başa dön"
    >
      ↑
    </button>
  );
}

function KeyInsights({ data }: { data: AnalysisResult }) {
  const insights: { icon: string; text: ReactNode }[] = [];

  // 1) En yüksek Sharpe strateji
  const strat: { name: string; emoji: string; sharpe: number }[] = [];
  if (data.backtest?.strategies[0]?.sharpe != null)
    strat.push({
      name: "GEM",
      emoji: "📊",
      sharpe: data.backtest.strategies[0].sharpe,
    });
  for (const u of data.universes)
    if (u.backtest?.strategies[0]?.sharpe != null)
      strat.push({
        name: u.positionLabel,
        emoji: u.emoji,
        sharpe: u.backtest.strategies[0].sharpe,
      });
  const best = strat.sort((a, b) => b.sharpe - a.sharpe)[0];
  if (best)
    insights.push({
      icon: "🏆",
      text: (
        <>
          En yüksek risk-ayarlı getiri:{" "}
          <b>
            {best.emoji} {best.name}
          </b>{" "}
          (Sharpe {best.sharpe.toFixed(2)}).
        </>
      ),
    });

  // 2) Bileşik performansı
  if (data.composite?.equityCurves[0] && data.composite.strategies[0]) {
    const g = data.composite.equityCurves[0].growth;
    const mult = g[g.length - 1];
    insights.push({
      icon: "🧩",
      text: (
        <>
          Eşit-ağırlık bileşik ortak dönemde ({data.composite.months} ay){" "}
          <b>{mult.toFixed(1)}×</b> büyüdü, Sharpe{" "}
          <b>{num(data.composite.strategies[0].sharpe)}</b> — tekil
          sleeve&apos;lerden genelde daha dengeli.
        </>
      ),
    });
  }

  // 3) Güncel savunma duruşu
  const cashUnis = data.universes.filter(
    (u) => u.momentum.stocks.filter((s) => s.selected).length === 0
  );
  const etfCash = data.gem.positionKey === "cash";
  const totalCash = cashUnis.length + (etfCash ? 1 : 0);
  const totalUni = data.universes.length + 1;
  insights.push({
    icon: totalCash > 0 ? "⚠️" : "✅",
    text:
      totalCash > 0 ? (
        <>
          <b>
            {totalCash}/{totalUni}
          </b>{" "}
          evren şu an nakitte (mutlak momentum negatif) — savunmacı duruş.
        </>
      ) : (
        <>
          <b>Tüm evrenler yatırımda</b> — mutlak momentum her yerde pozitif, risk
          iştahı açık.
        </>
      ),
  });

  // 4) En iyi çeşitlendirici (en düşük ortalama korelasyonlu sleeve)
  if (data.composite) {
    const sl = data.composite.equityCurves.filter(
      (c) => !c.highlight && !c.name.includes("Bileşik")
    );
    if (sl.length >= 3) {
      const rets = sl.map((c) => {
        return growthToRets(c.growth);
      });
      const avg = rets.map((a, i) => {
        let s = 0;
        let n = 0;
        rets.forEach((b, j) => {
          if (i !== j) {
            s += pearson(a, b);
            n++;
          }
        });
        return n ? s / n : 0;
      });
      let minI = 0;
      for (let i = 1; i < avg.length; i++) if (avg[i] < avg[minI]) minI = i;
      insights.push({
        icon: "🔗",
        text: (
          <>
            En iyi çeşitlendirici:{" "}
            <b>{sl[minI].name.replace(/\s*\(.*\)/, "")}</b> (diğer sleeve&apos;lerle
            ortalama korelasyon {avg[minI].toFixed(2)}) — bileşiğe en çok risk
            dağıtan evren.
          </>
        ),
      });
    }
  }

  if (!insights.length) return null;
  return (
    <div className="insights">
      <div className="insights-title">⚡ Öne Çıkanlar</div>
      <ul>
        {insights.map((it, i) => (
          <li key={i}>
            <span className="ins-icon">{it.icon}</span>
            {it.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConsolidatedSignals({ data }: { data: AnalysisResult }) {
  const gem = data.gem;
  const etfCash = gem.positionKey === "cash";
  return (
    <>
      <div className="section-label">
        Bu Ayın Sinyalleri — tüm evrenlerde güncel pozisyonlar
      </div>
      <div className="signals-grid">
        <div className="sig-card">
          <div className="sig-head">📊 ETF (GEM)</div>
          <div className="sig-picks">
            <span className={`pick ${etfCash ? "pick-cash" : ""}`}>
              {gem.positionName}
            </span>
          </div>
          <div className="sig-foot">
            {etfCash ? "Riskten kaç (nakit)" : "Hissede kal"}
          </div>
        </div>
        {data.universes.map((u) => {
          const picks = u.momentum.stocks.filter((s) => s.selected);
          return (
            <div className="sig-card" key={u.id}>
              <div className="sig-head">
                {u.emoji} {u.label}
              </div>
              <div className="sig-picks">
                {picks.length ? (
                  picks.map((p) => (
                    <span className="pick" key={p.key} title={p.name}>
                      {p.ticker}
                    </span>
                  ))
                ) : (
                  <span className="pick pick-cash">Nakit</span>
                )}
              </div>
              <div className="sig-foot">
                {picks.length
                  ? `Top-${u.momentum.topN} momentum seçimi`
                  : "Hiçbiri T-Bill'i geçemedi"}
              </div>
            </div>
          );
        })}
      </div>
      <p className="table-note">
        Her evren için bu ay sonu itibarıyla dual momentum (göreceli + mutlak)
        seçimi. Backtest stüdyosundan farklı look-back denemek için yukarıyı
        kullan; bu kartlar kitap-standardı 12 aya dayanır.
      </p>
    </>
  );
}

function StrategyLeaderboard({ data }: { data: AnalysisResult }) {
  const [sortKey, setSortKey] = useState<keyof StrategyMetrics>("sharpe");
  type Row = {
    name: string;
    emoji: string;
    m: StrategyMetrics;
    period: string;
    months: number;
  };
  const rows: Row[] = [];
  if (data.backtest?.strategies[0]) {
    rows.push({
      name: data.backtest.strategies[0].name,
      emoji: "📊",
      m: data.backtest.strategies[0],
      period: `${data.backtest.startDate} → ${data.backtest.endDate}`,
      months: data.backtest.months,
    });
  }
  for (const u of data.universes) {
    if (u.backtest?.strategies[0]) {
      rows.push({
        name: u.backtest.strategies[0].name,
        emoji: u.emoji,
        m: u.backtest.strategies[0],
        period: `${u.backtest.startDate} → ${u.backtest.endDate}`,
        months: u.backtest.months,
      });
    }
  }
  if (data.composite?.strategies[0]) {
    rows.push({
      name: data.composite.strategies[0].name,
      emoji: "🧩",
      m: data.composite.strategies[0],
      period: `${data.composite.startDate} → ${data.composite.endDate}`,
      months: data.composite.months,
    });
  }
  if (rows.length < 2) return null;
  const sval = (m: StrategyMetrics) => {
    const v = m[sortKey];
    return typeof v === "number" && isFinite(v) ? v : -Infinity;
  };
  rows.sort((a, b) => sval(b.m) - sval(a.m));

  const SortableTh = ({
    label,
    k,
    left,
  }: {
    label: string;
    k: keyof StrategyMetrics;
    left?: boolean;
  }) => (
    <th
      className={`sortable ${left ? "left" : ""} ${sortKey === k ? "sorted" : ""}`}
      onClick={() => setSortKey(k)}
    >
      {label}
      {sortKey === k ? " ▾" : ""}
    </th>
  );

  return (
    <>
      <div className="section-label">
        Strateji Karşılaştırma — tüm evrenlerin momentum stratejileri (sütun
        başlığına tıkla → sırala)
      </div>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Strateji</th>
              <SortableTh label="CAGR" k="cagr" />
              <SortableTh label="Sharpe" k="sharpe" />
              <SortableTh label="Sortino" k="sortino" />
              <SortableTh label="Max DD" k="maxDrawdown" />
              <SortableTh label="Toplam Getiri" k="totalReturn" />
              <SortableTh label="Yıllık Geçiş" k="switchesPerYear" />
              <th className="left">Dönem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i === 0 ? "row-hl" : ""}>
                <td className="rank">{i + 1}</td>
                <td className="left">
                  {r.emoji} {r.name}
                </td>
                <td>{pct(r.m.cagr)}</td>
                <td className="strong">{num(r.m.sharpe)}</td>
                <td>{num(r.m.sortino)}</td>
                <td className="neg">{pct(r.m.maxDrawdown)}</td>
                <td>{pct(r.m.totalReturn, 0)}</td>
                <td>
                  {r.m.switchesPerYear != null
                    ? num(r.m.switchesPerYear)
                    : "—"}
                </td>
                <td className="left period-cell">
                  {r.period} ({r.months} ay)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        ⚠️ Dönemler farklı (her evrenin ortak veri geçmişi farklı başlar) — Sharpe
        gibi risk-ayarlı oranlar daha adil kıyas sağlar, ama mutlak getiriler
        doğrudan karşılaştırılamaz. Her strateji kendi evreninin eşit-ağırlık
        al-tut benchmark'ını ilgili sekmede görebilirsin.
      </p>
    </>
  );
}

function MomentumValueAdd({ data }: { data: AnalysisResult }) {
  type Row = {
    label: string;
    emoji: string;
    mom: StrategyMetrics;
    bench: StrategyMetrics;
  };
  const rows: Row[] = [];
  const add = (label: string, emoji: string, bt: BacktestResult | null) => {
    if (!bt || bt.strategies.length < 2) return;
    const mom = bt.strategies[0];
    const bench =
      bt.strategies.find((s) => s.name.includes("Eşit Ağırlık")) ??
      bt.strategies[bt.strategies.length - 1];
    if (mom && bench) rows.push({ label, emoji, mom, bench });
  };
  add("ETF (GEM)", "📊", data.backtest);
  for (const u of data.universes) add(u.label, u.emoji, u.backtest);
  if (rows.length < 2) return null;

  const wins = rows.filter(
    (r) => (r.mom.cagr ?? 0) > (r.bench.cagr ?? 0)
  ).length;

  return (
    <>
      <div className="section-label">
        Momentum Al-Tut&apos;u Yeniyor mu? — her evrende momentum vs eşit-ağırlık
        al-tut
      </div>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th className="left">Evren</th>
              <th>Momentum CAGR</th>
              <th>Al-Tut CAGR</th>
              <th>CAGR Farkı</th>
              <th>Momentum Sharpe</th>
              <th>Al-Tut Sharpe</th>
              <th>Sharpe Farkı</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const dC = (r.mom.cagr ?? 0) - (r.bench.cagr ?? 0);
              const dS = (r.mom.sharpe ?? 0) - (r.bench.sharpe ?? 0);
              return (
                <tr key={i}>
                  <td className="left">
                    {r.emoji} {r.label}
                  </td>
                  <td>{pct(r.mom.cagr)}</td>
                  <td>{pct(r.bench.cagr)}</td>
                  <td className={dC >= 0 ? "pos-cell" : "neg"}>
                    {dC >= 0 ? "+" : ""}
                    {pct(dC)}
                  </td>
                  <td>{num(r.mom.sharpe)}</td>
                  <td>{num(r.bench.sharpe)}</td>
                  <td className={dS >= 0 ? "pos-cell strong" : "neg strong"}>
                    {dS >= 0 ? "+" : ""}
                    {num(dS)}
                  </td>
                </tr>
              );
            })}
            {(() => {
              const avgC =
                rows.reduce(
                  (s, r) => s + ((r.mom.cagr ?? 0) - (r.bench.cagr ?? 0)),
                  0
                ) / rows.length;
              const avgS =
                rows.reduce(
                  (s, r) => s + ((r.mom.sharpe ?? 0) - (r.bench.sharpe ?? 0)),
                  0
                ) / rows.length;
              return (
                <tr className="row-hl">
                  <td className="left">
                    <b>Ortalama ({rows.length} evren)</b>
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td className={avgC >= 0 ? "pos-cell strong" : "neg strong"}>
                    {avgC >= 0 ? "+" : ""}
                    {pct(avgC)}
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td className={avgS >= 0 ? "pos-cell strong" : "neg strong"}>
                    {avgS >= 0 ? "+" : ""}
                    {num(avgS)}
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        Dual momentum&apos;un asıl iddiası: aynı varlıkları al-tut etmekten daha
        iyi risk-ayarlı getiri. Şu an <b>{wins}/{rows.length}</b> evrende momentum
        al-tut&apos;u CAGR&apos;da geçiyor; <b>Sharpe farkı</b> (pozitif = momentum
        kazanıyor) risk-ayarlı katma değeri gösterir — düşüş korumasının asıl
        faydası burada görülür.
      </p>
    </>
  );
}

function CrossUniverseComparison({ data }: { data: AnalysisResult }) {
  type Ser = {
    label: string;
    emoji: string;
    map: Map<string, number>;
    dates: string[];
  };
  const series: Ser[] = [];
  const add = (label: string, emoji: string, bt: BacktestResult | null) => {
    if (!bt) return;
    const curve = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
    if (!curve) return;
    const map = new Map<string, number>();
    const dts: string[] = [];
    for (let i = 0; i < bt.dates.length && i < curve.growth.length; i++) {
      const ym = bt.dates[i].slice(0, 7);
      map.set(ym, curve.growth[i]);
      dts.push(ym);
    }
    series.push({ label, emoji, map, dates: dts });
  };
  add("GEM (Dual Momentum)", "📊", data.backtest);
  for (const u of data.universes) add(u.positionLabel, u.emoji, u.backtest);
  add("Bileşik (eşit ağırlık)", "🧩", data.composite);
  if (series.length < 2) return null;

  // Ortak ay aralığı (tüm serilerin kesişimi)
  const common = series[0].dates
    .filter((d) => series.every((s) => s.map.has(d)))
    .sort();
  if (common.length < 13) return null;

  const lines = series.map((s, idx) => {
    const base = s.map.get(common[0]) as number;
    const growth = common.map((d) => (s.map.get(d) as number) / base);
    const finalMult = growth[growth.length - 1];
    const cagr = Math.pow(finalMult, 12 / (common.length - 1)) - 1;
    return {
      label: s.label,
      emoji: s.emoji,
      growth,
      finalMult,
      cagr,
      color: s.label.includes("Bileşik")
        ? "#22d3a6"
        : CURVE_COLORS[idx % CURVE_COLORS.length],
    };
  });

  const W = 820;
  const H = 340;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = common.length;

  let lo = Infinity;
  let hi = -Infinity;
  for (const l of lines)
    for (const v of l.growth) {
      if (v > 0 && v < lo) lo = v;
      if (v > hi) hi = v;
    }
  if (!isFinite(lo) || lo <= 0) return null;
  const logLo = Math.log10(lo);
  const span = Math.log10(hi) - logLo || 1;
  const X = (i: number) => padL + (innerW * i) / Math.max(1, n - 1);
  const Y = (v: number) =>
    padT + innerH * (1 - (Math.log10(Math.max(v, lo)) - logLo) / span);

  const yTicks: number[] = [];
  for (let e = Math.floor(logLo); e <= Math.ceil(Math.log10(hi)); e++)
    for (const m of [1, 2, 5]) {
      const val = m * Math.pow(10, e);
      if (val >= lo * 0.95 && val <= hi * 1.05) yTicks.push(val);
    }

  const xTicks: { i: number; label: string }[] = [];
  let lastYear = "";
  common.forEach((d, i) => {
    const yr = d.slice(0, 4);
    if (yr !== lastYear) {
      xTicks.push({ i, label: yr });
      lastYear = yr;
    }
  });
  const step = Math.ceil(xTicks.length / 10);
  const shown = xTicks.filter((_, idx) => idx % step === 0);

  return (
    <>
      <div className="section-label">
        Ortak-Dönem Karşılaştırması — tüm stratejiler aynı zaman ekseninde (1$
        → büyüme, log ölçek)
      </div>
      <div className="chart-card">
        <div className="chart-help">
          Tüm evrenlerin momentum stratejileri <b>ortak veri aralığında</b> (
          {common[0]} → {common[n - 1]}, {n} ay) 1$&apos;dan başlatılıp yeniden
          normalize edildi — böylece leaderboard&apos;ın aksine{" "}
          <b>doğrudan ve adil</b> karşılaştırılabilirler. En genç evren (kripto)
          başlangıcı dönemi belirler.
        </div>
        <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Finansal analiz grafiği; açıklama hemen üstteki başlık ve metinde">
          {yTicks.map((v, i) => (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={Y(v)}
                y2={Y(v)}
                className="grid-line"
              />
              <text
                x={padL - 8}
                y={Y(v) + 3}
                className="axis-label"
                textAnchor="end"
              >
                {v}×
              </text>
            </g>
          ))}
          {shown.map((t, i) => (
            <text
              key={i}
              x={X(t.i)}
              y={H - 8}
              className="axis-label"
              textAnchor="middle"
            >
              {t.label}
            </text>
          ))}
          {lines.map((l) => (
            <path
              key={l.label}
              d={l.growth
                .map(
                  (v, i) =>
                    `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`
                )
                .join(" ")}
              className="equity-line"
              stroke={l.label.includes("Bileşik") ? "#22d3a6" : l.color}
              style={{ strokeWidth: l.label.includes("Bileşik") ? 3.5 : 2 }}
            />
          ))}
        </svg>
        <div className="chart-legend">
          {lines
            .slice()
            .sort((a, b) => b.finalMult - a.finalMult)
            .map((l) => (
              <span className="legend-item" key={l.label}>
                <span
                  className="legend-swatch"
                  style={{ background: l.color }}
                />
                {l.emoji} {l.label}
                <b className="legend-val">
                  {l.finalMult.toFixed(1)}× · CAGR {pct(l.cagr)}
                </b>
              </span>
            ))}
        </div>
      </div>
    </>
  );
}

function RollingVol({ bt, label }: { bt: BacktestResult; label: string }) {
  const curve = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  const g = curve?.growth;
  if (!g || g.length < 26) return null;
  const rets = growthToRets(g);
  const WIN = 12;
  const vals: { i: number; v: number }[] = [];
  for (let i = WIN; i <= rets.length; i++) {
    const w = rets.slice(i - WIN, i);
    const m = w.reduce((s, x) => s + x, 0) / WIN;
    const variance = w.reduce((s, x) => s + (x - m) ** 2, 0) / (WIN - 1);
    vals.push({ i, v: Math.sqrt(variance) * Math.sqrt(12) });
  }
  if (vals.length < 2) return null;

  const W = 820;
  const H = 200;
  const padL = 46;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = g.length;
  const hi = Math.max(...vals.map((p) => p.v)) * 1.05 || 0.1;
  const X = (i: number) => padL + (innerW * i) / Math.max(1, n - 1);
  const Y = (v: number) => padT + innerH * (1 - v / hi);
  const line = vals
    .map((p, k) => `${k === 0 ? "M" : "L"}${X(p.i).toFixed(1)},${Y(p.v).toFixed(1)}`)
    .join(" ");

  const yTicks: number[] = [];
  for (let v = 0; v <= hi; v += 0.1) yTicks.push(v);
  const xTicks: { i: number; label: string }[] = [];
  let ly = "";
  bt.dates.forEach((d, i) => {
    const y = d.slice(0, 4);
    if (y !== ly) {
      xTicks.push({ i, label: y });
      ly = y;
    }
  });
  const step = Math.ceil(xTicks.length / 10);
  const shown = xTicks.filter((_, idx) => idx % step === 0);

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} 12-Ay Rolling Volatilite — risk rejiminin zaman içindeki seyri
      </div>
      <div className="chart-help">
        Her nokta o aydan geriye 12 ayın yıllıklaştırılmış oynaklığı. Tepe noktalar
        = stratejinin en riskli olduğu dönemler (örn. kriz/çöküş); düşük platolar =
        sakin rejimler.
      </div>
      <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Finansal analiz grafiği; açıklama hemen üstteki başlık ve metinde">
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} className="grid-line" />
            <text x={padL - 8} y={Y(v) + 3} className="axis-label" textAnchor="end">
              {(v * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        <path d={line} className="equity-line" stroke="#f59e0b" style={{ strokeWidth: 1.8 }} />
        {shown.map((t, idx) => (
          <text key={idx} x={X(t.i)} y={H - 8} className="axis-label" textAnchor="middle">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Seasonality({ bt, label }: { bt: BacktestResult; label: string }) {
  const curve = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  const g = curve?.growth;
  const dates = bt.dates;
  if (!g || g.length < 25) return null; // ~2 yıl minimum

  const sums = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  for (let i = 1; i < g.length && i < dates.length; i++) {
    const m = +dates[i].slice(5, 7) - 1;
    if (m >= 0 && m < 12) {
      sums[m] += g[i] / g[i - 1] - 1;
      counts[m]++;
    }
  }
  const avg = sums.map((s, i) => (counts[i] ? s / counts[i] : null));
  const vals = avg.filter((v): v is number => v != null);
  if (vals.length < 6) return null;
  const maxAbs = Math.max(...vals.map((v) => Math.abs(v)), 0.001);

  const W = 820;
  const H = 180;
  const padL = 36;
  const padR = 12;
  const padT = 14;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const mid = padT + innerH / 2;
  const bw = innerW / 12;
  const MONTHS = ["O", "Ş", "M", "N", "May", "H", "T", "A", "Ey", "Ek", "K", "Ar"];

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} Mevsimsellik — takvim ayına göre ortalama aylık getiri
      </div>
      <div className="chart-help">
        Her sütun, o takvim ayının (tüm yıllar ortalaması) tipik getirisi. Momentum
        stratejilerinde mevsimsel desen genelde zayıftır; istatistiksel olarak
        anlamlı olması için uzun geçmiş gerekir.
      </div>
      <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Finansal analiz grafiği; açıklama hemen üstteki başlık ve metinde">
        <line x1={padL} x2={W - padR} y1={mid} y2={mid} className="grid-line zero" />
        {avg.map((v, i) => {
          if (v == null) return null;
          const h = (Math.abs(v) / maxAbs) * (innerH / 2);
          const x = padL + i * bw + bw * 0.18;
          const bwid = bw * 0.64;
          const y = v >= 0 ? mid - h : mid;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={bwid}
                height={Math.max(1, h)}
                className={v >= 0 ? "seas-pos" : "seas-neg"}
              />
              <text x={x + bwid / 2} y={H - 14} className="axis-label" textAnchor="middle">
                {MONTHS[i]}
              </text>
              <text
                x={x + bwid / 2}
                y={v >= 0 ? y - 3 : y + h + 10}
                className="axis-label"
                textAnchor="middle"
              >
                {(v * 100).toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DrawdownEpisodes({ bt, label }: { bt: BacktestResult; label: string }) {
  const curve = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  const g = curve?.growth;
  const dates = bt.dates;
  if (!g || g.length < 3) return null;

  type Cur = {
    peakIdx: number;
    peakVal: number;
    troughIdx: number;
    troughVal: number;
    recIdx: number | null;
  };
  const eps: Cur[] = [];
  let peak = g[0];
  let peakIdx = 0;
  let cur: Cur | null = null;
  for (let i = 1; i < g.length; i++) {
    if (g[i] >= peak) {
      if (cur) {
        cur.recIdx = i;
        eps.push(cur);
        cur = null;
      }
      peak = g[i];
      peakIdx = i;
    } else if (!cur) {
      cur = { peakIdx, peakVal: peak, troughIdx: i, troughVal: g[i], recIdx: null };
    } else if (g[i] < cur.troughVal) {
      cur.troughIdx = i;
      cur.troughVal = g[i];
    }
  }
  if (cur) eps.push(cur);

  const ym = (i: number) => dates[i]?.slice(0, 7) ?? "—";
  const rows = eps
    .map((e) => ({
      depth: e.troughVal / e.peakVal - 1,
      peak: ym(e.peakIdx),
      trough: ym(e.troughIdx),
      rec: e.recIdx != null ? ym(e.recIdx) : null,
      ddM: e.troughIdx - e.peakIdx,
      recM: e.recIdx != null ? e.recIdx - e.troughIdx : null,
    }))
    .sort((a, b) => a.depth - b.depth)
    .slice(0, 5);
  if (!rows.length) return null;

  return (
    <>
      <div className="section-label">
        {label} — En Kötü 5 Drawdown Epizodu (derinlik · süre · toparlanma)
      </div>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th>#</th>
              <th>Derinlik</th>
              <th className="left">Tepe</th>
              <th className="left">Dip</th>
              <th className="left">Toparlanma</th>
              <th>Düşüş (ay)</th>
              <th>Toparlanma (ay)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i === 0 ? "row-hl" : ""}>
                <td className="rank">{i + 1}</td>
                <td className="neg strong">{pct(r.depth)}</td>
                <td className="left period-cell">{r.peak}</td>
                <td className="left period-cell">{r.trough}</td>
                <td className="left period-cell">
                  {r.rec ?? (
                    <span className="neg">sürüyor</span>
                  )}
                </td>
                <td>{r.ddM}</td>
                <td>
                  {r.recM != null ? (
                    r.recM
                  ) : (
                    <span className="neg">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        Her epizod: yeni zirveden başlayıp dibe inen ve (varsa) eski zirveye dönen
        kayıp dönemi. Düşüş süresi = tepe→dip, toparlanma süresi = dip→eski zirve.
        &quot;Sürüyor&quot; = henüz toparlanmamış aktif drawdown.
      </p>
    </>
  );
}

function CompositeHoldings({ data }: { data: AnalysisResult }) {
  const sleeves = 1 + data.universes.length;
  const w = 1 / sleeves;
  const map = new Map<string, { label: string; weight: number }>();
  let cash = 0;
  const addH = (key: string, label: string, wt: number) => {
    const cur = map.get(key);
    if (cur) cur.weight += wt;
    else map.set(key, { label, weight: wt });
  };

  // ETF / GEM (tek varlık)
  const gemTick: Record<string, string> = { spy: "SPY", qqq: "QQQ", gld: "GLD" };
  if (data.gem.positionKey === "cash") cash += w;
  else {
    const tk = gemTick[data.gem.positionKey] ?? data.gem.positionKey.toUpperCase();
    addH(tk, `${data.gem.positionName} (${tk})`, w);
  }

  // Evrenler
  for (const u of data.universes) {
    const picks = u.momentum.stocks.filter((s) => s.selected);
    if (picks.length === 0) cash += w;
    else {
      const each = w / picks.length;
      for (const p of picks) addH(p.ticker, `${p.name} (${p.ticker})`, each);
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => b.weight - a.weight);
  if (!rows.length && cash >= 0.999) {
    // tamamen nakit
  }

  const downloadCsv = () => {
    const lines = ["Varlik,Agirlik_Yuzde"];
    for (const r of rows)
      lines.push(`"${r.label}",${(r.weight * 100).toFixed(2)}`);
    if (cash > 0.0001)
      lines.push(`"Nakit (T-Bill)",${(cash * 100).toFixed(2)}`);
    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bilesik-alim-listesi.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="chart-card">
      <div className="chart-title chart-title-row">
        <span>🛒 Bileşiği Bu Ay Replike Et — eşit-ağırlık hedef portföy</span>
        <button className="mini-btn" onClick={downloadCsv} title="Alım listesini CSV indir">
          ⭳ CSV
        </button>
      </div>
      <div className="chart-help">
        Her sleeve (ETF + {data.universes.length} evren) bileşikte %
        {(w * 100).toFixed(1)} pay alır; yatırımdaki sleeve&apos;in payı seçili
        varlıklara eşit bölünür, nakitteki sleeve T-Bill&apos;de durur. Aşağıdaki
        ağırlıklar bileşiğin <b>bu ayki hedef portföyüdür</b>.
      </div>
      <div className="rpw-list">
        {rows.map((r) => (
          <div className="rpw-row" key={r.label}>
            <div className="rpw-name">{r.label}</div>
            <div className="rpw-bar">
              <div
                className="rpw-fill"
                style={{ width: `${Math.min(100, r.weight * 100).toFixed(1)}%` }}
              />
            </div>
            <div className="rpw-val">%{(r.weight * 100).toFixed(1)}</div>
            <div className="rpw-vol" />
          </div>
        ))}
        {cash > 0.0001 && (
          <div className="rpw-row">
            <div className="rpw-name">💵 Nakit (T-Bill)</div>
            <div className="rpw-bar">
              <div
                className="rpw-fill cash"
                style={{ width: `${Math.min(100, cash * 100).toFixed(1)}%` }}
              />
            </div>
            <div className="rpw-val">%{(cash * 100).toFixed(1)}</div>
            <div className="rpw-vol" />
          </div>
        )}
      </div>
    </div>
  );
}

function CompositeStance({ data }: { data: AnalysisResult }) {
  const total = 1 + data.universes.length;
  const invested: string[] = [];
  const cash: string[] = [];
  (data.gem.positionKey === "cash" ? cash : invested).push("📊 ETF");
  for (const u of data.universes) {
    const inv = u.momentum.stocks.some((s) => s.selected);
    (inv ? invested : cash).push(`${u.emoji} ${u.label}`);
  }
  const ratio = total > 0 ? invested.length / total : 0;
  return (
    <div className="stance">
      <div className="stance-row">
        <div className="stance-bar">
          <div
            className="stance-fill"
            style={{ width: `${(ratio * 100).toFixed(0)}%` }}
          />
        </div>
        <div className="stance-pct">%{(ratio * 100).toFixed(0)}</div>
      </div>
      <div className="stance-text">
        Bu ay bileşik <b>{invested.length}/{total}</b> sleeve&apos;de yatırımda.{" "}
        {cash.length > 0 ? (
          <>
            Nakitte: <b>{cash.join(", ")}</b> — bu sleeve&apos;lerin payı
            bileşikte T-Bill&apos;de duruyor (savunma).
          </>
        ) : (
          <>Tüm sleeve&apos;ler yatırımda — bileşik tam risk-on.</>
        )}
      </div>
    </div>
  );
}

function RiskParityWeights({ bt }: { bt: BacktestResult }) {
  const sleeves = bt.equityCurves.filter(
    (c) => !c.highlight && !c.name.includes("Bileşik")
  );
  if (sleeves.length < 2) return null;
  const items = sleeves.map((c) => {
    const r: number[] = [];
    for (let i = 1; i < c.growth.length; i++)
      r.push(c.growth[i] / c.growth[i - 1] - 1);
    const n = r.length;
    const mean = r.reduce((s, v) => s + v, 0) / Math.max(1, n);
    const variance =
      n > 1 ? r.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
    const vol = Math.sqrt(variance) * Math.sqrt(12);
    return { name: c.name, vol };
  });
  const invs = items.map((x) => (x.vol > 0 ? 1 / x.vol : 0));
  const tot = invs.reduce((s, v) => s + v, 0);
  if (tot <= 0) return null;
  const rows = items
    .map((x, i) => ({ ...x, w: invs[i] / tot }))
    .sort((a, b) => b.w - a.w);

  return (
    <>
      <div className="section-label">
        Risk-Parity Ağırlıkları — bileşikte her sleeve&apos;in ters-volatilite payı
      </div>
      <div className="chart-card">
        <div className="rpw-list">
          {rows.map((r) => (
            <div className="rpw-row" key={r.name}>
              <div className="rpw-name">
                {r.name.replace(/\s*\(.*\)/, "")}
              </div>
              <div className="rpw-bar">
                <div
                  className="rpw-fill"
                  style={{ width: `${(r.w * 100).toFixed(1)}%` }}
                />
              </div>
              <div className="rpw-val">%{(r.w * 100).toFixed(1)}</div>
              <div className="rpw-vol">σ {pct(r.vol)}</div>
            </div>
          ))}
        </div>
        <p className="table-note">
          Risk-parity bileşik her sleeve&apos;e oynaklığıyla <b>ters orantılı</b>{" "}
          ağırlık verir (w = (1/σ)/Σ(1/σ)). Yüksek oynaklıklı sleeve&apos;ler
          (genelde kripto) otomatik daha az pay alır → dengeli risk katkısı,
          eşit-ağırlık bileşiğin kripto-baskınlığını giderir.
        </p>
      </div>
    </>
  );
}

function DiversificationStat({ bt }: { bt: BacktestResult }) {
  const comp = bt.strategies.find((s) => s.name.includes("eşit ağırlık"));
  const sleeves = bt.strategies.filter((s) => !s.name.includes("Bileşik"));
  if (!comp?.annualVol || sleeves.length < 2) return null;
  const sleeveVols = sleeves
    .map((s) => s.annualVol)
    .filter((v): v is number => v != null);
  if (!sleeveVols.length) return null;
  const avgVol = sleeveVols.reduce((s, v) => s + v, 0) / sleeveVols.length;
  if (avgVol <= 0) return null;
  const reduction = 1 - comp.annualVol / avgVol;
  return (
    <div className="divstat">
      <div className="divstat-big">{pct(reduction, 0)}</div>
      <div className="divstat-text">
        <b>Çeşitlendirme faydası</b> — eşit-ağırlık bileşiğin yıllık oynaklığı (
        {pct(comp.annualVol)}) sleeve&apos;lerin ortalama oynaklığından (
        {pct(avgVol)}) <b>{pct(reduction, 0)}</b> daha düşük. İmperfect
        korelasyonlu stratejileri birleştirmenin somut riski-azaltma getirisi.
      </div>
    </div>
  );
}

function CorrelationMatrix({ bt }: { bt: BacktestResult }) {
  const sleeves = bt.equityCurves.filter(
    (c) => !c.highlight && !c.name.includes("Bileşik")
  );
  if (sleeves.length < 2) return null;
  const rets = sleeves.map((c) => {
    return growthToRets(c.growth);
  });
  const labels = sleeves.map((s) => s.name);
  const k = sleeves.length;
  const matrix = rets.map((a) => rets.map((b) => pearson(a, b)));
  const avgOff =
    matrix
      .flatMap((row, i) => row.filter((_, j) => i !== j))
      .reduce((s, v) => s + v, 0) /
    Math.max(1, k * (k - 1));

  // Çeşitlendirme için DÜŞÜK korelasyon iyi: ~0/negatif yeşil, →1 kırmızı.
  const cColor = (c: number) => {
    const t = Math.max(0, Math.min(1, c)); // 0..1 (negatifler en yeşil)
    if (c <= 0) return "rgba(34,211,166,0.28)";
    return `rgba(239,68,68,${(0.1 + 0.5 * t).toFixed(3)})`;
  };

  return (
    <>
      <div className="section-label">
        Sleeve Korelasyon Matrisi — bileşiğin çeşitlendirme temeli (düşük =
        daha iyi)
      </div>
      <div className="chart-card">
        <div className="table-scroll">
          <table className="heatmap corr">
            <thead>
              <tr>
                <th className="hm-year"></th>
                {labels.map((l, j) => (
                  <th key={j}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={i}>
                  <td className="hm-year">{labels[i]}</td>
                  {row.map((c, j) => (
                    <td
                      key={j}
                      style={{
                        background: i === j ? "var(--border-soft)" : cColor(c),
                      }}
                    >
                      {c.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-note">
          Sleeve&apos;lerin aylık getirileri arası Pearson korelasyonu (ortak
          dönem). Ortalama çapraz-korelasyon <b>{avgOff.toFixed(2)}</b> — 1&apos;e
          ne kadar uzaksa çeşitlendirme o kadar güçlü, bileşiğin oynaklık-azaltma
          faydası o kadar yüksek. Kripto genelde en düşük korelasyonlu (en iyi
          çeşitlendirici) sleeve&apos;dir.
        </p>
      </div>
    </>
  );
}

const STUDIO_LB = [1, 3, 6, 9, 12, 18, 24];
const STUDIO_TOPN = [1, 2, 3, 5, 8, 10];
const STUDIO_COST = [0, 10, 25, 50];
const STUDIO_UNIVERSES = [
  { id: "etf", label: "ETF (GEM)" },
  { id: "stock", label: "Hisse" },
  { id: "crypto", label: "Kripto" },
  { id: "sector", label: "Sektör" },
  { id: "intl", label: "Uluslararası" },
];

interface StudioResult {
  backtest: BacktestResult | null;
  label: string;
  lookback: number;
  topN: number;
  cost: number;
  universe: string;
}

function BacktestStudio() {
  const [uni, setUni] = useState("etf");
  const [lb, setLb] = useState(12);
  const [topN, setTopN] = useState(5);
  const [cost, setCost] = useState(0);
  const [res, setRes] = useState<StudioResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // URL'den başlangıç parametreleri (paylaşılabilir stüdyo durumu)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const u = sp.get("su");
    if (u) setUni(u);
    const l = Number(sp.get("slb"));
    if (l) setLb(l);
    const t = Number(sp.get("stn"));
    if (t) setTopN(t);
    const c = sp.get("scost");
    if (c != null) setCost(Number(c) || 0);
  }, []);

  useEffect(() => {
    let cancel = false;
    setBusy(true);
    setErr(null);
    // Parametreleri URL'ye yansıt (link paylaşılabilir, hash korunur)
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      sp.set("su", uni);
      sp.set("slb", String(lb));
      sp.set("stn", String(topN));
      sp.set("scost", String(cost));
      window.history.replaceState(
        null,
        "",
        `?${sp.toString()}${window.location.hash}`
      );
    }
    const base =
      uni === "etf"
        ? `universe=etf&lookback=${lb}`
        : `universe=${uni}&lookback=${lb}&topN=${topN}`;
    const q = `${base}&cost=${cost}`;
    fetch(`/api/backtest?${q}`, { cache: "no-store" })
      .then((r) =>
        r.ok
          ? r.json()
          : r
              .json()
              .catch(() => ({}))
              .then((b) =>
                Promise.reject(
                  new Error(b.detail || b.error || `HTTP ${r.status}`)
                )
              )
      )
      .then((d) => {
        if (!cancel) setRes(d as StudioResult);
      })
      .catch((e) => {
        if (!cancel) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancel) setBusy(false);
      });
    return () => {
      cancel = true;
    };
  }, [uni, lb, topN, cost]);

  const bt = res?.backtest ?? null;
  const isEtf = uni === "etf";

  return (
    <div className="studio">
      <div className="studio-head">
        <div className="studio-head-text">
          <span className="studio-title">🎛️ Backtest Stüdyosu</span>
          <span className="studio-sub">
            Parametreleri değiştir — sonuç anında yeniden hesaplanır (sayfanın
            geri kalanı kitap-standardı 12 ayda kalır)
          </span>
        </div>
        {(uni !== "etf" || lb !== 12 || topN !== 5 || cost !== 0) && (
          <button
            className="mini-btn"
            onClick={() => {
              setUni("etf");
              setLb(12);
              setTopN(5);
              setCost(0);
            }}
            title="Varsayılana dön (ETF · 12 ay · top-5 · 0 bps)"
          >
            ↺ Sıfırla
          </button>
        )}
      </div>
      <div className="studio-controls">
        <div className="ctrl-group">
          <label>Evren</label>
          <div className="seg">
            {STUDIO_UNIVERSES.map((u) => (
              <button
                key={u.id}
                className={uni === u.id ? "on" : ""}
                aria-pressed={uni === u.id}
                onClick={() => setUni(u.id)}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ctrl-group">
          <label>Look-back (ay)</label>
          <div className="seg">
            {STUDIO_LB.map((v) => (
              <button
                key={v}
                className={lb === v ? "on" : ""}
                aria-pressed={lb === v}
                onClick={() => setLb(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="ctrl-group">
          <label>Top-N {isEtf && <em>(GEM&apos;de tek varlık)</em>}</label>
          <div className="seg">
            {STUDIO_TOPN.map((v) => (
              <button
                key={v}
                disabled={isEtf}
                className={!isEtf && topN === v ? "on" : ""}
                aria-pressed={!isEtf && topN === v}
                onClick={() => setTopN(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="ctrl-group">
          <label>İşlem Maliyeti <em>(round-trip bps)</em></label>
          <div className="seg">
            {STUDIO_COST.map((v) => (
              <button
                key={v}
                className={cost === v ? "on" : ""}
                aria-pressed={cost === v}
                onClick={() => setCost(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {busy && (
        <div className="studio-state">
          <div className="spinner" />
          Backtest hesaplanıyor…
        </div>
      )}
      {err && !busy && <div className="error-box">{err}</div>}
      {!busy && !err && bt && (
        <>
          <div className="section-label">
            {res?.label} — look-back {res?.lookback} ay
            {!isEtf ? `, top-${res?.topN}` : ""}
            {res && res.cost > 0 ? `, maliyet ${res.cost}bps` : ""} (
            {bt.startDate} → {bt.endDate}, {bt.months} ay)
          </div>
          {(() => {
            const mom = bt.strategies[0];
            const bench =
              bt.strategies.find((s) => s.name.includes("Eşit Ağırlık")) ??
              bt.strategies[bt.strategies.length - 1];
            if (!mom || !bench || mom === bench) return null;
            const dC = (mom.cagr ?? 0) - (bench.cagr ?? 0);
            const dS = (mom.sharpe ?? 0) - (bench.sharpe ?? 0);
            return (
              <p className="table-note">
                Bu parametrelerle <b>{res?.label}</b>, al-tut benchmark&apos;ını
                CAGR&apos;da{" "}
                <b className={dC >= 0 ? "pos-cell" : "neg"}>
                  {dC >= 0 ? "+" : ""}
                  {pct(dC)}
                </b>
                , Sharpe&apos;da{" "}
                <b className={dS >= 0 ? "pos-cell" : "neg"}>
                  {dS >= 0 ? "+" : ""}
                  {num(dS)}
                </b>{" "}
                {dC >= 0 ? "geçiyor ✓" : "geçemiyor"}.
              </p>
            );
          })()}
          <EquityChart bt={bt} />
          <UnderwaterChart bt={bt} label={res?.label ?? "Strateji"} />
          <DrawdownEpisodes bt={bt} label={res?.label ?? "Strateji"} />
          <RollingReturnsChart bt={bt} label={res?.label ?? "Strateji"} />
          <MonthlyHeatmap bt={bt} label={res?.label ?? "Strateji"} />
          <BoxPlot bt={bt} />
          <MetricsTable rows={bt.strategies} />
          <AdvancedMetricsTable rows={bt.strategies} />
          <p className="table-note">{bt.note}</p>
        </>
      )}
      {!busy && !err && !bt && (
        <div className="studio-state">
          Bu evren/parametrelerle backtest üretilemedi (yetersiz ortak geçmiş
          olabilir).
        </div>
      )}
    </div>
  );
}

function BacktestCharts({
  bt,
  label = "GEM",
  factorAlpha,
  investedKey,
}: {
  bt: BacktestResult;
  label?: string;
  factorAlpha?: FactorAlpha | null;
  investedKey?: string;
}) {
  return (
    <>
      <EquityChart bt={bt} />
      <PositionTimeline bt={bt} label={label} />
      <UnderwaterChart bt={bt} label={label} />
      <DrawdownEpisodes bt={bt} label={label} />
      <MonthlyHeatmap bt={bt} label={label} />
      <RiskReturnChart rows={bt.strategies} />
      <RollingReturnsChart bt={bt} label={label} />
      <RollingVol bt={bt} label={label} />
      <ScatterGemVsBench bt={bt} label={label} />
      <BoxPlot bt={bt} />
      <Seasonality bt={bt} label={label} />
      <MetricsTable rows={bt.strategies} />
      <p className="table-note">{bt.note}</p>
      {bt.strategies[0]?.timeInAsset && (
        <p className="table-note">
          Zaman dağılımı:{" "}
          {Object.entries(bt.strategies[0].timeInAsset)
            .map(([k, v]) => {
              const lbl =
                k === investedKey
                  ? "Yatırımda"
                  : k === "bil"
                  ? "Nakit"
                  : k.toUpperCase();
              return `${lbl} %${v}`;
            })
            .join(" · ")}{" "}
          · Yıllık ~{num(bt.strategies[0].switchesPerYear ?? null)} geçiş
        </p>
      )}
      <AdvancedMetricsTable rows={bt.strategies} />
      {factorAlpha && (
        <FactorAlphaPanel fa={factorAlpha} subject={`${label} stratejisi`} />
      )}
    </>
  );
}

function UniverseSection({ u }: { u: UniverseBundle }) {
  const bt = u.backtest;
  return (
    <ErrorBoundary label={`${u.label} bölümü`}>
      <div className="universe-divider">
        <span>
          {u.emoji} {u.label}
        </span>
        <small>
          Çekirdek ETF&apos;lere uygulanan tüm analizlerin {u.label} için tekrarı
        </small>
      </div>

      {bt?.strategies[0] && (
        <div className="ustat">
          <div className="ustat-item">
            <span>CAGR</span>
            <b>{pct(bt.strategies[0].cagr)}</b>
          </div>
          <div className="ustat-item">
            <span>Sharpe</span>
            <b className="strong">{num(bt.strategies[0].sharpe)}</b>
          </div>
          <div className="ustat-item">
            <span>Sortino</span>
            <b>{num(bt.strategies[0].sortino)}</b>
          </div>
          <div className="ustat-item">
            <span>Max DD</span>
            <b className="neg">{pct(bt.strategies[0].maxDrawdown)}</b>
          </div>
          <div className="ustat-item">
            <span>Dönem</span>
            <b>{bt.months} ay</b>
          </div>
        </div>
      )}

      {u.momentum && <StockMomentumBoard data={u.momentum} />}

      {u.signals && (
        <SignalBoard
          board={u.signals}
          title={`${u.label} Sinyal Panosu — her varlığın anahtar momentum sinyalleri (12-ay, excess, MA trendi, 52-hafta)`}
        />
      )}

      {u.lookback && <LookbackHeatmap data={u.lookback} />}

      {bt && (
        <CollapsibleSection
          defaultOpen
          title={
            <>
              {u.positionLabel} Backtest &amp; Risk Metrikleri ({bt.startDate} →{" "}
              {bt.endDate}, {bt.months} ay)
            </>
          }
        >
          <BacktestCharts
            bt={bt}
            label={u.positionLabel}
            factorAlpha={u.factorAlpha}
            investedKey={u.id}
          />
        </CollapsibleSection>
      )}

      {u.methods && u.methods.length > 0 && (
        <MethodsSection methods={u.methods} />
      )}

      {u.earnings && <EarningsMomentumPanel data={u.earnings} />}
    </ErrorBoundary>
  );
}

export default function Home() {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<string>("etf");

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        force ? "/api/analysis?refresh=1" : "/api/analysis",
        { cache: "no-store" }
      );
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

  // Sekme durumunu URL hash ile senkronla (reload/paylaşımda korunur).
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (h) setView(h);
    const onHash = () => setView(window.location.hash.slice(1) || "etf");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const selectView = useCallback((id: string) => {
    setView(id);
    if (typeof window !== "undefined")
      window.history.replaceState(null, "", `#${id}`);
  }, []);

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

    // Bölüm 1: Tüm stratejilerin karşılaştırması (ETF GEM + evrenler + bileşik)
    lines.push("# Strateji Karsilastirmasi");
    lines.push(
      "Strateji,Evren,CAGR,Volatilite,Sharpe,Sortino,Carpiklik,Basiklik,CVaR5,Max_Drawdown,Toplam_Getiri,Donem_Bas,Donem_Son,Ay"
    );
    const pushStrat = (
      uni: string,
      bt: BacktestResult | null,
      onlyFirst = true
    ) => {
      if (!bt) return;
      const rows = onlyFirst ? bt.strategies.slice(0, 1) : bt.strategies;
      for (const s of rows)
        lines.push(
          [
            `"${s.name}"`,
            `"${uni}"`,
            fmt(s.cagr),
            fmt(s.annualVol),
            fmt(s.sharpe),
            fmt(s.sortino),
            fmt(s.skewness),
            fmt(s.kurtosis),
            fmt(s.cvar5),
            fmt(s.maxDrawdown),
            fmt(s.totalReturn),
            bt.startDate,
            bt.endDate,
            String(bt.months),
          ].join(",")
        );
    };
    pushStrat("ETF", data.backtest);
    for (const u of data.universes) pushStrat(u.label, u.backtest);
    pushStrat("Bileşik", data.composite);
    lines.push("");

    // Bölüm 2: Her evrenin güncel momentum sıralaması
    lines.push("# Evren Momentum Siralamasi");
    lines.push("Evren,Sira,Varlik,Ticker,Ret_12ay,Excess_vs_TBill,Secildi");
    for (const u of data.universes) {
      for (const s of u.momentum.stocks) {
        lines.push(
          [
            `"${u.label}"`,
            s.rank ?? "",
            `"${s.name}"`,
            s.ticker,
            fmt(s.ret12m),
            fmt(s.excessVsTbill),
            s.selected ? "1" : "0",
          ].join(",")
        );
      }
    }
    lines.push("");

    // Bölüm 3: ETF varlık sinyal panosu
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
          <button
            className="refresh-btn"
            onClick={() => load(true)}
            disabled={loading}
          >
            {loading ? "Yükleniyor…" : "↻ Yenile"}
          </button>
          {data && (
            <span className="timestamp">
              Güncellendi: {fmtTime(data.generatedAt)}
              {data.fromCache && (
                <span className="cache-badge" title="Sonuç 10 dk'lık sunucu önbelleğinden geldi. Taze veri için Yenile.">
                   önbellek
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {loading && !data && <LoadingSkeleton />}

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

          {/* Otomatik içgörü özeti */}
          <KeyInsights data={data} />

          {/* Bu ayın tüm evren sinyalleri */}
          <ConsolidatedSignals data={data} />

          {/* Metodoloji açıklaması */}
          <MethodologyPanel />

          {/* Etkileşimli backtest stüdyosu */}
          <ErrorBoundary label="Backtest Stüdyosu">
            <BacktestStudio />
          </ErrorBoundary>

          {/* Strateji karşılaştırma tablosu */}
          <StrategyLeaderboard data={data} />

          {/* Momentum vs al-tut katma değeri */}
          <MomentumValueAdd data={data} />

          {/* Ortak-dönem equity curve overlay (adil kıyas) */}
          <ErrorBoundary label="Ortak-dönem karşılaştırması">
            <CrossUniverseComparison data={data} />
          </ErrorBoundary>

          {/* Dual Momentum Bileşik — 4 evrenin eşit-ağırlık meta-stratejisi */}
          {data.composite && (
            <ErrorBoundary label="Bileşik bölümü">
            <CollapsibleSection
              defaultOpen
              title={
                <>
                  🧩 Dual Momentum Bileşik — {data.universes.length + 1} evrenin
                  eşit-ağırlık birleşimi ({data.composite.startDate} →{" "}
                  {data.composite.endDate}, {data.composite.months} ay)
                </>
              }
            >
              <p className="chart-help" style={{ maxWidth: "80ch" }}>
                GEM + Hisse + Kripto + Sektör momentum stratejilerini her ay{" "}
                <b>eşit ağırlıkla</b> birleştiren çeşitlendirilmiş meta-strateji.
                Sleeve&apos;ler imperfect korelasyonlu olduğundan bileşik
                genelde tek bir sleeve&apos;den <b>daha yüksek Sharpe / daha
                düşük drawdown</b> hedefler. Aşağıdaki equity curve&apos;de
                bileşik (yeşil, kalın) sleeve&apos;lerle birlikte gösterilir.
              </p>
              <CompositeStance data={data} />
              <CompositeHoldings data={data} />
              <EquityChart bt={data.composite} />
              <UnderwaterChart bt={data.composite} label="Bileşik" />
              <DrawdownEpisodes bt={data.composite} label="Bileşik" />
              <MonthlyHeatmap bt={data.composite} label="Bileşik" />
              <MetricsTable rows={data.composite.strategies} />
              <p className="table-note">{data.composite.note}</p>
              <AdvancedMetricsTable rows={data.composite.strategies} />
              <DiversificationStat bt={data.composite} />
              <RiskParityWeights bt={data.composite} />
              <CorrelationMatrix bt={data.composite} />
            </CollapsibleSection>
            </ErrorBoundary>
          )}

          {/* Evren sekmeleri (ETF + dinamik evrenler) */}
          <div
            className="view-tabs"
            style={{
              gridTemplateColumns: `repeat(${1 + data.universes.length}, 1fr)`,
            }}
          >
            <button
              className={`view-tab ${view === "etf" ? "active" : ""}`}
              onClick={() => selectView("etf")}
            >
              📊 Çekirdek Varlıklar (ETF)
              <small>
                Altın · S&amp;P 500 · NASDAQ
                {data.backtest?.strategies[0]?.sharpe != null && (
                  <> · GEM Sharpe {num(data.backtest.strategies[0].sharpe)}</>
                )}
              </small>
            </button>
            {data.universes.map((u) => (
              <button
                key={u.id}
                className={`view-tab ${view === u.id ? "active" : ""}`}
                onClick={() => selectView(u.id)}
              >
                {u.emoji} {u.label}
                <small>
                  {u.sublabel}
                  {u.backtest?.strategies[0]?.sharpe != null && (
                    <> · Sharpe {num(u.backtest.strategies[0].sharpe)}</>
                  )}
                </small>
              </button>
            ))}
          </div>

          {view === "etf" && (
          <>
          {/* Varlık Sinyal Panosu */}
          {data.signals && <SignalBoard board={data.signals} />}

          {/* Look-back Duyarlılık Matrisi */}
          {data.lookback && <LookbackHeatmap data={data.lookback} />}

          {/* Backtest & Metrikler */}
          {bt && (
            <CollapsibleSection
              defaultOpen
              title={
                <>
                  GEM Backtest &amp; Risk Metrikleri ({bt.startDate} →{" "}
                  {bt.endDate}, {bt.months} ay)
                </>
              }
            >
              <BacktestCharts bt={bt} factorAlpha={data.factorAlpha} />
            </CollapsibleSection>
          )}

          {/* Tüm Yöntemler — kategoriye göre gruplu */}
          <MethodsSection methods={data.methods} />
          </>
          )}

          {/* ETF dışı evrenler (hisse, kripto, ...) — seçili sekmeye göre */}
          {data.universes.map(
            (u) =>
              view === u.id && <UniverseSection key={u.id} u={u} />
          )}

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
        hesaplanıyor ·{" "}
        <a
          href="https://github.com/masekaa/saidterzi"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
        >
          Kaynak kodu (GitHub)
        </a>
      </div>
      <BackToTop />
    </div>
  );
}
