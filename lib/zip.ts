// zip.ts — Bağımlılıksız minimal ZIP okuyucu (Node yerleşik zlib).
// Ken French faktör dosyaları .zip içinde tek CSV olarak gelir; harici paket
// kurmadan, merkezi dizini (central directory) ayrıştırıp ilk dosyayı açar.

import { inflateRawSync } from "zlib";

// ZIP imza sabitleri
const EOCD_SIG = 0x06054b50; // End of Central Directory
const CEN_SIG = 0x02014b50; // Central Directory file header

/**
 * Bir ZIP buffer'ındaki ilk (veya .CSV uzantılı) dosyayı metin olarak döndürür.
 * Başarısızlıkta null.
 */
export function unzipFirstTextFile(buf: Buffer): string | null {
  try {
    // 1) EOCD'yi sondan geriye doğru tara (yorum alanı 0-65535 olabilir).
    const maxBack = Math.min(buf.length, 65557);
    let eocd = -1;
    for (let i = buf.length - 22; i >= buf.length - maxBack && i >= 0; i--) {
      if (buf.readUInt32LE(i) === EOCD_SIG) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return null;

    const totalEntries = buf.readUInt16LE(eocd + 10);
    const cdOffset = buf.readUInt32LE(eocd + 16);

    // 2) Merkezi dizini gez; ilk uygun (.CSV tercih) girişi seç.
    type Entry = { method: number; compSize: number; localOffset: number };
    let ptr = cdOffset;
    let chosen: Entry | null = null;
    let firstEntry: Entry | null = null;

    for (let e = 0; e < totalEntries; e++) {
      if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== CEN_SIG) break;
      const method = buf.readUInt16LE(ptr + 10);
      const compSize = buf.readUInt32LE(ptr + 20);
      const fnameLen = buf.readUInt16LE(ptr + 28);
      const extraLen = buf.readUInt16LE(ptr + 30);
      const commentLen = buf.readUInt16LE(ptr + 32);
      const localOffset = buf.readUInt32LE(ptr + 42);
      const fname = buf
        .slice(ptr + 46, ptr + 46 + fnameLen)
        .toString("latin1");

      const entry = { method, compSize, localOffset };
      if (!firstEntry) firstEntry = entry;
      if (/\.csv$/i.test(fname) || /\.txt$/i.test(fname)) {
        chosen = entry;
        break;
      }
      ptr += 46 + fnameLen + extraLen + commentLen;
    }

    const target = chosen ?? firstEntry;
    if (!target) return null;

    // 3) Yerel başlıktan veri offset'ini hesapla.
    const lo = target.localOffset;
    if (lo + 30 > buf.length) return null;
    const lfNameLen = buf.readUInt16LE(lo + 26);
    const lfExtraLen = buf.readUInt16LE(lo + 28);
    const dataStart = lo + 30 + lfNameLen + lfExtraLen;
    const compData = buf.slice(dataStart, dataStart + target.compSize);

    // 4) Çöz: method 8 = DEFLATE (raw), method 0 = stored.
    const out =
      target.method === 0 ? compData : inflateRawSync(compData);
    return out.toString("latin1");
  } catch {
    return null;
  }
}
