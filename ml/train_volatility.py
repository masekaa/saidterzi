"""HAREKET BUYUKLUGU (oynaklik) tahmin modeli + web'e aktarilabilir JSON export.

Yon tahmini rastgele (kanitlandi: LightGBM/lojistik/LSTM hepsi naive'i gecemiyor).
Oynaklik (|forward getiri| = hareketin BUYUKLUGU) ise gercek, kalibre sinyal verir.

Bu script:
  1. Hedef = |y_ret_H|  (H bar sonraki mutlak log-getiri = beklenen hareket buyuklugu)
  2. KRONOLOJIK split (sizinti yok)
  3. Ridge (lineer, standardize) -> katsayilar JSON'a aktarilabilir -> tarayicida inference
  4. LightGBM ile kiyas (lineer cok mu kaybediyor?) + naive (gecmis vol) baseline
  5. Terciller (dusuk/normal/yuksek rejim) + her rejimin GERCEK ortalama hareketi
  6. ml/model_volatility_{H}.json export et -> web sayfasi bunu kullanir

Kullanim:  python ml/train_volatility.py [interval] [H]
"""
import sys
import json
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.linear_model import Ridge
from sklearn.metrics import r2_score
from scipy.stats import spearmanr
import lightgbm as lgb

warnings.filterwarnings("ignore")
DATA = Path(__file__).parent / "data"
TEST_FRAC = 0.25

# Web tarafinda lib/intraday.ts ile yeniden uretilebilen ozellikler.
# (toHi/toLo/sma_gap gibi pencere-bagimli olanlar da bardan hesaplanabilir.)
FEATURES = [
    "ret_1", "ret_2", "ret_3", "ret_6", "ret_12", "ret_24",
    "vol_6", "vol_12", "vol_24", "rsi_14",
    "toHi_12", "toLo_12", "sma_gap_6", "sma_gap_12",
    "vol_ratio_12", "bar_range", "hour",
]


