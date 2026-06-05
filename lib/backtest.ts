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
} from "./calc";
import { CORE_ASSETS, TBILL, LOOKBACK_MONTHS } from "./universe";
import type { BacktestResult, RawSeries, StrategyMetrics } from "./types";

type RawMap = Record<string, RawSeries>;

function buildMetrics(
  name: string,
  rets: number[],
  rf: number[],
  extra?: { switchesPerYear?: number; timeInAsset?: Record<string, number> }
): StrategyMetrics {
  return {
    name,
    annualReturnArith: annualReturnArithmetic(rets),
    cagr: cagr(rets),
    annualVol: annualVolatility(rets),
    sharpe: sharpeRatio(rets, rf),
    maxDrawdown: maxDrawdown(rets),
    pctProfitMonths: pctProfitableMonths(rets),
    totalReturn: totalReturn(rets),
    switchesPerYear: extra?.switchesPerYear ?? null,
    timeInAsset: extra?.timeInAsset,
  };
}

export function runBacktest(core: RawMap, tbill: RawSeries): BacktestResult | null {
  const keys = CORE_ASSETS.map((a) => a.key);
  const seriesMap: Record<string, RawSeries["series"]> = {};
  for (const a of CORE_ASSETS) {
    if (!core[a.key]) return null;
    seriesMap[a.key] = core[a.key].series;
  }
  seriesMap[TBILL.key] = tbill.series;

  const { dates, closes } = alignSeries(seriesMap);
  const n = dates.length;
  if (n < LOOKBACK_MONTHS + 3) return null;

  // Getiri serileri (her benchmark + GEM), ortak periyot: t = L .. n-2
  const gemRets: number[] = [];
  const rf: number[] = [];
  const bh: Record<string, number[]> = {};
  for (const k of keys) bh[k] = [];
  const ew: number[] = []; // eşit ağırlık (aylık rebalance)

  const positions: string[] = [];

  for (let t = LOOKBACK_MONTHS; t <= n - 2; t++) {
    // Sinyal: t-sonu 12-ay getiriler
    let bestKey = keys[0];
    let bestRet = -Infinity;
    for (const k of keys) {
      const r = closes[k][t] / closes[k][t - LOOKBACK_MONTHS] - 1;
      if (r > bestRet) {
        bestRet = r;
        bestKey = k;
      }
    }
    const tbillRet12 =
      closes[TBILL.key][t] / closes[TBILL.key][t - LOOKBACK_MONTHS] - 1;
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

  // Pozisyon istatistikleri
  let switches = 0;
  for (let i = 1; i < positions.length; i++)
    if (positions[i] !== positions[i - 1]) switches++;
  const years = positions.length / 12;
  const timeInAsset: Record<string, number> = {};
  for (const p of positions) timeInAsset[p] = (timeInAsset[p] ?? 0) + 1;
  for (const k of Object.keys(timeInAsset))
    timeInAsset[k] = +((timeInAsset[k] / positions.length) * 100).toFixed(1);

  const strategies: StrategyMetrics[] = [
    buildMetrics("GEM (Dual Momentum)", gemRets, rf, {
      switchesPerYear: +(switches / years).toFixed(2),
      timeInAsset,
    }),
    ...CORE_ASSETS.map((a) =>
      buildMetrics(`${a.name} (Al-Tut)`, bh[a.key], rf)
    ),
    buildMetrics("Eşit Ağırlık (Al-Tut)", ew, rf),
  ];

  return {
    startDate: dates[LOOKBACK_MONTHS + 1] ?? dates[LOOKBACK_MONTHS],
    endDate: dates[n - 1],
    months: gemRets.length,
    strategies,
    note:
      "Ortak veri periyodunda (tüm varlıkların geçmişi mevcut olduğu tarihten itibaren) aylık simülasyon. Sinyal t-sonu, getiri t+1 (lookahead bias yok). İşlem maliyeti dahil değildir.",
  };
}
