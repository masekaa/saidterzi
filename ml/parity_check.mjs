// TS<->Python ozellik PARITE testi (Node tarafi).
// lib/volatility.ts computeFeatures mantiginin BIREBIR kopyasini calistirir ve
// Python'un (build_dataset.py) urettigi "expected" ozelliklerle karsilastirir.
// Amac: egitim (Python) ile cikarim (TS) ayni ozellikleri uretiyor mu? Sapma =
// sessiz hata -> yanlis tahmin. Tolerans 1e-6.
//
// Kullanim: node ml/parity_check.mjs   (once: python ml/parity_fixture.py)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(here, "data", "parity_fixture.json"), "utf8"));

// ---- lib/volatility.ts computeFeatures kopyasi (formul paritesi icin) ----
const ln = Math.log;
function logrets(c) {
  const r = [];
  for (let i = 1; i < c.length; i++) r.push(ln(c[i] / c[i - 1]));
  return r;
}
function sampleStd(xs) {
  const n = xs.length;
  if (n < 2) return NaN;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1);
  return Math.sqrt(v);
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
function rsi14(c) {
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
function computeFeatures(bars, gmtoffset) {
  const ok = bars.filter((b) => b.c != null && b.o != null && b.h != null && b.l != null && b.v != null);
  if (ok.length < 26) return null;
  const c = ok.map((b) => b.c), h = ok.map((b) => b.h), l = ok.map((b) => b.l), v = ok.map((b) => b.v), t = ok.map((b) => b.t);
  const n = c.length, last = n - 1;
  const lr = logrets(c);
  const ret = (k) => ln(c[last] / c[last - k]);
  const vol = (k) => sampleStd(lr.slice(lr.length - k));
  const win = (k) => c.slice(n - k);
  const sma_gap = (k) => c[last] / mean(win(k)) - 1;
  const toHi = (k) => c[last] / Math.max(...win(k)) - 1;
  const toLo = (k) => c[last] / Math.min(...win(k)) - 1;
  const vol_ratio_12 = v[last] / mean(v.slice(n - 12));
  const bar_range = (h[last] - l[last]) / c[last];
  const hour = ((t[last] + gmtoffset) % 86400) / 3600;
  return {
    ret_1: ret(1), ret_2: ret(2), ret_3: ret(3), ret_6: ret(6), ret_12: ret(12), ret_24: ret(24),
    vol_6: vol(6), vol_12: vol(12), vol_24: vol(24), rsi_14: rsi14(c),
    toHi_12: toHi(12), toLo_12: toLo(12), sma_gap_6: sma_gap(6), sma_gap_12: sma_gap(12),
    vol_ratio_12, bar_range, hour,
  };
}

const got = computeFeatures(fx.bars, fx.gmtoffset);
if (!got) {
  console.error("computeFeatures null dondu");
  process.exit(1);
}
const TOL = 1e-6;
let maxErr = 0, fail = 0;
console.log(`Parite: ${fx.ticker} ${fx.interval} | bar t=${fx.t_sel}`);
console.log("ozellik          Python           Node             |fark|");
for (const k of Object.keys(fx.expected)) {
  const e = fx.expected[k], a = got[k];
  const d = Math.abs(e - a);
  maxErr = Math.max(maxErr, d);
  const ok = d <= TOL;
  if (!ok) fail++;
  console.log(`${k.padEnd(14)} ${e.toFixed(8).padStart(14)} ${a.toFixed(8).padStart(14)}  ${d.toExponential(2)} ${ok ? "" : "  <-- SAPMA"}`);
}
console.log(`\nmax fark = ${maxErr.toExponential(3)} | tolerans = ${TOL.toExponential(0)}`);
if (fail > 0) {
  console.error(`PARITE BASARISIZ: ${fail} ozellik sapti.`);
  process.exit(1);
}
console.log("PARITE TAMAM: TS ozellikleri Python ile birebir.");
