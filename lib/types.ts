// Ortak tipler — Dual Momentum / GEM çok-yöntemli analiz uygulaması

export type Signal = "LONG" | "CASH";

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

// --- Şeffaf hesaplama gösterimi ---
// Her yöntem, formülünü + ara girdilerini + sonucunu açıkça döndürür.
export interface CalcStep {
  label: string; // örn. "P (güncel)"
  value: string; // formatlanmış değer
}

export interface AssetMethodResult {
  assetKey: string;
  assetName: string;
  ticker: string;
  steps: CalcStep[]; // ara girdiler/hesaplar (şeffaflık)
  result: string; // nihai değer (formatlı)
  resultRaw: number | null;
  signal?: Signal; // varsa AL/NAKİT
  highlight?: boolean; // örn. relative momentum kazananı
  note?: string;
}

export interface MethodResult {
  id: string;
  title: string; // TR başlık
  category: string; // gruplama (örn. "Trend / Absolute")
  bookRef: string; // kitap bölüm referansı
  formula: string; // okunabilir formül
  description: string; // ne yapar
  assets: AssetMethodResult[];
  summary: string; // genel yorum
  warnings?: string[];
}

// --- Backtest / metrik ---
export interface StrategyMetrics {
  name: string;
  annualReturnArith: number | null;
  cagr: number | null;
  annualVol: number | null;
  sharpe: number | null;
  maxDrawdown: number | null;
  pctProfitMonths: number | null;
  totalReturn: number | null;
  switchesPerYear?: number | null;
  timeInAsset?: Record<string, number>; // her varlıkta geçirilen zaman %
}

// Kümülatif büyüme eğrisi (1$ başlangıç) — equity curve
export interface EquityCurve {
  name: string;
  growth: number[]; // her ay sonu kümülatif çarpan (1.0'dan başlar)
  highlight?: boolean; // GEM stratejisi vurgusu
}

// GEM'in her ay tuttuğu pozisyon (varlık anahtarı veya "cash")
export interface PositionPoint {
  date: string; // realize getirinin ait olduğu ay (YYYY-MM-DD)
  key: string; // varlık anahtarı veya t-bill anahtarı
}

export interface BacktestResult {
  startDate: string;
  endDate: string;
  months: number;
  strategies: StrategyMetrics[]; // GEM + buy&hold benchmark'lar
  dates: string[]; // equity curve x-ekseni (YYYY-MM-DD)
  equityCurves: EquityCurve[]; // GEM + benchmark kümülatif büyüme
  timeline: PositionPoint[]; // GEM aylık pozisyon geçmişi
  note: string;
}

// --- GEM önerisi (çekirdek) ---
export interface GemRecommendation {
  relativeWinnerKey: string;
  relativeWinnerName: string;
  relativeWinnerRet12m: number;
  absolutePositive: boolean;
  positionKey: string; // varlık anahtarı veya "cash"
  positionName: string;
  rationale: string;
}

// --- Tüm analiz çıktısı ---
export interface AnalysisResult {
  generatedAt: string;
  lookbackMonths: number;
  tbill: { ticker: string; ret12m: number | null; currentPrice: number };
  gem: GemRecommendation;
  methods: MethodResult[]; // tüm yöntemler (şeffaf)
  backtest: BacktestResult | null;
  warnings: string[];
}
