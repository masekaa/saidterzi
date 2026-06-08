// backtest.ts — GEM stratejisinin 3-varlık evreninde tarihsel simülasyonu.
// Kapsam: 04-risk-ve-metrikler.md, 05-backtest-sonuclari.md.
// Lookahead bias yok: sinyal t-sonu verisiyle hesaplanır, getiri t+1'de gerçekleşir.

import {
  alignSeries,
  annualReturnArithmetic,
  cagr,
  annualVolatility,
  sharpeRatio,
  maxDrawdown,
  pctProfitableMonths,
  totalReturn,
  sortinoRatio,
  skewness,
  kurtosis,
  cvar,
  maxDrawdownDetail,
} from "./calc";
import {
  CORE_ASSETS,
  TBILL,
  LOOKBACK_MONTHS,
  STOCK_UNIVERSE,
  STOCK_TOP_N,
} from "./universe";
import type { BacktestResult, RawSeries, StrategyMetrics } from "./types";

type RawMap = Record<string, RawSeries>;

function buildMetrics(
  name: string,
  rets: number[],
  rf: number[],
  extra?: { switchesPerYear?: number; timeInAsset?: Record<string, number> }
): StrategyMetrics {
  const ddDetail = maxDrawdownDetail(rets);
  return {
    name,
    annualReturnArith: annualReturnArithmetic(rets),
    cagr: cagr(rets),
    annualVol: annualVolatility(rets),
    sharpe: sharpeRatio(rets, rf),
    maxDrawdown: maxDrawdown(rets),
    pctProfitMonths: pctProfitableMonths(rets),
    totalReturn: totalReturn(rets),
    sortino: sortinoRatio(rets, rf),
    skewness: skewness(rets),
    kurtosis: kurtosis(rets),
    cvar5: cvar(rets, 0.05),
    ddDurationMonths: ddDetail?.durationMonths ?? null,
    ddRecoveryMonths: ddDetail?.recoveryMonths ?? null,
    switchesPerYear: extra?.switchesPerYear ?? null,
    timeInAsset: extra?.timeInAsset,
  };
}

