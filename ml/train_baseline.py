"""Baseline yon-tahmin modeli + DURUST out-of-sample degerlendirme.

Kritik: KRONOLOJIK split (test, train'den KESIN sonra) — rastgele split sizinti
yaratir ve sahte basari verir. Naive baseline (cogunluk sinifi) ile kiyaslanir;
kalibrasyon (tahmin olasiligi gercek frekansa uyuyor mu) gosterilir.

Kullanim:  python ml/train_baseline.py [interval] [H1,H2,...]
"""
import sys
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import roc_auc_score, accuracy_score, brier_score_loss
import lightgbm as lgb

warnings.filterwarnings("ignore")
DATA = Path(__file__).parent / "data"
TEST_FRAC = 0.25  # son %25 zaman = out-of-sample test


def calibration_report(y, p, bins=5):
    df = pd.DataFrame({"y": y, "p": p})
    df["bucket"] = pd.qcut(df["p"], bins, duplicates="drop")
    g = df.groupby("bucket", observed=True).agg(
        n=("y", "size"), pred=("p", "mean"), gercek=("y", "mean")
    )
    return g


def evaluate(name, y_test, prob):
    auc = roc_auc_score(y_test, prob) if len(np.unique(y_test)) > 1 else float("nan")
    acc = accuracy_score(y_test, (prob > 0.5).astype(int))
    brier = brier_score_loss(y_test, prob)
    print(f"    {name:10s} AUC={auc:.3f}  acc=%{acc*100:.1f}  Brier={brier:.4f}")
    return auc, acc, brier


def run_horizon(df, H, fcols):
    ycol = f"y_up_{H}"
    d = df.dropna(subset=[ycol]).sort_values("t").reset_index(drop=True)
    n = len(d)
    cut = d["t"].quantile(1 - TEST_FRAC)
    tr = d[d["t"] < cut]
    te = d[d["t"] >= cut]
    if len(tr) < 500 or len(te) < 200:
        print(f"  H={H}: yetersiz veri (tr={len(tr)}, te={len(te)})")
        return
    Xtr, ytr = tr[fcols].values, tr[ycol].astype(int).values
    Xte, yte = te[fcols].values, te[ycol].astype(int).values

    base_rate = yte.mean()
    naive_acc = max(base_rate, 1 - base_rate)  # hep cogunlugu de
    import datetime as dt
    tcut = dt.datetime.utcfromtimestamp(int(cut)).date()
    print(
        f"\n  H={H} ({H} bar ~{H} saat sonra) | n={n:,} | train={len(tr):,} test={len(te):,}"
        f" | test baslangic={tcut} | test yukari orani=%{base_rate*100:.1f}"
    )
    print(f"    NAIVE      (hep cogunluk) acc=%{naive_acc*100:.1f}  (AUC ref=0.500)")

    # LightGBM
    gbm = lgb.LGBMClassifier(
        n_estimators=300, learning_rate=0.03, num_leaves=31,
        subsample=0.8, colsample_bytree=0.8, min_child_samples=80,
        reg_lambda=1.0, random_state=42, n_jobs=-1, verbose=-1,
    )
    gbm.fit(Xtr, ytr)
    p_gbm = gbm.predict_proba(Xte)[:, 1]
    evaluate("LightGBM", yte, p_gbm)

    # Lojistik (olceklenmis)
    lr = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, C=0.5))
    lr.fit(Xtr, ytr)
    p_lr = lr.predict_proba(Xte)[:, 1]
    evaluate("Lojistik", yte, p_lr)

    print("    Kalibrasyon (LightGBM, 5 kova: tahmin -> gercek):")
    cal = calibration_report(yte, p_gbm, 5)
    for b, row in cal.iterrows():
        print(
            f"      {row['n']:6.0f} ornek | tahmin=%{row['pred']*100:.1f} -> gercek=%{row['gercek']*100:.1f}"
        )

    # En onemli ozellikler
    imp = pd.Series(gbm.feature_importances_, index=fcols).sort_values(ascending=False)
    print("    En etkili 6 ozellik:", ", ".join(imp.head(6).index))


def main():
    interval = sys.argv[1] if len(sys.argv) > 1 else "60m"
    horizons = [int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else "1,2").split(",")]
    src = DATA / f"bist_{interval}_dataset.csv"
    if not src.exists():
        print(f"Once dataset kur: python ml/build_dataset.py {interval}  (yok: {src})")
        return
    df = pd.read_csv(src)
    fcols = [c for c in df.columns if c not in ("ticker", "t") and not c.startswith("y_")]
    print(f"Veri: {len(df):,} ornek | {len(fcols)} ozellik | {df['ticker'].nunique()} hisse")
    print("DURUSTLUK NOTU: kronolojik split (test train'den sonra); ust uste binen")
    print("hedef pencereleri OOS anlamliligi bir miktar sisirir; AUC~0.50 = sinyal yok.")
    for H in horizons:
        run_horizon(df, H, fcols)


if __name__ == "__main__":
    main()
