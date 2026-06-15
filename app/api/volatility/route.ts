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
  type VolPrediction,
} from "@/lib/volatility";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

interface StockVol {
  ticker: string;
  name: string;
  note?: string;
  lastPrice: number | null;
  prevClose: number | null;
  dayChangePct: number | null; // gün içi % değişim
  asof: number | null; // son barın zamanı (unix sn)
  spark: number[]; // son ~30 kapanış (mini grafik için)
  regimeHistory: string[]; // son ~12 barın rejimi (low/normal/high)
  h1: VolPrediction | null;
  h2: VolPrediction | null;
}

interface VolResponse {
  asof: string;
  exchangeTz: string;
  gran: string;
  marketOpen: boolean; // son bar yeterince taze mi (seans açık mı)
  lastBar: number | null; // en taze barın zamanı (unix sn)
  meta: {
    h1: { r2: number; rho: number; rhoNaive: number; nTest: number };
    h2: { r2: number; rho: number; rhoNaive: number; nTest: number };
    reliability: { pred: number; actual: number; n: number }[];
  };
  stocks: StockVol[];
}

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
    return NextResponse.json(c.data);
  }

  const results = await settledLimit(BIST_UNIVERSE, 6, async (inst) => {
    const series = await fetchIntraday(inst.ticker, pair.interval, pair.range);
    const feats = computeFeatures(series.bars, series.gmtoffset);
    const h1 = feats ? predict(pair.h1, feats) : null;
    const h2 = feats ? predict(pair.h2, feats) : null;
    // Rejim geçmişi: son ~12 bar için (her biri kendi geçmişiyle) h1 rejimi.
    const okBars = series.bars.filter((b) => b.c != null);
    const regimeHistory: string[] = [];
    for (let i = Math.max(26, okBars.length - 12); i < okBars.length; i++) {
      const f = computeFeatures(okBars.slice(0, i + 1), series.gmtoffset);
      if (f) regimeHistory.push(predict(pair.h1, f).regime);
    }
    const closes = series.bars
      .map((b) => b.c)
      .filter((x): x is number => x != null);
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
      h1,
      h2,
    };
    return { sv, tz: series.exchangeTz };
  });

  const stocks: StockVol[] = [];
  let tz = "Europe/Istanbul";
  for (const r of results) {
    if (r.status === "fulfilled") {
      stocks.push(r.value.sv);
      if (r.value.tz) tz = r.value.tz;
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
    meta: {
      h1: { r2: m1.r2_ridge, rho: m1.rho_ridge, rhoNaive: m1.rho_naive, nTest: m1.n_test },
      h2: { r2: m2.r2_ridge, rho: m2.rho_ridge, rhoNaive: m2.rho_naive, nTest: m2.n_test },
      reliability: pair.h1.reliability ?? [],
    },
    stocks,
  };
  cache[gran] = { at: Date.now(), data };
  return NextResponse.json(data);
}