export function runBacktest(
  core: RawMap,
  tbill: RawSeries,
  lookback: number = LOOKBACK_MONTHS,
  costBps: number = 0
): BacktestResult | null {
  const LB = Math.max(1, Math.round(lookback));
  const keys = CORE_ASSETS.map((a) => a.key);
  const seriesMap: Record<string, RawSeries["series"]> = {};
  for (const a of CORE_ASSETS) {
    if (!core[a.key]) return null;
    seriesMap[a.key] = core[a.key].series;
  }
  seriesMap[TBILL.key] = tbill.series;

  const { dates, closes } = alignSeries(seriesMap);
  const n = dates.length;
  if (n < LB + 3) return null;

  // Getiri serileri (her benchmark + GEM), ortak periyot: t = L .. n-2
  const gemRets: number[] = [];
  const rf: number[] = [];
  const bh: Record<string, number[]> = {};
  for (const k of keys) bh[k] = [];
  const ew: number[] = []; // eşit ağırlık (aylık rebalance)

  const positions: string[] = [];

  for (let t = LB; t <= n - 2; t++) {
    // Sinyal: t-sonu 12-ay getiriler
    let bestKey = keys[0];
    let bestRet = -Infinity;
    for (const k of keys) {
      const r = closes[k][t] / closes[k][t - LB] - 1;
      if (r > bestRet) {
        bestRet = r;
        bestKey = k;
      }
    }
    const tbillRet12 =
      closes[TBILL.key][t] / closes[TBILL.key][t - LB] - 1;
    const pos = bestRet > tbillRet12 ? bestKey : TBILL.key;
    positions.push(pos);

    // t+1 getirileri (gerçekleşen)
    const rfNext = closes[TBILL.key][t + 1] / closes[TBILL.key][t] - 1;
    rf.push(rfNext);
    gemRets.push(closes[pos][t + 1] / closes[pos][t] - 1);
    let ewSum = 0;
    for (const k of keys) {
      const r = closes[k][t + 1] / closes[k][t] - 1;
      bh[k].push(r);
      ewSum += r;
    }
    ew.push(ewSum / keys.length);
  }

  // İşlem maliyeti (round-trip bps): pozisyon değiştiğinde tam devir (τ=1).
  if (costBps > 0) {
    for (let i = 1; i < positions.length; i++)
      if (positions[i] !== positions[i - 1]) gemRets[i] -= costBps / 10000;
  }

  // Pozisyon istatistikleri
  let switches = 0;
  for (let i = 1; i < positions.length; i++)
    if (positions[i] !== positions[i - 1]) switches++;
  const years = positions.length / 12;
  const timeInAsset: Record<string, number> = {};
  for (const p of positions) timeInAsset[p] = (timeInAsset[p] ?? 0) + 1;
  for (const k of Object.keys(timeInAsset))
    timeInAsset[k] = +((timeInAsset[k] / positions.length) * 100).toFixed(1);

  // Kaldıraçlı GEM (Appendix B): r_lev = L·r_gem − (L−1)·rf  (borç maliyeti rf)
  const LEV = 1.5;
  const gemLevRets = gemRets.map((r, i) => LEV * r - (LEV - 1) * rf[i]);

  const strategies: StrategyMetrics[] = [
    buildMetrics("GEM (Dual Momentum)", gemRets, rf, {
      switchesPerYear: +(switches / years).toFixed(2),
      timeInAsset,
    }),
    buildMetrics(`GEM ${LEV}× Kaldıraçlı`, gemLevRets, rf),
    ...CORE_ASSETS.map((a) =>
      buildMetrics(`${a.name} (Al-Tut)`, bh[a.key], rf)
    ),
    buildMetrics("Eşit Ağırlık (Al-Tut)", ew, rf),
  ];

  // Equity curve: getiri serisinden 1$ baslangicli kumulatif buyume.
  const toGrowth = (rets: number[]): number[] => {
    const g: number[] = [1];
    let acc = 1;
    for (const r of rets) {
      acc *= 1 + r;
      g.push(acc);
    }
    return g;
  };
  const curveDates: string[] = [dates[LB]];
  for (let t = LB; t <= n - 2; t++) curveDates.push(dates[t + 1]);

  // GEM pozisyon zaman serisi: positions[i] -> realize ayi dates[L+1+i]
  const timeline = positions.map((key, i) => ({
    date: dates[LB + 1 + i],
    key,
  }));
  const equityCurves = [
    { name: "GEM (Dual Momentum)", growth: toGrowth(gemRets), highlight: true },
    { name: `GEM ${LEV}× Kaldıraçlı`, growth: toGrowth(gemLevRets) },
    ...CORE_ASSETS.map((a) => ({
      name: `${a.name} (Al-Tut)`,
      growth: toGrowth(bh[a.key]),
    })),
    { name: strategies[strategies.length - 1].name, growth: toGrowth(ew) },
  ];

  return {
    startDate: dates[LB + 1] ?? dates[LB],
    endDate: dates[n - 1],
    months: gemRets.length,
    strategies,
    dates: curveDates,
    equityCurves,
    timeline,
    note: `Ortak veri periyodunda aylık simülasyon. Sinyal t-sonu, getiri t+1 (lookahead bias yok). İşlem maliyeti: ${
      costBps > 0
        ? `round-trip ${costBps} bps, pozisyon değişiminde uygulandı (yalnızca momentum stratejisine)`
        : "dahil değil"
    }.`,
  };
}

