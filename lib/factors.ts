// factors.ts — Fama-French faktör verisi (Ken French Data Library, anahtarsız)
// + GEM getirisinin faktörlere OLS regresyonu → alpha, betalar, R².
// Kapsam: 04 §3 (faktör-model alpha).

import { unzipFirstTextFile } from "./zip";
import type { FactorAlpha } from "./types";

const FF3_URL =
  "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_CSV.zip";

export interface FactorRow {
  ym: string; // "YYYY-MM"
  mktRF: number; // ondalık (yüzde/100)
  smb: number;
  hml: number;
  rf: number;
}

// ---- 1) Faktör CSV'sini çek + ayrıştır (aylık bölüm) ----
export async function fetchFamaFrench3(): Promise<FactorRow[] | null> {
  try {
    const res = await fetch(FF3_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (dual-momentum-app)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const text = unzipFirstTextFile(buf);
    if (!text) return null;

    const rows: FactorRow[] = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      // Aylık satır: YYYYMM,Mkt-RF,SMB,HML,RF  (yüzde)
      const m = line.match(
        /^(\d{6})\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/
      );
      if (!m) {
        // Yıllık bölüme geçildiyse dur (aylık veriler bittiyse)
        if (rows.length > 0 && /annual/i.test(line)) break;
        continue;
      }
      const ym = `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}`;
      rows.push({
        ym,
        mktRF: parseFloat(m[2]) / 100,
        smb: parseFloat(m[3]) / 100,
        hml: parseFloat(m[4]) / 100,
        rf: parseFloat(m[5]) / 100,
      });
    }
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

// ---- 2) Genel NxN doğrusal sistem çözücü (Gauss eliminasyonu, kısmi pivot) ----
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// ---- 3) OLS çoklu regresyon: y ~ 1 + Mkt-RF + SMB + HML ----
// gemExcess: GEM aylık getirisi − RF (ondalık), faktör satırlarıyla aynı sırada.
export function regressFactors(
  gemExcess: number[],
  X: { mktRF: number; smb: number; hml: number }[]
): FactorAlpha | null {
  const n = gemExcess.length;
  if (n < 24 || X.length !== n) return null; // anlamlılık için ≥2 yıl

  // Tasarım matrisi sütunları: [1, mkt, smb, hml]
  const cols = 4;
  // Normal denklemler: (XᵀX) β = Xᵀy
  const XtX: number[][] = Array.from({ length: cols }, () =>
    new Array(cols).fill(0)
  );
  const Xty: number[] = new Array(cols).fill(0);

  const design = (i: number) => [1, X[i].mktRF, X[i].smb, X[i].hml];

  for (let i = 0; i < n; i++) {
    const d = design(i);
    for (let a = 0; a < cols; a++) {
      Xty[a] += d[a] * gemExcess[i];
      for (let bb = 0; bb < cols; bb++) XtX[a][bb] += d[a] * d[bb];
    }
  }

  const beta = solveLinear(XtX, Xty);
  if (!beta) return null;

  // Artıklar + R² + alpha t-stat
  const yMean = gemExcess.reduce((s, v) => s + v, 0) / n;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const d = design(i);
    const yhat = d[0] * beta[0] + d[1] * beta[1] + d[2] * beta[2] + d[3] * beta[3];
    ssRes += (gemExcess[i] - yhat) ** 2;
    ssTot += (gemExcess[i] - yMean) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Var(β) = σ²·(XᵀX)⁻¹ ; α t-stat için (XᵀX)⁻¹'in [0][0] elemanı gerek.
  const sigma2 = ssRes / (n - cols);
  const inv00 = invDiag0(XtX);
  const seAlpha = inv00 != null ? Math.sqrt(sigma2 * inv00) : null;
  const alphaTStat = seAlpha && seAlpha > 0 ? beta[0] / seAlpha : 0;

  const alphaMonthly = beta[0];
  const alphaAnnual = Math.pow(1 + alphaMonthly, 12) - 1;

  return {
    source: "Fama-French 3 (Ken French Data Library)",
    nMonths: n,
    alphaMonthly,
    alphaAnnual,
    alphaTStat,
    betaMkt: beta[1],
    betaSmb: beta[2],
    betaHml: beta[3],
    rSquared,
  };
}

// ---- 4) Uçtan uca: GEM aylık getirilerini çek+hizala+regresle ----
// gemMonthly: { ym:"YYYY-MM", ret: aylık GEM getirisi (ondalık) }
// Önceden çekilmiş faktörlerle hizala + regresle (FF tek çekimde paylaşılır).
export function alphaFromFactors(
  monthly: { ym: string; ret: number }[],
  factors: FactorRow[]
): FactorAlpha | null {
  const fmap = new Map(factors.map((f) => [f.ym, f]));
  const exc: number[] = [];
  const X: { mktRF: number; smb: number; hml: number }[] = [];
  for (const g of monthly) {
    const f = fmap.get(g.ym);
    if (!f) continue;
    exc.push(g.ret - f.rf);
    X.push({ mktRF: f.mktRF, smb: f.smb, hml: f.hml });
  }
  return regressFactors(exc, X);
}

export async function buildFactorAlpha(
  gemMonthly: { ym: string; ret: number }[]
): Promise<FactorAlpha | null> {
  const factors = await fetchFamaFrench3();
  if (!factors) return null;
  return alphaFromFactors(gemMonthly, factors);
}

// (XᵀX)⁻¹'in [0][0] elemanı — alpha standart hatası için.
function invDiag0(A: number[][]): number | null {
  const n = A.length;
  // [A | I] üzerinde Gauss-Jordan, sadece ilk sütun-cevabı yeterli ama
  // basitlik için tüm tersi çıkarıp [0][0] alıyoruz.
  const M = A.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let c = 0; c < 2 * n; c++) M[col][c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = 0; c < 2 * n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M[0][n]; // ters matrisin [0][0] elemanı
}
