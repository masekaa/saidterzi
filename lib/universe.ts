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
    AGG,
  ].forEach((i) => set.add(i.ticker));
  return Array.from(set);
}

export const LOOKBACK_MONTHS = 12;
export const LOOKBACK_VARIANTS = [1, 3, 6, 9, 12]; // robustluk testi
export const MA_LENGTHS = [10, 12]; // hareketli ortalama uzunlukları (ay)
export const DMSR_TOP_N = 3; // DMSR'de seçilecek sektör sayısı (parametre)
