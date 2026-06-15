// Canli duman testi: Yahoo'dan GUNCEL intraday cekip ucu-uca cikarim yapar.
// Parite (parity_check) gecmis CSV'yi dogrular; bu, BUGUNKU veri yolunun
// (fetch -> ozellik -> tahmin) calistigini ve makul cikti verdigini teyit eder.
//
// Kullanim: node ml/smoke_live.mjs [TICKER.IS] [interval]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeFeatures, predict, FEATURE_ORDER } from "./features.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ticker = process.argv[2] || "THYAO.IS";
const interval = process.argv[3] || "60m";
const range = interval === "5m" ? "5d" : "1mo";
const modelFile = interval === "5m" ? "volatility_5m_12.json" : "volatility_60m_1.json";
const model = JSON.parse(
  readFileSync(join(here, "..", "lib", "models", modelFile), "utf8")
);

const url =
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
  `?range=${range}&interval=${interval}&includePrePost=false`;

const res = await fetch(url, {
  headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
});
if (!res.ok) {
  console.error(`Yahoo ${res.status}`);
  process.exit(1);
}
const j = await res.json();
const r = j?.chart?.result?.[0];
if (!r) {
  console.error("Yahoo bos sonuc");
  process.exit(1);
}
const q = r.indicators.quote[0];
const gmtoffset = r.meta.gmtoffset ?? 3 * 3600;
const bars = r.timestamp.map((t, i) => ({
  t, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i],
}));

const feats = computeFeatures(bars, gmtoffset);
if (!feats) {
  console.error("Yetersiz/gecersiz bar — ozellik uretilemedi");
  process.exit(1);
}
const x = FEATURE_ORDER.map((k) => feats[k]);
if (x.some((v) => !Number.isFinite(v))) {
  console.error("Ozellik vektorunde NaN var");
  process.exit(1);
}
const p = predict(model, x);
const okBars = bars.filter((b) => b.c != null);
const lastT = okBars.at(-1).t;
console.log(`Canli duman testi: ${ticker} ${interval} | ${okBars.length} bar`);
console.log(`Son bar (IST): ${new Date((lastT + gmtoffset) * 1000).toISOString().replace("T", " ").slice(0, 16)}`);
console.log(`Rejim: ${p.regime} | beklenen hareket: %${p.expectedMovePct.toFixed(2)} | ham pred: ${p.pred.toExponential(2)}`);

// Akil-saglik kontrolu: rejim gecerli, beklenen hareket makul aralikta (%0.05-%5)
const sane = ["low", "normal", "high"].includes(p.regime) &&
  p.expectedMovePct > 0.05 && p.expectedMovePct < 5;
if (!sane) {
  console.error("AKIL-SAGLIK BASARISIZ: cikti makul aralikta degil");
  process.exit(1);
}
console.log("DUMAN TESTI TAMAM: canli veri yolu calisiyor, cikti makul.");
