// GET /api/analysis
// Yahoo'dan SPY/QQQ/GLD/BIL verisini çeker, dual momentum / GEM analizini döndürür.

import { NextResponse } from "next/server";
import { fetchMonthlySeries } from "@/lib/yahoo";
import {
  ASSETS,
  TBILL_TICKER,
  buildAnalysis,
} from "@/lib/momentum";
import type { RawSeries } from "@/lib/types";

// Her istekte taze hesap (statik prerender yok).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Tüm sembolleri paralel çek.
    const tickers = [...ASSETS.map((a) => a.ticker), TBILL_TICKER];
    const settled = await Promise.allSettled(
      tickers.map((t) => fetchMonthlySeries(t))
    );

    const byTicker: Record<string, RawSeries> = {};
    const errors: string[] = [];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") {
        byTicker[tickers[i]] = s.value;
      } else {
        errors.push(`${tickers[i]}: ${String(s.reason?.message ?? s.reason)}`);
      }
    });

    // Varlık anahtarına göre eşle.
    const rawByKey: Record<string, RawSeries> = {};
    for (const a of ASSETS) {
      const raw = byTicker[a.ticker];
      if (raw) rawByKey[a.key] = raw;
    }

    const tbillRaw =
      byTicker[TBILL_TICKER] ??
      ({
        ticker: TBILL_TICKER,
        currency: "USD",
        currentPrice: NaN,
        series: [],
      } as RawSeries);

    const analysis = buildAnalysis(rawByKey, tbillRaw);
    if (errors.length) {
      analysis.warnings.push(...errors.map((e) => `Veri hatası — ${e}`));
    }

    return NextResponse.json(analysis, {
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