// ===========================================================================
//  HİSSE MOMENTUM ROTASYON BACKTEST'İ
//  Her ay: 12-ay getiriye göre top-N hisse seç (T-Bill'i geçenler), eşit ağırlık;
//  hiçbiri geçemezse nakit. Benchmark: tüm hisselerin eşit-ağırlık al-tut'u.
//  ETF GEM backtest'iyle aynı BacktestResult şekli → tüm grafikler yeniden kullanılır.
// ===========================================================================
export function runStockBacktest(
  stockRaw: RawMap,
  tbill: RawSeries,
  universe = STOCK_UNIVERSE,
  topN: number = STOCK_TOP_N,
  opts: {
    stratLabel?: string;
    benchLabel?: string;
    investedKey?: string;
    lookback?: number;
    costBps?: number;
  } = {}
): BacktestResult | null {
  const stratLabel = opts.stratLabel ?? "Hisse Momentum";
  const benchLabel = opts.benchLabel ?? "Eşit Ağırlık (Tüm Hisseler)";
  const investedKey = opts.investedKey ?? "stocks";
  const LB = Math.max(1, Math.round(opts.lookback ?? LOOKBACK_MONTHS));
  const costBps = Math.max(0, opts.costBps ?? 0);
  const keys = universe.map((s) => s.key).filter((k) => stockRaw[k]);
  if (keys.length < 3) return null;

  const seriesMap: Record<string, RawSeries["series"]> = {};
  for (const k of keys) seriesMap[k] = stockRaw[k].series;
  seriesMap[TBILL.key] = tbill.series;

  const { dates, closes } = alignSeries(seriesMap);
  const n = dates.length;
  if (n < LB + 3) return null;

  const TOPN = topN;
  const stratRets: number[] = [];
  const ewRets: number[] = [];
  const rf: number[] = [];
  const positions: string[] = []; // "stocks" | "bil"
  const pickSets: Set<string>[] = []; // her ay tutulan sepet (devir için)

  for (let t = LB; t <= n - 2; t++) {
    const tbill12 =
      closes[TBILL.key][t] / closes[TBILL.key][t - LB] - 1;
    const ranked = keys
      .map((k) => ({
        k,
        r: closes[k][t] / closes[k][t - LB] - 1,
      }))
      .sort((a, b) => b.r - a.r);
    const picks = ranked.slice(0, TOPN).filter((x) => x.r > tbill12);

    const rfNext = closes[TBILL.key][t + 1] / closes[TBILL.key][t] - 1;
    rf.push(rfNext);

    if (picks.length > 0) {
      let s = 0;
      for (const p of picks) s += closes[p.k][t + 1] / closes[p.k][t] - 1;
      stratRets.push(s / picks.length);
      positions.push(investedKey);
    } else {
      stratRets.push(rfNext);
      positions.push("bil");
    }
    pickSets.push(new Set(picks.map((p) => p.k)));

    let es = 0;
    for (const k of keys) es += closes[k][t + 1] / closes[k][t] - 1;
    ewRets.push(es / keys.length);
  }

  // İşlem maliyeti: aylık tek-yön devir τ = ½·Σ|Δw| (eşit ağırlık sepet,
  // boş sepet = %100 nakit). Round-trip maliyet costBps × τ stratejiden düşülür.
  if (costBps > 0) {
    const wmap = (set: Set<string>) => {
      const m = new Map<string, number>();
      if (set.size === 0) m.set("__cash", 1);
      else for (const k of set) m.set(k, 1 / set.size);
      return m;
    };
    for (let i = 1; i < pickSets.length; i++) {
      const a = wmap(pickSets[i - 1]);
      const b = wmap(pickSets[i]);
      const union = new Set([...a.keys(), ...b.keys()]);
      let sumAbs = 0;
      for (const k of union) sumAbs += Math.abs((b.get(k) ?? 0) - (a.get(k) ?? 0));
      const tau = 0.5 * sumAbs;
      stratRets[i] -= (costBps / 10000) * tau;
    }
  }

  // Pozisyon istatistikleri (yatırımda vs nakit)
  let switches = 0;
  for (let i = 1; i < positions.length; i++)
    if (positions[i] !== positions[i - 1]) switches++;
  const years = positions.length / 12;
  const timeInAsset: Record<string, number> = {};
  for (const p of positions) timeInAsset[p] = (timeInAsset[p] ?? 0) + 1;
  for (const k of Object.keys(timeInAsset))
    timeInAsset[k] = +((timeInAsset[k] / positions.length) * 100).toFixed(1);

  const strategies: StrategyMetrics[] = [
    buildMetrics(`${stratLabel} (Top-${TOPN})`, stratRets, rf, {
      switchesPerYear: +(switches / years).toFixed(2),
      timeInAsset,
    }),
    buildMetrics(benchLabel, ewRets, rf),
  ];

  const toGrowth = (rets: number[]): number[] => {
    const g: number[] = [1];
    let acc = 1;
    for (const r of rets) {
      acc *= 1 + r;
      g.push(acc);
    }
    return g;
  };
  const curveDates: string[] = [dates[LB]];
  for (let t = LB; t <= n - 2; t++) curveDates.push(dates[t + 1]);

  const timeline = positions.map((key, i) => ({
    date: dates[LB + 1 + i],
    key,
  }));

  const equityCurves = [
    {
      name: `${stratLabel} (Top-${TOPN})`,
      growth: toGrowth(stratRets),
      highlight: true,
    },
    { name: benchLabel, growth: toGrowth(ewRets) },
  ];

  return {
    startDate: dates[LB + 1] ?? dates[LB],
    endDate: dates[n - 1],
    months: stratRets.length,
    strategies,
    dates: curveDates,
    equityCurves,
    timeline,
    note: `${keys.length} varlıklı evrende top-${TOPN} relative+absolute momentum rotasyonu (aylık, eşit ağırlık). Sinyal t-sonu, getiri t+1 (lookahead bias yok). İşlem maliyeti: ${
      costBps > 0
        ? `round-trip ${costBps} bps, devir-bazlı (τ=½·Σ|Δw|), yalnızca momentum stratejisine`
        : "dahil değil"
    }.`,
  };
}

