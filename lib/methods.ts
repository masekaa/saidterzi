// methods.ts — Kapsam dokümanındaki her yöntemin canlı, şeffaf hesaplayıcısı.
// Her fonksiyon bir MethodResult döndürür: formül + her varlık için ara adımlar + sonuç.
// Kaynak referansları kapsam dokümanına (dual-momentum-kapsam/) işaret eder.

import {
  trailingReturn,
  sma,
  highestClose,
  quadraticFit,
  geometricMeanMonthly,
  toMonthlyReturns,
} from "./calc";
import {
  CORE_ASSETS,
  GBM_BONDS,
  DMSR_SECTORS,
  LOOKBACK_MONTHS,
  LOOKBACK_VARIANTS,
  MA_LENGTHS,
  DMSR_TOP_N,
  type Instrument,
} from "./universe";
import type {
  AssetMethodResult,
  CalcStep,
  GemRecommendation,
  MethodResult,
  RawSeries,
  Signal,
} from "./types";

// ---- Formatlayıcılar ----
const pct = (x: number | null, d = 1): string =>
  x == null || !isFinite(x) ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;
const num = (x: number | null, d = 2): string =>
  x == null || !isFinite(x) ? "—" : x.toFixed(d);

type RawMap = Record<string, RawSeries>;

// T-Bill 12 ay getirisi (eşik) — birçok yöntemde ortak kullanılır.
function tbillRet12(tbill: RawSeries): number | null {
  return trailingReturn(tbill.series, LOOKBACK_MONTHS).ret;
}

// ===========================================================================
// 1) TRAILING GETİRİ — Çoklu look-back (robustluk)
//    Kapsam: 01 §3, 05 (Tablo 8.5 / B.1). r(L) = P_t / P_{t−L} − 1
// ===========================================================================
export function methodTrailing(core: RawMap): MethodResult {
  const assets: AssetMethodResult[] = CORE_ASSETS.map((a) => {
    const raw = core[a.key];
    const steps: CalcStep[] = [];
    let r12: number | null = null;
    if (raw) {
      for (const L of LOOKBACK_VARIANTS) {
        const tr = trailingReturn(raw.series, L);
        steps.push({ label: `${L} ay`, value: pct(tr.ret) });
        if (L === LOOKBACK_MONTHS) r12 = tr.ret;
      }
    }
    return {
      assetKey: a.key,
      assetName: a.name,
      ticker: a.ticker,
      steps,
      result: pct(r12),
      resultRaw: r12,
      note: "12 ay = ana look-back",
    };
  });
  return {
    id: "trailing",
    title: "Trailing Getiri (Çoklu Look-back)",
    category: "Temel Girdi",
    bookRef: "Kapsam 01 §3 · 05 (Tablo 8.5, B.1)",
    formula: "r(L) = P_t / P_{t−L} − 1   (L = 1, 3, 6, 9, 12 ay)",
    description:
      "Her varlığın farklı geriye-bakış pencerelerindeki toplam getirisi. 12 ay ana parametredir; diğerleri robustluk içindir. Tüm momentum yöntemlerinin temel girdisidir.",
    assets,
    summary:
      "12 aylık getiri, relative ve absolute momentum kararlarının temel girdisidir.",
  };
}

