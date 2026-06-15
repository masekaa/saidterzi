// Paylasilan JS ozellik+cikarim modulu — lib/volatility.ts'in BIREBIR aynisi.
// parity_check.mjs (parite) ve smoke_live.mjs (canli duman testi) bunu kullanir.
// Tek kaynak: formul burada bir kez tanimli (kopya yok).

const ln = Math.log;

export function logrets(c) {
  const r = [];
  for (let i = 1; i < c.length; i++) r.push(ln(c[i] / c[i - 1]));
  return r;
}
export function sampleStd(xs) {
  const n = xs.length;
  if (n < 2) return NaN;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1);
  return Math.sqrt(v);
}
export const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function rsi14(c) {
  const n = 14;
  if (c.length < n + 1) return NaN;
  const last = c.slice(-(n + 1));
  let up = 0, dn = 0;
  for (let i = 1; i < last.length; i++) {
    const d = last[i] - last[i - 1];
    if (d > 0) up += d;
    else dn += -d;
  }
  up /= n; dn /= n;
  if (dn === 0) return up === 0 ? NaN : 100;
  return 100 - 100 / (1 + up / dn);
}

// bars: {t,o,h,l,c,v}[]; gmtoffset saniye. lib/volatility.ts ile ayni.
export function computeFeatures(bars, gmtoffset) {
  const ok = bars.filter(
    (b) => b.c != null && b.o != null && b.h != null && b.l != null && b.v != null
  );
  if (ok.length < 26) return null;
  const c = ok.map((b) => b.c), h = ok.map((b) => b.h), l = ok.map((b) => b.l),
    v = ok.map((b) => b.v), t = ok.map((b) => b.t);
  const n = c.length, last = n - 1;
  const lr = logrets(c);
  const ret = (k) => ln(c[last] / c[last - k]);
  const vol = (k) => sampleStd(lr.slice(lr.length - k));
  const win = (k) => c.slice(n - k);
  const sma_gap = (k) => c[last] / mean(win(k)) - 1;
  const toHi = (k) => c[last] / Math.max(...win(k)) - 1;
  const toLo = (k) => c[last] / Math.min(...win(k)) - 1;
  const out = {
    ret_1: ret(1), ret_2: ret(2), ret_3: ret(3), ret_6: ret(6), ret_12: ret(12), ret_24: ret(24),
    vol_6: vol(6), vol_12: vol(12), vol_24: vol(24), rsi_14: rsi14(c),
    toHi_12: toHi(12), toLo_12: toLo(12), sma_gap_6: sma_gap(6), sma_gap_12: sma_gap(12),
    vol_ratio_12: v[last] / mean(v.slice(n - 12)),
    bar_range: (h[last] - l[last]) / c[last],
    hour: ((t[last] + gmtoffset) % 86400) / 3600,
  };
  return out;
}

// model: lib/models/volatility_*.json ; x: ozellik vektoru (model.features sirasi)
export function predict(model, x) {
  let pred = model.intercept;
  for (let i = 0; i < x.length; i++) {
    pred += model.coef[i] * ((x[i] - model.mean[i]) / model.std[i]);
  }
  const { low, high } = model.regime_thresholds;
  const regime = pred < low ? "low" : pred < high ? "normal" : "high";
  return { pred, regime, expectedMovePct: model.regime_actual_move[regime] * 100 };
}

export const FEATURE_ORDER = [
  "ret_1", "ret_2", "ret_3", "ret_6", "ret_12", "ret_24",
  "vol_6", "vol_12", "vol_24", "rsi_14",
  "toHi_12", "toLo_12", "sma_gap_6", "sma_gap_12",
  "vol_ratio_12", "bar_range", "hour",
];
