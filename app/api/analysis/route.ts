// GET /api/analysis
// Tüm sembolleri Yahoo'dan çeker, kapsam dokümanındaki tüm yöntemleri + backtest hesaplar.

import { NextResponse } from "next/server";
import { fetchMonthlySeries } from "@/lib/yahoo";
import {
  CORE_ASSETS,
  TBILL,
  GBM_BONDS,
  DMSR_SECTORS,
  allTickers,
  LOOKBACK_MONTHS,
} from "@/lib/universe";
import { buildAllMethods, buildSignalBoard } from "@/lib/methods";
import { runBacktest } from "@/lib/backtest";
import { trailingReturn } from "@/lib/calc";
import type { AnalysisResult, RawSeries } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
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

    const warnings: string[] = [];
    if (errors.length) warnings.push(...errors.map((e) => `Veri hatası — ${e}`));
    for (const a of CORE_ASSETS)
      if (!coreRaw[a.key])
        warnings.push(`${a.name} (${a.ticker}) verisi alınamadı.`);

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
      methods,
      backtest,
      warnings,
    };

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
