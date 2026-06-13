"use client";

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
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
  // 11 evren + GEM + bileşik + benchmark'lar aynı grafikte çizilebildiğinden
  // bol ayrık renk gerekir; aksi halde renkler tekrarlayıp evrenler karışır.
  "#22d3ee",
  "#a3e635",
  "#fb7185",
  "#818cf8",
  "#fcd34d",
  "#e879f9",
  "#fdba74",
  "#c4b5fd",
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
  commodity: { label: "Emtia Sepeti (Top-N)", color: "#eab308" },
  factor: { label: "Faktör Sepeti (Top-N)", color: "#2dd4bf" },
  bond: { label: "Tahvil Sepeti (Top-N)", color: "#818cf8" },
  assetclass: { label: "Sınıf Sepeti (Top-N)", color: "#34d399" },
  country: { label: "Ülke Sepeti (Top-N)", color: "#fb923c" },
  bist: { label: "BIST Sepeti (Top-N)", color: "#e11d48" },
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

// İki sayı KESİN zıt işaretli mi (biri >0 diğeri <0). Tam sıfır veya null →
// false (sıfır "zıt" sayılmaz). 12-1 vs 12-ay momentum sapma kontrolü için.
function opposed(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return false;
  return (a > 0 && b < 0) || (a < 0 && b > 0);
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

// Veri tazeliği ipucu — "az önce" / "X dk önce" / "X sa önce" / "X gün önce".
function relTime(iso: string): string {
  try {
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return "az önce";
    if (diffMin < 60) return `${diffMin} dk önce`;
    const h = Math.round(diffMin / 60);
    if (h < 24) return `${h} sa önce`;
    return `${Math.round(h / 24)} gün önce`;
  } catch {
    return "";
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
      <div className="section-label" role="heading" aria-level={2}>{title}</div>
      <div className="table-scroll">
        <table className="metrics signalboard">
          <thead>
            <tr>
              <th className="left">Varlık</th>
              <th>12-Ay Getiri</th>
              <th title="12-1 momentum: en son ayı atlayan getiri (Jegadeesh-Titman). 12-Ay ile zıt işaretliyse getiriyi son ay taşımış → tersine dönüş riski.">
                12-1
              </th>
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
                <td
                  className={
                    a.mom121 == null
                      ? ""
                      : opposed(a.mom121, a.ret12m)
                      ? "neg"
                      : a.mom121 < 0
                      ? "neg"
                      : ""
                  }
                  title={
                    opposed(a.mom121, a.ret12m)
                      ? "12-Ay ile zıt işaret: getiriyi büyük ölçüde son ay taşımış — kısa-vade tersine dönüş riski."
                      : "12-1 momentum (son ay atlanmış)"
                  }
                >
                  {a.mom121 != null
                    ? `${pct(a.mom121)}${opposed(a.mom121, a.ret12m) ? " ⚠" : ""}`
                    : "—"}
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
        {pct(board.tbillRet12m)}). Mutlak sinyal excess&gt;0 ise AL/TUT.{" "}
        <b>12-1</b>: en son ayı atlayan momentum (Jegadeesh-Titman); 12-Ay ile
        zıt işaretliyse (<b>⚠</b>) getiriyi büyük ölçüde son ay taşımıştır —
        kısa-vade tersine dönüş riski. Trend: ay-sonu fiyat 12-ay basit hareketli
        ortalamanın üstünde mi. 52-hafta yakınlık: güncel fiyat / son 12 ayın en
        yüksek ay-sonu kapanışı.
      </p>
    </>
  );
}

function LookbackHeatmap({
  data,
  label,
}: {
  data: LookbackData;
  label?: string;
}) {
  if (!data?.assets?.length) return null;
  return (
    <>
      <div className="section-label" role="heading" aria-level={2}>
        {label ? `${label} ` : ""}Look-back Duyarlılık — farklı geri-bakış
        pencerelerinde 12→1 ay getiri
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

function MomentumBoard({
  data,
  label,
}: {
  data: StockMomentumData;
  label?: string;
}) {
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
      <div className="section-label" role="heading" aria-level={2}>
        {label ? `${label} ` : ""}Momentum Panosu — {data.stocks.length} varlık,
        göreceli sıralama (en güçlü top-{data.topN} seçilir)
      </div>
      <div className="table-scroll">
        <table className="metrics stockboard">
          <thead>
            <tr>
              <th
                className={`sortable ${sortK === "rank" ? "sorted" : ""}`}
                onClick={() => setSortK("rank")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSortK("rank");
                  }
                }}
                tabIndex={0}
                aria-sort={sortK === "rank" ? "ascending" : "none"}
                title="Momentum sırasına göre (Enter ile sırala)"
              >
                #{sh("rank")}
              </th>
              <th className="left">Varlık</th>
              <th className="left">Not</th>
              <th>12-Ay Getiri</th>
              <th title="12-1 momentum: en son ayı atlayan getiri (Jegadeesh-Titman). 12-Ay ile zıt işaretliyse, getiriyi son ay taşımış → tersine dönüş riski.">
                12-1
              </th>
              <th
                className={`sortable ${sortK === "excess" ? "sorted" : ""}`}
                onClick={() => setSortK("excess")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSortK("excess");
                  }
                }}
                tabIndex={0}
                aria-sort={sortK === "excess" ? "descending" : "none"}
                title="T-Bill'e karşı paya göre (Enter ile sırala)"
              >
                T-Bill&apos;e Karşı{sh("excess")}
              </th>
              <th>Mutlak</th>
              <th
                className={`sortable ${sortK === "prox" ? "sorted" : ""}`}
                onClick={() => setSortK("prox")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSortK("prox");
                  }
                }}
                tabIndex={0}
                aria-sort={sortK === "prox" ? "descending" : "none"}
                title="52-hafta yakınlığa göre (Enter ile sırala)"
              >
                52-Hafta{sh("prox")}
              </th>
              <th>İvme</th>
              <th>Kalite</th>
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
                <td
                  className={
                    s.mom121 == null
                      ? ""
                      : opposed(s.mom121, s.ret12m)
                      ? "neg"
                      : s.mom121 < 0
                      ? "neg"
                      : ""
                  }
                  title={
                    opposed(s.mom121, s.ret12m)
                      ? "12-Ay ile zıt işaret: getiriyi büyük ölçüde son ay taşımış — kısa-vade tersine dönüş riski."
                      : "12-1 momentum (son ay atlanmış)"
                  }
                >
                  {s.mom121 != null
                    ? `${pct(s.mom121)}${
                        opposed(s.mom121, s.ret12m)
                          ? " ⚠"
                          : ""
                      }`
                    : "—"}
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
                <td
                  className={
                    s.quality == null
                      ? ""
                      : s.quality >= 0.6
                      ? "pos-cell"
                      : s.quality < 0.45
                      ? "neg"
                      : ""
                  }
                  title="Trailing 12-ayın % pozitif ayı (yol kalitesi / düzgünlük). Yüksek = tutarlı yükseliş; düşük = birkaç büyük sıçrama (kırılgan momentum). Gray-Vogel 2016."
                >
                  {s.quality == null ? "—" : `%${Math.round(s.quality * 100)}`}
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
        <b>Göreceli momentum:</b> varlıklar 12-ay getiriye göre sıralanır, en
        güçlü {data.topN} tanesi aday olur. <b>Mutlak momentum:</b> aday ancak
        12-ay getirisi T-Bill&apos;i ({pct(data.tbillRet12m)}) geçerse seçilir —
        şu an <b>{selectedCount}</b> varlık seçili. Dual momentum portföyü bu
        seçili varlıklara eşit ağırlık verir; hiçbiri geçemezse nakitte kalınır.
        İvme = son 12 ayın log-fiyat kavisi (hızlanan trend daha kalıcı olur).{" "}
        <b>12-1</b> = en son ayı atlayan momentum (Jegadeesh-Titman 1993): kısa-
        vade tersine dönüş gürültüsünü ayıklar. 12-Ay pozitif ama 12-1 negatifse
        (<b>⚠</b>) getiriyi büyük ölçüde son ay taşımıştır — gelecek ay geri
        çekilme riski yüksektir. Bilgilendirici, seçimi değiştirmez.{" "}
        <b>Kalite</b> = trailing 12-ayın % pozitif ayı (Gray-Vogel 2016): yüksek =
        düzgün/tutarlı yükseliş; düşük = birkaç büyük sıçramaya dayanan kırılgan
        momentum. Sıralamayı değiştirmez, seçimin sağlamlığını gösterir.
      </p>
    </>
  );
}

