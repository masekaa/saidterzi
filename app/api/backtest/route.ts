// GET /api/backtest?universe=etf|stock|crypto|sector&lookback=12&topN=5
// Hafif, etkileşimli backtest: yalnızca seçilen evrenin sembollerini çeker ve
// kullanıcı parametreleriyle (look-back, top-N) momentum rotasyon backtest'i koşar.

import { NextResponse } from "next/server";
import { fetchMonthlySeries } from "@/lib/yahoo";
import {
  CORE_ASSETS,
  TBILL,
  STOCK_UNIVERSE,
  CRYPTO_UNIVERSE,
  DMSR_SECTORS,
  INTL_UNIVERSE,
  COMMODITIES_UNIVERSE,
  FACTOR_UNIVERSE,
  BOND_UNIVERSE,
  ASSET_CLASS_UNIVERSE,
  ASSET_CLASS_TOP_N,
  type Instrument,
} from "@/lib/universe";
import { runBacktest, runStockBacktest } from "@/lib/backtest";
import { settledLimit } from "@/lib/concurrency";
import type { BacktestResult, RawSeries } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Cfg {
  universe: Instrument[];
  positionLabel: string;
  benchLabel: string;
  defaultTopN: number;
}

const CONFIGS: Record<string, Cfg> = {
  stock: {
    universe: STOCK_UNIVERSE,
    positionLabel: "Hisse Momentum",
    benchLabel: "Eşit Ağırlık (Tüm Hisseler)",
    defaultTopN: 5,
  },
  crypto: {
    universe: CRYPTO_UNIVERSE,
    positionLabel: "Kripto Momentum",
    benchLabel: "Eşit Ağırlık (Tüm Kriptolar)",
    defaultTopN: 3,
  },
  sector: {
    universe: DMSR_SECTORS,
    positionLabel: "Sektör Momentum (DMSR)",
    benchLabel: "Eşit Ağırlık (Tüm Sektörler)",
    defaultTopN: 3,
  },
  intl: {
    universe: INTL_UNIVERSE,
    positionLabel: "Bölgesel Momentum",
    benchLabel: "Eşit Ağırlık (Tüm Bölgeler)",
    defaultTopN: 3,
  },
  commodity: {
    universe: COMMODITIES_UNIVERSE,
    positionLabel: "Emtia Momentum",
    benchLabel: "Eşit Ağırlık (Tüm Emtialar)",
    defaultTopN: 3,
  },
  factor: {
    universe: FACTOR_UNIVERSE,
    positionLabel: "Faktör Momentum",
    benchLabel: "Eşit Ağırlık (Tüm Faktörler)",
    defaultTopN: 2,
  },
  bond: {
    universe: BOND_UNIVERSE,
    positionLabel: "Tahvil Momentum",
    benchLabel: "Eşit Ağırlık (Tüm Tahviller)",
    defaultTopN: 2,
  },
  assetclass: {
    universe: ASSET_CLASS_UNIVERSE,
    positionLabel: "Varlık-Sınıfı Momentum",
    benchLabel: "Eşit Ağırlık (Tüm Sınıflar)",
    defaultTopN: ASSET_CLASS_TOP_N,
  },
};

// universe+lookback+topN bazlı kısa önbellek (10 dk).
const CACHE = new Map<string, { at: number; data: unknown }>();
const TTL = 10 * 60 * 1000;

async function fetchMap(list: Instrument[]) {
  const settled = await settledLimit(list, 12, (i) =>
    fetchMonthlySeries(i.ticker, "max")
  );
  const m: Record<string, RawSeries> = {};
  list.forEach((i, idx) => {
    const s = settled[idx];
    if (s.status === "fulfilled") m[i.key] = s.value;
  });
  return m;
}

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const universe = (sp.get("universe") || "etf").toLowerCase();
    const lookback = Math.min(24, Math.max(1, Number(sp.get("lookback")) || 12));
    const cost = Math.min(200, Math.max(0, Number(sp.get("cost")) || 0));
    const force = sp.get("refresh") === "1";

    const tbillRaw = (await fetchMap([TBILL]))[TBILL.key] ?? {
      ticker: TBILL.ticker,
      currency: "USD",
      currentPrice: NaN,
      series: [],
    };

    let backtest: BacktestResult | null = null;
    let topN = 0;
    let label = "GEM (Dual Momentum)";

    if (universe === "etf") {
      label = "GEM (Dual Momentum)";
      const key = `etf|${lookback}|${cost}`;
      const hit = CACHE.get(key);
      if (!force && hit && Date.now() - hit.at < TTL) {
        return NextResponse.json(hit.data);
      }
      const coreRaw = await fetchMap(CORE_ASSETS);
      backtest = runBacktest(coreRaw, tbillRaw, lookback, cost);
      const data = { universe, lookback, topN: 0, cost, label, backtest };
      CACHE.set(key, { at: Date.now(), data });
      return NextResponse.json(data);
    }

    const cfg = CONFIGS[universe];
    if (!cfg) {
      return NextResponse.json(
        { error: "Geçersiz evren", universe },
        { status: 400 }
      );
    }
    topN = Math.min(
      cfg.universe.length,
      Math.max(1, Number(sp.get("topN")) || cfg.defaultTopN)
    );
    label = cfg.positionLabel;

    const key = `${universe}|${lookback}|${topN}|${cost}`;
    const hit = CACHE.get(key);
    if (!force && hit && Date.now() - hit.at < TTL) {
      return NextResponse.json(hit.data);
    }

    const raw = await fetchMap(cfg.universe);
    backtest = runStockBacktest(raw, tbillRaw, cfg.universe, topN, {
      stratLabel: cfg.positionLabel,
      benchLabel: cfg.benchLabel,
      investedKey: universe,
      lookback,
      costBps: cost,
    });
    const data = { universe, lookback, topN, cost, label, backtest };
    CACHE.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Backtest üretilemedi", detail: String(err) },
      { status: 500 }
    );
  }
}
