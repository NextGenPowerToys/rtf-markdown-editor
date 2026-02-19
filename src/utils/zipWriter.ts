/**
 * Minimal ZIP file writer using only Node.js built-in modules.
 * Supports stored (method 0) and DEFLATE (method 8) compression.
 */
import * as zlib from 'zlib';

// ---------------------------------------------------------------------------
// CRC-32
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// ZipWriter
// ---------------------------------------------------------------------------

interface ZipEntry {
  name: Buffer;       // UTF-8 file name
  compressed: Buffer; // compressed (or stored) data
  original: Buffer;   // original data (for sizes)
  crc: number;
  method: number;     // 0 = stored, 8 = deflate
  localOffset: number;
}

export class ZipWriter {
  private entries: ZipEntry[] = [];
  private offset = 0; // running byte offset into the final archive

  /**
   * Add a file to the ZIP.
   * Data is DEFLATE-compressed; if the compressed form is larger than the
   * original the file is stored uncompressed instead.
   */
  addFile(name: string, data: Buffer): void {
    const nameBuffer = Buffer.from(name, 'utf8');
    const crc = crc32(data);

    let compressed = zlib.deflateRawSync(data, { level: 6 });
    let method = 8; // DEFLATE

    if (compressed.length >= data.length) {
      compressed = data;
      method = 0; // stored
    }

    const localHeaderSize =
      30 + // fixed local header
      nameBuffer.length;

    const entry: ZipEntry = {
      name: nameBuffer,
      compressed,
      original: data,
      crc,
      method,
      localOffset: this.offset,
    };

    this.entries.push(entry);
    this.offset += localHeaderSize + compressed.length;
  }

  /** Assemble and return the complete ZIP archive as a Buffer. */
  toBuffer(): Buffer {
    const parts: Buffer[] = [];

    // ------------------------------------------------------------------
    // Local file headers + data
    // ------------------------------------------------------------------
    for (const e of this.entries) {
      const header = Buffer.alloc(30 + e.name.length);
      header.writeUInt32LE(0x04034b50, 0);  // local file header signature
      header.writeUInt16LE(20, 4);           // version needed (2.0)
      header.writeUInt16LE(0x0800, 6);       // general purpose bit flag (UTF-8)
      header.writeUInt16LE(e.method, 8);     // compression method
      header.writeUInt16LE(0, 10);           // last mod time
      header.writeUInt16LE(0, 12);           // last mod date
      header.writeUInt32LE(e.crc, 14);       // crc-32
      header.writeUInt32LE(e.compressed.length, 18); // compressed size
      header.writeUInt32LE(e.original.length, 22);   // uncompressed size
      header.writeUInt16LE(e.name.length, 26);       // file name length
      header.writeUInt16LE(0, 28);                   // extra field length
      e.name.copy(header, 30);

      parts.push(header, e.compressed);
    }

    // ------------------------------------------------------------------
    // Central directory headers
    // ------------------------------------------------------------------
    const centralDirOffset = this.offset;
    let centralDirSize = 0;

    for (const e of this.entries) {
      const header = Buffer.alloc(46 + e.name.length);
      header.writeUInt32LE(0x02014b50, 0);  // central directory signature
      header.writeUInt16LE(20, 4);           // version made by
      header.writeUInt16LE(20, 6);           // version needed
      header.writeUInt16LE(0x0800, 8);       // general purpose bit flag (UTF-8)
      header.writeUInt16LE(e.method, 10);    // compression method
      header.writeUInt16LE(0, 12);           // last mod time
      header.writeUInt16LE(0, 14);           // last mod date
      header.writeUInt32LE(e.crc, 16);       // crc-32
      header.writeUInt32LE(e.compressed.length, 20); // compressed size
      header.writeUInt32LE(e.original.length, 24);   // uncompressed size
      header.writeUInt16LE(e.name.length, 28);       // file name length
      header.writeUInt16LE(0, 30);                   // extra field length
      header.writeUInt16LE(0, 32);                   // file comment length
      header.writeUInt16LE(0, 34);                   // disk number start
      header.writeUInt16LE(0, 36);                   // internal file attributes
      header.writeUInt32LE(0, 38);                   // external file attributes
      header.writeUInt32LE(e.localOffset, 42);       // relative offset of local header
      e.name.copy(header, 46);

      parts.push(header);
      centralDirSize += header.length;
    }

    // ------------------------------------------------------------------
    // End of central directory record
    // ------------------------------------------------------------------
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);              // EOCD signature
    eocd.writeUInt16LE(0, 4);                        // disk number
    eocd.writeUInt16LE(0, 6);                        // disk with start of central dir
    eocd.writeUInt16LE(this.entries.length, 8);      // entries on this disk
    eocd.writeUInt16LE(this.entries.length, 10);     // total entries
    eocd.writeUInt32LE(centralDirSize, 12);          // central directory size
    eocd.writeUInt32LE(centralDirOffset, 16);        // central directory offset
    eocd.writeUInt16LE(0, 20);                       // comment length

    parts.push(eocd);

    return Buffer.concat(parts);
  }
}
