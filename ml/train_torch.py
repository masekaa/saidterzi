"""DL (PyTorch LSTM) ile YON tahmini — dürüst out-of-sample testi.

Ham 60m barlardan dizi kurar (son N bar) -> LSTM -> H bar sonra yukari/asagi?
Kronolojik split (test train'den sonra), naive baseline ile kiyas.
Amac: 'derin ogrenme yonu cozer mi?' sorusunu durustce yanitlamak.

Kullanim:  python ml/train_torch.py [interval] [H] [N]
"""
import sys
import numpy as np
import pandas as pd
from pathlib import Path
import torch
import torch.nn as nn

torch.manual_seed(42)
np.random.seed(42)
DATA = Path(__file__).parent / "data"


def build_sequences(raw, N, H):
    seqs, ys, ts = [], [], []
    for _, g in raw.groupby("ticker"):
        g = g.sort_values("t").reset_index(drop=True)
        c = g["c"].to_numpy(float)
        v = g["v"].to_numpy(float)
        hi = g["h"].to_numpy(float)
        lo = g["l"].to_numpy(float)
        t = g["t"].to_numpy()
        ist = pd.to_datetime(g["t"], unit="s", utc=True).dt.tz_convert("Europe/Istanbul")
        day = ist.dt.date.astype(str).to_numpy()
        hour = (ist.dt.hour + ist.dt.minute / 60).to_numpy()
        logret = np.concatenate([[0], np.diff(np.log(c))])
        rng = (hi - lo) / np.where(c == 0, np.nan, c)
        dvol = np.concatenate([[0], np.diff(np.log(v + 1))])
        hs, hc = np.sin(2 * np.pi * hour / 24), np.cos(2 * np.pi * hour / 24)
        F = np.stack([logret, rng, dvol, hs, hc], axis=1)  # (T,5)
        for i in range(N - 1, len(g) - H):
            if day[i] != day[i + H]:  # ayni seans degilse atla
                continue
            win = F[i - N + 1 : i + 1]
            if not np.isfinite(win).all():
                continue
            up = 1.0 if c[i + H] > c[i] else 0.0
            seqs.append(win)
            ys.append(up)
            ts.append(t[i])
    return np.array(seqs, np.float32), np.array(ys, np.float32), np.array(ts)


class LSTMClf(nn.Module):
    def __init__(self, f=5, h=32):
        super().__init__()
        self.lstm = nn.LSTM(f, h, batch_first=True)
        self.head = nn.Sequential(nn.Dropout(0.2), nn.Linear(h, 1))

    def forward(self, x):
        o, _ = self.lstm(x)
        return self.head(o[:, -1]).squeeze(-1)


def auc(y, p):
    from sklearn.metrics import roc_auc_score
    return roc_auc_score(y, p) if len(np.unique(y)) > 1 else float("nan")


def main():
    interval = sys.argv[1] if len(sys.argv) > 1 else "60m"
    H = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    N = int(sys.argv[3]) if len(sys.argv) > 3 else 24
    src = DATA / f"bist_{interval}.csv"
    if not src.exists():
        print(f"Veri yok: {src}")
        return
    raw = pd.read_csv(src)
    X, y, ts = build_sequences(raw, N, H)
    print(f"Diziler: {X.shape} | H={H} bar | N={N} bar pencere")
    cut = np.quantile(ts, 0.75)
    tr, te = ts < cut, ts >= cut
    # ozellik olcekleme (train istatistigi)
    mu = X[tr].reshape(-1, X.shape[2]).mean(0)
    sd = X[tr].reshape(-1, X.shape[2]).std(0) + 1e-8
    Xs = (X - mu) / sd
    Xtr = torch.tensor(Xs[tr]); ytr = torch.tensor(y[tr])
    Xte = torch.tensor(Xs[te]); yte = torch.tensor(y[te])
    base = max(y[te].mean(), 1 - y[te].mean())
    print(f"train={tr.sum():,} test={te.sum():,} | test yukari=%{y[te].mean()*100:.1f} | naive acc=%{base*100:.1f}")

    model = LSTMClf(f=X.shape[2], h=32)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
    lossf = nn.BCEWithLogitsLoss()
    # ic dogrulama (train'in son %15'i, kronolojik)
    vcut = int(len(Xtr) * 0.85)
    best_auc, best_state, patience = -1, None, 0
    for ep in range(40):
        model.train()
        perm = torch.randperm(vcut)
        for i in range(0, vcut, 1024):
            idx = perm[i : i + 1024]
            opt.zero_grad()
            out = model(Xtr[idx])
            loss = lossf(out, ytr[idx])
            loss.backward(); opt.step()
        model.eval()
        with torch.no_grad():
            vp = torch.sigmoid(model(Xtr[vcut:])).numpy()
        va = auc(ytr[vcut:].numpy(), vp)
        if va > best_auc:
            best_auc, best_state, patience = va, {k: v.clone() for k, v in model.state_dict().items()}, 0
        else:
            patience += 1
            if patience >= 5:
                break
    if best_state:
        model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        p = torch.sigmoid(model(Xte)).numpy()
    a = auc(y[te], p)
    acc = ((p > 0.5).astype(int) == y[te]).mean()
    print(f"LSTM OOS: AUC={a:.3f}  acc=%{acc*100:.1f}  (naive=%{base*100:.1f}, AUC ref=0.500)")
    print("Yorum: AUC ~0.50 ise DL de yonu cozemiyor (beklenen). >0.55 ise sinyal var.")


if __name__ == "__main__":
    main()
