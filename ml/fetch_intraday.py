"""BIST 60-dakikalik (intraday) gecmis veriyi Yahoo'dan ceker -> ml/data/bist_60m.csv

Yahoo 60m araliginda ~2 yil gecmis verir. Cikti uzun-format:
  ticker, t (unix sn, UTC), dt (TR saati), o, h, l, c, v

Kullanim:  python ml/fetch_intraday.py [interval] [range]
  ornek:    python ml/fetch_intraday.py 60m 2y
            python ml/fetch_intraday.py 5m 60d
"""
import sys
import time
import datetime as dt
import requests
import pandas as pd
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from universe import BIST_TICKERS, yahoo_symbol  # noqa: E402

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept": "application/json",
}
BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
OUT_DIR = Path(__file__).parent / "data"


def fetch_one(symbol: str, interval: str, rng: str) -> pd.DataFrame:
    url = (
        f"{BASE}/{symbol}?range={rng}&interval={interval}&includePrePost=false"
    )
    r = requests.get(url, headers=HEADERS, timeout=25)
    r.raise_for_status()
    res = r.json()["chart"]["result"]
    if not res:
        raise RuntimeError(f"{symbol}: result yok")
    res = res[0]
    ts = res.get("timestamp", []) or []
    q = res["indicators"]["quote"][0]
    df = pd.DataFrame(
        {
            "t": ts,
            "o": q.get("open", []),
            "h": q.get("high", []),
            "l": q.get("low", []),
            "c": q.get("close", []),
            "v": q.get("volume", []),
        }
    )
    return df


def main():
    interval = sys.argv[1] if len(sys.argv) > 1 else "60m"
    rng = sys.argv[2] if len(sys.argv) > 2 else "2y"
    OUT_DIR.mkdir(exist_ok=True)

    frames = []
    for code, name in BIST_TICKERS:
        sym = yahoo_symbol(code)
        try:
            df = fetch_one(sym, interval, rng)
            df.insert(0, "ticker", code)
            # bos kapanisli barlari at
            df = df.dropna(subset=["c"]).reset_index(drop=True)
            frames.append(df)
            print(f"  {code:6s} {len(df):5d} bar")
        except Exception as e:
            print(f"  {code:6s} HATA: {type(e).__name__} {e}")
        time.sleep(0.4)  # nazik rate-limit

    if not frames:
        print("Hic veri cekilemedi.")
        return
    out = pd.concat(frames, ignore_index=True)
    # TR saati (UTC+3) okunur sutun
    out["dt"] = (
        pd.to_datetime(out["t"], unit="s", utc=True)
        .dt.tz_convert("Europe/Istanbul")
        .dt.strftime("%Y-%m-%d %H:%M")
    )
    out = out[["ticker", "t", "dt", "o", "h", "l", "c", "v"]]

    path = OUT_DIR / f"bist_{interval}.csv"
    out.to_csv(path, index=False)
    span = (
        f"{out['dt'].min()} -> {out['dt'].max()}" if len(out) else "-"
    )
    print(
        f"\nKaydedildi: {path}\n  {len(out):,} satir | {out['ticker'].nunique()} hisse | {span}"
    )


if __name__ == "__main__":
    main()
