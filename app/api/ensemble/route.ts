// GET /api/ensemble?universe=etf|stock|crypto|sector|intl|commodity|factor|bond|assetclass|country
// Çok-pencereli (look-back) ensemble: aynı stratejiyi {3,6,9,12} ay
// look-back'lerinde koşar ve eşit-ağırlık harmanlar (parametre/timing luck'ı
// azaltır). Veriyi bir kez çeker; verified runBacktest/runStockBacktest +
// runLookbackEnsemble kullanır (çekirdek sinyal değişmez).

import { NextResponse } from "next/server";
import { fetchMonthlySeries } from "@/lib/yahoo";
import {
  CORE_ASSETS,
  TBILL,
  STOCK_UNIVERSE,
  STOCK_TOP_N,
  CRYPTO_UNIVERSE,
  CRYPTO_TOP_N,
  DMSR_SECTORS,
  DMSR_TOP_N,
  INTL_UNIVERSE,
  INTL_TOP_N,
  COMMODITIES_UNIVERSE,
  COMMODITIES_TOP_N,
  FACTOR_UNIVERSE,
  FACTOR_TOP_N,
  BOND_UNIVERSE,
  BOND_TOP_N,
  ASSET_CLASS_UNIVERSE,
  ASSET_CLASS_TOP_N,
  COUNTRY_UNIVERSE,
  COUNTRY_TOP_N,
  BIST_UNIVERSE,
  BIST_TOP_N,
  FX_USDTRY,
  type Instrument,
} from "@/lib/universe";
import { mapToUsd } from "@/lib/fx";
import { runBacktest, runStockBacktest, runLookbackEnsemble } from "@/lib/backtest";
import { settledLimit } from "@/lib/concurrency";
import type { BacktestResult, RawSeries } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const LOOKBACKS = [3, 6, 9, 12];

interface Cfg {
  universe: Instrument[];
  topN: number;
  positionLabel: string;
  benchLabel: string;
}
const CONFIGS: Record<string, Cfg> = {
  stock: { universe: STOCK_UNIVERSE, topN: STOCK_TOP_N, positionLabel: "Hisse Momentum", benchLabel: "Eşit Ağırlık (Tüm Hisseler)" },
  crypto: { universe: CRYPTO_UNIVERSE, topN: CRYPTO_TOP_N, positionLabel: "Kripto Momentum", benchLabel: "Eşit Ağırlık (Tüm Kriptolar)" },
  sector: { universe: DMSR_SECTORS, topN: DMSR_TOP_N, positionLabel: "Sektör Momentum (DMSR)", benchLabel: "Eşit Ağırlık (Tüm Sektörler)" },
  intl: { universe: INTL_UNIVERSE, topN: INTL_TOP_N, positionLabel: "Bölgesel Momentum", benchLabel: "Eşit Ağırlık (Tüm Bölgeler)" },
  commodity: { universe: COMMODITIES_UNIVERSE, topN: COMMODITIES_TOP_N, positionLabel: "Emtia Momentum", benchLabel: "Eşit Ağırlık (Tüm Emtialar)" },
  factor: { universe: FACTOR_UNIVERSE, topN: FACTOR_TOP_N, positionLabel: "Faktör Momentum", benchLabel: "Eşit Ağırlık (Tüm Faktörler)" },
  bond: { universe: BOND_UNIVERSE, topN: BOND_TOP_N, positionLabel: "Tahvil Momentum", benchLabel: "Eşit Ağırlık (Tüm Tahviller)" },
  assetclass: { universe: ASSET_CLASS_UNIVERSE, topN: ASSET_CLASS_TOP_N, positionLabel: "Varlık-Sınıfı Momentum", benchLabel: "Eşit Ağırlık (Tüm Sınıflar)" },
  country: { universe: COUNTRY_UNIVERSE, topN: COUNTRY_TOP_N, positionLabel: "Ülke Momentum", benchLabel: "Eşit Ağırlık (Tüm Ülkeler)" },
  bist: { universe: BIST_UNIVERSE, topN: BIST_TOP_N, positionLabel: "BIST Momentum", benchLabel: "Eşit Ağırlık (Tüm BIST)" },
};

const CACHE = new Map<string, { at: number; data: unknown }>();
const TTL = 10 * 60 * 1000;

async function fetchMap(list: Instrument[]) {
  const settled = await settledLimit(list, 12, (i) => fetchMonthlySeries(i.ticker, "max"));
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

    let bt: BacktestResult | null;
    let label: string;

    if (universe === "etf") {
      label = "GEM";
      const coreRaw = await fetchMap(CORE_ASSETS);
      bt = runLookbackEnsemble(
        (lb) => runBacktest(coreRaw, tbillRaw, lb),
        LOOKBACKS,
        tbillRaw,
        "GEM",
        "Eşit Ağırlık (Al-Tut)"
      );
    } else {
      const cfg = CONFIGS[universe];
      if (!cfg) {
        return NextResponse.json({ error: "Geçersiz evren", universe }, { status: 400 });
      }
      label = cfg.positionLabel;
      let raw = await fetchMap(cfg.universe);
      if (universe === "bist") {
        const fx =
          (await fetchMap([FX_USDTRY]))[FX_USDTRY.key] ??
          ({ ticker: FX_USDTRY.ticker, currency: "TRY", currentPrice: NaN, series: [] } as RawSeries);
        raw = mapToUsd(raw, fx);
      }
      bt = runLookbackEnsemble(
        (lb) =>
          runStockBacktest(raw, tbillRaw, cfg.universe, cfg.topN, {
            stratLabel: cfg.positionLabel,
            benchLabel: cfg.benchLabel,
            investedKey: universe,
            lookback: lb,
          }),
        LOOKBACKS,
        tbillRaw,
        cfg.positionLabel,
        cfg.benchLabel
      );
    }

    const data = { universe, label, lookbacks: LOOKBACKS, backtest: bt };
    CACHE.set(universe, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Ensemble hesaplanamadı", detail: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
