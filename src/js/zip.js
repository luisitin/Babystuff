// BFF.zip: a tiny ZIP writer (stored, no compression). UMD so Node tests can load it.
(function (root) {
  'use strict';

  var TABLE = null;
  function table() {
    if (TABLE) return TABLE;
    TABLE = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : c >>> 1;
      TABLE[n] = c >>> 0;
    }
    return TABLE;
  }

  // CRC-32 (the ZIP and gzip polynomial) of a Uint8Array, as an unsigned number.
  function crc32(bytes) {
    var t = table(), c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // UTF-8 bytes of a string. Lone surrogates become U+FFFD, like TextEncoder.
  function utf8(s) {
    s = String(s);
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(s);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
        var d = s.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
      }
      if (c >= 0xD800 && c <= 0xDFFF) c = 0xFFFD;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return Uint8Array.from(out);
  }

  var FLAGS = 0x0800;      // bit 11: file names are UTF-8
  var DOS_TIME = 0;        // 00:00:00
  var DOS_DATE = 0x0021;   // 1980-01-01, fixed so the output is deterministic

  // store([{name, text}]) -> Uint8Array. An entry may carry `bytes` (a Uint8Array) instead of `text`.
  function store(files) {
    if (!Array.isArray(files)) throw new TypeError('store() needs an array of {name, text}');
    if (files.length > 0xFFFF) throw new RangeError('Too many files for a zip');
    var entries = files.map(function (f) {
      if (!f || typeof f.name !== 'string' || !f.name) throw new TypeError('Every file needs a name');
      var name = utf8(f.name);
      if (name.length > 0xFFFF) throw new RangeError('File name too long');
      var data = f.bytes instanceof Uint8Array ? f.bytes : utf8(f.text == null ? '' : f.text);
      return { name: name, data: data, crc: crc32(data) };
    });
    var size = 22, i;
    for (i = 0; i < entries.length; i++) size += 30 + 46 + 2 * entries[i].name.length + entries[i].data.length;
    if (size > 0xFFFFFFFF) throw new RangeError('Zip too large');
    var out = new Uint8Array(size), dv = new DataView(out.buffer), p = 0;
    function u16(v) { dv.setUint16(p, v, true); p += 2; }
    function u32(v) { dv.setUint32(p, v >>> 0, true); p += 4; }
    function put(b) { out.set(b, p); p += b.length; }
    for (i = 0; i < entries.length; i++) {
      var e = entries[i];
      e.offset = p;
      u32(0x04034B50); u16(20); u16(FLAGS); u16(0); u16(DOS_TIME); u16(DOS_DATE);
      u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.name.length); u16(0);
      put(e.name); put(e.data);
    }
    var cdStart = p;
    for (i = 0; i < entries.length; i++) {
      var f2 = entries[i];
      u32(0x02014B50); u16(20); u16(20); u16(FLAGS); u16(0); u16(DOS_TIME); u16(DOS_DATE);
      u32(f2.crc); u32(f2.data.length); u32(f2.data.length); u16(f2.name.length);
      u16(0); u16(0); u16(0); u16(0); u32(0); u32(f2.offset);
      put(f2.name);
    }
    var cdSize = p - cdStart;
    u32(0x06054B50); u16(0); u16(0); u16(entries.length); u16(entries.length); u32(cdSize); u32(cdStart); u16(0);
    return out;
  }

  var api = { store: store, crc32: crc32 };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.BFF = root.BFF || {}; root.BFF.zip = api; }
})(typeof window !== 'undefined' ? window : globalThis);