// ===========================================================================
// 2) ABSOLUTE MOMENTUM — excess return vs T-Bill
//    Kapsam: 02 §2.2, 01 §4. excess = r12 − r_tbill ; >0 → LONG
// ===========================================================================
export function methodAbsolute(core: RawMap, tbill: RawSeries): MethodResult {
  const thr = tbillRet12(tbill) ?? 0;
  const assets: AssetMethodResult[] = CORE_ASSETS.map((a) => {
    const raw = core[a.key];
    const tr = raw ? trailingReturn(raw.series, LOOKBACK_MONTHS) : { ret: null };
    const r = tr.ret;
    const excess = r == null ? null : r - thr;
    const signal: Signal = excess != null && excess > 0 ? "LONG" : "CASH";
    return {
      assetKey: a.key,
      assetName: a.name,
      ticker: a.ticker,
      steps: [
        { label: "12 ay getiri (r)", value: pct(r) },
        { label: "T-Bill eşiği", value: pct(thr) },
        { label: "Excess (r − T-Bill)", value: pct(excess) },
      ],
      result: signal === "LONG" ? "Pozitif → AL/TUT" : "Negatif → NAKİT",
      resultRaw: excess,
      signal,
    };
  });
  return {
    id: "absolute",
    title: "Absolute Momentum (Trend Filtresi)",
    category: "Trend / Mutlak",
    bookRef: "Kapsam 02 §2.2 · 01 §4",
    formula: "excess = r₁₂ − r_TBill ;  excess > 0 ⇒ AL, aksi halde NAKİT",
    description:
      "Varlığın son 12 ay getirisi risksiz faizi (T-Bill) geçiyorsa trend pozitiftir → pozisyon tut; geçmiyorsa nakde çekil. Ayı piyasalarında büyük düşüşlerden korur.",
    assets,
    summary: `T-Bill eşiği: ${pct(thr)}. Eşiği geçen varlıklar AL sinyali verir.`,
  };
}

// ===========================================================================
// 3) RELATIVE MOMENTUM — sıralama
//    Kapsam: 02 §2.1, 01 §4. En yüksek r12'li varlığı seçer.
// ===========================================================================
export function methodRelative(core: RawMap): {
  method: MethodResult;
  rankedKeys: { key: string; name: string; ret: number }[];
} {
  const rows = CORE_ASSETS.map((a) => {
    const raw = core[a.key];
    const tr = raw ? trailingReturn(raw.series, LOOKBACK_MONTHS) : { ret: null };
    return { a, ret: tr.ret };
  });
  const ranked = rows
    .filter((x) => x.ret != null)
    .sort((x, y) => (y.ret as number) - (x.ret as number));
  const winnerKey = ranked[0]?.a.key;

  const assets: AssetMethodResult[] = rows.map(({ a, ret }) => {
    const rank = ranked.findIndex((x) => x.a.key === a.key);
    return {
      assetKey: a.key,
      assetName: a.name,
      ticker: a.ticker,
      steps: [
        { label: "12 ay getiri", value: pct(ret) },
        { label: "Sıra", value: rank >= 0 ? `${rank + 1}.` : "—" },
      ],
      result: rank === 0 ? "EN GÜÇLÜ" : `${rank + 1}. sıra`,
      resultRaw: ret,
      highlight: a.key === winnerKey,
    };
  });
  return {
    method: {
      id: "relative",
      title: "Relative Momentum (Sıralama)",
      category: "Göreceli",
      bookRef: "Kapsam 02 §2.1 · 01 §4",
      formula: "argmax_i  r₁₂(i)   (en yüksek 12-ay getirili varlık)",
      description:
        "Varlıklar 12 aylık getiriye göre sıralanır; en güçlü olan seçilir. Getiriyi artırır ama tek başına düşüş riskini azaltmaz.",
      assets,
      summary: ranked.length
        ? `En güçlü: ${ranked[0].a.name} (${pct(ranked[0].ret)}).`
        : "Yeterli veri yok.",
    },
    rankedKeys: ranked.map((x) => ({
      key: x.a.key,
      name: x.a.name,
      ret: x.ret as number,
    })),
  };
}

