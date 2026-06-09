// Eşzamanlılık-sınırlı yardımcılar — Yahoo gibi dış API'lerde rate-limit (429)
// riskini azaltmak için aynı anda koşan istek sayısını sınırlar.

// allSettled semantiği, ama en çok `limit` görev aynı anda koşar.
// Sonuç dizisi girdiyle BİREBİR aynı sırada döner (indeks eşleşmesi korunur).
export async function settledLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const idx = next++;
      try {
        results[idx] = { status: "fulfilled", value: await fn(items[idx], idx) };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker)
  );
  return results;
}
