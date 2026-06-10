# saidterzi — Dual Momentum Investing Projesi

Gary Antonacci'nin *Dual Momentum Investing: An Innovative Strategy for Higher Returns with Lower Risk* (McGraw-Hill, 2014) kitabına dayalı **GEM (Global Equities Momentum)** stratejisi: kapsam dokümanı + **canlı analiz web uygulaması**.

## 🚀 Canlı Uygulama (Next.js → Vercel)

Dual momentum'u **sekiz varlık evreninde** canlı hesaplayan dashboard:
**📊 ETF (GEM)** · **📈 Hisse** (24 büyük-cap) · **🪙 Kripto** (10 coin) · **🏭 Sektör** (11 SPDR / DMSR) · **🌍 Uluslararası** (8 bölgesel ETF) · **🛢️ Emtia** (8 reel-varlık ETF) · **🎛️ Faktör/Stil** (7 tek-faktör ETF: MTUM/VLUE/QUAL/USMV/SIZE/VUG/HDV) · **🏦 Tahvil** (7 sabit-getiri ETF: SHY/IEF/TLT/LQD/HYG/TIP/EMB).
Her evren aynı tam analiz paketini alır; üst sekmelerden geçilir. Tüm sleeve'ler ayrıca **eşit-ağırlık + risk-parity bileşik** meta-stratejide birleşir.

```bash
npm install
npm run dev      # http://localhost:3000
```

Deploy için → [`DEPLOY.md`](DEPLOY.md). Veri: Yahoo Finance (keyless). Çekirdek strateji: 12-ay look-back, T-Bill eşikli dual momentum (göreceli + mutlak). Sinyal `t`-sonu, getiri `t+1` (lookahead-bias yok). Sonuçlar 10 dk sunucu önbelleğinde tutulur.

### Veri Kaynakları

| Kaynak | Anahtar | Kullanım |
|--------|---------|----------|
| **Yahoo Finance** (v8 chart) | Yok | Fiyat/total-return serileri (8 evren: ETF, hisse, kripto, sektör, uluslararası, emtia, faktör, tahvil) — aylık normalize |
| **Ken French Data Library** | Yok | Fama-French 3 faktör → faktör-model alpha (`lib/factors.ts`, ZIP doğrudan çekilir) |
| **Financial Modeling Prep** (FMP) | **Opsiyonel** | Earnings/revenue momentum (çeyreklik gelir+net kâr). `FMP_API_KEY` env ile etkinleşir |

**Earnings momentum'u açmak için:** [financialmodelingprep.com](https://site.financialmodelingprep.com/developer/docs) ücretsiz anahtar al → Vercel → Settings → Environment Variables → `FMP_API_KEY` ekle → redeploy. Anahtar yoksa uygulama bu paneli "kapalı" gösterir, geri kalan her şey çalışır.