// ===========================================================================
// 4) DUAL MOMENTUM / GEM — relative + absolute
//    Kapsam: 01 §4. Önce en güçlüyü seç, sonra T-Bill eşiği; geçmezse NAKİT.
// ===========================================================================
export function buildGem(core: RawMap, tbill: RawSeries): {
  gem: GemRecommendation;
  method: MethodResult;
} {
  const thr = tbillRet12(tbill) ?? 0;
  const { rankedKeys } = methodRelative(core);

  let gem: GemRecommendation;
  const steps: CalcStep[] = [{ label: "T-Bill eşiği (12 ay)", value: pct(thr) }];

  if (rankedKeys.length === 0) {
    gem = {
      relativeWinnerKey: "—",
      relativeWinnerName: "—",
      relativeWinnerRet12m: 0,
      absolutePositive: false,
      positionKey: "cash",
      positionName: "NAKİT / T-Bill",
      rationale: "Yeterli veri yok → nakitte kal.",
    };
  } else {
    const w = rankedKeys[0];
    const absolutePositive = w.ret > thr;
    steps.push(
      { label: "1) Relative kazanan", value: `${w.name} (${pct(w.ret)})` },
      {
        label: "2) Absolute kontrol",
        value: `${pct(w.ret)} ${absolutePositive ? ">" : "≤"} ${pct(thr)}`,
      },
      {
        label: "Sonuç",
        value: absolutePositive ? w.name : "NAKİT / T-Bill",
      }
    );
    gem = {
      relativeWinnerKey: w.key,
      relativeWinnerName: w.name,
      relativeWinnerRet12m: w.ret,
      absolutePositive,
      positionKey: absolutePositive ? w.key : "cash",
      positionName: absolutePositive ? w.name : "NAKİT / T-Bill",
      rationale: absolutePositive
        ? `Relative momentum en güçlü varlık olarak ${w.name}'i seçti (12 ay: ${pct(
            w.ret
          )}). Getirisi T-Bill eşiğini (${pct(thr)}) geçtiği için trend pozitif → ${w.name} pozisyonu.`
        : `Relative momentum ${w.name}'i seçti (12 ay: ${pct(
            w.ret
          )}) ancak getirisi T-Bill eşiğinin (${pct(
            thr
          )}) altında → trend negatif → NAKİT/T-Bill.`,
    };
  }

  const method: MethodResult = {
    id: "gem",
    title: "Dual Momentum (GEM Kararı)",
    category: "Çekirdek Strateji",
    bookRef: "Kapsam 01 §4",
    formula:
      "aday = argmax r₁₂ ;  pozisyon = (r₁₂(aday) > r_TBill) ? aday : NAKİT",
    description:
      "Relative ve absolute momentumun birleşimi. Önce en güçlü varlık seçilir, sonra trend filtresinden geçirilir.",
    assets: [
      {
        assetKey: "gem",
        assetName: "GEM Pozisyonu",
        ticker: "",
        steps,
        result: gem.positionName,
        resultRaw: null,
        signal: gem.positionKey === "cash" ? "CASH" : "LONG",
        highlight: true,
      },
    ],
    summary: gem.rationale,
  };
  return { gem, method };
}

// ===========================================================================
// 5) HAREKETLİ ORTALAMA FİLTRESİ (SMA 10 / 12 ay)
//    Kapsam: 06 §1.2, 05 (Tablo 9.1). Fiyat > SMA_N ⇒ LONG
// ===========================================================================
export function methodMovingAverage(core: RawMap): MethodResult {
  const assets: AssetMethodResult[] = CORE_ASSETS.map((a) => {
    const raw = core[a.key];
    const steps: CalcStep[] = [];
    let lastSignal: Signal = "CASH";
    if (raw) {
      const price = raw.series[raw.series.length - 1]?.close ?? null;
      steps.push({ label: "Fiyat (P)", value: num(price) });
      for (const N of MA_LENGTHS) {
        const m = sma(raw.series, N);
        const above = m.value != null && price != null && price > m.value;
        steps.push({
          label: `SMA${N}`,
          value: m.value != null ? `${num(m.value)} ${above ? "(P üstünde)" : "(P altında)"}` : "—",
        });
        // 12 aylık MA'yı ana sinyal kabul et (kitap: 10/12 ay benzer)
        if (N === 12) lastSignal = above ? "LONG" : "CASH";
      }
    }
    return {
      assetKey: a.key,
      assetName: a.name,
      ticker: a.ticker,
      steps,
      result: lastSignal === "LONG" ? "P > SMA12 → AL/TUT" : "P ≤ SMA12 → NAKİT",
      resultRaw: null,
      signal: lastSignal,
    };
  });
  return {
    id: "ma",
    title: "Hareketli Ortalama Filtresi (10/12 ay)",
    category: "Trend / Alternatif",
    bookRef: "Kapsam 06 §1.2 · 05 (Tablo 9.1)",
    formula: "SMA_N = (1/N)·Σ P ;  P > SMA_N ⇒ AL, aksi halde NAKİT",
    description:
      "Absolute momentuma alternatif trend filtresi. Fiyat, son N ayın ortalamasının üstündeyse trend pozitiftir. 10 ay ≈ 200-gün (Faber 2007). Sonuçlar absolute momentuma çok yakındır.",
    assets,
    summary:
      "Hareketli ortalama ve absolute momentum aynı amaca hizmet eder (gürültüyü azaltarak trendi belirlemek).",
  };
}

