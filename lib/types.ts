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
  sortino: number | null; // aşağı-yön riskine göre getiri
  skewness: number | null; // dağılım asimetrisi
  kurtosis: number | null; // fazla basıklık (fat tails)
  cvar5: number | null; // %5 CVaR (beklenen kuyruk kaybı, aylık)
  ulcerIndex?: number | null; // drawdown RMS (derinlik+süre "acı" ölçüsü)
  martinRatio?: number | null; // CAGR / UlcerIndex (acı-başına getiri)
  ddDurationMonths?: number | null; // max DD tepe→dip süre
  ddRecoveryMonths?: number | null; // dip→toparlanma süre (null = toparlanmadı)
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

// --- Sinyal panosu (varlık-bazlı özet) ---
export interface AssetSignal {
  key: string;
  name: string;
  ticker: string;
  ret12m: number | null; // 12 aylık total return
  excessVsTbill: number | null; // ret12m - T-Bill 12m (mutlak momentum girdisi)
  absolute: Signal | null; // LONG (excess>0) / CASH
  maAbove: boolean | null; // fiyat >= 12-ay SMA
  maGap: number | null; // fiyat/SMA - 1
  highProximity: number | null; // fiyat / 12-ay en yüksek (0..1)
  isGemWinner?: boolean; // göreceli momentum kazananı
}

export interface SignalBoard {
  tbillRet12m: number | null;
  assets: AssetSignal[];
}

// --- Look-back duyarlılık matrisi ---
export interface LookbackMatrix {
  windows: number[]; // geri-bakış pencereleri (ay), örn. [1,3,6,9,12]
  tbillRets: (number | null)[]; // her pencere için T-Bill getirisi (eşik)
  assets: {
    key: string;
    name: string;
    ticker: string;
    rets: (number | null)[]; // her pencere için total return
  }[];
}

// --- Hisse momentum panosu (bireysel hisse evreni) ---
export interface StockSignal {
  key: string;
  name: string;
  ticker: string;
  sector: string; // universe note
  ret12m: number | null;
  mom121?: number | null; // 12-1 momentum: son ayı atlayan getiri (Jegadeesh-Titman)
  excessVsTbill: number | null;
  absolute: Signal | null; // r₁₂ > T-Bill ?
  rank: number | null; // göreceli momentum sırası (1 = en güçlü)
  selected: boolean; // top-N içinde VE absolute pozitif
  highProximity: number | null; // fiyat / 12-ay zirve
  accelerating: boolean | null; // kuadratik kavis c>0
  quality?: number | null; // yol kalitesi: trailing 12-ay % pozitif ay (Gray-Vogel)
}

export interface StockMomentum {
  topN: number;
  tbillRet12m: number | null;
  stocks: StockSignal[]; // 12-ay getiriye göre azalan sıralı
}

// --- Earnings/Revenue momentum (temel veri, FMP — anahtar gerekir) ---
export interface EarningsSignal {
  key: string;
  name: string;
  ticker: string;
  revenueYoY: number | null; // son çeyrek geliri / 4 çeyrek önce − 1
  earningsYoY: number | null; // net kâr YoY
  rank: number | null; // birleşik momentum sırası
  selected: boolean; // top-N
}

export interface EarningsMomentum {
  enabled: boolean; // FMP anahtarı var mı
  reason?: string; // devre dışıysa açıklama
  note?: string; // etkinken bilgilendirme (örn. yıllık veri / kısmi veri)
  topN: number;
  stocks: EarningsSignal[];
}

// --- Genel evren paketi (hisse, kripto, ... — ETF dışı evrenler) ---
export interface UniverseBundle {
  id: string; // "stock" | "crypto" ...
  emoji: string; // sekme ikonu
  label: string; // sekme başlığı
  sublabel: string; // sekme alt-açıklaması
  positionLabel: string; // grafik başlıkları ("Hisse Momentum" / "Kripto Momentum")
  momentum: StockMomentum; // sıralama/seçim panosu
  signals: SignalBoard; // sinyal panosu
  lookback: LookbackMatrix; // look-back matrisi
  methods: MethodResult[]; // şeffaf yöntem kartları
  backtest: BacktestResult | null; // momentum rotasyon backtest'i
  factorAlpha: FactorAlpha | null; // Fama-French faktör alpha
  earnings?: EarningsMomentum; // sadece hisse evreninde
}

// --- Faktör-model alpha (Fama-French 3) ---
export interface FactorAlpha {
  source: string;
  nMonths: number;
  alphaMonthly: number; // aylık kesişim (ondalık)
  alphaAnnual: number; // (1+α)^12 − 1
  alphaTStat: number;
  betaMkt: number;
  betaSmb: number;
  betaHml: number;
  rSquared: number;
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
  signals: SignalBoard; // varlık-bazlı sinyal özeti
  lookback: LookbackMatrix; // look-back duyarlılık matrisi
  factorAlpha: FactorAlpha | null; // ETF GEM Fama-French 3 faktör alpha
  methods: MethodResult[]; // ETF tüm yöntemler (şeffaf)
  backtest: BacktestResult | null; // ETF GEM backtest
  universes: UniverseBundle[]; // ETF dışı evrenler (hisse, kripto, ...)
  composite: BacktestResult | null; // 4 evrenin eşit-ağırlık bileşik stratejisi
  compositeFactorAlpha?: FactorAlpha | null; // bileşik meta-strateji Fama-French alpha
  benchmark6040?: {
    // 60/40 (SPY/AGG) referans portföyü — bileşik ortak döneminde
    cagr: number;
    vol: number;
    sharpe: number | null;
    maxDrawdown: number;
    months: number;
    growth: number[]; // composite.dates ile hizalı birikimli büyüme (1$)
  } | null;
  warnings: string[];
  fromCache?: boolean; // sonuç sunucu önbelleğinden mi geldi
}
