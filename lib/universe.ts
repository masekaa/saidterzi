// universe.ts — Varlık evreni tanımları.
// Tüm semboller ETF; Yahoo adjusted close = total return (temettü/faiz dahil).

export interface Instrument {
  key: string;
  name: string;
  ticker: string;
  note?: string;
}

// --- Çekirdek 3-varlık (GEM rotasyonu + yöntemler + backtest) ---
export const CORE_ASSETS: Instrument[] = [
  { key: "spy", name: "S&P 500", ticker: "SPY", note: "ABD büyük-cap" },
  { key: "qqq", name: "NASDAQ-100", ticker: "QQQ", note: "Teknoloji ağırlıklı" },
  { key: "gld", name: "Altın", ticker: "GLD", note: "Altın spot" },
];

// Risksiz faiz / nakit (absolute momentum eşiği + Sharpe rf)
export const TBILL: Instrument = {
  key: "bil",
  name: "T-Bill (1-3 ay)",
  ticker: "BIL",
  note: "Risksiz faiz / nakit",
};

// --- GBM tahvil evreni (Global Balanced Momentum'un sabit-getiri tarafı) ---
// Kitap: Long Treasury, Global Government, High Yield, T-Bill.
// ETF eşlemesi (yaklaşık):
export const GBM_BONDS: Instrument[] = [
  { key: "tlt", name: "Uzun Vadeli Hazine", ticker: "TLT", note: "20+ yıl ABD Hazine" },
  { key: "ief", name: "Orta Vadeli Hazine", ticker: "IEF", note: "7-10 yıl ABD Hazine" },
  { key: "hyg", name: "Yüksek Getirili Tahvil", ticker: "HYG", note: "High yield kurumsal" },
  { key: "bil", name: "T-Bill", ticker: "BIL", note: "90 gün ABD Hazine" },
];

// --- DMSR sektör evreni (Dual Momentum Sector Rotation) ---
// 11 SPDR Select Sector ETF (Morningstar 11 sektörüne karşılık gelir).
export const DMSR_SECTORS: Instrument[] = [
  { key: "xlk", name: "Teknoloji", ticker: "XLK" },
  { key: "xli", name: "Sanayi", ticker: "XLI" },
  { key: "xle", name: "Enerji", ticker: "XLE" },
  { key: "xlc", name: "İletişim", ticker: "XLC", note: "2018'den beri" },
  { key: "xlre", name: "Gayrimenkul", ticker: "XLRE", note: "2015'ten beri" },
  { key: "xlf", name: "Finans", ticker: "XLF" },
  { key: "xly", name: "Tüketici Döngüsel", ticker: "XLY" },
  { key: "xlb", name: "Temel Materyaller", ticker: "XLB" },
  { key: "xlu", name: "Kamu Hizmetleri", ticker: "XLU" },
  { key: "xlp", name: "Tüketici Defansif", ticker: "XLP" },
  { key: "xlv", name: "Sağlık", ticker: "XLV" },
];