// ===========================================================================
// 6) 52-HAFTA ZİRVEYE YAKINLIK
//    Kapsam: 06 §2.1 (George-Hwang 2004). oran = P / 52h-zirve
// ===========================================================================
export function methodFiftyTwoWeekHigh(core: RawMap): MethodResult {
  const assets: AssetMethodResult[] = CORE_ASSETS.map((a) => {
    const raw = core[a.key];
    let ratio: number | null = null;
    const steps: CalcStep[] = [];
    if (raw) {
      const { high, price } = highestClose(raw.series, LOOKBACK_MONTHS);
      if (high && price) ratio = price / high;
      steps.push(
        { label: "Fiyat (P)", value: num(price) },
        { label: "52-hafta zirve", value: num(high) },
        { label: "Oran P/zirve", value: ratio != null ? `%${(ratio * 100).toFixed(1)}` : "—" }
      );
    }
    return {
      assetKey: a.key,
      assetName: a.name,
      ticker: a.ticker,
      steps,
      result: ratio != null ? `Zirvenin %${(ratio * 100).toFixed(1)}'i` : "—",
      resultRaw: ratio,
      note: ratio != null && ratio >= 0.99 ? "Yeni zirve yakını (güçlü)" : undefined,
    };
  });
  return {
    id: "high52",
    title: "52-Hafta Zirveye Yakınlık",
    category: "Momentum Geliştirme",
    bookRef: "Kapsam 06 §2.1 (George-Hwang 2004)",
    formula: "oran = P_t / max₁₂ay(P)   (1'e ne kadar yakınsa o kadar güçlü)",
    description:
      "Fiyatın son 12 ayın zirvesine oranı. Zirveye yakınlık (yeni zirve = oran ~1) güçlü momentumu ve yakın zamanda gelen iyi haberi gösterir.",
    assets,
    summary: "1.00'e en yakın oran, en güçlü momentum adayıdır.",
  };
}

