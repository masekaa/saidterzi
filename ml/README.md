# `ml/` — BIST Gün-İçi Oynaklık ML Hattı

Çevrimdışı (Python) eğitim + dışa aktarım; web tarafı yalnız **çıkarım** yapar
(`lib/volatility.ts`). Bulgular ve dürüst OOS sonuçları için → [`RESULTS.md`](RESULTS.md).

**Özet karar:** Yön (artış/azalış) tahmini kanıtlanmış şekilde rastgele (LightGBM,
lojistik **ve LSTM** naive baseline'ı geçemedi). Üretime alınan tek model **oynaklık**
(hareket büyüklüğü) — Ridge, OOS'ta naive geçmiş-oynaklığı geçiyor.

## Dosyalar

| Dosya | Görev |
|-------|-------|
| `universe.py` | 26 likit BIST hissesi (web `lib/universe.ts` ile aynı) |
| `fetch_intraday.py` | Yahoo'dan OHLCV → `ml/data/bist_{interval}.csv` |
| `build_dataset.py` | Özellik + hedef matrisi (anti-look-ahead, aynı-seans) → `*_dataset.csv` |
| `train_baseline.py` | YÖN baseline (LightGBM/lojistik) + dürüst OOS — *sinyal yok* gösterir |
| `train_torch.py` | YÖN için PyTorch LSTM (DL) — yine *sinyal yok* gösterir |
| `train_volatility.py` | OYNAKLIK Ridge modeli → `model_volatility_{interval}_{H}.json` |
| `features.mjs` | `computeFeatures`+`predict` JS (lib/volatility.ts ile birebir; parite/smoke ortak) |
| `parity_fixture.py` / `parity_check.mjs` | TS↔Python özellik paritesi (max fark ~4e-17) |
| `smoke_live.mjs` | Canlı Yahoo verisiyle uçtan uca duman testi |

`ml/data/` ve üretilen `model_volatility_*.json` (ml/ içindekiler) **.gitignore**'dadır;
web'in kullandığı kopyalar `lib/models/` altında **commit edilir**.

## Sıfırdan üretim (reproduce)

```bash
# 1) Veri çek (60m ~2 yıl, 5m ~60 gün)
python ml/fetch_intraday.py 60m 2y
python ml/fetch_intraday.py 5m 60d

# 2) Özellik/hedef matrisi
python ml/build_dataset.py 60m 1,2
python ml/build_dataset.py 5m 12,24      # 12 bar=1s, 24 bar=2s

# 3) (Dürüstlük) Yönün ölü olduğunu teyit et
python ml/train_baseline.py 60m 1,2
python ml/train_torch.py 60m 1 24

# 4) Oynaklık modellerini eğit + dışa aktar
python ml/train_volatility.py 60m 1
python ml/train_volatility.py 60m 2
python ml/train_volatility.py 5m 12
python ml/train_volatility.py 5m 24

# 5) JSON'ları web'e kopyala (lib/models/)
cp ml/model_volatility_60m_1.json  lib/models/volatility_60m_1.json
cp ml/model_volatility_60m_2.json  lib/models/volatility_60m_2.json
cp ml/model_volatility_5m_12.json  lib/models/volatility_5m_12.json
cp ml/model_volatility_5m_24.json  lib/models/volatility_5m_24.json

# 6) Doğrula
python ml/parity_fixture.py THYAO 60m && node ml/parity_check.mjs   # = npm run test:parity
node ml/smoke_live.mjs                                              # = npm run test:smoke
```

## Önemli ilkeler

- **Anti-look-ahead:** özellikler yalnız geçmiş bardan; hedef yalnız gelecek bardan.
- **Aynı-seans:** t+H farklı güne düşerse örnek atılır (gece boşluklarını tahmin etmeyiz).
- **Kronolojik split:** test, train'den kesin sonra (rastgele split sızıntı yaratır).
- **Kalibrasyon:** gösterilen ±%, o rejimde OOS'ta *gerçekleşen* ortalama harekettir.
- **Parite şart:** `lib/volatility.ts` özellikleri `build_dataset.py` ile birebir olmalı
  (yoksa çıkarım, modelin eğitildiğinden farklı veriyle çalışır → yanlış tahmin).
