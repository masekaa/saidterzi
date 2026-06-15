// volatility.ts — Eğitilmiş oynaklık (hareket-büyüklüğü) modelinin TARAYICI/SUNUCU
// tarafı çıkarımı. Python (ml/train_volatility.py) Ridge katsayılarını JSON'a
// aktarır; burada gün-içi barlardan AYNI özellikleri üretip tahmin yaparız.
//
// ÖNEMLİ: Yön DEĞİL, hareketin BÜYÜKLÜĞÜ tahmin edilir. Yön tahmini kanıtlanmış
// şekilde rastgele (LightGBM/lojistik/LSTM hepsi naive baseline'ı geçemiyor).
// Oynaklık ise OOS'ta naive'i geçen gerçek bir sinyal (rho 0.25 vs 0.18).

import type { IntradayBar, IntradayInterval } from "@/lib/intraday";
import model1 from "@/lib/models/volatility_60m_1.json";
import model2 from "@/lib/models/volatility_60m_2.json";
import model5m12 from "@/lib/models/volatility_5m_12.json";
import model5m24 from "@/lib/models/volatility_5m_24.json";

export interface VolModel {
  interval: string;
  H: number;
  features: string[];
  mean: number[];
  std: number[];
  coef: number[];
  intercept: number;
  regime_thresholds: { low: number; high: number };
  regime_actual_move: { low: number; normal: number; high: number };
  oos: { r2_ridge: number; rho_ridge: number; rho_naive: number; n_test: number };
  note: string;
}

export const VOL_MODELS: Record<number, VolModel> = {
  1: model1 as VolModel,
  2: model2 as VolModel,
};

// Granülerliğe göre model çifti: h1 ≈ 1 saat, h2 ≈ 2 saat ufuk.
// 60m: H=1/H=2 bar.  5m: H=12/H=24 bar (12·5dk=1s, 24·5dk=2s).
export interface ModelPair {
  interval: IntradayInterval;
  range: string; // Yahoo'dan çekilecek aralık
  h1: VolModel; // ~1 saat
  h2: VolModel; // ~2 saat
}
export const MODEL_PAIRS: Record<string, ModelPair> = {
  "60m": { interval: "60m", range: "1mo", h1: model1 as VolModel, h2: model2 as VolModel },
  "5m": { interval: "5m", range: "5d", h1: model5m12 as VolModel, h2: model5m24 as VolModel },
};
export const DEFAULT_GRAN = "60m";

export type Regime = "low" | "normal" | "high";

export interface VolPrediction {
  pred: number; // ham tahmin (|log-getiri| ~ kesirsel hareket)
  predPct: number; // ham tahmin yüzde
  regime: Regime;
  // O rejimin OOS'ta GERÇEKLEŞEN ortalama mutlak hareketi (kalibre, dürüst sayı)
  expectedMovePct: number;
}

const ln = Math.log;

function logrets(c: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < c.length; i++) r.push(ln(c[i] / c[i - 1]));
  return r;
}

// Örnek standart sapma (ddof=1) — pandas .std() ile birebir.
function sampleStd(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1);
  return Math.sqrt(v);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// RSI(14) — basit hareketli ortalama (pandas rolling.mean), Wilder DEĞİL.
function rsi14(c: number[]): number {
  const n = 14;
  if (c.length < n + 1) return NaN;
  const last = c.slice(-(n + 1)); // n diff için n+1 kapanış
  let up = 0;
  let dn = 0;
  for (let i = 1; i < last.length; i++) {
    const d = last[i] - last[i - 1];
    if (d > 0) up += d;
    else dn += -d;
  }
  up /= n;
  dn /= n;
  if (dn === 0) return up === 0 ? NaN : 100;
  const rs = up / dn;
  return 100 - 100 / (1 + rs);
}

// Bir tickerin SON barı için 17 özelliği üret (model FEATURES sırasıyla).
// gmtoffset: borsa yerel saati için (saniye). Yetersiz bar -> null.
export function computeFeatures(
  bars: IntradayBar[],
  gmtoffset: number
): number[] | null {
  // Eksik/null barları at, sadece tam OHLCV.
  const ok = bars.filter(
    (b) => b.c != null && b.o != null && b.h != null && b.l != null && b.v != null
  );
  if (ok.length < 26) return null; // ret_24 + vol_24 için en az 25-26 bar

  const c = ok.map((b) => b.c as number);
  const h = ok.map((b) => b.h as number);
  const l = ok.map((b) => b.l as number);
  const v = ok.map((b) => b.v as number);
  const t = ok.map((b) => b.t);
  const n = c.length;
  const last = n - 1;
  const lr = logrets(c); // uzunluk n-1; lr[i] = ln(c[i+1]/c[i])

  // Geçmiş getiriler
  const ret = (k: number) => ln(c[last] / c[last - k]);
  // Yuvarlanan oynaklık: son k log-getiri (lr'nin son k elemanı)
  const vol = (k: number) => sampleStd(lr.slice(lr.length - k));
  // Yuvarlanan ortalama/max/min (son k kapanış, current dahil)
  const win = (k: number) => c.slice(n - k);
  const sma_gap = (k: number) => c[last] / mean(win(k)) - 1;
  const toHi = (k: number) => c[last] / Math.max(...win(k)) - 1;
  const toLo = (k: number) => c[last] / Math.min(...win(k)) - 1;
  const vol_ratio_12 = v[last] / mean(v.slice(n - 12));
  const bar_range = (h[last] - l[last]) / c[last];
  // Borsa yerel saati (Istanbul)
  const localSec = (t[last] + gmtoffset) % 86400;
  const hour = localSec / 3600;

  const f: Record<string, number> = {
    ret_1: ret(1),
    ret_2: ret(2),
    ret_3: ret(3),
    ret_6: ret(6),
    ret_12: ret(12),
    ret_24: ret(24),
    vol_6: vol(6),
    vol_12: vol(12),
    vol_24: vol(24),
    rsi_14: rsi14(c),
    toHi_12: toHi(12),
    toLo_12: toLo(12),
    sma_gap_6: sma_gap(6),
    sma_gap_12: sma_gap(12),
    vol_ratio_12,
    bar_range,
    hour,
  };
  // Model özellik sırasına göre vektör; herhangi biri NaN ise iptal.
  const vec = VOL_MODELS[1].features.map((name) => f[name]);
  if (vec.some((x) => !Number.isFinite(x))) return null;
  return vec;
}

// Ridge çıkarımı: z=(x-mean)/std; pred=intercept+coef·z; rejim eşiklerle.
export function predict(model: VolModel, x: number[]): VolPrediction {
  let pred = model.intercept;
  for (let i = 0; i < x.length; i++) {
    const z = (x[i] - model.mean[i]) / model.std[i];
    pred += model.coef[i] * z;
  }
  const { low, high } = model.regime_thresholds;
  const regime: Regime = pred < low ? "low" : pred < high ? "normal" : "high";
  const expectedMovePct = model.regime_actual_move[regime] * 100;
  return { pred, predPct: pred * 100, regime, expectedMovePct };
}