// ===========================================================================
// 7) İVMELENEN MOMENTUM (Kuadratik kavis)
//    Kapsam: 06 §2.3 (Chen-Yu 2013). log P'yi t²'ye regrese et; c>0 konveks.
// ===========================================================================
export function methodAccelerating(core: RawMap): MethodResult {
  const assets: AssetMethodResult[] = CORE_ASSETS.map((a) => {
    const raw = core[a.key];
    let c: number | null = null;
    const steps: CalcStep[] = [];
    if (raw && raw.series.length >= LOOKBACK_MONTHS + 1) {
      const window = raw.series.slice(raw.series.length - (LOOKBACK_MONTHS + 1));
      const logs = window.map((p) => Math.log(p.close));
      const fit = quadraticFit(logs);
      if (fit) {
        c = fit.c;
        steps.push(
          { label: "Kavis katsayısı (c)", value: c.toExponential(2) },
          { label: "Yorum", value: c > 0 ? "Konveks (hızlanıyor)" : c < 0 ? "Konkav (yavaşlıyor)" : "Düz" }
        );
      }
    }
    return {
      assetKey: a.key,
      assetName: a.name,
      ticker: a.ticker,
      steps,
      result: c == null ? "—" : c > 0 ? "Hızlanan ▲" : c < 0 ? "Yavaşlayan ▼" : "Düz",
      resultRaw: c,
      note: "Pozitif momentumda konveks (hızlanan) trend tercih edilir.",
    };
  });
  return {
    id: "accel",
    title: "İvmelenen Momentum (Kavis)",
    category: "Momentum Geliştirme",
    bookRef: "Kapsam 06 §2.3 (Chen-Yu 2013)",
    formula: "ln P_t = a + b·t + c·t² ;  c > 0 ⇒ konveks (hızlanan)",
    description:
      "Son 12 ayın log-fiyatına ikinci derece eğri uydurulur. t²'nin katsayısı (c) pozitifse trend yukarı hızlanıyor (konveks) — ki bu daha güçlü gelecek momentumla ilişkili.",
    assets,
    summary: "Konveks (c>0) + pozitif momentum kombinasyonu en güçlüsüdür.",
  };
}

// ===========================================================================
// 8) TAZE / BAYAT MOMENTUM (Fresh vs Stale)
//    Kapsam: 06 §2.4 (Chen-Kadan-Kose 2009).
//    Son 12 ay güçlü AMA önceki 12 ay zayıf = "taze kazanan".
// ===========================================================================
export function methodFreshStale(core: RawMap): MethodResult {
  const assets: AssetMethodResult[] = CORE_ASSETS.map((a) => {
    const raw = core[a.key];
    let recent: number | null = null;
    let prior: number | null = null;
    const steps: CalcStep[] = [];
    if (raw && raw.series.length >= 2 * LOOKBACK_MONTHS + 1) {
      const n = raw.series.length;
      const pNow = raw.series[n - 1].close;
      const pMid = raw.series[n - 1 - LOOKBACK_MONTHS].close;
      const pOld = raw.series[n - 1 - 2 * LOOKBACK_MONTHS].close;
      recent = pNow / pMid - 1;
      prior = pMid / pOld - 1;
      steps.push(
        { label: "Son 12 ay (recent)", value: pct(recent) },
        { label: "Önceki 12 ay (prior)", value: pct(prior) }
      );
    }
    const fresh = recent != null && prior != null && recent > 0 && recent > prior;
    return {
      assetKey: a.key,
      assetName: a.name,
      ticker: a.ticker,
      steps,
      result:
        recent == null
          ? "Yetersiz veri (24 ay gerekir)"
          : fresh
          ? "TAZE kazanan ✓"
          : "Bayat / zayıf",
      resultRaw: recent,
      note: "Taze kazananlar (güçlü son 12 ay + zayıf önceki 12 ay) ortalamada üstün gelir.",
    };
  });
  return {
    id: "fresh",
    title: "Taze / Bayat Momentum",
    category: "Momentum Geliştirme",
    bookRef: "Kapsam 06 §2.4 (Chen-Kadan-Kose 2009)",
    formula: "recent = r(1–12ay), prior = r(13–24ay) ;  taze ⇔ recent>0 ve recent>prior",
    description:
      "Son 12 ayda güçlü ama önceki 12 ayda zayıf olan varlıklar 'taze kazanan'dır ve 'bayat kazananları' geride bırakır. 24 ay geçmiş gerekir.",
    assets,
    summary: "Taze kazananlar tercih edilir; bayat momentum tersine dönebilir.",
  };
}

