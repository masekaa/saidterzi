// fundamentals.ts — Earnings/Revenue momentum (Chen et al. 2014, kapsam 06 §2.2).
// Temel veri Financial Modeling Prep (FMP) free tier'dan çekilir — API ANAHTARI
// gerekir. Anahtar yoksa devre dışı durum döner (analizin geri kalanı çalışır).
//
// Vercel'de etkinleştirmek için: Settings → Environment Variables → FMP_API_KEY.
// Ücretsiz anahtar: https://site.financialmodelingprep.com/developer/docs

import { STOCK_UNIVERSE, STOCK_TOP_N } from "./universe";
import type { EarningsMomentum, EarningsSignal } from "./types";

interface IncomeRow {
  date: string;
  revenue: number;
  netIncome: number;
}

// FMP ücretsiz katman YALNIZCA yıllık (/stable, period=annual) veriye izin verir.
// Çeyreklik (period=quarter) 402 Ödeme Gerekli, eski /api/v3 ise 403 Yasak döner.
// Bu yüzden doğrudan stable+annual çekiyoruz; YoY = son mali yıl / önceki yıl.
async function fetchIncome(
  ticker: string,
  apiKey: string
): Promise<IncomeRow[] | null> {
  try {
    const url = `https://financialmodelingprep.com/stable/income-statement?symbol=${encodeURIComponent(
      ticker
    )}&period=annual&limit=5&apikey=${apiKey}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) return null;
    return json
      .map((q) => {
        const o = q as Record<string, unknown>;
        return {
          date: String(o.date ?? ""),
          revenue: Number(o.revenue ?? NaN),
          netIncome: Number(o.netIncome ?? NaN),
        };
      })
      .filter((q) => isFinite(q.revenue));
  } catch {
    return null;
  }
}

// YoY büyüme (yıllık): son mali yıl vs önceki yıl (rows[0] en güncel).
function yoy(rows: IncomeRow[], pick: (x: IncomeRow) => number): number | null {
  if (rows.length < 2) return null;
  const now = pick(rows[0]);
  const past = pick(rows[1]);
  if (!isFinite(now) || !isFinite(past) || past === 0) return null;
  return now / Math.abs(past) - 1;
}

export async function buildEarningsMomentum(): Promise<EarningsMomentum> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    return {
      enabled: false,
      reason:
        "FMP_API_KEY ortam değişkeni ayarlı değil. Ücretsiz anahtar alıp Vercel ortam değişkenlerine ekleyince earnings/revenue momentum otomatik etkinleşir.",
      topN: STOCK_TOP_N,
      stocks: [],
    };
  }

  // Tüm hisseler için paralel çek (free tier 250/gün; 24 çağrı).
  const settled = await Promise.allSettled(
    STOCK_UNIVERSE.map((s) => fetchIncome(s.ticker, apiKey))
  );

  const raw0 = STOCK_UNIVERSE.map((s, i) => {
    const r = settled[i];
    const q = r.status === "fulfilled" ? r.value : null;
    const revenueYoY = q ? yoy(q, (x) => x.revenue) : null;
    const earningsYoY = q ? yoy(q, (x) => x.netIncome) : null;
    return { s, revenueYoY, earningsYoY };
  });

  // Birleşik momentum skoru: gelir + kâr YoY'nin sıra-ortalaması.
  const byRev = [...raw0]
    .filter((x) => x.revenueYoY != null)
    .sort((a, b) => (b.revenueYoY as number) - (a.revenueYoY as number));
  const byEps = [...raw0]
    .filter((x) => x.earningsYoY != null)
    .sort((a, b) => (b.earningsYoY as number) - (a.earningsYoY as number));
  const revRank = new Map(byRev.map((x, i) => [x.s.key, i + 1]));
  const epsRank = new Map(byEps.map((x, i) => [x.s.key, i + 1]));

  const scored = raw0.map((x) => {
    const rr = revRank.get(x.s.key);
    const er = epsRank.get(x.s.key);
    const combined =
      rr != null && er != null ? (rr + er) / 2 : rr ?? er ?? Infinity;
    return { ...x, combined };
  });
  scored.sort((a, b) => a.combined - b.combined);

  const stocks: EarningsSignal[] = scored.map((x, i) => {
    const hasData = x.revenueYoY != null || x.earningsYoY != null;
    const rank = hasData ? i + 1 : null;
    return {
      key: x.s.key,
      name: x.s.name,
      ticker: x.s.ticker,
      revenueYoY: x.revenueYoY,
      earningsYoY: x.earningsYoY,
      rank,
      selected: rank != null && rank <= STOCK_TOP_N,
    };
  });

  const succeeded = stocks.filter((s) => s.rank != null).length;
  const note =
    succeeded === 0
      ? "FMP anahtarı çalışıyor ama hiçbir hisse için veri alınamadı (oran limiti veya plan kısıtı olabilir)."
      : `Yıllık veri (FMP ücretsiz katman çeyrekliği desteklemez): YoY = son mali yıl / önceki yıl. ${succeeded}/${stocks.length} hisse için veri alındı.`;

  return { enabled: true, note, topN: STOCK_TOP_N, stocks };
}
