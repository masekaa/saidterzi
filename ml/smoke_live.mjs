// Canli duman testi: Yahoo'dan GUNCEL intraday cekip ucu-uca cikarim yapar.
// Parite (parity_check) gecmis CSV'yi dogrular; bu, BUGUNKU veri yolunun
// (fetch -> ozellik -> tahmin) calistigini ve makul cikti verdigini teyit eder.
//
// Kullanim:
//   node ml/smoke_live.mjs                 # panel (cesitli hisseler, 60m)
//   node ml/smoke_live.mjs THYAO.IS 5m     # tek hisse + granulerlik

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeFeatures, predict, FEATURE_ORDER } from "./features.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function loadModel(interval) {
  const f = interval === "5m" ? "volatility_5m_12.json" : "volatility_60m_1.json";
  return JSON.parse(readFileSync(join(here, "..", "lib", "models", f), "utf8"));
}

async function predictTicker(ticker, interval) {
  const range = interval === "5m" ? "5d" : "1mo";
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!res.ok) return { ticker, ok: false, why: `Yahoo ${res.status}` };
  const j = await res.json();
  const r = j?.chart?.result?.[0];
  if (!r) return { ticker, ok: false, why: "bos sonuc" };
  const q = r.indicators.quote[0];
  const gmtoffset = r.meta.gmtoffset ?? 3 * 3600;
  const bars = r.timestamp.map((t, i) => ({
    t, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i],
  }));
  const feats = computeFeatures(bars, gmtoffset);
  if (!feats) return { ticker, ok: false, why: "ozellik uretilemedi" };
  const x = FEATURE_ORDER.map((k) => feats[k]);
  if (x.some((v) => !Number.isFinite(v))) return { ticker, ok: false, why: "NaN ozellik" };
  const p = predict(loadModel(interval), x);
  const okBars = bars.filter((b) => b.c != null);
  const sane =
    ["low", "normal", "high"].includes(p.regime) &&
    p.expectedMovePct > 0.05 && p.expectedMovePct < 5;
  return { ticker, ok: sane, regime: p.regime, move: p.expectedMovePct, n: okBars.length, why: sane ? "" : "makul-disi cikti" };
}

const single = process.argv[2];
const interval = process.argv[3] || "60m";
const panel = single
  ? [single]
  : ["THYAO.IS", "GARAN.IS", "ASELS.IS", "EREGL.IS", "BIMAS.IS", "SISE.IS"];

let fail = 0;
console.log(`Canli duman testi (${interval}) — ${panel.length} hisse:`);
for (const t of panel) {
  const r = await predictTicker(t, interval);
  if (r.ok) {
    console.log(`  OK  ${t.padEnd(10)} ${String(r.regime).padEnd(6)} %${r.move.toFixed(2)} (${r.n} bar)`);
  } else {
    fail++;
    console.log(`  HATA ${t.padEnd(10)} -> ${r.why}`);
  }
}
if (fail > 0) {
  console.error(`\nDUMAN TESTI BASARISIZ: ${fail}/${panel.length} hisse.`);
  process.exit(1);
}
console.log(`\nDUMAN TESTI TAMAM: ${panel.length}/${panel.length} hisse — canli veri yolu calisiyor, ciktilar makul.`);