| Yol | İçerik |
|-----|--------|
| `app/` | Next.js App Router — `page.tsx` (dashboard + tüm görseller) · `api/analysis/` (tam analiz, 10 dk cache) · `api/backtest/` (hafif etkileşimli backtest) · `api/robustness/` (look-back × top-N Sharpe/CAGR dayanıklılık grid'i) |
| `lib/` | `yahoo.ts` (veri çekme + aylık normalizasyon) · `calc.ts` (formül-belgeli finansal primitifler) · `universe.ts` (8 evren + parametreler) · `methods.ts` (şeffaf yöntem hesaplayıcıları + evren-bağımsız pano/momentum üreticileri) · `backtest.ts` (momentum rotasyon simülasyonu + işlem maliyeti) · `factors.ts` (Fama-French OLS alpha) · `fundamentals.ts` (FMP earnings) · `concurrency.ts` (eşzamanlılık-sınırlı fetch, rate-limit koruması) · `zip.ts` (bağımlılıksız ZIP okuyucu) · `types.ts` |

### Dashboard ne gösterir

**Genel bakış (en üst):**
- **⚡ Öne Çıkanlar:** otomatik içgörüler — en yüksek Sharpe stratejisi, bileşik büyümesi, savunma duruşu, en iyi çeşitlendirici, **piyasa genişliği** (pozitif momentumlu varlık oranı = risk-on/off).
- **Bu Ayın Sinyalleri:** 8 evrenin güncel pozisyonları tek bakışta + **sinyal kırılganlığı** (T-Bill eşiğine pay, ince payda nakde dönme uyarısı).
- **🎛️ Backtest Stüdyosu:** etkileşimli — *evren × look-back (1–24 ay) × top-N × işlem maliyeti (bps)*; tam grafik paketi + momentum-vs-benchmark farkı anında güncellenir (titremesiz, URL'de paylaşılabilir).
- **Strateji Karşılaştırma:** tüm stratejiler **sıralanabilir** tabloda (CAGR/Sharpe/Sortino/MaxDD/getiri/devir); "Momentum Al-Tut'u Yeniyor mu?" tablosu — CAGR/Sharpe farkı + **Bilgi Oranı (IR)** + **aylık fark t-stat (istatistiksel anlamlılık)**; **ortak-dönem overlay** + **evrenler-arası risk–getiri dağılımı** (adil kıyas, çeşitlendirme görsel kanıtı).
- **🧪 Özel Bileşik Oluşturucu:** sleeve'leri aç/kapat → eşit-ağırlık bileşik **ortak dönemde anında** yeniden hesaplanır (CAGR/Vol/MaxDD/Calmar + canlı büyüme eğrisi); "kriptoyu çıkarırsam ne olur?" keşfi.
- **🧯 Parametre Dayanıklılık Haritası:** look-back × top-N Sharpe/CAGR ısı haritası (aşırı-uyum testi) + Dayanıklı/Orta/Kırılgan verdikti · **🪟 Çok-Pencereli Ensemble:** 3/6/9/12-ay look-back'lerin eşit-ağırlık harmanı (Hoffstein 2019 "rebalance timing luck" azaltımı — tek pencere seçim şansını törpüler).
- **🧩 Dual Momentum Bileşik:** 8 evrenin **eşit-ağırlık + risk-parity** meta-stratejisi — güncel duruş, **"bu ay al" listesi (CSV)**, **pasif al-tut benchmark karşılaştırması**, getiri atfı, risk-parity ağırlıkları, çeşitlendirme faydası, korelasyon matrisi, drawdown epizodları, **kriz stres testi** ve **blok-bootstrap risk dağılımı**.

**Her evren sekmesinde (ETF/Hisse/Kripto/Sektör/Uluslararası/Emtia/Faktör/Tahvil):**
- **Headline stat şeridi** (CAGR/Sharpe/Sortino/MaxDD) + **sinyal panosu** (sıralanabilir, **yol-kalitesi** sütunu = trailing 12-ay % pozitif ay, Gray–Vogel 2016) + momentum sıralaması + **look-back duyarlılık matrisi**.
- **Görsel analiz** (katlanabilir, paylaşılan `BacktestCharts`): equity curve (log) · pozisyon bandı · drawdown (underwater) + **en kötü 5 epizod** · aylık ısı haritası · **takvim-yılı getirileri (strateji vs benchmark)** · **kriz stres testi** (2008/2020/2022 vb.) · **blok-bootstrap risk dağılımı** · **yarı-dönem tutarlılık** (örneklem-dışı kenar-kalıcılığı) · **vol-hedefli versiyon** (oynaklık-yönetimli momentum, Barroso–Santa-Clara) · risk–getiri · 12-ay rolling getiri & **volatilite** & **Sharpe** & **göreli performans (+ vuruş ortalaması)** · getiri scatter · **yukarı/aşağı yakalama** · box plot · **getiri histogramı (normal eğri bindirmeli)** · **mevsimsellik**.
- **Risk metrikleri:** CAGR, vol, Sharpe, Sortino, **Calmar**, **Ulcer Index**, **Martin oranı**, çarpıklık, basıklık, CVaR, max drawdown (derinlik+süre+toparlanma), % kârlı ay.
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
| 10 | `10-literatur-ve-kaynaklar.md` | Annotated bibliography — momentum/trend literatürünün en iyi kaynakları, her biri uygulamaya bağlı (✅/🟡/⬜) + yol haritası |

## ⚡ GEM — 30 Saniyede

Her ay sonu, son **12 aylık total return**'e bak:
1. S&P 500 vs ACWI ex-US → güçlü olanı seç.
2. Seçilen endeks T-Bill'i geçiyorsa → o hisseye %100; geçmiyorsa → Aggregate Bond'a %100.

**40 yıl (1974–2013):** Yıllık ~%17.4, Sharpe ~0.87, Max DD ~−%22.7 (vs ACWI −%60).

## ⚠️ Telif Notu

Kitabın orijinal metni, EPUB dosyası ve ondan çıkarılan ham bölüm/görseller bu depoya **dahil edilmez** (`.gitignore`). Bu depo yalnızca kendi sentez/analiz çalışmamızı ve kodu içerir.

## 📚 Kaynak

Antonacci, Gary. *Dual Momentum Investing: An Innovative Strategy for Higher Returns with Lower Risk.* McGraw-Hill, 2014. ISBN 0071849440. — optimalmomentum.com
