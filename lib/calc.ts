// calc.ts — Saf matematiksel primitifler.
// Her fonksiyon, kapsam dokümanındaki ilgili formülü uygular ve belgeler.
// Tüm getiri hesapları "total return" (adjusted close) serileri üzerinde yapılır.

import type { MonthlyPoint } from "./types";

// ---------------------------------------------------------------------------
// 1) Aylık getiri serisi
//    r_t = P_t / P_{t-1} − 1
// ---------------------------------------------------------------------------
export function toMonthlyReturns(series: MonthlyPoint[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].close;
    if (prev > 0) r.push(series[i].close / prev - 1);
  }
  return r;
}

// ---------------------------------------------------------------------------
// 2) Trailing (geriye-dönük) toplam getiri
//    r(L) = P_t / P_{t−L} − 1     (L = look-back ay sayısı)
//    En güncel kapanışı, L ay öncesindeki kapanışa böler.
// ---------------------------------------------------------------------------
export function trailingReturn(
  series: MonthlyPoint[],
  months: number
): { ret: number | null; pNow: number | null; pPast: number | null; asOf: string | null } {
  if (series.length < months + 1) {
    return { ret: null, pNow: null, pPast: null, asOf: null };
  }
  const now = series[series.length - 1];
  const past = series[series.length - 1 - months];
  if (!past || past.close <= 0) {
    return { ret: null, pNow: now?.close ?? null, pPast: null, asOf: null };
  }
  return {
    ret: now.close / past.close - 1,
    pNow: now.close,
    pPast: past.close,
    asOf: past.date,
  };
}

// ---------------------------------------------------------------------------
// 3) Basit hareketli ortalama (SMA)
//    SMA_N = (1/N) · Σ P_{t−i}   (son N aylık kapanışın ortalaması)
// ---------------------------------------------------------------------------
export function sma(
  series: MonthlyPoint[],
  n: number
): { value: number | null; price: number | null } {
  if (series.length < n) return { value: null, price: null };
  const last = series.slice(series.length - n);
  const sum = last.reduce((s, p) => s + p.close, 0);
  return {
    value: sum / n,
    price: series[series.length - 1].close,
  };
}

// ---------------------------------------------------------------------------
// 4) Son N aylık en yüksek kapanış (52-hafta zirve proxy'si)
// ---------------------------------------------------------------------------
export function highestClose(
  series: MonthlyPoint[],
  n: number
): { high: number | null; price: number | null } {
  if (series.length < 1) return { high: null, price: null };
  const window = series.slice(Math.max(0, series.length - n));
  const high = Math.max(...window.map((p) => p.close));
  return { high, price: series[series.length - 1].close };
}

// ---------------------------------------------------------------------------
// 5) İkinci derece (kuadratik) en küçük kareler uyumu
//    y = a + b·t + c·t²    →  c'nin işareti ivmelenmeyi verir.
//    c > 0: konveks (yukarı hızlanan), c < 0: konkav.
//    Girdi olarak log-fiyat kullanılır (yüzde ölçeğinde tutarlılık için).
// ---------------------------------------------------------------------------
export function quadraticFit(ys: number[]): { a: number; b: number; c: number } | null {
  const n = ys.length;
  if (n < 3) return null;
  // t = 0..n-1
  let S0 = n, S1 = 0, S2 = 0, S3 = 0, S4 = 0;
  let Ty0 = 0, Ty1 = 0, Ty2 = 0;
  for (let t = 0; t < n; t++) {
    const t2 = t * t;
    S1 += t;
    S2 += t2;
    S3 += t2 * t;
    S4 += t2 * t2;
    Ty0 += ys[t];
    Ty1 += t * ys[t];
    Ty2 += t2 * ys[t];
  }
  // Normal denklemler: M · [a,b,c]^T = [Ty0,Ty1,Ty2]^T
  // M = [[S0,S1,S2],[S1,S2,S3],[S2,S3,S4]]
  const M = [
    [S0, S1, S2],
    [S1, S2, S3],
    [S2, S3, S4],
  ];
  const rhs = [Ty0, Ty1, Ty2];
  const sol = solve3x3(M, rhs);
  if (!sol) return null;
  return { a: sol[0], b: sol[1], c: sol[2] };
}

function solve3x3(M: number[][], v: number[]): number[] | null {
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-12) return null;
  const col = (i: number) => {
    const m = M.map((row) => row.slice());
    for (let r = 0; r < 3; r++) m[r][i] = v[r];
    return det(m) / D;
  };
  return [col(0), col(1), col(2)];
}

