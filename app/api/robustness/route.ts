// GET /api/robustness?universe=etf|stock|crypto|sector|intl|commodity|factor
// Parametre dayanıklılık (overfitting) testi: bir evrenin verisini BİR KEZ çeker,
// look-back × top-N grid'inde backtest koşar ve her hücrenin Sharpe/CAGR'ını döner.
// Strateji yalnız 12-ay/seçili-topN'de mi iyi, yoksa tüm yüzeyde mi sağlam?

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
  type Instrument,
} from "@/lib/universe";
import { runBacktest, runStockBacktest } from "@/lib/backtest";
import type { RawSeries } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const CONFIGS: Record<
  string,
  { universe: Instrument[]; positionLabel: string; benchLabel: string }
> = {
  stock: {
    universe: STOCK_UNIVERSE,
    positionLabel: "Hisse Momentum",
    benchLabel: "Eşit Ağırlık (Tüm Hisseler)",
  },
  crypto: {
    universe: CRYPTO_UNIVERSE,
    positionLabel: "Kripto Momentum",
    benchLabel: "Eşit Ağırlık (Tüm Kriptolar)",
  },
  sector: {
    universe: DMSR_SECTORS,
    positionLabel: "Sektör Momentum (DMSR)",
    benchLabel: "Eşit Ağırlık (Tüm Sektörler)",
  },
  intl: {
    universe: INTL_UNIVERSE,
    positionLabel: "Bölgesel Momentum",
    benchLabel: "Eşit Ağırlık (Tüm Bölgeler)",
  },
  commodity: {
    universe: COMMODITIES_UNIVERSE,
    positionLabel: "Emtia Momentum",
    benchLabel: "Eşit Ağırlık (Tüm Emtialar)",
  },
  factor: {
    universe: FACTOR_UNIVERSE,
    positionLabel: "Faktör Momentum",
    benchLabel: "Eşit Ağırlık (Tüm Faktörler)",
  },
};

const LOOKBACKS = [1, 3, 6, 9, 12, 18];
const TOPNS = [1, 2, 3, 5, 8];

const CACHE = new Map<string, { at: number; data: unknown }>();
const TTL = 10 * 60 * 1000;

async function fetchMap(list: Instrument[]) {
  const settled = await Promise.allSettled(
    list.map((i) => fetchMonthlySeries(i.ticker, "max"))
  );
  const m: Record<string, RawSeries> = {};
  list.forEach((i, idx) => {
    const s = settled[idx];
    if (s.status === "fulfilled") m[i.key] = s.value;
  });
  return m;
}

type Cell = { lb: number; topN: number; sharpe: number | null; cagr: number | null };

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const universe = (sp.get("universe") || "etf").toLowerCase();
    const force = sp.get("refresh") === "1";

    const hit = CACHE.get(universe);
    if (!force && hit && Date.now() - hit.at < TTL) {
      return NextResponse.json(hit.data);
    }

    const tbillRaw = (await fetchMap([TBILL]))[TBILL.key] ?? {
      ticker: TBILL.ticker,
      currency: "USD",
      currentPrice: NaN,
      series: [],
    };

    let payload: {
      universe: string;
      lookbacks: number[];
      topNs: number[];
      cells: Cell[];
    };

    if (universe === "etf") {
      // GEM tekli seçim yapar (top-N anlamsız) → yalnız look-back boyutu.
      const coreRaw = await fetchMap(CORE_ASSETS);
      const cells: Cell[] = LOOKBACKS.map((lb) => {
        const bt = runBacktest(coreRaw, tbillRaw, lb);
        const s = bt?.strategies[0];
        return { lb, topN: 1, sharpe: s?.sharpe ?? null, cagr: s?.cagr ?? null };
      });
      payload = { universe, lookbacks: LOOKBACKS, topNs: [1], cells };
    } else {
      const cfg = CONFIGS[universe];
      if (!cfg) {
        return NextResponse.json(
          { error: "Geçersiz evren", universe },
          { status: 400 }
        );
      }
      const raw = await fetchMap(cfg.universe);
      const topNs = TOPNS.filter((t) => t <= cfg.universe.length);
      const cells: Cell[] = [];
      for (const lb of LOOKBACKS) {
        for (const tn of topNs) {
          const bt = runStockBacktest(raw, tbillRaw, cfg.universe, tn, {
            stratLabel: cfg.positionLabel,
            benchLabel: cfg.benchLabel,
            investedKey: universe,
            lookback: lb,
          });
          const s = bt?.strategies[0];
          cells.push({
            lb,
            topN: tn,
            sharpe: s?.sharpe ?? null,
            cagr: s?.cagr ?? null,
          });
        }
      }
      payload = { universe, lookbacks: LOOKBACKS, topNs, cells };
    }

    CACHE.set(universe, { at: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: "Dayanıklılık hesaplanamadı", detail: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
