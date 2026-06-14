// intraday.ts — Yahoo gün-içi (intraday) veri çekme. Yahoo'nun en ince aralığı
// 1 dakika (saniyelik DESTEKLENMEZ). BIST `.IS` sembolleri için TRY cinsinden
// dakikalık OHLCV döndürür. range sınırları (Yahoo): 1m ~7 gün, 5m/15m ~60 gün,
// 60m ~730 gün. Veri çoğu borsada ~15 dk gecikmeli olabilir.

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

export type IntradayInterval =
  | "1m"
  | "2m"
  | "5m"
  | "15m"
  | "30m"
  | "60m"
  | "90m"
  | "1h";

export interface IntradayBar {
  t: number; // unix saniye (UTC)
  o: number | null;
  h: number | null;
  l: number | null;
  c: number | null;
  v: number | null;
}

export interface IntradaySeries {
  ticker: string;
  currency: string;
  prevClose: number | null; // önceki kapanış (günlük % değişim için)
  lastPrice: number | null; // anlık fiyat (meta.regularMarketPrice)
  gmtoffset: number; // borsa saat dilimi ofseti (saniye)
  exchangeTz: string; // ör. "Europe/Istanbul"
  bars: IntradayBar[];
}

interface YahooIntradayResponse {
  chart: {
    result:
      | {
          meta: {
            currency?: string;
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            gmtoffset?: number;
            exchangeTimezoneName?: string;
          };
          timestamp?: number[];
          indicators: {
            quote?: {
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }[];
          };
        }[]
      | null;
    error: { code: string; description: string } | null;
  };
}

/**
 * Bir sembol için gün-içi OHLCV serisi çeker.
 * @param ticker örn. "THYAO.IS"
 * @param interval "1m" (varsayılan) | "5m" | "15m" | "60m" ...
 * @param range "1d" (varsayılan) | "5d" | "1mo" ... (interval'a göre Yahoo sınırlar)
 */
export async function fetchIntraday(
  ticker: string,
  interval: IntradayInterval = "1m",
  range = "1d"
): Promise<IntradaySeries> {
  const url = `${BASE}/${encodeURIComponent(
    ticker
  )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(
    interval
  )}&includePrePost=false`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok)
    throw new Error(`Yahoo intraday başarısız (${ticker}): HTTP ${res.status}`);

  const data = (await res.json()) as YahooIntradayResponse;
  if (data.chart.error)
    throw new Error(
      `Yahoo intraday hatası (${ticker}): ${data.chart.error.description}`
    );
  const result = data.chart.result?.[0];
  if (!result) throw new Error(`Yahoo intraday: ${ticker} için sonuç yok`);

  const ts = result.timestamp ?? [];
  const q = result.indicators.quote?.[0] ?? {};
  const o = q.open ?? [];
  const h = q.high ?? [];
  const l = q.low ?? [];
  const c = q.close ?? [];
  const v = q.volume ?? [];

  const bars: IntradayBar[] = ts.map((t, i) => ({
    t,
    o: o[i] ?? null,
    h: h[i] ?? null,
    l: l[i] ?? null,
    c: c[i] ?? null,
    v: v[i] ?? null,
  }));

  return {
    ticker,
    currency: result.meta.currency ?? "TRY",
    prevClose:
      result.meta.chartPreviousClose ?? result.meta.previousClose ?? null,
    lastPrice: result.meta.regularMarketPrice ?? null,
    gmtoffset: result.meta.gmtoffset ?? 0,
    exchangeTz: result.meta.exchangeTimezoneName ?? "",
    bars,
  };
}