// --- Hisse evreni (bireysel hisse momentumu) ---
// Sektörel olarak çeşitlendirilmiş ~24 büyük-cap ABD hissesi. Relative momentum
// bu evren içinde sıralama yapar; absolute momentum T-Bill eşiğini uygular.
// Kitap: 06 §2 (bireysel hisse momentumu) — earnings/revenue momentum buraya uygulanır.
export const STOCK_UNIVERSE: Instrument[] = [
  { key: "aapl", name: "Apple", ticker: "AAPL", note: "Teknoloji" },
  { key: "msft", name: "Microsoft", ticker: "MSFT", note: "Teknoloji" },
  { key: "nvda", name: "NVIDIA", ticker: "NVDA", note: "Yarı iletken" },
  { key: "amzn", name: "Amazon", ticker: "AMZN", note: "Tüketici/Bulut" },
  { key: "googl", name: "Alphabet", ticker: "GOOGL", note: "İletişim" },
  { key: "meta", name: "Meta", ticker: "META", note: "İletişim" },
  { key: "tsla", name: "Tesla", ticker: "TSLA", note: "Otomotiv" },
  { key: "avgo", name: "Broadcom", ticker: "AVGO", note: "Yarı iletken" },
  { key: "amd", name: "AMD", ticker: "AMD", note: "Yarı iletken" },
  { key: "nflx", name: "Netflix", ticker: "NFLX", note: "İletişim" },
  { key: "crm", name: "Salesforce", ticker: "CRM", note: "Yazılım" },
  { key: "jpm", name: "JPMorgan", ticker: "JPM", note: "Finans" },
  { key: "v", name: "Visa", ticker: "V", note: "Finans/Ödeme" },
  { key: "ma", name: "Mastercard", ticker: "MA", note: "Finans/Ödeme" },
  { key: "unh", name: "UnitedHealth", ticker: "UNH", note: "Sağlık" },
  { key: "jnj", name: "Johnson & Johnson", ticker: "JNJ", note: "Sağlık" },
  { key: "lly", name: "Eli Lilly", ticker: "LLY", note: "İlaç" },
  { key: "xom", name: "ExxonMobil", ticker: "XOM", note: "Enerji" },
  { key: "cvx", name: "Chevron", ticker: "CVX", note: "Enerji" },
  { key: "wmt", name: "Walmart", ticker: "WMT", note: "Perakende" },
  { key: "cost", name: "Costco", ticker: "COST", note: "Perakende" },
  { key: "pg", name: "Procter & Gamble", ticker: "PG", note: "Tüketici defansif" },
  { key: "ko", name: "Coca-Cola", ticker: "KO", note: "Tüketici defansif" },
  { key: "hd", name: "Home Depot", ticker: "HD", note: "Tüketici döngüsel" },
];
export const STOCK_TOP_N = 5; // relative momentum'da seçilecek hisse sayısı

// --- Kripto evreni (Yahoo -USD sembolleri, keyless) ---
// Sinyal/yöntemler tüm coinler için bağımsız hesaplanır; backtest ortak
// geçmişle kısıtlıdır (en genç coin başlangıcı belirler).
export const CRYPTO_UNIVERSE: Instrument[] = [
  { key: "btc", name: "Bitcoin", ticker: "BTC-USD", note: "L1" },
  { key: "eth", name: "Ethereum", ticker: "ETH-USD", note: "L1 / akıllı sözleşme" },
  { key: "bnb", name: "BNB", ticker: "BNB-USD", note: "Exchange / L1" },
  { key: "sol", name: "Solana", ticker: "SOL-USD", note: "L1" },
  { key: "xrp", name: "XRP", ticker: "XRP-USD", note: "Ödeme" },
  { key: "ada", name: "Cardano", ticker: "ADA-USD", note: "L1" },
  { key: "doge", name: "Dogecoin", ticker: "DOGE-USD", note: "Meme" },
  { key: "avax", name: "Avalanche", ticker: "AVAX-USD", note: "L1" },
  { key: "link", name: "Chainlink", ticker: "LINK-USD", note: "Oracle" },
  { key: "dot", name: "Polkadot", ticker: "DOT-USD", note: "L0 / interop" },
];
export const CRYPTO_TOP_N = 3;

// DMSR güvenli liman + trend referansı
export const AGG: Instrument = {
  key: "agg",
  name: "Aggregate Bond",
  ticker: "AGG",
  note: "ABD geniş tahvil (güvenli liman)",
};

// Çekilecek tüm benzersiz semboller
export function allTickers(): string[] {
  const set = new Set<string>();
  [
    ...CORE_ASSETS,
    TBILL,
    ...GBM_BONDS,
    ...DMSR_SECTORS,
    ...STOCK_UNIVERSE,
    ...CRYPTO_UNIVERSE,
    AGG,
  ].forEach((i) => set.add(i.ticker));
  return Array.from(set);
}

export const LOOKBACK_MONTHS = 12;
export const LOOKBACK_VARIANTS = [1, 3, 6, 9, 12]; // robustluk testi
export const MA_LENGTHS = [10, 12]; // hareketli ortalama uzunlukları (ay)
export const DMSR_TOP_N = 3; // DMSR'de seçilecek sektör sayısı (parametre)
