// GET /api/analysis
// Tüm sembolleri Yahoo'dan çeker, kapsam dokümanındaki tüm yöntemleri + backtest hesaplar.

import { NextResponse } from "next/server";
import { fetchMonthlySeries } from "@/lib/yahoo";
import {
  CORE_ASSETS,
  TBILL,
  GBM_BONDS,
  DMSR_SECTORS,
  STOCK_UNIVERSE,
  STOCK_TOP_N,
  CRYPTO_UNIVERSE,
  CRYPTO_TOP_N,
  INTL_UNIVERSE,
  INTL_TOP_N,
  DMSR_TOP_N,
  allTickers,
  LOOKBACK_MONTHS,
  type Instrument,
} from "@/lib/universe";
import {
  buildAllMethods,
  buildSignalBoard,
  buildLookbackMatrix,
  buildStockMomentum,
  buildStockMethods,
} from "@/lib/methods";
import { fetchFamaFrench3, alphaFromFactors } from "@/lib/factors";
import { buildEarningsMomentum } from "@/lib/fundamentals";
import { runBacktest, runStockBacktest, buildComposite } from "@/lib/backtest";
import { trailingReturn } from "@/lib/calc";
import type {
  AnalysisResult,
  BacktestResult,
  RawSeries,
  UniverseBundle,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Çok sayıda dış istek (Yahoo + Ken French + FMP) — fonksiyon süresini uzat.
export const maxDuration = 60;

// Sunucu-içi önbellek: aylık veri olduğundan 10 dk taze kabul edilir.
// Yahoo rate-limit riskini ve yükleme süresini ciddi azaltır. ?refresh=1 atlar.
let CACHE: { at: number; result: AnalysisResult } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  if (!force && CACHE && Date.now() - CACHE.at < CACHE_TTL_MS) {
    return NextResponse.json(
      { ...CACHE.result, fromCache: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
  try {
    const tickers = allTickers();
    const settled = await Promise.allSettled(
      tickers.map((t) => fetchMonthlySeries(t, "max"))
    );

    const byTicker: Record<string, RawSeries> = {};
    const errors: string[] = [];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") byTicker[tickers[i]] = s.value;
      else errors.push(`${tickers[i]}: ${String(s.reason?.message ?? s.reason)}`);
    });

    // Sembolleri evrenlere göre anahtarla grupla
    const mapBy = (list: { key: string; ticker: string }[]) => {
      const m: Record<string, RawSeries> = {};
      for (const it of list) {
        const raw = byTicker[it.ticker];
        if (raw) m[it.key] = raw;
      }
      return m;
    };
    const coreRaw = mapBy(CORE_ASSETS);
    const bondRaw = mapBy(GBM_BONDS);
    const sectorRaw = mapBy(DMSR_SECTORS);
    const stockRaw = mapBy(STOCK_UNIVERSE);
    const tbillRaw =
      byTicker[TBILL.ticker] ??
      ({ ticker: TBILL.ticker, currency: "USD", currentPrice: NaN, series: [] } as RawSeries);
    const spyRaw =
      coreRaw["spy"] ??
      ({ ticker: "SPY", currency: "USD", currentPrice: NaN, series: [] } as RawSeries);

    const { methods, gem } = buildAllMethods(
      coreRaw,
      tbillRaw,
      bondRaw,
      sectorRaw,
      spyRaw
    );

    const backtest = runBacktest(coreRaw, tbillRaw);
    const signals = buildSignalBoard(coreRaw, tbillRaw, gem.relativeWinnerKey);
    const lookback = buildLookbackMatrix(coreRaw, tbillRaw);
    const cryptoRaw = mapBy(CRYPTO_UNIVERSE);
    const intlRaw = mapBy(INTL_UNIVERSE);

    // İki yavaş dış çağrıyı (Ken French zip + FMP earnings) PARALEL başlat —
    // soğuk yükleme süresini kısaltır (sıralı await yerine örtüşürler).
    const factorsP = fetchFamaFrench3().catch(() => null);
    const earningsP = buildEarningsMomentum().catch(() => ({
      enabled: false,
      reason: "Earnings verisi alınamadı.",
      topN: STOCK_TOP_N,
      stocks: [],
    }));

    // Fama-French 3 faktörü (non-fatal); tüm stratejilerde paylaşılır.
    const factors = await factorsP;
    const monthlyFrom = (bt: BacktestResult | null) => {
      if (!bt) return [];
      const curve =
        bt.equityCurves.find((c) => c.highlight) ?? bt.equityCurves[0];
      if (!curve) return [];
      const out: { ym: string; ret: number }[] = [];
      for (let i = 1; i < curve.growth.length; i++) {
        const ym = bt.dates[i]?.slice(0, 7);
        if (ym) out.push({ ym, ret: curve.growth[i] / curve.growth[i - 1] - 1 });
      }
      return out;
    };
    const alphaFor = (bt: BacktestResult | null) => {
      if (!factors) return null;
      const m = monthlyFrom(bt);
      return m.length ? alphaFromFactors(m, factors) : null;
    };

    const factorAlpha = alphaFor(backtest);

    // ETF dışı evren paketlerini (hisse, kripto) tek döngüde üret.
    const universeConfigs: {
      id: string;
      emoji: string;
      label: string;
      sublabel: string;
      positionLabel: string;
      benchLabel: string;
      raw: Record<string, RawSeries>;
      universe: Instrument[];
      topN: number;
      withEarnings: boolean;
    }[] = [
      {
        id: "stock",
        emoji: "📈",
        label: "Hisse Senedi Evreni",
        sublabel: `${STOCK_UNIVERSE.length} büyük-cap hisse`,
        positionLabel: "Hisse Momentum",
        benchLabel: "Eşit Ağırlık (Tüm Hisseler)",
        raw: stockRaw,
        universe: STOCK_UNIVERSE,
        topN: STOCK_TOP_N,
        withEarnings: true,
      },
      {
        id: "crypto",
        emoji: "🪙",
        label: "Kripto Evreni",
        sublabel: `${CRYPTO_UNIVERSE.length} kripto varlık`,
        positionLabel: "Kripto Momentum",
        benchLabel: "Eşit Ağırlık (Tüm Kriptolar)",
        raw: cryptoRaw,
        universe: CRYPTO_UNIVERSE,
        topN: CRYPTO_TOP_N,
        withEarnings: false,
      },
      {
        id: "sector",
        emoji: "🏭",
        label: "Sektör Rotasyonu",
        sublabel: `${DMSR_SECTORS.length} SPDR sektör ETF'i (DMSR)`,
        positionLabel: "Sektör Momentum (DMSR)",
        benchLabel: "Eşit Ağırlık (Tüm Sektörler)",
        raw: sectorRaw,
        universe: DMSR_SECTORS,
        topN: DMSR_TOP_N,
        withEarnings: false,
      },
      {
        id: "intl",
        emoji: "🌍",
        label: "Uluslararası",
        sublabel: `${INTL_UNIVERSE.length} bölgesel hisse ETF'i`,
        positionLabel: "Bölgesel Momentum",
        benchLabel: "Eşit Ağırlık (Tüm Bölgeler)",
        raw: intlRaw,
        universe: INTL_UNIVERSE,
        topN: INTL_TOP_N,
        withEarnings: false,
      },
    ];

    const universes: UniverseBundle[] = [];
    for (const cfg of universeConfigs) {
      const momentum = buildStockMomentum(
        cfg.raw,
        tbillRaw,
        cfg.universe,
        cfg.topN
      );
      const signals = buildSignalBoard(
        cfg.raw,
        tbillRaw,
        momentum.stocks.find((s) => s.rank === 1)?.key ?? null,
        cfg.universe
      );
      const lookback = buildLookbackMatrix(cfg.raw, tbillRaw, cfg.universe);
      const methods = buildStockMethods(cfg.raw, tbillRaw, cfg.universe);
      const bt = runStockBacktest(cfg.raw, tbillRaw, cfg.universe, cfg.topN, {
        stratLabel: cfg.positionLabel,
        benchLabel: cfg.benchLabel,
        investedKey: cfg.id,
      });
      const earnings = cfg.withEarnings ? await earningsP : undefined;
      universes.push({
        id: cfg.id,
        emoji: cfg.emoji,
        label: cfg.label,
        sublabel: cfg.sublabel,
        positionLabel: cfg.positionLabel,
        momentum,
        signals,
        lookback,
        methods,
        backtest: bt,
        factorAlpha: alphaFor(bt),
        earnings,
      });
    }

    const warnings: string[] = [];
    if (errors.length) warnings.push(...errors.map((e) => `Veri hatası — ${e}`));
    for (const a of CORE_ASSETS)
      if (!coreRaw[a.key])
        warnings.push(`${a.name} (${a.ticker}) verisi alınamadı.`);

    // Her evren için veri kapsama uyarısı (eksik semboller).
    for (const cfg of universeConfigs) {
      const missing = cfg.universe.filter((i) => !cfg.raw[i.key]);
      if (missing.length)
        warnings.push(
          `${cfg.label}: ${missing.length}/${cfg.universe.length} varlık alınamadı (${missing
            .map((i) => i.ticker)
            .join(", ")}) — analiz mevcut varlıklarla yapıldı.`
        );
    }

    const result: AnalysisResult = {
      generatedAt: new Date().toISOString(),
      lookbackMonths: LOOKBACK_MONTHS,
      tbill: {
        ticker: tbillRaw.ticker,
        ret12m: trailingReturn(tbillRaw.series, LOOKBACK_MONTHS).ret,
        currentPrice: tbillRaw.currentPrice,
      },
      gem,
      signals,
      lookback,
      factorAlpha,
      methods,
      backtest,
      universes,
      composite: buildComposite(
        [
          { name: "GEM (ETF)", bt: backtest },
          ...universes.map((u) => ({ name: u.positionLabel, bt: u.backtest })),
        ],
        tbillRaw
      ),
      warnings,
    };

    CACHE = { at: Date.now(), result };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Analiz üretilemedi",
        detail: String(err instanceof Error ? err.message : err),
      },
      { status: 500 }
    );
  }
}
