# saidterzi — Dual Momentum Investing Projesi

Gary Antonacci'nin *Dual Momentum Investing: An Innovative Strategy for Higher Returns with Lower Risk* (McGraw-Hill, 2014) kitabına dayalı **GEM (Global Equities Momentum)** stratejisi: kapsam dokümanı + **canlı analiz web uygulaması**.

## 🚀 Canlı Uygulama (Next.js → Vercel)

Dual momentum'u **dört varlık evreninde** canlı hesaplayan dashboard:
**📊 ETF (GEM)** · **📈 Hisse** (24 büyük-cap) · **🪙 Kripto** (10 coin) · **🏭 Sektör** (11 SPDR / DMSR).
Her evren aynı tam analiz paketini alır; üst sekmelerden geçilir.

```bash
npm install
npm run dev      # http://localhost:3000
```

Deploy için → [`DEPLOY.md`](DEPLOY.md). Veri: Yahoo Finance (keyless). Çekirdek strateji: 12-ay look-back, T-Bill eşikli dual momentum (göreceli + mutlak). Sinyal `t`-sonu, getiri `t+1` (lookahead-bias yok). Sonuçlar 10 dk sunucu önbelleğinde tutulur.

### Veri Kaynakları

| Kaynak | Anahtar | Kullanım |
|--------|---------|----------|
| **Yahoo Finance** (v8 chart) | Yok | Fiyat/total-return serileri (4 evren: ETF, hisse, kripto, sektör) — aylık normalize |
| **Ken French Data Library** | Yok | Fama-French 3 faktör → faktör-model alpha (`lib/factors.ts`, ZIP doğrudan çekilir) |
| **Financial Modeling Prep** (FMP) | **Opsiyonel** | Earnings/revenue momentum (çeyreklik gelir+net kâr). `FMP_API_KEY` env ile etkinleşir |

**Earnings momentum'u açmak için:** [financialmodelingprep.com](https://site.financialmodelingprep.com/developer/docs) ücretsiz anahtar al → Vercel → Settings → Environment Variables → `FMP_API_KEY` ekle → redeploy. Anahtar yoksa uygulama bu paneli "kapalı" gösterir, geri kalan her şey çalışır.

| Yol | İçerik |
|-----|--------|
| `app/` | Next.js App Router — `page.tsx` (dashboard + tüm görseller) · `api/analysis/` (tam analiz, 10 dk cache) · `api/backtest/` (hafif etkileşimli backtest) |
| `lib/` | `yahoo.ts` (veri çekme + aylık normalizasyon) · `calc.ts` (formül-belgeli finansal primitifler) · `universe.ts` (4 evren + parametreler) · `methods.ts` (şeffaf yöntem hesaplayıcıları + evren-bağımsız pano/momentum üreticileri) · `backtest.ts` (momentum rotasyon simülasyonu + işlem maliyeti) · `factors.ts` (Fama-French OLS alpha) · `fundamentals.ts` (FMP earnings) · `zip.ts` (bağımlılıksız ZIP okuyucu) · `types.ts` |

### Dashboard ne gösterir

