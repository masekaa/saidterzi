# saidterzi — Dual Momentum Investing Projesi

Gary Antonacci'nin *Dual Momentum Investing: An Innovative Strategy for Higher Returns with Lower Risk* (McGraw-Hill, 2014) kitabına dayalı **GEM (Global Equities Momentum)** stratejisi: kapsam dokümanı + **canlı analiz web uygulaması**.

## 🚀 Canlı Uygulama (Next.js → Vercel)

Altın · S&P 500 · NASDAQ için anlık dual momentum analizi yapan dashboard.

```bash
npm install
npm run dev      # http://localhost:3000
```

Deploy için → [`DEPLOY.md`](DEPLOY.md). Veri: Yahoo Finance (keyless). Strateji: 12-ay look-back, T-Bill eşikli GEM rotasyonu + varlık-bazlı sinyaller.

| Yol | İçerik |
|-----|--------|
| `app/` | Next.js App Router — `page.tsx` (dashboard), `api/analysis/` (serverless route) |
| `lib/` | `yahoo.ts` (veri çekme), `momentum.ts` (GEM/dual momentum hesabı), `types.ts` |

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
