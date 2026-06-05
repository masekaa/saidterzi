// Yahoo Finance veri çekme yardımcısı (keyless, resmi olmayan chart API).
// Aylık adjusted-close serisi döndürür (total return uyumlu).

import type { MonthlyPoint, RawSeries } from "./types";

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

interface YahooChartResponse {
  chart: {
    result:
      | {
          meta: {
            currency: string;
            symbol: string;
            regularMarketPrice?: number;
          };
          timestamp?: number[];
          indicators: {
            adjclose?: { adjclose: (number | null)[] }[];
            quote?: { close: (number | null)[] }[];
          };
        }[]
      | null;
    error: { code: string; description: string } | null;
  };
}

/**
 * Bir sembol için ~2 yıllık aylık adjusted-close serisi + güncel fiyat çeker.
 * Hata durumunda exception fırlatır.
 */
export async function fetchMonthlySeries(ticker: string): Promise<RawSeries> {
  const url = `${BASE}/${encodeURIComponent(
    ticker
  )}?range=2y&interval=1mo&includePrePost=false`;

  const res = await fetch(url, {
    headers: {
      // Yahoo, User-Agent olmadan bazen 403 döner.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "application/json",
    },
    // Her istekte taze veri (Vercel edge cache'ini atla).
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Yahoo isteği başarısız (${ticker}): HTTP ${res.status}`);
  }

  const data = (await res.json()) as YahooChartResponse;

  if (data.chart.error) {
    throw new Error(
      `Yahoo hatası (${ticker}): ${data.chart.error.description}`
    );
  }
  const result = data.chart.result?.[0];
  if (!result) {
    throw new Error(`Yahoo: ${ticker} için sonuç yok`);
  }

  const timestamps = result.timestamp ?? [];
  const adj =
    result.indicators.adjclose?.[0]?.adjclose ??
    result.indicators.quote?.[0]?.close ??
    [];

  const series: MonthlyPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = adj[i];
    if (close == null || !isFinite(close)) continue;
    series.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      close,
    });
  }

  const currentPrice =
    result.meta.regularMarketPrice ??
    (series.length ? series[series.length - 1].close : NaN);

  return {
    ticker,
    currency: result.meta.currency ?? "USD",
    currentPrice,
    series,
  };
}