// ===========================================================================
//  DUAL MOMENTUM BİLEŞİK (COMPOSITE)
//  4 evrenin momentum stratejisini ortak dönemde eşit-ağırlık birleştirir.
//  İmperfect korelasyonlu sleeve'ler → çeşitlendirme (daha düşük oynaklık).
//  BacktestResult şeklinde döner; tüm grafikler yeniden kullanılır.
// ===========================================================================
export function buildComposite(
  sleeves: { name: string; bt: BacktestResult | null }[],
  tbill: RawSeries
): BacktestResult | null {
  const valid = sleeves.filter((s) => s.bt);
  if (valid.length < 2) return null;

  // Her sleeve'in aylık getirisi: ret_i = growth[i]/growth[i-1]-1, ay = dates[i]
  const retMaps = valid.map((s) => {
    const bt = s.bt as BacktestResult;
    const curve =
      bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
    const m = new Map<string, number>();
    if (curve)
      for (let i = 1; i < curve.growth.length && i < bt.dates.length; i++)
        m.set(
          bt.dates[i].slice(0, 7),
          curve.growth[i] / curve.growth[i - 1] - 1
        );
    return m;
  });

  const common = Array.from(retMaps[0].keys())
    .filter((ym) => retMaps.every((m) => m.has(ym)))
    .sort();
  if (common.length < 13) return null;

  // T-Bill aylık getiri (Sharpe/Sortino için rf)
  const rfMap = new Map<string, number>();
  for (let i = 1; i < tbill.series.length; i++) {
    const prev = tbill.series[i - 1].close;
    if (prev > 0)
      rfMap.set(
        tbill.series[i].date.slice(0, 7),
        tbill.series[i].close / prev - 1
      );
  }
  const rf = common.map((ym) => rfMap.get(ym) ?? 0);

  const sleeveRets = retMaps.map((m) => common.map((ym) => m.get(ym) as number));
  const compRets = common.map((_, i) => {
    let s = 0;
    for (const sr of sleeveRets) s += sr[i];
    return s / sleeveRets.length;
  });

  const strategies: StrategyMetrics[] = [
    buildMetrics("Dual Momentum Bileşik (eşit ağırlık)", compRets, rf),
    ...valid.map((s, k) => buildMetrics(s.name, sleeveRets[k], rf)),
  ];

  const toGrowth = (rets: number[]): number[] => {
    const g: number[] = [1];
    let acc = 1;
    for (const r of rets) {
      acc *= 1 + r;
      g.push(acc);
    }
    return g;
  };
  const dates = [common[0], ...common];
  const equityCurves = [
    {
      name: "Dual Momentum Bileşik",
      growth: toGrowth(compRets),
      highlight: true,
    },
    ...valid.map((s, k) => ({ name: s.name, growth: toGrowth(sleeveRets[k]) })),
  ];

  return {
    startDate: common[0],
    endDate: common[common.length - 1],
    months: compRets.length,
    strategies,
    dates,
    equityCurves,
    timeline: [],
    note: `${valid.length} dual-momentum stratejisinin (${valid
      .map((s) => s.name)
      .join(
        ", "
      )}) eşit-ağırlık aylık bileşimi, ortak dönemde. İmperfect korelasyonlu sleeve'ler tek stratejiden daha düşük oynaklık hedefler (çeşitlendirme).`,
  };
}
