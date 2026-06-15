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
  h1: VolPrediction | null;
  h2: VolPrediction | null;
}

interface VolResponse {
  asof: string;
  exchangeTz: string;
  gran: string;
  meta: {
    h1: { r2: number; rho: number; rhoNaive: number; nTest: number };
    h2: { r2: number; rho: number; rhoNaive: number; nTest: number };
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

  const m1 = pair.h1.oos;
  const m2 = pair.h2.oos;
  const data: VolResponse = {
    asof: new Date().toISOString(),
    exchangeTz: tz,
    gran,
    meta: {
      h1: { r2: m1.r2_ridge, rho: m1.rho_ridge, rhoNaive: m1.rho_naive, nTest: m1.n_test },
      h2: { r2: m2.r2_ridge, rho: m2.rho_ridge, rhoNaive: m2.rho_naive, nTest: m2.n_test },
    },
    stocks,
  };
  cache[gran] = { at: Date.now(), data };
  return NextResponse.json(data);
}