// ===========================================================================
// 9) TREND SALIENCE (Kısa-vade eğim vs 12-ay ortalama)
//    Kapsam: 06 §2.3 (Docherty-Hurst 2014).
//    Kısa vadeli aylık getiri > 12-ay geometrik aylık ortalama ⇒ hızlanan.
// ===========================================================================
export function methodTrendSalience(core: RawMap): MethodResult {
  const SHORT = 3;
  const assets: AssetMethodResult[] = CORE_ASSETS.map((a) => {
    const raw = core[a.key];
    let shortM: number | null = null;
    let longM: number | null = null;
    const steps: CalcStep[] = [];
    if (raw) {
      const rets = toMonthlyReturns(raw.series);
      if (rets.length >= LOOKBACK_MONTHS) {
        const last12 = rets.slice(rets.length - LOOKBACK_MONTHS);
        const last3 = rets.slice(rets.length - SHORT);
        longM = geometricMeanMonthly(last12);
        shortM = geometricMeanMonthly(last3);
        steps.push(
          { label: "Son 3 ay (aylık geo)", value: pct(shortM, 2) },
          { label: "12 ay (aylık geo)", value: pct(longM, 2) }
        );
      }
    }
    const salient = shortM != null && longM != null && shortM > longM;
    return {
      assetKey: a.key,
      assetName: a.name,
      ticker: a.ticker,
      steps,
      result:
        shortM == null
          ? "—"
          : salient
          ? "Hızlanan ▲ (kısa > uzun)"
          : "Yavaşlayan ▼",
      resultRaw: shortM != null && longM != null ? shortM - longM : null,
    };
  });
  return {
    id: "salience",
    title: "Trend Salience (Kısa vs Uzun Eğim)",
    category: "Momentum Geliştirme",
    bookRef: "Kapsam 06 §2.3 (Docherty-Hurst 2014)",
    formula: "kısa(3ay aylık geo) > uzun(12ay aylık geo) ⇒ hızlanan trend",
    description:
      "Son 3 ayın aylık geometrik ortalama getirisi, 12 ayın aylık ortalamasını geçiyorsa trend hızlanıyordur. Geleneksel momentumla birlikte kullanıldığında performansı artırır.",
    assets,
    summary: "Kısa-vade eğim uzun-vade eğimi geçtiğinde momentum güçleniyor demektir.",
  };
}

// ===========================================================================
// 10) GBM — Global Balanced Momentum (sabit-getiri tarafı)
//    Kapsam: 06 §3. Tahvil evreninde dual momentum ile en güçlü sabit-getiriyi seç.
// ===========================================================================
export function methodGBM(bondRaw: RawMap, tbill: RawSeries): MethodResult {
  const thr = tbillRet12(tbill) ?? 0;
  const rows = GBM_BONDS.map((b) => {
    const raw = bondRaw[b.key];
    const tr = raw ? trailingReturn(raw.series, LOOKBACK_MONTHS) : { ret: null };
    return { b, ret: tr.ret };
  });
  const ranked = rows
    .filter((x) => x.ret != null)
    .sort((x, y) => (y.ret as number) - (x.ret as number));
  const winner = ranked[0];

  const assets: AssetMethodResult[] = rows.map(({ b, ret }) => {
    const isWinner = winner && b.key === winner.b.key;
    return {
      assetKey: b.key,
      assetName: b.name,
      ticker: b.ticker,
      steps: [{ label: "12 ay getiri", value: pct(ret) }],
      result: isWinner ? "SEÇİLEN sabit-getiri" : "—",
      resultRaw: ret,
      highlight: !!isWinner,
    };
  });
  const pickName = winner
    ? winner.ret > thr
      ? winner.b.name
      : `${winner.b.name} (zayıf; T-Bill tercih edilebilir)`
    : "—";
  return {
    id: "gbm",
    title: "GBM — Sabit-Getiri Dual Momentum",
    category: "Varyasyon",
    bookRef: "Kapsam 06 §3",
    formula:
      "Tahvil evreninde argmax r₁₂ ; GBM = %70 GEM hisse + %30 bu seçim",
    description:
      "Global Balanced Momentum'un sabit-getiri tarafı. Uzun/orta Hazine, yüksek getirili tahvil ve T-Bill arasından en güçlüsü seçilir. GEM'in %30 sabit-getiri kısmı bununla doldurulur.",
    assets,
    summary: `Seçilen sabit-getiri: ${pickName}. (Tam GBM için %70 GEM hisse + %30 bu seçim.)`,
  };
}

