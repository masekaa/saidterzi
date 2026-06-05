// Ortak tipler — Dual Momentum / GEM analiz uygulaması

export type AssetKey = "spy" | "qqq" | "gld";

export interface AssetConfig {
  key: AssetKey;
  name: string; // Görünen ad (TR)
  ticker: string; // Yahoo sembolü (ETF — adjusted close = total return)
  description: string;
}

export interface MonthlyPoint {
  date: string; // ISO (YYYY-MM-DD)
  close: number; // adjusted close (total return)
}

// Yahoo'dan çekilen ham seri + güncel fiyat
export interface RawSeries {
  ticker: string;
  currency: string;
  currentPrice: number;
  series: MonthlyPoint[]; // aylık, eskiden yeniye sıralı
}

export type Signal = "LONG" | "CASH";

export interface AssetAnalysis {
  key: AssetKey;
  name: string;
  ticker: string;
  currentPrice: number;
  currency: string;
  ret12m: number | null; // son 12 ay toplam getiri (oran, örn. 0.18 = %18)
  excessReturn: number | null; // ret12m - tbillRet12m
  signal: Signal; // varlık-bazlı absolute momentum sinyali
  asOf: string | null; // 12 ay referans tarihi
}

export interface GemRecommendation {
  // Relative momentum kazananı (3 varlıktan en yüksek 12m getiri)
  relativeWinnerKey: AssetKey;
  relativeWinnerName: string;
  relativeWinnerRet12m: number;
  // Absolute momentum filtresi
  absolutePositive: boolean; // kazananın getirisi T-Bill'i geçiyor mu?
  // Nihai pozisyon
  positionKey: AssetKey | "cash";
  positionName: string;
  rationale: string;
}

export interface AnalysisResult {
  generatedAt: string; // ISO timestamp
  lookbackMonths: number;
  tbill: {
    ticker: string;
    ret12m: number | null; // T-Bill son 12 ay getirisi (eşik)
    currentPrice: number;
  };
  assets: AssetAnalysis[];
  gem: GemRecommendation;
  warnings: string[];
}
