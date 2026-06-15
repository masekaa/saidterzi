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
import { computeFeatures } from "./features.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(here, "data", "parity_fixture.json"), "utf8"));

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
