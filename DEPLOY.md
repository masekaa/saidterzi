# Vercel'e Deploy Rehberi

Bu uygulama **Next.js 14 (App Router)** — Vercel'in yerel framework'ü. Ekstra konfigürasyon gerekmez, API anahtarı yoktur (Yahoo Finance keyless).

## Yöntem 1 — GitHub + Vercel Dashboard (Önerilen, en kolay)

1. Kod zaten GitHub'da: `github.com/masekaa/saidterzi` (main dalı).
2. [vercel.com/new](https://vercel.com/new) → **Import Git Repository**.
3. `masekaa/saidterzi` reposunu seç.
4. Ayarlar otomatik algılanır:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (repo kökü)
   - **Build Command:** `next build` (otomatik)
   - **Output:** otomatik
   - **Environment Variables:** GEREKMEZ
5. **Deploy**'a bas. ~1-2 dakikada canlı URL hazır (`saidterzi.vercel.app` benzeri).

> Her `git push` sonrası Vercel otomatik yeniden deploy eder (CI/CD).

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

- **Veri tazeliği:** `/api/analysis` route'u `force-dynamic` + `no-store` ile her istekte canlı veri çeker. Vercel'de serverless function olarak çalışır.
- **Yahoo güvenilirliği:** Resmi olmayan endpoint; nadiren 403/değişiklik olabilir. UI hata durumunda "Yenile" ile tekrar dener. İleride dayanıklılık için ikinci bir kaynak (Stooq/Alpha Vantage) fallback eklenebilir.
- **Bölge:** Yahoo bazı IP bölgelerinde farklı davranabilir. Sorun olursa `vercel.json` ile function region (örn. `iad1`) sabitlenebilir.
- **Rate limit:** Tek kullanıcı için sorun yok; yüksek trafikte route'a kısa süreli cache (örn. `revalidate = 300`) eklenebilir.
