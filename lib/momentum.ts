// Dual Momentum / GEM hesap çekirdeği.
// Kaynak metodoloji: Antonacci, "Dual Momentum Investing" (2014), Bölüm 7–8.
// - Absolute momentum: excess return (getiri - T-Bill) > 0 ?  -> LONG, değilse CASH
// - Relative momentum: 3 varlıktan en yüksek 12-ay getirili olanı seç
// - GEM: önce relative ile kazananı seç, sonra absolute filtresi (negatifse NAKİT)
// Look-back = 12 ay (kitabın tek parametresi).

import type {
  AnalysisResult,
  AssetAnalysis,
  AssetConfig,
  GemRecommendation,
  RawSeries,
  Signal,
} from "./types";

export const LOOKBACK_MONTHS = 12;

// Varlık evreni — hepsi ETF; Yahoo adjusted close = total return (temettü dahil).
export const ASSETS: AssetConfig[] = [
  {
    key: "spy",
    name: "S&P 500",
    ticker: "SPY",
    description: "SPDR S&P 500 ETF — ABD büyük-cap hisseleri",
  },
  {
    key: "qqq",
    name: "NASDAQ-100",
    ticker: "QQQ",
    description: "Invesco QQQ — NASDAQ-100 teknoloji ağırlıklı",
  },
  {
    key: "gld",
    name: "Altın",
    ticker: "GLD",
    description: "SPDR Gold Shares — altın spot",
  },
];

// T-Bill (risksiz faiz) — absolute momentum eşiği. BIL = 1-3 ay T-Bill ETF.
export const TBILL_TICKER = "BIL";

/**
 * Son `months` aylık toplam getiri.
 * Seri eskiden yeniye sıralı, adjusted close.
 * En güncel değeri, ~`months` ay öncesindeki değere böler.
 * Yetersiz veri varsa null döner.
 */
export function trailingReturn(
  series: { date: string; close: number }[],
  months: number
): { ret: number | null; asOf: string | null } {
  if (series.length < months + 1) {
    return { ret: null, asOf: null };
  }
  const last = series[series.length - 1];
  const past = series[series.length - 1 - months];
  if (!past || past.close <= 0) return { ret: null, asOf: null };
  return { ret: last.close / past.close - 1, asOf: past.date };
}

function signalFromExcess(excess: number | null): Signal {
  // excess > 0 => pozitif absolute momentum => LONG
  return excess != null && excess > 0 ? "LONG" : "CASH";
}

/**
 * Tüm analizi üretir: T-Bill eşiği, varlık-bazlı sinyaller ve GEM önerisi.
 */
export function buildAnalysis(
  rawByKey: Record<string, RawSeries>,
  tbillRaw: RawSeries
): AnalysisResult {
  const warnings: string[] = [];

  // T-Bill 12 ay getirisi (eşik)
  const tbillTr = trailingReturn(tbillRaw.series, LOOKBACK_MONTHS);
  const tbillRet = tbillTr.ret;
  if (tbillRet == null) {
    warnings.push(
      "T-Bill (BIL) için yeterli geçmiş veri yok — eşik 0 kabul ediliyor."
    );
  }
  const threshold = tbillRet ?? 0;

  // Varlık-bazlı analiz
  const assets: AssetAnalysis[] = ASSETS.map((cfg) => {
    const raw = rawByKey[cfg.key];
    if (!raw) {
      warnings.push(`${cfg.name} (${cfg.ticker}) verisi alınamadı.`);
      return {
        key: cfg.key,
        name: cfg.name,
        ticker: cfg.ticker,
        currentPrice: NaN,
        currency: "USD",
        ret12m: null,
        excessReturn: null,
        signal: "CASH" as Signal,
        asOf: null,
      };
    }
    const tr = trailingReturn(raw.series, LOOKBACK_MONTHS);
    const excess = tr.ret == null ? null : tr.ret - threshold;
    if (tr.ret == null) {
      warnings.push(
        `${cfg.name} (${cfg.ticker}) için 12 aylık getiri hesaplanamadı (yetersiz veri).`
      );
    }
    return {
      key: cfg.key,
      name: cfg.name,
      ticker: cfg.ticker,
      currentPrice: raw.currentPrice,
      currency: raw.currency,
      ret12m: tr.ret,
      excessReturn: excess,
      signal: signalFromExcess(excess),
      asOf: tr.asOf,
    };
  });

  // GEM: relative momentum kazananı (en yüksek 12m getiri, hesaplanabilenler arasında)
  const ranked = assets
    .filter((a) => a.ret12m != null)
    .sort((a, b) => (b.ret12m as number) - (a.ret12m as number));

  let gem: GemRecommendation;
  if (ranked.length === 0) {
    gem = {
      relativeWinnerKey: "spy",
      relativeWinnerName: "—",
      relativeWinnerRet12m: 0,
      absolutePositive: false,
      positionKey: "cash",
      positionName: "NAKİT / T-Bill",
      rationale:
        "Hiçbir varlık için yeterli veri yok; karar verilemiyor (nakitte kal).",
    };
    warnings.push("GEM kararı için yeterli veri yok.");
  } else {
    const winner = ranked[0];
    const winnerRet = winner.ret12m as number;
    const absolutePositive = winnerRet > threshold;
    const pct = (x: number) => `%${(x * 100).toFixed(1)}`;
    gem = {
      relativeWinnerKey: winner.key,
      relativeWinnerName: winner.name,
      relativeWinnerRet12m: winnerRet,
      absolutePositive,
      positionKey: absolutePositive ? winner.key : "cash",
      positionName: absolutePositive ? winner.name : "NAKİT / T-Bill",
      rationale: absolutePositive
        ? `Relative momentum: en güçlü varlık ${winner.name} (12 ay: ${pct(
            winnerRet
          )}). Absolute momentum: getirisi T-Bill eşiğini (${pct(
            threshold
          )}) geçiyor → ${winner.name} pozisyonu.`
        : `Relative momentum: en güçlü varlık ${winner.name} (12 ay: ${pct(
            winnerRet
          )}). Ancak getirisi T-Bill eşiğinin (${pct(
            threshold
          )}) altında → trend negatif kabul edilir → NAKİT/T-Bill'e geç.`,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    lookbackMonths: LOOKBACK_MONTHS,
    tbill: {
      ticker: tbillRaw.ticker,
      ret12m: tbillRet,
      currentPrice: tbillRaw.currentPrice,
    },
    assets,
    gem,
    warnings,
  };
}
