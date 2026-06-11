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

// --- Uluslararası / bölgesel evren (GEM'in ABD-vs-dünya fikrinin genellemesi) ---
// Bölgesel hisse ETF'leri arası dual momentum rotasyonu. Hepsi uzun geçmişli.
export const INTL_UNIVERSE: Instrument[] = [
  { key: "us", name: "ABD", ticker: "SPY", note: "S&P 500" },
  { key: "efa", name: "Gelişmiş (ABD hariç)", ticker: "EFA", note: "EAFE" },
  { key: "eem", name: "Gelişmekte Olan", ticker: "EEM", note: "Emerging" },
  { key: "vgk", name: "Avrupa", ticker: "VGK", note: "FTSE Europe" },
  { key: "ewj", name: "Japonya", ticker: "EWJ", note: "MSCI Japan" },
  { key: "vpl", name: "Pasifik", ticker: "VPL", note: "Developed Pacific" },
  { key: "ilf", name: "Latin Amerika", ticker: "ILF", note: "S&P Latin America 40" },
  { key: "mchi", name: "Çin", ticker: "MCHI", note: "MSCI China" },
];
export const INTL_TOP_N = 3;

// --- Emtia / reel-varlık evreni ---
// Emtialar momentumun en güçlü çalıştığı sınıflardandır (Erb-Harvey 2006,
// Moskowitz-Ooi-Pedersen 2012). Likit, uzun geçmişli ETF'ler arası dual
// momentum rotasyonu. Hisse/kripto/sektörle düşük korelasyon → çeşitlendirici.
export const COMMODITIES_UNIVERSE: Instrument[] = [
  { key: "gld", name: "Altın", ticker: "GLD", note: "Spot altın" },
  { key: "slv", name: "Gümüş", ticker: "SLV", note: "Spot gümüş" },
  { key: "dbc", name: "Geniş Emtia", ticker: "DBC", note: "Çeşitlendirilmiş sepet" },
  { key: "dba", name: "Tarım", ticker: "DBA", note: "Tarım ürünleri" },
  { key: "uso", name: "Ham Petrol", ticker: "USO", note: "WTI petrol" },
  { key: "ung", name: "Doğalgaz", ticker: "UNG", note: "Henry Hub gaz" },
  { key: "gdx", name: "Altın Madencileri", ticker: "GDX", note: "Madenci hisseleri" },
  { key: "dbb", name: "Baz Metaller", ticker: "DBB", note: "Bakır/çinko/alüminyum" },
];
export const COMMODITIES_TOP_N = 3;

// --- Faktör / stil rotasyonu evreni ---
// Faktör momentumu (Gupta-Kelly 2019, Arnott et al.): hangi faktör primi
// güçlüyse ona dön. Tek-faktör ETF'leri arası dual momentum; sektör/bölge
// rotasyonundan farklı bir alfa kaynağı (stil zamanlaması).
export const FACTOR_UNIVERSE: Instrument[] = [
  { key: "mtum", name: "Momentum", ticker: "MTUM", note: "iShares MSCI USA Momentum" },
  { key: "vlue", name: "Değer", ticker: "VLUE", note: "iShares MSCI USA Value" },
  { key: "qual", name: "Kalite", ticker: "QUAL", note: "iShares MSCI USA Quality" },
  { key: "usmv", name: "Düşük Volatilite", ticker: "USMV", note: "iShares Min Vol USA" },
  { key: "size", name: "Boyut (Small)", ticker: "SIZE", note: "iShares MSCI USA Size" },
  { key: "vug", name: "Büyüme", ticker: "VUG", note: "Vanguard Growth" },
  { key: "hdv", name: "Temettü", ticker: "HDV", note: "iShares Core High Dividend" },
];
export const FACTOR_TOP_N = 2;

// --- Tahvil / sabit-getiri evreni ---
// Tahvil momentumu: getiri eğrisi (kısa↔uzun vade) ve kredi spektrumu (devlet↔
// yüksek-getiri) arası rotasyon. Hisse/emtiadan farklı bir varlık sınıfı →
// bileşiğe düşük-korelasyonlu, savunmacı bir sleeve ekler (çeşitlendirme).
export const BOND_UNIVERSE: Instrument[] = [
  { key: "shy", name: "Kısa Vade Tahvil", ticker: "SHY", note: "1-3 yıl ABD Hazine" },
  { key: "ief", name: "Orta Vade Tahvil", ticker: "IEF", note: "7-10 yıl ABD Hazine" },
  { key: "tlt", name: "Uzun Vade Tahvil", ticker: "TLT", note: "20+ yıl ABD Hazine" },
  { key: "lqd", name: "Yatırım Sınıfı Tahvil", ticker: "LQD", note: "IG şirket tahvili" },
  { key: "hyg", name: "Yüksek Getiri", ticker: "HYG", note: "High-yield şirket" },
  { key: "tip", name: "Enflasyon Korumalı", ticker: "TIP", note: "TIPS" },
  { key: "emb", name: "Gelişmekte Olan Tahvil", ticker: "EMB", note: "EM dolar tahvili" },
];
export const BOND_TOP_N = 2;

// --- Varlık-sınıfı / çapraz-varlık evreni (saf GTAA / dual momentum çekirdeği) ---
// Faber'in GTAA'sı ve Antonacci'nin dual momentum fikrinin en saf ifadesi: ana
// VARLIK SINIFLARI arası rotasyon (hisse, tahvil, altın, emtia, gayrimenkul).
// Her sleeve farklı bir makro rejimde lider olur (büyüme→hisse, deflasyon→uzun
// Hazine, enflasyon→altın/emtia) → momentum lideri takip eder. Likit, uzun-
// geçmişli ETF'ler; ortak geçmiş ~2006 (DBC) ile başlar.
export const ASSET_CLASS_UNIVERSE: Instrument[] = [
  { key: "acus", name: "ABD Hisse", ticker: "SPY", note: "S&P 500" },
  { key: "acintl", name: "Uluslararası Hisse", ticker: "EFA", note: "EAFE gelişmiş" },
  { key: "acem", name: "Gelişmekte Olan Hisse", ticker: "EEM", note: "Emerging" },
  { key: "acbond", name: "Tahvil", ticker: "AGG", note: "ABD geniş tahvil" },
  { key: "actlt", name: "Uzun Hazine", ticker: "TLT", note: "20+ yıl (deflasyon korunağı)" },
  { key: "acgld", name: "Altın", ticker: "GLD", note: "Spot altın" },
  { key: "accmd", name: "Emtia", ticker: "DBC", note: "Geniş sepet (enflasyon korunağı)" },
  { key: "acreit", name: "Gayrimenkul", ticker: "VNQ", note: "ABD REIT" },
];
export const ASSET_CLASS_TOP_N = 3;

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
    ...INTL_UNIVERSE,
    ...COMMODITIES_UNIVERSE,
    ...FACTOR_UNIVERSE,
    ...BOND_UNIVERSE,
    ...ASSET_CLASS_UNIVERSE,
    AGG,
  ].forEach((i) => set.add(i.ticker));
  return Array.from(set);
}

export const LOOKBACK_MONTHS = 12;
export const LOOKBACK_VARIANTS = [1, 3, 6, 9, 12]; // robustluk testi
export const MA_LENGTHS = [10, 12]; // hareketli ortalama uzunlukları (ay)
export const DMSR_TOP_N = 3; // DMSR'de seçilecek sektör sayısı (parametre)
