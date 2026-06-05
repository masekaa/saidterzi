"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalysisResult, AssetAnalysis } from "@/lib/types";

function pct(x: number | null, digits = 1): string {
  if (x == null || !isFinite(x)) return "—";
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
}

function price(x: number, currency: string): string {
  if (!isFinite(x)) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(x);
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function SignalBadge({ signal }: { signal: "LONG" | "CASH" }) {
  const isLong = signal === "LONG";
  return (
    <span className={`badge ${isLong ? "badge-long" : "badge-cash"}`}>
      <span className="dot" />
      {isLong ? "AL / TUT" : "NAKİT"}
    </span>
  );
}

function AssetCard({
  a,
  isWinner,
}: {
  a: AssetAnalysis;
  isWinner: boolean;
}) {
  return (
    <div className={`card ${isWinner ? "winner" : ""}`}>
      {isWinner && <span className="winner-tag">En güçlü</span>}
      <div className="card-head">
        <div>
          <div className="card-name">{a.name}</div>
          <div className="card-ticker">{a.ticker}</div>
        </div>
        <SignalBadge signal={a.signal} />
      </div>
      <div className="card-price">
        {price(a.currentPrice, a.currency)}{" "}
        <span className="card-currency">{a.currency}</span>
      </div>
      <div className="metric-row">
        <span className="k">12 ay getiri</span>
        <span
          className={`v ${
            a.ret12m != null ? (a.ret12m >= 0 ? "pos" : "neg") : ""
          }`}
        >
          {pct(a.ret12m)}
        </span>
      </div>
      <div className="metric-row">
        <span className="k">T-Bill üstü (excess)</span>
        <span
          className={`v ${
            a.excessReturn != null
              ? a.excessReturn >= 0
                ? "pos"
                : "neg"
              : ""
          }`}
        >
          {pct(a.excessReturn)}
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analysis", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as AnalysisResult;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const gem = data?.gem;
  const isCash = gem?.positionKey === "cash";

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <h1 className="title">Dual Momentum Analiz</h1>
          <p className="subtitle">
            Altın · S&amp;P 500 · NASDAQ — Antonacci GEM stratejisi (12 ay
            look-back, T-Bill eşiği)
          </p>
        </div>
        <div className="header-right">
          <button
            className="refresh-btn"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Yükleniyor…" : "↻ Yenile"}
          </button>
          {data && (
            <span className="timestamp">
              Güncellendi: {fmtTime(data.generatedAt)}
            </span>
          )}
        </div>
      </div>

      {loading && !data && (
        <div className="state">
          <div className="spinner" />
          Piyasa verileri çekiliyor…
        </div>
      )}

      {error && (
        <div className="error-box">
          <b>Veri alınamadı.</b> {error}
          <br />
          <br />
          Yahoo Finance geçici olarak yanıt vermiyor olabilir; birkaç saniye
          sonra <b>Yenile</b>'ye basın.
        </div>
      )}

      {data && gem && (
        <>
          {/* GEM Önerisi */}
          <div className="hero">
            <p className="hero-label">GEM Önerisi — Bu Ay Tutulacak Pozisyon</p>
            <div className="hero-position">
              <span className="hero-asset">{gem.positionName}</span>
              <span
                className={`badge lg ${isCash ? "badge-cash" : "badge-long"}`}
              >
                <span className="dot" />
                {isCash ? "RİSKTEN KAÇ (NAKİT)" : "HİSSEDE KAL"}
              </span>
            </div>
            <p className="hero-rationale">{gem.rationale}</p>
          </div>

          {/* Varlık-bazlı sinyaller */}
          <div className="section-label">Varlık-Bazlı Sinyaller</div>
          <div className="grid">
            {data.assets.map((a) => (
              <AssetCard
                key={a.key}
                a={a}
                isWinner={a.key === gem.relativeWinnerKey}
              />
            ))}
          </div>

          <div className="tbill-line">
            Risksiz eşik (T-Bill, {data.tbill.ticker}) son 12 ay getirisi:{" "}
            <b>{pct(data.tbill.ret12m)}</b>. Bir varlığın 12 aylık getirisi bu
            eşiği geçiyorsa <b>AL/TUT</b>, geçmiyorsa <b>NAKİT</b> sinyali üretir
            (absolute momentum).
          </div>

          {data.warnings.length > 0 && (
            <div className="warnings">
              <b>Uyarılar:</b>
              <ul>
                {data.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Strateji açıklaması */}
          <div className="info">
            <h3>GEM Mantığı Nasıl Çalışır?</h3>
            <ol>
              <li>
                <b>Relative momentum:</b> Altın, S&amp;P 500 ve NASDAQ'tan son 12
                ayda en yüksek <code>total return</code> getiren varlık seçilir.
              </li>
              <li>
                <b>Absolute momentum (trend filtresi):</b> Seçilen varlığın 12
                aylık getirisi T-Bill'i geçiyorsa o varlıkta kal; geçmiyorsa
                trend negatif kabul edilir ve <code>NAKİT/T-Bill</code>'e geçilir.
              </li>
              <li>
                Her ay sonu tekrarlanır. Amaç: yüksek getiri + ayı piyasalarında
                büyük düşüşlerden korunma.
              </li>
            </ol>
          </div>

          <p className="disclaimer">
            ⚠️ Bu uygulama yalnızca eğitim ve bilgilendirme amaçlıdır; yatırım
            tavsiyesi değildir. Veriler Yahoo Finance'ten gecikmeli/yaklaşık
            olabilir. Geçmiş performans gelecek getiriyi garanti etmez. Kitabın
            orijinal GEM modeli ABD/yabancı hisse + tahvil kullanır; bu uygulama
            stratejiyi Altın/S&amp;P 500/NASDAQ üçlüsüne uyarlar.
          </p>
        </>
      )}

      <div className="footer">
        Kaynak metodoloji: Gary Antonacci, <i>Dual Momentum Investing</i>{" "}
        (2014). · Veri: Yahoo Finance
      </div>
    </div>
  );
}
