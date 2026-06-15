"""TS<->Python ozellik PARITE testi icin fixture uretir.

Bir ticker secer, ham barlari (gmtoffset ile) JSON'a yazar ve build_dataset'in
HESAPLADIGI ozellikleri belli bir bar icin "ground truth" olarak ekler.
Node tarafi (parity_check.mjs) ayni bardan ayni ozellikleri uretip karsilastirir.

Kullanim: python ml/parity_fixture.py [ticker] [interval]
"""
import sys
import json
import numpy as np
import pandas as pd
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_dataset import features_for_ticker  # noqa: E402

DATA = Path(__file__).parent / "data"


def main():
    ticker = sys.argv[1] if len(sys.argv) > 1 else "THYAO.IS"
    interval = sys.argv[2] if len(sys.argv) > 2 else "60m"
    raw = pd.read_csv(DATA / f"bist_{interval}.csv")
    g = raw[raw["ticker"] == ticker].sort_values("t").reset_index(drop=True)
    if len(g) < 60:
        print(f"Yetersiz bar: {ticker}")
        return
    feats = features_for_ticker(g.copy(), [1])
    # Ozellikleri tam (NaN'siz) olan son satiri sec -> hedef gerekmiyor
    fcols = [
        "ret_1", "ret_2", "ret_3", "ret_6", "ret_12", "ret_24",
        "vol_6", "vol_12", "vol_24", "rsi_14",
        "toHi_12", "toLo_12", "sma_gap_6", "sma_gap_12",
        "vol_ratio_12", "bar_range", "hour",
    ]
    valid = feats.dropna(subset=fcols)
    row = valid.iloc[len(valid) // 2]  # ortada bir bar
    t_sel = int(row["t"])
    # gmtoffset: IST yerel saat - UTC (saniye). hour ozelliginden teyit.
    ist = pd.to_datetime(t_sel, unit="s", utc=True).tz_convert("Europe/Istanbul")
    gmtoffset = int(ist.utcoffset().total_seconds())
    # Node'a secilen bara KADAR olan ham barlari ver (o bar son bar olacak)
    idx = g.index[g["t"] == t_sel][0]
    bars = [
        {"t": int(r.t), "o": float(r.o), "h": float(r.h), "l": float(r.l),
         "c": float(r.c), "v": float(r.v)}
        for r in g.iloc[: idx + 1].itertuples()
    ]
    out = {
        "ticker": ticker,
        "interval": interval,
        "gmtoffset": gmtoffset,
        "t_sel": t_sel,
        "bars": bars,
        "expected": {k: float(row[k]) for k in fcols},
    }
    dst = DATA / "parity_fixture.json"
    dst.write_text(json.dumps(out), encoding="utf-8")
    print(f"Fixture: {dst.name} | {ticker} | sec bar t={t_sel} | {len(bars)} bar")
    print("Beklenen ozellikler (Python):")
    for k in fcols:
        print(f"  {k:14s} = {row[k]:.8f}")


if __name__ == "__main__":
    main()
