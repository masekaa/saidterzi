// GET /api/volatility
// BIST hisselerinin gün-içi (60m) barlarını çeker, EĞİTİLMİŞ oynaklık modeliyle
// önümüzdeki 1 ve 2 saatlik HAREKET BÜYÜKLÜĞÜ tahmini + rejim (düşük/normal/yüksek)
// üretir. Yön DEĞİL — yön tahmini kanıtlanmış şekilde rastgele.

import { NextResponse } from "next/server";
import { fetchIntraday } from "@/lib/intraday";
import { settledLimit } from "@/lib/concurrency";
import { BIST_UNIVERSE } from "@/lib/universe";
import {
  MODEL_PAIRS,
  DEFAULT_GRAN,
  computeFeatures,
  predict,
  type Regime,
  type StockVol,
  type VolResponse,
} from "@/lib/volatility";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Vercel edge CDN'i 3 dk önbelleğe alsın (in-memory cache cold-start'ta kaybolur);
// stale-while-revalidate ile eskimiş yanıt anında servis edilip arkada tazelenir.
const CDN_CACHE = "public, s-maxage=180, stale-while-revalidate=300";
export const maxDuration = 60;

// Sunucu-içi önbellek (gün-içi veri — 3 dk taze), granülerlik başına.
const cache: Record<string, { at: number; data: VolResponse }> = {};
const TTL = 3 * 60 * 1000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const granParam = url.searchParams.get("gran") ?? DEFAULT_GRAN;
  const gran = MODEL_PAIRS[granParam] ? granParam : DEFAULT_GRAN;
  const pair = MODEL_PAIRS[gran];

  const c = cache[gran];
  if (c && Date.now() - c.at < TTL) {
    return NextResponse.json(c.data, { headers: { "Cache-Control": CDN_CACHE } });
  }

  const results = await settledLimit(BIST_UNIVERSE, 6, async (inst) => {
    const series = await fetchIntraday(inst.ticker, pair.interval, pair.range);
    const feats = computeFeatures(series.bars, series.gmtoffset);
    const h1 = feats ? predict(pair.h1, feats) : null;
    const h2 = feats ? predict(pair.h2, feats) : null;
    // Rejim + hareket geçmişi: son ~12 bar için (her biri kendi geçmişiyle) h1.
    const okBars = series.bars.filter((b) => b.c != null);
    const regimeHistory: Regime[] = [];
    const moveHistory: number[] = []; // beklenen ±% hareket, bar bar (endeks için)
    for (let i = Math.max(26, okBars.length - 12); i < okBars.length; i++) {
      const f = computeFeatures(okBars.slice(0, i + 1), series.gmtoffset);
      if (f) {
        const p = predict(pair.h1, f);
        regimeHistory.push(p.regime);
        moveHistory.push(p.expectedMovePct);
      }
    }
    const closes = series.bars
      .map((b) => b.c)
      .filter((x): x is number => x != null);
    // Bu hissenin "tipik" 1-bar hareketi: son ~60 barın ortalama |log-getiri|si.
    let typicalMovePct: number | null = null;
    if (closes.length > 12) {
      const rets: number[] = [];
      for (let i = Math.max(1, closes.length - 60); i < closes.length; i++) {
        rets.push(Math.abs(Math.log(closes[i] / closes[i - 1])));
      }
      if (rets.length > 0) {
        typicalMovePct = (rets.reduce((a, b) => a + b, 0) / rets.length) * 100;
      }
    }
    // Hacim teyidi: son barın hacmi, önceki ~12 barın ortalamasının kaç katı?
    let volRatio: number | null = null;
    {
      const vols = series.bars
        .map((b) => b.v)
        .filter((x): x is number => x != null && x > 0);
      if (vols.length >= 13) {
        const lastV = vols[vols.length - 1];
        const base = vols.slice(-13, -1); // son bardan önceki 12 bar
        const avg = base.reduce((a, b) => a + b, 0) / base.length;
        if (avg > 0) volRatio = lastV / avg;
      }
    }
    const last = closes.at(-1) ?? null;
    const lastT = series.bars.filter((b) => b.c != null).at(-1)?.t ?? null;
    const dayChangePct =
      series.lastPrice != null && series.prevClose != null && series.prevClose !== 0
        ? (series.lastPrice / series.prevClose - 1) * 100
        : null;
    const sv: StockVol = {
      ticker: inst.ticker,
      name: inst.name,
      note: inst.note,
      lastPrice: series.lastPrice ?? last,
      prevClose: series.prevClose,
      dayChangePct,
      asof: lastT,
      spark: closes.slice(-30),
      regimeHistory,
      typicalMovePct,
      volRatio,
      h1,
      h2,
    };
    return { sv, tz: series.exchangeTz, moveHistory };
  });

  const stocks: StockVol[] = [];
  let tz = "Europe/Istanbul";
  const moveHists: number[][] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      stocks.push(r.value.sv);
      if (r.value.tz) tz = r.value.tz;
      if (r.value.moveHistory.length > 0) moveHists.push(r.value.moveHistory);
    }
  }
  // BIST oynaklık endeksi: kesitsel (hisseler-arası) ortalama beklenen hareket,
  // bar bar (sondan hizalı). Piyasa-geneli oynaklık yükseliyor mu düşüyor mu?
  const maxLen = moveHists.reduce((m, h) => Math.max(m, h.length), 0);
  const marketVolHistory: number[] = [];
  for (let j = maxLen; j >= 1; j--) {
    const vals: number[] = [];
    for (const h of moveHists) {
      const v = h[h.length - j]; // sondan j'inci
      if (v != null && Number.isFinite(v)) vals.push(v);
    }
    if (vals.length >= 3) {
      marketVolHistory.push(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }
  // Beklenen harekete (H=1) göre büyükten küçüğe sırala (en oynak en üstte).
  stocks.sort(
    (a, b) => (b.h1?.expectedMovePct ?? -1) - (a.h1?.expectedMovePct ?? -1)
  );

  // Seans durumu: en taze bar şu andan ne kadar önce? 60m'de <90dk, 5m'de <15dk taze.
  const lastBar = stocks.reduce<number | null>(
    (mx, s) => (s.asof != null && (mx == null || s.asof > mx) ? s.asof : mx),
    null
  );
  const nowSec = Date.now() / 1000;
  const freshSec = gran === "5m" ? 15 * 60 : 90 * 60;
  const marketOpen = lastBar != null && nowSec - lastBar < freshSec;

  const m1 = pair.h1.oos;
  const m2 = pair.h2.oos;
  const data: VolResponse = {
    asof: new Date().toISOString(),
    exchangeTz: tz,
    gran,
    marketOpen,
    lastBar,
    marketVolHistory,
    meta: {
      h1: { r2: m1.r2_ridge, rho: m1.rho_ridge, rhoNaive: m1.rho_naive, nTest: m1.n_test },
      h2: { r2: m2.r2_ridge, rho: m2.rho_ridge, rhoNaive: m2.rho_naive, nTest: m2.n_test },
      reliability: pair.h1.reliability ?? [],
    },
    stocks,
  };
  cache[gran] = { at: Date.now(), data };
  return NextResponse.json(data, { headers: { "Cache-Control": CDN_CACHE } });
}
