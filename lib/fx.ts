// fx.ts — Para birimi çevrimi (yabancı borsa serilerini USD'ye getirir).
// BIST gibi TRY-cinsli serilerin mutlak momentum eşiği (USD T-Bill) ve
// evrenler-arası kıyasla tutarlı olması için kullanılır.

import type { RawSeries, MonthlyPoint } from "@/lib/types";

// Bir seriyi USD'ye çevirir: her ayın (adjusted-close = total return) kapanışını
// o ayın USD/TRY kuruna böler. USDTRY=X = 1 USD'nin TRY karşılığı → USD fiyat =
// TRY fiyat / kur. Sonuç USD total-return endeksidir. FX yoksa veya hiç örtüşme
// yoksa orijinal seri korunur (graceful — evren kaybolmaz).
export function toUsdSeries(s: RawSeries, fx: RawSeries): RawSeries {
  if (!fx?.series?.length) return s;
  const fxByMonth = new Map<string, number>();
  for (const p of fx.series) {
    if (p.close > 0 && isFinite(p.close)) fxByMonth.set(p.date.slice(0, 7), p.close);
  }
  const series: MonthlyPoint[] = [];
  for (const p of s.series) {
    const r = fxByMonth.get(p.date.slice(0, 7));
    if (r && r > 0 && p.close > 0) series.push({ date: p.date, close: p.close / r });
  }
  if (!series.length) return s;
  return {
    ticker: s.ticker,
    currency: "USD",
    currentPrice: series[series.length - 1].close,
    series,
  };
}

// key→RawSeries haritasının tümünü USD'ye çevirir.
export function mapToUsd(
  m: Record<string, RawSeries>,
  fx: RawSeries
): Record<string, RawSeries> {
  if (!fx?.series?.length) return m;
  const out: Record<string, RawSeries> = {};
  for (const k of Object.keys(m)) out[k] = toUsdSeries(m[k], fx);
  return out;
}