// ===========================================================================
// 11) DMSR — Dual Momentum Sector Rotation
//    Kapsam: 06 §4. 11 sektörden en güçlü top-N; ABD trendi negatifse AGG.
// ===========================================================================
export function methodDMSR(
  sectorRaw: RawMap,
  spy: RawSeries,
  tbill: RawSeries
): MethodResult {
  const thr = tbillRet12(tbill) ?? 0;
  // Absolute filtre: ABD piyasası (SPY) trendi
  const spyRet = trailingReturn(spy.series, LOOKBACK_MONTHS).ret;
  const marketUp = spyRet != null && spyRet > thr;

  const rows = DMSR_SECTORS.map((s) => {
    const raw = sectorRaw[s.key];
    const tr = raw ? trailingReturn(raw.series, LOOKBACK_MONTHS) : { ret: null };
    return { s, ret: tr.ret };
  });
  const ranked = rows
    .filter((x) => x.ret != null)
    .sort((x, y) => (y.ret as number) - (x.ret as number));
  const topKeys = new Set(ranked.slice(0, DMSR_TOP_N).map((x) => x.s.key));

  const assets: AssetMethodResult[] = ranked.map((x, i) => ({
    assetKey: x.s.key,
    assetName: x.s.name,
    ticker: x.s.ticker,
    steps: [
      { label: "12 ay getiri", value: pct(x.ret) },
      { label: "Sıra", value: `${i + 1}.` },
    ],
    result: marketUp
      ? topKeys.has(x.s.key)
        ? `TOP ${DMSR_TOP_N} → seçili`
        : "—"
      : "Piyasa düşüş → AGG",
    resultRaw: x.ret,
    highlight: marketUp && topKeys.has(x.s.key),
  }));

  const summary = marketUp
    ? `ABD trendi pozitif (SPY ${pct(spyRet)} > T-Bill ${pct(
        thr
      )}). En güçlü ${DMSR_TOP_N} sektör (eşit ağırlık): ${ranked
        .slice(0, DMSR_TOP_N)
        .map((x) => x.s.name)
        .join(", ")}.`
    : `ABD trendi negatif (SPY ${pct(spyRet)} ≤ T-Bill ${pct(
        thr
      )}) → tüm pozisyon AGG (Aggregate Bond) güvenli limanında.`;

  return {
    id: "dmsr",
    title: "DMSR — Dual Momentum Sektör Rotasyonu",
    category: "Varyasyon",
    bookRef: "Kapsam 06 §4",
    formula: `Relative: top-${DMSR_TOP_N} sektör (eşit ağırlık) ; Absolute: SPY ≤ T-Bill ⇒ AGG`,
    description:
      "11 SPDR sektör ETF'i içinde relative momentum ile en güçlü 3 sektör eşit ağırlıkla seçilir. Ancak ABD piyasası (SPY) trendi negatifse tüm pozisyon Aggregate Bond'a geçer.",
    assets,
    summary,
  };
}

// Tüm yöntemleri tek listede üret.
export function buildAllMethods(
  core: RawMap,
  tbill: RawSeries,
  bondRaw: RawMap,
  sectorRaw: RawMap,
  spy: RawSeries
): { methods: MethodResult[]; gem: GemRecommendation } {
  const { gem, method: gemMethod } = buildGem(core, tbill);
  const rel = methodRelative(core);
  const methods: MethodResult[] = [
    gemMethod,
    methodTrailing(core),
    methodAbsolute(core, tbill),
    rel.method,
    methodMovingAverage(core),
    methodFiftyTwoWeekHigh(core),
    methodAccelerating(core),
    methodFreshStale(core),
    methodTrendSalience(core),
    methodGBM(bondRaw, tbill),
    methodDMSR(sectorRaw, spy, tbill),
  ];
  return { methods, gem };
}

export type { Instrument };