function EarningsMomentumPanel({ data }: { data: EarningsData }) {
  if (!data.enabled) {
    return (
      <>
        <div className="section-label" role="heading" aria-level={2}>
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
      <div className="section-label" role="heading" aria-level={2}>
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
        <span className={`chevron ${open ? "up" : ""}`} aria-hidden="true">▾</span>
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
        role="img" aria-label="Birikimli büyüme (equity) eğrisi grafiği — strateji ve benchmark. Detay: üstteki başlık ve açıklamada."
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
        {curves
          .map((c, idx) => ({
            c,
            idx,
            final: c.growth[c.growth.length - 1],
          }))
          // Vurgulu (ana strateji) önce, ardından dönem-sonu çarpana göre azalan
          // — çok eğrili (bileşik) grafikte legend taranabilir/sıralı olur.
          .sort(
            (a, b) =>
              (b.c.highlight ? 1 : 0) - (a.c.highlight ? 1 : 0) ||
              b.final - a.final
          )
          .map(({ c, idx, final }) => (
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
          ))}
      </div>
    </div>
  );
}

function TradeLog({ bt, label = "Strateji" }: { bt: BacktestResult; label?: string }) {
  const tl = bt.timeline;
  const curve = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  if (!tl?.length || !curve?.growth?.length) return null;

  // Aylık getiri haritası (vurgulu eğriden; YYYY-MM → getiri)
  const retByYm = new Map<string, number>();
  for (let j = 1; j < curve.growth.length && j < bt.dates.length; j++) {
    const r = curve.growth[j] / curve.growth[j - 1] - 1;
    if (isFinite(r)) retByYm.set(bt.dates[j].slice(0, 7), r);
  }

  // Ardışık aynı-pozisyon aylarını "işlem"lere grupla (rotasyon = yeni işlem)
  type Trade = {
    key: string;
    start: string;
    end: string;
    months: number;
    ret: number;
  };
  const trades: Trade[] = [];
  for (let i = 0; i < tl.length; ) {
    const key = tl[i].key;
    let j = i;
    let comp = 1;
    while (j < tl.length && tl[j].key === key) {
      const r = retByYm.get(tl[j].date.slice(0, 7));
      if (r != null) comp *= 1 + r;
      j++;
    }
    trades.push({
      key,
      start: tl[i].date,
      end: tl[j - 1].date,
      months: j - i,
      ret: comp - 1,
    });
    i = j;
  }
  if (trades.length < 2) return null;

  const wins = trades.filter((t) => t.ret > 0);
  const losses = trades.filter((t) => t.ret <= 0);
  const winRate = wins.length / trades.length;
  const avgWin = wins.length
    ? wins.reduce((s, t) => s + t.ret, 0) / wins.length
    : 0;
  const avgLoss = losses.length
    ? losses.reduce((s, t) => s + t.ret, 0) / losses.length
    : 0;
  const best = trades.reduce((a, b) => (b.ret > a.ret ? b : a));
  const worst = trades.reduce((a, b) => (b.ret < a.ret ? b : a));
  const avgMonths = trades.reduce((s, t) => s + t.months, 0) / trades.length;
  const payoff = avgLoss < 0 ? avgWin / Math.abs(avgLoss) : null;
  const recent = [...trades].reverse().slice(0, 15);
  const ym = (d: string) => d.slice(0, 7);

  const downloadCsv = () => {
    const lines = [
      `# ${label} islem gunlugu (pozisyon tutus donemleri) — tum ${trades.length} islem`,
      "Pozisyon,Baslangic,Bitis,Ay,Getiri_Yuzde",
    ];
    for (const t of trades)
      lines.push(
        `"${posMeta(t.key).label}",${ym(t.start)},${ym(t.end)},${t.months},${(
          t.ret * 100
        ).toFixed(2)}`
      );
    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `islem-gunlugu-${label
      .replace(/[^\w]+/g, "-")
      .toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="chart-card">
      <div className="chart-title chart-title-row">
        <span>{label} — İşlem Günlüğü (pozisyon tutuş dönemleri)</span>
        <button
          className="mini-btn"
          onClick={downloadCsv}
          title="Tüm işlemleri CSV indir"
          aria-label="İşlem günlüğünü CSV indir"
        >
          ⭳ CSV
        </button>
      </div>
      <div className="chart-help">
        Her satır, stratejinin tek bir varlıkta kesintisiz tutulduğu bir dönem
        (rotasyon = yeni işlem). Getiri o dönemin bileşik strateji getirisidir;
        nakit dönemleri de birer &quot;işlem&quot;dir (savunma). Kazanma oranı{" "}
        <b>işlem-bazlıdır</b> (aylık % kârlı aydan farklı). En yeni {recent.length}{" "}
        işlem gösterilir.
      </div>
      <div className="cap-grid">
        <div className="cap-item">
          <div className="cap-label">İşlem · Kazanma</div>
          <div className="cap-val">
            {trades.length} · %{(winRate * 100).toFixed(0)}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Ort. Tutuş</div>
          <div className="cap-val">{avgMonths.toFixed(1)} ay</div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Ort. Kazanç / Kayıp</div>
          <div className="cap-val">
            <span className="pos-cell">{pct(avgWin)}</span> /{" "}
            <span className="neg">{pct(avgLoss)}</span>
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Payoff (kazanç/kayıp)</div>
          <div className="cap-val">{payoff != null ? num(payoff) : "—"}</div>
        </div>
      </div>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th className="left">Pozisyon</th>
              <th className="left">Başlangıç</th>
              <th className="left">Bitiş</th>
              <th>Ay</th>
              <th>Getiri</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((t, i) => {
              const m = posMeta(t.key);
              return (
                <tr key={i}>
                  <td className="left">
                    <span
                      className="legend-swatch"
                      style={{ background: m.color }}
                    />
                    {m.label}
                  </td>
                  <td className="left">{ym(t.start)}</td>
                  <td className="left">{ym(t.end)}</td>
                  <td>{t.months}</td>
                  <td className={t.ret >= 0 ? "pos-cell" : "neg"}>{pct(t.ret)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        🏆 En iyi işlem: <b>{posMeta(best.key).label}</b> {ym(best.start)}→
        {ym(best.end)} (<span className="pos-cell">{pct(best.ret)}</span>) · 🔻 En
        kötü: <b>{posMeta(worst.key).label}</b> {ym(worst.start)}→{ym(worst.end)} (
        <span className="neg">{pct(worst.ret)}</span>).
      </p>
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
        stratejinin pozisyon değiştirdiği (rotasyon yaptığı) an. Legend&apos;daki
        %değer, o varlıkta geçirilen toplam zamanın oranı.
      </div>
      <svg
        className="equity-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img" aria-label="Pozisyon geçmişi şeridi — her ay tutulan varlık. Detay: üstteki başlık ve açıklamada."
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

function UnderwaterCompare({
  bt,
  label = "Strateji",
}: {
  bt: BacktestResult;
  label?: string;
}) {
  const strat = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  const bench =
    bt.equityCurves.find((c) => !c.highlight && /Eşit[\s-]Ağırlık/i.test(c.name)) ??
    bt.equityCurves.find(
      (c) => !c.highlight && /Pasif|Al-Tut|Buy.?Hold|SPY|ACWI/i.test(c.name)
    ) ??
    bt.equityCurves.find((c) => !c.highlight);
  if (!strat?.growth?.length || !bench?.growth?.length) return null;
  const n = Math.min(strat.growth.length, bench.growth.length, bt.dates.length);
  if (n < 13) return null;

  const toDD = (g: number[]) => {
    const dd: number[] = [];
    let peak = -Infinity;
    for (let i = 0; i < n; i++) {
      if (g[i] > peak) peak = g[i];
      dd.push(g[i] / peak - 1);
    }
    return dd;
  };
  const sDD = toDD(strat.growth);
  const bDD = toDD(bench.growth);
  const sMin = Math.min(...sDD);
  const bMin = Math.min(...bDD);
  const minDD = Math.min(sMin, bMin);
  if (!isFinite(minDD) || minDD === 0) return null;

  const W = 820;
  const H = 190;
  const padL = 52;
  const padR = 16;
  const padT = 12;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i: number) => padL + (innerW * i) / Math.max(1, n - 1);
  const y = (v: number) => padT + innerH * (v / minDD);
  const sArea =
    `M${x(0).toFixed(1)},${y(0).toFixed(1)} ` +
    sDD.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ") +
    ` L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} Z`;
  const bLine = bDD
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");

  const yTicks: number[] = [];
  for (let p = 0; p >= minDD; p -= 0.1) yTicks.push(p);
  const xTicks: { i: number; label: string }[] = [];
  let ly = "";
  for (let i = 0; i < n; i++) {
    const yr = bt.dates[i].slice(0, 4);
    if (yr !== ly) {
      xTicks.push({ i, label: yr });
      ly = yr;
    }
  }
  const step = Math.ceil(xTicks.length / 10);
  const shown = xTicks.filter((_, idx) => idx % step === 0);
  const shallower = sMin > bMin; // strateji çukuru daha sığ (daha az negatif)
  const benchName = bench.name.replace(/\s*\(.*\)/, "");

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} vs Benchmark — Karşılaştırmalı Underwater (drawdown)
      </div>
      <div className="chart-help">
        Dolu alan = <b>{label}</b> drawdown&apos;ı; kesik çizgi ={" "}
        <b>{benchName}</b>. 0 = yeni zirve; aşağısı = zirveden kayıp. Dual
        momentum tezi: stratejinin çukurları benchmark&apos;tan <b>sığ</b> olmalı
        (trend filtresi düşüşleri keser). Sürekli kıyas — kriz stres testinin
        kesikli olaylarını tamamlar.
      </div>
      <svg
        className="equity-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Karşılaştırmalı drawdown (underwater) grafiği — strateji ve benchmark. Detay: üstteki başlık ve açıklamada."
      >
        {yTicks.map((v, idx) => (
          <g key={idx}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} className="grid-line" />
            <text x={padL - 8} y={y(v) + 3} className="axis-label" textAnchor="end">
              {(v * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        <path d={sArea} className="underwater-area" />
        <path
          d={bLine}
          fill="none"
          stroke="#f87171"
          strokeDasharray="4 3"
          style={{ strokeWidth: 1.6 }}
        />
        {shown.map((t, idx) => (
          <text key={idx} x={x(t.i)} y={H - 8} className="axis-label" textAnchor="middle">
            {t.label}
          </text>
        ))}
      </svg>
      <div className={`rob-verdict ${shallower ? "ok" : "thin"}`}>
        En kötü drawdown — <b>{label}</b>: <span className="neg">{pct(sMin, 1)}</span>{" "}
        · <b>{benchName}</b>: <span className="neg">{pct(bMin, 1)}</span>
        {" — "}
        {shallower
          ? "stratejinin çukuru daha sığ: trend filtresi düşüşü kesmiş (tez doğrulanıyor)."
          : "bu seride stratejinin çukuru benchmark kadar/daha derin — momentum bu dönemde korumadı."}
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
        role="img" aria-label="Drawdown (underwater) grafiği — zirveden düşüş. Detay: üstteki başlık ve açıklamada."
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

function AnnualReturnsMatrix({ data }: { data: AnalysisResult }) {
  // "Getirilerin periyodik tablosu": yıllar × tüm stratejiler. Her hücre o
  // stratejinin o takvim yılı (bileşik) getirisi; renk = yeşil/kırmızı yoğunluk.
  // Yıldan yıla liderlik rotasyonunu tek bakışta gösterir.
  type Col = {
    emoji: string;
    label: string;
    byYear: Map<string, number>;
    cagr: number | null;
    best: number | null;
    worst: number | null;
  };
  const cols: Col[] = [];
  const addCol = (emoji: string, label: string, bt: BacktestResult | null) => {
    if (!bt) return;
    const c = bt.equityCurves.find((x) => x.highlight) ?? bt.equityCurves[0];
    if (!c?.growth?.length) return;
    const prod = new Map<string, number>();
    for (let j = 1; j < c.growth.length && j < bt.dates.length; j++) {
      const yr = bt.dates[j].slice(0, 4);
      const r = c.growth[j] / c.growth[j - 1] - 1;
      if (!isFinite(r)) continue;
      prod.set(yr, (prod.get(yr) ?? 1) * (1 + r));
    }
    if (prod.size < 1) return;
    const byYear = new Map<string, number>();
    prod.forEach((v, yr) => byYear.set(yr, v - 1));
    const vals = [...byYear.values()];
    cols.push({
      emoji,
      label,
      byYear,
      cagr: bt.strategies[0]?.cagr ?? null,
      best: vals.length ? Math.max(...vals) : null,
      worst: vals.length ? Math.min(...vals) : null,
    });
  };
  addCol("📊", "GEM", data.backtest);
  for (const u of data.universes)
    addCol(
      u.emoji,
      u.label.replace(/\s*\(.*\)/, ""),
      u.backtest
    );
  addCol("🧩", "Bileşik", data.composite);
  if (cols.length < 2) return null;

  const yearSet = new Set<string>();
  cols.forEach((c) => c.byYear.forEach((_, yr) => yearSet.add(yr)));
  const years = Array.from(yearSet).sort((a, b) => b.localeCompare(a)); // yeni → eski
  if (years.length < 2) return null;

  const downloadCsv = () => {
    const lines = [
      "# Yillik getiri matrisi (%) — stratejiler x takvim yillari",
      ["Yil", ...cols.map((c) => `"${c.label}"`)].join(","),
    ];
    for (const yr of years)
      lines.push(
        [
          yr,
          ...cols.map((c) => {
            const v = c.byYear.get(yr);
            return v == null ? "" : (v * 100).toFixed(1);
          }),
        ].join(",")
      );
    lines.push(
      [
        "CAGR",
        ...cols.map((c) => (c.cagr == null ? "" : (c.cagr * 100).toFixed(1))),
      ].join(",")
    );
    lines.push(
      [
        "Poz_Yil",
        ...cols.map((c) => {
          const vals = [...c.byYear.values()];
          return vals.length ? `${vals.filter((v) => v > 0).length}/${vals.length}` : "";
        }),
      ].join(",")
    );
    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yillik-getiri-matrisi.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="chart-card">
      <div className="chart-title chart-title-row">
        <span>
          📅 Yıllık Getiri Matrisi — stratejiler × takvim yılları (liderlik
          rotasyonu)
        </span>
        <button
          className="mini-btn"
          onClick={downloadCsv}
          title="Yıllık getiri matrisini CSV indir"
          aria-label="Yıllık getiri matrisini CSV indir"
        >
          ⭳ CSV
        </button>
      </div>
      <div className="chart-help">
        Her hücre, o stratejinin o takvim yılındaki <b>bileşik getirisidir</b> (yeşil
        = pozitif, kırmızı = negatif, yoğunluk ±%10&apos;da doyar). Hiçbir
        sleeve&apos;in her yıl lider olmadığını ve momentum rotasyonunun neden işe
        yaradığını gösterir. Boş (—) = strateji o yıl henüz veri sağlamıyor; başlangıç/
        bitiş yılları kısmi olabilir.
      </div>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th className="left">Yıl</th>
              {cols.map((c, i) => (
                <th key={i} title={c.label}>
                  {c.emoji}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((yr) => (
              <tr key={yr}>
                <td className="left strong">{yr}</td>
                {cols.map((c, i) => {
                  const v = c.byYear.get(yr);
                  const extreme =
                    v != null && (v === c.best || v === c.worst);
                  return (
                    <td
                      key={i}
                      style={
                        v == null
                          ? undefined
                          : {
                              background: heatColor(v),
                              fontVariantNumeric: "tabular-nums",
                              fontWeight: extreme ? 700 : undefined,
                            }
                      }
                      title={
                        v != null && v === c.best
                          ? `${c.label} ${yr} — en iyi yıl`
                          : v != null && v === c.worst
                          ? `${c.label} ${yr} — en kötü yıl`
                          : `${c.label} ${yr}`
                      }
                    >
                      {v == null ? "—" : pct(v, 0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="left strong" title="Tüm dönem yıllık bileşik getiri">
                CAGR
              </td>
              {cols.map((c, i) => (
                <td
                  key={i}
                  className={`strong ${
                    c.cagr == null ? "" : c.cagr >= 0 ? "pos-cell" : "neg"
                  }`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                  title={`${c.label} — tüm dönem CAGR`}
                >
                  {c.cagr == null ? "—" : pct(c.cagr, 0)}
                </td>
              ))}
            </tr>
            <tr>
              <td
                className="left"
                title="Pozitif getirili takvim yılı sayısı / toplam yıl"
              >
                Poz. Yıl
              </td>
              {cols.map((c, i) => {
                const vals = [...c.byYear.values()];
                const pos = vals.filter((v) => v > 0).length;
                const rate = vals.length ? pos / vals.length : 0;
                return (
                  <td
                    key={i}
                    className={rate >= 0.6 ? "pos-cell" : rate < 0.4 ? "neg" : ""}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                    title={`${c.label} — ${pos}/${vals.length} yıl pozitif`}
                  >
                    {vals.length ? `${pos}/${vals.length}` : "—"}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="table-note">
        Sütun başlığına gel → strateji adı. Renk yoğunluğu getiri büyüklüğünü
        yansıtır; yatay okuma = o yıl evrenler-arası dağılım, dikey okuma = bir
        stratejinin yıllar arası tutarlılığı. Her sütunda <b>kalın</b> hücreler o
        stratejinin <b>en iyi ve en kötü yılı</b>dır (üzerine gel → etiket). Alt
        satır = stratejinin <b>tüm dönem CAGR</b>&apos;ı (yıllık getirileri
        bağlamlandıran çıpa; dönemler farklı başlayabilir).
      </p>
    </div>
  );
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
        Her hücre o ayın strateji getirisi (%). Renk yoğunluğu büyüklüğü gösterir:
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
        role="img" aria-label="Risk-getiri dağılım grafiği — yıllık getiri ve oynaklık. Detay: üstteki başlık ve açıklamada."
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
      <div className="section-label" role="heading" aria-level={2}>
        Gelişmiş Risk Metrikleri (Sortino · Calmar · Ulcer · Martin · çarpıklık ·
        basıklık · CVaR · drawdown süreleri)
      </div>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th className="left">Strateji</th>
              <th>Sortino</th>
              <th>Calmar</th>
              <th>Ulcer</th>
              <th>Martin</th>
              <th>Çarpıklık</th>
              <th>Basıklık</th>
              <th>CVaR %5 (aylık)</th>
              <th>DD Süre (ay)</th>
              <th>Toparlanma (ay)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const calmar =
                s.cagr != null &&
                s.maxDrawdown != null &&
                s.maxDrawdown < 0
                  ? s.cagr / Math.abs(s.maxDrawdown)
                  : null;
              return (
              <tr key={i} className={i === 0 ? "row-hl" : ""}>
                <td className="left">{s.name}</td>
                <td className="strong">{num(s.sortino)}</td>
                <td>{num(calmar)}</td>
                <td className="neg">
                  {s.ulcerIndex != null ? s.ulcerIndex.toFixed(1) : "—"}
                </td>
                <td className="strong">{num(s.martinRatio ?? null)}</td>
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
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        <b>Sortino:</b> getiriyi yalnızca aşağı-yön oynaklığına böler (Sharpe&apos;ın
        ceza vermediği yukarı oynaklığı görmezden gelir). <b>Ulcer Index:</b>{" "}
        drawdown&apos;ların karekök-ortalama-karesi — MaxDD&apos;den farklı olarak hem
        düşüşün derinliğini hem de su-altı kalma süresini cezalandırır (düşük = az
        &quot;acı&quot;). <b>Martin oranı:</b> yıllık getiri ÷ Ulcer (acı-başına
        getiri; Sharpe&apos;ın drawdown-temelli kuzeni, yüksek = iyi).{" "}
        <b>Çarpıklık&lt;0</b>{" "}
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
      <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="12-ay rolling getiri grafiği. Detay: üstteki başlık ve açıklamada.">
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
        çeyrekte</b> (ikisi de düşüşte) strateji noktalarının köşegenin{" "}
        <b>üstünde</b> kalması = stratejinin düşüş aylarında daha az kaybetmesi
        (downside koruması).
      </div>
      <svg
        className="equity-svg scatter"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img" aria-label="Strateji-benchmark aylık getiri saçılım grafiği. Detay: üstteki başlık ve açıklamada."
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
          ↑ Strateji aylık
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
      p5: quantile(rets, 0.05),
      q1: quantile(rets, 0.25),
      med: quantile(rets, 0.5),
      q3: quantile(rets, 0.75),
      p95: quantile(rets, 0.95),
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
        kayıp ayların büyüklüğü. Bıyık uçları min–max (tek bir uç aya duyarlı);
        içteki <b>turuncu çizgiler %5 ve %95 yüzdelikler</b> — outlier&apos;a
        dayanıklı, gerçek kuyruk sınırını gösterir. Stratejinin kutusunu al-tut
        (benchmark) ile karşılaştır.
      </div>
      <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Aylık getiri dağılımı kutu grafiği. Detay: üstteki başlık ve açıklamada.">
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
              {/* %5 ve %95 yüzdelik — sağlam (outlier'a dayanıklı) kuyruk sınırı */}
              <line x1={X(s.p5)} x2={X(s.p5)} y1={cy - 6} y2={cy + 6} className="box-pct" />
              <line x1={X(s.p95)} x2={X(s.p95)} y1={cy - 6} y2={cy + 6} className="box-pct" />
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

function StreakStats({ bt, label = "Strateji" }: { bt: BacktestResult; label?: string }) {
  const curve = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  const g = curve?.growth;
  if (!g || g.length < 13) return null;
  const r = growthToRets(g);
  if (r.length < 12) return null;

  const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);
  let maxWin = 0;
  let maxLoss = 0;
  let worstLossRet = 0; // en kötü kayıp serisinin bileşik getirisi
  let i = 0;
  while (i < r.length) {
    const s = sign(r[i]);
    if (s === 0) {
      i++;
      continue;
    }
    let j = i;
    let comp = 1;
    while (j < r.length && sign(r[j]) === s) {
      comp *= 1 + r[j];
      j++;
    }
    const len = j - i;
    if (s > 0 && len > maxWin) maxWin = len;
    if (s < 0) {
      if (len > maxLoss) maxLoss = len;
      if (comp - 1 < worstLossRet) worstLossRet = comp - 1;
    }
    i = j;
  }
  // Güncel (sondaki) seri
  let curLen = 0;
  let curSign = 0;
  for (let k = r.length - 1; k >= 0; k--) {
    const s = sign(r[k]);
    if (k === r.length - 1) {
      if (s === 0) break;
      curSign = s;
      curLen = 1;
    } else if (s === curSign) curLen++;
    else break;
  }

  return (
    <div className="chart-card">
      <div className="chart-title">{label} — Kazanç / Kayıp Serileri (sıra riski)</div>
      <div className="chart-help">
        Art arda gelen kazançlı/kayıplı ayların en uzun dizileri. Uzun kayıp
        serileri ve onların bileşik etkisi, <b>sıra riskini</b> (sequence risk) ve
        psikolojik dayanma süresini gösterir — strateji uzun vadede kazansa bile
        bu dizileri yaşamayı göze almak gerekir.
      </div>
      <div className="cap-grid">
        <div className="cap-item">
          <div className="cap-label">En uzun kazanç serisi</div>
          <div className="cap-val pos-cell">{maxWin} ay</div>
        </div>
        <div className="cap-item">
          <div className="cap-label">En uzun kayıp serisi</div>
          <div className="cap-val neg">
            {maxLoss} ay{maxLoss > 0 ? ` (${pct(worstLossRet, 1)})` : ""}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Güncel seri</div>
          <div className={`cap-val ${curSign > 0 ? "pos-cell" : curSign < 0 ? "neg" : ""}`}>
            {curSign > 0 ? `▲ ${curLen} ay` : curSign < 0 ? `▼ ${curLen} ay` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReturnHistogram({ bt, label = "GEM" }: { bt: BacktestResult; label?: string }) {
  const curve = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  const g = curve?.growth;
  if (!g || g.length < 14) return null;
  const rets = growthToRets(g);
  const n = rets.length;
  if (n < 10) return null;

  const m = rets.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(rets.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) || 1e-6;
  const skew = rets.reduce((s, x) => s + ((x - m) / sd) ** 3, 0) / n;
  const kurt = rets.reduce((s, x) => s + ((x - m) / sd) ** 4, 0) / n - 3;
  const lo = Math.min(...rets);
  const hi = Math.max(...rets);
  const range = hi - lo || 1;
  const BINS = Math.min(25, Math.max(11, Math.round(Math.sqrt(n))));
  const bw = range / BINS;
  const counts = new Array(BINS).fill(0);
  for (const r of rets) {
    let idx = Math.floor((r - lo) / bw);
    if (idx >= BINS) idx = BINS - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  const maxCount = Math.max(...counts);

  const W = 820;
  const H = 240;
  const padL = 36;
  const padR = 14;
  const padT = 16;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // Normal yoğunluk eğrisi, sayım ölçeğine getirilmiş: E(x) = n·bw·pdf(x).
  const pdf = (x: number) =>
    Math.exp(-((x - m) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
  const SAMPLES = 80;
  const norm: { x: number; e: number }[] = [];
  for (let k = 0; k <= SAMPLES; k++) {
    const x = lo + (range * k) / SAMPLES;
    norm.push({ x, e: n * bw * pdf(x) });
  }
  const yMax = Math.max(maxCount, ...norm.map((p) => p.e)) * 1.08 || 1;

  const X = (v: number) => padL + (innerW * (v - lo)) / range;
  const Y = (c: number) => padT + innerH * (1 - c / yMax);
  const normPath = norm
    .map((p, k) => `${k === 0 ? "M" : "L"}${X(p.x).toFixed(1)},${Y(p.e).toFixed(1)}`)
    .join(" ");

  const xTicks: number[] = [];
  for (let p = Math.ceil(lo * 10) / 10; p <= hi; p += 0.05) xTicks.push(Number(p.toFixed(2)));

  // Sağlam (robust) özet metrikler — aynı aylık getiri serisinden.
  const posR = rets.filter((x) => x > 0);
  const negR = rets.filter((x) => x < 0);
  const sumAll = rets.reduce((s, x) => s + x, 0);
  const sumNegAbs = negR.reduce((s, x) => s + Math.abs(x), 0);
  // Gain-to-Pain (Schwager): Σgetiri / |Σnegatif getiri|. >1 değerli.
  const gpr = sumNegAbs > 1e-9 ? sumAll / sumNegAbs : null;
  const winRate = posR.length / n;
  const avgWin = posR.length ? posR.reduce((s, x) => s + x, 0) / posR.length : null;
  const avgLoss = negR.length ? sumNegAbs / negR.length : null;
  const payoff =
    avgWin != null && avgLoss != null && avgLoss > 1e-9 ? avgWin / avgLoss : null;

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} Aylık Getiri Histogramı — gerçek dağılım vs normal (çan) eğri
      </div>
      <div className="chart-help">
        Çubuklar gerçek aylık getiri sıklığı; turuncu eğri aynı ortalama/oynaklıkta
        teorik normal dağılım. Çubukların merkezde <b>ve</b> uçlarda eğriyi aşması =
        kalın kuyruk (basıklık&gt;0); sol/sağ asimetri = çarpıklık. Bu seri:
        çarpıklık <b>{skew.toFixed(2)}</b>, fazla basıklık <b>{kurt.toFixed(2)}</b>.
      </div>
      <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Aylık getiri histogramı — normal eğri bindirmeli. Detay: üstteki başlık ve açıklamada.">
        {xTicks.map((v, i) => (
          <line
            key={`g${i}`}
            x1={X(v)}
            x2={X(v)}
            y1={padT}
            y2={H - padB}
            className={Math.abs(v) < 1e-9 ? "grid-line zero" : "grid-line"}
          />
        ))}
        {counts.map((c, i) => {
          const x0 = X(lo + i * bw);
          const x1 = X(lo + (i + 1) * bw);
          const w = Math.max(1, x1 - x0 - 1.5);
          const y = Y(c);
          return (
            <rect
              key={i}
              x={x0 + 0.75}
              y={y}
              width={w}
              height={Math.max(0, H - padB - y)}
              className="hist-bar"
            />
          );
        })}
        <path d={normPath} className="hist-normal" />
        <line x1={X(m)} x2={X(m)} y1={padT} y2={H - padB} className="hist-mean" />
        {xTicks.map((v, i) => (
          <text
            key={`t${i}`}
            x={X(v)}
            y={H - padB + 16}
            className="axis-label"
            textAnchor="middle"
          >
            {(v * 100).toFixed(0)}%
          </text>
        ))}
      </svg>
      <div className="cap-grid">
        <div className="cap-item">
          <div className="cap-label">Gain-to-Pain</div>
          <div className={`cap-val ${gpr != null && gpr >= 1 ? "pos-cell" : "neg"}`}>
            {gpr != null ? `${gpr.toFixed(2)}×` : "—"}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Pozitif ay oranı</div>
          <div className={`cap-val ${winRate >= 0.5 ? "pos-cell" : "neg"}`}>
            {pct(winRate, 0)}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Kazanç/Kayıp (payoff)</div>
          <div className={`cap-val ${payoff != null && payoff >= 1 ? "pos-cell" : "neg"}`}>
            {payoff != null ? `${payoff.toFixed(2)}×` : "—"}
          </div>
        </div>
      </div>
      <p className="chart-help">
        <b>Gain-to-Pain</b> (Schwager): tüm getirilerin toplamı ÷ negatif
        getirilerin mutlak toplamı — <b>&gt;1 değerli</b>, kazançlar acının
        kaç katı. <b>Pozitif ay oranı</b>: ayların yüzde kaçı pozitif.{" "}
        <b>Payoff</b>: ortalama kazançlı ay ÷ ortalama kayıplı ay (yüksek =
        kazançlar kayıplardan büyük). Düşük isabet (&lt;%50) bile yüksek payoff
        ile kârlı olabilir — momentum&apos;un tipik imzası.
      </p>
    </div>
  );
}

function FactorAlphaPanel({ fa, subject = "GEM" }: { fa: FactorAlpha; subject?: string }) {
  const sig = Math.abs(fa.alphaTStat) >= 2;
  return (
    <>
      <div className="section-label" role="heading" aria-level={2}>
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
        <span className={`chevron ${open ? "up" : ""}`} aria-hidden="true">▾</span>
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
        <div className="section-label" role="heading" aria-level={2}>
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
  // Başlık düz metinse açık/kapalı durumu localStorage'ta sakla; böylece 10 dk
  // veri tazelemesi ve sayfa yenilemeleri kullanıcının düzenini korur.
  const storeKey = typeof title === "string" ? `csec:${title}` : null;
  const [open, setOpen] = useState(defaultOpen);
  // SSR defaultOpen ile başlar; kayıtlı tercih efektle uygulanır (hydration
  // uyumsuzluğunu önler).
  const persist = (next: boolean) => {
    if (!storeKey) return;
    try {
      window.localStorage.setItem(storeKey, next ? "1" : "0");
    } catch {
      /* yok say */
    }
  };
  useEffect(() => {
    if (!storeKey) return;
    try {
      const v = window.localStorage.getItem(storeKey);
      if (v === "0") setOpen(false);
      else if (v === "1") setOpen(true);
    } catch {
      /* localStorage erişilemezse sessizce defaultOpen'da kal */
    }
  }, [storeKey]);
  // Üst çubuktaki "Tümünü Aç/Kapat" yayınını dinle.
  useEffect(() => {
    const onSetAll = (e: Event) => {
      const next = (e as CustomEvent<{ open: boolean }>).detail?.open;
      if (typeof next !== "boolean") return;
      setOpen(next);
      persist(next);
    };
    window.addEventListener("csec:setall", onSetAll);
    return () => window.removeEventListener("csec:setall", onSetAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);
  const toggle = () =>
    setOpen((o) => {
      const next = !o;
      persist(next);
      return next;
    });
  return (
    <div className="csec">
      <button className="csec-head" onClick={toggle} aria-expanded={open}>
        <span>{title}</span>
        <span className={`chevron ${open ? "up" : ""}`} aria-hidden="true">▾</span>
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
          ~95 sembol + Fama-French faktörleri çekiliyor ve 11 evren + bileşik
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
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        })
      }
      aria-label="Sayfa başına dön"
      title="Başa dön"
    >
      ↑
    </button>
  );
}

// Mevcut (güncel) drawdown: büyüme eğrisinin son değeri, tüm-zaman zirvesine
// göre yüzde kaç aşağıda (≤0). "Şu an dipte miyiz, zirvede mi?" sorusu.
function curDrawdown(g: number[]): number | null {
  if (!g || g.length < 2) return null;
  let peak = g[0];
  for (const v of g) if (v > peak) peak = v;
  if (!(peak > 0)) return null;
  return g[g.length - 1] / peak - 1;
}

// Sinyal kararlılığı: güncel pozisyon kaç aydır değişmedi (holdMonths) ve son
// 12 ayda kaç kez yön değişti (switches → whipsaw/gel-git ölçüsü). Timeline
// kronolojik artan sırada kurulur.
function signalStability(
  timeline: { date: string; key: string }[]
): { holdMonths: number; switches: number; n: number } | null {
  if (!timeline || timeline.length < 2) return null;
  const t = timeline;
  const lastKey = t[t.length - 1].key;
  let holdMonths = 1;
  for (let i = t.length - 2; i >= 0; i--) {
    if (t[i].key === lastKey) holdMonths++;
    else break;
  }
  const start = Math.max(1, t.length - 12);
  let switches = 0;
  for (let i = start; i < t.length; i++) if (t[i].key !== t[i - 1].key) switches++;
  return { holdMonths, switches, n: t.length };
}

// Oynaklık rejimi: son `recentWin` ayın getiri standart sapması, tüm-dönem
// standart sapmasına oranlanır. >1 çalkantılı, <1 sakin. Risk-hedefleme ve
// pozisyon büyüklüğü için bağlam verir.
function volRegime(
  g: number[],
  recentWin = 6
): { ratio: number; recentAnnual: number; fullAnnual: number } | null {
  const r = growthToRets(g);
  if (r.length < recentWin + 12) return null;
  const sd = (arr: number[]) => {
    if (arr.length < 2) return 0;
    const m = arr.reduce((s, x) => s + x, 0) / arr.length;
    const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
    return Math.sqrt(v);
  };
  const full = sd(r);
  const recent = sd(r.slice(-recentWin));
  if (!(full > 0)) return null;
  const A = Math.sqrt(12);
  return { ratio: recent / full, recentAnnual: recent * A, fullAnnual: full * A };
}

// Hareketli-ortalama trend filtresi (Faber 2007): büyüme eğrisinin güncel
// değeri son `win`-aylık basit ortalamasının üstünde mi? Üstünde = trend yukarı
// (devam), altında = trend zayıf (riski azalt). Klasik trend-takip overlay'i.
function maTrend(g: number[], win = 10): { ratio: number; above: boolean } | null {
  if (!g || g.length < win + 2) return null;
  let sum = 0;
  for (let i = g.length - win; i < g.length; i++) sum += g[i];
  const ma = sum / win;
  if (!(ma > 0)) return null;
  const last = g[g.length - 1];
  return { ratio: last / ma, above: last >= ma };
}

// Geçmiş tutma-ufku istatistiği: büyüme eğrisindeki tüm kayan `win`-aylık
// pencereler — kaçı pozitif (isabet), medyan/en kötü/en iyi getiri. "Bu yöntemi
// 1 yıl tutsaydım tarihsel olarak ne olurdu?" sorusunu dürüstçe (kötü dahil)
// yanıtlar.
function holdHorizonStats(
  g: number[],
  win = 12
): { posFrac: number; median: number; worst: number; best: number; n: number } | null {
  if (!g || g.length < win + 2) return null;
  const rets: number[] = [];
  for (let i = win; i < g.length; i++) rets.push(g[i] / g[i - win] - 1);
  if (rets.length < 6) return null;
  const sorted = [...rets].sort((a, b) => a - b);
  const pos = rets.filter((x) => x > 0).length;
  return {
    posFrac: pos / rets.length,
    median: quantile(sorted, 0.5),
    worst: sorted[0],
    best: sorted[sorted.length - 1],
    n: rets.length,
  };
}

// Sade dil ("Ayşe teyzeye anlatır gibi") yatırım özeti — sayfanın en üstünde,
// teknik jargon olmadan, somut "bu ay ne yap" maddeleriyle. Tüm sayılar diğer
// panellerdeki aynı hesaplardan türetilir; burada yalnız sadeleştirilir.
function YatirimTavsiyesi({ data }: { data: AnalysisResult }) {
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  // Yazdırırken (Ctrl+P / PDF) tüm ayrıntıyı aç → aylık rapor eksiksiz çıksın.
  useEffect(() => {
    const expand = () => setShowAll(true);
    window.addEventListener("beforeprint", expand);
    return () => window.removeEventListener("beforeprint", expand);
  }, []);
  const items: { icon: string; lead: string; rest: ReactNode }[] = [];
  const gem = data.gem;
  const isCash = gem.positionKey === "cash";

  // --- Genel durum sentezi (tek satırlık başlık) ---
  // Birden çok sinyali [-1,+1] ölçeğine indirip ortalar: ana karar, piyasa
  // genişliği, evrenlerin yatırımda olma oranı, güncel drawdown derinliği.
  let scoreSum = 0;
  let scoreN = 0;
  scoreSum += isCash ? -1 : 1;
  scoreN++;
  {
    let pos = 0;
    let tot = 0;
    for (const u of data.universes)
      for (const s of u.momentum.stocks)
        if (s.excessVsTbill != null) {
          tot++;
          if (s.excessVsTbill > 0) pos++;
        }
    if (tot >= 10) {
      scoreSum += (pos / tot - 0.5) * 2;
      scoreN++;
    }
  }
  {
    const cashUnis = data.universes.filter(
      (u) => u.momentum.stocks.filter((s) => s.selected).length === 0
    ).length;
    const totalUni = data.universes.length + 1;
    const investedFrac = (totalUni - (cashUnis + (isCash ? 1 : 0))) / totalUni;
    scoreSum += (investedFrac - 0.5) * 2;
    scoreN++;
  }
  {
    const cd = data.composite?.equityCurves[0]
      ? curDrawdown(data.composite.equityCurves[0].growth)
      : null;
    if (cd != null) {
      scoreSum += cd > -0.05 ? 1 : cd > -0.15 ? 0 : -1;
      scoreN++;
    }
  }
  const stance = scoreN ? scoreSum / scoreN : 0;
  const verdict =
    stance > 0.33
      ? {
          cls: "v-on",
          icon: "🟢",
          label: "Risk Açık",
          text: "Göstergelerin çoğu yukarıyı işaret ediyor — sistemin kurallarına uyarak yatırımda kalınabilir.",
        }
      : stance < -0.33
      ? {
          cls: "v-off",
          icon: "🔴",
          label: "Savunmada",
          text: "Göstergelerin çoğu zayıf — sermayeyi korumak öncelik; nakit/temkin ağır basıyor.",
        }
      : {
          cls: "v-mix",
          icon: "🟡",
          label: "Karışık / Temkinli",
          text: "Sinyaller karışık — acele etme, pozisyonları küçük tut ve sinyale sadık kal.",
        };

  // 1) Bu ayın ana kararı
  if (isCash) {
    items.push({
      icon: "🛡️",
      lead: "Bu ay temkinli ol, nakitte bekle.",
      rest: (
        <>
          Ana göstergemiz şu an borsadan uzak durup parayı güvenli tarafta
          (faiz/mevduat/para piyasası) tutmayı söylüyor — son aylarda trend
          zayıfladı, düşüşten korunma zamanı.
        </>
      ),
    });
  } else {
    items.push({
      icon: "📈",
      lead: "Bu ay piyasada kal.",
      rest: (
        <>
          Ana göstergemiz bu ay <b>{gem.positionName}</b> tutmayı öneriyor —
          yani paranın risk (borsa) tarafında kalması yönünde, çünkü trend hâlâ
          yukarı.
        </>
      ),
    });
  }

  // 1c) BIST 100 (Türkiye) özel vurgusu — kullanıcı isteği: BIST'e ağırlık ver
  {
    const bist = data.universes.find((u) => u.id === "bist");
    if (bist) {
      const picks = bist.momentum.stocks
        .filter((s) => s.selected)
        .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
      items.push({
        icon: "🇹🇷",
        lead: picks.length
          ? `BIST 100 tarafında bu ay ${picks.length} hisse öne çıkıyor.`
          : "BIST 100 tarafında bu ay sinyal nakit (temkin).",
        rest: picks.length ? (
          <>
            Momentum zirvesindekiler: <b>{picks.map((s) => s.name).join(", ")}</b>.
            Hesaplar <b>USD bazlı</b> — TRY değer kaybından arındırılmış gerçek
            getiri, yani &quot;kâr&quot; kur şişirmesi değil.
          </>
        ) : (
          <>
            BIST hisselerinin momentumu şu an güvenli faizin (USD) altında —
            Türkiye tarafında risk almak için acele etme.
          </>
        ),
      });
    }
  }

  // 1b) Sinyal ne kadar yerleşik — pozisyon süresi + son 1 yıl whipsaw
  if (data.backtest?.timeline?.length) {
    const st = signalStability(data.backtest.timeline);
    if (st) {
      const fresh = st.holdMonths <= 1;
      const choppy = st.switches >= 4;
      items.push({
        icon: fresh ? "🆕" : st.holdMonths >= 6 ? "🪨" : "⏳",
        lead: fresh
          ? "Sinyal bu ay yeni döndü."
          : `Ana pozisyon ${st.holdMonths} aydır aynı.`,
        rest: fresh ? (
          <>
            Taze bir karar — bir-iki ay teyit beklemek gel-git (whipsaw) riskini
            azaltır.
          </>
        ) : st.holdMonths >= 6 ? (
          <>
            Uzun süredir aynı yönde duruyor; yerleşik bir trend — güçlü işaret.
            {choppy ? " Yine de son bir yıl biraz oynaktı." : ""}
          </>
        ) : (
          <>
            Orta yaşta bir sinyal.
            {choppy
              ? ` Son 12 ayda ${st.switches} kez yön değişti — piyasa oynak, sık işlem maliyet yaratır.`
              : " Yön nispeten istikrarlı."}
          </>
        ),
      });
    }
  }

  // 2) Genel hava — piyasa genişliği (kaç varlık yükselişte)
  {
    let pos = 0;
    let tot = 0;
    for (const u of data.universes)
      for (const s of u.momentum.stocks) {
        if (s.excessVsTbill != null) {
          tot++;
          if (s.excessVsTbill > 0) pos++;
        }
      }
    if (tot >= 10) {
      const br = pos / tot;
      const hava =
        br >= 0.6 ? "açık ve güneşli" : br >= 0.4 ? "karışık" : "kapalı ve riskli";
      items.push({
        icon: br >= 0.5 ? "🌤️" : "🌧️",
        lead: `Piyasanın genel havası: ${hava}.`,
        rest: (
          <>
            Takip ettiğimiz {tot} varlığın <b>%{(br * 100).toFixed(0)}</b>&apos;i
            şu an yükseliş eğiliminde.{" "}
            {br >= 0.6
              ? "Çoğunluk yukarı bakıyor — ortam risk almaya elverişli."
              : br >= 0.4
              ? "Yön belirsiz — acele karar verme."
              : "Çoğunluk aşağı bakıyor — kemerleri bağla, savunmada kal."}
          </>
        ),
      });
    }
  }

  // 3) Kaç strateji nakitte bekliyor
  {
    const cashUnis = data.universes.filter(
      (u) => u.momentum.stocks.filter((s) => s.selected).length === 0
    ).length;
    const totalCash = cashUnis + (isCash ? 1 : 0);
    const totalUni = data.universes.length + 1;
    items.push({
      icon: totalCash > 0 ? "⚠️" : "✅",
      lead:
        totalCash > 0
          ? `${totalCash} stratejimiz şu an nakitte bekliyor (${totalUni} taneden).`
          : "Tüm stratejiler şu an yatırımda.",
      rest:
        totalCash > 0 ? (
          <>
            Birçoğu aynı anda kenara çekildiyse piyasa zayıf demektir; pozisyon
            açarken bir adım temkinli ol.
          </>
        ) : (
          <>Hiçbiri nakde kaçmadı — yöntemlerin hepsi şu an &quot;devam&quot; diyor.</>
        ),
    });
  }

  // 4) Geçmişte en istikrarlı kazandıran yöntem (en yüksek Sharpe)
  {
    const strat: { name: string; emoji: string; sharpe: number; months: number }[] = [];
    if (data.backtest?.strategies[0]?.sharpe != null && data.backtest.months)
      strat.push({ name: "ETF Dual Momentum", emoji: "📊", sharpe: data.backtest.strategies[0].sharpe, months: data.backtest.months });
    for (const u of data.universes)
      if (u.backtest?.strategies[0]?.sharpe != null && u.backtest.months)
        strat.push({ name: u.positionLabel, emoji: u.emoji, sharpe: u.backtest.strategies[0].sharpe, months: u.backtest.months });
    // Adil kıyas: yalnız benzer (uzun) geçmişe sahip kohort içinde sırala —
    // kısa-geçmişli evrenler (kripto/BIST) sırf 2008'i atladığı için "en
    // istikrarlı" tahtına oturmasın. En az 2 aday kalmazsa tümüne düş.
    const maxM = Math.max(...strat.map((s) => s.months));
    const eligible = strat.filter((s) => s.months >= 0.8 * maxM);
    const pool = eligible.length >= 2 ? eligible : strat;
    const best = pool.sort((a, b) => b.sharpe - a.sharpe)[0];
    if (best) {
      const years = Math.round(best.months / 12);
      const short = best.months < 150; // ~12.5 yıl altı: 2008'i görmemiş olabilir
      items.push({
        icon: "🏆",
        lead: `Geçmişte en istikrarlı kazandıran yöntem: ${best.emoji} ${best.name}.`,
        rest: (
          <>
            Yani en az iniş-çıkışla en düzenli getiriyi bu sağlamış (
            <b>{years} yıllık</b> geçmiş
            {short
              ? ", kısa — 2008 gibi büyük krizleri görmemiş olabilir, kıyas tam adil değil"
              : ""}
            ). <i>Geçmiş performans geleceğin garantisi değildir.</i>
          </>
        ),
      });
    }
  }

  // 4b) En güçlü / en zayıf evren — bu ay nereye eğilim var (ayrıntı)
  {
    const ranked = data.universes
      .map((u) => {
        let pos = 0;
        let tot = 0;
        for (const s of u.momentum.stocks)
          if (s.excessVsTbill != null) {
            tot++;
            if (s.excessVsTbill > 0) pos++;
          }
        return { label: u.label, emoji: u.emoji, breadth: tot ? pos / tot : 0, tot };
      })
      .filter((r) => r.tot > 0)
      .sort((a, b) => b.breadth - a.breadth);
    if (ranked.length >= 3) {
      const s = ranked[0];
      const w = ranked[ranked.length - 1];
      items.push({
        icon: "🎯",
        lead: `Bu ay momentum en güçlü: ${s.emoji} ${s.label}.`,
        rest: (
          <>
            Varlıklarının <b>%{Math.round(s.breadth * 100)}</b>&apos;i yükselişte.
            En zayıf ise {w.emoji} {w.label} (%{Math.round(w.breadth * 100)}). İlgi
            ve risk iştahı şu an güçlü evrenlerde yoğun.
          </>
        ),
      });
    }
  }

  // 5) Yumurtaları tek sepete koyma — bileşik karışım
  if (data.composite?.equityCurves[0] && data.composite.strategies[0]) {
    const g = data.composite.equityCurves[0].growth;
    const mult = g[g.length - 1];
    const dd = data.composite.strategies[0].maxDrawdown;
    items.push({
      icon: "🧩",
      lead: "Tek bir şeye değil, hepsine birden yatır (bileşik karışım).",
      rest: (
        <>
          Tüm yöntemleri harmanlayınca para ortak dönemde <b>{mult.toFixed(1)}×</b>{" "}
          olmuş
          {dd != null ? (
            <>
              {" "}
              ve en kötü dönemde tepeden <b>%{Math.abs(dd * 100).toFixed(0)}</b>{" "}
              gerilemiş
            </>
          ) : null}
          . Yumurtaları tek sepete koymamak iniş-çıkışı yumuşatıyor.
        </>
      ),
    });
  }

  // 5c) Geçmiş 1-yıllık tutma ihtimalleri — dürüst beklenti (kötü dahil)
  if (data.composite?.equityCurves[0]) {
    const hh = holdHorizonStats(data.composite.equityCurves[0].growth, 12);
    if (hh) {
      const outOf10 = Math.round(hh.posFrac * 10);
      items.push({
        icon: "📅",
        lead: `Geçmişte 1 yıl tuttuğunda 10 denemenin ~${outOf10}'i kazançla bitmiş.`,
        rest: (
          <>
            Medyan 12 aylık getiri <b>%{(hh.median * 100).toFixed(0)}</b>; en
            kötü 12 ay <b className="neg">%{(hh.worst * 100).toFixed(0)}</b>, en
            iyisi <b className="pos-cell">%{(hh.best * 100).toFixed(0)}</b>.{" "}
            <i>Geçmiş, geleceğin garantisi değildir.</i>
          </>
        ),
      });
    }
  }

  // 5b) Şu an zirveden ne kadar uzaktayız (mevcut drawdown) — alış zamanlaması hissi
  if (data.composite?.equityCurves[0]) {
    const cd = curDrawdown(data.composite.equityCurves[0].growth);
    if (cd != null) {
      const down = Math.abs(cd * 100);
      items.push({
        icon: cd > -0.02 ? "🟢" : cd > -0.1 ? "🟡" : "🔴",
        lead:
          cd > -0.02
            ? "Şu an zirveye çok yakınız."
            : `Şu an en yüksek noktanın %${down.toFixed(0)} altındayız.`,
        rest:
          cd > -0.02 ? (
            <>
              Karışım yeni zirvelerde geziyor — trend sağlıklı, ama tampon az;
              sıkı takip et.
            </>
          ) : cd > -0.1 ? (
            <>
              Ilımlı bir geri çekilme — piyasanın normal nefeslenmesi, panik
              gerektirmez.
            </>
          ) : (
            <>
              Ciddi bir düşüş yaşanıyor; sistem büyük olasılıkla zaten savunmaya
              (nakde) geçmiştir. Sinyale uy, dipte tahmin oyunu oynama.
            </>
          ),
      });
    }
  }

  // 5d) Oynaklık rejimi — piyasa şu an sakin mi çalkantılı mı?
  if (data.composite?.equityCurves[0]) {
    const vr = volRegime(data.composite.equityCurves[0].growth, 6);
    if (vr) {
      const wild = vr.ratio > 1.3;
      const calm = vr.ratio < 0.8;
      items.push({
        icon: wild ? "🌪️" : calm ? "😌" : "🌊",
        lead: wild
          ? "Son aylar normalden çalkantılı."
          : calm
          ? "Son aylar normalden sakin."
          : "Oynaklık normal seviyede.",
        rest: (
          <>
            Son 6 ayın dalgalanması uzun-dönem ortalamasının{" "}
            <b>{vr.ratio.toFixed(1)} katı</b> (yıllık ~%
            {(vr.recentAnnual * 100).toFixed(0)}).{" "}
            {wild
              ? "Çalkantıda pozisyonu küçük tut, sinyale sıkı uy; tahmine kapılma."
              : calm
              ? "Sakin dönemler genelde trendlerin sürdüğü dönemlerdir."
              : "Olağan koşullar — plana sadık kal."}
          </>
        ),
      });
    }
  }

  // 5e) Hareketli-ortalama trend filtresi (Faber) — trend yukarı mı aşağı mı?
  if (data.composite?.equityCurves[0]) {
    const mt = maTrend(data.composite.equityCurves[0].growth, 10);
    if (mt) {
      const dist = (mt.ratio - 1) * 100;
      items.push({
        icon: mt.above ? "📈" : "📉",
        lead: mt.above
          ? "Bileşik strateji uzun-vadeli ortalamasının üstünde."
          : "Bileşik strateji uzun-vadeli ortalamasının altına indi.",
        rest: mt.above ? (
          <>
            10-aylık ortalamanın <b>%{dist.toFixed(0)}</b> üstünde — trend
            yukarı; klasik trend-takip kuralı &quot;devam&quot; der.
          </>
        ) : (
          <>
            10-aylık ortalamanın <b>%{Math.abs(dist).toFixed(0)}</b> altında —
            trend zayıflamış; klasik trend-takip (Faber) bu durumda riski
            azaltmayı önerir.
          </>
        ),
      });
    }
  }

  // 6) Düşüş koruması — 60/40 ile kıyas (varsa)
  {
    const b = data.benchmark6040;
    const comp = data.composite?.strategies[0];
    if (b?.maxDrawdown != null && comp?.maxDrawdown != null) {
      const ours = Math.abs(comp.maxDrawdown * 100);
      const theirs = Math.abs(b.maxDrawdown * 100);
      items.push({
        icon: "🛟",
        lead: "En güzel yanı: piyasa çakıldığında zararı sınırlaması.",
        rest: (
          <>
            En kötü dönemde bizim karışımımız <b>%{ours.toFixed(0)}</b>{" "}
            kaybetmiş; klasik &quot;%60 hisse + %40 tahvil&quot; portföyü ise{" "}
            <b>%{theirs.toFixed(0)}</b>.{" "}
            {ours < theirs
              ? "Yani kötü günde daha az acıtmış."
              : "Bu dönemde klasik portföy daha az düşmüş — fark küçükse normal."}
          </>
        ),
      });
    }
  }

  // 7) Küçük uyarı — en kırılgan sinyal (yakında nakde dönebilir)
  {
    const cands: { name: string; emoji: string; margin: number }[] = [];
    const gw = data.signals.assets.find((a) => a.isGemWinner);
    if (!isCash && gw?.excessVsTbill != null && gw.excessVsTbill > 0)
      cands.push({ name: "ana strateji", emoji: "📊", margin: gw.excessVsTbill });
    for (const u of data.universes) {
      const exc = u.momentum.stocks
        .filter((s) => s.selected)
        .map((s) => s.excessVsTbill)
        .filter((x): x is number => x != null && isFinite(x) && x > 0);
      if (exc.length)
        cands.push({ name: u.positionLabel, emoji: u.emoji, margin: Math.min(...exc) });
    }
    if (cands.length) {
      const thin = cands.reduce((a, b) => (b.margin < a.margin ? b : a));
      if (thin.margin < 0.03)
        items.push({
          icon: "🔎",
          lead: "Küçük uyarı: bir pozisyon zayıf zeminde.",
          rest: (
            <>
              {thin.emoji} <b>{thin.name}</b> seçimi şu an güvenli faizin yalnız
              kıl payı üstünde; küçük bir düşüşte gelecek ay nakde dönebilir.
              Sürpriz olmasın.
            </>
          ),
        });
    }
  }

  // 7b) 12-1 momentum kırılganlığı — yalnız seçili pozisyonlarda son-ay-taşıdı
  // uyarısı varsa görünür (koşullu; her zaman yer kaplamaz).
  {
    const fragile: string[] = [];
    // Manşet GEM seçimi de kontrol edilir (en önemli pozisyon).
    const gw = data.signals.assets.find((a) => a.isGemWinner);
    if (!isCash && gw && opposed(gw.mom121, gw.ret12m))
      fragile.push(`Ana strateji (${gw.name})`);
    for (const u of data.universes)
      for (const s of u.momentum.stocks)
        if (s.selected && opposed(s.mom121, s.ret12m)) fragile.push(s.name);
    if (fragile.length) {
      items.push({
        icon: "⚠️",
        lead: `Seçili pozisyonların ${fragile.length} tanesinde momentum kırılgan.`,
        rest: (
          <>
            {fragile.slice(0, 4).join(", ")}
            {fragile.length > 4 ? ` (+${fragile.length - 4})` : ""} —
            yükselişlerini büyük ölçüde son ay taşımış (12-1 ölçütü ters). Kısa-
            vadeli geri çekilme riski; bu pozisyonlara fazla yüklenme.
          </>
        ),
      });
    }
  }

  // 8) Altın kural — her zaman
  items.push({
    icon: "🧭",
    lead: "Altın kural.",
    rest: (
      <>
        Acele etme, parayı bölüştür, <b>ayda bir kez</b> buraya bakıp sinyal
        değiştiyse pozisyonu güncelle. Kaybetmeyi göze alamayacağın parayı riske
        atma.
      </>
    ),
  });

  let monthLabel = "";
  let asOfMonth = "";
  try {
    if (data.generatedAt)
      monthLabel = new Date(data.generatedAt).toLocaleDateString("tr-TR", {
        month: "long",
        year: "numeric",
      });
    // Sinyallerin dayandığı veri ayı (GEM backtest'in son ayı). Ay içinde bu
    // ay henüz tamamlanmamış olabilir → sinyal ay sonunda kesinleşir.
    const endDate = data.backtest?.endDate;
    if (endDate)
      asOfMonth = new Date(endDate).toLocaleDateString("tr-TR", {
        month: "long",
        year: "numeric",
      });
  } catch {
    /* tarih ayrıştırılamazsa damgayı atla */
  }

  const copyText = () => {
    const lines = [
      `Bu Ay Ne Yapmalı?${monthLabel ? ` — ${monthLabel}` : ""}`,
      `Genel Durum: ${verdict.label} — ${verdict.text}`,
      "",
      ...items.map((it) => `${it.icon} ${it.lead}`),
    ];
    try {
      void navigator.clipboard?.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* pano erişilemezse sessizce geç */
    }
  };

  return (
    <div className="advice">
      <div className="advice-head">
        <span className="advice-title">📋 Bu Ay Ne Yapmalı? — Sade Özet</span>
        {monthLabel && <span className="advice-month">{monthLabel}</span>}
        <span className="advice-sub">
          analizlerin en önemli sonuçları, jargon olmadan
        </span>
        <button
          className="advice-copy"
          onClick={copyText}
          title="Özeti düz metin olarak panoya kopyala"
          aria-label="Yatırım özetini panoya kopyala"
        >
          {copied ? "✓ Kopyalandı" : "⧉ Kopyala"}
        </button>
      </div>
      <div className={`advice-verdict ${verdict.cls}`}>
        <span className="av-icon" aria-hidden="true">
          {verdict.icon}
        </span>
        <span className="av-body">
          <b className="av-label">Genel Durum: {verdict.label}</b>
          <span className="av-text"> {verdict.text}</span>
        </span>
      </div>
      <ul className="advice-list">
        {items.map((it, i) => {
          const warn = ["⚠️", "🔴", "🌪️", "🔎", "📉"].includes(it.icon);
          const good = ["🟢", "✅", "😌", "📈"].includes(it.icon);
          // Varsayılan: ilk 5 çekirdek madde + tüm uyarılar + altın kural her
          // zaman görünür; daha derin analitik maddeleri katlanır (Ayşe teyze
          // önce özü görsün, ayrıntı isteğe bağlı). Uyarı asla gizlenmez.
          const collapsible = i >= 5 && !warn && it.icon !== "🧭";
          if (!showAll && collapsible) return null;
          return (
            <li key={i} className={warn ? "li-warn" : good ? "li-good" : ""}>
              <span className="advice-icon" aria-hidden="true">
                {it.icon}
              </span>
              <span>
                <b className="advice-lead">{it.lead}</b> {it.rest}
              </span>
            </li>
          );
        })}
      </ul>
      {(() => {
        const hidden = items.filter(
          (it, i) =>
            i >= 5 &&
            !["⚠️", "🔴", "🌪️", "🔎", "📉"].includes(it.icon) &&
            it.icon !== "🧭"
        ).length;
        if (!hidden) return null;
        return (
          <button
            className="advice-toggle"
            onClick={() => setShowAll((s) => !s)}
            aria-expanded={showAll}
          >
            {showAll ? "Daha az göster" : `+${hidden} ayrıntı daha göster`}
          </button>
        );
      })()}
      <p className="advice-foot">
        {asOfMonth && (
          <>
            Sinyaller <b>{asOfMonth}</b> ayı sonu (en güncel aylık kapanış)
            verisine dayanır; ay içinde değerler ay sonunda kesinleşir.{" "}
          </>
        )}
        Bu sayfa bizim iç kullanımımız için bir <b>karar-destek motoru</b>;
        sinyaller kurallı ve mekaniktir, kesin kâr vaadi değildir.
      </p>
    </div>
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

  // 4) Piyasa genişliği — pozitif mutlak momentumlu varlık oranı (risk-on/off)
  {
    let pos = 0;
    let tot = 0;
    for (const u of data.universes)
      for (const s of u.momentum.stocks) {
        if (s.excessVsTbill != null) {
          tot++;
          if (s.excessVsTbill > 0) pos++;
        }
      }
    if (tot >= 10) {
      const br = pos / tot;
      insights.push({
        icon: br >= 0.5 ? "📈" : "📉",
        text: (
          <>
            Piyasa genişliği: tüm evrenlerdeki <b>{tot}</b> varlığın{" "}
            <b>%{(br * 100).toFixed(0)}</b>&apos;i T-Bill&apos;i geçiyor (pozitif
            momentum) —{" "}
            {br >= 0.6
              ? "geniş risk-on ortamı"
              : br >= 0.4
              ? "karışık/nötr ortam"
              : "dar/savunmacı (risk-off) ortam"}
            .
          </>
        ),
      });
    }
  }

  // 5) En iyi çeşitlendirici (en düşük ortalama korelasyonlu sleeve)
  if (data.composite) {
    const sl = data.composite.equityCurves.filter(
      (c) => !c.highlight && !c.name.includes("Bileşik") && !c.name.includes("Pasif")
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

  // 6) En kırılgan sinyal (ince pay) — bu ay nakde dönmeye en yakın pozisyon
  {
    const cands: { name: string; emoji: string; margin: number }[] = [];
    const gw = data.signals.assets.find((a) => a.isGemWinner);
    if (
      data.gem.positionKey !== "cash" &&
      gw?.excessVsTbill != null &&
      gw.excessVsTbill > 0
    )
      cands.push({ name: "GEM", emoji: "📊", margin: gw.excessVsTbill });
    for (const u of data.universes) {
      const exc = u.momentum.stocks
        .filter((s) => s.selected)
        .map((s) => s.excessVsTbill)
        .filter((x): x is number => x != null && isFinite(x) && x > 0);
      if (exc.length)
        cands.push({ name: u.positionLabel, emoji: u.emoji, margin: Math.min(...exc) });
    }
    if (cands.length) {
      const thin = cands.reduce((a, b) => (b.margin < a.margin ? b : a));
      if (thin.margin < 0.03)
        insights.push({
          icon: "⚠️",
          text: (
            <>
              En kırılgan sinyal:{" "}
              <b>
                {thin.emoji} {thin.name}
              </b>{" "}
              seçimi T-Bill eşiğinin yalnız <b>+{(thin.margin * 100).toFixed(1)}%</b>{" "}
              üstünde — küçük bir geri çekilme bu pozisyonu nakde döndürebilir.
            </>
          ),
        });
    }
  }

  // 7) İstatistiksel güven — en yüksek Sharpe'lı stratejinin PSR'ı
  {
    const cand: {
      name: string;
      emoji: string;
      m: StrategyMetrics;
      months: number;
    }[] = [];
    if (data.backtest?.strategies[0] && data.backtest.months)
      cand.push({
        name: "GEM",
        emoji: "📊",
        m: data.backtest.strategies[0],
        months: data.backtest.months,
      });
    for (const u of data.universes)
      if (u.backtest?.strategies[0] && u.backtest.months)
        cand.push({
          name: u.positionLabel,
          emoji: u.emoji,
          m: u.backtest.strategies[0],
          months: u.backtest.months,
        });
    if (data.composite?.strategies[0] && data.composite.months)
      cand.push({
        name: "Bileşik",
        emoji: "🧩",
        m: data.composite.strategies[0],
        months: data.composite.months,
      });
    const withSharpe = cand.filter((c) => c.m.sharpe != null);
    if (withSharpe.length) {
      const top = withSharpe.reduce((a, b) =>
        (b.m.sharpe as number) > (a.m.sharpe as number) ? b : a
      );
      const psr = psrFromMetrics(top.m, top.months);
      if (psr != null) {
        insights.push({
          icon: psr >= 0.95 ? "🔬" : "❓",
          text: (
            <>
              İstatistiksel güven:{" "}
              <b>
                {top.emoji} {top.name}
              </b>{" "}
              stratejisinin Sharpe&apos;ı <b>%{(psr * 100).toFixed(0)}</b> olasılıkla
              gerçekte &gt; 0 (PSR — örneklem + çarpıklık + kuyruk düzeltmeli).{" "}
              {psr >= 0.95
                ? "yüksek güven: kenar şans eseri değil."
                : psr >= 0.9
                ? "makul ama kesin değil — daha uzun geçmiş güçlendirir."
                : "düşük güven: bu Sharpe kısa/çarpık örneklemden gelebilir."}
            </>
          ),
        });
      }
    }
  }

  // 8) 60/40 evrensel kıyas — bu karmaşık strateji sıkıcı standardı yeniyor mu?
  {
    const b = data.benchmark6040;
    const comp = data.composite?.strategies[0];
    if (b && comp && comp.sharpe != null && b.sharpe != null) {
      const beats = comp.sharpe > b.sharpe;
      insights.push({
        icon: beats ? "🏅" : "⚖️",
        text: (
          <>
            Bileşik vs <b>60/40</b> (evrensel standart, {b.months} ay): Sharpe{" "}
            <b>{num(comp.sharpe)}</b> vs <b>{num(b.sharpe)}</b> —{" "}
            {beats
              ? "dual momentum bileşiği sıkıcı 60/40'ı risk-ayarlı yeniyor."
              : "bu dönemde 60/40 risk-ayarlı bazda önde; ek karmaşıklık kendini kanıtlamalı."}
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

// Evrenler-arası "risk iştahı haritası": her evrende T-Bill eşiğini geçen
// (pozitif mutlak momentum) varlık oranı, güçlüden zayıfa sıralı. Bu ay momentum
// nerede geniş (risk-on), nerede dar (savunmacı)? Tek bakışta gösterir.
function UniverseMomentumStrength({ data }: { data: AnalysisResult }) {
  const rows = data.universes
    .map((u) => {
      let pos = 0;
      let tot = 0;
      for (const s of u.momentum.stocks)
        if (s.excessVsTbill != null) {
          tot++;
          if (s.excessVsTbill > 0) pos++;
        }
      return { label: u.label, emoji: u.emoji, breadth: tot ? pos / tot : 0, pos, tot };
    })
    .filter((r) => r.tot > 0);
  // ETF/GEM evreni (çekirdek varlıklar — buildStockMomentum kullanmaz, ayrı ekle).
  {
    let gpos = 0;
    let gtot = 0;
    for (const a of data.signals.assets)
      if (a.excessVsTbill != null) {
        gtot++;
        if (a.excessVsTbill > 0) gpos++;
      }
    if (gtot > 0)
      rows.push({ label: "ETF (GEM)", emoji: "📊", breadth: gpos / gtot, pos: gpos, tot: gtot });
  }
  rows.sort((a, b) => b.breadth - a.breadth);
  if (rows.length < 2) return null;
  const strongest = rows[0];
  const weakest = rows[rows.length - 1];
  return (
    <div className="chart-card">
      <div className="chart-title">
        Evren Momentum Gücü — bu ay nerede risk iştahı var?
      </div>
      <div className="chart-help">
        Her evrende T-Bill eşiğini geçen (pozitif mutlak momentum) varlık oranı.
        Yüksek = geniş katılım / risk-on; düşük = dar / savunmacı.{" "}
        <b>
          En güçlü: {strongest.emoji} {strongest.label}
        </b>
        ; en zayıf: {weakest.emoji} {weakest.label}.
      </div>
      <div className="ums-list">
        {rows.map((r) => {
          const p100 = Math.round(r.breadth * 100);
          const tone = r.breadth >= 0.6 ? "pos" : r.breadth >= 0.4 ? "mid" : "neg";
          return (
            <div className="ums-row" key={r.label}>
              <div className="ums-label">
                {r.emoji} {r.label}
              </div>
              <div className="ums-track">
                <div className={`ums-fill ${tone}`} style={{ width: `${p100}%` }} />
              </div>
              <div className="ums-val">
                %{p100} <span className="ums-sub">({r.pos}/{r.tot})</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConsolidatedSignals({ data }: { data: AnalysisResult }) {
  const gem = data.gem;
  const etfCash = gem.positionKey === "cash";
  const gemWinner = data.signals.assets.find((a) => a.isGemWinner);
  const gemMargin = etfCash ? null : gemWinner?.excessVsTbill ?? null;

  // Sinyal kırılganlığı: seçimin T-Bill eşiğine payı küçükse (≈ %3 altı) pozisyon
  // gelecek ay nakde dönebilir — kullanıcıya bu riski göster.
  const marginLine = (excess: number | null) => {
    if (excess == null || !isFinite(excess)) return null;
    const thin = excess < 0.03;
    return (
      <div
        className={`sig-margin ${thin ? "thin" : "ok"}`}
        title="Seçimin T-Bill eşiğine olan payı (en zayıf seçim). Küçükse sinyal kırılgan: gelecek ay nakde dönebilir."
      >
        {thin ? "⚠️ İnce pay" : "Pay"}: T-Bill +{(excess * 100).toFixed(1)}%
      </div>
    );
  };

  const downloadCsv = () => {
    const q = (s: string) => `"${s.replace(/"/g, "'")}"`;
    const lines = [
      "# Bu ayin sinyalleri — tum evrenlerde guncel secimler (12-ay dual momentum)",
      "Evren,Secimler,Durum,TBill_Pay_Yuzde",
    ];
    lines.push(
      [
        q("ETF (GEM)"),
        q(gem.positionName),
        etfCash ? "Nakit" : "Yatirimda",
        gemMargin != null ? (gemMargin * 100).toFixed(1) : "",
      ].join(",")
    );
    for (const u of data.universes) {
      const picks = u.momentum.stocks.filter((s) => s.selected);
      const exc = picks
        .map((s) => s.excessVsTbill)
        .filter((x): x is number => x != null && isFinite(x));
      const minExcess = exc.length ? Math.min(...exc) : null;
      lines.push(
        [
          q(u.label),
          q(picks.length ? picks.map((p) => p.ticker).join(" ") : "Nakit"),
          picks.length ? "Yatirimda" : "Nakit",
          minExcess != null ? (minExcess * 100).toFixed(1) : "",
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bu-ayin-sinyalleri-${data.generatedAt.slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="section-head">
        <div className="section-label" role="heading" aria-level={2}>
          Bu Ayın Sinyalleri — tüm evrenlerde güncel pozisyonlar
        </div>
        <button
          className="mini-btn"
          onClick={downloadCsv}
          title="Tüm evrenlerin bu ayki seçimlerini CSV indir"
          aria-label="Bu ayın sinyallerini CSV indir"
        >
          ⭳ CSV
        </button>
      </div>
      {(() => {
        const investedUni = data.universes.filter((u) =>
          u.momentum.stocks.some((s) => s.selected)
        ).length;
        const invested = investedUni + (etfCash ? 0 : 1);
        const total = data.universes.length + 1;
        const ratio = total > 0 ? invested / total : 0;
        return (
          <p className="table-note" style={{ marginTop: 0, marginBottom: 10 }}>
            Bu ay:{" "}
            <b className={ratio >= 0.6 ? "pos-cell" : ratio <= 0.4 ? "neg" : ""}>
              {invested}/{total}
            </b>{" "}
            evren yatırımda · <b>{total - invested}</b> nakitte —{" "}
            {ratio >= 0.6
              ? "geniş risk-on duruş"
              : ratio <= 0.4
              ? "savunmacı (risk-off) duruş"
              : "karışık/nötr duruş"}
            .
          </p>
        );
      })()}
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
          {marginLine(gemMargin)}
        </div>
        {data.universes.map((u) => {
          const picks = u.momentum.stocks.filter((s) => s.selected);
          const exc = picks
            .map((s) => s.excessVsTbill)
            .filter((x): x is number => x != null && isFinite(x));
          const minExcess = exc.length ? Math.min(...exc) : null;
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
              {picks.length ? marginLine(minExcess) : null}
            </div>
          );
        })}
      </div>
      <p className="table-note">
        Her evren için bu ay sonu itibarıyla dual momentum (göreceli + mutlak)
        seçimi. <b>Pay</b> = en zayıf seçimin T-Bill eşiğinin ne kadar üstünde
        olduğu; <b>⚠️ ince pay</b> (≈%3 altı) sinyalin kırılgan olduğunu, küçük
        bir geri çekilmenin pozisyonu nakde döndürebileceğini gösterir. Backtest
        stüdyosundan farklı look-back denemek için yukarıyı kullan; bu kartlar
        kitap-standardı 12 aya dayanır.
      </p>
    </>
  );
}

// Standart normal CDF (Abramowitz–Stegun 7.1.26)
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  let p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  p = x >= 0 ? 1 - p : p;
  return p;
}

// Probabilistic Sharpe Ratio (Bailey–López de Prado 2012) — StrategyMetrics'ten.
// Gözlenen Sharpe'ın gerçekte > 0 olma olasılığı; örneklem uzunluğu + çarpıklık +
// fazla-basıklık için düzeltilmiş. m.sharpe yıllık; m.kurtosis fazla-basıklık
// (normal=0). null = hesaplanamaz.
function psrFromMetrics(m: StrategyMetrics, months: number): number | null {
  if (m.sharpe == null || m.skewness == null || m.kurtosis == null) return null;
  if (!isFinite(months) || months < 24) return null;
  const srHat = m.sharpe / Math.sqrt(12); // aylık (yıllıklaştırılmamış)
  if (srHat <= 0) return 0; // pozitif olmayan Sharpe → güven ~0
  const g3 = m.skewness;
  const g4 = m.kurtosis + 3; // fazla → ham basıklık (normal=3)
  const varTerm = 1 - g3 * srHat + ((g4 - 1) / 4) * srHat * srHat;
  if (!isFinite(varTerm) || varTerm <= 0) return null;
  return normCdf((srHat * Math.sqrt(months - 1)) / Math.sqrt(varTerm));
}

// Ters standart normal CDF (probit) — Acklam'ın rasyonel yaklaşımı (~1e-9 hata)
function invNorm(p: number): number {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
    3.754408661907416e0,
  ];
  const pl = 0.02425;
  const ph = 1 - pl;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= ph) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

// Deflated Sharpe Ratio (Bailey–López de Prado 2014) — çoklu-deneme düzeltmesi.
// N strateji denendiğinde, şans eseri beklenen EN YÜKSEK Sharpe yükselir; DSR
// en iyi stratejiyi bu beklenen-maksimuma göre deflate eder. items = denenen
// stratejilerin metrik+ay sayıları. Yaklaşım: heterojen evrenler bağımsız
// deneme proxysi olarak kullanılır (saf BLdP aynı backtest'in konfigürasyonlarını
// varsayar) — yorum bu uyarıyla verilir.
function deflatedSharpe(
  items: { m: StrategyMetrics; months: number; name: string }[]
): { dsr: number; srStar0Ann: number; n: number; bestName: string; bestSharpe: number } | null {
  const valid = items.filter(
    (it) => it.m.sharpe != null && isFinite(it.m.sharpe as number) && it.months >= 24
  );
  const N = valid.length;
  if (N < 3) return null; // çok az deneme → DSR anlamsız
  const srs = valid.map((it) => (it.m.sharpe as number) / Math.sqrt(12)); // aylık
  const mean = srs.reduce((a, b) => a + b, 0) / N;
  const varSR = srs.reduce((a, b) => a + (b - mean) ** 2, 0) / (N - 1);
  if (!(varSR > 0)) return null;
  const sd = Math.sqrt(varSR);
  const EM = 0.5772156649015329; // Euler–Mascheroni
  // Beklenen maksimum Sharpe (null hipotez, N bağımsız deneme)
  const srStar0 =
    sd * ((1 - EM) * invNorm(1 - 1 / N) + EM * invNorm(1 - 1 / (N * Math.E)));
  // En yüksek Sharpe'lı strateji deflate edilir
  let best = valid[0];
  for (const it of valid)
    if ((it.m.sharpe as number) > (best.m.sharpe as number)) best = it;
  const srHat = (best.m.sharpe as number) / Math.sqrt(12);
  const g3 = best.m.skewness ?? 0;
  const g4 = (best.m.kurtosis ?? 0) + 3; // fazla → ham basıklık
  const varTerm = 1 - g3 * srHat + ((g4 - 1) / 4) * srHat * srHat;
  if (!isFinite(varTerm) || varTerm <= 0) return null;
  const dsr = normCdf(
    ((srHat - srStar0) * Math.sqrt(best.months - 1)) / Math.sqrt(varTerm)
  );
  return {
    dsr,
    srStar0Ann: srStar0 * Math.sqrt(12),
    n: N,
    bestName: best.name,
    bestSharpe: best.m.sharpe as number,
  };
}

function StrategyLeaderboard({ data }: { data: AnalysisResult }) {
  type SortKey = keyof StrategyMetrics | "psr";
  const [sortKey, setSortKey] = useState<SortKey>("sharpe");
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
  // Risk-parity varyantlarının ikisini de ekle (saf + tavanlı).
  const rpVariants =
    data.composite?.strategies.filter((s) => s.name.includes("risk-parity")) ??
    [];
  for (const rp of rpVariants) {
    if (data.composite)
      rows.push({
        name: rp.name,
        emoji: "🧩",
        m: rp,
        period: `${data.composite.startDate} → ${data.composite.endDate}`,
        months: data.composite.months,
      });
  }
  if (rows.length < 2) return null;
  // "Düşük daha iyi" metrikler artan sıralanır: Ulcer (az acı) ve yıllık geçiş
  // (az devir = düşük işlem maliyeti/vergi) — tabloda "en iyi üstte" tutarlılığı.
  const ASC_KEYS: Array<keyof StrategyMetrics> = ["ulcerIndex", "switchesPerYear"];
  const asc = sortKey !== "psr" && ASC_KEYS.includes(sortKey);
  const rowVal = (row: Row) => {
    if (sortKey === "psr") {
      const p = psrFromMetrics(row.m, row.months);
      return p == null ? -Infinity : p; // PSR yüksek = iyi
    }
    const v = row.m[sortKey];
    // Eksik değerler her iki yönde de sona düşsün.
    return typeof v === "number" && isFinite(v) ? v : asc ? Infinity : -Infinity;
  };
  rows.sort((a, b) => (asc ? rowVal(a) - rowVal(b) : rowVal(b) - rowVal(a)));

  const SortableTh = ({
    label,
    k,
    left,
  }: {
    label: string;
    k: SortKey;
    left?: boolean;
  }) => {
    const active = sortKey === k;
    return (
      <th
        className={`sortable ${left ? "left" : ""} ${active ? "sorted" : ""}`}
        onClick={() => setSortKey(k)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSortKey(k);
          }
        }}
        tabIndex={0}
        aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
        title="Sıralamak için tıkla veya Enter"
      >
        {label}
        {active ? " ▾" : ""}
      </th>
    );
  };

  return (
    <>
      <div className="section-label" role="heading" aria-level={2}>
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
              <SortableTh label="PSR" k="psr" />
              <SortableTh label="Sortino" k="sortino" />
              <SortableTh label="Max DD" k="maxDrawdown" />
              <SortableTh label="Ulcer" k="ulcerIndex" />
              <SortableTh label="Martin" k="martinRatio" />
              <SortableTh label="Toplam Getiri" k="totalReturn" />
              <SortableTh label="Yıllık Geçiş" k="switchesPerYear" />
              <th className="left">Dönem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className={`${i === 0 ? "row-hl" : ""} ${
                  r.emoji === "🧩" ? "comp-row" : ""
                }`}
              >
                <td className="rank">{i + 1}</td>
                <td className="left">
                  {r.emoji} {r.name}
                </td>
                <td>{pct(r.m.cagr)}</td>
                <td className="strong">{num(r.m.sharpe)}</td>
                <td>
                  {(() => {
                    const p = psrFromMetrics(r.m, r.months);
                    return p == null ? (
                      "—"
                    ) : (
                      <span className={p >= 0.95 ? "pos-cell" : p < 0.9 ? "neg" : ""}>
                        {pct(p, 0)}
                      </span>
                    );
                  })()}
                </td>
                <td>{num(r.m.sortino)}</td>
                <td className="neg">{pct(r.m.maxDrawdown)}</td>
                <td className="neg">
                  {r.m.ulcerIndex != null ? r.m.ulcerIndex.toFixed(1) : "—"}
                </td>
                <td className="strong">{num(r.m.martinRatio ?? null)}</td>
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
        al-tut benchmark'ını ilgili sekmede görebilirsin. <b>PSR</b> = Sharpe&apos;ın
        gerçekte &gt; 0 olma olasılığı (yüksek = istatistiksel olarak sağlam;
        kısa/çarpık/şişman-kuyruklu seride yüksek Sharpe cezalandırılır —
        Bailey–López de Prado 2012). %95+ yeşil, %90&apos;ın altı kırmızı.
      </p>
      {(() => {
        const ds = deflatedSharpe(
          rows.map((r) => ({ m: r.m, months: r.months, name: `${r.emoji} ${r.name}` }))
        );
        if (!ds) return null;
        const ok = ds.dsr >= 0.95;
        const weak = ds.dsr < 0.9;
        return (
          <p className="table-note" style={{ marginTop: 6 }}>
            🧪 <b>Deflated Sharpe (çoklu-deneme düzeltmesi)</b>: {ds.n} strateji
            karşılaştırıldı; şans eseri beklenen <i>en yüksek</i> yıllık Sharpe ≈{" "}
            <b>{num(ds.srStar0Ann)}</b>. En iyi strateji ({ds.bestName}, Sharpe{" "}
            {num(ds.bestSharpe)}) bu eşiğe göre deflate edildiğinde{" "}
            <b className={ok ? "pos-cell" : weak ? "neg" : ""}>
              DSR = {pct(ds.dsr, 0)}
            </b>{" "}
            —{" "}
            {ok
              ? "en iyi sonuç çoklu-denemeden arındırıldığında bile anlamlı (şans eseri parlamadı)."
              : weak
              ? "çoklu-deneme arındırınca anlam zayıflıyor: en iyi Sharpe kısmen seçim-yanlılığı olabilir."
              : "sınırda — çoklu-deneme sonrası anlam marjı dar."}{" "}
            <span style={{ opacity: 0.7 }}>
              (Yaklaşım: farklı evrenler bağımsız deneme proxysi; saf BLdP aynı
              backtest&apos;in parametre taramasını varsayar.)
            </span>
          </p>
        );
      })()}
    </>
  );
}

// Strateji−benchmark aylık fark serisinin t-istatistiği: üstünlük şanstan
// ayırt edilebilir mi? t = ortalama / (sd/√n). |t|>1.96 ≈ %95 anlamlılık.
function excessTStat(
  bt: BacktestResult | null
): { t: number; ir: number; meanMonthly: number; n: number } | null {
  if (!bt) return null;
  const strat = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  // Benchmark: önce eşit-ağırlık al-tut (MomentumValueAdd tablosuyla TUTARLI),
  // yoksa tekil al-tut/endeks, yoksa ilk vurgusuz eğri. GEM'de hem tekil varlık
  // hem eşit-ağırlık eğrisi var; eşit-ağırlığı seçmek satır-içi tutarlılık sağlar.
  const bench =
    bt.equityCurves.find((c) => !c.highlight && /Eşit[\s-]Ağırlık/i.test(c.name)) ??
    bt.equityCurves.find(
      (c) => !c.highlight && /Al-Tut|Buy.?Hold|SPY|ACWI/i.test(c.name)
    ) ??
    bt.equityCurves.find((c) => !c.highlight);
  if (!strat || !bench) return null;
  const sMap = new Map<string, number>();
  for (let i = 1; i < strat.growth.length && i < bt.dates.length; i++)
    sMap.set(bt.dates[i].slice(0, 7), strat.growth[i] / strat.growth[i - 1] - 1);
  const bMap = new Map<string, number>();
  for (let i = 1; i < bench.growth.length && i < bt.dates.length; i++)
    bMap.set(bt.dates[i].slice(0, 7), bench.growth[i] / bench.growth[i - 1] - 1);
  const diffs: number[] = [];
  for (const [ym, sr] of sMap) {
    const br = bMap.get(ym);
    if (br != null) diffs.push(sr - br);
  }
  const n = diffs.length;
  if (n < 13) return null;
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const variance = diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  if (sd <= 0) return null;
  // Bilgi Oranı (Information Ratio): yıllık aktif getiri / yıllık takip hatası
  // = (ort·12) / (sd·√12) = ort·√12/sd. Aktif yönetimin standart kalite ölçüsü.
  return {
    t: mean / (sd / Math.sqrt(n)),
    ir: (mean * Math.sqrt(12)) / sd,
    meanMonthly: mean,
    n,
  };
}

// |t|'ye göre anlamlılık işareti (iki-yönlü)
function sigMark(t: number): string {
  const a = Math.abs(t);
  if (a >= 2.576) return "✓✓"; // %99
  if (a >= 1.96) return "✓"; // %95
  if (a >= 1.645) return "~"; // %90
  return "·";
}

function MomentumDispersion({ data }: { data: AnalysisResult }) {
  // Kesitsel momentum dağılımı: bir evrendeki varlıkların 12-ay getirileri ne
  // kadar ayrışıyor? Yüksek dağılım → relative momentum'un seçecek "lider-takipçi
  // farkı" büyük; düşük → varlıklar birlikte hareket eder, sıralama kırılgan.
  type Row = { emoji: string; label: string; disp: number; n: number };
  const rows: Row[] = [];
  const addRow = (emoji: string, label: string, rets: (number | null)[]) => {
    const xs = rets.filter((x): x is number => x != null && isFinite(x));
    if (xs.length < 3) return;
    const m = xs.reduce((s, v) => s + v, 0) / xs.length;
    const sd = Math.sqrt(
      xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1)
    );
    rows.push({ emoji, label, disp: sd, n: xs.length });
  };
  addRow(
    "📊",
    "ETF (GEM)",
    data.signals.assets.map((a) => a.ret12m)
  );
  for (const u of data.universes)
    addRow(
      u.emoji,
      u.label,
      u.momentum.stocks.map((s) => s.ret12m)
    );
  if (rows.length < 2) return null;
  rows.sort((a, b) => b.disp - a.disp);
  const max = rows[0].disp || 1;
  const lo = rows[rows.length - 1];

  return (
    <div className="chart-card">
      <div className="chart-title">
        📊 Momentum Dağılımı — relative momentum şu an ne kadar ayırt edici?
      </div>
      <div className="chart-help">
        Her evrenin varlıklarının son 12-ay getirileri arasındaki{" "}
        <b>kesitsel standart sapma</b>. <b>Yüksek</b> = lider ile takipçi arasında
        büyük fark → relative momentum seçimi daha anlamlı/güçlü. <b>Düşük</b> =
        varlıklar birlikte hareket ediyor → sıralama daha kırılgan, momentum katma
        değeri zayıf. (Yüksek-dağılım dönemleri, momentumun tarihsel olarak daha iyi
        çalıştığı dönemlerdir.)
      </div>
      <div>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 8, margin: "3px 0" }}
          >
            <span
              style={{
                width: 160,
                fontSize: 13,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {r.emoji} {r.label}
            </span>
            <span
              style={{
                flex: 1,
                background: "rgba(148,163,184,0.15)",
                borderRadius: 4,
                height: 14,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(r.disp / max) * 100}%`,
                  background:
                    i === 0
                      ? "#34d399"
                      : i === rows.length - 1
                      ? "#f87171"
                      : "#60a5fa",
                  borderRadius: 4,
                }}
              />
            </span>
            <span
              style={{
                width: 56,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
                fontSize: 13,
              }}
            >
              {pct(r.disp, 0)}
            </span>
          </div>
        ))}
      </div>
      <div className="rob-verdict ok" style={{ marginTop: 8 }}>
        En ayırt edici:{" "}
        <b>
          {rows[0].emoji} {rows[0].label}
        </b>{" "}
        (dağılım {pct(rows[0].disp, 0)}) — relative momentum burada en güçlü sinyali
        veriyor · en az ayrışan:{" "}
        <b>
          {lo.emoji} {lo.label}
        </b>{" "}
        ({pct(lo.disp, 0)}) — burada seçim daha kırılgan.
      </div>
    </div>
  );
}

function MomentumValueAdd({ data }: { data: AnalysisResult }) {
  type Row = {
    label: string;
    emoji: string;
    mom: StrategyMetrics;
    bench: StrategyMetrics;
    tstat: number | null;
    ir: number | null;
  };
  const rows: Row[] = [];
  const add = (label: string, emoji: string, bt: BacktestResult | null) => {
    if (!bt || bt.strategies.length < 2) return;
    const mom = bt.strategies[0];
    // Benchmark = eşit-ağırlık al-tut. Per-evren "Eşit Ağırlık" (boşluk),
    // bileşik "Pasif Eşit-Ağırlık" (tire) — ikisini de yakala.
    const bench =
      bt.strategies.find((s) => /Eşit[\s-]Ağırlık/.test(s.name)) ??
      bt.strategies[bt.strategies.length - 1];
    if (mom && bench) {
      const ex = excessTStat(bt);
      rows.push({ label, emoji, mom, bench, tstat: ex?.t ?? null, ir: ex?.ir ?? null });
    }
  };
  add("ETF (GEM)", "📊", data.backtest);
  for (const u of data.universes) add(u.label, u.emoji, u.backtest);
  add("Bileşik (meta-strateji)", "🧩", data.composite);
  if (rows.length < 2) return null;

  const wins = rows.filter(
    (r) => (r.mom.cagr ?? 0) > (r.bench.cagr ?? 0)
  ).length;

  return (
    <>
      <div className="section-label" role="heading" aria-level={2}>
        Momentum Al-Tut&apos;u Yeniyor mu? — her evrende momentum vs eşit-ağırlık
        al-tut
      </div>
      <p className="table-note" style={{ marginTop: 0, marginBottom: 10 }}>
        Özet:{" "}
        <b className={wins >= rows.length * 0.6 ? "pos-cell" : wins <= rows.length * 0.4 ? "neg" : ""}>
          {wins}/{rows.length}
        </b>{" "}
        strateji momentum ile al-tut&apos;u CAGR&apos;da geçiyor —{" "}
        {wins >= rows.length * 0.6
          ? "momentum geniş ölçüde değer katıyor."
          : wins <= rows.length * 0.4
          ? "bu dönemde momentum sınırlı değer katıyor (risk-ayarlı/düşüş-koruma farkına da bak)."
          : "karışık tablo — Sharpe/IR ile risk-ayarlı katkıyı değerlendir."}
      </p>
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
              <th>Bilgi Oranı (IR)</th>
              <th>Aylık Fark t-stat</th>
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
                  <td
                    className={
                      r.ir == null ? "" : r.ir >= 0 ? "pos-cell" : "neg"
                    }
                    title="Yıllık aktif getiri ÷ takip hatası. >0.5 iyi, >1 mükemmel aktif yönetim."
                  >
                    {r.ir == null ? "—" : `${r.ir >= 0 ? "+" : ""}${r.ir.toFixed(2)}`}
                  </td>
                  <td
                    className={
                      r.tstat == null
                        ? ""
                        : r.tstat >= 1.645
                        ? "pos-cell"
                        : r.tstat <= -1.645
                        ? "neg"
                        : ""
                    }
                    title={
                      r.tstat == null
                        ? "Yetersiz veri"
                        : `t=${r.tstat.toFixed(2)} — |t|>1.96 ≈ %95, >2.58 ≈ %99 anlamlılık`
                    }
                  >
                    {r.tstat == null
                      ? "—"
                      : `${r.tstat.toFixed(2)} ${sigMark(r.tstat)}`}
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
                  {(() => {
                    const irs = rows
                      .map((r) => r.ir)
                      .filter((x): x is number => x != null && isFinite(x));
                    const avgIr = irs.length
                      ? irs.reduce((s, x) => s + x, 0) / irs.length
                      : null;
                    return (
                      <td
                        className={
                          avgIr == null ? "" : avgIr >= 0 ? "pos-cell strong" : "neg strong"
                        }
                      >
                        {avgIr == null
                          ? "—"
                          : `${avgIr >= 0 ? "+" : ""}${avgIr.toFixed(2)}`}
                      </td>
                    );
                  })()}
                  {(() => {
                    const sig = rows.filter(
                      (r) => r.tstat != null && Math.abs(r.tstat) >= 1.96
                    ).length;
                    const tot = rows.filter((r) => r.tstat != null).length;
                    return (
                      <td className="strong" title="%95 düzeyinde anlamlı evren sayısı">
                        {sig}/{tot} anlamlı
                      </td>
                    );
                  })()}
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
        faydası burada görülür. <b>Bilgi Oranı (IR):</b> yıllık aktif getiri ÷
        takip hatası (momentum − al-tut farkının tutarlılığı, getiri biriminde) —
        aktif yönetimin standart kalite ölçüsü; <b>&gt;0.5 iyi, &gt;1 mükemmel</b>.{" "}
        <b>Aylık Fark t-stat:</b> aylık (momentum −
        al-tut) getiri farkının t-istatistiği — üstünlük sıfırdan istatistiksel
        olarak ayırt edilebiliyor mu? <b>✓</b> = %95, <b>✓✓</b> = %99, <b>~</b> =
        %90, <b>·</b> = anlamsız. Not: aylık getiriler oto-korelasyonlu olabilir,
        bu yüzden basit t-stat anlamlılığı bir miktar abartabilir (Newey-West daha
        muhafazakâr olurdu); yön ve büyüklük göstergesi olarak yorumla.
      </p>
    </>
  );
}

function MarginalContribution({ data }: { data: AnalysisResult }) {
  // Her sleeve'in bileşiğe MARJİNAL katkısı: leave-one-out. Tüm sleeve'lerin
  // SABİT ortak döneminde (adil kıyas) önce hepsiyle, sonra her birini çıkararak
  // bileşik hesaplanır; fark = o sleeve'in katkısı. Pozitif = sleeve değer katıyor.
  const sleeves: {
    id: string;
    label: string;
    emoji: string;
    map: Map<string, number>;
  }[] = [];
  const add = (
    id: string,
    label: string,
    emoji: string,
    bt: BacktestResult | null
  ) => {
    if (!bt) return;
    const c = bt.equityCurves.find((x) => x.highlight) ?? bt.equityCurves[0];
    if (!c) return;
    const m = new Map<string, number>();
    for (let i = 1; i < c.growth.length && i < bt.dates.length; i++)
      m.set(bt.dates[i].slice(0, 7), c.growth[i] / c.growth[i - 1] - 1);
    if (m.size > 12) sleeves.push({ id, label, emoji, map: m });
  };
  add("etf", "GEM", "📊", data.backtest);
  for (const u of data.universes)
    add(
      u.id,
      u.positionLabel.replace(" Momentum", "").replace(" (DMSR)", ""),
      u.emoji,
      u.backtest
    );
  if (sleeves.length < 3) return null;

  // Tüm sleeve'lerin ORTAK dönemi (sabit pencere → adil marjinal atıf)
  const common = Array.from(sleeves[0].map.keys())
    .filter((ym) => sleeves.every((s) => s.map.has(ym)))
    .sort();
  if (common.length < 18) return null;

  const metrics = (ids: string[]) => {
    const chosen = sleeves.filter((s) => ids.includes(s.id));
    if (!chosen.length) return null;
    const r = common.map(
      (ym) =>
        chosen.reduce((acc, s) => acc + (s.map.get(ym) as number), 0) /
        chosen.length
    );
    const n = r.length;
    let eq = 1;
    let peak = 1;
    let maxdd = 0;
    for (const x of r) {
      eq *= 1 + x;
      if (eq > peak) peak = eq;
      const dd = eq / peak - 1;
      if (dd < maxdd) maxdd = dd;
    }
    const cagr = Math.pow(eq, 12 / n) - 1;
    const mean = r.reduce((a, b) => a + b, 0) / n;
    const vol = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) *
      Math.sqrt(12);
    const calmar = maxdd < 0 ? cagr / Math.abs(maxdd) : null;
    const rv = vol > 0 ? cagr / vol : null; // getiri/oynaklık (rf-siz Sharpe vekili)
    return { cagr, vol, maxdd, calmar, rv };
  };

  const allIds = sleeves.map((s) => s.id);
  const full = metrics(allIds);
  if (!full) return null;

  const rows = sleeves
    .map((s) => {
      const without = metrics(allIds.filter((id) => id !== s.id));
      return {
        emoji: s.emoji,
        label: s.label,
        dRV:
          without && full.rv != null && without.rv != null
            ? full.rv - without.rv
            : null,
        dCalmar:
          without && full.calmar != null && without.calmar != null
            ? full.calmar - without.calmar
            : null,
        dMaxdd: without ? full.maxdd - without.maxdd : null, // + => çıkarınca DD derinleşti (sleeve koruyucu)
      };
    })
    .sort((a, b) => (b.dRV ?? -Infinity) - (a.dRV ?? -Infinity));

  const best = rows[0];
  const drag = rows.filter((r) => (r.dRV ?? 0) < 0);
  const sg = (v: number | null, d = 2) =>
    v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}`;

  return (
    <div className="chart-card">
      <div className="chart-title">
        🧮 Marjinal Sleeve Katkısı — her evren bileşiğe değer katıyor mu? (leave-one-out)
      </div>
      <div className="chart-help">
        Tüm sleeve&apos;lerin <b>sabit ortak döneminde</b> ({common.length} ay,{" "}
        {common[0]}→{common[common.length - 1]}), önce tüm sleeve&apos;lerle, sonra
        her birini <b>tek tek çıkararak</b> eşit-ağırlık bileşik yeniden hesaplanır.
        Değerler = tam bileşik − o sleeve&apos;siz bileşik. <b>Pozitif Δ Getiri/Vol</b>{" "}
        = sleeve risk-ayarlı getiriyi artırıyor; <b>pozitif Δ MaxDD</b> = çıkarınca
        düşüş derinleşiyor (sleeve koruyucu). Negatif = sleeve bileşiği zayıflatıyor.
      </div>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th className="left">Sleeve</th>
              <th>Δ Getiri/Vol</th>
              <th>Δ Calmar</th>
              <th>Δ MaxDD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="left">
                  {r.emoji} {r.label}
                </td>
                <td className={(r.dRV ?? 0) >= 0 ? "pos-cell" : "neg"}>
                  {sg(r.dRV)}
                </td>
                <td className={(r.dCalmar ?? 0) >= 0 ? "pos-cell" : "neg"}>
                  {sg(r.dCalmar)}
                </td>
                <td className={(r.dMaxdd ?? 0) >= 0 ? "pos-cell" : "neg"}>
                  {r.dMaxdd == null ? "—" : `${r.dMaxdd >= 0 ? "+" : ""}${pct(r.dMaxdd, 1)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`rob-verdict ${drag.length ? "thin" : "ok"}`}>
        En değerli katkı:{" "}
        <b>
          {best.emoji} {best.label}
        </b>{" "}
        (Δ getiri/vol {sg(best.dRV)}).{" "}
        {drag.length
          ? `Risk-ayarlı getiriyi düşüren sleeve(ler): ${drag
              .map((r) => `${r.emoji} ${r.label}`)
              .join(", ")} — çıkarmak bileşiği iyileştirebilir (ama çeşitlendirme/koruma açısından Δ MaxDD'ye de bak).`
          : "tüm sleeve'ler risk-ayarlı getiriye pozitif katkı veriyor."}
      </div>
    </div>
  );
}

function CustomComposite({ data }: { data: AnalysisResult }) {
  const sleeves = useMemo(() => {
    const list: {
      id: string;
      label: string;
      emoji: string;
      map: Map<string, number>;
    }[] = [];
    const add = (id: string, label: string, emoji: string, bt: BacktestResult | null) => {
      if (!bt) return;
      const c = bt.equityCurves.find((x) => x.highlight) ?? bt.equityCurves[0];
      if (!c) return;
      const m = new Map<string, number>();
      for (let i = 1; i < c.growth.length && i < bt.dates.length; i++)
        m.set(bt.dates[i].slice(0, 7), c.growth[i] / c.growth[i - 1] - 1);
      if (m.size > 12) list.push({ id, label, emoji, map: m });
    };
    add("etf", "GEM", "📊", data.backtest);
    for (const u of data.universes)
      add(
        u.id,
        u.positionLabel.replace(" Momentum", "").replace(" (DMSR)", ""),
        u.emoji,
        u.backtest
      );
    return list;
  }, [data]);

  const allIds = sleeves.map((s) => s.id).join(",");
  const [sel, setSel] = useState<Set<string>>(() => new Set(sleeves.map((s) => s.id)));
  // Veri yenilenip sleeve kümesi değişirse seçimi tüm sleeve'lere sıfırla.
  useEffect(() => {
    setSel(new Set(allIds ? allIds.split(",") : []));
  }, [allIds]);

  const metricsOf = useCallback(
    (ids: Set<string>) => {
      const chosen = sleeves.filter((s) => ids.has(s.id));
      if (chosen.length < 1) return null;
      const common = Array.from(chosen[0].map.keys())
        .filter((ym) => chosen.every((s) => s.map.has(ym)))
        .sort();
      if (common.length < 13) return null;
      const r = common.map(
        (ym) =>
          chosen.reduce((acc, s) => acc + (s.map.get(ym) as number), 0) /
          chosen.length
      );
      const n = r.length;
      let eq = 1,
        peak = 1,
        maxdd = 0;
      const growth: number[] = [1];
      for (const x of r) {
        eq *= 1 + x;
        growth.push(eq);
        if (eq > peak) peak = eq;
        const dd = eq / peak - 1;
        if (dd < maxdd) maxdd = dd;
      }
      const cagr = Math.pow(eq, 12 / n) - 1;
      const mean = r.reduce((a, b) => a + b, 0) / n;
      const variance = r.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
      const vol = Math.sqrt(variance) * Math.sqrt(12);
      const calmar = maxdd < 0 ? cagr / Math.abs(maxdd) : null;
      return {
        cagr,
        vol,
        maxdd,
        calmar,
        n,
        from: common[0],
        to: common[common.length - 1],
        k: chosen.length,
        growth,
        dates: [common[0], ...common],
      };
    },
    [sleeves]
  );

  const cur = useMemo(() => metricsOf(sel), [metricsOf, sel]);
  const full = useMemo(
    () => metricsOf(new Set(sleeves.map((s) => s.id))),
    [metricsOf, sleeves]
  );

  if (sleeves.length < 2) return null;

  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const delta = (a: number | null | undefined, b: number | null | undefined) =>
    a == null || b == null ? null : a - b;

  return (
    <>
      <div className="section-label" role="heading" aria-level={2}>
        🧪 Özel Bileşik Oluşturucu — hangi evrenler dahil olsun?
      </div>
      <div className="chart-card">
        <div className="chart-help">
          Sleeve&apos;leri aç/kapat; eşit-ağırlık bileşik <b>ortak dönemde</b>{" "}
          anında yeniden hesaplanır. &quot;Kriptoyu çıkarırsam Calmar ne olur?&quot;
          gibi soruları dene. Calmar (CAGR ÷ |MaxDD|) risksiz-oran gerektirmez,
          adil kıyastır.
        </div>
        <div className="cc-toggles">
          {sleeves.map((s) => {
            const on = sel.has(s.id);
            return (
              <button
                key={s.id}
                className={`cc-toggle ${on ? "on" : ""}`}
                aria-pressed={on}
                onClick={() => toggle(s.id)}
              >
                {s.emoji} {s.label}
              </button>
            );
          })}
        </div>
        {cur ? (
          <>
            {(() => {
              const g = cur.growth;
              const W = 820,
                H = 168,
                padL = 46,
                padR = 12,
                padT = 10,
                padB = 22;
              const innerW = W - padL - padR;
              const innerH = H - padT - padB;
              const logs = g.map((v) => Math.log(Math.max(v, 1e-9)));
              const lo = Math.min(...logs);
              const hi = Math.max(...logs);
              const span = hi - lo || 1;
              const X = (i: number) =>
                padL + (innerW * i) / Math.max(1, g.length - 1);
              const Y = (lv: number) => padT + innerH * (1 - (lv - lo) / span);
              const path = logs
                .map(
                  (lv, i) =>
                    `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(lv).toFixed(1)}`
                )
                .join(" ");
              const yTicks = [lo, (lo + hi) / 2, hi].map((lv) => ({
                lv,
                mult: Math.exp(lv),
              }));
              const xticks: { i: number; label: string }[] = [];
              let ly = "";
              cur.dates.forEach((d, i) => {
                const y = d.slice(0, 4);
                if (y !== ly) {
                  xticks.push({ i, label: y });
                  ly = y;
                }
              });
              const step = Math.ceil(xticks.length / 9);
              const shown = xticks.filter((_, idx) => idx % step === 0);
              return (
                <svg
                  className="equity-svg"
                  viewBox={`0 0 ${W} ${H}`}
                  role="img"
                  aria-label="Seçili özel bileşiğin log-büyüme eğrisi"
                  style={{ marginBottom: 8 }}
                >
                  {yTicks.map((t, i) => (
                    <g key={i}>
                      <line
                        x1={padL}
                        x2={W - padR}
                        y1={Y(t.lv)}
                        y2={Y(t.lv)}
                        className="grid-line"
                      />
                      <text
                        x={padL - 6}
                        y={Y(t.lv) + 3}
                        className="axis-label"
                        textAnchor="end"
                      >
                        {t.mult.toFixed(t.mult >= 10 ? 0 : 1)}×
                      </text>
                    </g>
                  ))}
                  <path
                    d={path}
                    className="equity-line"
                    stroke="#22d3a6"
                    style={{ strokeWidth: 2 }}
                  />
                  {shown.map((t, idx) => (
                    <text
                      key={idx}
                      x={X(t.i)}
                      y={H - 6}
                      className="axis-label"
                      textAnchor="middle"
                    >
                      {t.label}
                    </text>
                  ))}
                </svg>
              );
            })()}
            <div className="cap-grid">
              <div className="cap-item">
                <div className="cap-label">CAGR</div>
                <div className={`cap-val ${cur.cagr >= 0 ? "pos" : "neg"}`}>
                  {pct(cur.cagr)}
                </div>
              </div>
              <div className="cap-item">
                <div className="cap-label">Yıllık Vol</div>
                <div className="cap-val">{pct(cur.vol)}</div>
              </div>
              <div className="cap-item">
                <div className="cap-label">Max Drawdown</div>
                <div className="cap-val neg">{pct(cur.maxdd)}</div>
              </div>
              <div className="cap-item">
                <div className="cap-label">Calmar</div>
                <div className="cap-val">{num(cur.calmar)}</div>
              </div>
            </div>
            <p className="table-note">
              {cur.k} sleeve · ortak dönem {cur.from} → {cur.to} ({cur.n} ay).
              {full && (
                <>
                  {" "}
                  Tam bileşiğe ({full.k} sleeve) göre:{" "}
                  <b
                    className={
                      (delta(cur.calmar, full.calmar) ?? 0) >= 0 ? "pos-cell" : "neg"
                    }
                  >
                    Calmar {(delta(cur.calmar, full.calmar) ?? 0) >= 0 ? "+" : ""}
                    {num(delta(cur.calmar, full.calmar))}
                  </b>
                  ,{" "}
                  <b
                    className={
                      (delta(cur.maxdd, full.maxdd) ?? 0) >= 0 ? "pos-cell" : "neg"
                    }
                  >
                    MaxDD {(delta(cur.maxdd, full.maxdd) ?? 0) >= 0 ? "+" : ""}
                    {pct(delta(cur.maxdd, full.maxdd))}
                  </b>
                  . (Not: ortak dönem seçime göre değişebilir; kıyası bu
                  uyarıyla yorumla.)
                </>
              )}
            </p>
          </>
        ) : (
          <p className="table-note">
            En az 2 sleeve seç (ve yeterli ortak veri geçmişi gerekir).
          </p>
        )}
      </div>
    </>
  );
}

function CrossUniverseRiskReturn({ data }: { data: AnalysisResult }) {
  type Ser = {
    label: string;
    emoji: string;
    growthMap: Map<string, number>;
    hl: boolean;
    bench: boolean;
  };
  const sers: Ser[] = [];
  const add = (
    label: string,
    emoji: string,
    bt: BacktestResult | null,
    opts?: { curveName?: string; hl?: boolean; bench?: boolean }
  ) => {
    if (!bt) return;
    const curve = opts?.curveName
      ? bt.equityCurves.find((c) => c.name.includes(opts.curveName as string))
      : bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
    if (!curve) return;
    const m = new Map<string, number>();
    for (let i = 0; i < bt.dates.length && i < curve.growth.length; i++)
      m.set(bt.dates[i].slice(0, 7), curve.growth[i]);
    sers.push({ label, emoji, growthMap: m, hl: !!opts?.hl, bench: !!opts?.bench });
  };
  add("GEM", "📊", data.backtest);
  for (const u of data.universes)
    add(
      u.positionLabel.replace(" Momentum", "").replace(" (DMSR)", ""),
      u.emoji,
      u.backtest
    );
  add("Bileşik", "🧩", data.composite, { hl: true });
  add("Pasif", "⚪", data.composite, { curveName: "Pasif", bench: true });
  // 60/40 evrensel referans noktası (SPY/AGG) — risk-getiri uzayında nerede?
  if (data.benchmark6040 && data.composite) {
    const m = new Map<string, number>();
    const dts = data.composite.dates;
    const gr = data.benchmark6040.growth;
    for (let i = 0; i < dts.length && i < gr.length; i++)
      m.set(dts[i].slice(0, 7), gr[i]);
    sers.push({ label: "60/40", emoji: "⚖️", growthMap: m, hl: false, bench: true });
  }
  if (sers.length < 3) return null;

  // Ortak ay aralığında hesapla → CAGR/vol adil (apples-to-apples) karşılaştırılır.
  const common = Array.from(sers[0].growthMap.keys())
    .filter((d) => sers.every((s) => s.growthMap.has(d)))
    .sort();
  if (common.length < 13) return null;

  const pts = sers
    .map((s) => {
      const g = common.map((d) => s.growthMap.get(d) as number);
      const rets: number[] = [];
      for (let i = 1; i < g.length; i++) rets.push(g[i] / g[i - 1] - 1);
      if (rets.length < 2) return null;
      const finalMult = g[g.length - 1] / g[0];
      const cagr = Math.pow(finalMult, 12 / (common.length - 1)) - 1;
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const variance =
        rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
      const vol = Math.sqrt(variance) * Math.sqrt(12);
      const sharpe = vol > 0 ? (mean * 12) / vol : null;
      return {
        label: s.label,
        emoji: s.emoji,
        x: vol,
        y: cagr,
        sharpe,
        hl: s.hl,
        bench: s.bench,
      };
    })
    .filter(
      (
        p
      ): p is {
        label: string;
        emoji: string;
        x: number;
        y: number;
        sharpe: number | null;
        hl: boolean;
        bench: boolean;
      } => !!p && isFinite(p.x) && isFinite(p.y)
    );
  if (pts.length < 3) return null;

  const W = 820;
  const H = 380;
  const padL = 52;
  const padR = 132;
  const padT = 16;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xMax = Math.max(...pts.map((p) => p.x)) * 1.12 || 0.1;
  const yMin = Math.min(0, ...pts.map((p) => p.y));
  const yMax = Math.max(...pts.map((p) => p.y)) * 1.12;
  const ySpan = yMax - yMin || 1;
  const X = (v: number) => padL + (innerW * v) / xMax;
  const Y = (v: number) => padT + innerH * (1 - (v - yMin) / ySpan);

  const xTicks = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5].filter(
    (v) => v <= xMax
  );
  const yTicks: number[] = [];
  for (let v = Math.floor(yMin * 20) / 20; v <= yMax; v += 0.05)
    yTicks.push(Number(v.toFixed(2)));

  return (
    <div className="chart-card">
      <div className="chart-title">
        Evrenler-Arası Risk–Getiri — her evrenin momentum stratejisi + bileşik +
        pasif + 60/40 (ortak dönem)
      </div>
      <div className="chart-help">
        Her nokta bir evrenin dual-momentum stratejisi; hepsi <b>ortak ay
        aralığında</b> hesaplandığından CAGR/volatilite adil karşılaştırılır.{" "}
        <b>Sol-üst köşe idealdir</b> (düşük risk + yüksek getiri). 🧩 Bileşiğin
        (yeşil) tekil evrenlerin sol-üstünde oturması = çeşitlendirme faydası; ⚪
        Pasif (gri) hiçbir şey yapmama alternatifidir; <b>⚖️ 60/40</b> (SPY/AGG)
        evrensel &quot;tembel portföy&quot; referansıdır — stratejilerin ona göre
        nerede durduğuna bak.
      </div>
      <svg
        className="equity-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img" aria-label="Evrenler-arası risk-getiri dağılım grafiği. Detay: üstteki başlık ve açıklamada."
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
          <text key={`x${i}`} x={X(v)} y={H - 16} className="axis-label" textAnchor="middle">
            {(v * 100).toFixed(0)}%
          </text>
        ))}
        <text x={(padL + W - padR) / 2} y={H - 3} className="axis-label" textAnchor="middle">
          Volatilite (yıllık)
        </text>
        {pts.map((p, i) => (
          <g key={i}>
            <circle
              cx={X(p.x)}
              cy={Y(p.y)}
              r={p.hl ? 7.5 : 5}
              className={
                p.hl ? "rr-dot rr-hl" : p.bench ? "rr-dot rr-bench" : "rr-dot"
              }
              style={
                p.hl || p.bench
                  ? undefined
                  : { fill: CURVE_COLORS[1 + (i % (CURVE_COLORS.length - 1))] }
              }
            />
            <text
              x={X(p.x) + (p.hl ? 11 : 9)}
              y={Y(p.y) + 3}
              className={`rr-label ${p.hl ? "rr-label-hl" : ""}`}
              style={
                p.hl || p.bench
                  ? undefined
                  : { fill: CURVE_COLORS[1 + (i % (CURVE_COLORS.length - 1))] }
              }
            >
              {p.emoji} {p.label}
              {p.sharpe != null ? ` · S ${p.sharpe.toFixed(2)}` : ""}
            </text>
          </g>
        ))}
      </svg>
    </div>
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
  // 60/40 evrensel referans eğrisi (SPY/AGG) — ortak dönem overlay'inde
  if (data.benchmark6040 && data.composite) {
    const map = new Map<string, number>();
    const dts: string[] = [];
    const cd = data.composite.dates;
    const gr = data.benchmark6040.growth;
    for (let i = 0; i < cd.length && i < gr.length; i++) {
      const ym = cd[i].slice(0, 7);
      map.set(ym, gr[i]);
      dts.push(ym);
    }
    series.push({ label: "60/40 (SPY/AGG)", emoji: "⚖️", map, dates: dts });
  }
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
        : s.label.includes("60/40")
        ? "#94a3b8"
        : // 0. renk (yeşil) bileşiğe ayrıldı; diğer çizgilerde 1..N renklerini
          // kullan ki GEM (idx 0) bileşikle aynı yeşile düşüp karışmasın.
          CURVE_COLORS[1 + (idx % (CURVE_COLORS.length - 1))],
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
      <div className="section-label" role="heading" aria-level={2}>
        Ortak-Dönem Karşılaştırması — tüm stratejiler aynı zaman ekseninde (1$
        → büyüme, log ölçek)
      </div>
      <div className="chart-card">
        <div className="chart-help">
          Tüm evrenlerin momentum stratejileri <b>ortak veri aralığında</b> (
          {common[0]} → {common[n - 1]}, {n} ay) 1$&apos;dan başlatılıp yeniden
          normalize edildi — böylece leaderboard&apos;ın aksine{" "}
          <b>doğrudan ve adil</b> karşılaştırılabilirler. En genç evren (kripto)
          başlangıcı dönemi belirler. <b>🧩 Bileşik</b> (kalın yeşil) ve{" "}
          <b>⚖️ 60/40</b> (gri kesik, SPY/AGG evrensel referans) kıyas için öne
          çıkar.
        </div>
        <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ortak dönem birikimli getiri karşılaştırma grafiği. Detay: üstteki başlık ve açıklamada.">
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
              strokeDasharray={l.label.includes("60/40") ? "5 4" : undefined}
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

function RollingRelative({ bt, label }: { bt: BacktestResult; label: string }) {
  const mom = bt.equityCurves.find((c) => c.highlight);
  const bench =
    bt.equityCurves.find((c) => /Eşit[\s-]Ağırlık/.test(c.name)) ??
    bt.equityCurves.find((c) => !c.highlight);
  if (!mom || !bench) return null;
  const g = mom.growth;
  const b = bench.growth;
  const m = Math.min(g.length, b.length);
  if (m < 26) return null;
  const WIN = 12;
  const vals: { i: number; d: number }[] = [];
  for (let i = WIN; i < m; i++) {
    const mr = g[i] / g[i - WIN] - 1;
    const br = b[i] / b[i - WIN] - 1;
    vals.push({ i, d: mr - br });
  }
  if (vals.length < 2) return null;

  // "Vuruş ortalaması": kayan 12-ay pencerelerinin yüzde kaçında momentum önde?
  // Ortalama (t-stat) tek bir sayı verir; bu ise üstünlüğün TUTARLILIĞINI ölçer.
  const winCount = vals.filter((p) => p.d > 0).length;
  const winPct = (winCount / vals.length) * 100;
  const avgD = vals.reduce((s, p) => s + p.d, 0) / vals.length;

  const W = 820;
  const H = 200;
  const padL = 46;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = bt.dates.length;
  const ds = vals.map((p) => p.d);
  const lo = Math.min(0, ...ds);
  const hi = Math.max(0, ...ds);
  const span = hi - lo || 1;
  const X = (i: number) => padL + (innerW * i) / Math.max(1, n - 1);
  const Y = (v: number) => padT + innerH * (1 - (v - lo) / span);
  const zeroY = Y(0);
  const area =
    `M${X(vals[0].i).toFixed(1)},${zeroY.toFixed(1)} ` +
    vals.map((p) => `L${X(p.i).toFixed(1)},${Y(p.d).toFixed(1)}`).join(" ") +
    ` L${X(vals[vals.length - 1].i).toFixed(1)},${zeroY.toFixed(1)} Z`;

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
  const benchName = bench.name.replace(/\s*\(.*\)/, "");

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} — Kayan 12-Ay Göreli Performans (momentum eksi {benchName}){" "}
        <span className={winPct >= 50 ? "pos-cell" : "neg"}>
          · vuruş ort. {winPct.toFixed(0)}%
        </span>
      </div>
      <div className="chart-help">
        Her nokta: momentumun son 12-ay getirisi eksi al-tut benchmark&apos;ının
        son 12-ay getirisi. <b>0 üstü</b> = momentum o pencerede önde;{" "}
        <b>0 altı</b> = geride. Tüm kayan 12-ay pencerelerinin{" "}
        <b>{winPct.toFixed(0)}%</b>&apos;inde momentum önde (ortalama fark{" "}
        <b>{avgD >= 0 ? "+" : ""}
        {(avgD * 100).toFixed(1)}%</b>). Yüksek vuruş ortalaması, kenarın
        şanstan çok tutarlılığa dayandığını gösterir; ortalama (t-stat) ile
        birlikte yorumla.
      </div>
      <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="12-ay rolling göreli performans grafiği — strateji eksi benchmark. Detay: üstteki başlık ve açıklamada.">
        <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} className="grid-line zero" />
        <text x={padL - 8} y={zeroY + 3} className="axis-label" textAnchor="end">
          0
        </text>
        <path d={area} className="relperf-area" />
        {shown.map((t, idx) => (
          <text key={idx} x={X(t.i)} y={H - 8} className="axis-label" textAnchor="middle">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// Göreli güç: kümülatif strateji ÷ benchmark oranı (ikisi de 1.0'a normalize).
// Yükselen çizgi = strateji benchmark'ı kümülatif geçiyor; nerede kazanıldığını
// (genelde düşüş dönemlerinde) görünür kılar. Equity overlay'den farkı: mutlak
// seviyeleri değil, ARALARINDAKİ farkın gidişatını tek çizgide gösterir.
function RelativeStrengthChart({ bt, label }: { bt: BacktestResult; label: string }) {
  const mom = bt.equityCurves.find((c) => c.highlight);
  const bench =
    bt.equityCurves.find((c) => /Eşit[\s-]Ağırlık/.test(c.name)) ??
    bt.equityCurves.find((c) => !c.highlight);
  if (!mom || !bench) return null;
  const m = Math.min(mom.growth.length, bench.growth.length, bt.dates.length);
  if (m < 13) return null;
  const g0 = mom.growth[0];
  const b0 = bench.growth[0];
  if (!(g0 > 0) || !(b0 > 0)) return null;

  const ratio: number[] = [];
  for (let i = 0; i < m; i++) {
    const bv = bench.growth[i];
    ratio.push(bv > 0 ? mom.growth[i] / g0 / (bv / b0) : NaN);
  }
  const valid = ratio.filter((x) => isFinite(x));
  if (valid.length < 13) return null;
  const lo = Math.min(...valid);
  const hi = Math.max(...valid);
  const span = hi - lo || 1;
  const finalR = ratio[m - 1];
  const outPct = (finalR - 1) * 100;
  const ahead = finalR >= 1;

  const W = 820;
  const H = 200;
  const padL = 46;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const X = (i: number) => padL + (innerW * i) / Math.max(1, m - 1);
  const Y = (v: number) => padT + innerH * (1 - (v - lo) / span);
  const oneY = Y(1);
  const line = ratio
    .map((v, i) =>
      isFinite(v) ? `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}` : ""
    )
    .filter(Boolean)
    .join(" ");

  const xTicks: { i: number; label: string }[] = [];
  let ly = "";
  for (let i = 0; i < m; i++) {
    const y = bt.dates[i].slice(0, 4);
    if (y !== ly) {
      xTicks.push({ i, label: y });
      ly = y;
    }
  }
  const step = Math.max(1, Math.ceil(xTicks.length / 10));
  const shown = xTicks.filter((_, idx) => idx % step === 0);
  const benchName = bench.name.replace(/\s*\(.*\)/, "");

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} — Göreli Güç (kümülatif: {label} ÷ {benchName}){" "}
        <span className={ahead ? "pos-cell" : "neg"}>
          · son {finalR.toFixed(2)}× ({outPct >= 0 ? "+" : ""}
          {outPct.toFixed(0)}%)
        </span>
      </div>
      <div className="chart-help">
        Tek çizgi: stratejinin kümülatif büyümesinin al-tut benchmark&apos;ına
        oranı (ikisi de başlangıçta 1.0). <b>Çizgi yükseliyorsa</b> strateji o
        dönemde benchmark&apos;ı geçiyor; <b>düzse</b> başa baş, <b>iniyorsa</b>{" "}
        geride. Eğimin en dikleştiği yerler, kenarın kazanıldığı dönemlerdir —
        dual momentum&apos;da bu genelde piyasa düşüşleridir (nakde kaçış
        sayesinde benchmark düşerken strateji daha az kaybeder). Son değer{" "}
        <b>{finalR.toFixed(2)}×</b> → strateji benchmark&apos;ı kümülatif{" "}
        <b>{ahead ? `%${outPct.toFixed(0)} geçti` : `%${Math.abs(outPct).toFixed(0)} geride`}</b>.
      </div>
      <svg
        className="equity-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Kümülatif göreli güç grafiği — strateji bölü benchmark oranı. Detay: üstteki başlık ve açıklamada."
      >
        <line x1={padL} x2={W - padR} y1={oneY} y2={oneY} className="grid-line zero" />
        <text x={padL - 8} y={oneY + 3} className="axis-label" textAnchor="end">
          1.0×
        </text>
        <path
          d={line}
          className="equity-line"
          stroke={ahead ? "#22d3a6" : "#f87171"}
          style={{ strokeWidth: 2 }}
        />
        {shown.map((t, idx) => (
          <text key={idx} x={X(t.i)} y={H - 8} className="axis-label" textAnchor="middle">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
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
      <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="12-ay rolling oynaklık grafiği. Detay: üstteki başlık ve açıklamada.">
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

function RollingSharpe({ bt, label }: { bt: BacktestResult; label: string }) {
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
    const sd = Math.sqrt(variance);
    if (sd <= 0) continue;
    // Yıllıklaştırılmış Sharpe (risksiz ≈ 0 varsayımı): (m·12) / (sd·√12).
    vals.push({ i, v: (m * Math.sqrt(12)) / sd });
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
  const lo = Math.min(0, ...vals.map((p) => p.v));
  const hi = Math.max(0, ...vals.map((p) => p.v));
  const span = hi - lo || 1;
  const X = (i: number) => padL + (innerW * i) / Math.max(1, n - 1);
  const Y = (v: number) => padT + innerH * (1 - (v - lo) / span);
  const line = vals
    .map((p, k) => `${k === 0 ? "M" : "L"}${X(p.i).toFixed(1)},${Y(p.v).toFixed(1)}`)
    .join(" ");

  // Y eksen tikleri (0.5 adımlarla, 0 dahil)
  const yTicks: number[] = [];
  const tickStep = 0.5;
  const tLo = Math.ceil(lo / tickStep) * tickStep;
  for (let v = tLo; v <= hi + 1e-9; v += tickStep) yTicks.push(Number(v.toFixed(2)));

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
  const last = vals[vals.length - 1].v;

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} 12-Ay Rolling Sharpe — risk-ayarlı getirinin zaman içindeki seyri
      </div>
      <div className="chart-help">
        Her nokta o aydan geriye 12 ayın yıllıklaştırılmış Sharpe oranı (risksiz ≈ 0).
        Sıfır çizgisinin üstü = pozitif risk-ayarlı getiri; uzun süre &gt; 1 olan
        platolar güçlü rejimleri, sıfır altı dönemler kayıp rejimlerini gösterir.
        Son 12 ay: <b>{last.toFixed(2)}</b>.
      </div>
      <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="12-ay rolling Sharpe oranı grafiği. Detay: üstteki başlık ve açıklamada.">
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
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <path d={line} className="equity-line" stroke="#22d3ee" style={{ strokeWidth: 1.8 }} />
        {shown.map((t, idx) => (
          <text key={idx} x={X(t.i)} y={H - 8} className="axis-label" textAnchor="middle">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// Takvim-yılı getirileri: strateji vs benchmark gruplu çubuk grafik.
function yearlyReturns(
  growth: number[],
  dates: string[]
): { year: string; ret: number; partial: boolean }[] {
  if (growth.length !== dates.length || growth.length < 2) return [];
  const byYear = new Map<string, { first: number; last: number }>();
  dates.forEach((d, i) => {
    const y = d.slice(0, 4);
    const e = byYear.get(y);
    if (!e) byYear.set(y, { first: i, last: i });
    else e.last = i;
  });
  const years = [...byYear.keys()].sort();
  const out: { year: string; ret: number; partial: boolean }[] = [];
  for (let k = 0; k < years.length; k++) {
    const y = years[k];
    const cur = byYear.get(y)!;
    // Baz = önceki yıl sonu büyümesi; ilk yıl için seri çapası (index 0).
    const base = k === 0 ? growth[0] : growth[byYear.get(years[k - 1])!.last];
    if (!base) continue;
    const ret = growth[cur.last] / base - 1;
    // Yıl Ocak'ta başlamıyor veya Aralık'ta bitmiyorsa kısmi (partial) işaretle.
    const partial =
      (k === 0 && dates[cur.first].slice(5, 7) !== "01") ||
      (k === years.length - 1 && dates[cur.last].slice(5, 7) !== "12");
    out.push({ year: y, ret, partial });
  }
  return out;
}

function YearlyReturns({ bt, label }: { bt: BacktestResult; label: string }) {
  const strat = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  if (!strat) return null;
  const bench =
    bt.equityCurves.find(
      (c) => !c.highlight && /Eşit[\s-]Ağırlık|Al-Tut|Buy.?Hold|SPY|ACWI/i.test(c.name)
    ) ?? bt.equityCurves.find((c) => !c.highlight);
  const sY = yearlyReturns(strat.growth, bt.dates);
  if (sY.length < 2) return null;
  const bMap = new Map<string, number>();
  if (bench) for (const r of yearlyReturns(bench.growth, bt.dates)) bMap.set(r.year, r.ret);

  const W = 820;
  const H = 240;
  const padL = 44;
  const padR = 14;
  const padT = 16;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const allVals = sY.map((r) => r.ret).concat([...bMap.values()]);
  const maxAbs = Math.max(0.05, ...allVals.map((v) => Math.abs(v))) * 1.1;
  const mid = padT + innerH / 2;
  const bw = innerW / sY.length;
  const Yh = (v: number) => (Math.abs(v) / maxAbs) * (innerH / 2);

  const yTicks: number[] = [];
  const tStep = maxAbs > 0.6 ? 0.2 : 0.1;
  for (let v = -Math.floor(maxAbs / tStep) * tStep; v <= maxAbs; v += tStep)
    yTicks.push(Number(v.toFixed(2)));
  const stepX = Math.ceil(sY.length / 16);

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} Takvim-Yılı Getirileri — strateji vs benchmark{" "}
        <span className="yr-legend">
          <span className="yr-swatch strat" /> strateji
          {bench ? (
            <>
              {"  "}
              <span className="yr-swatch bench" /> benchmark
            </>
          ) : null}
        </span>
      </div>
      <div className="chart-help">
        Her yılın tam takvim-yılı toplam getirisi. Strateji çubuğu yeşil (kâr) /
        kırmızı (zarar); ince benchmark çubuğu kıyas içindir. <b>*</b> ile işaretli
        yıllar kısmi (veri Ocak&apos;ta başlamıyor / Aralık&apos;ta bitmiyor).
      </div>
      <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Takvim-yılı getirileri çubuk grafiği — strateji ve benchmark. Detay: üstteki başlık ve açıklamada.">
        {yTicks.map((v, i) => {
          const y = mid - (v / maxAbs) * (innerH / 2);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                className={Math.abs(v) < 1e-9 ? "grid-line zero" : "grid-line"}
              />
              <text x={padL - 6} y={y + 3} className="axis-label" textAnchor="end">
                {(v * 100).toFixed(0)}
              </text>
            </g>
          );
        })}
        {sY.map((r, i) => {
          const b = bMap.get(r.year);
          const xc = padL + i * bw + bw / 2;
          const sw = Math.min(22, bw * 0.42);
          const sh = Yh(r.ret);
          const sx = xc - (b != null ? sw : sw / 2);
          const sy = r.ret >= 0 ? mid - sh : mid;
          return (
            <g key={r.year}>
              <rect
                x={sx}
                y={sy}
                width={sw}
                height={Math.max(1, sh)}
                className={r.ret >= 0 ? "seas-pos" : "seas-neg"}
              />
              {b != null ? (
                <rect
                  x={xc + 1}
                  y={b >= 0 ? mid - Yh(b) : mid}
                  width={sw * 0.6}
                  height={Math.max(1, Yh(b))}
                  className="yr-bench-bar"
                />
              ) : null}
              {i % stepX === 0 ? (
                <text x={xc} y={H - 14} className="axis-label" textAnchor="middle">
                  {r.year.slice(2)}
                  {r.partial ? "*" : ""}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Bilinen tarihsel kriz pencereleri (aylık, YYYY-MM dahil).
const CRISES: { name: string; from: string; to: string }[] = [
  { name: "2008 Küresel Finans Krizi", from: "2007-11", to: "2009-02" },
  { name: "2011 Euro / ABD Not Düşüşü", from: "2011-05", to: "2011-09" },
  { name: "2015–16 Çin / Petrol Şoku", from: "2015-06", to: "2016-02" },
  { name: "2018 Q4 Satışı", from: "2018-10", to: "2018-12" },
  { name: "2020 COVID Çöküşü", from: "2020-01", to: "2020-03" },
  { name: "2022 Enflasyon Ayı Piyasası", from: "2022-01", to: "2022-09" },
];

function CrisisPerformance({ bt, label = "Strateji" }: { bt: BacktestResult; label?: string }) {
  const strat = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  if (!strat) return null;
  const bench =
    bt.equityCurves.find((c) => !c.highlight && /Eşit[\s-]Ağırlık/i.test(c.name)) ??
    bt.equityCurves.find(
      (c) => !c.highlight && /Al-Tut|Buy.?Hold|SPY|ACWI|Pasif/i.test(c.name)
    ) ??
    bt.equityCurves.find((c) => !c.highlight);
  const ym = bt.dates.map((d) => d.slice(0, 7));

  const winRet = (growth: number[], from: string, to: string): number | null => {
    let startIdx = -1;
    for (let i = 0; i < ym.length; i++)
      if (ym[i] >= from) {
        startIdx = i;
        break;
      }
    let endIdx = -1;
    for (let i = ym.length - 1; i >= 0; i--)
      if (ym[i] <= to) {
        endIdx = i;
        break;
      }
    if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) return null;
    const baseIdx = startIdx > 0 ? startIdx - 1 : startIdx;
    const base = growth[baseIdx];
    const end = growth[endIdx];
    if (!base || !isFinite(base) || !isFinite(end)) return null;
    return end / base - 1;
  };

  const rows = CRISES.map((c) => ({
    name: c.name,
    from: c.from,
    to: c.to,
    s: winRet(strat.growth, c.from, c.to),
    b: bench ? winRet(bench.growth, c.from, c.to) : null,
  })).filter((r) => r.s != null);
  if (rows.length < 1) return null;

  const protRows = rows.filter((r) => r.s != null && r.b != null);
  const avgProt =
    protRows.length > 0
      ? protRows.reduce((acc, r) => acc + ((r.s as number) - (r.b as number)), 0) /
        protRows.length
      : null;

  return (
    <>
      <div className="section-label" role="heading" aria-level={2}>
        {label} — Kriz Stres Testi (tarihsel düşüş dönemlerinde getiri)
      </div>
      <div className="chart-help">
        Her satır bilinen bir kriz penceresi; <b>{label}</b> ile pasif benchmark&apos;ın
        o dönemdeki kümülatif getirisi. Dual momentum&apos;un asıl vaadi burada
        görünür: mutlak momentum negatife dönünce nakde/tahvile geçtiğinden
        krizlerde <b>çok daha az kaybetmesi</b> beklenir (pozitif &quot;koruma&quot; =
        benchmark&apos;tan daha iyi).
      </div>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th className="left">Kriz</th>
              <th>Dönem</th>
              <th>{label}</th>
              <th>Benchmark</th>
              <th>Koruma (fark)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const prot = r.s != null && r.b != null ? r.s - r.b : null;
              return (
                <tr key={i}>
                  <td className="left">{r.name}</td>
                  <td>
                    {r.from} → {r.to}
                  </td>
                  <td className={(r.s ?? 0) >= 0 ? "pos-cell" : "neg"}>{pct(r.s)}</td>
                  <td className={(r.b ?? 0) >= 0 ? "pos-cell" : "neg"}>{pct(r.b)}</td>
                  <td className={prot == null ? "" : prot >= 0 ? "pos-cell strong" : "neg strong"}>
                    {prot == null ? "—" : `${prot >= 0 ? "+" : ""}${pct(prot)}`}
                  </td>
                </tr>
              );
            })}
            {avgProt != null && (
              <tr className="row-hl">
                <td className="left">
                  <b>Ortalama koruma ({protRows.length} kriz)</b>
                </td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td className={avgProt >= 0 ? "pos-cell strong" : "neg strong"}>
                  {avgProt >= 0 ? "+" : ""}
                  {pct(avgProt)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProbabilisticSharpe({ bt, label = "Strateji" }: { bt: BacktestResult; label?: string }) {
  // Probabilistic Sharpe Ratio — Bailey & López de Prado (2012).
  // Gözlenen Sharpe'ın gerçek (true) Sharpe > 0 olma olasılığını, örneklem
  // uzunluğu + çarpıklık + fazla-basıklık (fat tails) düzelterek verir.
  // Sharpe + momentler StrategyMetrics'ten alınır: FAZLA (excess, rf üstü)
  // getiri tabanlı ve yıllık — leaderboard PSR sütunuyla TUTARLI. (Eğriden ham
  // getiriyle yeniden hesaplamak rf kadar sapma yaratır ve iki PSR'ı uyumsuz
  // gösterirdi.)
  const sm = bt.strategies[0]; // vurgulu eğriye karşılık gelen strateji
  const months = bt.months;
  if (!sm || sm.sharpe == null || sm.skewness == null || sm.kurtosis == null)
    return null;
  if (!isFinite(months) || months < 36) return null;
  const n = months;

  const srHat = sm.sharpe / Math.sqrt(12); // aylık fazla-getiri Sharpe
  if (srHat <= 0) return null; // PSR yalnız pozitif Sharpe için anlamlı
  const g3 = sm.skewness;
  const g4 = sm.kurtosis + 3; // fazla → ham basıklık (normal=3)

  const varTerm = 1 - g3 * srHat + ((g4 - 1) / 4) * srHat * srHat; // = denom²
  if (!isFinite(varTerm) || varTerm <= 0) return null;
  const psr = normCdf((srHat * Math.sqrt(n - 1)) / Math.sqrt(varTerm));

  // MinTRL: %95 güven için gereken minimum gözlem (ay)
  const Z95 = 1.644853626951;
  const minTRL = 1 + varTerm * (Z95 / srHat) ** 2;

  const srAnn = sm.sharpe; // yıllık Sharpe (gösterim)
  const enough = psr >= 0.95;
  const weak = psr < 0.9;

  return (
    <div className="chart-card">
      <div className="chart-title">{label} — Olasılıksal Sharpe (PSR)</div>
      <div className="chart-help">
        Gözlenen Sharpe&apos;ın <b>gerçekte &gt; 0</b> olma olasılığı — örneklem
        uzunluğu, çarpıklık ve şişman kuyruklar (fat tails) için düzeltilmiş
        (Bailey–López de Prado 2012). Yüksek Sharpe kısa/çarpık seride yanıltıcı
        olabilir; PSR bunu cezalandırır. <b>MinTRL</b> = bu Sharpe&apos;ın %95
        güvenle anlamlı sayılması için gereken minimum ay sayısı.
      </div>
      <div className="cap-grid">
        <div className="cap-item">
          <div className="cap-label">Yıllık Sharpe</div>
          <div className="cap-val">{num(srAnn)}</div>
        </div>
        <div className="cap-item">
          <div className="cap-label">PSR (Sharpe &gt; 0)</div>
          <div className={`cap-val ${enough ? "pos-cell" : weak ? "neg" : ""}`}>
            {pct(psr, 1)}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">MinTRL · Örneklem</div>
          <div className={`cap-val ${n >= minTRL ? "pos-cell" : "neg"}`}>
            {Math.ceil(minTRL)} ay · {n} ay
          </div>
        </div>
      </div>
      <div className={`rob-verdict ${enough ? "ok" : weak ? "thin" : ""}`}>
        {enough
          ? "Sharpe istatistiksel olarak sağlam — örneklem, çarpıklık/kuyruk riski hesaba katıldığında pozitif risk-ayarlı getiri yüksek güvenle gerçek."
          : weak
          ? "Sharpe zayıf destekleniyor — bu Sharpe'a güvenmek için daha uzun geçmiş gerekir (MinTRL henüz karşılanmadı)."
          : "Sınırda — pozitif Sharpe muhtemelen gerçek ama güven marjı dar."}{" "}
        (γ₃={num(g3)}, fazla basıklık={num(g4 - 3)})
      </div>
    </div>
  );
}

function VolTargetPanel({ bt, label = "Strateji" }: { bt: BacktestResult; label?: string }) {
  const curve = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  const g = curve?.growth;
  if (!g || g.length < 37) return null; // warmup + örneklem
  const r = growthToRets(g);
  const n = r.length;
  const W = 12; // trailing oynaklık penceresi (ay)
  const MAXLEV = 2; // kaldıraç tavanı

  const annVol = (x: number[]) => {
    const k = x.length;
    if (k < 2) return 0;
    const m = x.reduce((s, v) => s + v, 0) / k;
    return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (k - 1)) * Math.sqrt(12);
  };
  // Hedef = stratejinin kendi tam-örneklem oynaklığı (risk-nötr kıyas; sadece
  // zamanlama faydasını izole eder, ortalama riski sabit tutar).
  const targetAnn = annVol(r);
  if (targetAnn <= 0) return null;

  const orig: number[] = [];
  const vt: number[] = [];
  for (let i = W; i < n; i++) {
    const trailing = annVol(r.slice(i - W, i)); // GEÇMİŞ pencere → lookahead yok
    const w = trailing > 0 ? Math.min(MAXLEV, targetAnn / trailing) : 1;
    orig.push(r[i]);
    vt.push(w * r[i]);
  }
  if (orig.length < 24) return null;

  const stat = (x: number[]) => {
    const k = x.length;
    let acc = 1,
      peak = 1,
      maxdd = 0;
    for (const v of x) {
      acc *= 1 + v;
      if (acc > peak) peak = acc;
      const dd = acc / peak - 1;
      if (dd < maxdd) maxdd = dd;
    }
    const cagr = Math.pow(acc, 12 / k) - 1;
    const m = x.reduce((s, v) => s + v, 0) / k;
    const sd = Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (k - 1));
    const sharpe = sd > 0 ? (m * Math.sqrt(12)) / sd : null;
    return { cagr, vol: sd * Math.sqrt(12), sharpe, maxdd };
  };
  const o = stat(orig);
  const t = stat(vt);
  const dS = (t.sharpe ?? 0) - (o.sharpe ?? 0);

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} — Vol-Hedefli Versiyon (oynaklık-yönetimli momentum)
      </div>
      <div className="chart-help">
        Pozisyon, geçmiş 12-ayın oynaklığına göre ölçeklenir (sakin dönemde
        ↑, çalkantıda ↓; hedef = stratejinin kendi uzun-dönem oynaklığı, kaldıraç
        ≤{MAXLEV}×). Momentum çöküşleri yüksek-vol dönemlerde olur; oynaklık
        yönetimi bunları yumuşatır ve Sharpe&apos;ı artırır (Barroso–Santa-Clara
        2015). Ölçekleme yalnız <b>geçmiş</b> oynaklık kullanır (lookahead yok).
      </div>
      <div className="cap-grid">
        <div className="cap-item">
          <div className="cap-label">Orijinal (CAGR · Sharpe · MaxDD)</div>
          <div className="cap-val">
            {pct(o.cagr)} · {num(o.sharpe)} · {pct(o.maxdd)}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Vol-Hedefli (CAGR · Sharpe · MaxDD)</div>
          <div className="cap-val">
            {pct(t.cagr)} · {num(t.sharpe)} · {pct(t.maxdd)}
          </div>
        </div>
      </div>
      <div className={`rob-verdict ${dS >= 0.05 ? "ok" : dS <= -0.05 ? "thin" : ""}`}>
        Sharpe etkisi: <b className={dS >= 0 ? "pos-cell" : "neg"}>
          {dS >= 0 ? "+" : ""}
          {num(dS)}
        </b>{" "}
        — {dS >= 0.05
          ? "oynaklık yönetimi risk-ayarlı getiriyi artırdı."
          : dS <= -0.05
          ? "bu seride yardımcı olmadı (kaldıraç/maliyet dikkate alınmalı)."
          : "etki nötr."}{" "}
        (Not: ≤{MAXLEV}× kaldıraç ve işlem maliyeti varsayımı; hipotetik.)
      </div>
    </div>
  );
}

function StartDateSensitivity({ bt, label = "Strateji" }: { bt: BacktestResult; label?: string }) {
  // Giriş-tarihi duyarlılığı: lump-sum yatırımcının NİHAİ CAGR'ı, hangi yıl
  // girdiğine göre nasıl değişir? Geniş aralık = sonuç "şanslı başlangıç"a
  // bağımlı (sıra/timing riski). Her takvim yılının ilk ayından bugüne CAGR.
  const curve = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  const g = curve?.growth;
  if (!g || g.length < 49 || bt.dates.length < g.length) return null;
  const end = g.length - 1;

  const rows: { year: string; cagr: number }[] = [];
  let lastYear = "";
  for (let i = 0; i < g.length; i++) {
    const yr = bt.dates[i].slice(0, 4);
    if (yr === lastYear) continue; // her yılın ilk ayı
    lastYear = yr;
    const months = end - i;
    if (months < 24) break; // son ~2 yıl: CAGR yıllıklaştırması güvenilmez
    if (g[i] <= 0) continue;
    const cagr = Math.pow(g[end] / g[i], 12 / months) - 1;
    if (isFinite(cagr)) rows.push({ year: yr, cagr });
  }
  if (rows.length < 3) return null;

  const sorted = [...rows].sort((a, b) => a.cagr - b.cagr);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)].cagr;
  const spread = best.cagr - worst.cagr;
  const wide = spread > 0.06; // >6 puan aralık = timing'e duyarlı

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} — Giriş Tarihi Duyarlılığı (timing riski)
      </div>
      <div className="chart-help">
        Tek seferlik (lump-sum) yatırımcının bugüne kadarki <b>yıllık getirisi</b>,
        hangi takvim yılında girdiğine göre. Geniş aralık = nihai sonuç büyük ölçüde{" "}
        <b>başlangıç şansına</b> bağlı (sıra/timing riski); dar aralık = strateji
        giriş zamanına görece dayanıklı. Son ~2 yıl, kısa pencerede CAGR güvenilmez
        olduğu için hariç.
      </div>
      <div className="cap-grid">
        <div className="cap-item">
          <div className="cap-label">En iyi giriş yılı</div>
          <div className="cap-val pos-cell">
            {best.year} · {pct(best.cagr)}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">En kötü giriş yılı</div>
          <div className={`cap-val ${worst.cagr < 0 ? "neg" : ""}`}>
            {worst.year} · {pct(worst.cagr)}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Medyan giriş CAGR</div>
          <div className="cap-val">{pct(median)}</div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Aralık (en iyi−en kötü)</div>
          <div className={`cap-val ${wide ? "neg" : "pos-cell"}`}>
            {pct(spread)}
          </div>
        </div>
      </div>
      <div className={`rob-verdict ${wide ? "thin" : "ok"}`}>
        {rows.length} farklı giriş yılı için nihai CAGR{" "}
        <b>{pct(worst.cagr)} – {pct(best.cagr)}</b> aralığında.{" "}
        {wide
          ? "geniş aralık: sonuç giriş zamanına (timing/şans) önemli ölçüde duyarlı — tek bir geçmiş CAGR'a fazla güvenme."
          : "dar aralık: strateji giriş zamanına görece dayanıklı, sonuç şanslı bir başlangıca bağlı değil."}
      </div>
    </div>
  );
}

function SplitSampleConsistency({ bt, label = "Strateji" }: { bt: BacktestResult; label?: string }) {
  const curve = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  const g = curve?.growth;
  if (!g || g.length < 49) return null; // her yarıda ≥24 ay
  const rets = growthToRets(g);
  const n = rets.length;
  const mid = Math.floor(n / 2);
  const stat = (r: number[]) => {
    const k = r.length;
    if (k < 12) return null;
    let acc = 1;
    for (const x of r) acc *= 1 + x;
    const cagr = Math.pow(acc, 12 / k) - 1;
    const m = r.reduce((s, x) => s + x, 0) / k;
    const sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / (k - 1));
    const sharpe = sd > 0 ? (m * Math.sqrt(12)) / sd : null; // rf≈0
    return { cagr, sharpe };
  };
  const h1 = stat(rets.slice(0, mid));
  const h2 = stat(rets.slice(mid));
  if (!h1 || !h2) return null;

  const ym = (i: number) => bt.dates[i]?.slice(0, 7) ?? "—";
  const p1 = `${ym(1)} → ${ym(mid)}`;
  const p2 = `${ym(mid + 1)} → ${ym(n)}`;

  // Kenar ikinci yarıda korunmuş mu? Sharpe bazlı kaba bir yargı.
  const s1 = h1.sharpe ?? 0;
  const s2 = h2.sharpe ?? 0;
  const verdict =
    s2 >= 0.3 && s2 >= s1 * 0.6
      ? { t: "Kenar korunmuş", c: "ok" }
      : s2 > 0
      ? { t: "Kenar zayıflamış", c: "" }
      : { t: "Kenar kaybolmuş", c: "thin" };

  const cell = (h: { cagr: number; sharpe: number | null }) => (
    <>
      <div className="cap-val">{pct(h.cagr)}</div>
      <div className="cap-label" style={{ marginTop: 2 }}>
        Sharpe {num(h.sharpe)}
      </div>
    </>
  );

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} — Yarı-Dönem Tutarlılık (kenar zamanla korunuyor mu?)
      </div>
      <div className="chart-help">
        Veri ortadan ikiye bölünüp her yarının CAGR &amp; Sharpe&apos;ı ayrı
        hesaplandı. Momentum kenarı zamanla <b>çürüyebilir</b>; ikinci yarıda da
        benzer performans = sağlam (örneklem-dışı tutarlı), yalnız ilk yarıda
        iyiydiyse aşırı-uyum/çürüme riski. (Risksiz ≈ 0 ile Sharpe.)
      </div>
      <div className="cap-grid">
        <div className="cap-item">
          <div className="cap-label">İlk yarı ({p1})</div>
          {cell(h1)}
        </div>
        <div className="cap-item">
          <div className="cap-label">İkinci yarı ({p2})</div>
          {cell(h2)}
        </div>
      </div>
      <div className={`rob-verdict ${verdict.c}`}>
        Değerlendirme: <b>{verdict.t}</b> — ilk yarı Sharpe {num(h1.sharpe)},
        ikinci yarı Sharpe {num(h2.sharpe)} (CAGR {pct(h1.cagr)} → {pct(h2.cagr)}).
      </div>
    </div>
  );
}

function BootstrapRisk({ bt, label = "Strateji" }: { bt: BacktestResult; label?: string }) {
  const curve = bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
  const g = curve?.growth;
  const strat =
    (curve && bt.strategies.find((s) => s.name === curve.name)) ??
    bt.strategies[0];

  const stats = useMemo(() => {
    if (!g || g.length < 25) return null;
    const rets = growthToRets(g);
    const n = rets.length;
    if (n < 24) return null;
    const N = 500;
    const L = 6; // blok uzunluğu (ay) — kısa-vadeli oto-korelasyonu korur
    // Sabit-tohumlu mulberry32: 32-bit güvenli (Math.imul), veri sabitken her
    // render aynı sonuç → titreme yok. (Basit LCG float64'te taşıp düşük bit
    // entropisini bozuyordu; mulberry32 yüksek kaliteli ve taşmasız.)
    let seed = (123456789 ^ n) >>> 0;
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const cagrs: number[] = [];
    const dds: number[] = [];
    for (let p = 0; p < N; p++) {
      let eq = 1,
        peak = 1,
        maxdd = 0,
        i = 0;
      while (i < n) {
        const start = Math.floor(rnd() * n);
        for (let k = 0; k < L && i < n; k++, i++) {
          eq *= 1 + rets[(start + k) % n];
          if (eq > peak) peak = eq;
          const dd = eq / peak - 1;
          if (dd < maxdd) maxdd = dd;
        }
      }
      cagrs.push(Math.pow(eq, 12 / n) - 1);
      dds.push(maxdd);
    }
    cagrs.sort((a, b) => a - b);
    dds.sort((a, b) => a - b); // en negatif (en kötü) başta
    const q = (arr: number[], p: number) =>
      arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * arr.length)))];
    return {
      cagrMed: q(cagrs, 0.5),
      cagrLo: q(cagrs, 0.05),
      cagrHi: q(cagrs, 0.95),
      ddMed: q(dds, 0.5),
      ddWorst: q(dds, 0.05),
      pPos: cagrs.filter((c) => c > 0).length / cagrs.length,
      N,
      L,
      years: n / 12,
    };
  }, [g]);
  if (!stats) return null;

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} — Blok-Bootstrap Risk Dağılımı ({stats.N} sentetik yol)
      </div>
      <div className="chart-help">
        Tek bir tarihsel yol, olası sonuçların yalnızca bir gerçekleşmesidir.
        Aylık getiriler <b>{stats.L}-ay&apos;lık bloklar</b> hâlinde yeniden
        örneklenip {stats.N} sentetik {stats.years.toFixed(0)}-yıllık geçmiş
        üretildi (kısa-vadeli oto-korelasyon korunur). Aşağısı bu dağılımın
        özeti: gerçekleşen sonuç şanslı/şanssız mıydı, makul kötü senaryo ne?
      </div>
      <div className="cap-grid">
        <div className="cap-item">
          <div className="cap-label">Medyan CAGR</div>
          <div className={`cap-val ${stats.cagrMed >= 0 ? "pos" : "neg"}`}>
            {pct(stats.cagrMed)}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">CAGR %5–%95 aralığı</div>
          <div className="cap-val">
            {pct(stats.cagrLo)} … {pct(stats.cagrHi)}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">CAGR&gt;0 olasılığı</div>
          <div className={`cap-val ${stats.pPos >= 0.5 ? "pos" : "neg"}`}>
            %{(stats.pPos * 100).toFixed(0)}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Medyan Max Drawdown</div>
          <div className="cap-val neg">{pct(stats.ddMed)}</div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Kötü senaryo Max DD (%5)</div>
          <div className="cap-val neg">{pct(stats.ddWorst)}</div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Gerçekleşen (CAGR · MaxDD)</div>
          <div className="cap-val">
            {pct(strat?.cagr ?? null)} · {pct(strat?.maxDrawdown ?? null)}
          </div>
        </div>
      </div>
      <p className="table-note">
        ⚠️ Bootstrap, getiri sürecinin <b>durağan</b> (stationary) olduğunu
        varsayar — rejim değişimlerini veya görülmemiş şokları öngöremez; yalnız
        geçmişin yeniden düzenlenmesidir. &quot;Kötü senaryo Max DD&quot;, tarihsel
        max drawdown&apos;dan daha derin olabilir çünkü kötü aylar farklı sırada
        kümelenebilir — sıra/şans riskinin bir göstergesidir, garanti değil.
      </p>
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
      <svg className="equity-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mevsimsellik grafiği — ay-bazlı ortalama getiri. Detay: üstteki başlık ve açıklamada.">
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
      <div className="section-label" role="heading" aria-level={2}>
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
    const asOf = data.generatedAt.slice(0, 10);
    const lines = [
      `# Bilesik bu-ay-al listesi (esit-agirlik) — ${asOf}`,
      "Varlik,Agirlik_Yuzde",
    ];
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
    a.download = `bilesik-alim-listesi-${asOf}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="chart-card">
      <div className="chart-title chart-title-row">
        <span>🛒 Bileşiği Bu Ay Replike Et — eşit-ağırlık hedef portföy</span>
        <button className="mini-btn" onClick={downloadCsv} title="Alım listesini CSV indir" aria-label="Bileşik bu-ay-al listesini CSV indir">
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
  const cg = data.composite?.equityCurves[0]?.growth;
  const cd = cg ? curDrawdown(cg) : null;
  const mt = cg ? maTrend(cg, 10) : null;
  const vr = cg ? volRegime(cg, 6) : null;
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
        {cd != null && (
          <>
            {" "}
            Bileşik NAV şu an tüm-zaman zirvesinin{" "}
            <b className={cd > -0.02 ? "pos-cell" : cd > -0.1 ? "" : "neg"}>
              %{Math.abs(cd * 100).toFixed(1)}
            </b>{" "}
            altında (güncel drawdown).
          </>
        )}
      </div>
      {(mt || vr) && (
        <div className="stance-text" style={{ marginTop: 6 }}>
          <b>Rejim:</b>{" "}
          {mt && (
            <>
              trend{" "}
              <b className={mt.above ? "pos-cell" : "neg"}>
                {mt.above ? "▲ yukarı" : "▼ aşağı"}
              </b>{" "}
              (10-ay ort. {mt.above ? "üstünde" : "altında"}, %
              {Math.abs((mt.ratio - 1) * 100).toFixed(0)})
            </>
          )}
          {mt && vr ? " · " : ""}
          {vr && (
            <>
              oynaklık{" "}
              <b className={vr.ratio > 1.3 ? "neg" : vr.ratio < 0.8 ? "pos-cell" : ""}>
                {vr.ratio > 1.3 ? "çalkantılı" : vr.ratio < 0.8 ? "sakin" : "normal"}
              </b>{" "}
              (uzun-dönemin {vr.ratio.toFixed(1)}×&apos;i)
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CompositeAttribution({ bt }: { bt: BacktestResult }) {
  const comp = bt.equityCurves.find((c) => c.highlight);
  const sleeves = bt.equityCurves.filter(
    (c) => !c.highlight && !c.name.includes("Bileşik") && !c.name.includes("Pasif")
  );
  if (!comp || sleeves.length < 2) return null;
  const V = comp.growth; // bileşik NAV (V_0 = 1)
  const n = sleeves.length;
  const L = Math.min(...sleeves.map((s) => s.growth.length), V.length) - 1;
  if (L < 2) return null;

  const contrib = sleeves.map((s) => {
    let c = 0;
    for (let t = 0; t < L; t++) {
      const sret = s.growth[t + 1] / s.growth[t] - 1;
      c += (1 / n) * sret * V[t]; // ay başı NAV ile ağırlıklı
    }
    return { name: s.name, c };
  });
  const total = contrib.reduce((s, x) => s + x.c, 0);
  if (Math.abs(total) < 1e-9) return null;
  const maxAbs = Math.max(...contrib.map((x) => Math.abs(x.c)), 1e-9);
  const rows = contrib.slice().sort((a, b) => b.c - a.c);

  return (
    <>
      <div className="section-label" role="heading" aria-level={2}>
        Bileşik Getiri Atfı — toplam getiriye hangi evren ne kadar katkı yaptı
      </div>
      <div className="chart-card">
        <div className="chart-help">
          Bileşiğin ortak-dönem toplam getirisi ({pct(total, 0)}) eşit-ağırlık
          sleeve&apos;lere ayrıştırıldı (NAV-ağırlıklı, tam toplamsal). Pozitif
          bar = o evrenin bileşiğe net kazanç katkısı; negatif = net kayıp.
        </div>
        <div className="rpw-list">
          {rows.map((r) => (
            <div className="rpw-row" key={r.name}>
              <div className="rpw-name">{r.name.replace(/\s*\(.*\)/, "")}</div>
              <div className="rpw-bar attr">
                <div
                  className={r.c >= 0 ? "attr-fill pos" : "attr-fill neg"}
                  style={{
                    width: `${((Math.abs(r.c) / maxAbs) * 50).toFixed(1)}%`,
                    ...(r.c >= 0 ? { left: "50%" } : { right: "50%" }),
                  }}
                />
              </div>
              <div className={`rpw-val ${r.c >= 0 ? "" : "neg"}`}>
                {r.c >= 0 ? "+" : ""}
                {pct(r.c, 0)}
              </div>
              <div className="rpw-vol" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function RiskParityWeights({ bt }: { bt: BacktestResult }) {
  const sleeves = bt.equityCurves.filter(
    (c) => !c.highlight && !c.name.includes("Bileşik") && !c.name.includes("Pasif")
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

  // Yoğunlaşma: etkin sleeve sayısı = 1/Σw² (ters-Herfindahl). Eşit-ağırlıkta = N;
  // tek sleeve baskınsa düşer. Ultra-düşük-vol sleeve (tahvil/kısa vade) ters-vol
  // blokta hâkim olabilir → kullanıcıya dengesizliği şeffafça göster.
  const top = rows[0];
  const effN = 1 / rows.reduce((s, r) => s + r.w * r.w, 0);
  const concentrated = top.w > 0.4;
  // Tavanlı risk-parity bu eşiği (2.5/n) aşan sleeve'leri kırpar — işaretle.
  const cap = 2.5 / rows.length;
  const anyCapped = rows.some((r) => r.w > cap + 1e-9);

  return (
    <>
      <div className="section-label" role="heading" aria-level={2}>
        Risk-Parity Ağırlıkları — bileşikte her sleeve&apos;in ters-volatilite payı
      </div>
      <div className="chart-card">
        <div className="rpw-list">
          {rows.map((r) => (
            <div className="rpw-row" key={r.name}>
              <div className="rpw-name">
                {r.name.replace(/\s*\(.*\)/, "")}
                {r.w > cap + 1e-9 && (
                  <span
                    className="rpw-cap"
                    title={`Tavanlı risk-parity varyantında %${(cap * 100).toFixed(
                      0
                    )} sınırına kırpılır`}
                  >
                    {" "}✂
                  </span>
                )}
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
          eşit-ağırlık bileşiğin kripto-baskınlığını giderir. <b>Etkin sleeve
          sayısı:</b> {effN.toFixed(1)} / {rows.length} (eşit dağılımda ={" "}
          {rows.length}; düşük = yoğunlaşmış).
          {anyCapped && (
            <>
              {" "}
              <b>✂</b> işaretli sleeve&apos;ler <b>tavanlı risk-parity</b>{" "}
              varyantında %{(cap * 100).toFixed(0)} sınırına kırpılır.
            </>
          )}
        </p>
        {concentrated && (
          <p className="table-note neg">
            ⚠️ Ağırlık <b>{top.name.replace(/\s*\(.*\)/, "")}</b>&apos;de
            yoğunlaşmış (%{(top.w * 100).toFixed(0)}). Ultra-düşük oynaklıklı
            sleeve&apos;ler (örn. tahvil / kısa vade) ters-vol blokta baskın olur;
            daha dengeli dağılım istersen <b>eşit-ağırlık</b> bileşiği veya bir
            ağırlık tavanı tercih edebilirsin.
          </p>
        )}
      </div>
    </>
  );
}

function Benchmark6040({ data }: { data: AnalysisResult }) {
  const b = data.benchmark6040;
  const comp = data.composite?.strategies[0];
  if (!b || !comp) return null;
  const dCagr = (comp.cagr ?? 0) - b.cagr;
  const dSharpe = (comp.sharpe ?? 0) - (b.sharpe ?? 0);
  const beats = (comp.sharpe ?? 0) > (b.sharpe ?? 0);
  return (
    <div className="chart-card">
      <div className="chart-title">
        ⚖️ Bileşik vs 60/40 — sıkıcı standart portföyü yeniyor mu?
      </div>
      <div className="chart-help">
        60/40 = %60 S&amp;P 500 (SPY) + %40 ABD geniş tahvil (AGG), aylık dengeli —
        her yatırımcının kıyas aldığı &quot;tembel portföy&quot;. Bileşiğin ortak
        döneminde ({b.months} ay) hesaplanır. Dual momentum bileşiği bu evrensel
        standardı <b>risk-ayarlı</b> bazda aşıyorsa, ek karmaşıklık değer katıyor
        demektir.
      </div>
      <div className="table-scroll">
        <table className="metrics">
          <thead>
            <tr>
              <th className="left">Strateji</th>
              <th>CAGR</th>
              <th>Sharpe</th>
              <th>Max DD</th>
              <th>Vol</th>
            </tr>
          </thead>
          <tbody>
            <tr className="row-hl">
              <td className="left">🧩 Dual Momentum Bileşik</td>
              <td>{pct(comp.cagr)}</td>
              <td className="strong">{num(comp.sharpe)}</td>
              <td className="neg">{pct(comp.maxDrawdown)}</td>
              <td>{pct(comp.annualVol)}</td>
            </tr>
            <tr>
              <td className="left">⚖️ 60/40 (SPY/AGG)</td>
              <td>{pct(b.cagr)}</td>
              <td className="strong">{num(b.sharpe)}</td>
              <td className="neg">{pct(b.maxDrawdown)}</td>
              <td>{pct(b.vol)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className={`rob-verdict ${beats ? "ok" : "thin"}`}>
        Bileşik 60/40&apos;a karşı: Sharpe{" "}
        <b className={dSharpe >= 0 ? "pos-cell" : "neg"}>
          {dSharpe >= 0 ? "+" : ""}
          {num(dSharpe)}
        </b>
        , CAGR{" "}
        <b className={dCagr >= 0 ? "pos-cell" : "neg"}>
          {dCagr >= 0 ? "+" : ""}
          {pct(dCagr)}
        </b>{" "}
        —{" "}
        {beats
          ? "evrensel 60/40 standardını risk-ayarlı bazda yeniyor (karmaşıklık değer katıyor)."
          : "60/40'ı risk-ayarlı bazda yenemiyor — bu dönemde basit standart yeterliydi."}
      </div>
    </div>
  );
}

function Composite6040Overlay({ data }: { data: AnalysisResult }) {
  const b = data.benchmark6040;
  const comp = data.composite;
  if (!b || !comp) return null;
  const cc = comp.equityCurves.find((c) => c.highlight) ?? comp.equityCurves[0];
  if (!cc?.growth?.length) return null;
  const n = Math.min(cc.growth.length, b.growth.length, comp.dates.length);
  if (n < 13) return null;
  const cg = cc.growth.slice(0, n);
  const bg = b.growth.slice(0, n);
  const dates = comp.dates.slice(0, n);

  const W = 820;
  const H = 220;
  const padL = 50;
  const padR = 16;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const all = [...cg, ...bg].filter((v) => v > 0);
  const lo = Math.log(Math.min(...all));
  const hi = Math.log(Math.max(...all));
  const X = (i: number) => padL + (innerW * i) / Math.max(1, n - 1);
  const Y = (v: number) =>
    padT + innerH * (1 - (Math.log(v) - lo) / (hi - lo || 1));
  const path = (arr: number[]) =>
    arr
      .map((v, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`)
      .join(" ");

  const xTicks: { i: number; label: string }[] = [];
  let ly = "";
  dates.forEach((d, i) => {
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
        🧩 Bileşik vs 60/40 — Büyüme Eğrisi (log, ortak dönem)
      </div>
      <div className="chart-help">
        1$ başlangıçla birikimli büyüme (log eksen). <b style={{ color: "#60a5fa" }}>
        Mavi</b> = Dual Momentum Bileşik, <b style={{ color: "#94a3b8" }}>gri kesik</b> =
        60/40 (SPY/AGG). Eğrilerin ayrışması, momentum stratejisinin evrensel standarda
        kıyasla zaman içindeki üstünlüğünü/geriliğini görsel olarak gösterir.
      </div>
      <svg
        className="equity-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Bileşik ve 60/40 birikimli büyüme karşılaştırma grafiği. Detay: üstteki başlık ve açıklamada."
      >
        {shown.map((t, idx) => (
          <text key={idx} x={X(t.i)} y={H - 8} className="axis-label" textAnchor="middle">
            {t.label}
          </text>
        ))}
        <path
          d={path(bg)}
          fill="none"
          stroke="#94a3b8"
          strokeDasharray="4 3"
          style={{ strokeWidth: 1.6 }}
        />
        <path
          d={path(cg)}
          className="equity-line"
          stroke="#60a5fa"
          style={{ strokeWidth: 2 }}
        />
      </svg>
      <div className="rob-verdict ok">
        Dönem sonu büyüme —{" "}
        <b className="pos-cell">Bileşik {cg[n - 1].toFixed(1)}×</b> vs{" "}
        <b>60/40 {bg[n - 1].toFixed(1)}×</b>.
      </div>
    </div>
  );
}

function DiversificationRatio({ bt }: { bt: BacktestResult }) {
  // Çeşitlendirme Oranı (Choueifaty–Coignard 2008): DR = (Σ wᵢσᵢ) / σ_portföy.
  // Eşit ağırlıkta = ortalama sleeve oynaklığı / bileşik oynaklığı. DR yüksek =
  // sleeve'ler birbirini dengeliyor (düşük korelasyon). Etkin bağımsız bahis ≈ DR².
  const sleeves = bt.equityCurves.filter(
    (c) => !c.highlight && !c.name.includes("Bileşik") && !c.name.includes("Pasif")
  );
  if (sleeves.length < 3) return null;
  const rets = sleeves.map((c) => growthToRets(c.growth));
  const minLen = Math.min(...rets.map((r) => r.length));
  if (minLen < 13) return null;
  const trimmed = rets.map((r) => r.slice(r.length - minLen));

  const vol = (xs: number[]) => {
    const m = xs.reduce((s, v) => s + v, 0) / xs.length;
    return (
      Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1)) *
      Math.sqrt(12)
    );
  };
  const sleeveVols = trimmed.map(vol);
  const avgVol = sleeveVols.reduce((s, v) => s + v, 0) / sleeveVols.length;
  // Eşit-ağırlık portföy aylık getirisi
  const n = sleeves.length;
  const port: number[] = [];
  for (let t = 0; t < minLen; t++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += trimmed[i][t];
    port.push(s / n);
  }
  const portVol = vol(port);
  if (portVol <= 0) return null;
  const DR = avgVol / portVol;
  const effBets = DR * DR;
  const strong = effBets >= n * 0.5;

  return (
    <div className="chart-card">
      <div className="chart-title">
        🎯 Çeşitlendirme Oranı — kaç bağımsız bahis alıyorsun?
      </div>
      <div className="chart-help">
        <b>DR = ortalama sleeve oynaklığı ÷ bileşik oynaklığı</b>
        (Choueifaty–Coignard 2008). DR &gt; 1 ise sleeve&apos;ler birbirini dengeler
        (düşük korelasyon → risk azalır). <b>Etkin bağımsız bahis ≈ DR²</b>: {n}{" "}
        sleeve&apos;in kaçının gerçekten <i>bağımsız</i> risk kaynağı olduğunu söyler
        (yüksek korelasyon bunu düşürür).
      </div>
      <div className="cap-grid">
        <div className="cap-item">
          <div className="cap-label">Çeşitlendirme Oranı (DR)</div>
          <div className="cap-val">{num(DR)}</div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Etkin bağımsız bahis</div>
          <div className={`cap-val ${strong ? "pos-cell" : ""}`}>
            ≈ {effBets.toFixed(1)} / {n}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Ort. sleeve vol → bileşik vol</div>
          <div className="cap-val">
            {pct(avgVol, 0)} → {pct(portVol, 0)}
          </div>
        </div>
      </div>
      <div className={`rob-verdict ${strong ? "ok" : "thin"}`}>
        {n} sleeve&apos;den <b>≈ {effBets.toFixed(1)} bağımsız bahis</b> elde
        ediliyor — {strong
          ? "çeşitlendirme güçlü: sleeve'ler büyük ölçüde bağımsız risk taşıyor."
          : "çeşitlendirme orta/zayıf: sleeve'ler beklenenden korelasyonlu, etkin bahis sayısı düşük."}{" "}
        Bileşik oynaklığı, ortalama sleeve oynaklığının{" "}
        <b>%{Math.round((portVol / avgVol) * 100)}</b>&apos;i (düşük = iyi).
      </div>
    </div>
  );
}

function RollingCorrelation({
  bt,
  label = "Bileşik",
}: {
  bt: BacktestResult;
  label?: string;
}) {
  const sleeves = bt.equityCurves.filter(
    (c) => !c.highlight && !c.name.includes("Bileşik") && !c.name.includes("Pasif")
  );
  if (sleeves.length < 3) return null;
  const rets = sleeves.map((c) => growthToRets(c.growth));
  const minLen = Math.min(...rets.map((r) => r.length));
  const WIN = 24;
  if (minLen < WIN + 6) return null;

  // Her trailing pencere için tüm sleeve çiftlerinin ortalama korelasyonu
  const vals: { i: number; v: number }[] = [];
  for (let end = WIN; end <= minLen; end++) {
    let sum = 0;
    let cnt = 0;
    for (let a = 0; a < rets.length; a++)
      for (let b = a + 1; b < rets.length; b++) {
        const c = pearson(rets[a].slice(end - WIN, end), rets[b].slice(end - WIN, end));
        if (isFinite(c)) {
          sum += c;
          cnt++;
        }
      }
    if (cnt) vals.push({ i: end, v: sum / cnt });
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
  const n = sleeves[0].growth.length;
  const vMax = Math.max(...vals.map((p) => p.v));
  const vMin = Math.min(...vals.map((p) => p.v));
  const lo = Math.min(0, vMin) - 0.03;
  const hi = Math.max(0.3, vMax) + 0.03;
  const X = (i: number) => padL + (innerW * i) / Math.max(1, n - 1);
  const Y = (v: number) => padT + innerH * (1 - (v - lo) / (hi - lo));
  const line = vals
    .map((p, k) => `${k === 0 ? "M" : "L"}${X(p.i).toFixed(1)},${Y(p.v).toFixed(1)}`)
    .join(" ");
  const mean = vals.reduce((s, p) => s + p.v, 0) / vals.length;
  const last = vals[vals.length - 1].v;
  const peak = vMax;

  const yTicks: number[] = [];
  for (let v = Math.ceil(lo / 0.2) * 0.2; v <= hi; v += 0.2)
    yTicks.push(Number(v.toFixed(2)));
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
        {label} — 24-Ay Rolling Ortalama Sleeve Korelasyonu
      </div>
      <div className="chart-help">
        Her nokta, o aydan geriye 24 ayın tüm sleeve çiftleri arası{" "}
        <b>ortalama</b> korelasyonu. Düşük = güçlü çeşitlendirme. Tepe noktalar
        tipik olarak kriz aylarıdır: korelasyonlar 1&apos;e yaklaşır ve
        çeşitlendirme <b>tam ihtiyaç anında</b> zayıflar (korelasyon kümelenmesi).
        Kesik çizgi = tüm-dönem ortalaması.
      </div>
      <svg
        className="equity-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="24-ay rolling ortalama sleeve korelasyonu grafiği. Detay: üstteki başlık ve açıklamada."
      >
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} className="grid-line" />
            <text x={padL - 8} y={Y(v) + 3} className="axis-label" textAnchor="end">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <line
          x1={padL}
          x2={W - padR}
          y1={Y(mean)}
          y2={Y(mean)}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          style={{ strokeWidth: 1 }}
        />
        <path
          d={line}
          className="equity-line"
          stroke="#38bdf8"
          style={{ strokeWidth: 1.8 }}
        />
        {shown.map((t, idx) => (
          <text key={idx} x={X(t.i)} y={H - 8} className="axis-label" textAnchor="middle">
            {t.label}
          </text>
        ))}
      </svg>
      <div
        className={`rob-verdict ${
          last <= mean ? "ok" : last >= peak - 0.05 ? "thin" : ""
        }`}
      >
        Güncel: <b>{last.toFixed(2)}</b> · tüm-dönem ort: <b>{mean.toFixed(2)}</b> ·
        tepe (kriz): <b>{peak.toFixed(2)}</b>
        {" — "}
        {last <= mean
          ? "şu an çeşitlendirme ortalamanın üstünde (korelasyon düşük)."
          : "şu an korelasyon ortalamanın üstünde — çeşitlendirme faydası geçici olarak zayıf."}
      </div>
    </div>
  );
}

function CorrelationMatrix({ bt }: { bt: BacktestResult }) {
  const sleeves = bt.equityCurves.filter(
    (c) => !c.highlight && !c.name.includes("Bileşik") && !c.name.includes("Pasif")
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
      <div className="section-label" role="heading" aria-level={2}>
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
  { id: "commodity", label: "Emtia" },
  { id: "factor", label: "Faktör" },
  { id: "bond", label: "Tahvil" },
  { id: "assetclass", label: "Varlık Sınıfı" },
  { id: "country", label: "Ülke" },
  { id: "bist", label: "BIST 100" },
];

interface StudioResult {
  backtest: BacktestResult | null;
  label: string;
  lookback: number;
  topN: number;
  cost: number;
  universe: string;
}

type RobCell = { lb: number; topN: number; sharpe: number | null; cagr: number | null };
type RobData = {
  universe: string;
  lookbacks: number[];
  topNs: number[];
  cells: RobCell[];
};

function sharpeHeat(s: number | null): string {
  if (s == null) return "rgba(100,116,139,0.18)";
  if (s <= 0) return "rgba(239,68,68,0.55)";
  if (s < 0.3) return "rgba(245,158,11,0.42)";
  if (s < 0.6) return "rgba(234,179,8,0.45)";
  if (s < 0.9) return "rgba(132,204,22,0.5)";
  if (s < 1.2) return "rgba(34,197,94,0.58)";
  return "rgba(16,185,129,0.72)";
}

function cagrHeat(c: number | null): string {
  if (c == null) return "rgba(100,116,139,0.18)";
  if (c <= 0) return "rgba(239,68,68,0.55)";
  if (c < 0.05) return "rgba(245,158,11,0.42)";
  if (c < 0.1) return "rgba(234,179,8,0.45)";
  if (c < 0.15) return "rgba(132,204,22,0.5)";
  if (c < 0.25) return "rgba(34,197,94,0.58)";
  return "rgba(16,185,129,0.72)";
}

function EnsembleLookback() {
  const [uni, setUni] = useState("etf");
  const [bt, setBt] = useState<BacktestResult | null>(null);
  const [label, setLabel] = useState("GEM");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    fetch(`/api/ensemble?universe=${uni}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) {
          setErr(d.error);
          setBt(null);
        } else {
          setBt(d.backtest ?? null);
          setLabel(d.label ?? "Strateji");
        }
      })
      .catch((e) => alive && setErr(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [uni]);

  return (
    <>
      <div className="chart-card">
        <div className="chart-help">
          Aynı strateji <b>{`{3, 6, 9, 12}`}</b> ay look-back pencerelerinde
          koşulup <b>eşit-ağırlık harmanlanır</b>. Tek bir formasyon penceresine
          (örn. yalnız 12 ay) bağımlılığı azaltır — &quot;hangi look-back?&quot;
          parametre/timing luck&apos;ını söndürür (Hoffstein 2019 ensemble
          fikrinin look-back uyarlaması). Aşağıda <b>Ensemble</b> ana eğri;
          tekil pencereler kıyas için ayrıca çizilir.
        </div>
        <div className="cc-toggles">
          {STUDIO_UNIVERSES.map((u) => (
            <button
              key={u.id}
              className={`cc-toggle ${uni === u.id ? "on" : ""}`}
              aria-pressed={uni === u.id}
              onClick={() => setUni(u.id)}
            >
              {u.label}
            </button>
          ))}
        </div>
        {loading && <p className="table-note">Hesaplanıyor… (4 pencere)</p>}
        {err && <p className="table-note neg">Hata: {err}</p>}
        {!loading && !err && !bt && (
          <p className="table-note">Bu evrende ensemble üretilemedi.</p>
        )}
        {bt &&
          !loading &&
          (() => {
            const ens = bt.strategies.find((s) => s.name.includes("Ensemble"));
            const singles = bt.strategies.filter(
              (s) => /look-back/i.test(s.name) && s.sharpe != null
            );
            if (ens?.sharpe == null || singles.length < 2) return null;
            const shs = singles
              .map((s) => s.sharpe as number)
              .sort((a, b) => a - b);
            const lo = shs[0];
            const hi = shs[shs.length - 1];
            const med = shs[Math.floor(shs.length / 2)];
            const nearBest = ens.sharpe >= hi - 0.05;
            return (
              <div className={`rob-verdict ${nearBest ? "ok" : ""}`}>
                Ensemble Sharpe <b>{num(ens.sharpe)}</b> · tekil pencere Sharpe
                aralığı <b>{num(lo)}–{num(hi)}</b> (medyan {num(med)}) —{" "}
                {nearBest
                  ? "ensemble, hangi pencerenin kazanacağını önceden bilmeden en iyi tekil pencereye yakın (timing-luck söndürme çalışıyor)."
                  : "ensemble tekil pencerelerin ortasına yakın — tek pencere seçim riskini kaldırır ama bu seride en iyiyi yakalayamıyor."}
              </div>
            );
          })()}
      </div>
      {bt && !loading && (
        <BacktestCharts bt={bt} label={`${label} Ensemble`} />
      )}
    </>
  );
}

function RobustnessHeatmap() {
  const [uni, setUni] = useState("etf");
  const [metric, setMetric] = useState<"sharpe" | "cagr">("sharpe");
  const [data, setData] = useState<RobData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    fetch(`/api/robustness?universe=${uni}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) {
          setErr(d.error);
          setData(null);
        } else {
          setData(d as RobData);
        }
      })
      .catch((e) => alive && setErr(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [uni]);

  return (
      <div className="chart-card">
        <div className="chart-help">
          Strateji yalnız 12-ay/seçili top-N&apos;de mi iyi, yoksa tüm parametre
          yüzeyinde mi sağlam? <b>Geniş yeşil alan = dayanıklı</b> (aşırı-uyum
          riski düşük); kırmızı denizinde <b>tek parlak hücre = kiraz toplama</b>{" "}
          (kırılgan, muhtemelen şans). 12-ay satırı kitap-standardıdır.
        </div>
        <div className="cc-toggles">
          {STUDIO_UNIVERSES.map((u) => (
            <button
              key={u.id}
              className={`cc-toggle ${uni === u.id ? "on" : ""}`}
              aria-pressed={uni === u.id}
              onClick={() => setUni(u.id)}
            >
              {u.label}
            </button>
          ))}
        </div>
        <div className="cc-toggles" style={{ marginTop: -4 }}>
          {(["sharpe", "cagr"] as const).map((mk) => (
            <button
              key={mk}
              className={`cc-toggle ${metric === mk ? "on" : ""}`}
              aria-pressed={metric === mk}
              onClick={() => setMetric(mk)}
            >
              {mk === "sharpe" ? "Sharpe görünümü" : "CAGR görünümü"}
            </button>
          ))}
        </div>
        {loading && <p className="table-note">Hesaplanıyor…</p>}
        {err && <p className="table-note neg">Hata: {err}</p>}
        {data && !loading && (
          <>
            <div
              className="rob-grid"
              style={{
                gridTemplateColumns: `auto repeat(${data.topNs.length}, minmax(46px, 1fr))`,
              }}
            >
              <div className="rob-corner">LB ∖ N</div>
              {data.topNs.map((tn) => (
                <div key={`h${tn}`} className="rob-colh">
                  {data.universe === "etf" ? "GEM" : `Top-${tn}`}
                </div>
              ))}
              {data.lookbacks.flatMap((lb) => [
                <div key={`r${lb}`} className="rob-rowh">
                  {lb}a
                </div>,
                ...data.topNs.map((tn) => {
                  const c = data.cells.find((x) => x.lb === lb && x.topN === tn);
                  const val =
                    metric === "sharpe" ? c?.sharpe ?? null : c?.cagr ?? null;
                  const bg =
                    metric === "sharpe" ? sharpeHeat(val) : cagrHeat(val);
                  const disp =
                    val == null
                      ? "—"
                      : metric === "sharpe"
                      ? val.toFixed(2)
                      : `${(val * 100).toFixed(0)}%`;
                  return (
                    <div
                      key={`c${lb}-${tn}`}
                      className={`rob-cell ${lb === 12 ? "std" : ""}`}
                      style={{ background: bg }}
                      title={`Look-back ${lb}a · ${
                        data.universe === "etf" ? "GEM" : `Top-${tn}`
                      } → Sharpe ${num(c?.sharpe ?? null)}, CAGR ${pct(
                        c?.cagr ?? null
                      )}`}
                    >
                      {disp}
                    </div>
                  );
                }),
              ])}
            </div>
            {(() => {
              const vals = data.cells
                .map((c) => (metric === "sharpe" ? c.sharpe : c.cagr))
                .filter((s): s is number => s != null && isFinite(s));
              if (vals.length < 2) return null;
              const sorted = [...vals].sort((a, b) => a - b);
              const med = sorted[Math.floor(sorted.length / 2)];
              const solidThr = metric === "sharpe" ? 0.5 : 0.05;
              const solid = vals.filter((s) => s > solidThr).length;
              const pos = vals.filter((s) => s > 0).length;
              const pctSolid = (solid / vals.length) * 100;
              const verdict =
                pctSolid >= 70
                  ? { t: "Dayanıklı", c: "ok" }
                  : pctSolid >= 40
                  ? { t: "Orta", c: "" }
                  : { t: "Kırılgan", c: "thin" };
              const fmt = (v: number) =>
                metric === "sharpe" ? v.toFixed(2) : `%${(v * 100).toFixed(0)}`;
              const lbl = metric === "sharpe" ? "Sharpe>0.5" : "CAGR>%5";
              const medLbl = metric === "sharpe" ? "Sharpe" : "CAGR";
              return (
                <div className={`rob-verdict ${verdict.c}`}>
                  Dayanıklılık ({medLbl}): <b>{verdict.t}</b> —{" "}
                  {vals.length} konfigürasyonun <b>%{pctSolid.toFixed(0)}</b>&apos;i{" "}
                  {lbl} (%{((pos / vals.length) * 100).toFixed(0)}&apos;i pozitif) ·
                  medyan {medLbl} <b>{fmt(med)}</b> · aralık {fmt(sorted[0])}–
                  {fmt(sorted[sorted.length - 1])}.
                </div>
              );
            })()}
            <p className="table-note">
              Hücre = o look-back &amp; top-N ile{" "}
              {metric === "sharpe" ? "yıllık Sharpe" : "yıllık CAGR"} (renk:
              kırmızı≤0 → yeşil yüksek). 12-ay satırı kalın çerçeveli (Antonacci
              standardı).{" "}
              {uni === "etf"
                ? "GEM tekli seçim yaptığından top-N'den bağımsızdır (tek sütun)."
                : "Sütunlar farklı top-N (seçilen varlık sayısı) değerleridir."}{" "}
              Yüksek &quot;dayanıklılık&quot; = strateji parametre
              seçimine duyarlı değil (aşırı-uyum riski düşük). Sharpe görünümü
              risk-ayarlı, CAGR görünümü ham getiri yüzeyini gösterir.
            </p>
          </>
        )}
      </div>
  );
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

      {busy && !res && (
        <div className="studio-state">
          <div className="spinner" />
          Backtest hesaplanıyor…
        </div>
      )}
      {err && !busy && <div className="error-box">{err}</div>}
      {!err && bt && (
        <div className={busy ? "studio-dim" : ""}>
          <div className="section-label" role="heading" aria-level={2}>
            {res?.label} — look-back {res?.lookback} ay
            {!isEtf ? `, top-${res?.topN}` : ""}
            {res && res.cost > 0 ? `, maliyet ${res.cost}bps` : ""} (
            {bt.startDate} → {bt.endDate}, {bt.months} ay)
            {busy && <span className="studio-updating"> · ⟳ güncelleniyor…</span>}
          </div>
          {(() => {
            // Bu parametrelerle güncel ay pozisyonu (timeline son kaydı).
            const last = bt.timeline?.[bt.timeline.length - 1];
            if (!last) return null;
            const isCashPos = last.key === "bil" || last.key === "cash";
            const meta = posMeta(last.key);
            return (
              <p className="table-note">
                <b>Bu ay bu parametrelerle:</b>{" "}
                <span className={`badge ${isCashPos ? "badge-cash" : "badge-long"}`}>
                  <span className="dot" />
                  {isCashPos ? "NAKİT" : meta.label}
                </span>{" "}
                tutulurdu (en güncel ay sinyali).
              </p>
            );
          })()}
          {(() => {
            const mom = bt.strategies[0];
            const bench =
              bt.strategies.find((s) => /Eşit[\s-]Ağırlık/.test(s.name)) ??
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
                fark veriyor — {dS >= 0 ? "risk-ayarlı geçiyor ✓" : "risk-ayarlı geçemiyor"}.
              </p>
            );
          })()}
          <BacktestCharts
            bt={bt}
            label={res?.label ?? "Strateji"}
            investedKey={res && res.universe !== "etf" ? res.universe : undefined}
          />
        </div>
      )}
      {!busy && !err && !bt && res && (
        <div className="studio-state">
          Bu evren/parametrelerle backtest üretilemedi (yetersiz ortak geçmiş
          olabilir).
        </div>
      )}
    </div>
  );
}

function CaptureRatios({ bt }: { bt: BacktestResult }) {
  const mom = bt.equityCurves.find((c) => c.highlight);
  const bench =
    bt.equityCurves.find((c) => /Eşit[\s-]Ağırlık/.test(c.name)) ??
    bt.equityCurves.find((c) => !c.highlight);
  if (!mom || !bench) return null;
  const m = Math.min(mom.growth.length, bench.growth.length);
  if (m < 13) return null;
  let upS = 0;
  let upB = 0;
  let dnS = 0;
  let dnB = 0;
  let upN = 0;
  let dnN = 0;
  for (let i = 1; i < m; i++) {
    const sr = mom.growth[i] / mom.growth[i - 1] - 1;
    const br = bench.growth[i] / bench.growth[i - 1] - 1;
    if (br > 0) {
      upS += sr;
      upB += br;
      upN++;
    } else if (br < 0) {
      dnS += sr;
      dnB += br;
      dnN++;
    }
  }
  const up = upB !== 0 ? upS / upB : null;
  const dn = dnB !== 0 ? dnS / dnB : null;
  if (up == null && dn == null) return null;
  const benchName = bench.name.replace(/\s*\(.*\)/, "");
  // Yakalama oranı = yukarı ÷ aşağı (>1 iyi). Aşağı-yakalama ≤0 ise strateji
  // düşüş aylarında pozitif → oran etkin olarak sonsuz (en iyi durum).
  const capInfinite = up != null && up > 0 && dn != null && dn <= 0;
  const capRatio = up != null && dn != null && dn > 0 ? up / dn : null;

  return (
    <div className="chart-card">
      <div className="chart-title">
        Yukarı / Aşağı Yakalama — {benchName} aylarına göre
      </div>
      <div className="cap-grid">
        <div className="cap-item">
          <div className="cap-label">Yukarı Yakalama ({upN} ay)</div>
          <div className="cap-val pos">{up != null ? `%${(up * 100).toFixed(0)}` : "—"}</div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Aşağı Yakalama ({dnN} ay)</div>
          <div className={`cap-val ${dn != null && dn < 0.7 ? "pos" : "neg"}`}>
            {dn != null ? `%${(dn * 100).toFixed(0)}` : "—"}
          </div>
        </div>
        <div className="cap-item">
          <div className="cap-label">Yakalama Oranı (Yukarı÷Aşağı)</div>
          <div
            className={`cap-val ${
              capInfinite || (capRatio != null && capRatio > 1) ? "pos" : "neg"
            }`}
          >
            {capInfinite
              ? "∞"
              : capRatio != null
              ? `${capRatio.toFixed(2)}×`
              : "—"}
          </div>
        </div>
      </div>
      <p className="chart-help">
        Benchmark&apos;ın yükseldiği aylarda strateji getirisinin oranı (yukarı)
        ve düştüğü aylarda oranı (aşağı). <b>İdeal: yüksek yukarı, düşük aşağı.</b>{" "}
        Düşük aşağı-yakalama, dual momentum&apos;un düşüş korumasının somut
        ölçüsüdür (nakde kaçış sayesinde benchmark&apos;ın kayıplarının yalnızca
        bir kısmını yer). <b>Yakalama oranı</b> ikisini tek sayıya indirger
        (yukarı ÷ aşağı): <b>&gt;1 değerli</b> — strateji yükselişlerin daha
        büyük payını alırken düşüşlerin daha küçük payını yer.{" "}
        {capInfinite
          ? "Burada ∞: strateji benchmark düşüş aylarında ortalama pozitif (en güçlü koruma)."
          : null}
      </p>
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
      <TradeLog bt={bt} label={label} />
      <UnderwaterChart bt={bt} label={label} />
      <UnderwaterCompare bt={bt} label={label} />
      <DrawdownEpisodes bt={bt} label={label} />
      <MonthlyHeatmap bt={bt} label={label} />
      <YearlyReturns bt={bt} label={label} />
      <CrisisPerformance bt={bt} label={label} />
      <BootstrapRisk bt={bt} label={label} />
      <SplitSampleConsistency bt={bt} label={label} />
      <StartDateSensitivity bt={bt} label={label} />
      <ProbabilisticSharpe bt={bt} label={label} />
      <VolTargetPanel bt={bt} label={label} />
      <RiskReturnChart rows={bt.strategies} />
      <RollingReturnsChart bt={bt} label={label} />
      <RollingVol bt={bt} label={label} />
      <RollingSharpe bt={bt} label={label} />
      <RollingRelative bt={bt} label={label} />
      <RelativeStrengthChart bt={bt} label={label} />
      <ScatterGemVsBench bt={bt} label={label} />
      <CaptureRatios bt={bt} />
      <BoxPlot bt={bt} />
      <ReturnHistogram bt={bt} label={label} />
      <StreakStats bt={bt} label={label} />
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

      {bt?.strategies[0] &&
        (() => {
          const mom = bt.strategies[0];
          const bench =
            bt.strategies.find((s) => /Eşit[\s-]Ağırlık/.test(s.name)) ??
            bt.strategies[bt.strategies.length - 1];
          if (!bench || bench === mom) return null;
          const dC = (mom.cagr ?? 0) - (bench.cagr ?? 0);
          const dS = (mom.sharpe ?? 0) - (bench.sharpe ?? 0);
          return (
            <p className="table-note" style={{ marginTop: 0 }}>
              Momentum vs eşit-ağırlık al-tut: CAGR{" "}
              <b className={dC >= 0 ? "pos-cell" : "neg"}>
                {dC >= 0 ? "+" : ""}
                {pct(dC)}
              </b>{" "}
              · Sharpe{" "}
              <b className={dS >= 0 ? "pos-cell" : "neg"}>
                {dS >= 0 ? "+" : ""}
                {num(dS)}
              </b>{" "}
              —{" "}
              {dS > 0
                ? "momentum bu evrende risk-ayarlı değer katıyor."
                : "bu evrende momentum al-tut'u risk-ayarlı geçemiyor (düşüş korumasına da bak)."}
            </p>
          );
        })()}

      {u.momentum && <MomentumBoard data={u.momentum} label={u.label} />}

      {u.signals && (
        <SignalBoard
          board={u.signals}
          title={`${u.label} Sinyal Panosu — her varlığın anahtar momentum sinyalleri (12-ay, excess, MA trendi, 52-hafta)`}
        />
      )}

      {u.lookback && <LookbackHeatmap data={u.lookback} label={u.label} />}

      {bt && (
        <CollapsibleSection
          defaultOpen={false}
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
      <a href="#ana-icerik" className="skip-link">İçeriğe atla</a>
      <div className="header" role="banner">
        <div>
          <h1 className="title">Dual Momentum Analiz Motoru</h1>
          <p className="subtitle">
            11 varlık evreni · GEM + bileşik meta-strateji — Antonacci dual
            momentum&apos;un canlı, şeffaf hesaplamaları (12 ay look-back, T-Bill
            eşiği)
          </p>
        </div>
        <div className="header-right">
          <button
            className="refresh-btn ghost"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("csec:setall", { detail: { open: true } })
              )
            }
            title="Tüm bölümleri genişlet"
            aria-label="Tüm bölümleri genişlet"
          >
            ⤢ Tümü
          </button>
          <button
            className="refresh-btn ghost"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("csec:setall", { detail: { open: false } })
              )
            }
            title="Tüm bölümleri daralt"
            aria-label="Tüm bölümleri daralt"
          >
            ⤡ Daralt
          </button>
          <button
            className="refresh-btn ghost"
            onClick={exportCsv}
            disabled={!data}
            title="Metrikleri ve sinyalleri CSV olarak indir"
            aria-label="Tüm metrikleri ve sinyalleri CSV indir"
          >
            ⭳ CSV
          </button>
          <button
            className="refresh-btn ghost"
            onClick={exportJson}
            disabled={!data}
            title="Tüm analizi JSON olarak indir"
            aria-label="Tüm analizi JSON indir"
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
            <span className="timestamp" aria-live="polite">
              Güncellendi: {fmtTime(data.generatedAt)}{" "}
              <span style={{ opacity: 0.7 }}>({relTime(data.generatedAt)})</span>
              {data.fromCache && (
                <span className="cache-badge" title="Sonuç 10 dk'lık sunucu önbelleğinden geldi. Taze veri için Yenile.">
                   önbellek
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      <main id="ana-icerik" tabIndex={-1}>

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
            {!isCash &&
              (() => {
                const gw = data.signals.assets.find((a) => a.isGemWinner);
                if (gw && opposed(gw.mom121, gw.ret12m))
                  return (
                    <p className="hero-warn">
                      ⚠ Bu seçimin yükselişini büyük ölçüde son ay taşımış (12-1
                      ölçütü ters); gelecek ay geri çekilme riski yüksek olabilir.
                    </p>
                  );
                return null;
              })()}
          </div>

          {/* Sade dil yatırım özeti — en üstte, Ayşe teyzeye anlatır gibi */}
          <ErrorBoundary label="Sade özet">
            <YatirimTavsiyesi data={data} />
          </ErrorBoundary>

          {/* Otomatik içgörü özeti */}
          <KeyInsights data={data} />

          {/* Bu ayın tüm evren sinyalleri */}
          <ConsolidatedSignals data={data} />

          {/* Evrenler-arası risk iştahı haritası */}
          <ErrorBoundary label="Evren momentum gücü">
            <UniverseMomentumStrength data={data} />
          </ErrorBoundary>

          {/* Metodoloji açıklaması */}
          <MethodologyPanel />

          {/* Etkileşimli backtest stüdyosu */}
          <ErrorBoundary label="Backtest Stüdyosu">
            <BacktestStudio />
          </ErrorBoundary>

          {/* Parametre dayanıklılık (overfitting) haritası — açılınca yüklenir */}
          <ErrorBoundary label="Parametre dayanıklılık haritası">
            <CollapsibleSection
              title="🧯 Parametre Dayanıklılık Haritası — look-back × top-N (overfitting testi)"
              defaultOpen={false}
            >
              <RobustnessHeatmap />
            </CollapsibleSection>
          </ErrorBoundary>

          {/* Çok-pencereli (look-back) ensemble — açılınca yüklenir */}
          <ErrorBoundary label="Ensemble look-back">
            <CollapsibleSection
              title="🪟 Çok-Pencereli Ensemble — look-back timing-luck'ını söndür"
              defaultOpen={false}
            >
              <EnsembleLookback />
            </CollapsibleSection>
          </ErrorBoundary>

          {/* Strateji karşılaştırma tablosu */}
          <StrategyLeaderboard data={data} />

          {/* Momentum vs al-tut katma değeri */}
          <MomentumValueAdd data={data} />

          {/* Kesitsel momentum dağılımı (relative momentum ayırt ediciliği) */}
          <CollapsibleSection
            title="📊 Momentum Dağılımı — relative momentum şu an ne kadar ayırt edici?"
            defaultOpen={false}
          >
            <ErrorBoundary label="Momentum dağılımı">
              <MomentumDispersion data={data} />
            </ErrorBoundary>
          </CollapsibleSection>

          {/* Ortak-dönem equity curve overlay (adil kıyas) */}
          <ErrorBoundary label="Ortak-dönem karşılaştırması">
            <CrossUniverseComparison data={data} />
          </ErrorBoundary>
          <ErrorBoundary label="Evrenler-arası risk-getiri">
            <CrossUniverseRiskReturn data={data} />
          </ErrorBoundary>
          <CollapsibleSection
            title="📅 Yıllık Getiri Matrisi — stratejiler × takvim yılları (liderlik rotasyonu)"
            defaultOpen={false}
          >
            <ErrorBoundary label="Yıllık getiri matrisi">
              <AnnualReturnsMatrix data={data} />
            </ErrorBoundary>
          </CollapsibleSection>
          <ErrorBoundary label="Özel bileşik oluşturucu">
            <CustomComposite data={data} />
          </ErrorBoundary>
          <CollapsibleSection
            title="🧮 Marjinal Sleeve Katkısı (leave-one-out) — her evren değer katıyor mu?"
            defaultOpen={false}
          >
            <ErrorBoundary label="Marjinal sleeve katkısı">
              <MarginalContribution data={data} />
            </ErrorBoundary>
          </CollapsibleSection>

          {/* Dual Momentum Bileşik — tüm evrenlerin eşit-ağırlık meta-stratejisi */}
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
                Tüm evrenlerin (GEM + hisse, kripto, sektör, uluslararası, emtia,
                faktör, tahvil, varlık-sınıfı, ülke) momentum stratejilerini her
                ay <b>eşit ağırlıkla</b> birleştiren
                çeşitlendirilmiş meta-strateji.
                Sleeve&apos;ler imperfect korelasyonlu olduğundan bileşik
                genelde tek bir sleeve&apos;den <b>daha yüksek Sharpe / daha
                düşük drawdown</b> hedefler. Aşağıdaki equity curve&apos;de
                bileşik (yeşil, kalın) sleeve&apos;lerle birlikte gösterilir.
              </p>
              <CompositeStance data={data} />
              <CompositeHoldings data={data} />
              <EquityChart bt={data.composite} />
              <UnderwaterChart bt={data.composite} label="Bileşik" />
              <UnderwaterCompare bt={data.composite} label="Bileşik" />
              <DrawdownEpisodes bt={data.composite} label="Bileşik" />
              <MonthlyHeatmap bt={data.composite} label="Bileşik" />
              <MetricsTable rows={data.composite.strategies} />
              <p className="table-note">{data.composite.note}</p>
              <p className="table-note">
                <b>Üç ağırlıklandırma:</b> <b>eşit-ağırlık</b> (her sleeve 1/n) ·{" "}
                <b>risk-parity</b> (ters-volatilite, w=(1/σ)/Σ(1/σ); düşük-vol
                sleeve&apos;lere ağırlık) · <b>risk-parity tavanlı</b> (aynı ama
                hiçbir sleeve adil payın 2.5×&apos;ini geçemez — tahvil gibi
                ultra-düşük-vol sleeve&apos;lerin bloğu domine etmesini önler).
                Tablodaki üç 🧩 satırını karşılaştır.
              </p>
              <AdvancedMetricsTable rows={data.composite.strategies} />
              {(() => {
                const ex = excessTStat(data.composite);
                if (!ex) return null;
                const sig = Math.abs(ex.t) >= 1.96;
                return (
                  <p className="table-note">
                    <b>Aktif değer (pasif al-tut&apos;a karşı):</b> bileşiğin pasif
                    eşit-ağırlık benchmark&apos;a karşı Bilgi Oranı{" "}
                    <b className={ex.ir >= 0 ? "pos-cell" : "neg"}>
                      {ex.ir >= 0 ? "+" : ""}
                      {ex.ir.toFixed(2)}
                    </b>
                    , aylık fark t-stat{" "}
                    <b className={sig ? "pos-cell" : ""}>
                      {ex.t.toFixed(2)} {sigMark(ex.t)}
                    </b>{" "}
                    ({ex.n} ay).{" "}
                    {sig
                      ? "Dual momentum'un pasif tutmaya kattığı değer istatistiksel olarak anlamlı."
                      : "Üstünlük istatistiksel olarak kesin değil; oto-korelasyon nedeniyle t-stat'ı temkinli yorumla."}
                  </p>
                );
              })()}
              <CollapsibleSection
                title="🔬 Bileşik — Derin Risk & Dayanıklılık Analizi (kriz · bootstrap · örneklem · PSR · vol-hedef)"
                defaultOpen={false}
              >
                <CrisisPerformance bt={data.composite} label="Bileşik" />
                <BootstrapRisk bt={data.composite} label="Bileşik" />
                <SplitSampleConsistency bt={data.composite} label="Bileşik" />
                <StartDateSensitivity bt={data.composite} label="Bileşik" />
                <ProbabilisticSharpe bt={data.composite} label="Bileşik" />
                <VolTargetPanel bt={data.composite} label="Bileşik" />
              </CollapsibleSection>
              <CompositeAttribution bt={data.composite} />
              <RiskParityWeights bt={data.composite} />
              <CorrelationMatrix bt={data.composite} />
              {data.compositeFactorAlpha && (
                <FactorAlphaPanel
                  fa={data.compositeFactorAlpha}
                  subject="Bileşik meta-strateji"
                />
              )}
              <DiversificationRatio bt={data.composite} />
              <Benchmark6040 data={data} />
              <Composite6040Overlay data={data} />
              <RollingCorrelation bt={data.composite} label="Bileşik" />
            </CollapsibleSection>
            </ErrorBoundary>
          )}

          {/* Evren sekmeleri (ETF + dinamik evrenler) */}
          <div
            className="view-tabs"
            role="tablist"
            aria-label="Varlık evreni sekmeleri"
            onKeyDown={(e) => {
              const ids = ["etf", ...data.universes.map((u) => u.id)];
              const idx = ids.indexOf(view);
              let next = -1;
              if (e.key === "ArrowRight" || e.key === "ArrowDown")
                next = (idx + 1) % ids.length;
              else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
                next = (idx - 1 + ids.length) % ids.length;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = ids.length - 1;
              if (next >= 0) {
                e.preventDefault();
                selectView(ids[next]);
                document.getElementById(`vtab-${ids[next]}`)?.focus();
              }
            }}
          >
            <button
              id="vtab-etf"
              role="tab"
              aria-selected={view === "etf"}
              aria-controls="vpanel-etf"
              tabIndex={view === "etf" ? 0 : -1}
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
                id={`vtab-${u.id}`}
                role="tab"
                aria-selected={view === u.id}
                aria-controls={`vpanel-${u.id}`}
                tabIndex={view === u.id ? 0 : -1}
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
          <div role="tabpanel" id="vpanel-etf" aria-labelledby="vtab-etf">
          {/* Varlık Sinyal Panosu */}
          {data.signals && <SignalBoard board={data.signals} />}

          {/* Look-back Duyarlılık Matrisi */}
          {data.lookback && <LookbackHeatmap data={data.lookback} />}

          {/* Backtest & Metrikler */}
          {bt && (
            <CollapsibleSection
              defaultOpen={false}
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
          </div>
          )}

          {/* ETF dışı evrenler (hisse, kripto, ...) — seçili sekmeye göre */}
          {data.universes.map(
            (u) =>
              view === u.id && (
                <div
                  key={u.id}
                  role="tabpanel"
                  id={`vpanel-${u.id}`}
                  aria-labelledby={`vtab-${u.id}`}
                >
                  <UniverseSection u={u} />
                </div>
              )
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

          <CollapsibleSection
            title="📐 Metodoloji & Bilinen Kısıtlar (nasıl hesaplanıyor?)"
            defaultOpen={false}
          >
            <div className="chart-help" style={{ lineHeight: 1.7 }}>
              <p>
                <b>Veri:</b> Yahoo Finance düzeltilmiş kapanış = toplam getiri
                (temettü/faiz dahil), aya normalize edilir. Her evrende seriler{" "}
                <b>ortak dönemde</b> hizalanır (en geç başlayan varlık başlangıcı
                belirler).
              </p>
              <p>
                <b>Sinyal & uygulama:</b> Tüm momentum ölçümleri <b>ay sonunda</b>{" "}
                (<code>t</code>) hesaplanır; pozisyon bir <b>sonraki ay</b>{" "}
                (<code>t+1</code>) getirisini realize eder — yani sinyal anında
                bilinmeyen veri kullanılmaz (<b>lookahead-bias yok</b>). Yeniden
                dengeleme aylıktır.
              </p>
              <p>
                <b>Mutlak momentum eşiği:</b> Bir varlık ancak son 12-ay getirisi{" "}
                <b>T-Bill</b>&apos;i (BIL) geçerse tutulur; geçmezse pozisyon nakde
                döner (trend filtresi).
              </p>
              <p>
                <b>İşlem maliyeti:</b> Çekirdek backtest&apos;ler maliyetsizdir;
                Backtest Stüdyosu&apos;nda devir-bazlı bps maliyeti
                (τ=½·Σ|Δw|) test edilebilir. Vergi, kayma (slippage) ve likidite
                etkileri modellenmez.
              </p>
              <p>
                <b>⚠️ Seçim / hayatta-kalma yanlılığı:</b> Evrenlerin içeriği{" "}
                <b>bugünün bilgisiyle</b> seçildi (örn. bugün likit/başarılı olan
                hisse, ETF ve coinler). Geçmişte bu tam listeyi seçemezdiniz;
                bu, tarihsel sonuçları <b>yukarı yönlü</b> şişirebilir. Sonuçları
                mutlak gerçek değil, <b>göreli/yöntemsel</b> kıyas olarak okuyun.
              </p>
              <p>
                <b>İstatistiksel testler:</b> PSR örneklem-içidir (gözlenen
                Sharpe&apos;ın gerçekte &gt; 0 olma olasılığı). DSR çoklu-deneme
                düzeltmesi, farklı evrenleri <b>bağımsız deneme vekili</b> sayar
                (saf Bailey–López de Prado aynı backtest&apos;in parametre
                taramasını varsayar) — yaklaşık yorumlanmalıdır.
              </p>
              <p>
                <b>ETF vekilleri:</b> Bazı varlık sınıfları/faktörler için ilgili
                ETF, temel endeksin <b>vekilidir</b>; ETF&apos;in masraf oranı ve
                takip hatası tarihsel endeks getirisinden küçük sapmalara yol
                açabilir.
              </p>
              <p>
                <b>Kıyas portföyleri:</b> Bileşik üç referansa karşı değerlendirilir
                — kendi <b>pasif eşit-ağırlık al-tut</b> blendi (sleeve değeri),{" "}
                <b>Fama-French 3 faktör</b> regresyonu (alpha), ve <b>60/40</b>{" "}
                (%60 SPY + %40 AGG, aylık dengeli) evrensel &quot;tembel portföy&quot;.
                Hepsi bileşiğin <b>ortak döneminde</b> ve aynı T-Bill ile excess Sharpe
                bazında hesaplanır (elma-elmaya).
              </p>
            </div>
          </CollapsibleSection>

          <p className="disclaimer">
            ⚠️ <b>Yalnızca eğitim/bilgilendirme amaçlıdır; yatırım tavsiyesi
            değildir.</b> Tüm strateji sonuçları (GEM, evren momentumları,
            bileşik, &quot;bu ay al&quot; listeleri) <b>hipotetik backtest</b>'tir
            — gerçek hesap değildir ve gelecek getiriyi garanti etmez. Backtest&apos;ler
            işlem maliyeti içermez (yalnızca Stüdyo&apos;da maliyeti test
            edebilirsin); vergi, kayma (slippage) ve likidite etkileri yoktur.
            Evrenlerin veri geçmişi farklı başlar, mutlak getiriler doğrudan
            karşılaştırılamaz. Veriler Yahoo Finance&apos;ten gecikmeli/yaklaşık
            olabilir; metodoloji <code>dual-momentum-kapsam/</code>
            dokümanına dayanır. Yatırım kararları için lisanslı bir danışmana
            başvurun.
          </p>
        </>
      )}

      </main>

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
