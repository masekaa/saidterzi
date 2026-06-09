# Vercel'e Deploy Rehberi

Bu uygulama **Next.js 14 (App Router)** — Vercel'in yerel framework'ü. Ekstra konfigürasyon gerekmez. Fiyat verisi (Yahoo) ve Fama-French faktörleri (Ken French) **anahtarsızdır**; yalnızca opsiyonel earnings/revenue momentum paneli için bir FMP anahtarı gerekir (aşağıya bak).

## Yöntem 1 — GitHub + Vercel Dashboard (Önerilen, en kolay)

1. Kod zaten GitHub'da: `github.com/masekaa/saidterzi` (main dalı).
2. [vercel.com/new](https://vercel.com/new) → **Import Git Repository**.
3. `masekaa/saidterzi` reposunu seç.
4. Ayarlar otomatik algılanır:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (repo kökü)
   - **Build Command:** `next build` (otomatik)
   - **Output:** otomatik
   - **Environment Variables:** Zorunlu değil. (Opsiyonel: earnings momentum için `FMP_API_KEY`.)
5. **Deploy**'a bas. ~1-2 dakikada canlı URL hazır (`saidterzi.vercel.app` benzeri).

> Her `git push` sonrası Vercel otomatik yeniden deploy eder (CI/CD).

## Opsiyonel — Earnings/Revenue Momentum (FMP)

Hisse evrenindeki earnings/revenue momentum paneli, [financialmodelingprep.com](https://site.financialmodelingprep.com/developer/docs) ücretsiz anahtarıyla etkinleşir (yıllık gelir+net kâr; ücretsiz katman çeyrekliği desteklemez):

1. FMP'den ücretsiz API anahtarı al (250 istek/gün).
2. Vercel → proje → **Settings → Environment Variables** → `FMP_API_KEY` = anahtarın → **Save**.
3. **Redeploy** et. Anahtar yoksa panel "kapalı" görünür, geri kalan her şey çalışır.

## Yöntem 2 — Vercel CLI

```bash
npm i -g vercel
vercel login          # tarayıcıda giriş (interaktif)
cd E:\invest
vercel                # ilk deploy (preview)
vercel --prod         # production deploy
```

> CLI girişi interaktiftir. Bu oturumda çalıştırmak için Claude Code'da `! vercel login` yazabilirsin.

## Yerel Test

```bash
npm install
npm run dev           # http://localhost:3000
# veya production build testi:
npm run build && npm start
```

## Notlar

- **Veri tazeliği & önbellek:** `/api/analysis` ~80 sembol (8 evren + çekirdek + tahvil) + Ken French + (varsa) FMP çeker; sonuç sunucu-içi **10 dk önbellekte** tutulur (Yahoo rate-limit + hız). "Yenile" butonu `?refresh=1` ile önbelleği atlar. Fetch'ler **eşzamanlılık-sınırlı** (`lib/concurrency.ts`, en çok 12 paralel istek) — Yahoo 429 riskini azaltır. Fonksiyon süresi `maxDuration=60` ile uzatıldı.
- **Diğer route'lar:** `/api/backtest` (hafif etkileşimli backtest, `maxDuration=30`, 10 dk cache) ve `/api/robustness` (look-back × top-N dayanıklılık grid'i, `maxDuration=45`, 10 dk cache) — her ikisi de yalnız seçilen evreni çeker, on-demand çalışır.
- **Yahoo güvenilirliği:** Resmi olmayan endpoint; nadiren 403/değişiklik olabilir. UI hata durumunda "Yenile" ile tekrar dener. İleride dayanıklılık için ikinci bir kaynak (Stooq/Alpha Vantage) fallback eklenebilir.
- **Bölge:** Yahoo bazı IP bölgelerinde farklı davranabilir. Sorun olursa `vercel.json` ile function region (örn. `iad1`) sabitlenebilir.
- **Rate limit:** 10 dk sunucu önbelleği sayesinde yüksek trafikte bile Yahoo'ya tekrar istek atılmaz; tek kullanıcı için zaten sorun yok.