// ---------------------------------------------------------------------------
// 6) Geometrik ortalama aylık getiri
//    g = (Π(1+r_i))^(1/n) − 1
// ---------------------------------------------------------------------------
export function geometricMeanMonthly(returns: number[]): number | null {
  if (returns.length === 0) return null;
  const prod = returns.reduce((p, r) => p * (1 + r), 1);
  if (prod <= 0) return null;
  return Math.pow(prod, 1 / returns.length) - 1;
}

// ===========================================================================
//  PERFORMANS / RİSK METRİKLERİ (kapsam: 04-risk-ve-metrikler.md)
// ===========================================================================

// CAGR (geometrik yıllık) = (1+toplam)^(12/n) − 1
export function cagr(monthlyReturns: number[]): number | null {
  const n = monthlyReturns.length;
  if (n === 0) return null;
  const total = monthlyReturns.reduce((p, r) => p * (1 + r), 1);
  if (total <= 0) return null;
  return Math.pow(total, 12 / n) - 1;
}

// Aritmetik yıllık getiri = ortalama(aylık) × 12
export function annualReturnArithmetic(monthlyReturns: number[]): number | null {
  if (monthlyReturns.length === 0) return null;
  const mean = monthlyReturns.reduce((s, r) => s + r, 0) / monthlyReturns.length;
  return mean * 12;
}

// Yıllık volatilite = std(aylık) × √12   (örneklem std, ddof=1)
export function annualVolatility(monthlyReturns: number[]): number | null {
  const n = monthlyReturns.length;
  if (n < 2) return null;
  const mean = monthlyReturns.reduce((s, r) => s + r, 0) / n;
  const variance =
    monthlyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance) * Math.sqrt(12);
}

// Sharpe = (ortalama(excess) / std(excess)) × √12
// excess_t = r_t − rf_t  (rf = T-Bill aylık getirisi)
export function sharpeRatio(
  monthlyReturns: number[],
  rfMonthly: number[]
): number | null {
  const n = Math.min(monthlyReturns.length, rfMonthly.length);
  if (n < 2) return null;
  const ex: number[] = [];
  for (let i = 0; i < n; i++) ex.push(monthlyReturns[i] - rfMonthly[i]);
  const mean = ex.reduce((s, r) => s + r, 0) / n;
  const variance = ex.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return null;
  return (mean / sd) * Math.sqrt(12);
}

// Maksimum drawdown (ay-sonu, tepe-dip)
// DD_t = Eşitlik_t / max(Eşitlik_{0..t}) − 1 ; max DD = min(DD_t)
export function maxDrawdown(monthlyReturns: number[]): number | null {
  if (monthlyReturns.length === 0) return null;
  let equity = 1;
  let peak = 1;
  let maxDD = 0;
  for (const r of monthlyReturns) {
    equity *= 1 + r;
    if (equity > peak) peak = equity;
    const dd = equity / peak - 1;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD;
}

// Kârlı ay yüzdesi
export function pctProfitableMonths(monthlyReturns: number[]): number | null {
  if (monthlyReturns.length === 0) return null;
  return (monthlyReturns.filter((r) => r > 0).length / monthlyReturns.length) * 100;
}

// Toplam getiri = Π(1+r) − 1
export function totalReturn(monthlyReturns: number[]): number | null {
  if (monthlyReturns.length === 0) return null;
  return monthlyReturns.reduce((p, r) => p * (1 + r), 1) - 1;
}

// ---------------------------------------------------------------------------
//  Seri hizalama: birden çok sembolü ortak ay tarihlerinde eşle.
//  Backtest ve relative momentum için tüm varlıklar aynı tarih eksenine oturur.
// ---------------------------------------------------------------------------
export function alignSeries(
  seriesMap: Record<string, MonthlyPoint[]>
): { dates: string[]; closes: Record<string, number[]> } {
  const keys = Object.keys(seriesMap);
  if (keys.length === 0) return { dates: [], closes: {} };

  // Her sembol için tarih→kapanış haritası (YYYY-MM ayında normalize)
  const maps: Record<string, Map<string, number>> = {};
  for (const k of keys) {
    const m = new Map<string, number>();
    for (const p of seriesMap[k]) m.set(p.date.slice(0, 7), p.close);
    maps[k] = m;
  }
  // Ortak ay anahtarları
  let common: string[] | null = null;
  for (const k of keys) {
    const ks = Array.from(maps[k].keys());
    common = common ? common.filter((d) => maps[k].has(d)) : ks;
  }
  common = (common ?? []).sort();
  const closes: Record<string, number[]> = {};
  for (const k of keys) closes[k] = common.map((d) => maps[k].get(d) as number);
  return { dates: common, closes };
}