def main():
    interval = sys.argv[1] if len(sys.argv) > 1 else "60m"
    H = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    src = DATA / f"bist_{interval}_dataset.csv"
    if not src.exists():
        print(f"Once dataset kur: python ml/build_dataset.py {interval}")
        return
    df = pd.read_csv(src)
    ycol = f"y_ret_{H}"
    d = df.dropna(subset=[ycol] + FEATURES).sort_values("t").reset_index(drop=True)
    d["move"] = d[ycol].abs()  # hedef: hareket buyuklugu

    cut = d["t"].quantile(1 - TEST_FRAC)
    tr = d[d["t"] < cut]
    te = d[d["t"] >= cut]
    Xtr, ytr = tr[FEATURES].values, tr["move"].values
    Xte, yte = te[FEATURES].values, te["move"].values
    print(f"Veri: {len(d):,} ornek | {len(FEATURES)} ozellik | train={len(tr):,} test={len(te):,}")

    # --- Ridge (standardize, aktarilabilir) ---
    mu = Xtr.mean(0)
    sd = Xtr.std(0) + 1e-12
    Zt = (Xtr - mu) / sd
    Ze = (Xte - mu) / sd
    ridge = Ridge(alpha=10.0)
    ridge.fit(Zt, ytr)
    p_ridge = ridge.predict(Ze)
    r2_ridge = r2_score(yte, p_ridge)
    rho_ridge = spearmanr(yte, p_ridge).correlation

    # --- LightGBM (kiyas) ---
    gbm = lgb.LGBMRegressor(
        n_estimators=400, learning_rate=0.03, num_leaves=31,
        subsample=0.8, colsample_bytree=0.8, min_child_samples=80,
        reg_lambda=1.0, random_state=42, n_jobs=-1, verbose=-1,
    )
    gbm.fit(Xtr, ytr)
    p_gbm = gbm.predict(Xte)
    r2_gbm = r2_score(yte, p_gbm)
    rho_gbm = spearmanr(yte, p_gbm).correlation

    # --- Naive: gecmis oynaklik (vol_12) ---
    naive = te["vol_12"].values
    rho_naive = spearmanr(yte, naive).correlation

    bar_min = {"60m": 60, "30m": 30, "15m": 15, "5m": 5, "1m": 1}.get(interval, 60)
    hrs = H * bar_min / 60
    print(f"\n  H={H} ({H} bar ~{hrs:g} saat sonraki |hareket|)")
    print(f"    Ridge    OOS R2={r2_ridge:.3f}  rho={rho_ridge:.3f}")
    print(f"    LightGBM OOS R2={r2_gbm:.3f}  rho={rho_gbm:.3f}")
    print(f"    NAIVE (gecmis vol)        rho={rho_naive:.3f}")
    edge = "GECIYOR" if rho_ridge > rho_naive else "gecemiyor"
    print(f"    -> Ridge naive'i {edge} (rho {rho_ridge:.3f} vs {rho_naive:.3f})")

    # --- Rejim tercilleri (train tahminine gore) + gercek ortalama hareket ---
    p_tr = ridge.predict(Zt)
    q33, q67 = np.quantile(p_tr, [1 / 3, 2 / 3])
    reg_te = np.where(p_ridge < q33, 0, np.where(p_ridge < q67, 1, 2))
    means = [float(yte[reg_te == k].mean()) for k in (0, 1, 2)]
    # Belirsizlik: her rejimde gercek hareketin p25-p75 araligi (OOS).
    ranges = [
        [float(np.quantile(yte[reg_te == k], 0.25)), float(np.quantile(yte[reg_te == k], 0.75))]
        for k in (0, 1, 2)
    ]
    print("    Rejim kalibrasyonu (OOS gercek ortalama |hareket|, %):")
    for k, lbl in enumerate(["dusuk ", "normal", "yuksek"]):
        n = int((reg_te == k).sum())
        print(f"      {lbl}: {n:6d} ornek | gercek ort hareket = %{means[k]*100:.2f}")

    # --- Güvenilirlik eğrisi (OOS, 10 kova): tahmin <-> gerçekleşen ---
    order = np.argsort(p_ridge)
    reliability = []
    nb = 10
    for k in range(nb):
        lo = k * len(order) // nb
        hi = (k + 1) * len(order) // nb
        idx = order[lo:hi]
        if len(idx) == 0:
            continue
        reliability.append(
            {
                "pred": float(p_ridge[idx].mean()),
                "actual": float(yte[idx].mean()),
                "n": int(len(idx)),
            }
        )

    # --- Export ---
    out = {
        "interval": interval,
        "H": H,
        "features": FEATURES,
        "mean": mu.tolist(),
        "std": sd.tolist(),
        "coef": ridge.coef_.tolist(),
        "intercept": float(ridge.intercept_),
        "regime_thresholds": {"low": float(q33), "high": float(q67)},
        "regime_actual_move": {  # rejim -> OOS gercek ortalama mutlak getiri
            "low": means[0], "normal": means[1], "high": means[2],
        },
        "regime_move_range": {  # rejim -> OOS gercek hareket p25-p75 araligi
            "low": ranges[0], "normal": ranges[1], "high": ranges[2],
        },
        "oos": {
            "r2_ridge": float(r2_ridge), "rho_ridge": float(rho_ridge),
            "rho_naive": float(rho_naive), "n_test": int(len(te)),
        },
        "reliability": reliability,
        "note": "Hedef = |H-bar forward log-getiri| (hareket BUYUKLUGU, yon DEGIL). "
                "Tarayicida: z=(x-mean)/std; pred=intercept+coef.z; rejim=esiklerle.",
    }
    dst = Path(__file__).parent / f"model_volatility_{interval}_{H}.json"
    dst.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\n  Export: {dst.name}")


if __name__ == "__main__":
    main()
