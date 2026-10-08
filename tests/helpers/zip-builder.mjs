import zlib from "node:zlib";

const TABLE = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return table; })();
function crc32(buffer) { let crc = 0xffffffff; for (const byte of buffer) crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

/**
 * Builds a ZIP in memory for tests. Each entry: { name, data, store?, flags?, madeBy?, mode?, declaredSize? }.
 * `declaredSize` writes a size in the headers that differs from the real data, which is how a hostile archive lies.
 */
export function buildZip(entries) {
  const locals = []; const centrals = []; let offset = 0;
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? "", "utf8");
    const name = Buffer.from(entry.name, "utf8");
    const method = entry.store ? 0 : 8;
    const body = entry.store ? data : zlib.deflateRawSync(data);
    const size = entry.declaredSize ?? data.length;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(entry.flags ?? 0, 6); local.writeUInt16LE(method, 8); local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(size, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(((entry.madeBy ?? 0) << 8) | 20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(entry.flags ?? 0, 8); central.writeUInt16LE(method, 10); central.writeUInt32LE(crc32(data), 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(size, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(((entry.mode ?? 0) << 16) >>> 0, 38); central.writeUInt32LE(offset, 42);
    locals.push(local, name, body); centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** A minimal valid .docx / .xlsx container. */
export function buildDocx(text) { return buildZip([{ name: "[Content_Types].xml", data: "<Types/>" }, { name: "word/document.xml", data: `<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>` }]); }
export function buildXlsx(text) { return buildZip([{ name: "[Content_Types].xml", data: "<Types/>" }, { name: "xl/workbook.xml", data: "<workbook/>" }, { name: "xl/sharedStrings.xml", data: `<sst><si><t>${text}</t></si></sst>` }]); }