**Genel bakış (en üst):**
- **⚡ Öne Çıkanlar:** otomatik içgörüler — en yüksek Sharpe stratejisi, bileşik büyümesi, savunma duruşu, en iyi çeşitlendirici, **piyasa genişliği** (pozitif momentumlu varlık oranı = risk-on/off).
- **Bu Ayın Sinyalleri:** 5 evrenin güncel pozisyonları tek bakışta.
- **🎛️ Backtest Stüdyosu:** etkileşimli — *evren × look-back (1–24 ay) × top-N × işlem maliyeti (bps)*; tam grafik paketi + momentum-vs-benchmark farkı anında güncellenir (titremesiz, URL'de paylaşılabilir).
- **Strateji Karşılaştırma:** tüm stratejiler **sıralanabilir** tabloda (CAGR/Sharpe/Sortino/MaxDD/getiri/devir); "Momentum Al-Tut'u Yeniyor mu?" tablosu + ortalama satırı; **ortak-dönem overlay** (adil kıyas).
- **🧩 Dual Momentum Bileşik:** 5 evrenin **eşit-ağırlık + risk-parity** meta-stratejisi — güncel duruş, **"bu ay al" listesi (CSV)**, getiri atfı, risk-parity ağırlıkları, çeşitlendirme faydası, korelasyon matrisi, drawdown epizodları.

**Her evren sekmesinde (ETF/Hisse/Kripto/Sektör/Uluslararası):**
- **Headline stat şeridi** (CAGR/Sharpe/Sortino/MaxDD) + **sinyal panosu** (sıralanabilir) + momentum sıralaması + **look-back duyarlılık matrisi**.
- **Görsel analiz** (katlanabilir): equity curve (log) · pozisyon bandı · drawdown (underwater) + **en kötü 5 epizod** · aylık ısı haritası · risk–getiri · 12-ay rolling getiri & **volatilite** & **göreli performans** · getiri scatter · **yukarı/aşağı yakalama** · box plot · **mevsimsellik**.
- **Risk metrikleri:** CAGR, vol, Sharpe, Sortino, **Calmar**, çarpıklık, basıklık, CVaR, max drawdown (derinlik+süre+toparlanma), % kârlı ay.
- **Fama-French faktör alpha** (alpha, market/size/value beta, R²) + **şeffaf yöntem kartları** (trailing, relative, absolute, MA, trend-line t-stat, 52-hafta, hızlanan, taze/bayat, trend salience, risk parity; ETF'de ayrıca GBM, DMSR, GEM).
- **Earnings/Revenue momentum:** (hisse evreni, FMP anahtarı ile) yıllık gelir+net kâr YoY büyümesi.

Tüm çıktılar **JSON/CSV** olarak indirilebilir; sonuçlar **10 dk sunucu önbelleğinde**, sayfa mobil-uyumlu ve erişilebilir (ARIA), hata-izolasyonlu (ErrorBoundary).

## 📂 Yapı

| Klasör/Dosya | İçerik |
|--------------|--------|
| `app/`, `lib/` | Canlı analiz web uygulaması (Next.js/TypeScript) |
| [`dual-momentum-kapsam/`](dual-momentum-kapsam/) | Kitabın tüm teknik içeriğinin kapsam dokümanı (TR + İng. terimli). Hem referans arşivi hem kodlanabilir spesifikasyon. |
| [`DEPLOY.md`](DEPLOY.md) | Vercel deploy rehberi |

## 📖 Kapsam Dokümanı Haritası

Başlangıç noktası: **[`dual-momentum-kapsam/00-INDEX.md`](dual-momentum-kapsam/00-INDEX.md)**

| # | Dosya | İçerik |
|---|-------|--------|
| 00 | `00-INDEX.md` | Genel harita, okuma rehberi, 30 saniyede strateji |
| 01 | `01-cekirdek-strateji-GEM.md` | ⭐ GEM modelinin tam spesifikasyonu |
| 02 | `02-kavramsal-temeller.md` | ⭐ Relative/Absolute/Dual momentum, neden çalışır |
| 03 | `03-varlik-secimi-ve-veri.md` | Varlık evreni, endeks/ETF eşlemeleri, veri kaynakları |
| 04 | `04-risk-ve-metrikler.md` | Sharpe, drawdown, değerlendirme araçları |
| 05 | `05-backtest-sonuclari.md` | Kitaptan birebir tüm sayısal tablolar (doğrulama hedefleri) |
| 06 | `06-varyasyonlar.md` | GBM, DMSR, kaldıraç, momentum geliştirmeleri |
| 07 | `07-akademik-arkaplan.md` | MPT/EMH eleştirisi, momentum tarihi, davranışsal temeller |
| 08 | `08-terimce.md` | Sözlük (TR + EN) |
| 09 | `09-implementasyon-spec.md` | ⭐ Python implementasyon planı, pseudo-code, edge-case'ler |

## ⚡ GEM — 30 Saniyede

Her ay sonu, son **12 aylık total return**'e bak:
1. S&P 500 vs ACWI ex-US → güçlü olanı seç.
2. Seçilen endeks T-Bill'i geçiyorsa → o hisseye %100; geçmiyorsa → Aggregate Bond'a %100.

**40 yıl (1974–2013):** Yıllık ~%17.4, Sharpe ~0.87, Max DD ~−%22.7 (vs ACWI −%60).

## ⚠️ Telif Notu

Kitabın orijinal metni, EPUB dosyası ve ondan çıkarılan ham bölüm/görseller bu depoya **dahil edilmez** (`.gitignore`). Bu depo yalnızca kendi sentez/analiz çalışmamızı ve kodu içerir.

## 📚 Kaynak

Antonacci, Gary. *Dual Momentum Investing: An Innovative Strategy for Higher Returns with Lower Risk.* McGraw-Hill, 2014. ISBN 0071849440. — optimalmomentum.com
