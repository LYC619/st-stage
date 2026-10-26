var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/jszip@3.10.1/node_modules/jszip/dist/jszip.min.js
var require_jszip_min = __commonJS({
  "node_modules/.pnpm/jszip@3.10.1/node_modules/jszip/dist/jszip.min.js"(exports, module) {
    !(function(e) {
      if ("object" == typeof exports && "undefined" != typeof module) module.exports = e();
      else if ("function" == typeof define && define.amd) define([], e);
      else {
        ("undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this).JSZip = e();
      }
    })(function() {
      return (function s(a, o, h) {
        function u(r, e2) {
          if (!o[r]) {
            if (!a[r]) {
              var t2 = "function" == typeof __require && __require;
              if (!e2 && t2) return t2(r, true);
              if (l) return l(r, true);
              var n = new Error("Cannot find module '" + r + "'");
              throw n.code = "MODULE_NOT_FOUND", n;
            }
            var i = o[r] = { exports: {} };
            a[r][0].call(i.exports, function(e3) {
              var t3 = a[r][1][e3];
              return u(t3 || e3);
            }, i, i.exports, s, a, o, h);
          }
          return o[r].exports;
        }
        for (var l = "function" == typeof __require && __require, e = 0; e < h.length; e++) u(h[e]);
        return u;
      })({ 1: [function(e, t2, r) {
        "use strict";
        var d = e("./utils"), c = e("./support"), p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        r.encode = function(e2) {
          for (var t3, r2, n, i, s, a, o, h = [], u = 0, l = e2.length, f = l, c2 = "string" !== d.getTypeOf(e2); u < e2.length; ) f = l - u, n = c2 ? (t3 = e2[u++], r2 = u < l ? e2[u++] : 0, u < l ? e2[u++] : 0) : (t3 = e2.charCodeAt(u++), r2 = u < l ? e2.charCodeAt(u++) : 0, u < l ? e2.charCodeAt(u++) : 0), i = t3 >> 2, s = (3 & t3) << 4 | r2 >> 4, a = 1 < f ? (15 & r2) << 2 | n >> 6 : 64, o = 2 < f ? 63 & n : 64, h.push(p.charAt(i) + p.charAt(s) + p.charAt(a) + p.charAt(o));
          return h.join("");
        }, r.decode = function(e2) {
          var t3, r2, n, i, s, a, o = 0, h = 0, u = "data:";
          if (e2.substr(0, u.length) === u) throw new Error("Invalid base64 input, it looks like a data url.");
          var l, f = 3 * (e2 = e2.replace(/[^A-Za-z0-9+/=]/g, "")).length / 4;
          if (e2.charAt(e2.length - 1) === p.charAt(64) && f--, e2.charAt(e2.length - 2) === p.charAt(64) && f--, f % 1 != 0) throw new Error("Invalid base64 input, bad content length.");
          for (l = c.uint8array ? new Uint8Array(0 | f) : new Array(0 | f); o < e2.length; ) t3 = p.indexOf(e2.charAt(o++)) << 2 | (i = p.indexOf(e2.charAt(o++))) >> 4, r2 = (15 & i) << 4 | (s = p.indexOf(e2.charAt(o++))) >> 2, n = (3 & s) << 6 | (a = p.indexOf(e2.charAt(o++))), l[h++] = t3, 64 !== s && (l[h++] = r2), 64 !== a && (l[h++] = n);
          return l;
        };
      }, { "./support": 30, "./utils": 32 }], 2: [function(e, t2, r) {
        "use strict";
        var n = e("./external"), i = e("./stream/DataWorker"), s = e("./stream/Crc32Probe"), a = e("./stream/DataLengthProbe");
        function o(e2, t3, r2, n2, i2) {
          this.compressedSize = e2, this.uncompressedSize = t3, this.crc32 = r2, this.compression = n2, this.compressedContent = i2;
        }
        o.prototype = { getContentWorker: function() {
          var e2 = new i(n.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new a("data_length")), t3 = this;
          return e2.on("end", function() {
            if (this.streamInfo.data_length !== t3.uncompressedSize) throw new Error("Bug : uncompressed data size mismatch");
          }), e2;
        }, getCompressedWorker: function() {
          return new i(n.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
        } }, o.createWorkerFrom = function(e2, t3, r2) {
          return e2.pipe(new s()).pipe(new a("uncompressedSize")).pipe(t3.compressWorker(r2)).pipe(new a("compressedSize")).withStreamInfo("compression", t3);
        }, t2.exports = o;
      }, { "./external": 6, "./stream/Crc32Probe": 25, "./stream/DataLengthProbe": 26, "./stream/DataWorker": 27 }], 3: [function(e, t2, r) {
        "use strict";
        var n = e("./stream/GenericWorker");
        r.STORE = { magic: "\0\0", compressWorker: function() {
          return new n("STORE compression");
        }, uncompressWorker: function() {
          return new n("STORE decompression");
        } }, r.DEFLATE = e("./flate");
      }, { "./flate": 7, "./stream/GenericWorker": 28 }], 4: [function(e, t2, r) {
        "use strict";
        var n = e("./utils");
        var o = (function() {
          for (var e2, t3 = [], r2 = 0; r2 < 256; r2++) {
            e2 = r2;
            for (var n2 = 0; n2 < 8; n2++) e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
            t3[r2] = e2;
          }
          return t3;
        })();
        t2.exports = function(e2, t3) {
          return void 0 !== e2 && e2.length ? "string" !== n.getTypeOf(e2) ? (function(e3, t4, r2, n2) {
            var i = o, s = n2 + r2;
            e3 ^= -1;
            for (var a = n2; a < s; a++) e3 = e3 >>> 8 ^ i[255 & (e3 ^ t4[a])];
            return -1 ^ e3;
          })(0 | t3, e2, e2.length, 0) : (function(e3, t4, r2, n2) {
            var i = o, s = n2 + r2;
            e3 ^= -1;
            for (var a = n2; a < s; a++) e3 = e3 >>> 8 ^ i[255 & (e3 ^ t4.charCodeAt(a))];
            return -1 ^ e3;
          })(0 | t3, e2, e2.length, 0) : 0;
        };
      }, { "./utils": 32 }], 5: [function(e, t2, r) {
        "use strict";
        r.base64 = false, r.binary = false, r.dir = false, r.createFolders = true, r.date = null, r.compression = null, r.compressionOptions = null, r.comment = null, r.unixPermissions = null, r.dosPermissions = null;
      }, {}], 6: [function(e, t2, r) {
        "use strict";
        var n = null;
        n = "undefined" != typeof Promise ? Promise : e("lie"), t2.exports = { Promise: n };
      }, { lie: 37 }], 7: [function(e, t2, r) {
        "use strict";
        var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Uint32Array, i = e("pako"), s = e("./utils"), a = e("./stream/GenericWorker"), o = n ? "uint8array" : "array";
        function h(e2, t3) {
          a.call(this, "FlateWorker/" + e2), this._pako = null, this._pakoAction = e2, this._pakoOptions = t3, this.meta = {};
        }
        r.magic = "\b\0", s.inherits(h, a), h.prototype.processChunk = function(e2) {
          this.meta = e2.meta, null === this._pako && this._createPako(), this._pako.push(s.transformTo(o, e2.data), false);
        }, h.prototype.flush = function() {
          a.prototype.flush.call(this), null === this._pako && this._createPako(), this._pako.push([], true);
        }, h.prototype.cleanUp = function() {
          a.prototype.cleanUp.call(this), this._pako = null;
        }, h.prototype._createPako = function() {
          this._pako = new i[this._pakoAction]({ raw: true, level: this._pakoOptions.level || -1 });
          var t3 = this;
          this._pako.onData = function(e2) {
            t3.push({ data: e2, meta: t3.meta });
          };
        }, r.compressWorker = function(e2) {
          return new h("Deflate", e2);
        }, r.uncompressWorker = function() {
          return new h("Inflate", {});
        };
      }, { "./stream/GenericWorker": 28, "./utils": 32, pako: 38 }], 8: [function(e, t2, r) {
        "use strict";
        function A(e2, t3) {
          var r2, n2 = "";
          for (r2 = 0; r2 < t3; r2++) n2 += String.fromCharCode(255 & e2), e2 >>>= 8;
          return n2;
        }
        function n(e2, t3, r2, n2, i2, s2) {
          var a, o, h = e2.file, u = e2.compression, l = s2 !== O.utf8encode, f = I.transformTo("string", s2(h.name)), c = I.transformTo("string", O.utf8encode(h.name)), d = h.comment, p = I.transformTo("string", s2(d)), m = I.transformTo("string", O.utf8encode(d)), _ = c.length !== h.name.length, g = m.length !== d.length, b = "", v = "", y = "", w = h.dir, k = h.date, x = { crc32: 0, compressedSize: 0, uncompressedSize: 0 };
          t3 && !r2 || (x.crc32 = e2.crc32, x.compressedSize = e2.compressedSize, x.uncompressedSize = e2.uncompressedSize);
          var S = 0;
          t3 && (S |= 8), l || !_ && !g || (S |= 2048);
          var z = 0, C = 0;
          w && (z |= 16), "UNIX" === i2 ? (C = 798, z |= (function(e3, t4) {
            var r3 = e3;
            return e3 || (r3 = t4 ? 16893 : 33204), (65535 & r3) << 16;
          })(h.unixPermissions, w)) : (C = 20, z |= (function(e3) {
            return 63 & (e3 || 0);
          })(h.dosPermissions)), a = k.getUTCHours(), a <<= 6, a |= k.getUTCMinutes(), a <<= 5, a |= k.getUTCSeconds() / 2, o = k.getUTCFullYear() - 1980, o <<= 4, o |= k.getUTCMonth() + 1, o <<= 5, o |= k.getUTCDate(), _ && (v = A(1, 1) + A(B(f), 4) + c, b += "up" + A(v.length, 2) + v), g && (y = A(1, 1) + A(B(p), 4) + m, b += "uc" + A(y.length, 2) + y);
          var E = "";
          return E += "\n\0", E += A(S, 2), E += u.magic, E += A(a, 2), E += A(o, 2), E += A(x.crc32, 4), E += A(x.compressedSize, 4), E += A(x.uncompressedSize, 4), E += A(f.length, 2), E += A(b.length, 2), { fileRecord: R.LOCAL_FILE_HEADER + E + f + b, dirRecord: R.CENTRAL_FILE_HEADER + A(C, 2) + E + A(p.length, 2) + "\0\0\0\0" + A(z, 4) + A(n2, 4) + f + b + p };
        }
        var I = e("../utils"), i = e("../stream/GenericWorker"), O = e("../utf8"), B = e("../crc32"), R = e("../signature");
        function s(e2, t3, r2, n2) {
          i.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = t3, this.zipPlatform = r2, this.encodeFileName = n2, this.streamFiles = e2, this.accumulate = false, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
        }
        I.inherits(s, i), s.prototype.push = function(e2) {
          var t3 = e2.meta.percent || 0, r2 = this.entriesCount, n2 = this._sources.length;
          this.accumulate ? this.contentBuffer.push(e2) : (this.bytesWritten += e2.data.length, i.prototype.push.call(this, { data: e2.data, meta: { currentFile: this.currentFile, percent: r2 ? (t3 + 100 * (r2 - n2 - 1)) / r2 : 100 } }));
        }, s.prototype.openedSource = function(e2) {
          this.currentSourceOffset = this.bytesWritten, this.currentFile = e2.file.name;
          var t3 = this.streamFiles && !e2.file.dir;
          if (t3) {
            var r2 = n(e2, t3, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
            this.push({ data: r2.fileRecord, meta: { percent: 0 } });
          } else this.accumulate = true;
        }, s.prototype.closedSource = function(e2) {
          this.accumulate = false;
          var t3 = this.streamFiles && !e2.file.dir, r2 = n(e2, t3, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
          if (this.dirRecords.push(r2.dirRecord), t3) this.push({ data: (function(e3) {
            return R.DATA_DESCRIPTOR + A(e3.crc32, 4) + A(e3.compressedSize, 4) + A(e3.uncompressedSize, 4);
          })(e2), meta: { percent: 100 } });
          else for (this.push({ data: r2.fileRecord, meta: { percent: 0 } }); this.contentBuffer.length; ) this.push(this.contentBuffer.shift());
          this.currentFile = null;
        }, s.prototype.flush = function() {
          for (var e2 = this.bytesWritten, t3 = 0; t3 < this.dirRecords.length; t3++) this.push({ data: this.dirRecords[t3], meta: { percent: 100 } });
          var r2 = this.bytesWritten - e2, n2 = (function(e3, t4, r3, n3, i2) {
            var s2 = I.transformTo("string", i2(n3));
            return R.CENTRAL_DIRECTORY_END + "\0\0\0\0" + A(e3, 2) + A(e3, 2) + A(t4, 4) + A(r3, 4) + A(s2.length, 2) + s2;
          })(this.dirRecords.length, r2, e2, this.zipComment, this.encodeFileName);
          this.push({ data: n2, meta: { percent: 100 } });
        }, s.prototype.prepareNextSource = function() {
          this.previous = this._sources.shift(), this.openedSource(this.previous.streamInfo), this.isPaused ? this.previous.pause() : this.previous.resume();
        }, s.prototype.registerPrevious = function(e2) {
          this._sources.push(e2);
          var t3 = this;
          return e2.on("data", function(e3) {
            t3.processChunk(e3);
          }), e2.on("end", function() {
            t3.closedSource(t3.previous.streamInfo), t3._sources.length ? t3.prepareNextSource() : t3.end();
          }), e2.on("error", function(e3) {
            t3.error(e3);
          }), this;
        }, s.prototype.resume = function() {
          return !!i.prototype.resume.call(this) && (!this.previous && this._sources.length ? (this.prepareNextSource(), true) : this.previous || this._sources.length || this.generatedError ? void 0 : (this.end(), true));
        }, s.prototype.error = function(e2) {
          var t3 = this._sources;
          if (!i.prototype.error.call(this, e2)) return false;
          for (var r2 = 0; r2 < t3.length; r2++) try {
            t3[r2].error(e2);
          } catch (e3) {
          }
          return true;
        }, s.prototype.lock = function() {
          i.prototype.lock.call(this);
          for (var e2 = this._sources, t3 = 0; t3 < e2.length; t3++) e2[t3].lock();
        }, t2.exports = s;
      }, { "../crc32": 4, "../signature": 23, "../stream/GenericWorker": 28, "../utf8": 31, "../utils": 32 }], 9: [function(e, t2, r) {
        "use strict";
        var u = e("../compressions"), n = e("./ZipFileWorker");
        r.generateWorker = function(e2, a, t3) {
          var o = new n(a.streamFiles, t3, a.platform, a.encodeFileName), h = 0;
          try {
            e2.forEach(function(e3, t4) {
              h++;
              var r2 = (function(e4, t5) {
                var r3 = e4 || t5, n3 = u[r3];
                if (!n3) throw new Error(r3 + " is not a valid compression method !");
                return n3;
              })(t4.options.compression, a.compression), n2 = t4.options.compressionOptions || a.compressionOptions || {}, i = t4.dir, s = t4.date;
              t4._compressWorker(r2, n2).withStreamInfo("file", { name: e3, dir: i, date: s, comment: t4.comment || "", unixPermissions: t4.unixPermissions, dosPermissions: t4.dosPermissions }).pipe(o);
            }), o.entriesCount = h;
          } catch (e3) {
            o.error(e3);
          }
          return o;
        };
      }, { "../compressions": 3, "./ZipFileWorker": 8 }], 10: [function(e, t2, r) {
        "use strict";
        function n() {
          if (!(this instanceof n)) return new n();
          if (arguments.length) throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
          this.files = /* @__PURE__ */ Object.create(null), this.comment = null, this.root = "", this.clone = function() {
            var e2 = new n();
            for (var t3 in this) "function" != typeof this[t3] && (e2[t3] = this[t3]);
            return e2;
          };
        }
        (n.prototype = e("./object")).loadAsync = e("./load"), n.support = e("./support"), n.defaults = e("./defaults"), n.version = "3.10.1", n.loadAsync = function(e2, t3) {
          return new n().loadAsync(e2, t3);
        }, n.external = e("./external"), t2.exports = n;
      }, { "./defaults": 5, "./external": 6, "./load": 11, "./object": 15, "./support": 30 }], 11: [function(e, t2, r) {
        "use strict";
        var u = e("./utils"), i = e("./external"), n = e("./utf8"), s = e("./zipEntries"), a = e("./stream/Crc32Probe"), l = e("./nodejsUtils");
        function f(n2) {
          return new i.Promise(function(e2, t3) {
            var r2 = n2.decompressed.getContentWorker().pipe(new a());
            r2.on("error", function(e3) {
              t3(e3);
            }).on("end", function() {
              r2.streamInfo.crc32 !== n2.decompressed.crc32 ? t3(new Error("Corrupted zip : CRC32 mismatch")) : e2();
            }).resume();
          });
        }
        t2.exports = function(e2, o) {
          var h = this;
          return o = u.extend(o || {}, { base64: false, checkCRC32: false, optimizedBinaryString: false, createFolders: false, decodeFileName: n.utf8decode }), l.isNode && l.isStream(e2) ? i.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : u.prepareContent("the loaded zip file", e2, true, o.optimizedBinaryString, o.base64).then(function(e3) {
            var t3 = new s(o);
            return t3.load(e3), t3;
          }).then(function(e3) {
            var t3 = [i.Promise.resolve(e3)], r2 = e3.files;
            if (o.checkCRC32) for (var n2 = 0; n2 < r2.length; n2++) t3.push(f(r2[n2]));
            return i.Promise.all(t3);
          }).then(function(e3) {
            for (var t3 = e3.shift(), r2 = t3.files, n2 = 0; n2 < r2.length; n2++) {
              var i2 = r2[n2], s2 = i2.fileNameStr, a2 = u.resolve(i2.fileNameStr);
              h.file(a2, i2.decompressed, { binary: true, optimizedBinaryString: true, date: i2.date, dir: i2.dir, comment: i2.fileCommentStr.length ? i2.fileCommentStr : null, unixPermissions: i2.unixPermissions, dosPermissions: i2.dosPermissions, createFolders: o.createFolders }), i2.dir || (h.file(a2).unsafeOriginalName = s2);
            }
            return t3.zipComment.length && (h.comment = t3.zipComment), h;
          });
        };
      }, { "./external": 6, "./nodejsUtils": 14, "./stream/Crc32Probe": 25, "./utf8": 31, "./utils": 32, "./zipEntries": 33 }], 12: [function(e, t2, r) {
        "use strict";
        var n = e("../utils"), i = e("../stream/GenericWorker");
        function s(e2, t3) {
          i.call(this, "Nodejs stream input adapter for " + e2), this._upstreamEnded = false, this._bindStream(t3);
        }
        n.inherits(s, i), s.prototype._bindStream = function(e2) {
          var t3 = this;
          (this._stream = e2).pause(), e2.on("data", function(e3) {
            t3.push({ data: e3, meta: { percent: 0 } });
          }).on("error", function(e3) {
            t3.isPaused ? this.generatedError = e3 : t3.error(e3);
          }).on("end", function() {
            t3.isPaused ? t3._upstreamEnded = true : t3.end();
          });
        }, s.prototype.pause = function() {
          return !!i.prototype.pause.call(this) && (this._stream.pause(), true);
        }, s.prototype.resume = function() {
          return !!i.prototype.resume.call(this) && (this._upstreamEnded ? this.end() : this._stream.resume(), true);
        }, t2.exports = s;
      }, { "../stream/GenericWorker": 28, "../utils": 32 }], 13: [function(e, t2, r) {
        "use strict";
        var i = e("readable-stream").Readable;
        function n(e2, t3, r2) {
          i.call(this, t3), this._helper = e2;
          var n2 = this;
          e2.on("data", function(e3, t4) {
            n2.push(e3) || n2._helper.pause(), r2 && r2(t4);
          }).on("error", function(e3) {
            n2.emit("error", e3);
          }).on("end", function() {
            n2.push(null);
          });
        }
        e("../utils").inherits(n, i), n.prototype._read = function() {
          this._helper.resume();
        }, t2.exports = n;
      }, { "../utils": 32, "readable-stream": 16 }], 14: [function(e, t2, r) {
        "use strict";
        t2.exports = { isNode: "undefined" != typeof Buffer, newBufferFrom: function(e2, t3) {
          if (Buffer.from && Buffer.from !== Uint8Array.from) return Buffer.from(e2, t3);
          if ("number" == typeof e2) throw new Error('The "data" argument must not be a number');
          return new Buffer(e2, t3);
        }, allocBuffer: function(e2) {
          if (Buffer.alloc) return Buffer.alloc(e2);
          var t3 = new Buffer(e2);
          return t3.fill(0), t3;
        }, isBuffer: function(e2) {
          return Buffer.isBuffer(e2);
        }, isStream: function(e2) {
          return e2 && "function" == typeof e2.on && "function" == typeof e2.pause && "function" == typeof e2.resume;
        } };
      }, {}], 15: [function(e, t2, r) {
        "use strict";
        function s(e2, t3, r2) {
          var n2, i2 = u.getTypeOf(t3), s2 = u.extend(r2 || {}, f);
          s2.date = s2.date || /* @__PURE__ */ new Date(), null !== s2.compression && (s2.compression = s2.compression.toUpperCase()), "string" == typeof s2.unixPermissions && (s2.unixPermissions = parseInt(s2.unixPermissions, 8)), s2.unixPermissions && 16384 & s2.unixPermissions && (s2.dir = true), s2.dosPermissions && 16 & s2.dosPermissions && (s2.dir = true), s2.dir && (e2 = g(e2)), s2.createFolders && (n2 = _(e2)) && b.call(this, n2, true);
          var a2 = "string" === i2 && false === s2.binary && false === s2.base64;
          r2 && void 0 !== r2.binary || (s2.binary = !a2), (t3 instanceof c && 0 === t3.uncompressedSize || s2.dir || !t3 || 0 === t3.length) && (s2.base64 = false, s2.binary = true, t3 = "", s2.compression = "STORE", i2 = "string");
          var o2 = null;
          o2 = t3 instanceof c || t3 instanceof l ? t3 : p.isNode && p.isStream(t3) ? new m(e2, t3) : u.prepareContent(e2, t3, s2.binary, s2.optimizedBinaryString, s2.base64);
          var h2 = new d(e2, o2, s2);
          this.files[e2] = h2;
        }
        var i = e("./utf8"), u = e("./utils"), l = e("./stream/GenericWorker"), a = e("./stream/StreamHelper"), f = e("./defaults"), c = e("./compressedObject"), d = e("./zipObject"), o = e("./generate"), p = e("./nodejsUtils"), m = e("./nodejs/NodejsStreamInputAdapter"), _ = function(e2) {
          "/" === e2.slice(-1) && (e2 = e2.substring(0, e2.length - 1));
          var t3 = e2.lastIndexOf("/");
          return 0 < t3 ? e2.substring(0, t3) : "";
        }, g = function(e2) {
          return "/" !== e2.slice(-1) && (e2 += "/"), e2;
        }, b = function(e2, t3) {
          return t3 = void 0 !== t3 ? t3 : f.createFolders, e2 = g(e2), this.files[e2] || s.call(this, e2, null, { dir: true, createFolders: t3 }), this.files[e2];
        };
        function h(e2) {
          return "[object RegExp]" === Object.prototype.toString.call(e2);
        }
        var n = { load: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, forEach: function(e2) {
          var t3, r2, n2;
          for (t3 in this.files) n2 = this.files[t3], (r2 = t3.slice(this.root.length, t3.length)) && t3.slice(0, this.root.length) === this.root && e2(r2, n2);
        }, filter: function(r2) {
          var n2 = [];
          return this.forEach(function(e2, t3) {
            r2(e2, t3) && n2.push(t3);
          }), n2;
        }, file: function(e2, t3, r2) {
          if (1 !== arguments.length) return e2 = this.root + e2, s.call(this, e2, t3, r2), this;
          if (h(e2)) {
            var n2 = e2;
            return this.filter(function(e3, t4) {
              return !t4.dir && n2.test(e3);
            });
          }
          var i2 = this.files[this.root + e2];
          return i2 && !i2.dir ? i2 : null;
        }, folder: function(r2) {
          if (!r2) return this;
          if (h(r2)) return this.filter(function(e3, t4) {
            return t4.dir && r2.test(e3);
          });
          var e2 = this.root + r2, t3 = b.call(this, e2), n2 = this.clone();
          return n2.root = t3.name, n2;
        }, remove: function(r2) {
          r2 = this.root + r2;
          var e2 = this.files[r2];
          if (e2 || ("/" !== r2.slice(-1) && (r2 += "/"), e2 = this.files[r2]), e2 && !e2.dir) delete this.files[r2];
          else for (var t3 = this.filter(function(e3, t4) {
            return t4.name.slice(0, r2.length) === r2;
          }), n2 = 0; n2 < t3.length; n2++) delete this.files[t3[n2].name];
          return this;
        }, generate: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, generateInternalStream: function(e2) {
          var t3, r2 = {};
          try {
            if ((r2 = u.extend(e2 || {}, { streamFiles: false, compression: "STORE", compressionOptions: null, type: "", platform: "DOS", comment: null, mimeType: "application/zip", encodeFileName: i.utf8encode })).type = r2.type.toLowerCase(), r2.compression = r2.compression.toUpperCase(), "binarystring" === r2.type && (r2.type = "string"), !r2.type) throw new Error("No output type specified.");
            u.checkSupport(r2.type), "darwin" !== r2.platform && "freebsd" !== r2.platform && "linux" !== r2.platform && "sunos" !== r2.platform || (r2.platform = "UNIX"), "win32" === r2.platform && (r2.platform = "DOS");
            var n2 = r2.comment || this.comment || "";
            t3 = o.generateWorker(this, r2, n2);
          } catch (e3) {
            (t3 = new l("error")).error(e3);
          }
          return new a(t3, r2.type || "string", r2.mimeType);
        }, generateAsync: function(e2, t3) {
          return this.generateInternalStream(e2).accumulate(t3);
        }, generateNodeStream: function(e2, t3) {
          return (e2 = e2 || {}).type || (e2.type = "nodebuffer"), this.generateInternalStream(e2).toNodejsStream(t3);
        } };
        t2.exports = n;
      }, { "./compressedObject": 2, "./defaults": 5, "./generate": 9, "./nodejs/NodejsStreamInputAdapter": 12, "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31, "./utils": 32, "./zipObject": 35 }], 16: [function(e, t2, r) {
        "use strict";
        t2.exports = e("stream");
      }, { stream: void 0 }], 17: [function(e, t2, r) {
        "use strict";
        var n = e("./DataReader");
        function i(e2) {
          n.call(this, e2);
          for (var t3 = 0; t3 < this.data.length; t3++) e2[t3] = 255 & e2[t3];
        }
        e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
          return this.data[this.zero + e2];
        }, i.prototype.lastIndexOfSignature = function(e2) {
          for (var t3 = e2.charCodeAt(0), r2 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.length - 4; 0 <= s; --s) if (this.data[s] === t3 && this.data[s + 1] === r2 && this.data[s + 2] === n2 && this.data[s + 3] === i2) return s - this.zero;
          return -1;
        }, i.prototype.readAndCheckSignature = function(e2) {
          var t3 = e2.charCodeAt(0), r2 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.readData(4);
          return t3 === s[0] && r2 === s[1] && n2 === s[2] && i2 === s[3];
        }, i.prototype.readData = function(e2) {
          if (this.checkOffset(e2), 0 === e2) return [];
          var t3 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t3;
        }, t2.exports = i;
      }, { "../utils": 32, "./DataReader": 18 }], 18: [function(e, t2, r) {
        "use strict";
        var n = e("../utils");
        function i(e2) {
          this.data = e2, this.length = e2.length, this.index = 0, this.zero = 0;
        }
        i.prototype = { checkOffset: function(e2) {
          this.checkIndex(this.index + e2);
        }, checkIndex: function(e2) {
          if (this.length < this.zero + e2 || e2 < 0) throw new Error("End of data reached (data length = " + this.length + ", asked index = " + e2 + "). Corrupted zip ?");
        }, setIndex: function(e2) {
          this.checkIndex(e2), this.index = e2;
        }, skip: function(e2) {
          this.setIndex(this.index + e2);
        }, byteAt: function() {
        }, readInt: function(e2) {
          var t3, r2 = 0;
          for (this.checkOffset(e2), t3 = this.index + e2 - 1; t3 >= this.index; t3--) r2 = (r2 << 8) + this.byteAt(t3);
          return this.index += e2, r2;
        }, readString: function(e2) {
          return n.transformTo("string", this.readData(e2));
        }, readData: function() {
        }, lastIndexOfSignature: function() {
        }, readAndCheckSignature: function() {
        }, readDate: function() {
          var e2 = this.readInt(4);
          return new Date(Date.UTC(1980 + (e2 >> 25 & 127), (e2 >> 21 & 15) - 1, e2 >> 16 & 31, e2 >> 11 & 31, e2 >> 5 & 63, (31 & e2) << 1));
        } }, t2.exports = i;
      }, { "../utils": 32 }], 19: [function(e, t2, r) {
        "use strict";
        var n = e("./Uint8ArrayReader");
        function i(e2) {
          n.call(this, e2);
        }
        e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
          this.checkOffset(e2);
          var t3 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t3;
        }, t2.exports = i;
      }, { "../utils": 32, "./Uint8ArrayReader": 21 }], 20: [function(e, t2, r) {
        "use strict";
        var n = e("./DataReader");
        function i(e2) {
          n.call(this, e2);
        }
        e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
          return this.data.charCodeAt(this.zero + e2);
        }, i.prototype.lastIndexOfSignature = function(e2) {
          return this.data.lastIndexOf(e2) - this.zero;
        }, i.prototype.readAndCheckSignature = function(e2) {
          return e2 === this.readData(4);
        }, i.prototype.readData = function(e2) {
          this.checkOffset(e2);
          var t3 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t3;
        }, t2.exports = i;
      }, { "../utils": 32, "./DataReader": 18 }], 21: [function(e, t2, r) {
        "use strict";
        var n = e("./ArrayReader");
        function i(e2) {
          n.call(this, e2);
        }
        e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
          if (this.checkOffset(e2), 0 === e2) return new Uint8Array(0);
          var t3 = this.data.subarray(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t3;
        }, t2.exports = i;
      }, { "../utils": 32, "./ArrayReader": 17 }], 22: [function(e, t2, r) {
        "use strict";
        var n = e("../utils"), i = e("../support"), s = e("./ArrayReader"), a = e("./StringReader"), o = e("./NodeBufferReader"), h = e("./Uint8ArrayReader");
        t2.exports = function(e2) {
          var t3 = n.getTypeOf(e2);
          return n.checkSupport(t3), "string" !== t3 || i.uint8array ? "nodebuffer" === t3 ? new o(e2) : i.uint8array ? new h(n.transformTo("uint8array", e2)) : new s(n.transformTo("array", e2)) : new a(e2);
        };
      }, { "../support": 30, "../utils": 32, "./ArrayReader": 17, "./NodeBufferReader": 19, "./StringReader": 20, "./Uint8ArrayReader": 21 }], 23: [function(e, t2, r) {
        "use strict";
        r.LOCAL_FILE_HEADER = "PK", r.CENTRAL_FILE_HEADER = "PK", r.CENTRAL_DIRECTORY_END = "PK", r.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07", r.ZIP64_CENTRAL_DIRECTORY_END = "PK", r.DATA_DESCRIPTOR = "PK\x07\b";
      }, {}], 24: [function(e, t2, r) {
        "use strict";
        var n = e("./GenericWorker"), i = e("../utils");
        function s(e2) {
          n.call(this, "ConvertWorker to " + e2), this.destType = e2;
        }
        i.inherits(s, n), s.prototype.processChunk = function(e2) {
          this.push({ data: i.transformTo(this.destType, e2.data), meta: e2.meta });
        }, t2.exports = s;
      }, { "../utils": 32, "./GenericWorker": 28 }], 25: [function(e, t2, r) {
        "use strict";
        var n = e("./GenericWorker"), i = e("../crc32");
        function s() {
          n.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
        }
        e("../utils").inherits(s, n), s.prototype.processChunk = function(e2) {
          this.streamInfo.crc32 = i(e2.data, this.streamInfo.crc32 || 0), this.push(e2);
        }, t2.exports = s;
      }, { "../crc32": 4, "../utils": 32, "./GenericWorker": 28 }], 26: [function(e, t2, r) {
        "use strict";
        var n = e("../utils"), i = e("./GenericWorker");
        function s(e2) {
          i.call(this, "DataLengthProbe for " + e2), this.propName = e2, this.withStreamInfo(e2, 0);
        }
        n.inherits(s, i), s.prototype.processChunk = function(e2) {
          if (e2) {
            var t3 = this.streamInfo[this.propName] || 0;
            this.streamInfo[this.propName] = t3 + e2.data.length;
          }
          i.prototype.processChunk.call(this, e2);
        }, t2.exports = s;
      }, { "../utils": 32, "./GenericWorker": 28 }], 27: [function(e, t2, r) {
        "use strict";
        var n = e("../utils"), i = e("./GenericWorker");
        function s(e2) {
          i.call(this, "DataWorker");
          var t3 = this;
          this.dataIsReady = false, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = false, e2.then(function(e3) {
            t3.dataIsReady = true, t3.data = e3, t3.max = e3 && e3.length || 0, t3.type = n.getTypeOf(e3), t3.isPaused || t3._tickAndRepeat();
          }, function(e3) {
            t3.error(e3);
          });
        }
        n.inherits(s, i), s.prototype.cleanUp = function() {
          i.prototype.cleanUp.call(this), this.data = null;
        }, s.prototype.resume = function() {
          return !!i.prototype.resume.call(this) && (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = true, n.delay(this._tickAndRepeat, [], this)), true);
        }, s.prototype._tickAndRepeat = function() {
          this._tickScheduled = false, this.isPaused || this.isFinished || (this._tick(), this.isFinished || (n.delay(this._tickAndRepeat, [], this), this._tickScheduled = true));
        }, s.prototype._tick = function() {
          if (this.isPaused || this.isFinished) return false;
          var e2 = null, t3 = Math.min(this.max, this.index + 16384);
          if (this.index >= this.max) return this.end();
          switch (this.type) {
            case "string":
              e2 = this.data.substring(this.index, t3);
              break;
            case "uint8array":
              e2 = this.data.subarray(this.index, t3);
              break;
            case "array":
            case "nodebuffer":
              e2 = this.data.slice(this.index, t3);
          }
          return this.index = t3, this.push({ data: e2, meta: { percent: this.max ? this.index / this.max * 100 : 0 } });
        }, t2.exports = s;
      }, { "../utils": 32, "./GenericWorker": 28 }], 28: [function(e, t2, r) {
        "use strict";
        function n(e2) {
          this.name = e2 || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = true, this.isFinished = false, this.isLocked = false, this._listeners = { data: [], end: [], error: [] }, this.previous = null;
        }
        n.prototype = { push: function(e2) {
          this.emit("data", e2);
        }, end: function() {
          if (this.isFinished) return false;
          this.flush();
          try {
            this.emit("end"), this.cleanUp(), this.isFinished = true;
          } catch (e2) {
            this.emit("error", e2);
          }
          return true;
        }, error: function(e2) {
          return !this.isFinished && (this.isPaused ? this.generatedError = e2 : (this.isFinished = true, this.emit("error", e2), this.previous && this.previous.error(e2), this.cleanUp()), true);
        }, on: function(e2, t3) {
          return this._listeners[e2].push(t3), this;
        }, cleanUp: function() {
          this.streamInfo = this.generatedError = this.extraStreamInfo = null, this._listeners = [];
        }, emit: function(e2, t3) {
          if (this._listeners[e2]) for (var r2 = 0; r2 < this._listeners[e2].length; r2++) this._listeners[e2][r2].call(this, t3);
        }, pipe: function(e2) {
          return e2.registerPrevious(this);
        }, registerPrevious: function(e2) {
          if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
          this.streamInfo = e2.streamInfo, this.mergeStreamInfo(), this.previous = e2;
          var t3 = this;
          return e2.on("data", function(e3) {
            t3.processChunk(e3);
          }), e2.on("end", function() {
            t3.end();
          }), e2.on("error", function(e3) {
            t3.error(e3);
          }), this;
        }, pause: function() {
          return !this.isPaused && !this.isFinished && (this.isPaused = true, this.previous && this.previous.pause(), true);
        }, resume: function() {
          if (!this.isPaused || this.isFinished) return false;
          var e2 = this.isPaused = false;
          return this.generatedError && (this.error(this.generatedError), e2 = true), this.previous && this.previous.resume(), !e2;
        }, flush: function() {
        }, processChunk: function(e2) {
          this.push(e2);
        }, withStreamInfo: function(e2, t3) {
          return this.extraStreamInfo[e2] = t3, this.mergeStreamInfo(), this;
        }, mergeStreamInfo: function() {
          for (var e2 in this.extraStreamInfo) Object.prototype.hasOwnProperty.call(this.extraStreamInfo, e2) && (this.streamInfo[e2] = this.extraStreamInfo[e2]);
        }, lock: function() {
          if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
          this.isLocked = true, this.previous && this.previous.lock();
        }, toString: function() {
          var e2 = "Worker " + this.name;
          return this.previous ? this.previous + " -> " + e2 : e2;
        } }, t2.exports = n;
      }, {}], 29: [function(e, t2, r) {
        "use strict";
        var h = e("../utils"), i = e("./ConvertWorker"), s = e("./GenericWorker"), u = e("../base64"), n = e("../support"), a = e("../external"), o = null;
        if (n.nodestream) try {
          o = e("../nodejs/NodejsStreamOutputAdapter");
        } catch (e2) {
        }
        function l(e2, o2) {
          return new a.Promise(function(t3, r2) {
            var n2 = [], i2 = e2._internalType, s2 = e2._outputType, a2 = e2._mimeType;
            e2.on("data", function(e3, t4) {
              n2.push(e3), o2 && o2(t4);
            }).on("error", function(e3) {
              n2 = [], r2(e3);
            }).on("end", function() {
              try {
                var e3 = (function(e4, t4, r3) {
                  switch (e4) {
                    case "blob":
                      return h.newBlob(h.transformTo("arraybuffer", t4), r3);
                    case "base64":
                      return u.encode(t4);
                    default:
                      return h.transformTo(e4, t4);
                  }
                })(s2, (function(e4, t4) {
                  var r3, n3 = 0, i3 = null, s3 = 0;
                  for (r3 = 0; r3 < t4.length; r3++) s3 += t4[r3].length;
                  switch (e4) {
                    case "string":
                      return t4.join("");
                    case "array":
                      return Array.prototype.concat.apply([], t4);
                    case "uint8array":
                      for (i3 = new Uint8Array(s3), r3 = 0; r3 < t4.length; r3++) i3.set(t4[r3], n3), n3 += t4[r3].length;
                      return i3;
                    case "nodebuffer":
                      return Buffer.concat(t4);
                    default:
                      throw new Error("concat : unsupported type '" + e4 + "'");
                  }
                })(i2, n2), a2);
                t3(e3);
              } catch (e4) {
                r2(e4);
              }
              n2 = [];
            }).resume();
          });
        }
        function f(e2, t3, r2) {
          var n2 = t3;
          switch (t3) {
            case "blob":
            case "arraybuffer":
              n2 = "uint8array";
              break;
            case "base64":
              n2 = "string";
          }
          try {
            this._internalType = n2, this._outputType = t3, this._mimeType = r2, h.checkSupport(n2), this._worker = e2.pipe(new i(n2)), e2.lock();
          } catch (e3) {
            this._worker = new s("error"), this._worker.error(e3);
          }
        }
        f.prototype = { accumulate: function(e2) {
          return l(this, e2);
        }, on: function(e2, t3) {
          var r2 = this;
          return "data" === e2 ? this._worker.on(e2, function(e3) {
            t3.call(r2, e3.data, e3.meta);
          }) : this._worker.on(e2, function() {
            h.delay(t3, arguments, r2);
          }), this;
        }, resume: function() {
          return h.delay(this._worker.resume, [], this._worker), this;
        }, pause: function() {
          return this._worker.pause(), this;
        }, toNodejsStream: function(e2) {
          if (h.checkSupport("nodestream"), "nodebuffer" !== this._outputType) throw new Error(this._outputType + " is not supported by this method");
          return new o(this, { objectMode: "nodebuffer" !== this._outputType }, e2);
        } }, t2.exports = f;
      }, { "../base64": 1, "../external": 6, "../nodejs/NodejsStreamOutputAdapter": 13, "../support": 30, "../utils": 32, "./ConvertWorker": 24, "./GenericWorker": 28 }], 30: [function(e, t2, r) {
        "use strict";
        if (r.base64 = true, r.array = true, r.string = true, r.arraybuffer = "undefined" != typeof ArrayBuffer && "undefined" != typeof Uint8Array, r.nodebuffer = "undefined" != typeof Buffer, r.uint8array = "undefined" != typeof Uint8Array, "undefined" == typeof ArrayBuffer) r.blob = false;
        else {
          var n = new ArrayBuffer(0);
          try {
            r.blob = 0 === new Blob([n], { type: "application/zip" }).size;
          } catch (e2) {
            try {
              var i = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
              i.append(n), r.blob = 0 === i.getBlob("application/zip").size;
            } catch (e3) {
              r.blob = false;
            }
          }
        }
        try {
          r.nodestream = !!e("readable-stream").Readable;
        } catch (e2) {
          r.nodestream = false;
        }
      }, { "readable-stream": 16 }], 31: [function(e, t2, s) {
        "use strict";
        for (var o = e("./utils"), h = e("./support"), r = e("./nodejsUtils"), n = e("./stream/GenericWorker"), u = new Array(256), i = 0; i < 256; i++) u[i] = 252 <= i ? 6 : 248 <= i ? 5 : 240 <= i ? 4 : 224 <= i ? 3 : 192 <= i ? 2 : 1;
        u[254] = u[254] = 1;
        function a() {
          n.call(this, "utf-8 decode"), this.leftOver = null;
        }
        function l() {
          n.call(this, "utf-8 encode");
        }
        s.utf8encode = function(e2) {
          return h.nodebuffer ? r.newBufferFrom(e2, "utf-8") : (function(e3) {
            var t3, r2, n2, i2, s2, a2 = e3.length, o2 = 0;
            for (i2 = 0; i2 < a2; i2++) 55296 == (64512 & (r2 = e3.charCodeAt(i2))) && i2 + 1 < a2 && 56320 == (64512 & (n2 = e3.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), o2 += r2 < 128 ? 1 : r2 < 2048 ? 2 : r2 < 65536 ? 3 : 4;
            for (t3 = h.uint8array ? new Uint8Array(o2) : new Array(o2), i2 = s2 = 0; s2 < o2; i2++) 55296 == (64512 & (r2 = e3.charCodeAt(i2))) && i2 + 1 < a2 && 56320 == (64512 & (n2 = e3.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), r2 < 128 ? t3[s2++] = r2 : (r2 < 2048 ? t3[s2++] = 192 | r2 >>> 6 : (r2 < 65536 ? t3[s2++] = 224 | r2 >>> 12 : (t3[s2++] = 240 | r2 >>> 18, t3[s2++] = 128 | r2 >>> 12 & 63), t3[s2++] = 128 | r2 >>> 6 & 63), t3[s2++] = 128 | 63 & r2);
            return t3;
          })(e2);
        }, s.utf8decode = function(e2) {
          return h.nodebuffer ? o.transformTo("nodebuffer", e2).toString("utf-8") : (function(e3) {
            var t3, r2, n2, i2, s2 = e3.length, a2 = new Array(2 * s2);
            for (t3 = r2 = 0; t3 < s2; ) if ((n2 = e3[t3++]) < 128) a2[r2++] = n2;
            else if (4 < (i2 = u[n2])) a2[r2++] = 65533, t3 += i2 - 1;
            else {
              for (n2 &= 2 === i2 ? 31 : 3 === i2 ? 15 : 7; 1 < i2 && t3 < s2; ) n2 = n2 << 6 | 63 & e3[t3++], i2--;
              1 < i2 ? a2[r2++] = 65533 : n2 < 65536 ? a2[r2++] = n2 : (n2 -= 65536, a2[r2++] = 55296 | n2 >> 10 & 1023, a2[r2++] = 56320 | 1023 & n2);
            }
            return a2.length !== r2 && (a2.subarray ? a2 = a2.subarray(0, r2) : a2.length = r2), o.applyFromCharCode(a2);
          })(e2 = o.transformTo(h.uint8array ? "uint8array" : "array", e2));
        }, o.inherits(a, n), a.prototype.processChunk = function(e2) {
          var t3 = o.transformTo(h.uint8array ? "uint8array" : "array", e2.data);
          if (this.leftOver && this.leftOver.length) {
            if (h.uint8array) {
              var r2 = t3;
              (t3 = new Uint8Array(r2.length + this.leftOver.length)).set(this.leftOver, 0), t3.set(r2, this.leftOver.length);
            } else t3 = this.leftOver.concat(t3);
            this.leftOver = null;
          }
          var n2 = (function(e3, t4) {
            var r3;
            for ((t4 = t4 || e3.length) > e3.length && (t4 = e3.length), r3 = t4 - 1; 0 <= r3 && 128 == (192 & e3[r3]); ) r3--;
            return r3 < 0 ? t4 : 0 === r3 ? t4 : r3 + u[e3[r3]] > t4 ? r3 : t4;
          })(t3), i2 = t3;
          n2 !== t3.length && (h.uint8array ? (i2 = t3.subarray(0, n2), this.leftOver = t3.subarray(n2, t3.length)) : (i2 = t3.slice(0, n2), this.leftOver = t3.slice(n2, t3.length))), this.push({ data: s.utf8decode(i2), meta: e2.meta });
        }, a.prototype.flush = function() {
          this.leftOver && this.leftOver.length && (this.push({ data: s.utf8decode(this.leftOver), meta: {} }), this.leftOver = null);
        }, s.Utf8DecodeWorker = a, o.inherits(l, n), l.prototype.processChunk = function(e2) {
          this.push({ data: s.utf8encode(e2.data), meta: e2.meta });
        }, s.Utf8EncodeWorker = l;
      }, { "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./support": 30, "./utils": 32 }], 32: [function(e, t2, a) {
        "use strict";
        var o = e("./support"), h = e("./base64"), r = e("./nodejsUtils"), u = e("./external");
        function n(e2) {
          return e2;
        }
        function l(e2, t3) {
          for (var r2 = 0; r2 < e2.length; ++r2) t3[r2] = 255 & e2.charCodeAt(r2);
          return t3;
        }
        e("setimmediate"), a.newBlob = function(t3, r2) {
          a.checkSupport("blob");
          try {
            return new Blob([t3], { type: r2 });
          } catch (e2) {
            try {
              var n2 = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
              return n2.append(t3), n2.getBlob(r2);
            } catch (e3) {
              throw new Error("Bug : can't construct the Blob.");
            }
          }
        };
        var i = { stringifyByChunk: function(e2, t3, r2) {
          var n2 = [], i2 = 0, s2 = e2.length;
          if (s2 <= r2) return String.fromCharCode.apply(null, e2);
          for (; i2 < s2; ) "array" === t3 || "nodebuffer" === t3 ? n2.push(String.fromCharCode.apply(null, e2.slice(i2, Math.min(i2 + r2, s2)))) : n2.push(String.fromCharCode.apply(null, e2.subarray(i2, Math.min(i2 + r2, s2)))), i2 += r2;
          return n2.join("");
        }, stringifyByChar: function(e2) {
          for (var t3 = "", r2 = 0; r2 < e2.length; r2++) t3 += String.fromCharCode(e2[r2]);
          return t3;
        }, applyCanBeUsed: { uint8array: (function() {
          try {
            return o.uint8array && 1 === String.fromCharCode.apply(null, new Uint8Array(1)).length;
          } catch (e2) {
            return false;
          }
        })(), nodebuffer: (function() {
          try {
            return o.nodebuffer && 1 === String.fromCharCode.apply(null, r.allocBuffer(1)).length;
          } catch (e2) {
            return false;
          }
        })() } };
        function s(e2) {
          var t3 = 65536, r2 = a.getTypeOf(e2), n2 = true;
          if ("uint8array" === r2 ? n2 = i.applyCanBeUsed.uint8array : "nodebuffer" === r2 && (n2 = i.applyCanBeUsed.nodebuffer), n2) for (; 1 < t3; ) try {
            return i.stringifyByChunk(e2, r2, t3);
          } catch (e3) {
            t3 = Math.floor(t3 / 2);
          }
          return i.stringifyByChar(e2);
        }
        function f(e2, t3) {
          for (var r2 = 0; r2 < e2.length; r2++) t3[r2] = e2[r2];
          return t3;
        }
        a.applyFromCharCode = s;
        var c = {};
        c.string = { string: n, array: function(e2) {
          return l(e2, new Array(e2.length));
        }, arraybuffer: function(e2) {
          return c.string.uint8array(e2).buffer;
        }, uint8array: function(e2) {
          return l(e2, new Uint8Array(e2.length));
        }, nodebuffer: function(e2) {
          return l(e2, r.allocBuffer(e2.length));
        } }, c.array = { string: s, array: n, arraybuffer: function(e2) {
          return new Uint8Array(e2).buffer;
        }, uint8array: function(e2) {
          return new Uint8Array(e2);
        }, nodebuffer: function(e2) {
          return r.newBufferFrom(e2);
        } }, c.arraybuffer = { string: function(e2) {
          return s(new Uint8Array(e2));
        }, array: function(e2) {
          return f(new Uint8Array(e2), new Array(e2.byteLength));
        }, arraybuffer: n, uint8array: function(e2) {
          return new Uint8Array(e2);
        }, nodebuffer: function(e2) {
          return r.newBufferFrom(new Uint8Array(e2));
        } }, c.uint8array = { string: s, array: function(e2) {
          return f(e2, new Array(e2.length));
        }, arraybuffer: function(e2) {
          return e2.buffer;
        }, uint8array: n, nodebuffer: function(e2) {
          return r.newBufferFrom(e2);
        } }, c.nodebuffer = { string: s, array: function(e2) {
          return f(e2, new Array(e2.length));
        }, arraybuffer: function(e2) {
          return c.nodebuffer.uint8array(e2).buffer;
        }, uint8array: function(e2) {
          return f(e2, new Uint8Array(e2.length));
        }, nodebuffer: n }, a.transformTo = function(e2, t3) {
          if (t3 = t3 || "", !e2) return t3;
          a.checkSupport(e2);
          var r2 = a.getTypeOf(t3);
          return c[r2][e2](t3);
        }, a.resolve = function(e2) {
          for (var t3 = e2.split("/"), r2 = [], n2 = 0; n2 < t3.length; n2++) {
            var i2 = t3[n2];
            "." === i2 || "" === i2 && 0 !== n2 && n2 !== t3.length - 1 || (".." === i2 ? r2.pop() : r2.push(i2));
          }
          return r2.join("/");
        }, a.getTypeOf = function(e2) {
          return "string" == typeof e2 ? "string" : "[object Array]" === Object.prototype.toString.call(e2) ? "array" : o.nodebuffer && r.isBuffer(e2) ? "nodebuffer" : o.uint8array && e2 instanceof Uint8Array ? "uint8array" : o.arraybuffer && e2 instanceof ArrayBuffer ? "arraybuffer" : void 0;
        }, a.checkSupport = function(e2) {
          if (!o[e2.toLowerCase()]) throw new Error(e2 + " is not supported by this platform");
        }, a.MAX_VALUE_16BITS = 65535, a.MAX_VALUE_32BITS = -1, a.pretty = function(e2) {
          var t3, r2, n2 = "";
          for (r2 = 0; r2 < (e2 || "").length; r2++) n2 += "\\x" + ((t3 = e2.charCodeAt(r2)) < 16 ? "0" : "") + t3.toString(16).toUpperCase();
          return n2;
        }, a.delay = function(e2, t3, r2) {
          setImmediate(function() {
            e2.apply(r2 || null, t3 || []);
          });
        }, a.inherits = function(e2, t3) {
          function r2() {
          }
          r2.prototype = t3.prototype, e2.prototype = new r2();
        }, a.extend = function() {
          var e2, t3, r2 = {};
          for (e2 = 0; e2 < arguments.length; e2++) for (t3 in arguments[e2]) Object.prototype.hasOwnProperty.call(arguments[e2], t3) && void 0 === r2[t3] && (r2[t3] = arguments[e2][t3]);
          return r2;
        }, a.prepareContent = function(r2, e2, n2, i2, s2) {
          return u.Promise.resolve(e2).then(function(n3) {
            return o.blob && (n3 instanceof Blob || -1 !== ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(n3))) && "undefined" != typeof FileReader ? new u.Promise(function(t3, r3) {
              var e3 = new FileReader();
              e3.onload = function(e4) {
                t3(e4.target.result);
              }, e3.onerror = function(e4) {
                r3(e4.target.error);
              }, e3.readAsArrayBuffer(n3);
            }) : n3;
          }).then(function(e3) {
            var t3 = a.getTypeOf(e3);
            return t3 ? ("arraybuffer" === t3 ? e3 = a.transformTo("uint8array", e3) : "string" === t3 && (s2 ? e3 = h.decode(e3) : n2 && true !== i2 && (e3 = (function(e4) {
              return l(e4, o.uint8array ? new Uint8Array(e4.length) : new Array(e4.length));
            })(e3))), e3) : u.Promise.reject(new Error("Can't read the data of '" + r2 + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
          });
        };
      }, { "./base64": 1, "./external": 6, "./nodejsUtils": 14, "./support": 30, setimmediate: 54 }], 33: [function(e, t2, r) {
        "use strict";
        var n = e("./reader/readerFor"), i = e("./utils"), s = e("./signature"), a = e("./zipEntry"), o = e("./support");
        function h(e2) {
          this.files = [], this.loadOptions = e2;
        }
        h.prototype = { checkSignature: function(e2) {
          if (!this.reader.readAndCheckSignature(e2)) {
            this.reader.index -= 4;
            var t3 = this.reader.readString(4);
            throw new Error("Corrupted zip or bug: unexpected signature (" + i.pretty(t3) + ", expected " + i.pretty(e2) + ")");
          }
        }, isSignature: function(e2, t3) {
          var r2 = this.reader.index;
          this.reader.setIndex(e2);
          var n2 = this.reader.readString(4) === t3;
          return this.reader.setIndex(r2), n2;
        }, readBlockEndOfCentral: function() {
          this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2);
          var e2 = this.reader.readData(this.zipCommentLength), t3 = o.uint8array ? "uint8array" : "array", r2 = i.transformTo(t3, e2);
          this.zipComment = this.loadOptions.decodeFileName(r2);
        }, readBlockZip64EndOfCentral: function() {
          this.zip64EndOfCentralSize = this.reader.readInt(8), this.reader.skip(4), this.diskNumber = this.reader.readInt(4), this.diskWithCentralDirStart = this.reader.readInt(4), this.centralDirRecordsOnThisDisk = this.reader.readInt(8), this.centralDirRecords = this.reader.readInt(8), this.centralDirSize = this.reader.readInt(8), this.centralDirOffset = this.reader.readInt(8), this.zip64ExtensibleData = {};
          for (var e2, t3, r2, n2 = this.zip64EndOfCentralSize - 44; 0 < n2; ) e2 = this.reader.readInt(2), t3 = this.reader.readInt(4), r2 = this.reader.readData(t3), this.zip64ExtensibleData[e2] = { id: e2, length: t3, value: r2 };
        }, readBlockZip64EndOfCentralLocator: function() {
          if (this.diskWithZip64CentralDirStart = this.reader.readInt(4), this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8), this.disksCount = this.reader.readInt(4), 1 < this.disksCount) throw new Error("Multi-volumes zip are not supported");
        }, readLocalFiles: function() {
          var e2, t3;
          for (e2 = 0; e2 < this.files.length; e2++) t3 = this.files[e2], this.reader.setIndex(t3.localHeaderOffset), this.checkSignature(s.LOCAL_FILE_HEADER), t3.readLocalPart(this.reader), t3.handleUTF8(), t3.processAttributes();
        }, readCentralDir: function() {
          var e2;
          for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(s.CENTRAL_FILE_HEADER); ) (e2 = new a({ zip64: this.zip64 }, this.loadOptions)).readCentralPart(this.reader), this.files.push(e2);
          if (this.centralDirRecords !== this.files.length && 0 !== this.centralDirRecords && 0 === this.files.length) throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
        }, readEndOfCentral: function() {
          var e2 = this.reader.lastIndexOfSignature(s.CENTRAL_DIRECTORY_END);
          if (e2 < 0) throw !this.isSignature(0, s.LOCAL_FILE_HEADER) ? new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html") : new Error("Corrupted zip: can't find end of central directory");
          this.reader.setIndex(e2);
          var t3 = e2;
          if (this.checkSignature(s.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === i.MAX_VALUE_16BITS || this.diskWithCentralDirStart === i.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === i.MAX_VALUE_16BITS || this.centralDirRecords === i.MAX_VALUE_16BITS || this.centralDirSize === i.MAX_VALUE_32BITS || this.centralDirOffset === i.MAX_VALUE_32BITS) {
            if (this.zip64 = true, (e2 = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR)) < 0) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
            if (this.reader.setIndex(e2), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, s.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0)) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
            this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral();
          }
          var r2 = this.centralDirOffset + this.centralDirSize;
          this.zip64 && (r2 += 20, r2 += 12 + this.zip64EndOfCentralSize);
          var n2 = t3 - r2;
          if (0 < n2) this.isSignature(t3, s.CENTRAL_FILE_HEADER) || (this.reader.zero = n2);
          else if (n2 < 0) throw new Error("Corrupted zip: missing " + Math.abs(n2) + " bytes.");
        }, prepareReader: function(e2) {
          this.reader = n(e2);
        }, load: function(e2) {
          this.prepareReader(e2), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
        } }, t2.exports = h;
      }, { "./reader/readerFor": 22, "./signature": 23, "./support": 30, "./utils": 32, "./zipEntry": 34 }], 34: [function(e, t2, r) {
        "use strict";
        var n = e("./reader/readerFor"), s = e("./utils"), i = e("./compressedObject"), a = e("./crc32"), o = e("./utf8"), h = e("./compressions"), u = e("./support");
        function l(e2, t3) {
          this.options = e2, this.loadOptions = t3;
        }
        l.prototype = { isEncrypted: function() {
          return 1 == (1 & this.bitFlag);
        }, useUTF8: function() {
          return 2048 == (2048 & this.bitFlag);
        }, readLocalPart: function(e2) {
          var t3, r2;
          if (e2.skip(22), this.fileNameLength = e2.readInt(2), r2 = e2.readInt(2), this.fileName = e2.readData(this.fileNameLength), e2.skip(r2), -1 === this.compressedSize || -1 === this.uncompressedSize) throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
          if (null === (t3 = (function(e3) {
            for (var t4 in h) if (Object.prototype.hasOwnProperty.call(h, t4) && h[t4].magic === e3) return h[t4];
            return null;
          })(this.compressionMethod))) throw new Error("Corrupted zip : compression " + s.pretty(this.compressionMethod) + " unknown (inner file : " + s.transformTo("string", this.fileName) + ")");
          this.decompressed = new i(this.compressedSize, this.uncompressedSize, this.crc32, t3, e2.readData(this.compressedSize));
        }, readCentralPart: function(e2) {
          this.versionMadeBy = e2.readInt(2), e2.skip(2), this.bitFlag = e2.readInt(2), this.compressionMethod = e2.readString(2), this.date = e2.readDate(), this.crc32 = e2.readInt(4), this.compressedSize = e2.readInt(4), this.uncompressedSize = e2.readInt(4);
          var t3 = e2.readInt(2);
          if (this.extraFieldsLength = e2.readInt(2), this.fileCommentLength = e2.readInt(2), this.diskNumberStart = e2.readInt(2), this.internalFileAttributes = e2.readInt(2), this.externalFileAttributes = e2.readInt(4), this.localHeaderOffset = e2.readInt(4), this.isEncrypted()) throw new Error("Encrypted zip are not supported");
          e2.skip(t3), this.readExtraFields(e2), this.parseZIP64ExtraField(e2), this.fileComment = e2.readData(this.fileCommentLength);
        }, processAttributes: function() {
          this.unixPermissions = null, this.dosPermissions = null;
          var e2 = this.versionMadeBy >> 8;
          this.dir = !!(16 & this.externalFileAttributes), 0 == e2 && (this.dosPermissions = 63 & this.externalFileAttributes), 3 == e2 && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), this.dir || "/" !== this.fileNameStr.slice(-1) || (this.dir = true);
        }, parseZIP64ExtraField: function() {
          if (this.extraFields[1]) {
            var e2 = n(this.extraFields[1].value);
            this.uncompressedSize === s.MAX_VALUE_32BITS && (this.uncompressedSize = e2.readInt(8)), this.compressedSize === s.MAX_VALUE_32BITS && (this.compressedSize = e2.readInt(8)), this.localHeaderOffset === s.MAX_VALUE_32BITS && (this.localHeaderOffset = e2.readInt(8)), this.diskNumberStart === s.MAX_VALUE_32BITS && (this.diskNumberStart = e2.readInt(4));
          }
        }, readExtraFields: function(e2) {
          var t3, r2, n2, i2 = e2.index + this.extraFieldsLength;
          for (this.extraFields || (this.extraFields = {}); e2.index + 4 < i2; ) t3 = e2.readInt(2), r2 = e2.readInt(2), n2 = e2.readData(r2), this.extraFields[t3] = { id: t3, length: r2, value: n2 };
          e2.setIndex(i2);
        }, handleUTF8: function() {
          var e2 = u.uint8array ? "uint8array" : "array";
          if (this.useUTF8()) this.fileNameStr = o.utf8decode(this.fileName), this.fileCommentStr = o.utf8decode(this.fileComment);
          else {
            var t3 = this.findExtraFieldUnicodePath();
            if (null !== t3) this.fileNameStr = t3;
            else {
              var r2 = s.transformTo(e2, this.fileName);
              this.fileNameStr = this.loadOptions.decodeFileName(r2);
            }
            var n2 = this.findExtraFieldUnicodeComment();
            if (null !== n2) this.fileCommentStr = n2;
            else {
              var i2 = s.transformTo(e2, this.fileComment);
              this.fileCommentStr = this.loadOptions.decodeFileName(i2);
            }
          }
        }, findExtraFieldUnicodePath: function() {
          var e2 = this.extraFields[28789];
          if (e2) {
            var t3 = n(e2.value);
            return 1 !== t3.readInt(1) ? null : a(this.fileName) !== t3.readInt(4) ? null : o.utf8decode(t3.readData(e2.length - 5));
          }
          return null;
        }, findExtraFieldUnicodeComment: function() {
          var e2 = this.extraFields[25461];
          if (e2) {
            var t3 = n(e2.value);
            return 1 !== t3.readInt(1) ? null : a(this.fileComment) !== t3.readInt(4) ? null : o.utf8decode(t3.readData(e2.length - 5));
          }
          return null;
        } }, t2.exports = l;
      }, { "./compressedObject": 2, "./compressions": 3, "./crc32": 4, "./reader/readerFor": 22, "./support": 30, "./utf8": 31, "./utils": 32 }], 35: [function(e, t2, r) {
        "use strict";
        function n(e2, t3, r2) {
          this.name = e2, this.dir = r2.dir, this.date = r2.date, this.comment = r2.comment, this.unixPermissions = r2.unixPermissions, this.dosPermissions = r2.dosPermissions, this._data = t3, this._dataBinary = r2.binary, this.options = { compression: r2.compression, compressionOptions: r2.compressionOptions };
        }
        var s = e("./stream/StreamHelper"), i = e("./stream/DataWorker"), a = e("./utf8"), o = e("./compressedObject"), h = e("./stream/GenericWorker");
        n.prototype = { internalStream: function(e2) {
          var t3 = null, r2 = "string";
          try {
            if (!e2) throw new Error("No output type specified.");
            var n2 = "string" === (r2 = e2.toLowerCase()) || "text" === r2;
            "binarystring" !== r2 && "text" !== r2 || (r2 = "string"), t3 = this._decompressWorker();
            var i2 = !this._dataBinary;
            i2 && !n2 && (t3 = t3.pipe(new a.Utf8EncodeWorker())), !i2 && n2 && (t3 = t3.pipe(new a.Utf8DecodeWorker()));
          } catch (e3) {
            (t3 = new h("error")).error(e3);
          }
          return new s(t3, r2, "");
        }, async: function(e2, t3) {
          return this.internalStream(e2).accumulate(t3);
        }, nodeStream: function(e2, t3) {
          return this.internalStream(e2 || "nodebuffer").toNodejsStream(t3);
        }, _compressWorker: function(e2, t3) {
          if (this._data instanceof o && this._data.compression.magic === e2.magic) return this._data.getCompressedWorker();
          var r2 = this._decompressWorker();
          return this._dataBinary || (r2 = r2.pipe(new a.Utf8EncodeWorker())), o.createWorkerFrom(r2, e2, t3);
        }, _decompressWorker: function() {
          return this._data instanceof o ? this._data.getContentWorker() : this._data instanceof h ? this._data : new i(this._data);
        } };
        for (var u = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], l = function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, f = 0; f < u.length; f++) n.prototype[u[f]] = l;
        t2.exports = n;
      }, { "./compressedObject": 2, "./stream/DataWorker": 27, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31 }], 36: [function(e, l, t2) {
        (function(t3) {
          "use strict";
          var r, n, e2 = t3.MutationObserver || t3.WebKitMutationObserver;
          if (e2) {
            var i = 0, s = new e2(u), a = t3.document.createTextNode("");
            s.observe(a, { characterData: true }), r = function() {
              a.data = i = ++i % 2;
            };
          } else if (t3.setImmediate || void 0 === t3.MessageChannel) r = "document" in t3 && "onreadystatechange" in t3.document.createElement("script") ? function() {
            var e3 = t3.document.createElement("script");
            e3.onreadystatechange = function() {
              u(), e3.onreadystatechange = null, e3.parentNode.removeChild(e3), e3 = null;
            }, t3.document.documentElement.appendChild(e3);
          } : function() {
            setTimeout(u, 0);
          };
          else {
            var o = new t3.MessageChannel();
            o.port1.onmessage = u, r = function() {
              o.port2.postMessage(0);
            };
          }
          var h = [];
          function u() {
            var e3, t4;
            n = true;
            for (var r2 = h.length; r2; ) {
              for (t4 = h, h = [], e3 = -1; ++e3 < r2; ) t4[e3]();
              r2 = h.length;
            }
            n = false;
          }
          l.exports = function(e3) {
            1 !== h.push(e3) || n || r();
          };
        }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
      }, {}], 37: [function(e, t2, r) {
        "use strict";
        var i = e("immediate");
        function u() {
        }
        var l = {}, s = ["REJECTED"], a = ["FULFILLED"], n = ["PENDING"];
        function o(e2) {
          if ("function" != typeof e2) throw new TypeError("resolver must be a function");
          this.state = n, this.queue = [], this.outcome = void 0, e2 !== u && d(this, e2);
        }
        function h(e2, t3, r2) {
          this.promise = e2, "function" == typeof t3 && (this.onFulfilled = t3, this.callFulfilled = this.otherCallFulfilled), "function" == typeof r2 && (this.onRejected = r2, this.callRejected = this.otherCallRejected);
        }
        function f(t3, r2, n2) {
          i(function() {
            var e2;
            try {
              e2 = r2(n2);
            } catch (e3) {
              return l.reject(t3, e3);
            }
            e2 === t3 ? l.reject(t3, new TypeError("Cannot resolve promise with itself")) : l.resolve(t3, e2);
          });
        }
        function c(e2) {
          var t3 = e2 && e2.then;
          if (e2 && ("object" == typeof e2 || "function" == typeof e2) && "function" == typeof t3) return function() {
            t3.apply(e2, arguments);
          };
        }
        function d(t3, e2) {
          var r2 = false;
          function n2(e3) {
            r2 || (r2 = true, l.reject(t3, e3));
          }
          function i2(e3) {
            r2 || (r2 = true, l.resolve(t3, e3));
          }
          var s2 = p(function() {
            e2(i2, n2);
          });
          "error" === s2.status && n2(s2.value);
        }
        function p(e2, t3) {
          var r2 = {};
          try {
            r2.value = e2(t3), r2.status = "success";
          } catch (e3) {
            r2.status = "error", r2.value = e3;
          }
          return r2;
        }
        (t2.exports = o).prototype.finally = function(t3) {
          if ("function" != typeof t3) return this;
          var r2 = this.constructor;
          return this.then(function(e2) {
            return r2.resolve(t3()).then(function() {
              return e2;
            });
          }, function(e2) {
            return r2.resolve(t3()).then(function() {
              throw e2;
            });
          });
        }, o.prototype.catch = function(e2) {
          return this.then(null, e2);
        }, o.prototype.then = function(e2, t3) {
          if ("function" != typeof e2 && this.state === a || "function" != typeof t3 && this.state === s) return this;
          var r2 = new this.constructor(u);
          this.state !== n ? f(r2, this.state === a ? e2 : t3, this.outcome) : this.queue.push(new h(r2, e2, t3));
          return r2;
        }, h.prototype.callFulfilled = function(e2) {
          l.resolve(this.promise, e2);
        }, h.prototype.otherCallFulfilled = function(e2) {
          f(this.promise, this.onFulfilled, e2);
        }, h.prototype.callRejected = function(e2) {
          l.reject(this.promise, e2);
        }, h.prototype.otherCallRejected = function(e2) {
          f(this.promise, this.onRejected, e2);
        }, l.resolve = function(e2, t3) {
          var r2 = p(c, t3);
          if ("error" === r2.status) return l.reject(e2, r2.value);
          var n2 = r2.value;
          if (n2) d(e2, n2);
          else {
            e2.state = a, e2.outcome = t3;
            for (var i2 = -1, s2 = e2.queue.length; ++i2 < s2; ) e2.queue[i2].callFulfilled(t3);
          }
          return e2;
        }, l.reject = function(e2, t3) {
          e2.state = s, e2.outcome = t3;
          for (var r2 = -1, n2 = e2.queue.length; ++r2 < n2; ) e2.queue[r2].callRejected(t3);
          return e2;
        }, o.resolve = function(e2) {
          if (e2 instanceof this) return e2;
          return l.resolve(new this(u), e2);
        }, o.reject = function(e2) {
          var t3 = new this(u);
          return l.reject(t3, e2);
        }, o.all = function(e2) {
          var r2 = this;
          if ("[object Array]" !== Object.prototype.toString.call(e2)) return this.reject(new TypeError("must be an array"));
          var n2 = e2.length, i2 = false;
          if (!n2) return this.resolve([]);
          var s2 = new Array(n2), a2 = 0, t3 = -1, o2 = new this(u);
          for (; ++t3 < n2; ) h2(e2[t3], t3);
          return o2;
          function h2(e3, t4) {
            r2.resolve(e3).then(function(e4) {
              s2[t4] = e4, ++a2 !== n2 || i2 || (i2 = true, l.resolve(o2, s2));
            }, function(e4) {
              i2 || (i2 = true, l.reject(o2, e4));
            });
          }
        }, o.race = function(e2) {
          var t3 = this;
          if ("[object Array]" !== Object.prototype.toString.call(e2)) return this.reject(new TypeError("must be an array"));
          var r2 = e2.length, n2 = false;
          if (!r2) return this.resolve([]);
          var i2 = -1, s2 = new this(u);
          for (; ++i2 < r2; ) a2 = e2[i2], t3.resolve(a2).then(function(e3) {
            n2 || (n2 = true, l.resolve(s2, e3));
          }, function(e3) {
            n2 || (n2 = true, l.reject(s2, e3));
          });
          var a2;
          return s2;
        };
      }, { immediate: 36 }], 38: [function(e, t2, r) {
        "use strict";
        var n = {};
        (0, e("./lib/utils/common").assign)(n, e("./lib/deflate"), e("./lib/inflate"), e("./lib/zlib/constants")), t2.exports = n;
      }, { "./lib/deflate": 39, "./lib/inflate": 40, "./lib/utils/common": 41, "./lib/zlib/constants": 44 }], 39: [function(e, t2, r) {
        "use strict";
        var a = e("./zlib/deflate"), o = e("./utils/common"), h = e("./utils/strings"), i = e("./zlib/messages"), s = e("./zlib/zstream"), u = Object.prototype.toString, l = 0, f = -1, c = 0, d = 8;
        function p(e2) {
          if (!(this instanceof p)) return new p(e2);
          this.options = o.assign({ level: f, method: d, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: c, to: "" }, e2 || {});
          var t3 = this.options;
          t3.raw && 0 < t3.windowBits ? t3.windowBits = -t3.windowBits : t3.gzip && 0 < t3.windowBits && t3.windowBits < 16 && (t3.windowBits += 16), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new s(), this.strm.avail_out = 0;
          var r2 = a.deflateInit2(this.strm, t3.level, t3.method, t3.windowBits, t3.memLevel, t3.strategy);
          if (r2 !== l) throw new Error(i[r2]);
          if (t3.header && a.deflateSetHeader(this.strm, t3.header), t3.dictionary) {
            var n2;
            if (n2 = "string" == typeof t3.dictionary ? h.string2buf(t3.dictionary) : "[object ArrayBuffer]" === u.call(t3.dictionary) ? new Uint8Array(t3.dictionary) : t3.dictionary, (r2 = a.deflateSetDictionary(this.strm, n2)) !== l) throw new Error(i[r2]);
            this._dict_set = true;
          }
        }
        function n(e2, t3) {
          var r2 = new p(t3);
          if (r2.push(e2, true), r2.err) throw r2.msg || i[r2.err];
          return r2.result;
        }
        p.prototype.push = function(e2, t3) {
          var r2, n2, i2 = this.strm, s2 = this.options.chunkSize;
          if (this.ended) return false;
          n2 = t3 === ~~t3 ? t3 : true === t3 ? 4 : 0, "string" == typeof e2 ? i2.input = h.string2buf(e2) : "[object ArrayBuffer]" === u.call(e2) ? i2.input = new Uint8Array(e2) : i2.input = e2, i2.next_in = 0, i2.avail_in = i2.input.length;
          do {
            if (0 === i2.avail_out && (i2.output = new o.Buf8(s2), i2.next_out = 0, i2.avail_out = s2), 1 !== (r2 = a.deflate(i2, n2)) && r2 !== l) return this.onEnd(r2), !(this.ended = true);
            0 !== i2.avail_out && (0 !== i2.avail_in || 4 !== n2 && 2 !== n2) || ("string" === this.options.to ? this.onData(h.buf2binstring(o.shrinkBuf(i2.output, i2.next_out))) : this.onData(o.shrinkBuf(i2.output, i2.next_out)));
          } while ((0 < i2.avail_in || 0 === i2.avail_out) && 1 !== r2);
          return 4 === n2 ? (r2 = a.deflateEnd(this.strm), this.onEnd(r2), this.ended = true, r2 === l) : 2 !== n2 || (this.onEnd(l), !(i2.avail_out = 0));
        }, p.prototype.onData = function(e2) {
          this.chunks.push(e2);
        }, p.prototype.onEnd = function(e2) {
          e2 === l && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = o.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
        }, r.Deflate = p, r.deflate = n, r.deflateRaw = function(e2, t3) {
          return (t3 = t3 || {}).raw = true, n(e2, t3);
        }, r.gzip = function(e2, t3) {
          return (t3 = t3 || {}).gzip = true, n(e2, t3);
        };
      }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/deflate": 46, "./zlib/messages": 51, "./zlib/zstream": 53 }], 40: [function(e, t2, r) {
        "use strict";
        var c = e("./zlib/inflate"), d = e("./utils/common"), p = e("./utils/strings"), m = e("./zlib/constants"), n = e("./zlib/messages"), i = e("./zlib/zstream"), s = e("./zlib/gzheader"), _ = Object.prototype.toString;
        function a(e2) {
          if (!(this instanceof a)) return new a(e2);
          this.options = d.assign({ chunkSize: 16384, windowBits: 0, to: "" }, e2 || {});
          var t3 = this.options;
          t3.raw && 0 <= t3.windowBits && t3.windowBits < 16 && (t3.windowBits = -t3.windowBits, 0 === t3.windowBits && (t3.windowBits = -15)), !(0 <= t3.windowBits && t3.windowBits < 16) || e2 && e2.windowBits || (t3.windowBits += 32), 15 < t3.windowBits && t3.windowBits < 48 && 0 == (15 & t3.windowBits) && (t3.windowBits |= 15), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new i(), this.strm.avail_out = 0;
          var r2 = c.inflateInit2(this.strm, t3.windowBits);
          if (r2 !== m.Z_OK) throw new Error(n[r2]);
          this.header = new s(), c.inflateGetHeader(this.strm, this.header);
        }
        function o(e2, t3) {
          var r2 = new a(t3);
          if (r2.push(e2, true), r2.err) throw r2.msg || n[r2.err];
          return r2.result;
        }
        a.prototype.push = function(e2, t3) {
          var r2, n2, i2, s2, a2, o2, h = this.strm, u = this.options.chunkSize, l = this.options.dictionary, f = false;
          if (this.ended) return false;
          n2 = t3 === ~~t3 ? t3 : true === t3 ? m.Z_FINISH : m.Z_NO_FLUSH, "string" == typeof e2 ? h.input = p.binstring2buf(e2) : "[object ArrayBuffer]" === _.call(e2) ? h.input = new Uint8Array(e2) : h.input = e2, h.next_in = 0, h.avail_in = h.input.length;
          do {
            if (0 === h.avail_out && (h.output = new d.Buf8(u), h.next_out = 0, h.avail_out = u), (r2 = c.inflate(h, m.Z_NO_FLUSH)) === m.Z_NEED_DICT && l && (o2 = "string" == typeof l ? p.string2buf(l) : "[object ArrayBuffer]" === _.call(l) ? new Uint8Array(l) : l, r2 = c.inflateSetDictionary(this.strm, o2)), r2 === m.Z_BUF_ERROR && true === f && (r2 = m.Z_OK, f = false), r2 !== m.Z_STREAM_END && r2 !== m.Z_OK) return this.onEnd(r2), !(this.ended = true);
            h.next_out && (0 !== h.avail_out && r2 !== m.Z_STREAM_END && (0 !== h.avail_in || n2 !== m.Z_FINISH && n2 !== m.Z_SYNC_FLUSH) || ("string" === this.options.to ? (i2 = p.utf8border(h.output, h.next_out), s2 = h.next_out - i2, a2 = p.buf2string(h.output, i2), h.next_out = s2, h.avail_out = u - s2, s2 && d.arraySet(h.output, h.output, i2, s2, 0), this.onData(a2)) : this.onData(d.shrinkBuf(h.output, h.next_out)))), 0 === h.avail_in && 0 === h.avail_out && (f = true);
          } while ((0 < h.avail_in || 0 === h.avail_out) && r2 !== m.Z_STREAM_END);
          return r2 === m.Z_STREAM_END && (n2 = m.Z_FINISH), n2 === m.Z_FINISH ? (r2 = c.inflateEnd(this.strm), this.onEnd(r2), this.ended = true, r2 === m.Z_OK) : n2 !== m.Z_SYNC_FLUSH || (this.onEnd(m.Z_OK), !(h.avail_out = 0));
        }, a.prototype.onData = function(e2) {
          this.chunks.push(e2);
        }, a.prototype.onEnd = function(e2) {
          e2 === m.Z_OK && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = d.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
        }, r.Inflate = a, r.inflate = o, r.inflateRaw = function(e2, t3) {
          return (t3 = t3 || {}).raw = true, o(e2, t3);
        }, r.ungzip = o;
      }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/constants": 44, "./zlib/gzheader": 47, "./zlib/inflate": 49, "./zlib/messages": 51, "./zlib/zstream": 53 }], 41: [function(e, t2, r) {
        "use strict";
        var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Int32Array;
        r.assign = function(e2) {
          for (var t3 = Array.prototype.slice.call(arguments, 1); t3.length; ) {
            var r2 = t3.shift();
            if (r2) {
              if ("object" != typeof r2) throw new TypeError(r2 + "must be non-object");
              for (var n2 in r2) r2.hasOwnProperty(n2) && (e2[n2] = r2[n2]);
            }
          }
          return e2;
        }, r.shrinkBuf = function(e2, t3) {
          return e2.length === t3 ? e2 : e2.subarray ? e2.subarray(0, t3) : (e2.length = t3, e2);
        };
        var i = { arraySet: function(e2, t3, r2, n2, i2) {
          if (t3.subarray && e2.subarray) e2.set(t3.subarray(r2, r2 + n2), i2);
          else for (var s2 = 0; s2 < n2; s2++) e2[i2 + s2] = t3[r2 + s2];
        }, flattenChunks: function(e2) {
          var t3, r2, n2, i2, s2, a;
          for (t3 = n2 = 0, r2 = e2.length; t3 < r2; t3++) n2 += e2[t3].length;
          for (a = new Uint8Array(n2), t3 = i2 = 0, r2 = e2.length; t3 < r2; t3++) s2 = e2[t3], a.set(s2, i2), i2 += s2.length;
          return a;
        } }, s = { arraySet: function(e2, t3, r2, n2, i2) {
          for (var s2 = 0; s2 < n2; s2++) e2[i2 + s2] = t3[r2 + s2];
        }, flattenChunks: function(e2) {
          return [].concat.apply([], e2);
        } };
        r.setTyped = function(e2) {
          e2 ? (r.Buf8 = Uint8Array, r.Buf16 = Uint16Array, r.Buf32 = Int32Array, r.assign(r, i)) : (r.Buf8 = Array, r.Buf16 = Array, r.Buf32 = Array, r.assign(r, s));
        }, r.setTyped(n);
      }, {}], 42: [function(e, t2, r) {
        "use strict";
        var h = e("./common"), i = true, s = true;
        try {
          String.fromCharCode.apply(null, [0]);
        } catch (e2) {
          i = false;
        }
        try {
          String.fromCharCode.apply(null, new Uint8Array(1));
        } catch (e2) {
          s = false;
        }
        for (var u = new h.Buf8(256), n = 0; n < 256; n++) u[n] = 252 <= n ? 6 : 248 <= n ? 5 : 240 <= n ? 4 : 224 <= n ? 3 : 192 <= n ? 2 : 1;
        function l(e2, t3) {
          if (t3 < 65537 && (e2.subarray && s || !e2.subarray && i)) return String.fromCharCode.apply(null, h.shrinkBuf(e2, t3));
          for (var r2 = "", n2 = 0; n2 < t3; n2++) r2 += String.fromCharCode(e2[n2]);
          return r2;
        }
        u[254] = u[254] = 1, r.string2buf = function(e2) {
          var t3, r2, n2, i2, s2, a = e2.length, o = 0;
          for (i2 = 0; i2 < a; i2++) 55296 == (64512 & (r2 = e2.charCodeAt(i2))) && i2 + 1 < a && 56320 == (64512 & (n2 = e2.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), o += r2 < 128 ? 1 : r2 < 2048 ? 2 : r2 < 65536 ? 3 : 4;
          for (t3 = new h.Buf8(o), i2 = s2 = 0; s2 < o; i2++) 55296 == (64512 & (r2 = e2.charCodeAt(i2))) && i2 + 1 < a && 56320 == (64512 & (n2 = e2.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), r2 < 128 ? t3[s2++] = r2 : (r2 < 2048 ? t3[s2++] = 192 | r2 >>> 6 : (r2 < 65536 ? t3[s2++] = 224 | r2 >>> 12 : (t3[s2++] = 240 | r2 >>> 18, t3[s2++] = 128 | r2 >>> 12 & 63), t3[s2++] = 128 | r2 >>> 6 & 63), t3[s2++] = 128 | 63 & r2);
          return t3;
        }, r.buf2binstring = function(e2) {
          return l(e2, e2.length);
        }, r.binstring2buf = function(e2) {
          for (var t3 = new h.Buf8(e2.length), r2 = 0, n2 = t3.length; r2 < n2; r2++) t3[r2] = e2.charCodeAt(r2);
          return t3;
        }, r.buf2string = function(e2, t3) {
          var r2, n2, i2, s2, a = t3 || e2.length, o = new Array(2 * a);
          for (r2 = n2 = 0; r2 < a; ) if ((i2 = e2[r2++]) < 128) o[n2++] = i2;
          else if (4 < (s2 = u[i2])) o[n2++] = 65533, r2 += s2 - 1;
          else {
            for (i2 &= 2 === s2 ? 31 : 3 === s2 ? 15 : 7; 1 < s2 && r2 < a; ) i2 = i2 << 6 | 63 & e2[r2++], s2--;
            1 < s2 ? o[n2++] = 65533 : i2 < 65536 ? o[n2++] = i2 : (i2 -= 65536, o[n2++] = 55296 | i2 >> 10 & 1023, o[n2++] = 56320 | 1023 & i2);
          }
          return l(o, n2);
        }, r.utf8border = function(e2, t3) {
          var r2;
          for ((t3 = t3 || e2.length) > e2.length && (t3 = e2.length), r2 = t3 - 1; 0 <= r2 && 128 == (192 & e2[r2]); ) r2--;
          return r2 < 0 ? t3 : 0 === r2 ? t3 : r2 + u[e2[r2]] > t3 ? r2 : t3;
        };
      }, { "./common": 41 }], 43: [function(e, t2, r) {
        "use strict";
        t2.exports = function(e2, t3, r2, n) {
          for (var i = 65535 & e2 | 0, s = e2 >>> 16 & 65535 | 0, a = 0; 0 !== r2; ) {
            for (r2 -= a = 2e3 < r2 ? 2e3 : r2; s = s + (i = i + t3[n++] | 0) | 0, --a; ) ;
            i %= 65521, s %= 65521;
          }
          return i | s << 16 | 0;
        };
      }, {}], 44: [function(e, t2, r) {
        "use strict";
        t2.exports = { Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_TREES: 6, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_BUF_ERROR: -5, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, Z_BINARY: 0, Z_TEXT: 1, Z_UNKNOWN: 2, Z_DEFLATED: 8 };
      }, {}], 45: [function(e, t2, r) {
        "use strict";
        var o = (function() {
          for (var e2, t3 = [], r2 = 0; r2 < 256; r2++) {
            e2 = r2;
            for (var n = 0; n < 8; n++) e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
            t3[r2] = e2;
          }
          return t3;
        })();
        t2.exports = function(e2, t3, r2, n) {
          var i = o, s = n + r2;
          e2 ^= -1;
          for (var a = n; a < s; a++) e2 = e2 >>> 8 ^ i[255 & (e2 ^ t3[a])];
          return -1 ^ e2;
        };
      }, {}], 46: [function(e, t2, r) {
        "use strict";
        var h, c = e("../utils/common"), u = e("./trees"), d = e("./adler32"), p = e("./crc32"), n = e("./messages"), l = 0, f = 4, m = 0, _ = -2, g = -1, b = 4, i = 2, v = 8, y = 9, s = 286, a = 30, o = 19, w = 2 * s + 1, k = 15, x = 3, S = 258, z = S + x + 1, C = 42, E = 113, A = 1, I = 2, O = 3, B = 4;
        function R(e2, t3) {
          return e2.msg = n[t3], t3;
        }
        function T(e2) {
          return (e2 << 1) - (4 < e2 ? 9 : 0);
        }
        function D(e2) {
          for (var t3 = e2.length; 0 <= --t3; ) e2[t3] = 0;
        }
        function F(e2) {
          var t3 = e2.state, r2 = t3.pending;
          r2 > e2.avail_out && (r2 = e2.avail_out), 0 !== r2 && (c.arraySet(e2.output, t3.pending_buf, t3.pending_out, r2, e2.next_out), e2.next_out += r2, t3.pending_out += r2, e2.total_out += r2, e2.avail_out -= r2, t3.pending -= r2, 0 === t3.pending && (t3.pending_out = 0));
        }
        function N(e2, t3) {
          u._tr_flush_block(e2, 0 <= e2.block_start ? e2.block_start : -1, e2.strstart - e2.block_start, t3), e2.block_start = e2.strstart, F(e2.strm);
        }
        function U(e2, t3) {
          e2.pending_buf[e2.pending++] = t3;
        }
        function P(e2, t3) {
          e2.pending_buf[e2.pending++] = t3 >>> 8 & 255, e2.pending_buf[e2.pending++] = 255 & t3;
        }
        function L(e2, t3) {
          var r2, n2, i2 = e2.max_chain_length, s2 = e2.strstart, a2 = e2.prev_length, o2 = e2.nice_match, h2 = e2.strstart > e2.w_size - z ? e2.strstart - (e2.w_size - z) : 0, u2 = e2.window, l2 = e2.w_mask, f2 = e2.prev, c2 = e2.strstart + S, d2 = u2[s2 + a2 - 1], p2 = u2[s2 + a2];
          e2.prev_length >= e2.good_match && (i2 >>= 2), o2 > e2.lookahead && (o2 = e2.lookahead);
          do {
            if (u2[(r2 = t3) + a2] === p2 && u2[r2 + a2 - 1] === d2 && u2[r2] === u2[s2] && u2[++r2] === u2[s2 + 1]) {
              s2 += 2, r2++;
              do {
              } while (u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && s2 < c2);
              if (n2 = S - (c2 - s2), s2 = c2 - S, a2 < n2) {
                if (e2.match_start = t3, o2 <= (a2 = n2)) break;
                d2 = u2[s2 + a2 - 1], p2 = u2[s2 + a2];
              }
            }
          } while ((t3 = f2[t3 & l2]) > h2 && 0 != --i2);
          return a2 <= e2.lookahead ? a2 : e2.lookahead;
        }
        function j(e2) {
          var t3, r2, n2, i2, s2, a2, o2, h2, u2, l2, f2 = e2.w_size;
          do {
            if (i2 = e2.window_size - e2.lookahead - e2.strstart, e2.strstart >= f2 + (f2 - z)) {
              for (c.arraySet(e2.window, e2.window, f2, f2, 0), e2.match_start -= f2, e2.strstart -= f2, e2.block_start -= f2, t3 = r2 = e2.hash_size; n2 = e2.head[--t3], e2.head[t3] = f2 <= n2 ? n2 - f2 : 0, --r2; ) ;
              for (t3 = r2 = f2; n2 = e2.prev[--t3], e2.prev[t3] = f2 <= n2 ? n2 - f2 : 0, --r2; ) ;
              i2 += f2;
            }
            if (0 === e2.strm.avail_in) break;
            if (a2 = e2.strm, o2 = e2.window, h2 = e2.strstart + e2.lookahead, u2 = i2, l2 = void 0, l2 = a2.avail_in, u2 < l2 && (l2 = u2), r2 = 0 === l2 ? 0 : (a2.avail_in -= l2, c.arraySet(o2, a2.input, a2.next_in, l2, h2), 1 === a2.state.wrap ? a2.adler = d(a2.adler, o2, l2, h2) : 2 === a2.state.wrap && (a2.adler = p(a2.adler, o2, l2, h2)), a2.next_in += l2, a2.total_in += l2, l2), e2.lookahead += r2, e2.lookahead + e2.insert >= x) for (s2 = e2.strstart - e2.insert, e2.ins_h = e2.window[s2], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + 1]) & e2.hash_mask; e2.insert && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + x - 1]) & e2.hash_mask, e2.prev[s2 & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = s2, s2++, e2.insert--, !(e2.lookahead + e2.insert < x)); ) ;
          } while (e2.lookahead < z && 0 !== e2.strm.avail_in);
        }
        function Z(e2, t3) {
          for (var r2, n2; ; ) {
            if (e2.lookahead < z) {
              if (j(e2), e2.lookahead < z && t3 === l) return A;
              if (0 === e2.lookahead) break;
            }
            if (r2 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), 0 !== r2 && e2.strstart - r2 <= e2.w_size - z && (e2.match_length = L(e2, r2)), e2.match_length >= x) if (n2 = u._tr_tally(e2, e2.strstart - e2.match_start, e2.match_length - x), e2.lookahead -= e2.match_length, e2.match_length <= e2.max_lazy_match && e2.lookahead >= x) {
              for (e2.match_length--; e2.strstart++, e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart, 0 != --e2.match_length; ) ;
              e2.strstart++;
            } else e2.strstart += e2.match_length, e2.match_length = 0, e2.ins_h = e2.window[e2.strstart], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + 1]) & e2.hash_mask;
            else n2 = u._tr_tally(e2, 0, e2.window[e2.strstart]), e2.lookahead--, e2.strstart++;
            if (n2 && (N(e2, false), 0 === e2.strm.avail_out)) return A;
          }
          return e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t3 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : e2.last_lit && (N(e2, false), 0 === e2.strm.avail_out) ? A : I;
        }
        function W(e2, t3) {
          for (var r2, n2, i2; ; ) {
            if (e2.lookahead < z) {
              if (j(e2), e2.lookahead < z && t3 === l) return A;
              if (0 === e2.lookahead) break;
            }
            if (r2 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), e2.prev_length = e2.match_length, e2.prev_match = e2.match_start, e2.match_length = x - 1, 0 !== r2 && e2.prev_length < e2.max_lazy_match && e2.strstart - r2 <= e2.w_size - z && (e2.match_length = L(e2, r2), e2.match_length <= 5 && (1 === e2.strategy || e2.match_length === x && 4096 < e2.strstart - e2.match_start) && (e2.match_length = x - 1)), e2.prev_length >= x && e2.match_length <= e2.prev_length) {
              for (i2 = e2.strstart + e2.lookahead - x, n2 = u._tr_tally(e2, e2.strstart - 1 - e2.prev_match, e2.prev_length - x), e2.lookahead -= e2.prev_length - 1, e2.prev_length -= 2; ++e2.strstart <= i2 && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), 0 != --e2.prev_length; ) ;
              if (e2.match_available = 0, e2.match_length = x - 1, e2.strstart++, n2 && (N(e2, false), 0 === e2.strm.avail_out)) return A;
            } else if (e2.match_available) {
              if ((n2 = u._tr_tally(e2, 0, e2.window[e2.strstart - 1])) && N(e2, false), e2.strstart++, e2.lookahead--, 0 === e2.strm.avail_out) return A;
            } else e2.match_available = 1, e2.strstart++, e2.lookahead--;
          }
          return e2.match_available && (n2 = u._tr_tally(e2, 0, e2.window[e2.strstart - 1]), e2.match_available = 0), e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t3 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : e2.last_lit && (N(e2, false), 0 === e2.strm.avail_out) ? A : I;
        }
        function M(e2, t3, r2, n2, i2) {
          this.good_length = e2, this.max_lazy = t3, this.nice_length = r2, this.max_chain = n2, this.func = i2;
        }
        function H() {
          this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = v, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new c.Buf16(2 * w), this.dyn_dtree = new c.Buf16(2 * (2 * a + 1)), this.bl_tree = new c.Buf16(2 * (2 * o + 1)), D(this.dyn_ltree), D(this.dyn_dtree), D(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new c.Buf16(k + 1), this.heap = new c.Buf16(2 * s + 1), D(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new c.Buf16(2 * s + 1), D(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
        }
        function G(e2) {
          var t3;
          return e2 && e2.state ? (e2.total_in = e2.total_out = 0, e2.data_type = i, (t3 = e2.state).pending = 0, t3.pending_out = 0, t3.wrap < 0 && (t3.wrap = -t3.wrap), t3.status = t3.wrap ? C : E, e2.adler = 2 === t3.wrap ? 0 : 1, t3.last_flush = l, u._tr_init(t3), m) : R(e2, _);
        }
        function K(e2) {
          var t3 = G(e2);
          return t3 === m && (function(e3) {
            e3.window_size = 2 * e3.w_size, D(e3.head), e3.max_lazy_match = h[e3.level].max_lazy, e3.good_match = h[e3.level].good_length, e3.nice_match = h[e3.level].nice_length, e3.max_chain_length = h[e3.level].max_chain, e3.strstart = 0, e3.block_start = 0, e3.lookahead = 0, e3.insert = 0, e3.match_length = e3.prev_length = x - 1, e3.match_available = 0, e3.ins_h = 0;
          })(e2.state), t3;
        }
        function Y(e2, t3, r2, n2, i2, s2) {
          if (!e2) return _;
          var a2 = 1;
          if (t3 === g && (t3 = 6), n2 < 0 ? (a2 = 0, n2 = -n2) : 15 < n2 && (a2 = 2, n2 -= 16), i2 < 1 || y < i2 || r2 !== v || n2 < 8 || 15 < n2 || t3 < 0 || 9 < t3 || s2 < 0 || b < s2) return R(e2, _);
          8 === n2 && (n2 = 9);
          var o2 = new H();
          return (e2.state = o2).strm = e2, o2.wrap = a2, o2.gzhead = null, o2.w_bits = n2, o2.w_size = 1 << o2.w_bits, o2.w_mask = o2.w_size - 1, o2.hash_bits = i2 + 7, o2.hash_size = 1 << o2.hash_bits, o2.hash_mask = o2.hash_size - 1, o2.hash_shift = ~~((o2.hash_bits + x - 1) / x), o2.window = new c.Buf8(2 * o2.w_size), o2.head = new c.Buf16(o2.hash_size), o2.prev = new c.Buf16(o2.w_size), o2.lit_bufsize = 1 << i2 + 6, o2.pending_buf_size = 4 * o2.lit_bufsize, o2.pending_buf = new c.Buf8(o2.pending_buf_size), o2.d_buf = 1 * o2.lit_bufsize, o2.l_buf = 3 * o2.lit_bufsize, o2.level = t3, o2.strategy = s2, o2.method = r2, K(e2);
        }
        h = [new M(0, 0, 0, 0, function(e2, t3) {
          var r2 = 65535;
          for (r2 > e2.pending_buf_size - 5 && (r2 = e2.pending_buf_size - 5); ; ) {
            if (e2.lookahead <= 1) {
              if (j(e2), 0 === e2.lookahead && t3 === l) return A;
              if (0 === e2.lookahead) break;
            }
            e2.strstart += e2.lookahead, e2.lookahead = 0;
            var n2 = e2.block_start + r2;
            if ((0 === e2.strstart || e2.strstart >= n2) && (e2.lookahead = e2.strstart - n2, e2.strstart = n2, N(e2, false), 0 === e2.strm.avail_out)) return A;
            if (e2.strstart - e2.block_start >= e2.w_size - z && (N(e2, false), 0 === e2.strm.avail_out)) return A;
          }
          return e2.insert = 0, t3 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : (e2.strstart > e2.block_start && (N(e2, false), e2.strm.avail_out), A);
        }), new M(4, 4, 8, 4, Z), new M(4, 5, 16, 8, Z), new M(4, 6, 32, 32, Z), new M(4, 4, 16, 16, W), new M(8, 16, 32, 32, W), new M(8, 16, 128, 128, W), new M(8, 32, 128, 256, W), new M(32, 128, 258, 1024, W), new M(32, 258, 258, 4096, W)], r.deflateInit = function(e2, t3) {
          return Y(e2, t3, v, 15, 8, 0);
        }, r.deflateInit2 = Y, r.deflateReset = K, r.deflateResetKeep = G, r.deflateSetHeader = function(e2, t3) {
          return e2 && e2.state ? 2 !== e2.state.wrap ? _ : (e2.state.gzhead = t3, m) : _;
        }, r.deflate = function(e2, t3) {
          var r2, n2, i2, s2;
          if (!e2 || !e2.state || 5 < t3 || t3 < 0) return e2 ? R(e2, _) : _;
          if (n2 = e2.state, !e2.output || !e2.input && 0 !== e2.avail_in || 666 === n2.status && t3 !== f) return R(e2, 0 === e2.avail_out ? -5 : _);
          if (n2.strm = e2, r2 = n2.last_flush, n2.last_flush = t3, n2.status === C) if (2 === n2.wrap) e2.adler = 0, U(n2, 31), U(n2, 139), U(n2, 8), n2.gzhead ? (U(n2, (n2.gzhead.text ? 1 : 0) + (n2.gzhead.hcrc ? 2 : 0) + (n2.gzhead.extra ? 4 : 0) + (n2.gzhead.name ? 8 : 0) + (n2.gzhead.comment ? 16 : 0)), U(n2, 255 & n2.gzhead.time), U(n2, n2.gzhead.time >> 8 & 255), U(n2, n2.gzhead.time >> 16 & 255), U(n2, n2.gzhead.time >> 24 & 255), U(n2, 9 === n2.level ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 255 & n2.gzhead.os), n2.gzhead.extra && n2.gzhead.extra.length && (U(n2, 255 & n2.gzhead.extra.length), U(n2, n2.gzhead.extra.length >> 8 & 255)), n2.gzhead.hcrc && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending, 0)), n2.gzindex = 0, n2.status = 69) : (U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 9 === n2.level ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 3), n2.status = E);
          else {
            var a2 = v + (n2.w_bits - 8 << 4) << 8;
            a2 |= (2 <= n2.strategy || n2.level < 2 ? 0 : n2.level < 6 ? 1 : 6 === n2.level ? 2 : 3) << 6, 0 !== n2.strstart && (a2 |= 32), a2 += 31 - a2 % 31, n2.status = E, P(n2, a2), 0 !== n2.strstart && (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), e2.adler = 1;
          }
          if (69 === n2.status) if (n2.gzhead.extra) {
            for (i2 = n2.pending; n2.gzindex < (65535 & n2.gzhead.extra.length) && (n2.pending !== n2.pending_buf_size || (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending !== n2.pending_buf_size)); ) U(n2, 255 & n2.gzhead.extra[n2.gzindex]), n2.gzindex++;
            n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), n2.gzindex === n2.gzhead.extra.length && (n2.gzindex = 0, n2.status = 73);
          } else n2.status = 73;
          if (73 === n2.status) if (n2.gzhead.name) {
            i2 = n2.pending;
            do {
              if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                s2 = 1;
                break;
              }
              s2 = n2.gzindex < n2.gzhead.name.length ? 255 & n2.gzhead.name.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
            } while (0 !== s2);
            n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), 0 === s2 && (n2.gzindex = 0, n2.status = 91);
          } else n2.status = 91;
          if (91 === n2.status) if (n2.gzhead.comment) {
            i2 = n2.pending;
            do {
              if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                s2 = 1;
                break;
              }
              s2 = n2.gzindex < n2.gzhead.comment.length ? 255 & n2.gzhead.comment.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
            } while (0 !== s2);
            n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), 0 === s2 && (n2.status = 103);
          } else n2.status = 103;
          if (103 === n2.status && (n2.gzhead.hcrc ? (n2.pending + 2 > n2.pending_buf_size && F(e2), n2.pending + 2 <= n2.pending_buf_size && (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), e2.adler = 0, n2.status = E)) : n2.status = E), 0 !== n2.pending) {
            if (F(e2), 0 === e2.avail_out) return n2.last_flush = -1, m;
          } else if (0 === e2.avail_in && T(t3) <= T(r2) && t3 !== f) return R(e2, -5);
          if (666 === n2.status && 0 !== e2.avail_in) return R(e2, -5);
          if (0 !== e2.avail_in || 0 !== n2.lookahead || t3 !== l && 666 !== n2.status) {
            var o2 = 2 === n2.strategy ? (function(e3, t4) {
              for (var r3; ; ) {
                if (0 === e3.lookahead && (j(e3), 0 === e3.lookahead)) {
                  if (t4 === l) return A;
                  break;
                }
                if (e3.match_length = 0, r3 = u._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++, r3 && (N(e3, false), 0 === e3.strm.avail_out)) return A;
              }
              return e3.insert = 0, t4 === f ? (N(e3, true), 0 === e3.strm.avail_out ? O : B) : e3.last_lit && (N(e3, false), 0 === e3.strm.avail_out) ? A : I;
            })(n2, t3) : 3 === n2.strategy ? (function(e3, t4) {
              for (var r3, n3, i3, s3, a3 = e3.window; ; ) {
                if (e3.lookahead <= S) {
                  if (j(e3), e3.lookahead <= S && t4 === l) return A;
                  if (0 === e3.lookahead) break;
                }
                if (e3.match_length = 0, e3.lookahead >= x && 0 < e3.strstart && (n3 = a3[i3 = e3.strstart - 1]) === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3]) {
                  s3 = e3.strstart + S;
                  do {
                  } while (n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && i3 < s3);
                  e3.match_length = S - (s3 - i3), e3.match_length > e3.lookahead && (e3.match_length = e3.lookahead);
                }
                if (e3.match_length >= x ? (r3 = u._tr_tally(e3, 1, e3.match_length - x), e3.lookahead -= e3.match_length, e3.strstart += e3.match_length, e3.match_length = 0) : (r3 = u._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++), r3 && (N(e3, false), 0 === e3.strm.avail_out)) return A;
              }
              return e3.insert = 0, t4 === f ? (N(e3, true), 0 === e3.strm.avail_out ? O : B) : e3.last_lit && (N(e3, false), 0 === e3.strm.avail_out) ? A : I;
            })(n2, t3) : h[n2.level].func(n2, t3);
            if (o2 !== O && o2 !== B || (n2.status = 666), o2 === A || o2 === O) return 0 === e2.avail_out && (n2.last_flush = -1), m;
            if (o2 === I && (1 === t3 ? u._tr_align(n2) : 5 !== t3 && (u._tr_stored_block(n2, 0, 0, false), 3 === t3 && (D(n2.head), 0 === n2.lookahead && (n2.strstart = 0, n2.block_start = 0, n2.insert = 0))), F(e2), 0 === e2.avail_out)) return n2.last_flush = -1, m;
          }
          return t3 !== f ? m : n2.wrap <= 0 ? 1 : (2 === n2.wrap ? (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), U(n2, e2.adler >> 16 & 255), U(n2, e2.adler >> 24 & 255), U(n2, 255 & e2.total_in), U(n2, e2.total_in >> 8 & 255), U(n2, e2.total_in >> 16 & 255), U(n2, e2.total_in >> 24 & 255)) : (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), F(e2), 0 < n2.wrap && (n2.wrap = -n2.wrap), 0 !== n2.pending ? m : 1);
        }, r.deflateEnd = function(e2) {
          var t3;
          return e2 && e2.state ? (t3 = e2.state.status) !== C && 69 !== t3 && 73 !== t3 && 91 !== t3 && 103 !== t3 && t3 !== E && 666 !== t3 ? R(e2, _) : (e2.state = null, t3 === E ? R(e2, -3) : m) : _;
        }, r.deflateSetDictionary = function(e2, t3) {
          var r2, n2, i2, s2, a2, o2, h2, u2, l2 = t3.length;
          if (!e2 || !e2.state) return _;
          if (2 === (s2 = (r2 = e2.state).wrap) || 1 === s2 && r2.status !== C || r2.lookahead) return _;
          for (1 === s2 && (e2.adler = d(e2.adler, t3, l2, 0)), r2.wrap = 0, l2 >= r2.w_size && (0 === s2 && (D(r2.head), r2.strstart = 0, r2.block_start = 0, r2.insert = 0), u2 = new c.Buf8(r2.w_size), c.arraySet(u2, t3, l2 - r2.w_size, r2.w_size, 0), t3 = u2, l2 = r2.w_size), a2 = e2.avail_in, o2 = e2.next_in, h2 = e2.input, e2.avail_in = l2, e2.next_in = 0, e2.input = t3, j(r2); r2.lookahead >= x; ) {
            for (n2 = r2.strstart, i2 = r2.lookahead - (x - 1); r2.ins_h = (r2.ins_h << r2.hash_shift ^ r2.window[n2 + x - 1]) & r2.hash_mask, r2.prev[n2 & r2.w_mask] = r2.head[r2.ins_h], r2.head[r2.ins_h] = n2, n2++, --i2; ) ;
            r2.strstart = n2, r2.lookahead = x - 1, j(r2);
          }
          return r2.strstart += r2.lookahead, r2.block_start = r2.strstart, r2.insert = r2.lookahead, r2.lookahead = 0, r2.match_length = r2.prev_length = x - 1, r2.match_available = 0, e2.next_in = o2, e2.input = h2, e2.avail_in = a2, r2.wrap = s2, m;
        }, r.deflateInfo = "pako deflate (from Nodeca project)";
      }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./messages": 51, "./trees": 52 }], 47: [function(e, t2, r) {
        "use strict";
        t2.exports = function() {
          this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = false;
        };
      }, {}], 48: [function(e, t2, r) {
        "use strict";
        t2.exports = function(e2, t3) {
          var r2, n, i, s, a, o, h, u, l, f, c, d, p, m, _, g, b, v, y, w, k, x, S, z, C;
          r2 = e2.state, n = e2.next_in, z = e2.input, i = n + (e2.avail_in - 5), s = e2.next_out, C = e2.output, a = s - (t3 - e2.avail_out), o = s + (e2.avail_out - 257), h = r2.dmax, u = r2.wsize, l = r2.whave, f = r2.wnext, c = r2.window, d = r2.hold, p = r2.bits, m = r2.lencode, _ = r2.distcode, g = (1 << r2.lenbits) - 1, b = (1 << r2.distbits) - 1;
          e: do {
            p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = m[d & g];
            t: for (; ; ) {
              if (d >>>= y = v >>> 24, p -= y, 0 === (y = v >>> 16 & 255)) C[s++] = 65535 & v;
              else {
                if (!(16 & y)) {
                  if (0 == (64 & y)) {
                    v = m[(65535 & v) + (d & (1 << y) - 1)];
                    continue t;
                  }
                  if (32 & y) {
                    r2.mode = 12;
                    break e;
                  }
                  e2.msg = "invalid literal/length code", r2.mode = 30;
                  break e;
                }
                w = 65535 & v, (y &= 15) && (p < y && (d += z[n++] << p, p += 8), w += d & (1 << y) - 1, d >>>= y, p -= y), p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = _[d & b];
                r: for (; ; ) {
                  if (d >>>= y = v >>> 24, p -= y, !(16 & (y = v >>> 16 & 255))) {
                    if (0 == (64 & y)) {
                      v = _[(65535 & v) + (d & (1 << y) - 1)];
                      continue r;
                    }
                    e2.msg = "invalid distance code", r2.mode = 30;
                    break e;
                  }
                  if (k = 65535 & v, p < (y &= 15) && (d += z[n++] << p, (p += 8) < y && (d += z[n++] << p, p += 8)), h < (k += d & (1 << y) - 1)) {
                    e2.msg = "invalid distance too far back", r2.mode = 30;
                    break e;
                  }
                  if (d >>>= y, p -= y, (y = s - a) < k) {
                    if (l < (y = k - y) && r2.sane) {
                      e2.msg = "invalid distance too far back", r2.mode = 30;
                      break e;
                    }
                    if (S = c, (x = 0) === f) {
                      if (x += u - y, y < w) {
                        for (w -= y; C[s++] = c[x++], --y; ) ;
                        x = s - k, S = C;
                      }
                    } else if (f < y) {
                      if (x += u + f - y, (y -= f) < w) {
                        for (w -= y; C[s++] = c[x++], --y; ) ;
                        if (x = 0, f < w) {
                          for (w -= y = f; C[s++] = c[x++], --y; ) ;
                          x = s - k, S = C;
                        }
                      }
                    } else if (x += f - y, y < w) {
                      for (w -= y; C[s++] = c[x++], --y; ) ;
                      x = s - k, S = C;
                    }
                    for (; 2 < w; ) C[s++] = S[x++], C[s++] = S[x++], C[s++] = S[x++], w -= 3;
                    w && (C[s++] = S[x++], 1 < w && (C[s++] = S[x++]));
                  } else {
                    for (x = s - k; C[s++] = C[x++], C[s++] = C[x++], C[s++] = C[x++], 2 < (w -= 3); ) ;
                    w && (C[s++] = C[x++], 1 < w && (C[s++] = C[x++]));
                  }
                  break;
                }
              }
              break;
            }
          } while (n < i && s < o);
          n -= w = p >> 3, d &= (1 << (p -= w << 3)) - 1, e2.next_in = n, e2.next_out = s, e2.avail_in = n < i ? i - n + 5 : 5 - (n - i), e2.avail_out = s < o ? o - s + 257 : 257 - (s - o), r2.hold = d, r2.bits = p;
        };
      }, {}], 49: [function(e, t2, r) {
        "use strict";
        var I = e("../utils/common"), O = e("./adler32"), B = e("./crc32"), R = e("./inffast"), T = e("./inftrees"), D = 1, F = 2, N = 0, U = -2, P = 1, n = 852, i = 592;
        function L(e2) {
          return (e2 >>> 24 & 255) + (e2 >>> 8 & 65280) + ((65280 & e2) << 8) + ((255 & e2) << 24);
        }
        function s() {
          this.mode = 0, this.last = false, this.wrap = 0, this.havedict = false, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new I.Buf16(320), this.work = new I.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
        }
        function a(e2) {
          var t3;
          return e2 && e2.state ? (t3 = e2.state, e2.total_in = e2.total_out = t3.total = 0, e2.msg = "", t3.wrap && (e2.adler = 1 & t3.wrap), t3.mode = P, t3.last = 0, t3.havedict = 0, t3.dmax = 32768, t3.head = null, t3.hold = 0, t3.bits = 0, t3.lencode = t3.lendyn = new I.Buf32(n), t3.distcode = t3.distdyn = new I.Buf32(i), t3.sane = 1, t3.back = -1, N) : U;
        }
        function o(e2) {
          var t3;
          return e2 && e2.state ? ((t3 = e2.state).wsize = 0, t3.whave = 0, t3.wnext = 0, a(e2)) : U;
        }
        function h(e2, t3) {
          var r2, n2;
          return e2 && e2.state ? (n2 = e2.state, t3 < 0 ? (r2 = 0, t3 = -t3) : (r2 = 1 + (t3 >> 4), t3 < 48 && (t3 &= 15)), t3 && (t3 < 8 || 15 < t3) ? U : (null !== n2.window && n2.wbits !== t3 && (n2.window = null), n2.wrap = r2, n2.wbits = t3, o(e2))) : U;
        }
        function u(e2, t3) {
          var r2, n2;
          return e2 ? (n2 = new s(), (e2.state = n2).window = null, (r2 = h(e2, t3)) !== N && (e2.state = null), r2) : U;
        }
        var l, f, c = true;
        function j(e2) {
          if (c) {
            var t3;
            for (l = new I.Buf32(512), f = new I.Buf32(32), t3 = 0; t3 < 144; ) e2.lens[t3++] = 8;
            for (; t3 < 256; ) e2.lens[t3++] = 9;
            for (; t3 < 280; ) e2.lens[t3++] = 7;
            for (; t3 < 288; ) e2.lens[t3++] = 8;
            for (T(D, e2.lens, 0, 288, l, 0, e2.work, { bits: 9 }), t3 = 0; t3 < 32; ) e2.lens[t3++] = 5;
            T(F, e2.lens, 0, 32, f, 0, e2.work, { bits: 5 }), c = false;
          }
          e2.lencode = l, e2.lenbits = 9, e2.distcode = f, e2.distbits = 5;
        }
        function Z(e2, t3, r2, n2) {
          var i2, s2 = e2.state;
          return null === s2.window && (s2.wsize = 1 << s2.wbits, s2.wnext = 0, s2.whave = 0, s2.window = new I.Buf8(s2.wsize)), n2 >= s2.wsize ? (I.arraySet(s2.window, t3, r2 - s2.wsize, s2.wsize, 0), s2.wnext = 0, s2.whave = s2.wsize) : (n2 < (i2 = s2.wsize - s2.wnext) && (i2 = n2), I.arraySet(s2.window, t3, r2 - n2, i2, s2.wnext), (n2 -= i2) ? (I.arraySet(s2.window, t3, r2 - n2, n2, 0), s2.wnext = n2, s2.whave = s2.wsize) : (s2.wnext += i2, s2.wnext === s2.wsize && (s2.wnext = 0), s2.whave < s2.wsize && (s2.whave += i2))), 0;
        }
        r.inflateReset = o, r.inflateReset2 = h, r.inflateResetKeep = a, r.inflateInit = function(e2) {
          return u(e2, 15);
        }, r.inflateInit2 = u, r.inflate = function(e2, t3) {
          var r2, n2, i2, s2, a2, o2, h2, u2, l2, f2, c2, d, p, m, _, g, b, v, y, w, k, x, S, z, C = 0, E = new I.Buf8(4), A = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
          if (!e2 || !e2.state || !e2.output || !e2.input && 0 !== e2.avail_in) return U;
          12 === (r2 = e2.state).mode && (r2.mode = 13), a2 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o2 = e2.avail_in, u2 = r2.hold, l2 = r2.bits, f2 = o2, c2 = h2, x = N;
          e: for (; ; ) switch (r2.mode) {
            case P:
              if (0 === r2.wrap) {
                r2.mode = 13;
                break;
              }
              for (; l2 < 16; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              if (2 & r2.wrap && 35615 === u2) {
                E[r2.check = 0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0), l2 = u2 = 0, r2.mode = 2;
                break;
              }
              if (r2.flags = 0, r2.head && (r2.head.done = false), !(1 & r2.wrap) || (((255 & u2) << 8) + (u2 >> 8)) % 31) {
                e2.msg = "incorrect header check", r2.mode = 30;
                break;
              }
              if (8 != (15 & u2)) {
                e2.msg = "unknown compression method", r2.mode = 30;
                break;
              }
              if (l2 -= 4, k = 8 + (15 & (u2 >>>= 4)), 0 === r2.wbits) r2.wbits = k;
              else if (k > r2.wbits) {
                e2.msg = "invalid window size", r2.mode = 30;
                break;
              }
              r2.dmax = 1 << k, e2.adler = r2.check = 1, r2.mode = 512 & u2 ? 10 : 12, l2 = u2 = 0;
              break;
            case 2:
              for (; l2 < 16; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              if (r2.flags = u2, 8 != (255 & r2.flags)) {
                e2.msg = "unknown compression method", r2.mode = 30;
                break;
              }
              if (57344 & r2.flags) {
                e2.msg = "unknown header flags set", r2.mode = 30;
                break;
              }
              r2.head && (r2.head.text = u2 >> 8 & 1), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0, r2.mode = 3;
            case 3:
              for (; l2 < 32; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              r2.head && (r2.head.time = u2), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, E[2] = u2 >>> 16 & 255, E[3] = u2 >>> 24 & 255, r2.check = B(r2.check, E, 4, 0)), l2 = u2 = 0, r2.mode = 4;
            case 4:
              for (; l2 < 16; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              r2.head && (r2.head.xflags = 255 & u2, r2.head.os = u2 >> 8), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0, r2.mode = 5;
            case 5:
              if (1024 & r2.flags) {
                for (; l2 < 16; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                r2.length = u2, r2.head && (r2.head.extra_len = u2), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0;
              } else r2.head && (r2.head.extra = null);
              r2.mode = 6;
            case 6:
              if (1024 & r2.flags && (o2 < (d = r2.length) && (d = o2), d && (r2.head && (k = r2.head.extra_len - r2.length, r2.head.extra || (r2.head.extra = new Array(r2.head.extra_len)), I.arraySet(r2.head.extra, n2, s2, d, k)), 512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, r2.length -= d), r2.length)) break e;
              r2.length = 0, r2.mode = 7;
            case 7:
              if (2048 & r2.flags) {
                if (0 === o2) break e;
                for (d = 0; k = n2[s2 + d++], r2.head && k && r2.length < 65536 && (r2.head.name += String.fromCharCode(k)), k && d < o2; ) ;
                if (512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, k) break e;
              } else r2.head && (r2.head.name = null);
              r2.length = 0, r2.mode = 8;
            case 8:
              if (4096 & r2.flags) {
                if (0 === o2) break e;
                for (d = 0; k = n2[s2 + d++], r2.head && k && r2.length < 65536 && (r2.head.comment += String.fromCharCode(k)), k && d < o2; ) ;
                if (512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, k) break e;
              } else r2.head && (r2.head.comment = null);
              r2.mode = 9;
            case 9:
              if (512 & r2.flags) {
                for (; l2 < 16; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (u2 !== (65535 & r2.check)) {
                  e2.msg = "header crc mismatch", r2.mode = 30;
                  break;
                }
                l2 = u2 = 0;
              }
              r2.head && (r2.head.hcrc = r2.flags >> 9 & 1, r2.head.done = true), e2.adler = r2.check = 0, r2.mode = 12;
              break;
            case 10:
              for (; l2 < 32; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              e2.adler = r2.check = L(u2), l2 = u2 = 0, r2.mode = 11;
            case 11:
              if (0 === r2.havedict) return e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, 2;
              e2.adler = r2.check = 1, r2.mode = 12;
            case 12:
              if (5 === t3 || 6 === t3) break e;
            case 13:
              if (r2.last) {
                u2 >>>= 7 & l2, l2 -= 7 & l2, r2.mode = 27;
                break;
              }
              for (; l2 < 3; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              switch (r2.last = 1 & u2, l2 -= 1, 3 & (u2 >>>= 1)) {
                case 0:
                  r2.mode = 14;
                  break;
                case 1:
                  if (j(r2), r2.mode = 20, 6 !== t3) break;
                  u2 >>>= 2, l2 -= 2;
                  break e;
                case 2:
                  r2.mode = 17;
                  break;
                case 3:
                  e2.msg = "invalid block type", r2.mode = 30;
              }
              u2 >>>= 2, l2 -= 2;
              break;
            case 14:
              for (u2 >>>= 7 & l2, l2 -= 7 & l2; l2 < 32; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              if ((65535 & u2) != (u2 >>> 16 ^ 65535)) {
                e2.msg = "invalid stored block lengths", r2.mode = 30;
                break;
              }
              if (r2.length = 65535 & u2, l2 = u2 = 0, r2.mode = 15, 6 === t3) break e;
            case 15:
              r2.mode = 16;
            case 16:
              if (d = r2.length) {
                if (o2 < d && (d = o2), h2 < d && (d = h2), 0 === d) break e;
                I.arraySet(i2, n2, s2, d, a2), o2 -= d, s2 += d, h2 -= d, a2 += d, r2.length -= d;
                break;
              }
              r2.mode = 12;
              break;
            case 17:
              for (; l2 < 14; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              if (r2.nlen = 257 + (31 & u2), u2 >>>= 5, l2 -= 5, r2.ndist = 1 + (31 & u2), u2 >>>= 5, l2 -= 5, r2.ncode = 4 + (15 & u2), u2 >>>= 4, l2 -= 4, 286 < r2.nlen || 30 < r2.ndist) {
                e2.msg = "too many length or distance symbols", r2.mode = 30;
                break;
              }
              r2.have = 0, r2.mode = 18;
            case 18:
              for (; r2.have < r2.ncode; ) {
                for (; l2 < 3; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                r2.lens[A[r2.have++]] = 7 & u2, u2 >>>= 3, l2 -= 3;
              }
              for (; r2.have < 19; ) r2.lens[A[r2.have++]] = 0;
              if (r2.lencode = r2.lendyn, r2.lenbits = 7, S = { bits: r2.lenbits }, x = T(0, r2.lens, 0, 19, r2.lencode, 0, r2.work, S), r2.lenbits = S.bits, x) {
                e2.msg = "invalid code lengths set", r2.mode = 30;
                break;
              }
              r2.have = 0, r2.mode = 19;
            case 19:
              for (; r2.have < r2.nlen + r2.ndist; ) {
                for (; g = (C = r2.lencode[u2 & (1 << r2.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (b < 16) u2 >>>= _, l2 -= _, r2.lens[r2.have++] = b;
                else {
                  if (16 === b) {
                    for (z = _ + 2; l2 < z; ) {
                      if (0 === o2) break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    if (u2 >>>= _, l2 -= _, 0 === r2.have) {
                      e2.msg = "invalid bit length repeat", r2.mode = 30;
                      break;
                    }
                    k = r2.lens[r2.have - 1], d = 3 + (3 & u2), u2 >>>= 2, l2 -= 2;
                  } else if (17 === b) {
                    for (z = _ + 3; l2 < z; ) {
                      if (0 === o2) break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    l2 -= _, k = 0, d = 3 + (7 & (u2 >>>= _)), u2 >>>= 3, l2 -= 3;
                  } else {
                    for (z = _ + 7; l2 < z; ) {
                      if (0 === o2) break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    l2 -= _, k = 0, d = 11 + (127 & (u2 >>>= _)), u2 >>>= 7, l2 -= 7;
                  }
                  if (r2.have + d > r2.nlen + r2.ndist) {
                    e2.msg = "invalid bit length repeat", r2.mode = 30;
                    break;
                  }
                  for (; d--; ) r2.lens[r2.have++] = k;
                }
              }
              if (30 === r2.mode) break;
              if (0 === r2.lens[256]) {
                e2.msg = "invalid code -- missing end-of-block", r2.mode = 30;
                break;
              }
              if (r2.lenbits = 9, S = { bits: r2.lenbits }, x = T(D, r2.lens, 0, r2.nlen, r2.lencode, 0, r2.work, S), r2.lenbits = S.bits, x) {
                e2.msg = "invalid literal/lengths set", r2.mode = 30;
                break;
              }
              if (r2.distbits = 6, r2.distcode = r2.distdyn, S = { bits: r2.distbits }, x = T(F, r2.lens, r2.nlen, r2.ndist, r2.distcode, 0, r2.work, S), r2.distbits = S.bits, x) {
                e2.msg = "invalid distances set", r2.mode = 30;
                break;
              }
              if (r2.mode = 20, 6 === t3) break e;
            case 20:
              r2.mode = 21;
            case 21:
              if (6 <= o2 && 258 <= h2) {
                e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, R(e2, c2), a2 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o2 = e2.avail_in, u2 = r2.hold, l2 = r2.bits, 12 === r2.mode && (r2.back = -1);
                break;
              }
              for (r2.back = 0; g = (C = r2.lencode[u2 & (1 << r2.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              if (g && 0 == (240 & g)) {
                for (v = _, y = g, w = b; g = (C = r2.lencode[w + ((u2 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l2); ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                u2 >>>= v, l2 -= v, r2.back += v;
              }
              if (u2 >>>= _, l2 -= _, r2.back += _, r2.length = b, 0 === g) {
                r2.mode = 26;
                break;
              }
              if (32 & g) {
                r2.back = -1, r2.mode = 12;
                break;
              }
              if (64 & g) {
                e2.msg = "invalid literal/length code", r2.mode = 30;
                break;
              }
              r2.extra = 15 & g, r2.mode = 22;
            case 22:
              if (r2.extra) {
                for (z = r2.extra; l2 < z; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                r2.length += u2 & (1 << r2.extra) - 1, u2 >>>= r2.extra, l2 -= r2.extra, r2.back += r2.extra;
              }
              r2.was = r2.length, r2.mode = 23;
            case 23:
              for (; g = (C = r2.distcode[u2 & (1 << r2.distbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              if (0 == (240 & g)) {
                for (v = _, y = g, w = b; g = (C = r2.distcode[w + ((u2 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l2); ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                u2 >>>= v, l2 -= v, r2.back += v;
              }
              if (u2 >>>= _, l2 -= _, r2.back += _, 64 & g) {
                e2.msg = "invalid distance code", r2.mode = 30;
                break;
              }
              r2.offset = b, r2.extra = 15 & g, r2.mode = 24;
            case 24:
              if (r2.extra) {
                for (z = r2.extra; l2 < z; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                r2.offset += u2 & (1 << r2.extra) - 1, u2 >>>= r2.extra, l2 -= r2.extra, r2.back += r2.extra;
              }
              if (r2.offset > r2.dmax) {
                e2.msg = "invalid distance too far back", r2.mode = 30;
                break;
              }
              r2.mode = 25;
            case 25:
              if (0 === h2) break e;
              if (d = c2 - h2, r2.offset > d) {
                if ((d = r2.offset - d) > r2.whave && r2.sane) {
                  e2.msg = "invalid distance too far back", r2.mode = 30;
                  break;
                }
                p = d > r2.wnext ? (d -= r2.wnext, r2.wsize - d) : r2.wnext - d, d > r2.length && (d = r2.length), m = r2.window;
              } else m = i2, p = a2 - r2.offset, d = r2.length;
              for (h2 < d && (d = h2), h2 -= d, r2.length -= d; i2[a2++] = m[p++], --d; ) ;
              0 === r2.length && (r2.mode = 21);
              break;
            case 26:
              if (0 === h2) break e;
              i2[a2++] = r2.length, h2--, r2.mode = 21;
              break;
            case 27:
              if (r2.wrap) {
                for (; l2 < 32; ) {
                  if (0 === o2) break e;
                  o2--, u2 |= n2[s2++] << l2, l2 += 8;
                }
                if (c2 -= h2, e2.total_out += c2, r2.total += c2, c2 && (e2.adler = r2.check = r2.flags ? B(r2.check, i2, c2, a2 - c2) : O(r2.check, i2, c2, a2 - c2)), c2 = h2, (r2.flags ? u2 : L(u2)) !== r2.check) {
                  e2.msg = "incorrect data check", r2.mode = 30;
                  break;
                }
                l2 = u2 = 0;
              }
              r2.mode = 28;
            case 28:
              if (r2.wrap && r2.flags) {
                for (; l2 < 32; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (u2 !== (4294967295 & r2.total)) {
                  e2.msg = "incorrect length check", r2.mode = 30;
                  break;
                }
                l2 = u2 = 0;
              }
              r2.mode = 29;
            case 29:
              x = 1;
              break e;
            case 30:
              x = -3;
              break e;
            case 31:
              return -4;
            case 32:
            default:
              return U;
          }
          return e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, (r2.wsize || c2 !== e2.avail_out && r2.mode < 30 && (r2.mode < 27 || 4 !== t3)) && Z(e2, e2.output, e2.next_out, c2 - e2.avail_out) ? (r2.mode = 31, -4) : (f2 -= e2.avail_in, c2 -= e2.avail_out, e2.total_in += f2, e2.total_out += c2, r2.total += c2, r2.wrap && c2 && (e2.adler = r2.check = r2.flags ? B(r2.check, i2, c2, e2.next_out - c2) : O(r2.check, i2, c2, e2.next_out - c2)), e2.data_type = r2.bits + (r2.last ? 64 : 0) + (12 === r2.mode ? 128 : 0) + (20 === r2.mode || 15 === r2.mode ? 256 : 0), (0 == f2 && 0 === c2 || 4 === t3) && x === N && (x = -5), x);
        }, r.inflateEnd = function(e2) {
          if (!e2 || !e2.state) return U;
          var t3 = e2.state;
          return t3.window && (t3.window = null), e2.state = null, N;
        }, r.inflateGetHeader = function(e2, t3) {
          var r2;
          return e2 && e2.state ? 0 == (2 & (r2 = e2.state).wrap) ? U : ((r2.head = t3).done = false, N) : U;
        }, r.inflateSetDictionary = function(e2, t3) {
          var r2, n2 = t3.length;
          return e2 && e2.state ? 0 !== (r2 = e2.state).wrap && 11 !== r2.mode ? U : 11 === r2.mode && O(1, t3, n2, 0) !== r2.check ? -3 : Z(e2, t3, n2, n2) ? (r2.mode = 31, -4) : (r2.havedict = 1, N) : U;
        }, r.inflateInfo = "pako inflate (from Nodeca project)";
      }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./inffast": 48, "./inftrees": 50 }], 50: [function(e, t2, r) {
        "use strict";
        var D = e("../utils/common"), F = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], N = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78], U = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0], P = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
        t2.exports = function(e2, t3, r2, n, i, s, a, o) {
          var h, u, l, f, c, d, p, m, _, g = o.bits, b = 0, v = 0, y = 0, w = 0, k = 0, x = 0, S = 0, z = 0, C = 0, E = 0, A = null, I = 0, O = new D.Buf16(16), B = new D.Buf16(16), R = null, T = 0;
          for (b = 0; b <= 15; b++) O[b] = 0;
          for (v = 0; v < n; v++) O[t3[r2 + v]]++;
          for (k = g, w = 15; 1 <= w && 0 === O[w]; w--) ;
          if (w < k && (k = w), 0 === w) return i[s++] = 20971520, i[s++] = 20971520, o.bits = 1, 0;
          for (y = 1; y < w && 0 === O[y]; y++) ;
          for (k < y && (k = y), b = z = 1; b <= 15; b++) if (z <<= 1, (z -= O[b]) < 0) return -1;
          if (0 < z && (0 === e2 || 1 !== w)) return -1;
          for (B[1] = 0, b = 1; b < 15; b++) B[b + 1] = B[b] + O[b];
          for (v = 0; v < n; v++) 0 !== t3[r2 + v] && (a[B[t3[r2 + v]]++] = v);
          if (d = 0 === e2 ? (A = R = a, 19) : 1 === e2 ? (A = F, I -= 257, R = N, T -= 257, 256) : (A = U, R = P, -1), b = y, c = s, S = v = E = 0, l = -1, f = (C = 1 << (x = k)) - 1, 1 === e2 && 852 < C || 2 === e2 && 592 < C) return 1;
          for (; ; ) {
            for (p = b - S, _ = a[v] < d ? (m = 0, a[v]) : a[v] > d ? (m = R[T + a[v]], A[I + a[v]]) : (m = 96, 0), h = 1 << b - S, y = u = 1 << x; i[c + (E >> S) + (u -= h)] = p << 24 | m << 16 | _ | 0, 0 !== u; ) ;
            for (h = 1 << b - 1; E & h; ) h >>= 1;
            if (0 !== h ? (E &= h - 1, E += h) : E = 0, v++, 0 == --O[b]) {
              if (b === w) break;
              b = t3[r2 + a[v]];
            }
            if (k < b && (E & f) !== l) {
              for (0 === S && (S = k), c += y, z = 1 << (x = b - S); x + S < w && !((z -= O[x + S]) <= 0); ) x++, z <<= 1;
              if (C += 1 << x, 1 === e2 && 852 < C || 2 === e2 && 592 < C) return 1;
              i[l = E & f] = k << 24 | x << 16 | c - s | 0;
            }
          }
          return 0 !== E && (i[c + E] = b - S << 24 | 64 << 16 | 0), o.bits = k, 0;
        };
      }, { "../utils/common": 41 }], 51: [function(e, t2, r) {
        "use strict";
        t2.exports = { 2: "need dictionary", 1: "stream end", 0: "", "-1": "file error", "-2": "stream error", "-3": "data error", "-4": "insufficient memory", "-5": "buffer error", "-6": "incompatible version" };
      }, {}], 52: [function(e, t2, r) {
        "use strict";
        var i = e("../utils/common"), o = 0, h = 1;
        function n(e2) {
          for (var t3 = e2.length; 0 <= --t3; ) e2[t3] = 0;
        }
        var s = 0, a = 29, u = 256, l = u + 1 + a, f = 30, c = 19, _ = 2 * l + 1, g = 15, d = 16, p = 7, m = 256, b = 16, v = 17, y = 18, w = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0], k = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13], x = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7], S = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], z = new Array(2 * (l + 2));
        n(z);
        var C = new Array(2 * f);
        n(C);
        var E = new Array(512);
        n(E);
        var A = new Array(256);
        n(A);
        var I = new Array(a);
        n(I);
        var O, B, R, T = new Array(f);
        function D(e2, t3, r2, n2, i2) {
          this.static_tree = e2, this.extra_bits = t3, this.extra_base = r2, this.elems = n2, this.max_length = i2, this.has_stree = e2 && e2.length;
        }
        function F(e2, t3) {
          this.dyn_tree = e2, this.max_code = 0, this.stat_desc = t3;
        }
        function N(e2) {
          return e2 < 256 ? E[e2] : E[256 + (e2 >>> 7)];
        }
        function U(e2, t3) {
          e2.pending_buf[e2.pending++] = 255 & t3, e2.pending_buf[e2.pending++] = t3 >>> 8 & 255;
        }
        function P(e2, t3, r2) {
          e2.bi_valid > d - r2 ? (e2.bi_buf |= t3 << e2.bi_valid & 65535, U(e2, e2.bi_buf), e2.bi_buf = t3 >> d - e2.bi_valid, e2.bi_valid += r2 - d) : (e2.bi_buf |= t3 << e2.bi_valid & 65535, e2.bi_valid += r2);
        }
        function L(e2, t3, r2) {
          P(e2, r2[2 * t3], r2[2 * t3 + 1]);
        }
        function j(e2, t3) {
          for (var r2 = 0; r2 |= 1 & e2, e2 >>>= 1, r2 <<= 1, 0 < --t3; ) ;
          return r2 >>> 1;
        }
        function Z(e2, t3, r2) {
          var n2, i2, s2 = new Array(g + 1), a2 = 0;
          for (n2 = 1; n2 <= g; n2++) s2[n2] = a2 = a2 + r2[n2 - 1] << 1;
          for (i2 = 0; i2 <= t3; i2++) {
            var o2 = e2[2 * i2 + 1];
            0 !== o2 && (e2[2 * i2] = j(s2[o2]++, o2));
          }
        }
        function W(e2) {
          var t3;
          for (t3 = 0; t3 < l; t3++) e2.dyn_ltree[2 * t3] = 0;
          for (t3 = 0; t3 < f; t3++) e2.dyn_dtree[2 * t3] = 0;
          for (t3 = 0; t3 < c; t3++) e2.bl_tree[2 * t3] = 0;
          e2.dyn_ltree[2 * m] = 1, e2.opt_len = e2.static_len = 0, e2.last_lit = e2.matches = 0;
        }
        function M(e2) {
          8 < e2.bi_valid ? U(e2, e2.bi_buf) : 0 < e2.bi_valid && (e2.pending_buf[e2.pending++] = e2.bi_buf), e2.bi_buf = 0, e2.bi_valid = 0;
        }
        function H(e2, t3, r2, n2) {
          var i2 = 2 * t3, s2 = 2 * r2;
          return e2[i2] < e2[s2] || e2[i2] === e2[s2] && n2[t3] <= n2[r2];
        }
        function G(e2, t3, r2) {
          for (var n2 = e2.heap[r2], i2 = r2 << 1; i2 <= e2.heap_len && (i2 < e2.heap_len && H(t3, e2.heap[i2 + 1], e2.heap[i2], e2.depth) && i2++, !H(t3, n2, e2.heap[i2], e2.depth)); ) e2.heap[r2] = e2.heap[i2], r2 = i2, i2 <<= 1;
          e2.heap[r2] = n2;
        }
        function K(e2, t3, r2) {
          var n2, i2, s2, a2, o2 = 0;
          if (0 !== e2.last_lit) for (; n2 = e2.pending_buf[e2.d_buf + 2 * o2] << 8 | e2.pending_buf[e2.d_buf + 2 * o2 + 1], i2 = e2.pending_buf[e2.l_buf + o2], o2++, 0 === n2 ? L(e2, i2, t3) : (L(e2, (s2 = A[i2]) + u + 1, t3), 0 !== (a2 = w[s2]) && P(e2, i2 -= I[s2], a2), L(e2, s2 = N(--n2), r2), 0 !== (a2 = k[s2]) && P(e2, n2 -= T[s2], a2)), o2 < e2.last_lit; ) ;
          L(e2, m, t3);
        }
        function Y(e2, t3) {
          var r2, n2, i2, s2 = t3.dyn_tree, a2 = t3.stat_desc.static_tree, o2 = t3.stat_desc.has_stree, h2 = t3.stat_desc.elems, u2 = -1;
          for (e2.heap_len = 0, e2.heap_max = _, r2 = 0; r2 < h2; r2++) 0 !== s2[2 * r2] ? (e2.heap[++e2.heap_len] = u2 = r2, e2.depth[r2] = 0) : s2[2 * r2 + 1] = 0;
          for (; e2.heap_len < 2; ) s2[2 * (i2 = e2.heap[++e2.heap_len] = u2 < 2 ? ++u2 : 0)] = 1, e2.depth[i2] = 0, e2.opt_len--, o2 && (e2.static_len -= a2[2 * i2 + 1]);
          for (t3.max_code = u2, r2 = e2.heap_len >> 1; 1 <= r2; r2--) G(e2, s2, r2);
          for (i2 = h2; r2 = e2.heap[1], e2.heap[1] = e2.heap[e2.heap_len--], G(e2, s2, 1), n2 = e2.heap[1], e2.heap[--e2.heap_max] = r2, e2.heap[--e2.heap_max] = n2, s2[2 * i2] = s2[2 * r2] + s2[2 * n2], e2.depth[i2] = (e2.depth[r2] >= e2.depth[n2] ? e2.depth[r2] : e2.depth[n2]) + 1, s2[2 * r2 + 1] = s2[2 * n2 + 1] = i2, e2.heap[1] = i2++, G(e2, s2, 1), 2 <= e2.heap_len; ) ;
          e2.heap[--e2.heap_max] = e2.heap[1], (function(e3, t4) {
            var r3, n3, i3, s3, a3, o3, h3 = t4.dyn_tree, u3 = t4.max_code, l2 = t4.stat_desc.static_tree, f2 = t4.stat_desc.has_stree, c2 = t4.stat_desc.extra_bits, d2 = t4.stat_desc.extra_base, p2 = t4.stat_desc.max_length, m2 = 0;
            for (s3 = 0; s3 <= g; s3++) e3.bl_count[s3] = 0;
            for (h3[2 * e3.heap[e3.heap_max] + 1] = 0, r3 = e3.heap_max + 1; r3 < _; r3++) p2 < (s3 = h3[2 * h3[2 * (n3 = e3.heap[r3]) + 1] + 1] + 1) && (s3 = p2, m2++), h3[2 * n3 + 1] = s3, u3 < n3 || (e3.bl_count[s3]++, a3 = 0, d2 <= n3 && (a3 = c2[n3 - d2]), o3 = h3[2 * n3], e3.opt_len += o3 * (s3 + a3), f2 && (e3.static_len += o3 * (l2[2 * n3 + 1] + a3)));
            if (0 !== m2) {
              do {
                for (s3 = p2 - 1; 0 === e3.bl_count[s3]; ) s3--;
                e3.bl_count[s3]--, e3.bl_count[s3 + 1] += 2, e3.bl_count[p2]--, m2 -= 2;
              } while (0 < m2);
              for (s3 = p2; 0 !== s3; s3--) for (n3 = e3.bl_count[s3]; 0 !== n3; ) u3 < (i3 = e3.heap[--r3]) || (h3[2 * i3 + 1] !== s3 && (e3.opt_len += (s3 - h3[2 * i3 + 1]) * h3[2 * i3], h3[2 * i3 + 1] = s3), n3--);
            }
          })(e2, t3), Z(s2, u2, e2.bl_count);
        }
        function X(e2, t3, r2) {
          var n2, i2, s2 = -1, a2 = t3[1], o2 = 0, h2 = 7, u2 = 4;
          for (0 === a2 && (h2 = 138, u2 = 3), t3[2 * (r2 + 1) + 1] = 65535, n2 = 0; n2 <= r2; n2++) i2 = a2, a2 = t3[2 * (n2 + 1) + 1], ++o2 < h2 && i2 === a2 || (o2 < u2 ? e2.bl_tree[2 * i2] += o2 : 0 !== i2 ? (i2 !== s2 && e2.bl_tree[2 * i2]++, e2.bl_tree[2 * b]++) : o2 <= 10 ? e2.bl_tree[2 * v]++ : e2.bl_tree[2 * y]++, s2 = i2, u2 = (o2 = 0) === a2 ? (h2 = 138, 3) : i2 === a2 ? (h2 = 6, 3) : (h2 = 7, 4));
        }
        function V(e2, t3, r2) {
          var n2, i2, s2 = -1, a2 = t3[1], o2 = 0, h2 = 7, u2 = 4;
          for (0 === a2 && (h2 = 138, u2 = 3), n2 = 0; n2 <= r2; n2++) if (i2 = a2, a2 = t3[2 * (n2 + 1) + 1], !(++o2 < h2 && i2 === a2)) {
            if (o2 < u2) for (; L(e2, i2, e2.bl_tree), 0 != --o2; ) ;
            else 0 !== i2 ? (i2 !== s2 && (L(e2, i2, e2.bl_tree), o2--), L(e2, b, e2.bl_tree), P(e2, o2 - 3, 2)) : o2 <= 10 ? (L(e2, v, e2.bl_tree), P(e2, o2 - 3, 3)) : (L(e2, y, e2.bl_tree), P(e2, o2 - 11, 7));
            s2 = i2, u2 = (o2 = 0) === a2 ? (h2 = 138, 3) : i2 === a2 ? (h2 = 6, 3) : (h2 = 7, 4);
          }
        }
        n(T);
        var q = false;
        function J(e2, t3, r2, n2) {
          P(e2, (s << 1) + (n2 ? 1 : 0), 3), (function(e3, t4, r3, n3) {
            M(e3), n3 && (U(e3, r3), U(e3, ~r3)), i.arraySet(e3.pending_buf, e3.window, t4, r3, e3.pending), e3.pending += r3;
          })(e2, t3, r2, true);
        }
        r._tr_init = function(e2) {
          q || ((function() {
            var e3, t3, r2, n2, i2, s2 = new Array(g + 1);
            for (n2 = r2 = 0; n2 < a - 1; n2++) for (I[n2] = r2, e3 = 0; e3 < 1 << w[n2]; e3++) A[r2++] = n2;
            for (A[r2 - 1] = n2, n2 = i2 = 0; n2 < 16; n2++) for (T[n2] = i2, e3 = 0; e3 < 1 << k[n2]; e3++) E[i2++] = n2;
            for (i2 >>= 7; n2 < f; n2++) for (T[n2] = i2 << 7, e3 = 0; e3 < 1 << k[n2] - 7; e3++) E[256 + i2++] = n2;
            for (t3 = 0; t3 <= g; t3++) s2[t3] = 0;
            for (e3 = 0; e3 <= 143; ) z[2 * e3 + 1] = 8, e3++, s2[8]++;
            for (; e3 <= 255; ) z[2 * e3 + 1] = 9, e3++, s2[9]++;
            for (; e3 <= 279; ) z[2 * e3 + 1] = 7, e3++, s2[7]++;
            for (; e3 <= 287; ) z[2 * e3 + 1] = 8, e3++, s2[8]++;
            for (Z(z, l + 1, s2), e3 = 0; e3 < f; e3++) C[2 * e3 + 1] = 5, C[2 * e3] = j(e3, 5);
            O = new D(z, w, u + 1, l, g), B = new D(C, k, 0, f, g), R = new D(new Array(0), x, 0, c, p);
          })(), q = true), e2.l_desc = new F(e2.dyn_ltree, O), e2.d_desc = new F(e2.dyn_dtree, B), e2.bl_desc = new F(e2.bl_tree, R), e2.bi_buf = 0, e2.bi_valid = 0, W(e2);
        }, r._tr_stored_block = J, r._tr_flush_block = function(e2, t3, r2, n2) {
          var i2, s2, a2 = 0;
          0 < e2.level ? (2 === e2.strm.data_type && (e2.strm.data_type = (function(e3) {
            var t4, r3 = 4093624447;
            for (t4 = 0; t4 <= 31; t4++, r3 >>>= 1) if (1 & r3 && 0 !== e3.dyn_ltree[2 * t4]) return o;
            if (0 !== e3.dyn_ltree[18] || 0 !== e3.dyn_ltree[20] || 0 !== e3.dyn_ltree[26]) return h;
            for (t4 = 32; t4 < u; t4++) if (0 !== e3.dyn_ltree[2 * t4]) return h;
            return o;
          })(e2)), Y(e2, e2.l_desc), Y(e2, e2.d_desc), a2 = (function(e3) {
            var t4;
            for (X(e3, e3.dyn_ltree, e3.l_desc.max_code), X(e3, e3.dyn_dtree, e3.d_desc.max_code), Y(e3, e3.bl_desc), t4 = c - 1; 3 <= t4 && 0 === e3.bl_tree[2 * S[t4] + 1]; t4--) ;
            return e3.opt_len += 3 * (t4 + 1) + 5 + 5 + 4, t4;
          })(e2), i2 = e2.opt_len + 3 + 7 >>> 3, (s2 = e2.static_len + 3 + 7 >>> 3) <= i2 && (i2 = s2)) : i2 = s2 = r2 + 5, r2 + 4 <= i2 && -1 !== t3 ? J(e2, t3, r2, n2) : 4 === e2.strategy || s2 === i2 ? (P(e2, 2 + (n2 ? 1 : 0), 3), K(e2, z, C)) : (P(e2, 4 + (n2 ? 1 : 0), 3), (function(e3, t4, r3, n3) {
            var i3;
            for (P(e3, t4 - 257, 5), P(e3, r3 - 1, 5), P(e3, n3 - 4, 4), i3 = 0; i3 < n3; i3++) P(e3, e3.bl_tree[2 * S[i3] + 1], 3);
            V(e3, e3.dyn_ltree, t4 - 1), V(e3, e3.dyn_dtree, r3 - 1);
          })(e2, e2.l_desc.max_code + 1, e2.d_desc.max_code + 1, a2 + 1), K(e2, e2.dyn_ltree, e2.dyn_dtree)), W(e2), n2 && M(e2);
        }, r._tr_tally = function(e2, t3, r2) {
          return e2.pending_buf[e2.d_buf + 2 * e2.last_lit] = t3 >>> 8 & 255, e2.pending_buf[e2.d_buf + 2 * e2.last_lit + 1] = 255 & t3, e2.pending_buf[e2.l_buf + e2.last_lit] = 255 & r2, e2.last_lit++, 0 === t3 ? e2.dyn_ltree[2 * r2]++ : (e2.matches++, t3--, e2.dyn_ltree[2 * (A[r2] + u + 1)]++, e2.dyn_dtree[2 * N(t3)]++), e2.last_lit === e2.lit_bufsize - 1;
        }, r._tr_align = function(e2) {
          P(e2, 2, 3), L(e2, m, z), (function(e3) {
            16 === e3.bi_valid ? (U(e3, e3.bi_buf), e3.bi_buf = 0, e3.bi_valid = 0) : 8 <= e3.bi_valid && (e3.pending_buf[e3.pending++] = 255 & e3.bi_buf, e3.bi_buf >>= 8, e3.bi_valid -= 8);
          })(e2);
        };
      }, { "../utils/common": 41 }], 53: [function(e, t2, r) {
        "use strict";
        t2.exports = function() {
          this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
        };
      }, {}], 54: [function(e, t2, r) {
        (function(e2) {
          !(function(r2, n) {
            "use strict";
            if (!r2.setImmediate) {
              var i, s, t3, a, o = 1, h = {}, u = false, l = r2.document, e3 = Object.getPrototypeOf && Object.getPrototypeOf(r2);
              e3 = e3 && e3.setTimeout ? e3 : r2, i = "[object process]" === {}.toString.call(r2.process) ? function(e4) {
                process.nextTick(function() {
                  c(e4);
                });
              } : (function() {
                if (r2.postMessage && !r2.importScripts) {
                  var e4 = true, t4 = r2.onmessage;
                  return r2.onmessage = function() {
                    e4 = false;
                  }, r2.postMessage("", "*"), r2.onmessage = t4, e4;
                }
              })() ? (a = "setImmediate$" + Math.random() + "$", r2.addEventListener ? r2.addEventListener("message", d, false) : r2.attachEvent("onmessage", d), function(e4) {
                r2.postMessage(a + e4, "*");
              }) : r2.MessageChannel ? ((t3 = new MessageChannel()).port1.onmessage = function(e4) {
                c(e4.data);
              }, function(e4) {
                t3.port2.postMessage(e4);
              }) : l && "onreadystatechange" in l.createElement("script") ? (s = l.documentElement, function(e4) {
                var t4 = l.createElement("script");
                t4.onreadystatechange = function() {
                  c(e4), t4.onreadystatechange = null, s.removeChild(t4), t4 = null;
                }, s.appendChild(t4);
              }) : function(e4) {
                setTimeout(c, 0, e4);
              }, e3.setImmediate = function(e4) {
                "function" != typeof e4 && (e4 = new Function("" + e4));
                for (var t4 = new Array(arguments.length - 1), r3 = 0; r3 < t4.length; r3++) t4[r3] = arguments[r3 + 1];
                var n2 = { callback: e4, args: t4 };
                return h[o] = n2, i(o), o++;
              }, e3.clearImmediate = f;
            }
            function f(e4) {
              delete h[e4];
            }
            function c(e4) {
              if (u) setTimeout(c, 0, e4);
              else {
                var t4 = h[e4];
                if (t4) {
                  u = true;
                  try {
                    !(function(e5) {
                      var t5 = e5.callback, r3 = e5.args;
                      switch (r3.length) {
                        case 0:
                          t5();
                          break;
                        case 1:
                          t5(r3[0]);
                          break;
                        case 2:
                          t5(r3[0], r3[1]);
                          break;
                        case 3:
                          t5(r3[0], r3[1], r3[2]);
                          break;
                        default:
                          t5.apply(n, r3);
                      }
                    })(t4);
                  } finally {
                    f(e4), u = false;
                  }
                }
              }
            }
            function d(e4) {
              e4.source === r2 && "string" == typeof e4.data && 0 === e4.data.indexOf(a) && c(+e4.data.slice(a.length));
            }
          })("undefined" == typeof self ? void 0 === e2 ? this : e2 : self);
        }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
      }, {}] }, {}, [10])(10);
    });
  }
});

// core/i18n.ts
function isI18nDict(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value).every((entry) => typeof entry === "string" || isI18nDict(entry));
}
var state = {
  currentLocale: "zh-CN",
  translations: {
    "zh-CN": {},
    "en-US": {}
  },
  fallbackLocale: "zh-CN"
};
function t(key, fallback, params) {
  const text4 = lookup(state.translations[state.currentLocale], key) ?? lookup(state.translations[state.fallbackLocale], key) ?? fallback ?? key;
  if (!params) return text4;
  return text4.replace(/\{\{([^{}]+)\}\}/g, (placeholder, name) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) return placeholder;
    const value = params[name];
    return typeof value === "string" || typeof value === "number" ? String(value) : placeholder;
  });
}
function lookup(dict, key) {
  let value = dict;
  for (const part of key.split(".")) {
    if (typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, part)) return void 0;
    value = value[part];
  }
  return typeof value === "string" ? value : void 0;
}
function setLocale(locale) {
  const dict = state.translations[locale];
  if (!dict || Object.keys(dict).length === 0) {
    throw new Error(`Locale "${locale}" not loaded`);
  }
  state.currentLocale = locale;
}
function getLocale() {
  return state.currentLocale;
}
function loadTranslations(locale, dict) {
  if (!isI18nDict(dict)) throw new TypeError(`Invalid translation dictionary for "${locale}"`);
  state.translations[locale] = dict;
}
function resetI18n() {
  state.currentLocale = "zh-CN";
  state.fallbackLocale = "zh-CN";
  state.translations = {
    "zh-CN": {},
    "en-US": {}
  };
}

// core/types.ts
var SETTINGS_VERSION = 7;
var RECENT_FLOORS_DEFAULT = 6;
var RECENT_FLOORS_MIN = 1;
var RECENT_FLOORS_MAX = 50;
var SPRITE_OPACITY_DEFAULT = 100;
var SPRITE_OPACITY_MIN = 20;
var SPRITE_OPACITY_MAX = 100;
var SPRITE_COUNT_DEFAULT = 1;
var SPRITE_COUNT_MIN = 1;
var SPRITE_COUNT_MAX = 10;
var INJECTION_DEPTH_DEFAULT = 4;
var INJECTION_DEPTH_MIN = 0;
var INJECTION_DEPTH_MAX = 100;
var PROMPT_BUDGET_DEFAULT = 0;
var PROMPT_BUDGET_MIN = 0;
var PROMPT_BUDGET_MAX = 2e4;
var DEFAULT_IMAGE_HOST = "https://files.catbox.moe/";
function getSpriteSource(sprite) {
  if (sprite.url.startsWith("data:")) return "embedded";
  if (/^https?:\/\//.test(sprite.url)) return "hosted";
  return "local";
}
var DEFAULT_PROMPT_NOTE_PLACEMENT = "after-list";
function getPackCover(pack) {
  if (pack.coverTag) {
    const cover = pack.sprites.find((s) => s.tag === pack.coverTag);
    if (cover) return cover;
  }
  return pack.sprites[0] ?? null;
}
function spriteRole(pack, sprite) {
  return (sprite.group ?? "").trim() || (pack.roleName ?? "").trim();
}
function spriteOutfit(pack, sprite) {
  return (sprite.outfit ?? "").trim() || (pack.outfit ?? "").trim();
}
function spriteAddress(pack, sprite) {
  return { role: spriteRole(pack, sprite), outfit: spriteOutfit(pack, sprite), tag: sprite.tag };
}
function formatAddress(a) {
  if (a.role && a.outfit) return `${a.role}/${a.outfit}/${a.tag}`;
  if (a.role) return `${a.role}/${a.tag}`;
  return a.tag;
}
function parseAddress(address) {
  const parts = address.split("/").map((s) => s.trim());
  if (parts.length >= 3) {
    return { role: parts[0], outfit: parts[1], tag: parts.slice(2).join("/") };
  }
  if (parts.length === 2) return { role: parts[0], outfit: "", tag: parts[1] };
  return { role: "", outfit: "", tag: parts[0] ?? "" };
}
function createDefaultSettings() {
  return {
    settingsVersion: SETTINGS_VERSION,
    enabled: true,
    hideTagInMessage: false,
    spriteDisplayMode: "overlay",
    renderInlineImages: false,
    imageHost: DEFAULT_IMAGE_HOST,
    overlay: { x: 24, y: 80, width: 220 },
    overlayHidden: false,
    spriteOpacity: SPRITE_OPACITY_DEFAULT,
    recentFloors: RECENT_FLOORS_DEFAULT,
    phone: { x: 24, y: 320, open: false },
    showPhone: true,
    autoSwitch: false,
    autoSwitchSeconds: 3,
    multiRole: false,
    multiRolePromptMode: "repeat",
    spriteCount: SPRITE_COUNT_DEFAULT,
    injectionDepth: INJECTION_DEPTH_DEFAULT,
    promptTemplate: "",
    promptBudget: PROMPT_BUDGET_DEFAULT,
    imgbbApiKey: "",
    autoUpload: false,
    galleryFoldByRole: true,
    approxMatch: false,
    variableHud: false,
    packs: [],
    presetOverrides: {},
    bindings: [],
    apps: {}
  };
}

// core/sprite-metadata.ts
var MAX_LABELS = 24;
var MAX_LABEL_CODE_POINTS = 32;
var MAX_NOTE_CODE_POINTS = 500;
var MAX_INVENTORY_PROMPT_CODE_POINTS = 800;
function parseNumberedTag(tag) {
  const match = /^(.+?)(\d+)$/u.exec(tag);
  if (!match) return null;
  if (/^\d+$/u.test(match[1])) return null;
  return { prefix: match[1], suffix: match[2], value: BigInt(match[2]) };
}
function hasCoherentSuffixFormatting(tags) {
  const canonical = tags.every((tag) => tag.suffix === tag.value.toString());
  const width = tags[0]?.suffix.length;
  const fixedWidth = width !== void 0 && tags.every((tag) => tag.suffix.length === width);
  return canonical || fixedWidth;
}
function rangeLabel(prefix, from, to) {
  return `${prefix}(${from}-${to})`;
}
function compactNumberedTags(tags, reservedTags = tags) {
  const uniqueTags = [...new Set(tags)];
  const reserved = new Set(tags);
  for (const tag of reservedTags) reserved.add(tag);
  const entries = [];
  let index = 0;
  while (index < uniqueTags.length) {
    const first = parseNumberedTag(uniqueTags[index]);
    if (!first) {
      entries.push({ kind: "tag", label: uniqueTags[index], values: [uniqueTags[index]] });
      index++;
      continue;
    }
    let end = index + 1;
    let previous = first.value;
    while (end < uniqueTags.length) {
      const next = parseNumberedTag(uniqueTags[end]);
      if (!next || next.prefix !== first.prefix || next.value !== previous + 1n) break;
      previous = next.value;
      end++;
    }
    const values = uniqueTags.slice(index, end);
    const numbered = values.map((tag) => parseNumberedTag(tag));
    const last = numbered[numbered.length - 1];
    const label = rangeLabel(first.prefix, first.suffix, last.suffix);
    if (values.length >= 2 && hasCoherentSuffixFormatting(numbered) && !reserved.has(label)) {
      entries.push({
        kind: "range",
        label,
        values
      });
    } else {
      entries.push(...values.map((tag) => ({ kind: "tag", label: tag, values: [tag] })));
    }
    index = end;
  }
  return entries;
}
function clipCodePoints(value, limit) {
  return Array.from(value).slice(0, limit).join("").trim();
}
function normalizeLabels(raw) {
  if (!Array.isArray(raw)) return [];
  const labels = [];
  const seen = /* @__PURE__ */ new Set();
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const label = clipCodePoints(value.trim(), MAX_LABEL_CODE_POINTS);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
    if (labels.length === MAX_LABELS) break;
  }
  return labels;
}
function normalizePackKind(raw) {
  return raw === "sprite" || raw === "illustration" ? raw : void 0;
}
function packKind(pack) {
  return normalizePackKind(pack.kind) ?? "sprite";
}
function packLabels(pack) {
  return {
    role: (pack.roleName ?? "").trim() || "其他",
    type: packKind(pack) === "illustration" ? "插图" : "立绘",
    custom: normalizeLabels(pack.customTags)
  };
}
function normalizeNote(raw) {
  return typeof raw === "string" ? clipCodePoints(raw.trim(), MAX_NOTE_CODE_POINTS) : "";
}
function normalizeInventoryPrompt(raw) {
  return typeof raw === "string" ? clipCodePoints(raw.trim(), MAX_INVENTORY_PROMPT_CODE_POINTS) : "";
}
function normalizeOutfitNotes(raw) {
  const notes = /* @__PURE__ */ Object.create(null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return notes;
  for (const [rawOutfit, rawNote] of Object.entries(raw)) {
    const outfit = rawOutfit.trim();
    const note = normalizeNote(rawNote);
    if (outfit && note) notes[outfit] = note;
  }
  return notes;
}
function filterSprites(pack, filter) {
  const query = (filter.query ?? "").trim().toLocaleLowerCase();
  const requiredLabels = [...new Set((filter.labels ?? []).map((label) => label.trim().toLocaleLowerCase()).filter(Boolean))];
  return pack.sprites.filter((sprite) => {
    const labels = (sprite.labels ?? []).map((label) => label.toLocaleLowerCase());
    if (!requiredLabels.every((label) => labels.includes(label))) return false;
    if (!query) return true;
    return [
      sprite.tag,
      ...labels,
      spriteRole(pack, sprite),
      spriteOutfit(pack, sprite),
      pack.name
    ].some((value) => value.toLocaleLowerCase().includes(query));
  });
}
function groupPacksByRole(packs) {
  const groups = [];
  const byRole = /* @__PURE__ */ new Map();
  for (const pack of packs) {
    const role = (pack.roleName ?? "").trim();
    if (!role) {
      groups.push(makePackGroup(`pack:${pack.id}`, "", [pack]));
      continue;
    }
    const existing = byRole.get(role);
    if (existing) {
      existing.packs.push(pack);
      existing.packCount += 1;
      existing.spriteCount += pack.sprites.length;
      continue;
    }
    const group = makePackGroup(`role:${role}`, role, [pack]);
    byRole.set(role, group);
    groups.push(group);
  }
  return groups;
}
function makePackGroup(key, role, packs) {
  return {
    key,
    role,
    packs,
    packCount: packs.length,
    spriteCount: packs.reduce((count, pack) => count + pack.sprites.length, 0)
  };
}

// core/naming.ts
var TAG_MAX_LENGTH = 20;
var PACK_NAME_MAX_LENGTH = 30;
var DESCRIPTION_MAX_LENGTH = 200;
var CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]", "g");
var TAG_FORBIDDEN = /[[\]【】|=,，:：@/\\<>"'`]/g;
var PACK_NAME_FORBIDDEN = /[|=@<>"'`]/g;
function normalizeTag(raw) {
  return raw.replace(CONTROL_CHARS, "").replace(TAG_FORBIDDEN, "").replace(/\s+/g, " ").trim().slice(0, TAG_MAX_LENGTH).trim();
}
function fileNameToTag(fileName) {
  return normalizeTag(fileName.replace(/\.[^.]+$/, ""));
}
var NAME_SEPARATOR = /[_\-–—\s]+/;
function stripExt(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}
function parseSpriteFileName(fileName) {
  const base = stripExt(fileName).trim();
  const parts = splitAtMost(base, NAME_SEPARATOR, 3);
  if (parts.length >= 3) {
    const role = normalizeTag(parts[0]);
    const outfit = normalizeTag(parts[1]);
    const tag = normalizeTag(parts[2]);
    if (role && outfit && tag) return { role, outfit, tag };
    if (role && tag) return { role, outfit: "", tag };
    return { role: "", outfit: "", tag: fileNameToTag(base) };
  }
  if (parts.length === 2) {
    const role = normalizeTag(parts[0]);
    const tag = normalizeTag(parts[1]);
    if (role && tag) return { role, outfit: "", tag };
    return { role: "", outfit: "", tag: fileNameToTag(base) };
  }
  return { role: "", outfit: "", tag: fileNameToTag(base) };
}
function splitAtMost(text4, sep, n) {
  const out = [];
  let rest = text4;
  const single = new RegExp(sep.source);
  while (out.length < n - 1) {
    const m = single.exec(rest);
    if (!m || m.index < 0) break;
    out.push(rest.slice(0, m.index));
    rest = rest.slice(m.index + m[0].length);
  }
  out.push(rest);
  return out;
}
function sanitizePackName(raw) {
  return raw.replace(CONTROL_CHARS, "").replace(PACK_NAME_FORBIDDEN, "").replace(/\s+/g, " ").trim().slice(0, PACK_NAME_MAX_LENGTH).trim();
}
function sanitizeDescription(raw) {
  return raw.replace(CONTROL_CHARS, "").replace(/[<>]/g, "").trim().slice(0, DESCRIPTION_MAX_LENGTH).trim();
}

// core/address-policy.ts
function addressConflictKey(address) {
  return JSON.stringify([address.role, address.outfit, address.tag]);
}
function effectiveSpriteAddress(pack, sprite, multiPack) {
  const outfit = spriteOutfit(pack, sprite);
  const semanticRole = (sprite.group ?? "").trim() || (pack.roleName ?? "").trim();
  const role = semanticRole || (multiPack || outfit ? normalizeTag(pack.name) : "");
  return { role, outfit, tag: sprite.tag };
}
function findAddressConflicts(packs) {
  const multiPack = packs.length > 1;
  const grouped = /* @__PURE__ */ new Map();
  for (const pack of packs) {
    for (const sprite of pack.sprites) {
      const address = effectiveSpriteAddress(pack, sprite, multiPack);
      const key = addressConflictKey(address);
      let entry = grouped.get(key);
      if (!entry) {
        entry = { address, owners: /* @__PURE__ */ new Map() };
        grouped.set(key, entry);
      }
      if (!entry.owners.has(pack.id)) {
        entry.owners.set(pack.id, {
          packId: pack.id,
          packName: pack.name,
          spriteUrl: sprite.url
        });
      }
    }
  }
  const conflicts = [];
  for (const [key, entry] of grouped) {
    if (entry.owners.size < 2) continue;
    conflicts.push({
      key,
      address: entry.address,
      formattedAddress: formatAddress(entry.address),
      owners: [...entry.owners.values()]
    });
  }
  return conflicts;
}

// core/prompt-builder.ts
function buildPromptSceneNotes(packs, addresses) {
  const notes = [];
  const multiPack = packs.length > 1;
  const available2 = new Set(addresses.map(addressConflictKey));
  for (const pack of packs) {
    const scenes = [];
    const seen = /* @__PURE__ */ new Set();
    for (const sprite of pack.sprites) {
      const scene = effectiveSpriteAddress(pack, sprite, multiPack);
      if (!available2.has(addressConflictKey(scene))) continue;
      const key = JSON.stringify([scene.role, scene.outfit]);
      if (seen.has(key)) continue;
      seen.add(key);
      scenes.push(scene);
    }
    const placement = pack.promptNotePlacement ?? DEFAULT_PROMPT_NOTE_PLACEMENT;
    const packNote = pack.promptNote?.trim() ?? "";
    for (const [index, scene] of scenes.entries()) {
      if (packNote && placement === "before-list" && index === 0) {
        notes.push({ role: scene.role, outfit: scene.outfit, note: packNote, placement });
      }
      const outfitNote = pack.outfitNotes && Object.prototype.hasOwnProperty.call(pack.outfitNotes, scene.outfit) ? pack.outfitNotes?.[scene.outfit]?.trim() ?? "" : "";
      if (outfitNote) {
        notes.push({ role: scene.role, outfit: scene.outfit, note: outfitNote, placement });
      }
      if (packNote && placement === "after-list" && index === scenes.length - 1) {
        notes.push({ role: scene.role, outfit: scene.outfit, note: packNote, placement });
      }
    }
  }
  return notes;
}
function buildPromptSceneInventories(packs, addresses) {
  const inventories = [];
  const multiPack = packs.length > 1;
  const available2 = new Set(addresses.map(addressConflictKey));
  for (const pack of packs) {
    const inventoryText = pack.inventoryPrompt?.trim();
    if (!inventoryText) continue;
    const scenes = /* @__PURE__ */ new Set();
    for (const sprite of pack.sprites) {
      const scene = effectiveSpriteAddress(pack, sprite, multiPack);
      if (!available2.has(addressConflictKey(scene))) continue;
      const key = JSON.stringify([scene.role, scene.outfit]);
      if (scenes.has(key)) continue;
      scenes.add(key);
      inventories.push({ role: scene.role, outfit: scene.outfit, inventoryPrompt: inventoryText });
    }
  }
  return inventories;
}
function countInstruction(count) {
  if (count <= 1) {
    return "请在每次回复的末尾，选择一个最贴合当前情境与角色情绪的立绘，以 [立绘:名称] 的格式单独标注。";
  }
  return `请根据回复内容，按情节顺序选择 ${count} 张立绘。每个 [立绘:...] 标签单独占一行，插在触发它的剧情段落之后——随剧情分散在正文中，不要集中堆在回复结尾。`;
}
function sceneKey(a) {
  return `${a.role}|${a.outfit}`;
}
function sceneLabel(a) {
  if (a.role && a.outfit) return `${a.role}/${a.outfit}`;
  if (a.role) return a.role;
  return "默认";
}
function indexSceneInventories(inventories) {
  const index = /* @__PURE__ */ new Map();
  for (const { role, outfit, inventoryPrompt } of inventories) {
    const key = `${role}|${outfit}`;
    const existing = index.get(key) ?? [];
    existing.push(inventoryPrompt);
    index.set(key, existing);
  }
  return index;
}
function scenePrefix(a) {
  if (a.role && a.outfit) return `${a.role}/${a.outfit}`;
  if (a.role) return a.role;
  return "";
}
function buildScenes(addresses) {
  const scenes = /* @__PURE__ */ new Map();
  for (const address of addresses) {
    const key = sceneKey(address);
    let scene = scenes.get(key);
    if (!scene) {
      scene = {
        key,
        label: sceneLabel(address),
        prefix: scenePrefix(address),
        role: address.role,
        outfit: address.outfit,
        tags: [],
        seen: /* @__PURE__ */ new Set()
      };
      scenes.set(key, scene);
    }
    if (!scene.seen.has(address.tag)) {
      scene.seen.add(address.tag);
      scene.tags.push(address.tag);
    }
  }
  return [...scenes.values()].map(({ seen: _seen, ...scene }) => scene);
}
function renderTags(tags, reservedTags) {
  const entries = compactNumberedTags(tags, reservedTags);
  return {
    text: entries.map((entry) => entry.label).join("、"),
    ranges: entries.filter((entry) => entry.kind === "range").map((entry) => entry.label)
  };
}
var FULL_WIDTH_SPACE = "　";
function rangeInstruction(ranges, example) {
  if (ranges.length === 0) return [];
  const lines = ["编号范围仅用于压缩展示。必须把括号换成范围内的一个具体整数，禁止原样输出范围标签。"];
  if (example) lines.push(`正确：[立绘:${example.correct}]${FULL_WIDTH_SPACE}错误：[立绘:${example.wrong}]`);
  return lines;
}
function findRangeExample(scenes, reservedTags) {
  for (const scene of scenes) {
    const entry = compactNumberedTags(scene.tags, reservedTags).find((item) => item.kind === "range");
    if (!entry) continue;
    const addr = (tag) => scene.prefix ? `${scene.prefix}/${tag}` : tag;
    return { correct: addr(entry.values[0]), wrong: addr(entry.label) };
  }
  return void 0;
}
function indexSceneNotes(notes) {
  const index = /* @__PURE__ */ new Map();
  for (const note of notes) {
    if (!note.note.trim()) continue;
    const key = `${note.role}|${note.outfit}`;
    let placements = index.get(key);
    if (!placements) {
      placements = { "before-list": [], "after-list": [] };
      index.set(key, placements);
    }
    placements[note.placement].push(note);
  }
  return index;
}
function matchingNotes(noteIndex, scene, placement) {
  return noteIndex.get(scene.key)?.[placement] ?? [];
}
function noteLines(scene, note) {
  const parts = note.note.split("\n").map((line) => line.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  const head = parts[0];
  const rest = parts.slice(1).map((line) => `  ${line}`);
  if (note.placement === "before-list") {
    return [`备注（${scene.label}）：${head}`, ...rest];
  }
  return [`  备注：${head}`, ...rest.map((line) => `  ${line}`)];
}
function renderGroupedSceneList(scenes, noteIndex, reservedTags, inventoryIndex = /* @__PURE__ */ new Map()) {
  const lines = [];
  const ranges = [];
  for (const scene of scenes) {
    for (const note of matchingNotes(noteIndex, scene, "before-list")) {
      lines.push(...noteLines(scene, note));
    }
    const rendered = renderTags(scene.tags, reservedTags);
    lines.push(`- ${scene.label}：${rendered.text}`);
    ranges.push(...rendered.ranges);
    for (const text4 of inventoryIndex.get(scene.key) ?? []) {
      for (const line of text4.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) lines.push(`  ${trimmed}`);
      }
    }
    for (const note of matchingNotes(noteIndex, scene, "after-list")) {
      lines.push(...noteLines(scene, note));
    }
  }
  return { lines, ranges };
}
function fewShotExample(scenes, count) {
  if (count <= 1) return [];
  const scene = scenes[0];
  if (!scene || scene.tags.length === 0) return [];
  const addr = (tag) => scene.prefix ? `${scene.prefix}/${tag}` : tag;
  const first = scene.tags[0];
  const second = scene.tags[1] ?? scene.tags[0];
  return [
    "插入位置示例（省略号代表你的正文段落）：",
    "…剧情段落一…",
    `[立绘:${addr(first)}]`,
    "…剧情段落二…",
    `[立绘:${addr(second)}]`
  ];
}
function formatInstruction(scenes) {
  const hasDefault = scenes.some((scene) => !scene.role);
  const hasRoleOnly = scenes.some((scene) => scene.role && !scene.outfit);
  const hasOutfit = scenes.some((scene) => scene.role && scene.outfit);
  if (hasDefault && !hasRoleOnly && !hasOutfit) {
    return "输出格式：[立绘:图名]，图名须与上方清单完全一致。";
  }
  if (hasOutfit && !hasDefault && !hasRoleOnly) {
    return "输出格式：[立绘:角色/服装/图名]，角色、服装、图名均须与上方清单完全一致。";
  }
  return "输出格式：默认场景直接写 [立绘:图名]；其他场景写 [立绘:场景/图名]。两段地址表示无服装，三级地址表示指定服装。";
}
var CLOSING_INSTRUCTION = "只能使用上述场景中实际列出的图名，不要自行拼造不存在的角色/服装/图名组合。";
function buildGroupedFull(addresses, count, noteIndex, reservedTags, inventoryIndex) {
  const scenes = buildScenes(addresses);
  const rendered = renderGroupedSceneList(scenes, noteIndex, reservedTags, inventoryIndex);
  return [
    "[角色立绘系统]",
    "可用立绘（按场景）：",
    ...rendered.lines,
    ...rangeInstruction(rendered.ranges, findRangeExample(scenes, reservedTags)),
    formatInstruction(scenes),
    countInstruction(count),
    ...fewShotExample(scenes, count),
    CLOSING_INSTRUCTION
  ].join("\n");
}
var SHARED_LIST_LABEL = "共有图名";
function findSharedCluster(scenes) {
  const sets = scenes.map((scene) => new Set(scene.tags));
  const joinedLen = (tags) => tags.reduce((sum, tag) => sum + tag.length, 0) + Math.max(0, tags.length - 1);
  const seenCores = /* @__PURE__ */ new Set();
  let best = null;
  let bestSavings = 0;
  for (let i = 0; i < scenes.length; i++) {
    for (let j = i + 1; j < scenes.length; j++) {
      const core = scenes[i].tags.filter((tag) => sets[j].has(tag));
      if (core.length < 2) continue;
      const signature = core.join("\0");
      if (seenCores.has(signature)) continue;
      seenCores.add(signature);
      const members = sets.map((set) => core.every((tag) => set.has(tag)));
      const memberCount = members.filter(Boolean).length;
      const coreLen = joinedLen(core);
      const savings = memberCount * (coreLen - SHARED_LIST_LABEL.length - 5) - (coreLen + 60);
      if (savings > bestSavings) {
        bestSavings = savings;
        best = { core, members };
      }
    }
  }
  return best;
}
function buildShared(addresses, count, noteIndex, reservedTags, inventoryIndex) {
  const scenes = buildScenes(addresses);
  if (scenes.length <= 1 || reservedTags.has(SHARED_LIST_LABEL)) {
    return buildGroupedFull(addresses, count, noteIndex, reservedTags, inventoryIndex);
  }
  const cluster = findSharedCluster(scenes);
  if (!cluster) {
    return buildGroupedFull(addresses, count, noteIndex, reservedTags, inventoryIndex);
  }
  const coreSet = new Set(cluster.core);
  const renderedCore = renderTags(cluster.core, reservedTags);
  const ranges = [...renderedCore.ranges];
  const lines = [
    "[角色立绘系统]",
    `${SHARED_LIST_LABEL}：${renderedCore.text}`,
    "可用立绘（按场景）："
  ];
  for (const [index, scene] of scenes.entries()) {
    for (const note of matchingNotes(noteIndex, scene, "before-list")) {
      lines.push(...noteLines(scene, note));
    }
    if (cluster.members[index]) {
      const remainder = scene.tags.filter((tag) => !coreSet.has(tag));
      if (remainder.length === 0) {
        lines.push(`- ${scene.label}：${SHARED_LIST_LABEL}`);
      } else {
        const rendered = renderTags(remainder, reservedTags);
        lines.push(`- ${scene.label}：${SHARED_LIST_LABEL}，另有：${rendered.text}`);
        ranges.push(...rendered.ranges);
      }
    } else {
      const rendered = renderTags(scene.tags, reservedTags);
      lines.push(`- ${scene.label}：${rendered.text}`);
      ranges.push(...rendered.ranges);
    }
    for (const text4 of inventoryIndex.get(scene.key) ?? []) {
      for (const line of text4.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) lines.push(`  ${trimmed}`);
      }
    }
    for (const note of matchingNotes(noteIndex, scene, "after-list")) {
      lines.push(...noteLines(scene, note));
    }
  }
  lines.push(`场景行写「${SHARED_LIST_LABEL}」表示最上方共有清单里的图名整组可用；「另有」及直接列出的图名只属于所在场景。`);
  lines.push(...rangeInstruction(ranges, findRangeExample(scenes, reservedTags)));
  lines.push(formatInstruction(scenes));
  lines.push(countInstruction(count));
  lines.push(...fewShotExample(scenes, count));
  lines.push(CLOSING_INSTRUCTION);
  return lines.join("\n");
}
var ROLE_BASE_LIST_LABEL = "基础图名池";
var VARIANT_SUFFIX = "_变";
function findRoleBaseCluster(scenes) {
  const plainTags = scenes.map((scene) => scene.tags.filter((tag) => !tag.endsWith(VARIANT_SUFFIX)));
  const sets = plainTags.map((tags) => new Set(tags));
  const seen = /* @__PURE__ */ new Set();
  let best = null;
  for (let i = 0; i < scenes.length; i++) {
    for (let j = i + 1; j < scenes.length; j++) {
      const core = plainTags[i].filter((tag) => sets[j].has(tag));
      if (core.length < 2) continue;
      const signature = JSON.stringify(core);
      if (seen.has(signature)) continue;
      seen.add(signature);
      const members = sets.map((set) => core.every((tag) => set.has(tag)));
      if (!best || core.length > best.core.length || core.length === best.core.length && members.filter(Boolean).length > best.members.filter(Boolean).length) {
        best = { core, members };
      }
    }
  }
  return best;
}
function variantBases(tags) {
  const seen = /* @__PURE__ */ new Set();
  const bases = [];
  for (const tag of tags) {
    if (!tag.endsWith(VARIANT_SUFFIX)) continue;
    const base = tag.slice(0, -VARIANT_SUFFIX.length);
    if (!base || seen.has(base)) continue;
    seen.add(base);
    bases.push(base);
  }
  return bases;
}
function relativeFewShotExample(scenes, count) {
  if (count <= 1) return [];
  const scene = scenes[0];
  if (!scene || scene.tags.length === 0) return [];
  const first = scene.tags[0];
  const second = scene.tags[1] ?? first;
  return [
    "插入位置示例（省略号代表你的正文段落）：",
    "…剧情段落一…",
    `[立绘:${first}]`,
    "…剧情段落二…",
    `[立绘:${second}]`
  ];
}
function buildRoleCompact(addresses, count, noteIndex, reservedTags, inventoryIndex) {
  const scenes = buildScenes(addresses);
  const role = scenes[0]?.role;
  if (scenes.length < 2 || !role || reservedTags.has(ROLE_BASE_LIST_LABEL) || scenes.some((scene) => scene.role !== role || !scene.outfit)) return null;
  const cluster = findRoleBaseCluster(scenes);
  if (!cluster || !cluster.members[0]) return null;
  const baseSet = new Set(cluster.core);
  const renderedBase = renderTags(cluster.core, reservedTags);
  const ranges = [...renderedBase.ranges];
  const lines = [
    "[角色立绘系统]",
    `角色：${role}`,
    `${ROLE_BASE_LIST_LABEL}：${renderedBase.text}`,
    "可用服装："
  ];
  for (const [index, scene] of scenes.entries()) {
    for (const note of matchingNotes(noteIndex, scene, "before-list")) {
      lines.push(...noteLines(scene, note));
    }
    const label = `${scene.outfit}${index === 0 ? "（默认）" : cluster.members[index] ? "" : "（仅限）"}`;
    const plainTags = scene.tags.filter((tag) => !tag.endsWith(VARIANT_SUFFIX));
    if (cluster.members[index]) {
      const extras = plainTags.filter((tag) => !baseSet.has(tag));
      if (extras.length === 0) {
        lines.push(`- ${label}：${ROLE_BASE_LIST_LABEL}`);
      } else {
        const rendered = renderTags(extras, reservedTags);
        lines.push(`- ${label}：${ROLE_BASE_LIST_LABEL}，另有：${rendered.text}`);
        ranges.push(...rendered.ranges);
      }
    } else {
      const rendered = renderTags(plainTags, reservedTags);
      lines.push(`- ${label}：${rendered.text}`);
      ranges.push(...rendered.ranges);
    }
    for (const text4 of inventoryIndex.get(scene.key) ?? []) {
      for (const line of text4.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) lines.push(`  ${trimmed}`);
      }
    }
    const variants = variantBases(scene.tags);
    if (variants.length > 0) lines.push(`  可用“${VARIANT_SUFFIX}”后缀：${variants.join("、")}`);
    for (const note of matchingNotes(noteIndex, scene, "after-list")) {
      lines.push(...noteLines(scene, note));
    }
  }
  lines.push(`服装行写“${ROLE_BASE_LIST_LABEL}”表示该服装可用上方整组图名；“另有”和“仅限”只属于所在服装。`);
  lines.push(...rangeInstruction(ranges, findRangeExample(scenes, reservedTags)));
  lines.push("输出格式：[立绘:图名]（默认服装）或 [立绘:服装/图名]（其他服装）；完整 [立绘:角色/服装/图名] 仍兼容。");
  lines.push(countInstruction(count));
  lines.push(...relativeFewShotExample(scenes, count));
  lines.push(CLOSING_INSTRUCTION);
  return lines.join("\n");
}
function chooseShorterPrompt(grouped, shared) {
  return shared.length < grouped.length ? shared : grouped;
}
function capAddresses(addresses, cap) {
  const perScene = /* @__PURE__ */ new Map();
  const kept = [];
  for (const address of addresses) {
    const key = sceneKey(address);
    let tags = perScene.get(key);
    if (!tags) {
      tags = /* @__PURE__ */ new Set();
      perScene.set(key, tags);
    }
    if (tags.has(address.tag)) continue;
    if (tags.size >= cap) continue;
    tags.add(address.tag);
    kept.push(address);
  }
  return kept;
}
function fitToBudget(addresses, budget, build) {
  const full = build(addresses);
  if (budget <= 0 || full.length <= budget) return full;
  const maxTags = Math.max(...buildScenes(addresses).map((scene) => scene.tags.length));
  let best = build(capAddresses(addresses, 1));
  let lo = 2;
  let hi = maxTags;
  while (lo <= hi) {
    const mid = lo + hi >> 1;
    const candidate = build(capAddresses(addresses, mid));
    if (candidate.length <= budget) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}
var BUILTIN_TEMPLATE = [
  "[角色立绘系统]",
  "可用立绘（按场景）：",
  "{清单}",
  "输出格式：默认场景直接写 [立绘:图名]；其他场景写 [立绘:场景/图名]。两段地址表示无服装，三级地址表示指定服装。",
  "请根据回复内容，按情节顺序选择 {数量} 张立绘。每个 [立绘:...] 标签单独占一行，插在触发它的剧情段落之后——随剧情分散在正文中，不要集中堆在回复结尾。",
  "只能使用上述场景中实际列出的图名，不要自行拼造不存在的角色/服装/图名组合。"
].join("\n");
var LEGACY_BUILTIN_TEMPLATES = [
  [
    "[角色立绘系统]",
    "可用立绘（按场景）：",
    "{清单}",
    "输出格式：默认场景直接写 [立绘:表情]；其他场景写 [立绘:场景/表情]。两段地址表示无服装，三级地址表示指定服装。",
    "请根据回复内容，按情节顺序选择 {数量} 张立绘。每个 [立绘:...] 标签单独占一行，插在触发它的剧情段落之后——随剧情分散在正文中，不要集中堆在回复结尾。",
    "只能使用上述场景中实际列出的表情，不要自行拼造不存在的角色/服装/表情组合。"
  ].join("\n")
];
function normalizeTemplateLineEndings(template) {
  return template.replace(/\r\n?/g, "\n");
}
function isKnownBuiltinTemplate(template) {
  const normalized = normalizeTemplateLineEndings(template);
  return [BUILTIN_TEMPLATE, ...LEGACY_BUILTIN_TEMPLATES].some((known) => normalized === known);
}
function buildPrompt(addresses, mode, count, template = "", budget = 0, notes = [], inventories = []) {
  if (addresses.length === 0) return "";
  const n = Math.max(1, Math.round(count) || 1);
  const b = Math.max(0, Math.round(budget) || 0);
  const noteIndex = indexSceneNotes(notes);
  const inventoryIndex = indexSceneInventories(inventories);
  const reservedTags = new Set(addresses.map((address) => address.tag));
  const custom = template.trim();
  if (custom && !isKnownBuiltinTemplate(template)) {
    return fitToBudget(addresses, b, (addrs) => {
      const scenes = buildScenes(addrs);
      const rendered = renderGroupedSceneList(scenes, noteIndex, reservedTags, inventoryIndex);
      const list = [...rendered.lines, ...rangeInstruction(rendered.ranges, findRangeExample(scenes, reservedTags))].join("\n");
      return custom.replace(/\{清单\}/g, list).replace(/\{数量\}/g, String(n));
    });
  }
  return fitToBudget(addresses, b, (addrs) => {
    const grouped = buildGroupedFull(addrs, n, noteIndex, reservedTags, inventoryIndex);
    if (mode === "full") return grouped;
    const shared = chooseShorterPrompt(grouped, buildShared(addrs, n, noteIndex, reservedTags, inventoryIndex));
    const roleCompact = buildRoleCompact(addrs, n, noteIndex, reservedTags, inventoryIndex);
    return roleCompact && roleCompact.length < grouped.length ? roleCompact : shared;
  });
}

// core/sprite-store.ts
function genId() {
  return `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function getActivePacks(settings, characterName) {
  const binding = settings.bindings.find((b) => b.characterName === characterName && b.enabled);
  if (!binding) return [];
  const byId = new Map(settings.packs.map((p) => [p.id, p]));
  return binding.packIds.map((id) => byId.get(id)).filter((p) => p != null);
}
function packBaseAlias(pack) {
  return normalizeTag(pack.name ?? "") || "包";
}
function getActiveAddresses(settings, characterName) {
  const packs = getActivePacks(settings, characterName);
  const conflicted = new Set(findAddressConflicts(packs).map((conflict) => conflict.key));
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const c of flatten(packs)) {
    const address = { role: c.role, outfit: c.outfit, tag: c.sprite.tag };
    if (conflicted.has(addressConflictKey(address))) continue;
    const key = formatAddress(address);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(address);
  }
  return out;
}
function spriteGroup(sprite) {
  return sprite.group ?? "";
}
function spriteOutfitTag(sprite) {
  return sprite.outfit ?? "";
}
function effectiveRole(pack, group) {
  return group.trim() || (pack.roleName ?? "").trim();
}
function effectiveOutfitOf(pack, outfit) {
  return outfit.trim() || (pack.outfit ?? "").trim();
}
function normalizeIdentityFields(pack, sprite) {
  const next = { ...sprite };
  if ((next.group ?? "").trim() === (pack.roleName ?? "").trim()) delete next.group;
  if ((next.outfit ?? "").trim() === (pack.outfit ?? "").trim()) delete next.outfit;
  return next;
}
function sameIdentity(pack, s, tag, group, outfit) {
  return s.tag === tag && effectiveRole(pack, spriteGroup(s)) === effectiveRole(pack, group) && effectiveOutfitOf(pack, spriteOutfitTag(s)) === effectiveOutfitOf(pack, outfit);
}
function identityKey(pack, sprite) {
  return JSON.stringify([
    effectiveRole(pack, spriteGroup(sprite)),
    effectiveOutfitOf(pack, spriteOutfitTag(sprite)),
    sprite.tag
  ]);
}
function dedupeSprites(pack, sprites) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const raw of sprites) {
    const sprite = normalizeIdentityFields(pack, raw);
    const key = identityKey(pack, sprite);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sprite);
  }
  return out;
}
function previewBindingAddressChanges(before, after, characterName) {
  const oldAddresses = getActiveAddresses(before, characterName).map(formatAddress);
  const newAddresses = getActiveAddresses(after, characterName).map(formatAddress);
  const oldSet = new Set(oldAddresses);
  const newSet = new Set(newAddresses);
  return {
    removed: oldAddresses.filter((address) => !newSet.has(address)),
    added: newAddresses.filter((address) => !oldSet.has(address))
  };
}
function flatten(packs) {
  const multiPack = packs.length > 1;
  const out = [];
  for (const pack of packs) {
    const base = packBaseAlias(pack);
    for (const sprite of pack.sprites) {
      const address = effectiveSpriteAddress(pack, sprite, multiPack);
      out.push({
        pack,
        sprite,
        role: address.role,
        outfit: address.outfit,
        baseAlias: base
      });
    }
  }
  return out;
}
function nameMatches(actual, query) {
  if (actual === query) return true;
  return actual.length > 0 && (actual.includes(query) || query.includes(actual));
}
function filterByName(pool, query, of) {
  const exact = pool.filter((c) => of(c) === query);
  if (exact.length > 0) return exact;
  return pool.filter((c) => nameMatches(of(c), query));
}
function lockByRole(pool, query) {
  if (/[@=]/.test(query)) return [];
  const roleMatches = filterByName(pool, query, (c) => c.role);
  if (roleMatches.length > 0) return roleMatches;
  return filterByName(pool, query, (c) => c.baseAlias);
}
function matchUniqueTagInPool(pool, tag) {
  const exact = pool.filter((c) => c.sprite.tag === tag);
  if (exact.length === 1) return exact[0].sprite;
  if (exact.length > 1) {
    const packIds = new Set(exact.map((c) => c.pack.id));
    return packIds.size === 1 ? exact[0].sprite : null;
  }
  const fuzzy = pool.filter((c) => nameMatches(c.sprite.tag, tag));
  if (fuzzy.length === 1) return fuzzy[0].sprite;
  if (fuzzy.length > 1) {
    const packIds = new Set(fuzzy.map((c) => c.pack.id));
    return packIds.size === 1 ? fuzzy[0].sprite : null;
  }
  return null;
}
function strictTagMatch(pool, tag) {
  const exact = pool.filter((candidate) => candidate.sprite.tag === tag);
  if (exact.length > 0) return { matched: true, sprite: exact.length === 1 ? exact[0].sprite : null };
  const fuzzy = pool.filter((candidate) => nameMatches(candidate.sprite.tag, tag));
  return { matched: fuzzy.length > 0, sprite: fuzzy.length === 1 ? fuzzy[0].sprite : null };
}
function isRelativeOutfitSet(packs, candidates) {
  if (packs.length < 2) return false;
  const role = candidates[0]?.role;
  return Boolean(
    role && candidates.length > 0 && candidates.every((candidate) => candidate.role === role && Boolean(candidate.outfit))
  );
}
function resolveSprite(packs, address) {
  const raw = address.trim();
  if (!raw) return null;
  const partCount = raw.split("/").length;
  const { role, outfit, tag } = parseAddress(raw);
  if (!tag) return null;
  const all = flatten(packs);
  if (partCount === 1) {
    const firstPack = packs[0];
    if (firstPack && isRelativeOutfitSet(packs, all)) {
      const preferred = strictTagMatch(
        all.filter((candidate) => candidate.pack.id === firstPack.id),
        tag
      );
      if (preferred.matched) return preferred.sprite;
    }
    return matchUniqueTagInPool(all, tag);
  }
  if (partCount === 2) {
    const exactRole = all.filter((candidate) => candidate.role === role);
    if (exactRole.length > 0) {
      const rolePool = exactRole.filter((candidate) => candidate.outfit === "");
      return strictTagMatch(rolePool, tag).sprite;
    }
    const exactAliasPool = all.filter((candidate) => candidate.baseAlias === role).filter((candidate) => candidate.outfit === "");
    if (exactAliasPool.length > 0) {
      const legacy = strictTagMatch(exactAliasPool, tag);
      if (legacy.matched) return legacy.sprite;
    }
    const exactOutfit = all.filter((candidate) => candidate.outfit === role);
    if (exactOutfit.length > 0) return strictTagMatch(exactOutfit, tag).sprite;
    const fuzzyRole = all.filter((candidate) => nameMatches(candidate.role, role));
    if (fuzzyRole.length > 0) {
      const rolePool = fuzzyRole.filter((candidate) => candidate.outfit === "");
      return strictTagMatch(rolePool, tag).sprite;
    }
    const fuzzyAliasPool = all.filter((candidate) => nameMatches(candidate.baseAlias, role)).filter((candidate) => candidate.outfit === "");
    if (fuzzyAliasPool.length > 0) {
      const legacy = strictTagMatch(fuzzyAliasPool, tag);
      if (legacy.matched) return legacy.sprite;
    }
    const fuzzyOutfit = all.filter((candidate) => nameMatches(candidate.outfit, role));
    return strictTagMatch(fuzzyOutfit, tag).sprite;
  }
  let pool = all;
  if (role) {
    pool = lockByRole(pool, role);
    if (pool.length === 0) return null;
    if (!outfit) {
      pool = pool.filter((c) => c.outfit === "");
      if (pool.length === 0) return null;
    }
  }
  if (outfit) {
    pool = filterByName(pool, outfit, (c) => c.outfit);
    if (pool.length === 0) return null;
  }
  return matchUniqueTagInPool(pool, tag);
}
function resolveSprites(packs, addresses) {
  const out = [];
  for (const address of addresses) {
    const sprite = resolveSprite(packs, address);
    if (sprite && out[out.length - 1] !== sprite) out.push(sprite);
  }
  return out;
}
function success(settings) {
  return { ok: true, settings };
}
function conflictsForBinding(settings, characterName, packIds) {
  const byId = new Map(settings.packs.map((pack) => [pack.id, pack]));
  const packs = packIds.map((id) => byId.get(id)).filter((pack) => pack != null);
  return findAddressConflicts(packs).map((conflict) => ({ ...conflict, characterName }));
}
function uniquePackIds(packIds) {
  const ids = [];
  for (const id of packIds) if (id && !ids.includes(id)) ids.push(id);
  return ids;
}
function withBinding(settings, characterName, packIds, enabled) {
  const others = settings.bindings.filter((binding) => binding.characterName !== characterName);
  if (packIds.length === 0) return { ...settings, bindings: others };
  return {
    ...settings,
    bindings: [...others, { characterName, packIds, enabled }]
  };
}
function upsertPack(settings, pack) {
  const exists = settings.packs.some((p) => p.id === pack.id);
  const next = {
    ...settings,
    packs: exists ? settings.packs.map((p) => p.id === pack.id ? pack : p) : [...settings.packs, pack]
  };
  const conflicts = [];
  for (const binding of next.bindings) {
    if (!binding.enabled || !binding.packIds.includes(pack.id)) continue;
    conflicts.push(...conflictsForBinding(next, binding.characterName, binding.packIds));
  }
  return conflicts.length > 0 ? { ok: false, conflicts } : success(next);
}
function removePack(settings, packId) {
  const bindings = settings.bindings.map((b) => ({ ...b, packIds: b.packIds.filter((id) => id !== packId) })).filter((b) => b.packIds.length > 0);
  return {
    ...settings,
    packs: settings.packs.filter((p) => p.id !== packId),
    bindings
  };
}
function removePacks(settings, packIds) {
  let next = settings;
  for (const id of packIds) next = removePack(next, id);
  return next;
}
function setPackKind(settings, packIds, kind) {
  const selected = new Set(packIds);
  return {
    ...settings,
    packs: settings.packs.map((pack) => selected.has(pack.id) ? { ...pack, kind } : pack)
  };
}
function addPackCustomTag(settings, packIds, rawTag) {
  const tag = normalizeLabels([rawTag])[0];
  if (!tag) return settings;
  const selected = new Set(packIds);
  return {
    ...settings,
    packs: settings.packs.map((pack) => {
      if (!selected.has(pack.id)) return pack;
      const customTags = normalizeLabels([...pack.customTags ?? [], tag]);
      return { ...pack, customTags };
    })
  };
}
function removePackCustomTag(settings, packIds, rawTag) {
  const tag = normalizeLabels([rawTag])[0];
  if (!tag) return settings;
  const selected = new Set(packIds);
  return {
    ...settings,
    packs: settings.packs.map((pack) => {
      if (!selected.has(pack.id)) return pack;
      const customTags = normalizeLabels(pack.customTags).filter((item) => item !== tag);
      const next = { ...pack };
      if (customTags.length > 0) next.customTags = customTags;
      else delete next.customTags;
      return next;
    })
  };
}
function filterSpritePacks(packs, filter) {
  const query = filter.query?.trim().toLocaleLowerCase() ?? "";
  const roles = new Set(normalizeLabels(filter.roles));
  const kinds = new Set(filter.kinds ?? []);
  const customTags = new Set(normalizeLabels(filter.customTags));
  if (!query && roles.size === 0 && kinds.size === 0 && customTags.size === 0) return packs;
  return packs.filter((pack) => {
    const role = pack.roleName?.trim() || "其他";
    const kind = pack.kind ?? "sprite";
    const tags = normalizeLabels(pack.customTags);
    const searchable = [pack.name, role, pack.outfit ?? "", ...tags].join("\n").toLocaleLowerCase();
    return (!query || searchable.includes(query)) && (roles.size === 0 || roles.has(role)) && (kinds.size === 0 || kinds.has(kind)) && (customTags.size === 0 || tags.some((tag) => customTags.has(tag)));
  });
}
function renamePackCustomTag(settings, rawFrom, rawTo) {
  const from = normalizeLabels([rawFrom])[0];
  const to = normalizeLabels([rawTo])[0];
  if (!from || !to || from === to) return settings;
  return {
    ...settings,
    packs: settings.packs.map((pack) => {
      const tags = normalizeLabels(pack.customTags);
      if (!tags.includes(from)) return pack;
      return { ...pack, customTags: normalizeLabels(tags.map((tag) => tag === from ? to : tag)) };
    })
  };
}
function deletePackCustomTag(settings, rawTag) {
  const tag = normalizeLabels([rawTag])[0];
  if (!tag) return settings;
  return {
    ...settings,
    packs: settings.packs.map((pack) => {
      const tags = normalizeLabels(pack.customTags);
      if (!tags.includes(tag)) return pack;
      const customTags = tags.filter((item) => item !== tag);
      const next = { ...pack };
      if (customTags.length > 0) next.customTags = customTags;
      else delete next.customTags;
      return next;
    })
  };
}
function isSafeLocalUserImagePath(path) {
  if (!path.startsWith("/user/images/") || /%(?:2e|2f|5c)/i.test(path) || path.includes("\0")) return false;
  return !path.split("/").some((segment) => segment === "." || segment === "..");
}
function localUserImagePath(url) {
  const rawPath = url.split(/[?#]/, 1)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  const normalized = decoded.replace(/\\/g, "/");
  if (!isSafeLocalUserImagePath(normalized)) return null;
  return normalized;
}
function deletableLocalSpritePaths(settings, packIds) {
  const selected = new Set(packIds);
  const keptReferences = /* @__PURE__ */ new Set();
  for (const pack of settings.packs) {
    if (selected.has(pack.id)) continue;
    for (const sprite of pack.sprites) {
      const path = localUserImagePath(sprite.url);
      if (path) keptReferences.add(path);
    }
  }
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const pack of settings.packs) {
    if (!selected.has(pack.id)) continue;
    for (const sprite of pack.sprites) {
      const path = localUserImagePath(sprite.url);
      if (!path || seen.has(path) || keptReferences.has(path)) continue;
      seen.add(path);
      result.push(path);
    }
  }
  return result;
}
function movePack(settings, packId, offset) {
  const from = settings.packs.findIndex((p) => p.id === packId);
  if (from < 0) return settings;
  const to = from + offset;
  if (to < 0 || to >= settings.packs.length) return settings;
  const packs = [...settings.packs];
  const [moved] = packs.splice(from, 1);
  packs.splice(to, 0, moved);
  return { ...settings, packs };
}
function movePackBefore(settings, packId, targetId) {
  if (packId === targetId) return settings;
  const from = settings.packs.findIndex((p) => p.id === packId);
  if (from < 0) return settings;
  const packs = [...settings.packs];
  const [moved] = packs.splice(from, 1);
  const to = packs.findIndex((p) => p.id === targetId);
  if (to < 0) return settings;
  packs.splice(to, 0, moved);
  return { ...settings, packs };
}
function bindPack(settings, characterName, packId) {
  const existing = settings.bindings.find((b) => b.characterName === characterName);
  const ids = uniquePackIds([...existing?.packIds ?? [], packId]);
  const conflicts = conflictsForBinding(settings, characterName, ids);
  if (conflicts.length > 0) return { ok: false, conflicts };
  return success(withBinding(settings, characterName, ids, true));
}
function unbindPack(settings, characterName, packId) {
  const bindings = settings.bindings.map(
    (b) => b.characterName === characterName ? { ...b, packIds: b.packIds.filter((id) => id !== packId) } : b
  ).filter((b) => b.packIds.length > 0);
  return { ...settings, bindings };
}
function setBinding(settings, characterName, packIds) {
  const ids = uniquePackIds(packIds);
  const conflicts = conflictsForBinding(settings, characterName, ids);
  if (conflicts.length > 0) return { ok: false, conflicts };
  const prev = settings.bindings.find((b) => b.characterName === characterName);
  return success(withBinding(settings, characterName, ids, prev?.enabled ?? true));
}
function reorderBinding(settings, characterName, fromIndex, toIndex) {
  return {
    ...settings,
    bindings: settings.bindings.map((b) => {
      if (b.characterName !== characterName) return b;
      const ids = [...b.packIds];
      if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex >= ids.length) return b;
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved);
      return { ...b, packIds: ids };
    })
  };
}
function touchPack(pack, sprites) {
  return { ...pack, sprites, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function upsertSprite(pack, sprite) {
  const stored = normalizeIdentityFields(pack, sprite);
  const g = spriteGroup(stored);
  const o = spriteOutfitTag(stored);
  const sprites = [];
  let replaced = false;
  for (const current2 of pack.sprites) {
    if (sameIdentity(pack, current2, stored.tag, g, o)) {
      if (!replaced) {
        sprites.push(stored);
        replaced = true;
      }
      continue;
    }
    sprites.push(current2);
  }
  if (!replaced) sprites.push(stored);
  return touchPack(pack, dedupeSprites(pack, sprites));
}
function removeSprite(pack, tag, group = "", outfit = "") {
  const next = touchPack(
    pack,
    pack.sprites.filter((s) => !sameIdentity(pack, s, tag, group, outfit))
  );
  if (next.coverTag === tag && !next.sprites.some((s) => s.tag === tag)) delete next.coverTag;
  return next;
}
function renameSprite(pack, oldTag, newTagRaw, group = "", outfit = "") {
  const newTag = normalizeTag(newTagRaw);
  if (!newTag) throw new Error(t("spriteValidation.invalid_name", "表情名不能为空，且不能包含 [ ] / : | = @ 等符号"));
  if (newTag === oldTag) return pack;
  if (pack.sprites.some((s) => sameIdentity(pack, s, newTag, group, outfit))) {
    throw new Error(t("spriteValidation.duplicate_name", "表情名「{{name}}」在该分组中已存在", { name: newTag }));
  }
  const sprites = pack.sprites.map(
    (s) => sameIdentity(pack, s, oldTag, group, outfit) ? { ...s, tag: newTag } : s
  );
  const next = touchPack(pack, sprites);
  if (next.coverTag === oldTag) next.coverTag = newTag;
  return next;
}
function setSpriteGroup(pack, tag, fromGroup, toGroupRaw, outfit = "") {
  const toGroup = normalizeTag(toGroupRaw);
  const sources = new Set(
    pack.sprites.filter((s) => sameIdentity(pack, s, tag, fromGroup, outfit))
  );
  if (pack.sprites.some(
    (s) => !sources.has(s) && sameIdentity(pack, s, tag, toGroup, outfit)
  )) {
    throw new Error(t("spriteValidation.duplicate_group", "分组「{{group}}」中已存在表情「{{name}}」", {
      group: toGroup || t("spriteValidation.ungrouped", "未分组"),
      name: tag
    }));
  }
  const sprites = pack.sprites.map((s) => {
    if (!sources.has(s)) return s;
    const next = { ...s };
    if (toGroup) next.group = toGroup;
    else delete next.group;
    return normalizeIdentityFields(pack, next);
  });
  return touchPack(pack, dedupeSprites(pack, sprites));
}
function moveSprite(pack, fromIndex, toIndex) {
  const len = pack.sprites.length;
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= len || toIndex < 0 || toIndex >= len) {
    return pack;
  }
  const sprites = [...pack.sprites];
  const [moved] = sprites.splice(fromIndex, 1);
  sprites.splice(toIndex, 0, moved);
  return touchPack(pack, sprites);
}
function toggleBinding(settings, characterName, enabled) {
  const binding = settings.bindings.find((item) => item.characterName === characterName);
  if (enabled && binding) {
    const conflicts = conflictsForBinding(settings, characterName, binding.packIds);
    if (conflicts.length > 0) return { ok: false, conflicts };
  }
  return success({
    ...settings,
    bindings: settings.bindings.map(
      (b) => b.characterName === characterName ? { ...b, enabled } : b
    )
  });
}

// core/active-prompt.ts
function buildActiveSpritePrompt(settings, characterName, budget = settings.promptBudget) {
  const packs = getActivePacks(settings, characterName);
  const addresses = getActiveAddresses(settings, characterName);
  return buildPrompt(
    addresses,
    settings.multiRolePromptMode,
    settings.spriteCount,
    settings.promptTemplate,
    budget,
    buildPromptSceneNotes(packs, addresses),
    buildPromptSceneInventories(packs, addresses)
  );
}

// core/tag-parser.ts
var TAG_REGEX = /[[【]\s*立绘\s*[:：]\s*([^\]】]+?)\s*[\]】]/g;
function extractTags(text4) {
  const tags = [];
  let match;
  const regex = new RegExp(TAG_REGEX.source, "g");
  while ((match = regex.exec(text4)) !== null) {
    const tag = match[1].trim();
    if (tag) tags.push(tag);
  }
  return tags;
}
function stripTags(text4) {
  return text4.replace(new RegExp(TAG_REGEX.source, "g"), "").replace(/[ \t]+$/gm, "");
}
function replaceTags(text4, replacer) {
  return text4.replace(new RegExp(TAG_REGEX.source, "g"), (raw, address) => {
    const trimmed = address.trim();
    if (!trimmed) return raw;
    const out = replacer(trimmed, raw);
    return out === null ? raw : out;
  });
}
function hasTag(text4) {
  return new RegExp(TAG_REGEX.source).test(text4);
}

// core/approx-match.ts
function addressTerms(role, outfit, tag) {
  const terms = [];
  for (const part of [role, outfit]) {
    const trimmed = part.trim();
    if (trimmed) terms.push(trimmed);
  }
  const tagTrimmed = tag.trim();
  if (tagTrimmed) {
    terms.push(tagTrimmed);
    for (const piece of tagTrimmed.split(/[_\-\s/·、,，.。]+/)) {
      const p = piece.trim();
      if (p && p !== tagTrimmed && !/^\d+$/.test(p)) terms.push(p);
    }
  }
  return [...new Set(terms)];
}
function buildApproxCandidates(packs) {
  const multiPack = packs.length > 1;
  const candidates = [];
  for (const pack of packs) {
    for (const sprite of pack.sprites) {
      const address = effectiveSpriteAddress(pack, sprite, multiPack);
      const terms = addressTerms(address.role, address.outfit, address.tag);
      if (terms.length > 0) candidates.push({ sprite, terms });
    }
  }
  return candidates;
}
function termWeight(term) {
  return term.length >= 2 ? 2 : 1;
}
var MIN_SCORE = 2;
function approxMatchSprite(candidates, description) {
  const text4 = description.trim();
  if (!text4 || candidates.length === 0) return null;
  let best = null;
  let tied = false;
  for (const candidate of candidates) {
    let score = 0;
    const hits = [];
    for (const term of candidate.terms) {
      if (text4.includes(term)) {
        score += termWeight(term);
        hits.push(term);
      }
    }
    if (score < MIN_SCORE) continue;
    if (!best || score > best.score) {
      best = { sprite: candidate.sprite, score, hits };
      tied = false;
    } else if (score === best.score && candidate.sprite !== best.sprite) {
      tied = true;
    }
  }
  return best && !tied ? best : null;
}
function resolveWithApprox(packs, address, resolveOne, enabled, candidatesCache) {
  const exact = resolveOne(packs, address);
  if (exact || !enabled) return exact;
  if (candidatesCache) {
    candidatesCache.current ?? (candidatesCache.current = buildApproxCandidates(packs));
    return approxMatchSprite(candidatesCache.current, address)?.sprite ?? null;
  }
  return approxMatchSprite(buildApproxCandidates(packs), address)?.sprite ?? null;
}

// core/variable-hud.ts
function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}
function isTupleLeaf(v) {
  return Array.isArray(v) && v.length === 2 && typeof v[1] === "string" && !Array.isArray(v[0]);
}
function formatHudValue(v) {
  if (typeof v === "string") return v;
  if (v === null) return "null";
  if (v === void 0) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
function clipHudValue(text4, max = 80) {
  const oneLine = text4.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}
function flattenVariables(root, maxDepth = 3) {
  const rows = [];
  if (!isPlainObject(root)) return rows;
  const walk = (node, prefix, depth) => {
    for (const [key, raw] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (isTupleLeaf(raw)) {
        rows.push({
          path,
          key,
          depth,
          value: clipHudValue(formatHudValue(raw[0])),
          description: raw[1]
        });
        continue;
      }
      if (isPlainObject(raw)) {
        if (depth + 1 > maxDepth) {
          rows.push({
            path,
            key,
            depth,
            value: clipHudValue(formatHudValue(raw)),
            description: ""
          });
          continue;
        }
        if (Object.keys(raw).length === 0) {
          rows.push({ path, key, depth, value: "{}", description: "" });
          continue;
        }
        rows.push({ path, key, depth, value: null, description: "" });
        walk(raw, path, depth + 1);
        continue;
      }
      rows.push({ path, key, depth, value: clipHudValue(formatHudValue(raw)), description: "" });
    }
  };
  walk(root, "", 0);
  return rows;
}
function countLeafRows(rows) {
  return rows.filter((row) => row.value !== null).length;
}

// st-extension/src/variable-hud.ts
var DRAG_THRESHOLD = 4;
var BUTTON_SIZE = 44;
var hudId = 0;
function clampPosition(x, y, width = BUTTON_SIZE, height = BUTTON_SIZE) {
  const maxX = Math.max(0, window.innerWidth - width);
  const maxY = Math.max(0, window.innerHeight - height);
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y))
  };
}
function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
function createVariableHud(deps) {
  const saved = deps.readState();
  let position = clampPosition(saved.x, saved.y);
  let open = saved.open;
  let disposed = false;
  const root = el("div", "so-varhud");
  root.id = "st-stage-varhud";
  const button2 = el("button", "so-varhud-btn");
  button2.setAttribute("type", "button");
  button2.setAttribute("aria-label", t("variableHud.title", "变量速查"));
  button2.textContent = "🔢";
  const panel = el("div", "so-varhud-panel");
  panel.id = `so-varhud-panel-${++hudId}`;
  panel.setAttribute("role", "region");
  button2.setAttribute("aria-controls", panel.id);
  const panelHead = el("div", "so-varhud-head");
  const panelTitle = el("span", "so-varhud-title");
  panelTitle.id = `${panel.id}-title`;
  panelTitle.textContent = t("variableHud.title", "变量速查");
  panel.setAttribute("aria-labelledby", panelTitle.id);
  const closeBtn = el("button", "so-varhud-close");
  closeBtn.setAttribute("type", "button");
  closeBtn.setAttribute("aria-label", t("variableHud.collapse", "收起"));
  closeBtn.textContent = "✕";
  panelHead.append(panelTitle, closeBtn);
  const panelBody = el("div", "so-varhud-body");
  panel.append(panelHead, panelBody);
  root.append(button2, panel);
  document.body.append(root);
  function applyPosition() {
    root.style.left = `${position.x}px`;
    root.style.top = `${position.y}px`;
  }
  function applyOpen() {
    root.classList.toggle("so-varhud-open", open);
    button2.setAttribute("aria-expanded", String(open));
    button2.style.display = open ? "none" : "flex";
    panel.style.display = open ? "flex" : "none";
  }
  let measureFrame = null;
  const useAnimationFrame = typeof window.requestAnimationFrame === "function";
  function measureAndClamp() {
    if (disposed) return;
    const rect = root.getBoundingClientRect();
    const next = clampPosition(position.x, position.y, rect.width || BUTTON_SIZE, rect.height || BUTTON_SIZE);
    const changed = next.x !== position.x || next.y !== position.y;
    position = next;
    applyPosition();
    if (changed) deps.writeState({ ...position, open });
  }
  function scheduleMeasure() {
    if (disposed || measureFrame !== null) return;
    const measure = () => {
      measureFrame = null;
      measureAndClamp();
    };
    measureFrame = useAnimationFrame ? window.requestAnimationFrame(measure) : window.setTimeout(measure, 0);
  }
  function renderRows(container, rows) {
    for (const row of rows) {
      const line = el("div", row.value === null ? "so-varhud-group" : "so-varhud-row");
      line.style.paddingLeft = `${row.depth * 12}px`;
      const key = el("span", "so-varhud-key");
      key.textContent = row.key;
      line.append(key);
      if (row.value !== null) {
        const value = el("span", "so-varhud-value");
        value.textContent = row.value;
        line.append(value);
        if (row.description) line.title = row.description;
      }
      container.append(line);
    }
  }
  let renderToken = 0;
  async function render2() {
    if (disposed || !open) return;
    const token = ++renderToken;
    let sections;
    try {
      sections = await deps.readSections();
    } catch (err) {
      if (token !== renderToken || disposed || !open) return;
      panelBody.textContent = "";
      const fail = el("div", "so-varhud-notice");
      fail.setAttribute("role", "status");
      fail.textContent = t("variableHud.read_failed", "读取失败：{{message}}", { message: err instanceof Error ? err.message : String(err) });
      panelBody.append(fail);
      scheduleMeasure();
      return;
    }
    if (token !== renderToken || disposed || !open) return;
    panelBody.textContent = "";
    let anyRow = false;
    for (const section2 of sections) {
      const block = el("div", "so-varhud-section");
      const label = el("div", "so-varhud-source");
      const rows = section2.root ? flattenVariables(section2.root) : [];
      label.textContent = section2.root ? t("variableHud.source_count", "{{source}}（{{count}}）", { source: section2.source, count: countLeafRows(rows) }) : section2.source;
      block.append(label);
      if (!section2.root) {
        const notice = el("div", "so-varhud-notice");
        notice.textContent = section2.notice || t("variableHud.unavailable", "当前不可用");
        block.append(notice);
      } else if (rows.length === 0) {
        const empty = el("div", "so-varhud-notice");
        empty.textContent = t("variableHud.no_variables", "暂无变量");
        block.append(empty);
      } else {
        anyRow = true;
        renderRows(block, rows);
      }
      panelBody.append(block);
    }
    if (sections.length === 0) {
      const empty = el("div", "so-varhud-notice");
      empty.textContent = t("variableHud.no_sources", "没有可用的变量来源");
      panelBody.append(empty);
    }
    panelTitle.textContent = anyRow ? t("variableHud.title", "变量速查") : t("variableHud.empty_title", "变量速查（空）");
    scheduleMeasure();
  }
  function setOpen(next) {
    if (disposed) return;
    open = next;
    applyOpen();
    scheduleMeasure();
    deps.writeState({ ...position, open });
    if (open) void render2();
    if (open) closeBtn.focus({ preventScroll: true });
    else button2.focus({ preventScroll: true });
  }
  let cancelDrag = null;
  function startDrag(event) {
    if (disposed || cancelDrag) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...position };
    let moved = false;
    const onMove = (ev) => {
      if (ev.pointerId !== event.pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved = true;
      const rect = root.getBoundingClientRect();
      position = clampPosition(origin.x + dx, origin.y + dy, rect.width || BUTTON_SIZE, rect.height || BUTTON_SIZE);
      applyPosition();
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      cancelDrag = null;
    };
    const finish = (ev, asClick) => {
      if (ev.pointerId !== event.pointerId) return;
      cleanup();
      if (moved) deps.writeState({ ...position, open });
      else if (asClick) setOpen(!open);
      scheduleMeasure();
    };
    const onUp = (ev) => finish(ev, true);
    const onCancel = (ev) => finish(ev, false);
    cancelDrag = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }
  button2.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    startDrag(event);
  });
  button2.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.detail === 0) setOpen(!open);
  });
  root.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Enter" || event.key === " ") {
      event.stopPropagation();
    }
  });
  panelHead.addEventListener("pointerdown", (event) => {
    if (event.target === closeBtn) return;
    event.stopPropagation();
    startDrag(event);
  });
  closeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(false);
  });
  for (const type of ["pointerdown", "click"]) {
    panelBody.addEventListener(type, (event) => event.stopPropagation());
  }
  const unsubscribe = deps.subscribe(() => void render2());
  const onResize = () => {
    scheduleMeasure();
  };
  window.addEventListener("resize", onResize);
  const visualViewport = window.visualViewport;
  visualViewport?.addEventListener("resize", onResize);
  visualViewport?.addEventListener("scroll", onResize);
  applyPosition();
  applyOpen();
  scheduleMeasure();
  if (open) void render2();
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelDrag?.();
      unsubscribe();
      window.removeEventListener("resize", onResize);
      visualViewport?.removeEventListener("resize", onResize);
      visualViewport?.removeEventListener("scroll", onResize);
      if (measureFrame !== null) {
        if (useAnimationFrame) window.cancelAnimationFrame(measureFrame);
        else window.clearTimeout(measureFrame);
        measureFrame = null;
      }
      root.remove();
    },
    refresh() {
      void render2();
    }
  };
}

// st-extension/src/apps/newvar/ui-focus.ts
function variableButton(className) {
  const button2 = document.createElement("button");
  button2.type = "button";
  button2.className = className;
  button2.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    button2.click();
  });
  return button2;
}
function captureVariableFocus(container) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !container.contains(active)) return null;
  const identity = (node) => {
    const explicit = node.dataset.variableFocus;
    if (explicit) return explicit;
    const labelledBy = node.getAttribute("aria-labelledby");
    const label = node.getAttribute("aria-label") ?? (labelledBy ? document.getElementById(labelledBy)?.textContent : null) ?? node.closest("label")?.querySelector("span")?.textContent;
    if (!label) return null;
    const scope = node.closest("[data-variable-focus-scope]")?.dataset.variableFocusScope ?? "";
    return `${scope}:${node.tagName}:${node.getAttribute("type") ?? ""}:${label}`;
  };
  const key = identity(active);
  if (!key) return null;
  const selection = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? { start: active.selectionStart, end: active.selectionEnd } : null;
  return () => {
    const target = [...container.querySelectorAll("button, input, select, textarea, summary, [tabindex]")].find((node) => identity(node) === key && !node.matches(":disabled") && !node.closest("[hidden], [inert]"));
    if (!target) return false;
    target.focus({ preventScroll: true });
    if (selection?.start !== null && selection?.start !== void 0 && selection.end !== null && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      target.setSelectionRange(selection.start, selection.end);
    }
    return document.activeElement === target;
  };
}

// st-extension/src/apps/widgets.ts
var controlId = 0;
function nextControlId() {
  return `so-app-control-${++controlId}`;
}
function el2(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
function appButton(label, onClick) {
  const btn = el2("div", "menu_button so-app-btn");
  btn.setAttribute("role", "button");
  btn.tabIndex = 0;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  });
  return btn;
}
function toggleRow(label, checked, onChange) {
  const row = el2("label", "so-app-toggle checkbox_label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const span = document.createElement("span");
  span.textContent = label;
  row.append(input, span);
  return row;
}
function selectRow(label, value, options, onChange) {
  const row = el2("label", "so-app-toggle");
  const span = document.createElement("span");
  span.textContent = label;
  const select = document.createElement("select");
  select.id = nextControlId();
  span.id = `${select.id}-label`;
  select.setAttribute("aria-labelledby", span.id);
  select.className = "text_pole so-app-input";
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === value) o.selected = true;
    select.append(o);
  }
  select.addEventListener("change", () => onChange(select.value));
  row.append(span, select);
  return row;
}
function numberRow(label, value, min, max, onChange) {
  const row = el2("label", "so-app-toggle");
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.className = "text_pole so-app-num";
  input.min = String(min);
  input.max = String(max);
  input.step = "1";
  input.value = String(value);
  input.addEventListener("change", () => {
    const n = Math.round(Number(input.value));
    const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
    input.value = String(clamped);
    onChange(clamped);
  });
  row.append(span, input);
  return row;
}
function rangeRow(label, value, min, max, onInput, onCommit, format = String) {
  const row = el2("label", "so-app-toggle so-app-range");
  const span = document.createElement("span");
  span.textContent = label;
  const controls = el2("span", "so-app-range-controls");
  const input = document.createElement("input");
  input.type = "range";
  input.id = nextControlId();
  span.id = `${input.id}-label`;
  input.setAttribute("aria-labelledby", span.id);
  input.min = String(min);
  input.max = String(max);
  input.step = "1";
  input.value = String(Math.min(max, Math.max(min, Math.round(value))));
  const output = document.createElement("output");
  output.htmlFor.value = input.id;
  output.setAttribute("aria-hidden", "true");
  const read = () => {
    const parsed = Math.round(Number(input.value));
    const clamped = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
    input.value = String(clamped);
    output.value = format(clamped);
    output.textContent = output.value;
    input.setAttribute("aria-valuetext", output.value);
    return clamped;
  };
  read();
  input.addEventListener("input", () => onInput(read()));
  input.addEventListener("change", () => onCommit(read()));
  controls.append(input, output);
  row.append(span, controls);
  return row;
}
var foldOpenState = /* @__PURE__ */ new Map();
function foldSection(title2, open = false, key = "") {
  const box = document.createElement("details");
  box.className = "so-app-section so-app-fold";
  box.open = key ? foldOpenState.get(key) ?? open : open;
  if (key) box.addEventListener("toggle", () => foldOpenState.set(key, box.open));
  const summary = document.createElement("summary");
  summary.className = "so-app-title";
  summary.textContent = title2;
  const body = el2("div", "so-app-fold-body");
  box.append(summary, body);
  return { box, body };
}
function textareaRow(label, value, placeholder, onCommit) {
  const wrap = el2("div", "so-app-field");
  const title2 = document.createElement("label");
  title2.className = "so-app-title";
  title2.textContent = label;
  const input = document.createElement("textarea");
  input.id = nextControlId();
  title2.htmlFor = input.id;
  input.className = "text_pole so-app-input";
  input.rows = 5;
  input.value = value;
  input.placeholder = placeholder;
  input.addEventListener("change", () => onCommit(input.value));
  wrap.append(title2, input);
  return wrap;
}
function hintField(row, hint) {
  const wrap = el2("div", "so-app-hintwrap");
  const line = el2("div", "so-app-hintrow");
  row.classList.add("so-app-hintrow-main");
  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "so-app-hint-badge";
  badge.textContent = "ⓘ";
  badge.title = hint;
  badge.setAttribute("aria-label", t("common.help", "说明"));
  badge.setAttribute("aria-expanded", "false");
  const detail = el2("div", "so-app-hint");
  detail.id = `${nextControlId()}-help`;
  detail.textContent = hint;
  detail.hidden = true;
  badge.setAttribute("aria-controls", detail.id);
  badge.setAttribute("aria-describedby", detail.id);
  for (const control2 of row.querySelectorAll("input, textarea, select")) {
    const descriptions = control2.getAttribute("aria-describedby")?.split(/\s+/).filter(Boolean) ?? [];
    control2.setAttribute("aria-describedby", [...descriptions, detail.id].join(" "));
  }
  badge.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") e.stopPropagation();
  });
  badge.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    detail.hidden = !detail.hidden;
    badge.classList.toggle("so-app-hint-badge-on", !detail.hidden);
    badge.setAttribute("aria-expanded", String(!detail.hidden));
  });
  line.append(row, badge);
  wrap.append(line, detail);
  return wrap;
}
function textRow(label, value, placeholder, onCommit, type = "text") {
  const wrap = el2("div", "so-app-field");
  const title2 = document.createElement("label");
  title2.className = "so-app-title";
  title2.textContent = label;
  const input = document.createElement("input");
  input.id = nextControlId();
  title2.htmlFor = input.id;
  input.type = type;
  input.className = "text_pole so-app-input";
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.addEventListener("change", () => onCommit(input.value));
  wrap.append(title2, input);
  return wrap;
}

// st-extension/src/apps/path-utils.ts
var FORBIDDEN_PATH_SEGMENTS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function parsePath(path) {
  const segments = path.split(".");
  return segments.some((segment) => segment.length === 0 || FORBIDDEN_PATH_SEGMENTS.has(segment)) ? null : segments;
}
function isSafePath(path) {
  return parsePath(path) !== null;
}
function getNested(obj, path) {
  const segments = parsePath(path);
  if (!segments) return void 0;
  let cur = obj;
  for (const seg of segments) {
    if (cur == null || typeof cur !== "object") return void 0;
    cur = cur[seg];
  }
  return cur;
}
function setNested(obj, path, value) {
  const segs = parsePath(path);
  if (!segs || segs.length === 0) return;
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    const next = cur[seg];
    if (next == null || typeof next !== "object" || Array.isArray(next)) cur[seg] = {};
    cur = cur[seg];
  }
  cur[segs[segs.length - 1]] = value;
}
function deleteNested(obj, path) {
  const segs = parsePath(path);
  if (!segs || segs.length === 0) return;
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur == null || typeof cur !== "object") return;
    cur = cur[segs[i]];
  }
  if (cur != null && typeof cur === "object") delete cur[segs[segs.length - 1]];
}

// st-extension/src/apps/variable-tree.ts
function isPlainObject2(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}
function isTupleLeaf2(v) {
  return Array.isArray(v) && v.length === 2 && typeof v[1] === "string" && !Array.isArray(v[0]);
}
function extractStatRootFrom(wrapper) {
  if (isPlainObject2(wrapper.stat_data)) return { root: wrapper.stat_data, wrapped: true };
  return { root: wrapper, wrapped: false };
}
function formatValue(v) {
  if (typeof v === "string") return v;
  if (v === null) return "null";
  if (v === void 0) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
function parseInputValue(raw) {
  const t2 = raw.trim();
  if (t2 === "null") return null;
  if (t2 === "true") return true;
  if (t2 === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(t2)) return Number(t2);
  if (t2.startsWith("{") || t2.startsWith("[")) {
    try {
      return JSON.parse(t2);
    } catch {
    }
  }
  return raw;
}
function editKind(v, definition) {
  if (definition?.type === "number") return "number";
  if (definition?.type === "enum") return "enum";
  if (definition?.type === "boolean") return "boolean";
  if (definition?.type === "string") return "text";
  if (typeof v === "boolean") return "boolean";
  if (v !== null && typeof v === "object") return "json";
  return "text";
}
function valueTypeLabel(v, tuple) {
  const inner = tuple ? v[0] : v;
  if (inner === null) return "null";
  if (Array.isArray(inner)) return t("variableTree.array", "数组[{{count}}]", { count: inner.length });
  if (typeof inner === "object") return t("variableTree.object", "对象");
  return typeof inner === "number" ? t("variableTree.number", "数字") : typeof inner === "boolean" ? t("variableTree.boolean", "布尔") : t("variableTree.text", "文本");
}
function jsonEqual(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
function computeDelta(current2, prev, isMvu) {
  const delta = /* @__PURE__ */ new Map();
  if (!prev) return delta;
  const walk = (obj, prefix) => {
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      const path = prefix ? `${prefix}.${key}` : key;
      const tuple = isMvu && isTupleLeaf2(val);
      if (!tuple && isPlainObject2(val) && Object.keys(val).length > 0) {
        walk(val, path);
        continue;
      }
      const curLeaf = tuple ? val[0] : val;
      const prevRaw = getNested(prev, path);
      if (prevRaw === void 0) {
        delta.set(path, { kind: "added" });
        continue;
      }
      const prevLeaf = isMvu && isTupleLeaf2(prevRaw) ? prevRaw[0] : prevRaw;
      if (typeof curLeaf === "number" && typeof prevLeaf === "number") {
        if (curLeaf !== prevLeaf) delta.set(path, { kind: curLeaf > prevLeaf ? "inc" : "dec", diff: curLeaf - prevLeaf });
      } else if (!jsonEqual(curLeaf, prevLeaf)) {
        delta.set(path, { kind: "changed" });
      }
    }
  };
  walk(current2, "");
  return delta;
}
function createVariableTreeView(container, handlers) {
  let editingPath = null;
  let focusRequest = null;
  const groupOpen = /* @__PURE__ */ new Map();
  let addOpen = false;
  function render2() {
    const model = handlers.getModel();
    const restore = captureVariableFocus(container);
    const request = focusRequest;
    focusRequest = null;
    const active = document.activeElement;
    const focusPath = request && (!request.editor || request.editor.contains(active) || !request.editor.isConnected && active === document.body) ? request.path : null;
    container.textContent = "";
    const head = el2("div", "so-app-section vm-head");
    const line = el2("div", "vm-statusrow");
    const status = el2("div", "so-app-desc vm-status");
    status.setAttribute("role", "status");
    status.textContent = model.statusText;
    const refreshBtn = variableButton("menu_button vm-refresh");
    refreshBtn.setAttribute("role", "button");
    refreshBtn.textContent = t("variableTree.refresh", "刷新");
    refreshBtn.dataset.variableFocus = "refresh";
    refreshBtn.addEventListener("click", () => handlers.requestRefresh());
    line.append(status, refreshBtn);
    head.append(line);
    container.append(head);
    if (model.noticeText) {
      appendNotice(model.noticeText);
      if (model.status === "unavailable") {
        restore?.();
        return;
      }
    }
    const keys = Object.keys(model.data);
    if (keys.length === 0) {
      appendNotice(model.emptyText);
    } else {
      const tree = el2("div", "vm-tree");
      for (const key of keys) renderNode(model, tree, key, model.data[key], key, 0);
      container.append(tree);
    }
    if (model.allowAdd !== false) container.append(buildAddSection(model));
    if (focusPath !== null) {
      const target = editingPath === focusPath ? container.querySelector(".vm-editing input, .vm-editing select, .vm-editing textarea") : [...container.querySelectorAll(".vm-leaf-main")].find((node) => node.dataset.variableFocus === `leaf:${focusPath}`);
      if (target) target.focus({ preventScroll: true });
      else restore?.();
    } else restore?.();
  }
  function appendNotice(text4) {
    const note = el2("div", "so-app-section");
    const d = el2("div", "so-app-desc");
    d.textContent = text4;
    note.append(d);
    container.append(note);
  }
  function renderNode(model, parent, key, value, path, depth) {
    const tuple = model.isMvu && isTupleLeaf2(value);
    if (!tuple && isPlainObject2(value) && Object.keys(value).length > 0) {
      const details = document.createElement("details");
      details.className = "so-app-fold vm-group";
      details.open = groupOpen.get(path) ?? depth < 1;
      details.addEventListener("toggle", () => groupOpen.set(path, details.open));
      const summary = document.createElement("summary");
      summary.className = "so-app-title vm-group-title";
      summary.dataset.variableFocus = `group:${path}`;
      summary.textContent = `${key}（${Object.keys(value).length}）`;
      const body = el2("div", "so-app-fold-body vm-group-body");
      for (const childKey of Object.keys(value)) {
        renderNode(model, body, childKey, value[childKey], `${path}.${childKey}`, depth + 1);
      }
      details.append(summary, body);
      parent.append(details);
      return;
    }
    renderLeaf(model, parent, key, value, path, tuple);
  }
  function renderLeaf(model, parent, key, value, path, tuple) {
    if (editingPath === path) {
      parent.append(buildEditForm(model, key, value, path, tuple));
      return;
    }
    const card = el2("div", "vm-leaf");
    const main = el2("div", "vm-leaf-main");
    main.dataset.variableFocus = `leaf:${path}`;
    const keyEl = el2("span", "vm-key");
    keyEl.textContent = key;
    const valEl = el2("span", "vm-val");
    const shown = formatValue(tuple ? value[0] : value);
    valEl.textContent = shown.length > 80 ? `${shown.slice(0, 80)}…` : shown;
    valEl.title = t("variableTree.type", "类型：{{type}}", { type: valueTypeLabel(value, tuple) });
    main.append(keyEl, valEl);
    const d = model.delta.get(path);
    if (d) main.append(buildDeltaBadge(d));
    if (tuple) {
      const desc = el2("div", "vm-desc");
      desc.textContent = value[1];
      main.append(desc);
    }
    if (model.canWrite) {
      main.setAttribute("role", "button");
      main.tabIndex = 0;
      const enterEdit = () => {
        editingPath = path;
        focusRequest = { path };
        render2();
      };
      main.addEventListener("click", enterEdit);
      main.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          enterEdit();
        }
      });
    }
    card.append(main);
    if (model.canWrite) {
      const del = variableButton("vm-del");
      del.setAttribute("aria-label", t("variableTree.delete_path", "删除变量 {{path}}", { path }));
      del.dataset.variableFocus = `delete:${path}`;
      del.title = t("variableTree.delete_title", "删除该变量");
      del.textContent = "✕";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!window.confirm(t("variableTree.delete_confirm", "删除变量「{{path}}」？此操作不可撤销。", { path }))) return;
        editingPath = null;
        handlers.commitDelete(path);
      });
      card.append(del);
    }
    parent.append(card);
  }
  function buildDeltaBadge(d) {
    const badge = el2("span", `vm-badge vm-badge-${d.kind}`);
    if (d.kind === "inc" || d.kind === "dec") {
      const n = d.diff ?? 0;
      const shown = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
      badge.textContent = `${n > 0 ? "+" : ""}${shown}`;
    } else {
      badge.textContent = d.kind === "added" ? t("variableTree.added", "新") : t("variableTree.changed", "改");
    }
    return badge;
  }
  function buildEditForm(model, key, value, path, tuple) {
    const inner = tuple ? value[0] : value;
    const definition = model.definitions?.find((item) => item.key === path);
    const kind = editKind(inner, definition);
    const wrap = el2("div", "vm-leaf vm-editing");
    const title2 = el2("div", "so-app-title vm-edit-title");
    title2.textContent = `${key} · ${valueTypeLabel(value, tuple)}`;
    wrap.append(title2);
    if (tuple) {
      const desc = el2("div", "vm-desc");
      desc.textContent = t("variableTree.description", "描述：{{description}}（保留不变，仅编辑值）", { description: value[1] });
      wrap.append(desc);
    }
    const err = el2("div", "so-app-desc vm-add-err");
    err.hidden = true;
    err.setAttribute("role", "alert");
    let readValue;
    if (kind === "boolean") {
      const row = el2("label", "so-app-toggle checkbox_label");
      const input2 = document.createElement("input");
      input2.type = "checkbox";
      input2.checked = inner === true;
      const label = document.createElement("span");
      label.textContent = t("variableTree.true", "启用（true）");
      row.append(input2, label);
      wrap.append(row);
      readValue = () => ({ ok: true, value: input2.checked });
    } else if (kind === "enum") {
      const select = document.createElement("select");
      select.className = "text_pole so-app-input vm-edit-input";
      for (const value2 of definition?.enum ?? []) {
        const option = document.createElement("option");
        option.value = value2;
        option.textContent = value2;
        option.selected = value2 === inner;
        select.append(option);
      }
      wrap.append(select);
      readValue = () => ({ ok: true, value: select.value });
    } else if (kind === "number") {
      const input2 = document.createElement("input");
      input2.type = "number";
      input2.step = "any";
      input2.className = "text_pole so-app-input vm-edit-input";
      input2.value = typeof inner === "number" && Number.isFinite(inner) ? String(inner) : "";
      if (definition?.range) {
        input2.min = String(definition.range[0]);
        input2.max = String(definition.range[1]);
      }
      wrap.append(input2);
      readValue = () => {
        if (input2.value.trim() === "") return { ok: false, msg: t("variableTree.invalid_number", "请输入有效数字。") };
        const value2 = Number(input2.value);
        return Number.isFinite(value2) ? { ok: true, value: value2 } : { ok: false, msg: t("variableTree.invalid_number", "请输入有效数字。") };
      };
    } else if (kind === "json") {
      const ta = document.createElement("textarea");
      ta.className = "text_pole so-app-input vm-edit-input";
      ta.rows = 5;
      ta.value = formatValue(inner);
      wrap.append(ta);
      readValue = () => {
        try {
          return { ok: true, value: JSON.parse(ta.value) };
        } catch (e) {
          return { ok: false, msg: t("variableTree.json_error", "JSON 格式错误：{{error}}", { error: e instanceof Error ? e.message : String(e) }) };
        }
      };
    } else {
      const input2 = document.createElement("input");
      input2.type = "text";
      input2.className = "text_pole so-app-input vm-edit-input";
      input2.value = formatValue(inner);
      input2.autocomplete = "off";
      wrap.append(input2);
      readValue = () => ({ ok: true, value: definition?.type === "string" ? input2.value : parseInputValue(input2.value) });
    }
    const input = wrap.querySelector("input, select, textarea");
    input?.setAttribute("aria-label", t("variableTree.edit_value", "编辑 {{path}} 的值", { path }));
    if (input) input.dataset.variableFocus = `value:${path}`;
    wrap.append(err);
    const actions = el2("div", "vm-actions");
    const save = variableButton("menu_button vm-act");
    save.textContent = t("variableTree.save", "保存");
    save.dataset.variableFocus = `save:${path}`;
    save.addEventListener("click", () => {
      const r = readValue();
      if (!r.ok) {
        err.textContent = r.msg ?? t("variableTree.invalid", "输入无效。");
        err.hidden = false;
        return;
      }
      editingPath = null;
      focusRequest = { path, editor: wrap };
      const committed = handlers.commitSet(path, r.value);
      if (committed && !committed.ok) {
        editingPath = path;
        focusRequest = null;
        err.textContent = committed.error;
        err.hidden = false;
      }
    });
    const cancel = variableButton("menu_button vm-act vm-act-ghost");
    cancel.textContent = t("variableTree.cancel", "取消");
    cancel.dataset.variableFocus = `cancel:${path}`;
    cancel.addEventListener("click", () => {
      editingPath = null;
      focusRequest = { path };
      render2();
    });
    actions.append(save, cancel);
    wrap.append(actions);
    return wrap;
  }
  function buildAddSection(model) {
    const box = document.createElement("details");
    box.className = "so-app-fold so-app-section";
    box.open = addOpen;
    box.addEventListener("toggle", () => addOpen = box.open);
    const summary = document.createElement("summary");
    summary.className = "so-app-title";
    summary.textContent = t("variableTree.add_variable", "＋ 新增变量");
    summary.dataset.variableFocus = "add-section";
    const body = el2("div", "so-app-fold-body");
    const hint = el2("div", "so-app-desc");
    hint.textContent = model.addHint;
    body.append(hint);
    const pathInput = document.createElement("input");
    pathInput.type = "text";
    pathInput.className = "text_pole so-app-input";
    pathInput.placeholder = t("variableTree.path_placeholder", "变量路径（如 状态.体力）");
    pathInput.setAttribute("aria-label", t("variableTree.path", "变量路径"));
    pathInput.dataset.variableFocus = "new-path";
    pathInput.autocomplete = "off";
    const valInput = document.createElement("input");
    valInput.type = "text";
    valInput.className = "text_pole so-app-input";
    valInput.placeholder = t("variableTree.value_placeholder", "值（如 80 / 健康 / true）");
    valInput.setAttribute("aria-label", t("variableTree.value", "变量值"));
    valInput.dataset.variableFocus = "new-value";
    valInput.autocomplete = "off";
    body.append(pathInput, valInput);
    const err = el2("div", "so-app-desc vm-add-err");
    err.hidden = true;
    err.setAttribute("role", "alert");
    body.append(err);
    body.append(
      appButton(t("variableTree.add", "添加"), () => {
        const path = pathInput.value.trim();
        if (!path) {
          err.textContent = t("variableTree.path_required", "请填写变量路径。");
          err.hidden = false;
          return;
        }
        if (!model.canWrite) {
          err.textContent = t("variableTree.cannot_write", "当前环境不可写入变量。");
          err.hidden = false;
          return;
        }
        const committed = handlers.commitSet(path, parseInputValue(valInput.value));
        if (committed && !committed.ok) {
          err.textContent = committed.error;
          err.hidden = false;
        }
      })
    );
    box.append(summary, body);
    return box;
  }
  return {
    render: render2,
    resetEditing() {
      if (editingPath && container.contains(document.activeElement)) {
        focusRequest = { path: editingPath, editor: container.querySelector(".vm-editing") ?? void 0 };
      }
      editingPath = null;
    },
    isEditing() {
      return editingPath !== null;
    }
  };
}

// st-extension/src/apps/mvu/bridge.ts
function getMvu() {
  const w = window;
  return w.parent?.Mvu ?? w.Mvu;
}
function getHelper() {
  const w = window;
  return w.parent?.TavernHelper ?? w.TavernHelper;
}
function getST() {
  try {
    return window.SillyTavern?.getContext();
  } catch {
    return void 0;
  }
}
function isMvuAvailable() {
  const mvu = getMvu();
  return typeof mvu?.getMvuData === "function" && typeof mvu?.replaceMvuData === "function";
}
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function getLastMessageId() {
  const helper = getHelper();
  if (typeof helper?.getLastMessageId === "function") {
    try {
      const id = helper.getLastMessageId();
      if (Number.isInteger(id) && id >= 0) return id;
    } catch {
    }
  }
  const chat2 = getST()?.chat;
  if (Array.isArray(chat2) && chat2.length > 0) return chat2.length - 1;
  return -1;
}
async function waitForMvuInitialized(timeoutMs) {
  const w = window;
  const waitFn = w.parent?.waitGlobalInitialized ?? w.waitGlobalInitialized;
  if (typeof waitFn !== "function") return;
  await Promise.race([Promise.resolve(waitFn("Mvu")).catch(() => void 0), delay(timeoutMs)]);
}
async function readMvuDataWithRetry(scope, timeoutMs, intervalMs) {
  const mvu = getMvu();
  const start = Date.now();
  let attempts = 0;
  let data;
  for (; ; ) {
    attempts++;
    data = await Promise.resolve(mvu.getMvuData(scope)) ?? {};
    const stat = data.stat_data;
    if (stat && Object.keys(stat).length > 0) return { data, attempts };
    if (Date.now() - start >= timeoutMs) return { data, attempts };
    await delay(intervalMs);
  }
}
async function readHelperWrapper(scope) {
  const helper = getHelper();
  if (typeof helper?.getVariables !== "function") return null;
  const vars = await Promise.resolve(helper.getVariables(scope));
  return vars && typeof vars === "object" ? vars : {};
}
async function readStatRootAt(messageId) {
  if (messageId < 0) return null;
  const scope = { type: "message", message_id: messageId };
  try {
    if (isMvuAvailable()) {
      const data = await Promise.resolve(getMvu().getMvuData(scope)) ?? {};
      return isPlainObject2(data.stat_data) ? data.stat_data : null;
    }
    const wrapper = await readHelperWrapper(scope);
    return wrapper ? extractStatRootFrom(wrapper).root : null;
  } catch {
    return null;
  }
}
async function findPrevStatRoot(fromId, maxScan = 20) {
  const stop = Math.max(0, fromId - maxScan + 1);
  for (let id = fromId; id >= stop; id--) {
    const root = await readStatRootAt(id);
    if (root && Object.keys(root).length > 0) return root;
  }
  return null;
}
async function readVariables(scope, messageId) {
  const meta = { source: "none", waitedMvu: false };
  const base = { isMvu: false, wrapped: true, messageId, meta };
  if (messageId < 0) return { status: "empty", data: {}, ...base };
  if (!isMvuAvailable()) {
    await waitForMvuInitialized(1200);
    meta.waitedMvu = true;
  }
  if (isMvuAvailable()) {
    try {
      const { data } = await readMvuDataWithRetry(scope, 1200, 120);
      const stat = data.stat_data ?? {};
      if (Object.keys(stat).length > 0) {
        meta.source = "mvu";
        return { status: "ready", data: stat, isMvu: true, wrapped: true, messageId, meta };
      }
      const fb = await readHelperFallback(scope, messageId, meta);
      if (fb) return fb;
      return { status: "empty", data: {}, isMvu: true, wrapped: true, messageId, meta };
    } catch (err) {
      const fb = await readHelperFallback(scope, messageId, meta);
      if (fb) return fb;
      return {
        status: "error",
        data: {},
        isMvu: false,
        wrapped: true,
        messageId,
        meta,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
  const wrapper = await readHelperWrapper(scope).catch(() => null);
  if (wrapper) {
    const { root, wrapped } = extractStatRootFrom(wrapper);
    meta.source = Object.keys(root).length > 0 ? "tavern-helper" : "none";
    return {
      status: Object.keys(root).length > 0 ? "ready" : "empty",
      data: root,
      isMvu: false,
      wrapped,
      messageId,
      meta
    };
  }
  return { status: "unavailable", data: {}, isMvu: false, wrapped: true, messageId, meta };
}
async function readHelperFallback(scope, messageId, meta) {
  const wrapper = await readHelperWrapper(scope).catch(() => null);
  if (!wrapper) return null;
  const { root, wrapped } = extractStatRootFrom(wrapper);
  if (Object.keys(root).length === 0) return null;
  meta.source = "tavern-helper";
  return { status: "ready", data: root, isMvu: false, wrapped, messageId, meta };
}
function fullPath(wrapped, path) {
  return wrapped ? `stat_data.${path}` : path;
}
function applySet(container, wrapped, path, value) {
  const fp = fullPath(wrapped, path);
  const old = getNested(container, fp);
  const final = isTupleLeaf2(old) ? [value, old[1]] : value;
  setNested(container, fp, final);
}
async function setFloorVariable(scope, wrapped, path, value) {
  const mvu = getMvu();
  if (isMvuAvailable()) {
    const wrapper = await Promise.resolve(mvu.getMvuData(scope)) ?? {};
    applySet(wrapper, true, path, value);
    await Promise.resolve(mvu.replaceMvuData(wrapper, scope));
    return;
  }
  await writeHelper(scope, (vars) => applySet(vars, wrapped, path, value));
}
async function deleteFloorVariable(scope, wrapped, path) {
  const mvu = getMvu();
  if (isMvuAvailable()) {
    const wrapper = await Promise.resolve(mvu.getMvuData(scope)) ?? {};
    deleteNested(wrapper, fullPath(true, path));
    await Promise.resolve(mvu.replaceMvuData(wrapper, scope));
    return;
  }
  await writeHelper(scope, (vars) => deleteNested(vars, fullPath(wrapped, path)));
}
async function writeHelper(scope, mutate) {
  const helper = getHelper();
  if (typeof helper?.updateVariablesWith === "function") {
    await Promise.resolve(
      helper.updateVariablesWith((vars) => {
        const v = isPlainObject2(vars) ? vars : {};
        mutate(v);
        return v;
      }, scope)
    );
    return;
  }
  if (typeof helper?.getVariables === "function" && typeof helper?.replaceVariables === "function") {
    const vars = await Promise.resolve(helper.getVariables(scope)) ?? {};
    mutate(vars);
    await Promise.resolve(helper.replaceVariables(vars, scope));
    return;
  }
  throw new Error(t("apps.mvu.no_write_channel", "无可用的变量写入通道（MVU / 酒馆助手均不可用）"));
}
function subscribeVarEvents(handler) {
  const st = getST();
  const es = st?.eventSource;
  if (!es) return () => {
  };
  const mvu = getMvu();
  const names = /* @__PURE__ */ new Set([
    mvu?.events?.VARIABLE_UPDATE_ENDED ?? "mag_variable_update_ended",
    mvu?.events?.VARIABLE_INITIALIZED ?? "mag_variable_initialized",
    st?.eventTypes?.CHAT_CHANGED ?? "chat_id_changed",
    st?.eventTypes?.MESSAGE_SWIPED ?? "message_swiped",
    st?.eventTypes?.MESSAGE_DELETED ?? "message_deleted"
  ]);
  const offs = [];
  for (const name of names) {
    if (!name) continue;
    const h = () => handler();
    es.on(name, h);
    offs.push(() => {
      try {
        es.removeListener(name, h);
      } catch {
      }
    });
  }
  return () => {
    for (const off of offs) off();
  };
}

// core/sprite-preload.ts
var PRELOAD_ON_ACTIVATE_MAX = 4;
var PRELOAD_MATCH_MAX = 10;
function preloadSprites(sprites, max) {
  if (typeof Image === "undefined" || max <= 0) return;
  const seen = /* @__PURE__ */ new Set();
  let loaded = 0;
  for (const sprite of sprites) {
    const url = sprite.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    loaded++;
    if (loaded >= max) break;
  }
}
function preloadOnActivate(packs) {
  const firstSprites = [];
  for (const pack of packs) {
    const first = pack.sprites[0];
    if (first) firstSprites.push(first);
  }
  preloadSprites(firstSprites, PRELOAD_ON_ACTIVATE_MAX);
}
function preloadMatchedSprites(sprites) {
  preloadSprites(sprites, PRELOAD_MATCH_MAX);
}

// core/capabilities.ts
function createCapabilityTracker() {
  const cleanups = /* @__PURE__ */ new Set();
  let disposed = false;
  const run = (fn) => {
    try {
      fn();
    } catch (err) {
      console.error("[sprite-overlay] 能力清理失败", err);
    }
  };
  return {
    get disposed() {
      return disposed;
    },
    track(cleanup) {
      if (disposed) {
        run(cleanup);
        return () => {
        };
      }
      cleanups.add(cleanup);
      return () => {
        if (cleanups.delete(cleanup)) run(cleanup);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const fn of [...cleanups].reverse()) run(fn);
      cleanups.clear();
    }
  };
}
function createEventHub() {
  const handlers = /* @__PURE__ */ new Set();
  return {
    emit(value) {
      for (const handler of [...handlers]) {
        try {
          handler(value);
        } catch (err) {
          console.error("[sprite-overlay] App 事件处理器抛错", err);
        }
      }
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    }
  };
}

// core/phone-registry.ts
var CTX_API_VERSION = 2;
function capInjectionText(appId, text4) {
  if (text4.length <= PROMPT_BUDGET_MAX) return text4;
  console.warn(
    `[sprite-overlay] App「${appId}」注入 ${text4.length} 字符超上限，已截断到 ${PROMPT_BUDGET_MAX}`
  );
  return text4.slice(0, PROMPT_BUDGET_MAX);
}
function createAppHost(deps, tracker) {
  return {
    apiVersion: CTX_API_VERSION,
    getSettings: () => deps.getSettings(),
    getCharacterName: () => deps.getCharacterName(),
    getAppData: () => deps.getSettings().apps[deps.appId],
    setAppData: (data) => deps.saveSettingsOnly({
      ...deps.getSettings(),
      apps: { ...deps.getSettings().apps, [deps.appId]: data }
    }),
    onMessageReceived: (handler) => tracker.track(deps.onMessageReceived(handler)),
    onCharacterChanged: (handler) => tracker.track(deps.onCharacterChanged(handler)),
    injectPrompt: (text4, depth) => deps.injectPrompt(deps.appId, capInjectionText(deps.appId, text4), depth),
    toast: (kind, message) => deps.toast(kind, message),
    getCharacterCard: deps.getCharacterCard ? () => deps.getCharacterCard() : void 0,
    getChatContext: deps.getChatContext ? () => deps.getChatContext() : void 0,
    getVariables: deps.getVariables ? () => deps.getVariables() : void 0
  };
}
function createPhoneAppContext(deps) {
  const tracker = createCapabilityTracker();
  const ctx = {
    ...createAppHost(deps, tracker),
    updateSettings: (next) => deps.updateSettings(next),
    goHome: deps.goHome,
    openModal: (build) => deps.openModal(deps.appId, build),
    setTimeout: (fn, ms) => {
      let untrack = () => {
      };
      const id = globalThis.setTimeout(() => {
        untrack();
        fn();
      }, ms);
      untrack = tracker.track(() => globalThis.clearTimeout(id));
      return id;
    },
    setInterval: (fn, ms) => {
      const id = globalThis.setInterval(fn, ms);
      tracker.track(() => globalThis.clearInterval(id));
      return id;
    }
  };
  return { ctx, dispose: () => tracker.dispose() };
}
function runAppSetup(app, deps, tracker) {
  if (typeof app.setup !== "function") return;
  try {
    const cleanup = app.setup(createAppHost(deps, tracker));
    if (typeof cleanup === "function") tracker.track(cleanup);
  } catch (err) {
    console.error(`[sprite-overlay] App「${app.id}」setup 失败`, err);
  }
}
var APP_ID_REGEX = /^[a-z][a-z0-9-]{1,31}$/;
function assertAppShape(app) {
  const a = app;
  if (typeof a !== "object" || a === null) {
    throw new Error("registerApp 参数必须是 App 对象（{ id, name, icon, mount, ... }）");
  }
  const o = a;
  if (typeof o.id !== "string" || !APP_ID_REGEX.test(o.id)) {
    throw new Error(`App id「${String(o.id)}」非法：需匹配 ${APP_ID_REGEX}`);
  }
  if (typeof o.name !== "string" || o.name.trim() === "") {
    throw new Error(`App「${o.id}」的 name 需为非空字符串`);
  }
  if (typeof o.icon !== "string" || o.icon.trim() === "") {
    throw new Error(`App「${o.id}」的 icon 需为非空字符串`);
  }
  if (typeof o.mount !== "function") {
    throw new Error(`App「${o.id}」缺少 mount(container, ctx) 函数`);
  }
  if (o.setup !== void 0 && typeof o.setup !== "function") {
    throw new Error(`App「${o.id}」的 setup 需为函数`);
  }
  if (o.unmount !== void 0 && typeof o.unmount !== "function") {
    throw new Error(`App「${o.id}」的 unmount 需为函数`);
  }
  if (o.order !== void 0 && typeof o.order !== "number") {
    throw new Error(`App「${o.id}」的 order 需为数字`);
  }
}
var PhoneAppRegistry = class {
  constructor() {
    this.apps = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
  }
  /** 注册 App；形状非法或 id 重复时抛错（独立 App 走注册队列 shim，由 shim 统一 catch） */
  register(app) {
    assertAppShape(app);
    if (this.apps.has(app.id)) {
      throw new Error(`App id「${app.id}」已被注册`);
    }
    this.apps.set(app.id, app);
    this.notify();
  }
  unregister(id) {
    if (this.apps.delete(id)) this.notify();
  }
  get(id) {
    return this.apps.get(id);
  }
  /** 按 order 升序返回全部 App */
  list() {
    return [...this.apps.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }
  /** 订阅注册表变化（Home 屏据此重绘），返回退订函数 */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify() {
    for (const l of this.listeners) l();
  }
};
function installRegisterQueue(prev, register) {
  const seen = [];
  const shim = {
    seen,
    push(app) {
      seen.push(app);
      try {
        register(app);
      } catch (err) {
        console.error("[sprite-overlay] 独立 App 注册失败", err);
      }
    }
  };
  const backlog = Array.isArray(prev) ? prev : typeof prev === "object" && prev !== null && Array.isArray(prev.seen) ? prev.seen : [];
  for (const app of backlog) shim.push(app);
  return shim;
}

// core/dialog-focus.ts
var dialogs = [];
var selector = "button, a[href], input, select, textarea, summary, [contenteditable], [tabindex]";
function isVisible(element2) {
  if (!element2.isConnected || element2.closest("[hidden], [inert]")) return false;
  for (let node = element2; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
    if (node.tagName === "DETAILS" && !node.hasAttribute("open")) {
      const summary = node.querySelector(":scope > summary");
      if (!summary?.contains(element2)) return false;
    }
  }
  return true;
}
function focusable(container) {
  const candidates = Array.from(container.querySelectorAll(selector)).filter((element2) => {
    const editable = element2.getAttribute("contenteditable");
    const parentEditable = element2.parentElement?.closest("[contenteditable]")?.getAttribute("contenteditable");
    const editingHost = editable !== null && ["", "true", "plaintext-only"].includes(editable) && (parentEditable === void 0 || parentEditable === "false");
    return (element2.tabIndex >= 0 || editingHost && !element2.hasAttribute("tabindex")) && !element2.matches(":disabled") && isVisible(element2);
  });
  return candidates.filter((element2) => {
    if (!(element2 instanceof HTMLInputElement) || element2.type !== "radio" || !element2.name) return true;
    const group = candidates.filter((candidate) => candidate instanceof HTMLInputElement && candidate.type === "radio" && candidate.name === element2.name && candidate.form === element2.form);
    return element2 === (group.find((radio) => radio.checked) ?? group[0]);
  }).sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
}
function topDialog() {
  return dialogs.findLast((entry) => entry.container.isConnected);
}
function manageDialogFocus(container, options) {
  const opener = options.opener === void 0 ? document.activeElement instanceof HTMLElement ? document.activeElement : null : options.opener;
  const originalTabIndex = container.getAttribute("tabindex");
  const layer = options.layer ?? container;
  const originalZIndex = layer.style.getPropertyValue("z-index");
  const originalZPriority = layer.style.getPropertyPriority("z-index");
  const zIndex = (node) => Number.parseInt(getComputedStyle(node).zIndex, 10) || 0;
  const highestLayer = Math.max(9999, zIndex(layer), ...dialogs.filter((entry2) => entry2.container.isConnected).map((entry2) => zIndex(entry2.layer)));
  layer.style.setProperty("z-index", String(highestLayer + 1));
  if (originalTabIndex === null) container.tabIndex = -1;
  let disposed = false;
  let restoreAllowed = false;
  let lastFocused = null;
  const entry = { container, layer, focusInitial };
  dialogs.push(entry);
  function focusInitial() {
    if (disposed || topDialog() !== entry) return;
    const target = lastFocused && container.contains(lastFocused) && isVisible(lastFocused) && !lastFocused.matches(":disabled") ? lastFocused : focusable(container)[0] ?? container;
    target.focus({ preventScroll: true });
  }
  function onFocus(event) {
    if (disposed || topDialog() !== entry) return;
    if (event.target instanceof HTMLElement && container.contains(event.target)) {
      lastFocused = event.target;
    } else {
      focusInitial();
    }
  }
  function onKey(event) {
    if (disposed || topDialog() !== entry || event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      options.onEscape();
    } else if (event.key === "Tab") {
      const items = focusable(container);
      const first = items[0] ?? container;
      const last = items[items.length - 1] ?? container;
      const active = document.activeElement;
      if (!items.includes(active) || (event.shiftKey ? active === first : active === last)) {
        event.preventDefault();
        event.stopPropagation();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      }
    }
  }
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("focusin", onFocus, true);
  return {
    focusInitial,
    isTop: () => !disposed && topDialog() === entry,
    dispose() {
      if (disposed) return;
      restoreAllowed = topDialog() === entry;
      disposed = true;
      dialogs.splice(dialogs.indexOf(entry), 1);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus, true);
      if (originalTabIndex === null) container.removeAttribute("tabindex");
      if (originalZIndex) layer.style.setProperty("z-index", originalZIndex, originalZPriority);
      else layer.style.removeProperty("z-index");
    },
    /** Call after removing the dialog and reopening/remounting its source App. */
    restoreFocus() {
      if (!disposed || !restoreAllowed) return;
      restoreAllowed = false;
      const parent = topDialog();
      if (opener && isVisible(opener) && !opener.matches(":disabled") && (!parent || parent.container.contains(opener))) {
        opener.focus({ preventScroll: true });
      } else {
        parent?.focusInitial();
      }
    }
  };
}

// core/app-modal.ts
function openAppModal(build, hooks) {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  hooks.onOpen();
  const backdrop = document.createElement("div");
  backdrop.className = "so-app-modal-backdrop";
  const box = document.createElement("div");
  box.className = "so-app-modal";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", t("modal.title", "App 弹窗"));
  const head = document.createElement("div");
  head.className = "so-app-modal-head";
  const closeBtn = document.createElement("div");
  closeBtn.className = "so-app-modal-close";
  closeBtn.textContent = "✕";
  closeBtn.title = t("common.close", "关闭");
  closeBtn.setAttribute("role", "button");
  closeBtn.setAttribute("aria-label", t("modal.close", "关闭弹窗"));
  closeBtn.tabIndex = 0;
  const body = document.createElement("div");
  body.className = "so-app-modal-body";
  head.append(closeBtn);
  box.append(head, body);
  backdrop.append(box);
  document.body.append(backdrop);
  let cleanup;
  let closed = false;
  const runCleanup = () => {
    const current2 = cleanup;
    cleanup = void 0;
    try {
      current2?.();
    } catch (err) {
      console.error("[sprite-overlay] App 弹窗清理失败", err);
    }
  };
  const close = () => {
    if (closed) return;
    closed = true;
    focus.dispose();
    runCleanup();
    backdrop.remove();
    try {
      hooks.onClose();
    } finally {
      focus.restoreFocus();
    }
  };
  const focus = manageDialogFocus(box, { onEscape: close, opener, layer: backdrop });
  closeBtn.addEventListener("click", close);
  closeBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });
  try {
    cleanup = build(body, close);
    if (closed) runCleanup();
  } catch (err) {
    console.error("[sprite-overlay] App 弹窗渲染失败", err);
    body.setAttribute("role", "alert");
    body.textContent = t("modal.render_error", "弹窗渲染失败，详见控制台");
  }
  if (!closed) focus.focusInitial();
  return close;
}
function openTrackedAppModal(build, hooks, track) {
  const untrackRef = {};
  let closed = false;
  const close = openAppModal(build, {
    onOpen: hooks.onOpen,
    onClose: () => {
      closed = true;
      try {
        hooks.onClose();
      } finally {
        untrackRef.current?.();
      }
    }
  });
  untrackRef.current = track(close);
  if (closed) untrackRef.current();
  return close;
}

// core/phone-shell.ts
var DRAG_THRESHOLD2 = 6;
var HOME_TITLE = "百工";
function createPhoneShell(initialState, deps) {
  let state2 = { ...initialState };
  let activeApp = null;
  let activeCtxDispose = null;
  let screenScrollAppId = null;
  let hidden = false;
  let destroyed = false;
  const fab = document.createElement("div");
  fab.className = "so-phone-fab";
  fab.title = t("phone.open", "打开手机");
  fab.textContent = "📱";
  fab.setAttribute("role", "button");
  fab.setAttribute("aria-label", t("phone.open_panel", "打开手机面板"));
  fab.tabIndex = 0;
  fab.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    commitState({ ...state2, open: true });
    renderScreen();
    focusHome();
  });
  const shell = document.createElement("div");
  shell.className = "so-phone-shell";
  shell.setAttribute("role", "region");
  shell.setAttribute("aria-label", HOME_TITLE);
  shell.style.display = "none";
  const stopShellEvent = (event) => event.stopPropagation();
  for (const type of ["pointerdown", "touchstart", "click"]) {
    shell.addEventListener(type, stopShellEvent);
  }
  shell.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape" && !event.defaultPrevented && !event.isComposing) {
      event.preventDefault();
      if (activeApp) goHome();
      else collapse();
    }
  });
  const statusBar2 = document.createElement("div");
  statusBar2.className = "so-phone-status";
  const backBtn = document.createElement("div");
  backBtn.className = "so-phone-back";
  backBtn.textContent = "‹";
  backBtn.title = t("phone.back", "返回主屏");
  backBtn.setAttribute("role", "button");
  backBtn.setAttribute("aria-label", t("phone.back", "返回主屏"));
  backBtn.tabIndex = 0;
  backBtn.addEventListener("click", () => goHome());
  backBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goHome();
    }
  });
  const statusTitle = document.createElement("span");
  statusTitle.className = "so-phone-status-title";
  statusTitle.textContent = HOME_TITLE;
  const clock = document.createElement("span");
  clock.className = "so-phone-clock";
  const closeBtn = document.createElement("div");
  closeBtn.className = "so-phone-close";
  closeBtn.textContent = "✕";
  closeBtn.title = t("phone.collapse", "收起手机");
  closeBtn.setAttribute("role", "button");
  closeBtn.setAttribute("aria-label", t("phone.collapse", "收起手机"));
  closeBtn.tabIndex = 0;
  const collapse = () => {
    leaveApp();
    commitState({ ...state2, open: false });
    if (!hidden) fab.focus({ preventScroll: true });
  };
  closeBtn.addEventListener("click", collapse);
  closeBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      collapse();
    }
  });
  const indicators = document.createElement("span");
  indicators.className = "so-phone-indicators";
  indicators.textContent = "5G 🔋";
  statusBar2.append(backBtn, statusTitle, indicators, clock, closeBtn);
  const screen = document.createElement("div");
  screen.className = "so-phone-screen";
  const homeBar = document.createElement("div");
  homeBar.className = "so-phone-homebar";
  const homeBtn = document.createElement("div");
  homeBtn.className = "so-phone-homebtn";
  homeBtn.title = t("phone.back", "返回主屏");
  homeBtn.setAttribute("role", "button");
  homeBtn.setAttribute("aria-label", t("phone.back", "返回主屏"));
  homeBtn.tabIndex = 0;
  homeBar.append(homeBtn);
  shell.append(statusBar2, screen, homeBar);
  document.body.append(fab, shell);
  const clockTimer = setInterval(updateClock, 3e4);
  updateClock();
  function updateClock() {
    clock.textContent = (/* @__PURE__ */ new Date()).toLocaleTimeString(getLocale(), {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  function viewportSize() {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    return {
      w: Math.round(vv?.width ?? window.innerWidth),
      h: Math.round(vv?.height ?? window.innerHeight)
    };
  }
  function applyLayout() {
    if (hidden) {
      fab.style.display = "none";
      shell.style.display = "none";
      return;
    }
    const { w: vw, h: vh } = viewportSize();
    const clampedX = Math.max(0, Math.min(state2.x, vw - 56));
    const clampedY = Math.max(0, Math.min(state2.y, vh - 56));
    fab.style.left = `${clampedX}px`;
    fab.style.top = `${clampedY}px`;
    fab.style.display = state2.open ? "none" : "flex";
    shell.style.display = state2.open ? "flex" : "none";
    if (state2.open) {
      const shellW = Math.min(320, vw - 16);
      const shellH = Math.min(580, vh - 16);
      shell.style.width = `${shellW}px`;
      shell.style.height = `${shellH}px`;
      shell.style.left = `${Math.max(8, Math.min(clampedX, vw - shellW - 8))}px`;
      shell.style.top = `${Math.max(8, Math.min(clampedY, vh - shellH - 8))}px`;
    }
  }
  applyLayout();
  window.addEventListener("resize", applyLayout);
  window.visualViewport?.addEventListener("resize", applyLayout);
  function commitState(next) {
    state2 = next;
    applyLayout();
    deps.onStateChange(state2);
  }
  fab.addEventListener("pointerdown", (startEvent) => {
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const origin = { ...state2 };
    let moved = false;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD2) return;
      moved = true;
      state2 = { ...origin, x: origin.x + dx, y: origin.y + dy };
      applyLayout();
    };
    const onUp = () => {
      cleanup();
      if (moved) {
        commitState(state2);
      } else {
        const swallowGhostClick = (e) => {
          e.stopPropagation();
          e.preventDefault();
        };
        window.addEventListener("click", swallowGhostClick, { capture: true, once: true });
        setTimeout(
          () => window.removeEventListener("click", swallowGhostClick, { capture: true }),
          400
        );
        commitState({ ...state2, open: true });
        renderScreen();
      }
    };
    const onCancel = () => {
      cleanup();
      if (moved) commitState(state2);
    };
    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  });
  const onHomePress = () => {
    if (activeApp) goHome();
  };
  homeBtn.addEventListener("click", onHomePress);
  homeBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onHomePress();
    }
  });
  const unsubscribe = deps.registry.subscribe(() => {
    if (state2.open && !activeApp) renderScreen();
  });
  function leaveApp() {
    if (activeApp) {
      screen.classList.remove("so-phone-screen-fullbleed");
      try {
        activeApp.unmount?.();
      } catch (err) {
        console.error(`[sprite-overlay] App「${activeApp.id}」unmount 失败`, err);
      }
      activeCtxDispose?.();
      activeCtxDispose = null;
      activeApp = null;
    }
  }
  function renderScreen() {
    const prevScrollAppId = screenScrollAppId;
    const prevScrollTop = screen.scrollTop;
    const restore = prevScrollAppId === activeApp?.id ? captureScreenFocus() : null;
    screen.innerHTML = "";
    backBtn.style.display = activeApp ? "flex" : "none";
    if (activeApp) {
      statusTitle.textContent = activeApp.name;
      if (activeApp.fullbleed) {
        screen.classList.add("so-phone-screen-fullbleed");
      } else {
        screen.classList.remove("so-phone-screen-fullbleed");
      }
      const container = document.createElement("div");
      container.className = "so-phone-app-container";
      if (activeApp.fullbleed) {
        container.classList.add("so-phone-app-fullbleed");
      }
      container.tabIndex = -1;
      container.setAttribute("role", "group");
      container.setAttribute("aria-label", activeApp.name);
      screen.append(container);
      try {
        const mounted = deps.createAppContext(activeApp.id, goHome);
        activeCtxDispose = mounted.dispose;
        activeApp.mount(container, mounted.ctx);
      } catch (err) {
        console.error(`[sprite-overlay] App「${activeApp.id}」mount 失败`, err);
        container.replaceChildren();
        const errBox = document.createElement("div");
        errBox.className = "so-phone-app-error";
        errBox.textContent = t("phone.app_error", "App 打开失败，详见控制台");
        container.append(errBox);
      }
      if (prevScrollAppId === activeApp.id && prevScrollTop > 0) screen.scrollTop = prevScrollTop;
      screenScrollAppId = activeApp.id;
      restore?.();
      return;
    }
    screenScrollAppId = null;
    screen.classList.remove("so-phone-screen-fullbleed");
    statusTitle.textContent = HOME_TITLE;
    const grid = document.createElement("div");
    grid.className = "so-phone-home-grid";
    for (const app of deps.registry.list()) {
      grid.append(renderAppIcon(app));
    }
    screen.append(grid);
  }
  function renderAppIcon(app) {
    const cell = document.createElement("div");
    cell.className = "so-phone-app-icon";
    cell.dataset.appId = app.id;
    cell.setAttribute("role", "button");
    cell.tabIndex = 0;
    cell.setAttribute("aria-label", t("phone.open_app", "打开 {{name}}", { name: app.name }));
    const icon = document.createElement("div");
    icon.className = "so-phone-app-glyph";
    icon.textContent = app.icon;
    const label = document.createElement("div");
    label.className = "so-phone-app-label";
    label.textContent = app.name;
    cell.append(icon, label);
    const openThis = () => {
      activeApp = app;
      renderScreen();
      focusApp();
    };
    cell.addEventListener("click", openThis);
    cell.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openThis();
      }
    });
    return cell;
  }
  function goHome() {
    const appId = activeApp?.id;
    leaveApp();
    renderScreen();
    focusHome(appId);
  }
  function focusHome(appId) {
    const icons = Array.from(screen.querySelectorAll(".so-phone-app-icon"));
    (icons.find((icon) => icon.dataset.appId === appId) ?? icons[0] ?? closeBtn).focus({ preventScroll: true });
  }
  function focusApp() {
    screen.querySelector(".so-phone-app-container")?.focus({ preventScroll: true });
  }
  function focusIdentity(element2) {
    const labelledBy = element2.getAttribute("aria-labelledby")?.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
    const labels = element2 instanceof HTMLInputElement || element2 instanceof HTMLTextAreaElement || element2 instanceof HTMLSelectElement || element2 instanceof HTMLButtonElement ? Array.from(element2.labels ?? []).map((label) => {
      const copy = label.cloneNode(true);
      copy.querySelectorAll("input, select, textarea, button, output").forEach((node) => node.remove());
      return copy.textContent ?? "";
    }).join(" ") : "";
    const name = (labelledBy || element2.getAttribute("aria-label") || labels || (element2.matches('button, [role="button"]') ? element2.textContent : "") || "").replace(/\s+/g, " ").trim();
    const key = element2.dataset.focusKey || element2.getAttribute("name") || "";
    return name || key ? JSON.stringify([name, key, element2.getAttribute("role")]) : "";
  }
  function captureScreenFocus() {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !screen.contains(active)) return null;
    const identity = focusIdentity(active);
    const path = [];
    for (let node = active; node !== screen && node.parentElement; node = node.parentElement) {
      path.unshift(Array.from(node.parentElement.children).indexOf(node));
    }
    const selection = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null;
    return () => {
      let replacement = screen;
      for (const index of path) replacement = replacement?.children[index];
      if (!(replacement instanceof HTMLElement) || replacement.tagName !== active.tagName || replacement.getAttribute("type") !== active.getAttribute("type") || !identity || focusIdentity(replacement) !== identity || replacement.closest("[hidden], [inert]") || replacement.matches(":disabled")) {
        focusApp();
        return;
      }
      replacement.focus({ preventScroll: true });
      if (document.activeElement !== replacement) {
        focusApp();
        return;
      }
      if (selection && selection[0] !== null && selection[1] !== null && (replacement instanceof HTMLInputElement || replacement instanceof HTMLTextAreaElement)) {
        replacement.setSelectionRange(selection[0], selection[1], selection[2] ?? void 0);
      }
    };
  }
  return {
    setState(next) {
      if (destroyed) return;
      const wasOpen = state2.open;
      state2 = { ...next };
      if (wasOpen && !state2.open) leaveApp();
      applyLayout();
      if (state2.open) renderScreen();
    },
    openApp(appId) {
      if (destroyed) return;
      const app = deps.registry.get(appId);
      if (!app) return;
      leaveApp();
      activeApp = app;
      if (!state2.open) commitState({ ...state2, open: true });
      renderScreen();
      focusApp();
    },
    setVisible(visible) {
      if (destroyed) return;
      hidden = !visible;
      if (hidden) leaveApp();
      applyLayout();
      if (!hidden && state2.open) renderScreen();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInterval(clockTimer);
      window.removeEventListener("resize", applyLayout);
      window.visualViewport?.removeEventListener("resize", applyLayout);
      unsubscribe();
      leaveApp();
      for (const type of ["pointerdown", "touchstart", "click"]) {
        shell.removeEventListener(type, stopShellEvent);
      }
      fab.remove();
      shell.remove();
    }
  };
}

// core/share-code.ts
var SHARE_PREFIX = "stpack1:";
var SHARE_PREFIX_V2 = "stpack2:";
var CODE_REGEX = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/;
function isValidImageCode(code) {
  return CODE_REGEX.test(code) && !code.includes("..");
}
function extractImageCode(url) {
  if (!/^https?:\/\//.test(url)) return null;
  const withoutQuery = url.split(/[?#]/)[0];
  const seg = withoutQuery.split("/").pop() ?? "";
  return isValidImageCode(seg) ? seg : null;
}
var ENTRY_SEPARATORS = /[\n\r,，;；|、]+/;
var TRAILING_FILENAME = /^(.*?)([0-9A-Za-z][0-9A-Za-z._-]*\.[0-9A-Za-z]{1,8})$/;
function parseImageCodeEntries(raw) {
  const entries = [];
  const invalid = [];
  for (const chunk of raw.split(ENTRY_SEPARATORS)) {
    const entry = chunk.trim();
    if (!entry) continue;
    const tokens = entry.split(/\s+/).filter(Boolean);
    if (tokens.every((token) => isValidImageCode(token))) {
      for (const token of tokens) entries.push({ tag: null, code: token });
      continue;
    }
    const last = tokens[tokens.length - 1];
    if (tokens.length > 1 && isValidImageCode(last)) {
      const name = tokens.slice(0, -1).join(" ").replace(/[\s\-–—=:：]+$/, "").trim();
      entries.push({ tag: name || null, code: last });
      continue;
    }
    const match = TRAILING_FILENAME.exec(entry);
    if (match && isValidImageCode(match[2])) {
      const name = match[1].replace(/[\s\-–—=:：]+$/, "").trim();
      entries.push({ tag: name || null, code: match[2] });
      continue;
    }
    invalid.push(entry);
  }
  return { entries, invalid };
}
function decodeShareString(raw) {
  const text4 = raw.trim();
  if (text4.indexOf(SHARE_PREFIX_V2) !== -1) return decodeShareStringV2(text4);
  return decodeShareStringV1(text4);
}
function decodeShareStringV1(raw) {
  const text4 = raw.trim();
  const prefixIndex = text4.indexOf(SHARE_PREFIX);
  if (prefixIndex === -1) {
    throw new Error(t("sprite.manager.content.error.share_prefix", "导入失败：没有找到 {{p0}} 开头的分享串", { p0: SHARE_PREFIX }));
  }
  const body = text4.slice(prefixIndex + SHARE_PREFIX.length).trim();
  const segments = body.split("|");
  const name = sanitizePackName(segments[0] ?? "") || "分享立绘包";
  let host = DEFAULT_IMAGE_HOST;
  let author;
  const sprites = [];
  const seenTags = /* @__PURE__ */ new Set();
  for (const segment of segments.slice(1)) {
    const part = segment.trim();
    if (!part) continue;
    if (part.startsWith("@")) {
      const eq2 = part.indexOf("=");
      if (eq2 === -1) continue;
      const key = part.slice(1, eq2).trim().toLowerCase();
      const value = part.slice(eq2 + 1).trim();
      if (key === "host" && /^https?:\/\/.+/.test(value)) {
        host = value.endsWith("/") ? value : `${value}/`;
      } else if (key === "author") {
        author = sanitizePackName(value) || void 0;
      }
      continue;
    }
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const tag = normalizeTag(part.slice(0, eq));
    const code = part.slice(eq + 1).trim();
    if (!tag || !isValidImageCode(code) || seenTags.has(tag)) continue;
    seenTags.add(tag);
    sprites.push({ tag, url: host + code, code });
  }
  if (sprites.length === 0) {
    throw new Error(t("sprite.manager.content.error.share_no_codes", "导入失败：分享串中没有可用的「表情=编码」条目"));
  }
  const finalSprites = sprites.map((s) => ({ ...s, url: host + s.code }));
  return { id: genId(), name, author, sprites: finalSprites, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function shareableUrl(sprite) {
  if (sprite.remoteUrl && /^https?:\/\//.test(sprite.remoteUrl)) return sprite.remoteUrl;
  if (/^https?:\/\//.test(sprite.url)) return sprite.url;
  return null;
}
function encodeShareStringV2(pack) {
  const entries = [];
  const missing = [];
  for (const sprite of pack.sprites) {
    const addr = formatAddress(spriteAddress(pack, sprite));
    const url = shareableUrl(sprite);
    if (!url) {
      missing.push(addr);
      continue;
    }
    entries.push(`${addr}=${url}`);
  }
  if (entries.length === 0) return null;
  const segments = [sanitizePackName(pack.name) || "分享立绘包"];
  if (pack.author) segments.push(`@author=${sanitizePackName(pack.author)}`);
  const kind = normalizePackKind(pack.kind);
  if (kind) segments.push(`@kind=${kind}`);
  const customTags = normalizeLabels(pack.customTags);
  if (customTags.length > 0) {
    segments.push(`@tags=${encodeURIComponent(JSON.stringify(customTags))}`);
  }
  segments.push(...entries);
  return {
    text: SHARE_PREFIX_V2 + segments.join("|"),
    included: entries.length,
    total: pack.sprites.length,
    missing
  };
}
function decodeShareStringV2(raw) {
  const text4 = raw.trim();
  const prefixIndex = text4.indexOf(SHARE_PREFIX_V2);
  if (prefixIndex === -1) {
    throw new Error(t("sprite.manager.content.error.share_prefix", "导入失败：没有找到 {{p0}} 开头的分享串", { p0: SHARE_PREFIX_V2 }));
  }
  const body = text4.slice(prefixIndex + SHARE_PREFIX_V2.length).trim();
  const segments = body.split("|");
  const name = sanitizePackName(segments[0] ?? "") || "分享立绘包";
  let author;
  let kind;
  let customTags = [];
  const sprites = [];
  const seen = /* @__PURE__ */ new Set();
  for (const segment of segments.slice(1)) {
    const part = segment.trim();
    if (!part) continue;
    if (part.startsWith("@")) {
      const eq2 = part.indexOf("=");
      if (eq2 === -1) continue;
      const key2 = part.slice(1, eq2).trim().toLowerCase();
      const value = part.slice(eq2 + 1).trim();
      if (key2 === "author") author = sanitizePackName(value) || void 0;
      if (key2 === "kind") kind = normalizePackKind(value);
      if (key2 === "tags") {
        try {
          customTags = normalizeLabels(JSON.parse(decodeURIComponent(value)));
        } catch {
          customTags = [];
        }
      }
      continue;
    }
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const addr = part.slice(0, eq).trim();
    const url = part.slice(eq + 1).trim();
    if (!/^https?:\/\//.test(url)) continue;
    const { role, outfit, tag: rawTag } = parseAddress(addr);
    const tag = normalizeTag(rawTag);
    const cleanRole = normalizeTag(role);
    const cleanOutfit = normalizeTag(outfit);
    if (!tag) continue;
    const key = `${cleanRole}|${cleanOutfit}|${tag}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const code = extractImageCode(url) ?? void 0;
    sprites.push({
      tag,
      url,
      remoteUrl: url,
      ...code ? { code } : {},
      ...cleanRole ? { group: cleanRole } : {},
      ...cleanOutfit ? { outfit: cleanOutfit } : {}
    });
  }
  if (sprites.length === 0) {
    throw new Error(t("sprite.manager.content.error.share_no_urls", "导入失败：分享串中没有可用的「地址=URL」条目"));
  }
  const commonRole = sprites.every((s) => (s.group ?? "") === (sprites[0].group ?? "")) ? sprites[0].group ?? "" : "";
  const commonOutfit = sprites.every((s) => (s.outfit ?? "") === (sprites[0].outfit ?? "")) ? sprites[0].outfit ?? "" : "";
  for (const s of sprites) {
    if (commonRole) delete s.group;
    if (commonOutfit) delete s.outfit;
  }
  return {
    id: genId(),
    name,
    author,
    ...kind ? { kind } : {},
    ...customTags.length > 0 ? { customTags } : {},
    ...commonRole ? { roleName: commonRole } : {},
    ...commonOutfit ? { outfit: commonOutfit } : {},
    sprites,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// core/presets.ts
var CASUAL = [
  ["中性", "https://i.ibb.co/xq4cf5cL/3dd68e58257c.webp"],
  ["关怀", "https://i.ibb.co/zhxnSVDC/a649145f4804.webp"],
  ["感激", "https://i.ibb.co/BHCvK9FK/f2a89a044460.webp"],
  ["喜悦", "https://i.ibb.co/v6ZQ675V/da65a3d6f363.webp"],
  ["释然", "https://i.ibb.co/5h6nTHr9/2e8dedc8c995.webp"],
  ["爱慕", "https://i.ibb.co/0VBkYJS8/84cf5eacdcb6.webp"],
  ["悲伤", "https://i.ibb.co/67brywRx/f4026cce61a5.webp"],
  ["害怕", "https://i.ibb.co/svTgVcqT/24b9ec4fe0f8.webp"],
  ["困惑", "https://i.ibb.co/PsLKDkVz/74e88f58013c.webp"],
  ["惊讶", "https://i.ibb.co/8Djg9L3T/804de98cf50d.webp"],
  ["失望", "https://i.ibb.co/ps3dq2r/331d09bc4bb5.webp"],
  ["领悟", "https://i.ibb.co/fGqpR9wZ/90ae3698d869.webp"],
  ["逗乐", "https://i.ibb.co/xqwJSBH1/acd0e14a6003.webp"],
  ["愤怒", "https://i.ibb.co/Z4qKB6L/fd9668f6ceb7.webp"],
  ["好奇", "https://i.ibb.co/wTFM3zG/cb05a7f6daec.webp"],
  ["期许", "https://i.ibb.co/xKkHbDG1/247fdc8430fb.webp"],
  ["懊悔", "https://i.ibb.co/DHgcqX50/0439ea39b11e.webp"],
  ["翻白眼吐舌", "https://i.ibb.co/Dgs304F4/801e25cfe603.webp"]
];
var SHADOW = [
  ["爱慕", "https://i.ibb.co/60pF1rrf/adbb1bd58d94.webp"],
  ["懊悔", "https://i.ibb.co/TM4D64jN/8766ffda8f10.webp"],
  ["悲伤", "https://i.ibb.co/ksCBgD1S/d547c9ec2684.webp"],
  ["逗乐", "https://i.ibb.co/S4Fg4ZHP/b8dac8fb2dc4.webp"],
  ["愤怒", "https://i.ibb.co/kgQY0dmZ/1d8b20b34a9c.webp"],
  ["感激", "https://i.ibb.co/spj7cm0B/803c75db520f.webp"],
  ["关怀", "https://i.ibb.co/MyW7mC51/805c6e6f2fda.webp"],
  ["害怕", "https://i.ibb.co/NgH8zHKY/ad70f87dbe3a.webp"],
  ["好奇", "https://i.ibb.co/PZZcZGT2/01878109e17e.webp"],
  ["惊讶", "https://i.ibb.co/G47GR2Xn/0b6612046f08.webp"],
  ["困惑", "https://i.ibb.co/MkrpPrX2/6bcaa9e1864e.webp"],
  ["领悟", "https://i.ibb.co/B5rT02yj/92259638b108.webp"],
  ["期许", "https://i.ibb.co/Ts3Ndt0/5c84cae66be6.webp"],
  ["失望", "https://i.ibb.co/VcRDvnJZ/fa1338ba2d5b.webp"],
  ["释然", "https://i.ibb.co/8ntLvxkC/e2cbd128cf32.webp"],
  ["妩媚", "https://i.ibb.co/W42FK6ck/2da7682a5aca.webp"],
  ["喜悦", "https://i.ibb.co/RZpHBGw/d196fad4ebd9.webp"],
  ["月光透视", "https://i.ibb.co/Y4GNnH1g/c71429c95fb1.webp"],
  ["中性", "https://i.ibb.co/Vc0rcqS3/e9572425090f.webp"]
];
var HEALING = [
  ["爱慕", "https://i.ibb.co/Kz0qqXwy/943e80b09794.webp"],
  ["懊悔", "https://i.ibb.co/ynDm48B2/d0455c0f8d56.webp"],
  ["悲伤", "https://i.ibb.co/Cs1CJ9Jx/db1bc0f21b91.webp"],
  ["逗乐", "https://i.ibb.co/xqhBPr9f/e17c1185bfe6.webp"],
  ["愤怒", "https://i.ibb.co/d0Sv6wpv/585dae5c1cdc.webp"],
  ["感激", "https://i.ibb.co/xW92rH4/0010903b4cc1.webp"],
  ["关怀", "https://i.ibb.co/PsR6Q63Z/bb10d8ab6dd7.webp"],
  ["害怕", "https://i.ibb.co/xtzGDZNX/347987abde75.webp"],
  ["好奇", "https://i.ibb.co/bRrSvX2b/79f774151ac6.webp"],
  ["惊讶", "https://i.ibb.co/b5YJS5h8/1c4feec0e58d.webp"],
  ["困惑", "https://i.ibb.co/PvDLR31C/921b9266d04a.webp"],
  ["领悟", "https://i.ibb.co/KpgfW9GX/d35fcbb4fc71.webp"],
  ["期许", "https://i.ibb.co/chyS8pMV/85153d9f7564.webp"],
  ["失望", "https://i.ibb.co/gbgDpg9c/81d8a3d4502c.webp"],
  ["释然", "https://i.ibb.co/QvJ1gMXD/b00ab1b50e48.webp"],
  ["喜悦", "https://i.ibb.co/svwRkfnV/df602cb11428.webp"],
  ["治愈绽放", "https://i.ibb.co/PZhSQd5V/64b508544524.webp"],
  ["中性", "https://i.ibb.co/SDzshHs8/ae718842095e.webp"]
];
var PRIEST = [
  ["启仪_变", "https://i.ibb.co/wFsqCvGY/13b312237d50.webp"],
  ["施法_变", "https://i.ibb.co/chdysgxL/0b5ab955de6c.webp"],
  ["爱慕", "https://i.ibb.co/CKBg2km1/78ae74a2723f.webp"],
  ["爱慕_变", "https://i.ibb.co/kVkkscbn/00260a4feba1.webp"],
  ["懊悔", "https://i.ibb.co/YTKgtzjD/f7a718c449ff.webp"],
  ["悲伤", "https://i.ibb.co/Kz6940LS/c14da4f09dbd.webp"],
  ["逗乐", "https://i.ibb.co/0vbDwQL/520b7638c1b0.webp"],
  ["愤怒", "https://i.ibb.co/3y9JmhK1/b0822e479741.webp"],
  ["感激", "https://i.ibb.co/gMHYkGJ0/18f28786a9f4.webp"],
  ["感激_变", "https://i.ibb.co/chVBLdKP/c0119e0d2181.webp"],
  ["关怀", "https://i.ibb.co/R4M427Yv/be710e562c6f.webp"],
  ["关怀_变", "https://i.ibb.co/jP6TYrr8/e3847545ce6f.webp"],
  ["害怕", "https://i.ibb.co/xSrGj0Y4/a4e07cd690ab.webp"],
  ["好奇", "https://i.ibb.co/wNNXFkm1/e2632830682d.webp"],
  ["好奇_变", "https://i.ibb.co/rKCJjwN7/8e97d9255dfa.webp"],
  ["惊讶", "https://i.ibb.co/TBpb5L25/1656c2d618d3.webp"],
  ["困惑", "https://i.ibb.co/CpBn8429/07b8b190dcea.webp"],
  ["领悟", "https://i.ibb.co/7JBZ1bdz/e34f5355ff9e.webp"],
  ["领悟_变", "https://i.ibb.co/s9mbmZ4v/82b0711944b0.webp"],
  ["期许", "https://i.ibb.co/9HnJTNd3/f02a51d2d3f7.webp"],
  ["期许_变", "https://i.ibb.co/xp3Yrrm/87df334b9495.webp"],
  ["森林赐福觉醒", "https://i.ibb.co/PsMKZxcD/25f73b4d1353.webp"],
  ["失望", "https://i.ibb.co/wZYSGcb8/26282c1c0140.webp"],
  ["释然", "https://i.ibb.co/278Vgcfj/7e310449df6f.webp"],
  ["释然_变", "https://i.ibb.co/b5pKXttg/a2c01ff8d658.webp"],
  ["妩媚_变", "https://i.ibb.co/Fb97dRp9/090dc1ec60bc.webp"],
  ["喜悦", "https://i.ibb.co/BHTwvPpp/83fad5398fbb.webp"],
  ["喜悦_变", "https://i.ibb.co/sdKxRR6K/ff4e310ca857.webp"],
  ["中性", "https://i.ibb.co/4RkyVzmK/0cdecdd14d36.webp"],
  ["中性_变", "https://i.ibb.co/1GXq8zXG/b0b8fd3ac8a0.webp"]
];
var BATTLE = [
  ["懊悔", "https://i.ibb.co/9H2xWG2x/91152cce4459.webp"],
  ["悲伤", "https://i.ibb.co/5XJp8LHf/3c211c8b83cc.webp"],
  ["逗乐", "https://i.ibb.co/whg2hdCs/8cfebde27a4b.webp"],
  ["愤怒", "https://i.ibb.co/tTZ4J7FQ/c3f950d3633c.webp"],
  ["感激", "https://i.ibb.co/pvSmYKJ9/d94cbc8cfa25.webp"],
  ["关怀", "https://i.ibb.co/R47nycMX/224cc7f5eb41.webp"],
  ["害怕", "https://i.ibb.co/qLpXyBdK/d00f0cb7ac32.webp"],
  ["好奇", "https://i.ibb.co/Kcjwtx4W/e08d99a6afda.webp"],
  ["惊讶", "https://i.ibb.co/TBndwYZX/62cf3d53fcc0.webp"],
  ["困惑", "https://i.ibb.co/PsMrjMmP/85e7abd8c74d.webp"],
  ["领悟", "https://i.ibb.co/NnL183Sy/b06aaccd6bf5.webp"],
  ["期许", "https://i.ibb.co/B5CyGzn6/c7c6f8f64085.webp"],
  ["失望", "https://i.ibb.co/V0k3sS7f/6496d55b49bd.webp"],
  ["释然", "https://i.ibb.co/qYvP9y6g/b9e5a2f36684.webp"],
  ["喜悦", "https://i.ibb.co/5WRcBW8x/77e9f76adbe4.webp"],
  ["中性", "https://i.ibb.co/5fpPBcb/25edd6692c97.webp"],
  ["自然共鸣觉醒", "https://i.ibb.co/gbq20w38/75a67df38a8c.webp"]
];
var PRESET_DEFS = [
  {
    id: "preset_seraphina_casual",
    name: "塞拉菲娜·常服",
    description: "内置云端预设 · 日常常服",
    roleName: "塞拉菲娜",
    outfit: "常服",
    promptNote: "日常场景中穿的衣服。",
    sprites: CASUAL
  },
  {
    id: "preset_seraphina_shadow",
    name: "塞拉菲娜·暗影斗篷",
    description: "内置云端预设 · 夜间巡行服装",
    roleName: "塞拉菲娜",
    outfit: "暗影斗篷",
    promptNote: "夜晚外出巡夜时的服装。",
    sprites: SHADOW
  },
  {
    id: "preset_seraphina_healing",
    name: "塞拉菲娜·治愈白裙",
    description: "内置云端预设 · 白天外出服装",
    roleName: "塞拉菲娜",
    outfit: "治愈白裙",
    promptNote: "白天外出时的服装。",
    sprites: HEALING
  },
  {
    id: "preset_seraphina_priest",
    name: "塞拉菲娜·祭司仪式袍",
    description: "内置云端预设 · 森林仪式服装",
    roleName: "塞拉菲娜",
    outfit: "祭司仪式袍",
    promptNote: "粗麻多层长袍、露肩、藤蔓束带、翡翠胸针。适用：森林仪式、祈祷、神谕祝福。仪式中可切换至带“_变”后缀的成熟形态。",
    sprites: PRIEST
  },
  {
    id: "preset_seraphina_battle",
    name: "塞拉菲娜·战斗服",
    description: "内置云端预设 · 野外战斗服装",
    roleName: "塞拉菲娜",
    outfit: "战斗服",
    promptNote: "橄榄绿粗布抹胸、撕裂短裹裙、腹部交叉绑带，适用：野外战斗、训练、紧张对峙。",
    sprites: BATTLE
  }
];
var LEGACY_PRESET_IDS = /* @__PURE__ */ new Set(["preset_silver_loli", "preset_raven_onee"]);
function getPresetPacks() {
  return PRESET_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    author: "内置预设",
    description: def.description,
    roleName: def.roleName,
    outfit: def.outfit,
    promptNote: def.promptNote,
    promptNotePlacement: "after-list",
    sprites: def.sprites.map(([tag, url]) => ({
      tag,
      url,
      remoteUrl: url,
      code: url.slice(url.lastIndexOf("/") + 1)
    }))
  }));
}
function presetSpriteKey(sprite) {
  return JSON.stringify([sprite.group || "", sprite.outfit || "", sprite.tag]);
}
function sanitizedNullableText(value) {
  if (value === null) return null;
  return typeof value === "string" ? value.trim() : void 0;
}
function sanitizedNullableTag(value) {
  if (value === null) return null;
  if (typeof value !== "string") return void 0;
  return normalizeTag(value) || void 0;
}
function sanitizePresetOverrides(raw, presets = getPresetPacks()) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result = {};
  for (const preset of presets) {
    const value = raw[preset.id];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const input = value;
    const override = {};
    const metadataInput = input.metadata;
    if (metadataInput && typeof metadataInput === "object" && !Array.isArray(metadataInput)) {
      const source = metadataInput;
      const metadata = {};
      if (typeof source.name === "string") {
        const name = sanitizePackName(source.name);
        if (name) metadata.name = name;
      }
      for (const field of ["author", "description"]) {
        const sanitized = sanitizedNullableText(source[field]);
        if (sanitized !== void 0) metadata[field] = sanitized;
      }
      for (const field of ["roleName", "outfit"]) {
        const sanitized = sanitizedNullableTag(source[field]);
        if (sanitized !== void 0) metadata[field] = sanitized;
      }
      if (source.kind === null) metadata.kind = null;
      else {
        const kind = normalizePackKind(source.kind);
        if (kind) metadata.kind = kind;
      }
      if (source.customTags === null) metadata.customTags = null;
      else if (Array.isArray(source.customTags)) {
        const customTags = normalizeLabels(source.customTags);
        metadata.customTags = customTags.length > 0 ? customTags : null;
      }
      if (source.promptNote === null) metadata.promptNote = null;
      else if (typeof source.promptNote === "string") {
        const note = normalizeNote(source.promptNote);
        if (note) metadata.promptNote = note;
      }
      if (source.promptNotePlacement === null) metadata.promptNotePlacement = null;
      else if (source.promptNotePlacement === "before-list" || source.promptNotePlacement === "after-list") {
        metadata.promptNotePlacement = source.promptNotePlacement;
      }
      if (source.inventoryPrompt === null) metadata.inventoryPrompt = null;
      else if (typeof source.inventoryPrompt === "string") {
        const text4 = normalizeInventoryPrompt(source.inventoryPrompt);
        if (text4) metadata.inventoryPrompt = text4;
      }
      if (source.outfitNotes === null) metadata.outfitNotes = null;
      else if (source.outfitNotes && typeof source.outfitNotes === "object" && !Array.isArray(source.outfitNotes)) {
        metadata.outfitNotes = normalizeOutfitNotes(source.outfitNotes);
      }
      if (Object.keys(metadata).length > 0) override.metadata = metadata;
    }
    if (input.localSprites && typeof input.localSprites === "object" && !Array.isArray(input.localSprites)) {
      const validKeys = new Set(preset.sprites.map(presetSpriteKey));
      const localSprites = {};
      for (const [key, path] of Object.entries(input.localSprites)) {
        if (validKeys.has(key) && typeof path === "string" && isSafeLocalUserImagePath(path)) {
          localSprites[key] = path;
        }
      }
      if (Object.keys(localSprites).length > 0) override.localSprites = localSprites;
    }
    if (typeof input.updatedAt === "string" && input.updatedAt.trim()) {
      override.updatedAt = input.updatedAt.trim();
    }
    if (Object.keys(override).length > 0) result[preset.id] = override;
  }
  return result;
}
function mergePresetPacks(overrides, presets = getPresetPacks()) {
  const sanitized = sanitizePresetOverrides(overrides, presets);
  return presets.map((preset) => {
    const override = sanitized[preset.id];
    if (!override) return preset;
    const merged = { ...preset };
    const metadata = override.metadata;
    if (metadata) {
      if (metadata.name !== void 0) merged.name = metadata.name;
      for (const field of ["author", "description", "roleName", "outfit", "promptNote", "inventoryPrompt"]) {
        const value = metadata[field];
        if (value === null) delete merged[field];
        else if (value !== void 0) merged[field] = value;
      }
      if (metadata.kind === null) delete merged.kind;
      else if (metadata.kind !== void 0) merged.kind = metadata.kind;
      if (metadata.customTags === null) delete merged.customTags;
      else if (metadata.customTags !== void 0) merged.customTags = metadata.customTags;
      if (metadata.promptNotePlacement === null) delete merged.promptNotePlacement;
      else if (metadata.promptNotePlacement !== void 0) {
        merged.promptNotePlacement = metadata.promptNotePlacement;
      }
      if (metadata.outfitNotes === null) delete merged.outfitNotes;
      else if (metadata.outfitNotes !== void 0) merged.outfitNotes = metadata.outfitNotes;
    }
    merged.sprites = preset.sprites.map((sprite) => {
      const local = override.localSprites?.[presetSpriteKey(sprite)];
      return local ? { ...sprite, url: local, remoteUrl: sprite.url } : sprite;
    });
    return merged;
  });
}
function isPresetPack(packId) {
  return LEGACY_PRESET_IDS.has(packId) || PRESET_DEFS.some((def) => def.id === packId);
}

// core/migrate.ts
function migrateSettings(saved) {
  const defaults = createDefaultSettings();
  if (!saved || typeof saved !== "object") return defaults;
  const raw = saved;
  const savedVersion = typeof raw.settingsVersion === "number" && Number.isFinite(raw.settingsVersion) ? raw.settingsVersion : 0;
  const migrated = {
    settingsVersion: SETTINGS_VERSION,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
    hideTagInMessage: typeof raw.hideTagInMessage === "boolean" ? raw.hideTagInMessage : defaults.hideTagInMessage,
    spriteDisplayMode: raw.spriteDisplayMode === "overlay" || raw.spriteDisplayMode === "inline" || raw.spriteDisplayMode === "both" ? raw.spriteDisplayMode : defaults.spriteDisplayMode,
    renderInlineImages: typeof raw.renderInlineImages === "boolean" ? raw.renderInlineImages : defaults.renderInlineImages,
    imageHost: typeof raw.imageHost === "string" && /^https?:\/\//.test(raw.imageHost) ? raw.imageHost : defaults.imageHost,
    overlay: migrateOverlay(raw.overlay, defaults.overlay),
    overlayHidden: typeof raw.overlayHidden === "boolean" ? raw.overlayHidden : defaults.overlayHidden,
    spriteOpacity: typeof raw.spriteOpacity === "number" && Number.isFinite(raw.spriteOpacity) ? Math.min(SPRITE_OPACITY_MAX, Math.max(SPRITE_OPACITY_MIN, Math.round(raw.spriteOpacity))) : defaults.spriteOpacity,
    recentFloors: typeof raw.recentFloors === "number" && Number.isFinite(raw.recentFloors) ? Math.min(RECENT_FLOORS_MAX, Math.max(RECENT_FLOORS_MIN, Math.round(raw.recentFloors))) : defaults.recentFloors,
    phone: migratePhone(raw.phone, defaults.phone),
    showPhone: typeof raw.showPhone === "boolean" ? raw.showPhone : defaults.showPhone,
    autoSwitch: typeof raw.autoSwitch === "boolean" ? raw.autoSwitch : defaults.autoSwitch,
    autoSwitchSeconds: typeof raw.autoSwitchSeconds === "number" && Number.isFinite(raw.autoSwitchSeconds) ? Math.min(60, Math.max(1, Math.round(raw.autoSwitchSeconds))) : defaults.autoSwitchSeconds,
    multiRole: typeof raw.multiRole === "boolean" ? raw.multiRole : defaults.multiRole,
    multiRolePromptMode: raw.multiRolePromptMode === "repeat" ? "repeat" : raw.multiRolePromptMode === "full" && savedVersion >= 5 ? "full" : defaults.multiRolePromptMode,
    spriteCount: typeof raw.spriteCount === "number" && Number.isFinite(raw.spriteCount) ? Math.min(SPRITE_COUNT_MAX, Math.max(SPRITE_COUNT_MIN, Math.round(raw.spriteCount))) : defaults.spriteCount,
    injectionDepth: typeof raw.injectionDepth === "number" && Number.isFinite(raw.injectionDepth) ? Math.min(INJECTION_DEPTH_MAX, Math.max(INJECTION_DEPTH_MIN, Math.round(raw.injectionDepth))) : defaults.injectionDepth,
    promptTemplate: typeof raw.promptTemplate === "string" && !isKnownBuiltinTemplate(raw.promptTemplate) ? raw.promptTemplate : defaults.promptTemplate,
    promptBudget: typeof raw.promptBudget === "number" && Number.isFinite(raw.promptBudget) ? Math.min(PROMPT_BUDGET_MAX, Math.max(PROMPT_BUDGET_MIN, Math.round(raw.promptBudget))) : defaults.promptBudget,
    imgbbApiKey: typeof raw.imgbbApiKey === "string" ? raw.imgbbApiKey : defaults.imgbbApiKey,
    autoUpload: typeof raw.autoUpload === "boolean" ? raw.autoUpload : defaults.autoUpload,
    galleryFoldByRole: savedVersion >= 6 && typeof raw.galleryFoldByRole === "boolean" ? raw.galleryFoldByRole : defaults.galleryFoldByRole,
    // 新增字段无需 bump 版本：缺失时取默认（false），老设置读进来就是关闭状态
    approxMatch: typeof raw.approxMatch === "boolean" ? raw.approxMatch : defaults.approxMatch,
    variableHud: typeof raw.variableHud === "boolean" ? raw.variableHud : defaults.variableHud,
    packs: Array.isArray(raw.packs) ? raw.packs.flatMap((p) => migratePack(p) ?? []) : [],
    presetOverrides: sanitizePresetOverrides(raw.presetOverrides),
    bindings: Array.isArray(raw.bindings) ? raw.bindings.flatMap((b) => migrateBinding(b) ?? []) : [],
    apps: raw.apps && typeof raw.apps === "object" && !Array.isArray(raw.apps) ? raw.apps : {}
  };
  if (savedVersion <= 5) {
    const localCopies = migrateLegacyLocalPresetCopies(
      migrated.packs,
      migrated.bindings,
      migrated.presetOverrides
    );
    return { ...migrated, ...localCopies };
  }
  return migrated;
}
function migrateLegacyLocalPresetCopies(packs, bindings, presetOverrides, presets = getPresetPacks()) {
  const candidatesByPreset = /* @__PURE__ */ new Map();
  for (const preset of presets) {
    const remoteByKey = new Map(preset.sprites.map((sprite) => [presetSpriteKey(sprite), sprite.url]));
    const candidates = packs.filter((pack) => {
      if (pack.name !== `${preset.name}（本地）` || (pack.roleName ?? "") !== (preset.roleName ?? "") || (pack.outfit ?? "") !== (preset.outfit ?? "") || pack.sprites.length !== preset.sprites.length) return false;
      const keys = /* @__PURE__ */ new Set();
      for (const sprite of pack.sprites) {
        const key = presetSpriteKey(sprite);
        if (keys.has(key) || remoteByKey.get(key) !== sprite.remoteUrl) return false;
        keys.add(key);
      }
      return keys.size === remoteByKey.size;
    });
    if (candidates.length === 1 && candidates[0].sprites.every((sprite) => isSafeLocalUserImagePath(sprite.url))) candidatesByPreset.set(preset.id, candidates);
  }
  const copyToPreset = /* @__PURE__ */ new Map();
  const nextOverrides = { ...presetOverrides };
  for (const [presetId, [copy]] of candidatesByPreset) {
    copyToPreset.set(copy.id, presetId);
    const existing = nextOverrides[presetId] ?? {};
    nextOverrides[presetId] = {
      ...existing,
      localSprites: {
        ...existing.localSprites,
        ...Object.fromEntries(copy.sprites.map((sprite) => [presetSpriteKey(sprite), sprite.url]))
      },
      ...copy.updatedAt ? { updatedAt: copy.updatedAt } : {}
    };
  }
  const migratedBindings = bindings.map((binding) => {
    const packIds = [];
    for (const id of binding.packIds) {
      const nextId = copyToPreset.get(id) ?? id;
      if (!packIds.includes(nextId)) packIds.push(nextId);
    }
    return { ...binding, packIds };
  });
  return {
    packs: packs.filter((pack) => !copyToPreset.has(pack.id)),
    bindings: migratedBindings,
    presetOverrides: nextOverrides
  };
}
function migrateOverlay(raw, fallback) {
  if (raw && typeof raw.x === "number" && typeof raw.y === "number" && typeof raw.width === "number" && Number.isFinite(raw.x + raw.y + raw.width)) {
    return { x: raw.x, y: raw.y, width: raw.width };
  }
  return fallback;
}
function migratePhone(raw, fallback) {
  if (raw && typeof raw.x === "number" && typeof raw.y === "number" && Number.isFinite(raw.x + raw.y)) {
    return { x: raw.x, y: raw.y, open: typeof raw.open === "boolean" ? raw.open : fallback.open };
  }
  return fallback;
}
function migrateBinding(raw) {
  if (!raw || typeof raw !== "object") return null;
  const b = raw;
  if (typeof b.characterName !== "string" || !b.characterName) return null;
  const ids = [];
  if (Array.isArray(b.packIds)) {
    for (const id of b.packIds) if (typeof id === "string" && id && !ids.includes(id)) ids.push(id);
  }
  if (typeof b.packId === "string" && b.packId && !ids.includes(b.packId)) ids.push(b.packId);
  if (ids.length === 0) return null;
  return {
    characterName: b.characterName,
    packIds: ids,
    enabled: typeof b.enabled === "boolean" ? b.enabled : true
  };
}
function migratePack(raw) {
  if (!raw || typeof raw !== "object") return null;
  const p = raw;
  if (typeof p.id !== "string" || !p.id || !Array.isArray(p.sprites)) return null;
  const name = sanitizePackName(typeof p.name === "string" ? p.name : "") || "未命名立绘包";
  const sprites = p.sprites.flatMap((s) => {
    if (!s || typeof s.tag !== "string" || typeof s.url !== "string" || !s.url) return [];
    const tag = normalizeTag(s.tag) || s.tag.trim();
    if (!tag) return [];
    const code = typeof s.code === "string" && s.code ? s.code : extractImageCode(s.url) ?? void 0;
    const group = typeof s.group === "string" ? normalizeTag(s.group) : "";
    const outfit2 = typeof s.outfit === "string" ? normalizeTag(s.outfit) : "";
    const remoteUrl = typeof s.remoteUrl === "string" && /^https?:\/\//.test(s.remoteUrl) ? s.remoteUrl : "";
    const labels = normalizeLabels(s.labels);
    return [
      {
        tag,
        url: s.url,
        ...code ? { code } : {},
        ...group ? { group } : {},
        ...outfit2 ? { outfit: outfit2 } : {},
        ...remoteUrl ? { remoteUrl } : {},
        ...labels.length > 0 ? { labels } : {}
      }
    ];
  });
  const roleName = typeof p.roleName === "string" ? normalizeTag(p.roleName) : "";
  const outfit = typeof p.outfit === "string" ? normalizeTag(p.outfit) : "";
  const kind = normalizePackKind(p.kind);
  const customTags = normalizeLabels(p.customTags);
  const promptNote = normalizeNote(p.promptNote);
  const inventoryPrompt = normalizeInventoryPrompt(p.inventoryPrompt);
  const outfitNotes = normalizeOutfitNotes(p.outfitNotes);
  const sourceStoryKey = typeof p.sourceStoryKey === "string" ? p.sourceStoryKey.trim() : "";
  return {
    id: p.id,
    name,
    ...typeof p.author === "string" && p.author ? { author: p.author } : {},
    ...typeof p.description === "string" && p.description ? { description: p.description } : {},
    ...kind ? { kind } : {},
    ...customTags.length > 0 ? { customTags } : {},
    ...roleName ? { roleName } : {},
    ...outfit ? { outfit } : {},
    ...promptNote ? { promptNote } : {},
    ...inventoryPrompt ? { inventoryPrompt } : {},
    ...p.promptNotePlacement === "before-list" || p.promptNotePlacement === "after-list" ? { promptNotePlacement: p.promptNotePlacement } : {},
    ...Object.keys(outfitNotes).length > 0 ? { outfitNotes } : {},
    ...sourceStoryKey ? { sourceStoryKey } : {},
    ...typeof p.coverTag === "string" && p.coverTag ? { coverTag: p.coverTag } : {},
    ...typeof p.updatedAt === "string" && p.updatedAt ? { updatedAt: p.updatedAt } : {},
    sprites
  };
}

// core/image-compress.ts
function analyzeImagePixels(data) {
  if (data.length < 4) return "opaque";
  const luminanceBins = /* @__PURE__ */ new Map();
  let grayscalePixels = 0;
  const totalPixels = Math.floor(data.length / 4);
  for (let offset = 0; offset + 3 < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha < 250) return "transparent";
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 5) continue;
    grayscalePixels += 1;
    const bin = Math.round((red + green + blue) / 3 / 8) * 8;
    luminanceBins.set(bin, (luminanceBins.get(bin) ?? 0) + 1);
  }
  const dominant = [...luminanceBins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (dominant.length === 2) {
    const [[firstValue, firstCount], [secondValue, secondCount]] = dominant;
    const difference = Math.abs(firstValue - secondValue);
    const dominantCount = firstCount + secondCount;
    if (grayscalePixels / totalPixels >= 0.5 && firstCount / totalPixels >= 0.1 && secondCount / totalPixels >= 0.1 && dominantCount / totalPixels >= 0.5 && Math.min(firstValue, secondValue) >= 160 && difference >= 8 && difference <= 64) return "opaque-checkerboard";
  }
  return "opaque";
}
function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
function estimateDataUriBytes(dataUri) {
  const comma = dataUri.indexOf(",");
  const payload = comma >= 0 ? dataUri.length - comma - 1 : dataUri.length;
  return Math.round(payload * 0.75);
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
async function compressImage(file, options = {}) {
  const { maxDimension = 1024, quality = 0.85 } = options;
  const originalUri = await blobToDataUri(file);
  const original = {
    dataUri: originalUri,
    compressed: false,
    bytes: estimateDataUriBytes(originalUri)
  };
  if (file.type === "image/gif" || file.type === "image/svg+xml") return original;
  if (typeof document === "undefined") return original;
  try {
    const img = await loadImage(originalUri);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (longest === 0) return original;
    const scale = Math.min(1, maxDimension / longest);
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, width, height);
    let transparency;
    try {
      transparency = analyzeImagePixels(ctx.getImageData(0, 0, width, height).data);
    } catch {
    }
    const compressedUri = canvas.toDataURL("image/webp", quality);
    if (!compressedUri.startsWith("data:image/webp") || compressedUri.length >= originalUri.length) {
      return { ...original, ...transparency ? { transparency } : {} };
    }
    return {
      dataUri: compressedUri,
      compressed: true,
      bytes: estimateDataUriBytes(compressedUri),
      ...transparency ? { transparency } : {}
    };
  } catch {
    return original;
  }
}
async function recompressDataUri(dataUri, options = {}) {
  if (typeof document === "undefined") return dataUri;
  const mime = /^data:([^;,]+)/.exec(dataUri)?.[1] ?? "";
  if (!mime.startsWith("image/")) return dataUri;
  if (mime === "image/webp" || mime === "image/gif" || mime === "image/svg+xml") return dataUri;
  try {
    const blob = await (await fetch(dataUri)).blob();
    return (await compressImage(blob, options)).dataUri;
  } catch {
    return dataUri;
  }
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片解码失败"));
    img.src = src;
  });
}

// st-extension/src/image-persistence.ts
var ST_IMAGE_SAVE_TIMEOUT_MS = 3e4;
var ST_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
var IMAGE_FORMATS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/bmp": "bmp"
};
function uniqueImageName() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
    throw new Error(t("storage.errors.random_image", "当前环境不支持安全随机图片命名"));
  }
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return `sprite_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function parseImageData(dataUri) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUri);
  if (!match || match[2].length % 4 !== 0) throw new Error(t("storage.errors.image_data", "图片数据格式不正确"));
  const format = IMAGE_FORMATS[match[1].toLowerCase()];
  if (!format) throw new Error(t("storage.errors.image_format", "不支持的图片格式，请转换为 PNG、WebP 或 GIF 后重试"));
  const binarySize = match[2].length * 3 / 4 - (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0);
  if (binarySize > ST_IMAGE_MAX_BYTES) throw new Error(t("storage.errors.image_size", "单张图片不能超过 20 MiB"));
  let binary;
  try {
    binary = atob(match[2]);
  } catch (error) {
    throw new Error(t("storage.errors.image_data", "图片数据格式不正确"), { cause: error });
  }
  if (!binary.length) throw new Error(t("storage.errors.image_empty", "图片数据为空"));
  return {
    image: match[2],
    format,
    bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0))
  };
}
function sameBytes(actual, expected) {
  if (actual.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) return false;
  }
  return true;
}
async function persistSTImage(dataUri, deps, options = {}) {
  if (typeof deps.fetch !== "function") throw new Error(t("storage.errors.fetch_missing", "当前环境不支持图片保存请求能力"));
  if (typeof deps.getRequestHeaders !== "function") {
    throw new Error(t("storage.errors.headers_missing", "当前酒馆未提供图片保存所需的请求头能力"));
  }
  const headers = deps.getRequestHeaders();
  if (!headers || typeof headers !== "object" || Object.keys(headers).length === 0) {
    throw new Error(t("storage.errors.headers_missing", "当前酒馆未提供图片保存所需的请求头能力"));
  }
  const data = parseImageData(dataUri);
  const filename = uniqueImageName();
  const expectedPath = `/user/images/sprite_overlay/${filename}.${data.format}`;
  const controller = new AbortController();
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onAbort, { once: true });
  if (options.signal?.aborted) onAbort();
  const timer = setTimeout(() => controller.abort(new Error(t("storage.errors.timeout", "图片保存超时"))), ST_IMAGE_SAVE_TIMEOUT_MS);
  try {
    const response = await deps.fetch("/api/images/upload", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        image: data.image,
        format: data.format,
        ch_name: "sprite_overlay",
        filename
      })
    });
    if (!response.ok) throw new Error(t("storage.errors.upload_http", "图片上传失败：HTTP {{status}}", { status: response.status }));
    const result = await response.json();
    const path = result && typeof result === "object" && "path" in result ? result.path : void 0;
    if (typeof path !== "string" || path !== expectedPath || localUserImagePath(path) !== expectedPath) {
      throw new Error(t("storage.errors.response_path", "图片上传响应未返回本次保存的安全本地路径"));
    }
    const readback = await deps.fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal
    });
    if (!readback.ok) throw new Error(t("storage.errors.readback_http", "图片保存后校验失败：HTTP {{status}}", { status: readback.status }));
    const actual = new Uint8Array(await readback.arrayBuffer());
    if (!sameBytes(actual, data.bytes)) throw new Error(t("storage.errors.content_mismatch", "图片保存后校验失败：文件内容不一致"));
    return path;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

// core/story-archive.ts
function storyArchiveKey(parts) {
  const groupId = clean(parts.groupId);
  const characterId = clean(parts.characterId);
  const characterName = clean(parts.characterName);
  const owner = groupId ? `group:${groupId}` : characterId || (characterName ? `name:${characterName}` : "unknown");
  const chatId = clean(parts.chatId);
  const title2 = clean(parts.title);
  const chat2 = chatId || (title2 ? `title:${title2}` : "current");
  return `${owner}::${chat2}`;
}
function upsertStorySprite(settings, story, source) {
  const existingIndex = settings.packs.findIndex((pack2) => pack2.sourceStoryKey === story.key);
  const existing = existingIndex >= 0 ? settings.packs[existingIndex] : null;
  const sourceUrls = new Set([source.url, source.remoteUrl].filter((url) => Boolean(url)));
  if (existing?.sprites.some(
    (sprite) => sourceUrls.has(sprite.url) || Boolean(sprite.remoteUrl && sourceUrls.has(sprite.remoteUrl))
  )) return settings;
  const pack = existing ?? createStoryPack(story);
  const tag = uniqueTag(pack, source.tag);
  const nextPack = {
    ...pack,
    roleName: pack.roleName || normalizeTag(story.characterName) || void 0,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    sprites: [...pack.sprites, { ...source, tag }]
  };
  const packs = [...settings.packs];
  if (existingIndex >= 0) packs[existingIndex] = nextPack;
  else packs.push(nextPack);
  return { ...settings, packs };
}
function createStoryPack(story) {
  const title2 = sanitizePackName(story.title) || sanitizePackName(story.characterName) || "Untitled";
  return {
    id: `story_${hash(story.key)}`,
    name: sanitizePackName(`Story - ${title2}`) || "Story",
    kind: "illustration",
    roleName: normalizeTag(story.characterName) || void 0,
    sourceStoryKey: story.key,
    sprites: []
  };
}
function uniqueTag(pack, raw) {
  const fallback = `Generated image ${pack.sprites.length + 1}`;
  const base = normalizeTag(raw) || normalizeTag(fallback);
  const used = new Set(pack.sprites.map((sprite) => sprite.tag));
  if (!used.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const suffixText = ` ${suffix}`;
    const stem = Array.from(base).slice(0, Math.max(1, 20 - suffixText.length)).join("");
    const candidate = normalizeTag(`${stem}${suffixText}`);
    if (!used.has(candidate)) return candidate;
  }
}
function clean(value) {
  return value === null || value === void 0 ? "" : String(value).trim();
}
function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

// st-extension/src/st-adapter.ts
var MODULE_NAME = "sprite_overlay";
async function loadLocaleFile(locale, bundleUrl) {
  const controller = new AbortController();
  let timer;
  try {
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("Locale loading timed out"));
      }, 3e3);
    });
    const request = async () => {
      const url = new URL(`./locales/${locale}.json`, bundleUrl).href;
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const dict = await response.json();
      if (!isI18nDict(dict)) throw new TypeError("Invalid translation dictionary");
      return dict;
    };
    return await Promise.race([request(), deadline]);
  } catch (err) {
    console.warn(`[sprite-overlay] 加载 locale ${locale} 异常`, err);
    return {};
  } finally {
    clearTimeout(timer);
  }
}
async function initI18n(bundleUrl = import.meta.url) {
  resetI18n();
  const [zhDict, enDict] = await Promise.all([
    loadLocaleFile("zh-CN", bundleUrl),
    loadLocaleFile("en-US", bundleUrl)
  ]);
  loadTranslations("zh-CN", zhDict);
  loadTranslations("en-US", enDict);
  let savedLanguage = null;
  try {
    savedLanguage = localStorage.getItem("language");
  } catch {
  }
  const browser = typeof navigator === "undefined" ? void 0 : navigator;
  const language = String(savedLanguage || browser?.language || browser?.userLanguage || "en").toLowerCase();
  const locale = language.startsWith("en") ? "en-US" : "zh-CN";
  try {
    setLocale(locale);
  } catch {
    if (locale !== "zh-CN") {
      try {
        setLocale("zh-CN");
      } catch {
      }
    }
  }
  console.log(`[sprite-overlay] i18n 已初始化: ${getLocale()}`);
}
function persistableSTSettings(settings) {
  return {
    ...settings,
    packs: settings.packs.filter((pack) => !isPresetPack(pack.id))
  };
}
function getContext() {
  const st = window.SillyTavern;
  if (!st) throw new Error("[sprite-overlay] SillyTavern 全局对象不存在，扩展只能在 ST 内运行");
  return st.getContext();
}
function findComposerTextarea(root = document) {
  const input = root.querySelector("#send_textarea");
  return input instanceof HTMLTextAreaElement ? input : null;
}
var STAdapter = class {
  /** 只读返回指定消息的原始文本，供可见 DOM 的保守后处理建立边界证据。 */
  getRawMessage(messageId) {
    const index = typeof messageId === "number" ? messageId : /^(?:0|[1-9]\d*)$/.test(messageId) ? Number(messageId) : NaN;
    if (!Number.isInteger(index) || index < 0) return null;
    const message = getContext().chat[index];
    return typeof message?.mes === "string" ? message.mes : null;
  }
  async loadSettings() {
    const ctx = getContext();
    const saved = ctx.extensionSettings[MODULE_NAME];
    if (saved && typeof saved === "object") {
      const merged = migrateSettings(saved);
      const customPacks = merged.packs.filter((p) => !isPresetPack(p.id));
      merged.packs = [...mergePresetPacks(merged.presetOverrides), ...customPacks];
      return merged;
    }
    const defaults = createDefaultSettings();
    defaults.packs = mergePresetPacks(defaults.presetOverrides);
    ctx.extensionSettings[MODULE_NAME] = defaults;
    ctx.saveSettingsDebounced();
    return defaults;
  }
  async saveSettings(settings) {
    const ctx = getContext();
    ctx.extensionSettings[MODULE_NAME] = persistableSTSettings(settings);
    ctx.saveSettingsDebounced();
  }
  /** 迁移/备份入口按需读取原始插件值，不在启动时复制大对象。 */
  getStoredSettingsForBackup() {
    return getContext().extensionSettings[MODULE_NAME];
  }
  saveDataUri(dataUri, options = {}) {
    const ctx = getContext();
    const headers = ctx.getRequestHeaders;
    return persistSTImage(dataUri, {
      fetch,
      getRequestHeaders: headers ? () => headers.call(ctx) : void 0
    }, options);
  }
  async saveImage(_fileName, base64Data, _characterName) {
    return this.saveDataUri(base64Data);
  }
  async saveImageFile(file, fileName, characterName) {
    return this.saveImage(fileName, await blobToDataUri(file), characterName);
  }
  async deleteImage(url) {
    const path = url.split(/[?#]/, 1)[0].replace(/\\/g, "/");
    if (!isSafeLocalUserImagePath(path)) {
      throw new Error(t("imageActions.delete_scope", "只能删除 SillyTavern 用户图片目录中的文件"));
    }
    const ctx = getContext();
    const response = await fetch("/api/images/delete", {
      method: "POST",
      headers: ctx.getRequestHeaders?.() ?? { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path.slice(1) })
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(t("imageActions.delete_failed", "删除本地图片失败：HTTP {{status}}", { status: response.status }));
    }
  }
  getCurrentCharacterName() {
    const ctx = getContext();
    const id = ctx.characterId;
    if (id !== void 0 && id !== null && `${id}` !== "") {
      const byId = ctx.characters[Number(id)]?.name;
      if (byId) return byId;
    }
    return ctx.name2 ?? "";
  }
  getStoryContext() {
    const ctx = getContext();
    const groupId = ctx.groupId;
    const group = groupId === void 0 || groupId === null ? void 0 : ctx.groups?.find((candidate) => `${candidate.id ?? ""}` === `${groupId}`);
    const characterName = group?.name || this.getCurrentCharacterName() || "Unknown";
    const chatId = ctx.chatId ?? ctx.chatMetadata?.file_name;
    const title2 = ctx.chatMetadata?.name || ctx.chatMetadata?.file_name || `${chatId ?? ""}` || characterName;
    return {
      key: storyArchiveKey({
        chatId,
        characterId: ctx.characterId,
        groupId,
        title: title2,
        characterName
      }),
      title: title2,
      characterName
    };
  }
  injectPrompt(prompt, depth = INJECTION_DEPTH_DEFAULT) {
    const ctx = getContext();
    ctx.setExtensionPrompt(MODULE_NAME, prompt, 1, depth);
  }
  injectChannel(channel, prompt, depth = INJECTION_DEPTH_DEFAULT) {
    const ctx = getContext();
    ctx.setExtensionPrompt(`st-stage::${channel}`, prompt, 1, depth);
  }
  onMessageReceived(handler) {
    const ctx = getContext();
    const eventName = ctx.eventTypes?.MESSAGE_RECEIVED ?? ctx.event_types?.MESSAGE_RECEIVED ?? "message_received";
    const wrapped = (...args) => {
      try {
        const messageId = args[0];
        const chat2 = getContext().chat;
        const idNum = typeof messageId === "number" ? messageId : typeof messageId === "string" && messageId.trim() !== "" ? Number(messageId) : NaN;
        const message = Number.isInteger(idNum) && idNum >= 0 && idNum < chat2.length ? chat2[idNum] : chat2[chat2.length - 1];
        if (message && !message.is_user && typeof message.mes === "string") {
          handler(message.mes);
        }
      } catch (err) {
        console.error("[sprite-overlay] 处理消息事件失败", err);
      }
    };
    ctx.eventSource.on(eventName, wrapped);
    return () => ctx.eventSource.removeListener(eventName, wrapped);
  }
  /** 订阅角色切换事件 */
  onCharacterChanged(handler) {
    const ctx = getContext();
    const eventName = ctx.eventTypes?.CHAT_CHANGED ?? "chat_id_changed";
    ctx.eventSource.on(eventName, handler);
    return () => ctx.eventSource.removeListener(eventName, handler);
  }
  /** 订阅新聊天创建；CHAT_CHANGED 在部分 ST 版本中会早于新聊天 DOM 稳定。 */
  onChatCreated(handler) {
    const ctx = getContext();
    const eventName = ctx.eventTypes?.CHAT_CREATED ?? "chat_created";
    ctx.eventSource.on(eventName, handler);
    return () => ctx.eventSource.removeListener(eventName, handler);
  }
  /** 订阅流式累计文本。ST 每次事件传入从回复开头到当前 token 的完整字符串。 */
  onStreamText(handler) {
    const ctx = getContext();
    const eventName = ctx.eventTypes?.STREAM_TOKEN_RECEIVED ?? "stream_token_received";
    const wrapped = (text4) => {
      if (typeof text4 === "string") handler(text4);
    };
    ctx.eventSource.on(eventName, wrapped);
    return () => ctx.eventSource.removeListener(eventName, wrapped);
  }
  /** 订阅生成结束，用于清空流式增量状态。 */
  onGenerationEnded(handler) {
    const ctx = getContext();
    const eventName = ctx.eventTypes?.GENERATION_ENDED ?? "generation_ended";
    ctx.eventSource.on(eventName, handler);
    return () => ctx.eventSource.removeListener(eventName, handler);
  }
};

// st-extension/src/overlay-dom.ts
var DRAG_THRESHOLD3 = 6;
function createOverlay(initialLayout, onLayoutChange, onManage, onClose, onOpenSprites) {
  let layout = { ...initialLayout };
  let sprites = [];
  let index = 0;
  let autoEnabled = false;
  let autoSeconds = 3;
  let autoTimer = null;
  let fadeTimer = null;
  let userOpacity = 1;
  const root = document.createElement("div");
  root.id = "sprite-overlay-root";
  root.style.display = "none";
  const frame = document.createElement("div");
  frame.className = "sprite-overlay-frame";
  const img = document.createElement("img");
  img.alt = "";
  img.draggable = false;
  const tagBadge = document.createElement("div");
  tagBadge.className = "sprite-overlay-tag";
  const dots = document.createElement("div");
  dots.className = "sprite-overlay-dots";
  dots.style.display = "none";
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "sprite-overlay-resize";
  const placeholder = document.createElement("div");
  placeholder.className = "sprite-overlay-placeholder";
  placeholder.style.display = "none";
  const gearBtn = document.createElement("div");
  gearBtn.className = "sprite-overlay-gear";
  gearBtn.title = t("sprite.manager.title", "立绘包管理");
  gearBtn.textContent = "⚙";
  gearBtn.setAttribute("role", "button");
  gearBtn.setAttribute("aria-label", gearBtn.title);
  gearBtn.tabIndex = 0;
  gearBtn.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      gearBtn.click();
    }
  });
  gearBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  gearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onManage?.();
  });
  const spritesBtn = document.createElement("div");
  spritesBtn.className = "sprite-overlay-sprites fa-solid fa-eye";
  spritesBtn.title = t("sprite.overlay.open_app", "打开立绘 App");
  spritesBtn.setAttribute("role", "button");
  spritesBtn.setAttribute("aria-label", t("sprite.overlay.open_app", "打开立绘 App"));
  spritesBtn.tabIndex = 0;
  spritesBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  const openSprites = (e) => {
    e.stopPropagation();
    onOpenSprites?.();
  };
  spritesBtn.addEventListener("click", openSprites);
  spritesBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openSprites(e);
    }
  });
  const closeBtn = document.createElement("div");
  closeBtn.className = "sprite-overlay-close";
  closeBtn.title = t("sprite.overlay.close_hint", "关闭悬浮窗（立绘功能不受影响，可在手机「立绘」App 重新打开）");
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("role", "button");
  closeBtn.setAttribute("aria-label", t("sprite.overlay.close", "关闭悬浮窗"));
  closeBtn.tabIndex = 0;
  closeBtn.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      closeBtn.click();
    }
  });
  closeBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClose?.();
  });
  frame.append(img, placeholder, tagBadge, dots, spritesBtn, gearBtn, closeBtn, resizeHandle);
  root.append(frame);
  document.body.append(root);
  function applyLayout() {
    const w = Math.min(layout.width, Math.max(100, window.innerWidth - 16));
    root.style.width = `${w}px`;
    const h = Math.min(root.offsetHeight || 48, window.innerHeight - 8);
    root.style.left = `${Math.max(0, Math.min(layout.x, window.innerWidth - w))}px`;
    root.style.top = `${Math.max(0, Math.min(layout.y, window.innerHeight - h))}px`;
  }
  applyLayout();
  window.addEventListener("resize", applyLayout);
  window.visualViewport?.addEventListener("resize", applyLayout);
  img.addEventListener("load", applyLayout);
  function showImage(url, tag) {
    placeholder.style.display = "none";
    img.style.display = "block";
    tagBadge.style.display = "";
    if (img.src === url) {
      tagBadge.textContent = tag;
      return;
    }
    img.style.opacity = "0";
    if (fadeTimer) clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      img.src = url;
      tagBadge.textContent = tag;
      img.onload = () => {
        img.style.opacity = String(userOpacity);
      };
      if (img.complete) img.style.opacity = String(userOpacity);
    }, 180);
  }
  function renderDots() {
    dots.replaceChildren();
    if (sprites.length <= 1) {
      dots.style.display = "none";
      return;
    }
    sprites.forEach((_, i) => {
      const dot = document.createElement("span");
      if (i === index) dot.className = "active";
      dots.append(dot);
    });
    dots.style.display = "flex";
  }
  function renderCurrent() {
    const cur = sprites[index];
    if (!cur) return;
    showImage(cur.url, cur.tag);
    Array.from(dots.children).forEach(
      (el4, i) => el4.classList.toggle("active", i === index)
    );
  }
  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }
  function startAuto() {
    stopAuto();
    if (autoEnabled && sprites.length > 1) {
      autoTimer = setInterval(() => {
        index = (index + 1) % sprites.length;
        renderCurrent();
      }, Math.max(1, autoSeconds) * 1e3);
    }
  }
  function advanceManually() {
    if (sprites.length <= 1) return;
    index = (index + 1) % sprites.length;
    renderCurrent();
    startAuto();
  }
  function applySprites(list) {
    if (list.length === 0) return;
    sprites = list;
    index = 0;
    renderDots();
    renderCurrent();
    startAuto();
  }
  function startDrag(mode, startEvent) {
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const origin = { ...layout };
    let moved = false;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD3) return;
      moved = true;
      if (mode === "move") {
        layout = { ...origin, x: Math.max(0, origin.x + dx), y: Math.max(0, origin.y + dy) };
      } else {
        layout = {
          ...origin,
          width: Math.min(600, window.innerWidth - 16, Math.max(100, origin.width + dx))
        };
      }
      applyLayout();
    };
    const onUp = () => {
      cleanup();
      if (moved) {
        onLayoutChange(layout);
      } else if (mode === "move") {
        advanceManually();
      }
    };
    const onCancel = () => {
      cleanup();
      if (moved) onLayoutChange(layout);
    };
    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }
  frame.addEventListener("pointerdown", (e) => {
    if (e.target === resizeHandle) return;
    startDrag("move", e);
  });
  resizeHandle.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    startDrag("resize", e);
  });
  return {
    setImage(url, tag) {
      applySprites([{ url, tag }]);
    },
    setSprites(list) {
      applySprites(list);
    },
    setAutoSwitch(enabled, seconds) {
      autoEnabled = enabled;
      autoSeconds = Math.max(1, seconds);
      startAuto();
    },
    setPlaceholder(text4) {
      stopAuto();
      sprites = [];
      index = 0;
      dots.replaceChildren();
      dots.style.display = "none";
      img.style.display = "none";
      tagBadge.style.display = "none";
      placeholder.textContent = text4;
      placeholder.style.display = "flex";
    },
    setVisible(visible) {
      root.style.display = visible ? "block" : "none";
    },
    setLayout(next) {
      layout = { ...next };
      applyLayout();
    },
    setOpacity(percent) {
      const clamped = Math.min(100, Math.max(20, Math.round(percent))) / 100;
      userOpacity = clamped;
      if (img.style.opacity !== "0") img.style.opacity = String(clamped);
    },
    destroy() {
      stopAuto();
      if (fadeTimer) clearTimeout(fadeTimer);
      window.removeEventListener("resize", applyLayout);
      window.visualViewport?.removeEventListener("resize", applyLayout);
      root.remove();
    }
  };
}

// core/pack-merge.ts
var PackMergeChoiceError = class extends Error {
  constructor() {
    super(...arguments);
    this.name = "PackMergeChoiceError";
  }
};
function mergeAddress(pack, sprite) {
  return {
    role: (sprite.group ?? "").trim() || (pack.roleName ?? "").trim(),
    outfit: spriteOutfit(pack, sprite),
    tag: sprite.tag
  };
}
function buildGroups(packs) {
  const groups = /* @__PURE__ */ new Map();
  for (const pack of packs) {
    for (const sprite of pack.sprites) {
      const address = mergeAddress(pack, sprite);
      const key = addressConflictKey(address);
      let group = groups.get(key);
      if (!group) {
        group = { key, address, candidates: [] };
        groups.set(key, group);
      }
      group.candidates.push({
        sourcePackId: pack.id,
        sourcePackName: pack.name,
        address,
        sprite
      });
    }
  }
  return [...groups.values()];
}
function isAutomatic(group) {
  return new Set(group.candidates.map((candidate) => candidate.sprite.url)).size <= 1;
}
function previewPackMerge(packs) {
  const names = packs.map((pack) => pack.name.trim()).filter(Boolean);
  const sameName = new Set(names).size < names.length;
  const automatic = [];
  const conflicts = [];
  let overlapCount = 0;
  for (const group of buildGroups(packs)) {
    if (group.candidates.length > 1) overlapCount++;
    if (isAutomatic(group)) automatic.push(group.candidates[0]);
    else conflicts.push({ key: group.key, address: group.address, candidates: group.candidates });
  }
  return { sameName, overlapCount, automatic, conflicts };
}
function inspectPackImport(existing, incoming) {
  return {
    sameName: existing.name.trim() === incoming.name.trim(),
    conflicts: findAddressConflicts([existing, incoming])
  };
}
function commonNonEmpty(values) {
  if (values.length === 0 || !values[0]) return "";
  return values.every((value) => value === values[0]) ? values[0] : "";
}
function validateChoicesForGroups(groups, choices) {
  const conflicts = groups.filter((group) => !isAutomatic(group));
  const conflictByKey = new Map(conflicts.map((group) => [group.key, group]));
  const choiceByKey = /* @__PURE__ */ new Map();
  for (const choice of choices) {
    const group = conflictByKey.get(choice.key);
    if (!group) {
      throw new PackMergeChoiceError(t("galleryErrors.merge_unknown", "未知冲突选择 key：{{key}}", { key: choice.key }));
    }
    if (choiceByKey.has(choice.key)) {
      throw new PackMergeChoiceError(t("galleryErrors.merge_duplicate", "地址「{{tag}}」存在重复选择", { tag: group.address.tag }));
    }
    if (!Number.isSafeInteger(choice.candidateIndex) || choice.candidateIndex < 0 || choice.candidateIndex >= group.candidates.length) {
      throw new PackMergeChoiceError(t("galleryErrors.merge_invalid", "地址「{{tag}}」的候选序号无效", { tag: group.address.tag }));
    }
    choiceByKey.set(choice.key, choice.candidateIndex);
  }
  for (const group of conflicts) {
    if (!choiceByKey.has(group.key)) {
      throw new PackMergeChoiceError(t("galleryErrors.merge_missing", "地址「{{tag}}」的冲突图片尚未选择", { tag: group.address.tag }));
    }
  }
  return choiceByKey;
}
function validatePackMergeChoices(packs, choices) {
  validateChoicesForGroups(buildGroups(packs), choices);
}
function applyPackMerge(packs, choices, result) {
  const groups = buildGroups(packs);
  const choiceByKey = validateChoicesForGroups(groups, choices);
  const selected = [];
  for (const group of groups) {
    if (isAutomatic(group)) {
      selected.push(group.candidates[0]);
      continue;
    }
    selected.push(group.candidates[choiceByKey.get(group.key)]);
  }
  const commonRole = commonNonEmpty(selected.map((candidate) => candidate.address.role));
  const commonOutfit = commonNonEmpty(selected.map((candidate) => candidate.address.outfit));
  const sprites = selected.map((candidate) => {
    const sprite = { ...candidate.sprite };
    delete sprite.group;
    delete sprite.outfit;
    if (!commonRole && candidate.address.role) sprite.group = candidate.address.role;
    if (!commonOutfit && candidate.address.outfit) sprite.outfit = candidate.address.outfit;
    return sprite;
  });
  const first = packs[0];
  const customTags = normalizeLabels(packs.flatMap((pack) => pack.customTags ?? []));
  const coverTag = first?.coverTag && sprites.some((sprite) => sprite.tag === first.coverTag) ? first.coverTag : sprites[0]?.tag;
  return {
    id: result.id,
    name: result.name,
    ...first?.author ? { author: first.author } : {},
    ...first?.description ? { description: first.description } : {},
    ...first?.kind ? { kind: first.kind } : {},
    ...customTags.length > 0 ? { customTags } : {},
    ...commonRole ? { roleName: commonRole } : {},
    ...commonOutfit ? { outfit: commonOutfit } : {},
    ...coverTag ? { coverTag } : {},
    sprites,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// core/pack-io.ts
async function exportPack(pack, embedHosted = false) {
  const sprites = [];
  for (const sprite of pack.sprites) {
    const source = getSpriteSource(sprite);
    const labels = normalizeLabels(sprite.labels);
    const extra = {
      ...remoteField(sprite),
      ...sprite.group ? { group: sprite.group } : {},
      ...sprite.outfit ? { outfit: sprite.outfit } : {},
      ...labels.length > 0 ? { labels } : {}
    };
    if (source === "embedded") {
      sprites.push({ tag: sprite.tag, data: await recompressDataUri(sprite.url), ...extra });
    } else if (source === "local" || embedHosted) {
      try {
        const data = await recompressDataUri(await urlToDataUri(sprite.url));
        sprites.push({ tag: sprite.tag, data, ...extra });
      } catch {
        sprites.push({ tag: sprite.tag, url: sprite.url, ...codeField(sprite.url, sprite.code), ...extra });
      }
    } else {
      sprites.push({ tag: sprite.tag, url: sprite.url, ...codeField(sprite.url, sprite.code), ...extra });
    }
  }
  const promptNote = normalizeNote(pack.promptNote);
  const inventoryPrompt = normalizeInventoryPrompt(pack.inventoryPrompt);
  const outfitNotes = normalizeOutfitNotes(pack.outfitNotes);
  const sourceStoryKey = typeof pack.sourceStoryKey === "string" ? pack.sourceStoryKey.trim() : "";
  const kind = normalizePackKind(pack.kind);
  const customTags = normalizeLabels(pack.customTags);
  return {
    format: "sprite-pack@3",
    name: pack.name,
    author: pack.author,
    description: pack.description,
    ...kind ? { kind } : {},
    ...customTags.length > 0 ? { customTags } : {},
    ...pack.roleName ? { roleName: pack.roleName } : {},
    ...pack.outfit ? { outfit: pack.outfit } : {},
    ...promptNote ? { promptNote } : {},
    ...inventoryPrompt ? { inventoryPrompt } : {},
    ...pack.promptNotePlacement === "before-list" || pack.promptNotePlacement === "after-list" ? { promptNotePlacement: pack.promptNotePlacement } : {},
    ...Object.keys(outfitNotes).length > 0 ? { outfitNotes } : {},
    ...sourceStoryKey ? { sourceStoryKey } : {},
    coverTag: pack.coverTag,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    sprites
  };
}
function codeField(url, code) {
  const resolved = code ?? extractImageCode(url);
  return resolved ? { code: resolved } : {};
}
function remoteField(sprite) {
  const r = sprite.remoteUrl;
  return r && /^https:\/\/.+/i.test(r) ? { remoteUrl: r } : {};
}
function importPack(jsonText) {
  let raw;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error(t("sprite.manager.content.error.invalid_json", "导入失败：不是合法的 JSON 文件"));
  }
  const file = raw;
  if (file.format !== "sprite-pack@3" && file.format !== "sprite-pack@2" && file.format !== "sprite-pack@1") {
    throw new Error(t("sprite.manager.content.error.pack_format", "导入失败：不是 sprite-pack@1 / @2 / @3 格式的立绘包"));
  }
  if (typeof file.name !== "string" || !file.name || !Array.isArray(file.sprites) || file.sprites.length === 0) {
    throw new Error(t("sprite.manager.content.error.empty_pack", "导入失败：立绘包缺少名称或立绘列表为空"));
  }
  const seen = /* @__PURE__ */ new Set();
  const sprites = [];
  for (const item of file.sprites) {
    if (!item || typeof item.tag !== "string") continue;
    const url = typeof item.data === "string" && item.data ? item.data : typeof item.url === "string" ? item.url : "";
    if (!url) continue;
    const tag = normalizeTag(item.tag);
    if (!tag) continue;
    const group = typeof item.group === "string" ? normalizeTag(item.group) : "";
    const outfit2 = typeof item.outfit === "string" ? normalizeTag(item.outfit) : "";
    const key = `${group}|${outfit2}|${tag}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const code = typeof item.code === "string" && item.code ? item.code : extractImageCode(url) ?? void 0;
    const remoteUrl = typeof item.remoteUrl === "string" && /^https?:\/\/.+/i.test(item.remoteUrl) ? item.remoteUrl : "";
    const labels = normalizeLabels(item.labels);
    sprites.push({
      tag,
      url,
      ...code ? { code } : {},
      ...remoteUrl ? { remoteUrl } : {},
      ...group ? { group } : {},
      ...outfit2 ? { outfit: outfit2 } : {},
      ...labels.length > 0 ? { labels } : {}
    });
  }
  if (sprites.length === 0) {
    throw new Error(t("sprite.manager.content.error.no_entries", "导入失败：没有可用的立绘条目（表情名可能全部为空或重复）"));
  }
  const normalizedCover = typeof file.coverTag === "string" ? normalizeTag(file.coverTag) : "";
  const coverTag = sprites.some((s) => s.tag === normalizedCover) ? normalizedCover : void 0;
  const roleName = typeof file.roleName === "string" ? normalizeTag(file.roleName) : "";
  const outfit = typeof file.outfit === "string" ? normalizeTag(file.outfit) : "";
  const kind = normalizePackKind(file.kind);
  const customTags = normalizeLabels(file.customTags);
  const promptNote = normalizeNote(file.promptNote);
  const inventoryPrompt = normalizeInventoryPrompt(file.inventoryPrompt);
  const outfitNotes = normalizeOutfitNotes(file.outfitNotes);
  const sourceStoryKey = typeof file.sourceStoryKey === "string" ? file.sourceStoryKey.trim() : "";
  return {
    id: genId(),
    name: sanitizePackName(file.name) || "导入立绘包",
    author: typeof file.author === "string" ? sanitizePackName(file.author) || void 0 : void 0,
    description: typeof file.description === "string" ? sanitizeDescription(file.description) || void 0 : void 0,
    ...roleName ? { roleName } : {},
    ...outfit ? { outfit } : {},
    ...kind ? { kind } : {},
    ...customTags.length > 0 ? { customTags } : {},
    ...promptNote ? { promptNote } : {},
    ...inventoryPrompt ? { inventoryPrompt } : {},
    ...file.promptNotePlacement === "before-list" || file.promptNotePlacement === "after-list" ? { promptNotePlacement: file.promptNotePlacement } : {},
    ...Object.keys(outfitNotes).length > 0 ? { outfitNotes } : {},
    ...sourceStoryKey ? { sourceStoryKey } : {},
    coverTag,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    sprites
  };
}
async function urlToDataUri(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(t("sprite.manager.content.error.image_fetch", "读取图片失败：{{url}}（HTTP {{status}}）", { url, status: res.status }));
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// core/pack-split.ts
function previewGroupSplit(pack) {
  const groups = /* @__PURE__ */ new Map();
  for (const s of pack.sprites) {
    const g = (s.group ?? "").trim();
    if (!g) continue;
    const arr = groups.get(g) ?? [];
    arr.push(s);
    groups.set(g, arr);
  }
  if (groups.size < 2) return [];
  return [...groups.entries()].map(([roleName, sprites]) => ({
    roleName,
    packName: sanitizePackName(`${pack.name}·${roleName}`) || roleName,
    count: sprites.length,
    tags: sprites.map((s) => s.tag)
  }));
}
function splitPackByGroup(pack) {
  const preview = previewGroupSplit(pack);
  if (preview.length === 0) return [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return preview.map((item) => {
    const sprites = pack.sprites.filter((s) => (s.group ?? "").trim() === item.roleName).map((s) => {
      const next = { ...s };
      delete next.group;
      return next;
    });
    return {
      id: genId(),
      name: item.packName,
      author: pack.author,
      ...pack.kind ? { kind: pack.kind } : {},
      ...pack.customTags?.length ? { customTags: [...pack.customTags] } : {},
      roleName: item.roleName,
      ...pack.outfit ? { outfit: pack.outfit } : {},
      sprites,
      updatedAt: now
    };
  });
}
function packNameFor(role, outfit, batchPackName) {
  if (role && outfit) return sanitizePackName(`${role}·${outfit}`) || `${role}·${outfit}`;
  if (role) return sanitizePackName(role) || role;
  return batchPackName;
}
function findPackFor(packs, role, outfit) {
  return packs.find(
    (p) => (p.roleName ?? "") === role && (p.outfit ?? "") === outfit && (role !== "" || outfit !== "")
  ) ?? null;
}
function autoRenameTag(taken, desired) {
  if (!taken.has(desired)) return desired;
  for (let i = 2; i < 1e3; i++) {
    const candidate = `${desired}_${i}`.slice(0, 20);
    if (!taken.has(candidate)) return candidate;
  }
  return `${desired}_${Date.now().toString(36)}`;
}
function planUploads(entries, packs, strategy, batchPackName, defaultPack) {
  const takenByPack = /* @__PURE__ */ new Map();
  const newPackKey = (role, outfit, name) => `new:${role}|${outfit}|${name}`;
  const keyTaken = (key, pack) => {
    let set = takenByPack.get(key);
    if (!set) {
      set = new Set(pack ? pack.sprites.map((s) => s.tag) : []);
      takenByPack.set(key, set);
    }
    return set;
  };
  const plans = [];
  for (const entry of entries) {
    const role = normalizeTag(entry.role);
    const outfit = normalizeTag(entry.outfit);
    const tag = normalizeTag(entry.tag);
    const roleless = !role && !outfit;
    const existing = roleless ? defaultPack ?? null : findPackFor(packs, role, outfit);
    const packName = existing ? existing.name : packNameFor(role, outfit, batchPackName);
    const key = existing ? `pack:${existing.id}` : newPackKey(role, outfit, packName);
    const taken = keyTaken(key, existing);
    const conflict = taken.has(tag);
    let finalTag = tag;
    let action = "add";
    if (conflict) {
      if (strategy === "skip") {
        action = "skip";
      } else if (strategy === "overwrite") {
        action = "overwrite";
      } else {
        finalTag = autoRenameTag(taken, tag);
        action = "add";
      }
    }
    if (action !== "skip") taken.add(finalTag);
    plans.push({
      entry: { fileName: entry.fileName, role, outfit, tag },
      targetPackId: existing?.id ?? null,
      targetPackName: packName,
      conflict,
      finalTag,
      action
    });
  }
  return plans;
}

// core/imgbb.ts
function isValidImgbbResult(result) {
  if (!result.url || !/^https:\/\/.+/i.test(result.url)) return false;
  if (!result.code) return false;
  return /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/.test(result.code) && !result.code.includes("..");
}
async function uploadToImgbb(apiKey, base64DataUri, fetchImpl = fetch) {
  const key = apiKey.trim();
  if (!key) throw new Error(t("galleryErrors.imgbb_key", "未配置 imgbb API Key"));
  const rawBase64 = base64DataUri.replace(/^data:[^;]*;base64,/, "");
  const form = new FormData();
  form.append("key", key);
  form.append("image", rawBase64);
  const res = await fetchImpl("https://api.imgbb.com/1/upload", { method: "POST", body: form });
  const json = await res.json().catch(() => null);
  if (!json?.success || !json.data?.image) {
    throw new Error(t("galleryErrors.imgbb_upload", "imgbb 上传失败：{{error}}", { error: json?.error?.message ?? `HTTP ${res.status}` }));
  }
  const result = { url: json.data.url ?? "", code: json.data.image.filename ?? "" };
  if (!isValidImgbbResult(result)) {
    throw new Error(t("galleryErrors.imgbb_response", "imgbb 返回无效：缺少合法的 HTTPS 直链或文件名"));
  }
  return result;
}

// core/sprite-resources.ts
function isCloudUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}
function hasLocalResource(sprite) {
  return !isCloudUrl(sprite.url);
}
function hasCloudResource(sprite) {
  return isCloudUrl(sprite.url) || isCloudUrl(sprite.remoteUrl);
}
function summarizePackResources(pack) {
  let local = 0;
  let cloud = 0;
  for (const sprite of pack.sprites) {
    if (hasLocalResource(sprite)) local += 1;
    if (hasCloudResource(sprite)) cloud += 1;
  }
  return { total: pack.sprites.length, local, cloud };
}

// core/preset-overrides.ts
function getCurrentPreset(presetId) {
  if (!isPresetPack(presetId)) return void 0;
  return getPresetPacks().find((preset) => preset.id === presetId);
}
function withSanitizedOverride(settings, presetId, rawOverride) {
  const sanitized = sanitizePresetOverrides({ [presetId]: rawOverride })[presetId];
  const presetOverrides = { ...settings.presetOverrides };
  if (sanitized) presetOverrides[presetId] = sanitized;
  else delete presetOverrides[presetId];
  const materialized = mergePresetPacks(presetOverrides).find((preset) => preset.id === presetId);
  return {
    ...settings,
    presetOverrides,
    packs: materialized ? settings.packs.map((pack) => pack.id === presetId ? materialized : pack) : settings.packs
  };
}
function setPresetLocalSprite(settings, presetId, sourceSprite, localUrl) {
  const preset = getCurrentPreset(presetId);
  if (!preset || typeof localUrl !== "string" || !isSafeLocalUserImagePath(localUrl)) {
    return settings;
  }
  const sourceKey = presetSpriteKey(sourceSprite);
  if (!preset.sprites.some((sprite) => presetSpriteKey(sprite) === sourceKey)) return settings;
  const existing = settings.presetOverrides[presetId] ?? {};
  return withSanitizedOverride(settings, presetId, {
    ...existing,
    localSprites: {
      ...existing.localSprites,
      [sourceKey]: localUrl
    }
  });
}
function setPresetMetadata(settings, presetId, metadata) {
  if (!getCurrentPreset(presetId)) return settings;
  const existing = settings.presetOverrides[presetId] ?? {};
  return withSanitizedOverride(settings, presetId, {
    ...existing,
    metadata
  });
}
function clearPresetMetadata(settings, presetId) {
  if (!getCurrentPreset(presetId)) return settings;
  const existing = settings.presetOverrides[presetId];
  if (!existing?.metadata) return settings;
  const { metadata: _metadata, ...rest } = existing;
  const presetOverrides = { ...settings.presetOverrides };
  if (Object.keys(rest).length > 0) presetOverrides[presetId] = rest;
  else delete presetOverrides[presetId];
  const materialized = mergePresetPacks(presetOverrides).find((preset) => preset.id === presetId);
  return {
    ...settings,
    presetOverrides,
    packs: materialized ? settings.packs.map((pack) => pack.id === presetId ? materialized : pack) : settings.packs
  };
}

// st-extension/src/sprite-actions.ts
function current(context) {
  const pack = context.getPack();
  const sprite = context.getSprite();
  return pack && sprite ? { pack, sprite } : null;
}
function commitAndRefresh(context, pack) {
  try {
    context.commit(pack);
  } finally {
    context.refresh();
  }
}
function createSpriteActions(context) {
  const source = context.getSprite();
  return [
    {
      id: "rename",
      label: t("sprite.manager.content.action.rename", "重命名"),
      icon: "✎",
      run() {
        const state2 = current(context);
        if (!state2) return;
        const next = window.prompt(t("sprite.manager.content.action.rename_prompt", "「{{p0}}」改名为：", { p0: state2.sprite.tag }), state2.sprite.tag);
        if (next === null) return;
        commitAndRefresh(
          context,
          renameSprite(
            state2.pack,
            state2.sprite.tag,
            next,
            spriteGroup(state2.sprite),
            state2.sprite.outfit ?? ""
          )
        );
      }
    },
    {
      id: "labels",
      label: t("sprite.manager.content.action.labels", "标签"),
      icon: "#",
      run() {
        const state2 = current(context);
        if (!state2) return;
        const raw = window.prompt(
          t("sprite.manager.content.action.labels_prompt", "「{{p0}}」的标签（逗号分隔，留空=清除）：", { p0: state2.sprite.tag }),
          state2.sprite.labels?.join(", ") ?? ""
        );
        if (raw === null) return;
        const labels = normalizeLabels(raw.split(/[,，]/));
        const nextSprite = { ...state2.sprite };
        if (labels.length > 0) nextSprite.labels = labels;
        else delete nextSprite.labels;
        commitAndRefresh(context, upsertSprite(state2.pack, nextSprite));
      }
    },
    {
      id: "group",
      label: t("sprite.manager.content.action.group", "设分组"),
      icon: "🏷",
      run() {
        const state2 = current(context);
        if (!state2) return;
        const group = spriteGroup(state2.sprite);
        const next = window.prompt(t("sprite.manager.content.action.group_prompt", "「{{p0}}」的分组（留空=移出分组）：", { p0: state2.sprite.tag }), group);
        if (next === null) return;
        commitAndRefresh(
          context,
          setSpriteGroup(state2.pack, state2.sprite.tag, group, next, state2.sprite.outfit ?? "")
        );
      }
    },
    {
      id: "replace",
      label: t("sprite.manager.content.action.replace", "重新上传 / 替换图片"),
      icon: "🖼",
      run() {
        if (!current(context)) return;
        context.pickReplacement();
      }
    },
    {
      id: "localize",
      label: t("sprite.manager.content.action.localize", "保存到本地"),
      icon: "↓",
      hint: t("sprite.manager.content.action.localize_hint", "把图床上的图片下载成本地文件再引用，之后不再依赖外链。") + t("sprite.manager.content.action.preset_localize_hint", "预设包不会被改写，只记一条同 ID 的本地覆盖，随时可以删掉回到原图。"),
      // 预设包只读，但本地化是记覆盖而不是改包，所以只读态下也应当放行——
      // 这是预设立绘唯一的本地化入口。
      allowedInReadonly: true,
      disabled: !source || getSpriteSource(source) !== "hosted",
      async run() {
        const state2 = current(context);
        if (!state2 || getSpriteSource(state2.sprite) !== "hosted") return;
        await context.localize(state2.sprite);
      }
    },
    {
      id: "remote",
      label: t("sprite.manager.content.action.remote", "远程地址"),
      icon: "🔗",
      run() {
        const state2 = current(context);
        if (!state2) return;
        const remote = state2.sprite.remoteUrl || (getSpriteSource(state2.sprite) === "hosted" ? state2.sprite.url : "");
        if (!remote) {
          throw new Error(t("sprite.manager.content.action.no_remote", "「{{p0}}」还没有远程地址（未上传图床，分享时对方看不到）", { p0: state2.sprite.tag }));
        }
        window.prompt(
          t("sprite.manager.content.action.remote_prompt", "「{{p0}}」编号：{{p1}}\n远程地址（Ctrl+C 复制）：", { p0: state2.sprite.tag, p1: state2.sprite.code || t("sprite.manager.content.action.none", "无") }),
          remote
        );
      }
    },
    {
      id: "cover",
      label: t("sprite.manager.content.action.cover", "设为封面"),
      icon: "★",
      run() {
        const state2 = current(context);
        if (!state2) return;
        commitAndRefresh(context, { ...state2.pack, coverTag: state2.sprite.tag });
      }
    },
    {
      id: "delete",
      label: t("common.delete", "删除"),
      icon: "✕",
      destructive: true,
      run() {
        const state2 = current(context);
        if (!state2 || !window.confirm(t("sprite.manager.content.action.confirm_delete", "删除立绘「{{p0}}」？", { p0: state2.sprite.tag }))) return;
        const next = removeSprite(
          state2.pack,
          state2.sprite.tag,
          spriteGroup(state2.sprite),
          state2.sprite.outfit ?? ""
        );
        context.commit(next);
        if (next.sprites.length === 0) context.close();
        else context.refresh();
      }
    }
  ];
}

// st-extension/src/sprite-lightbox.ts
function openSpriteLightbox(options) {
  let currentPack = options.pack;
  let currentIndex = clampIndex(options.index, currentPack.sprites.length);
  let currentActions = options.actions;
  let closed = false;
  let focus = null;
  const layer = element("div", "so-lightbox");
  layer.setAttribute("role", "dialog");
  layer.setAttribute("aria-modal", "true");
  layer.setAttribute("aria-label", t("lightbox.title", "立绘预览"));
  layer.dataset.readonly = String(options.readonly);
  const stage = element("div", "so-lightbox-stage");
  const image = document.createElement("img");
  image.className = "so-lightbox-image";
  const caption = element("div", "so-lightbox-caption");
  caption.setAttribute("role", "status");
  caption.setAttribute("aria-atomic", "true");
  const previous = control("◀", t("lightbox.previous", "上一张（← 方向键）"), "so-lightbox-nav so-lightbox-prev");
  const next = control("▶", t("lightbox.next", "下一张（→ 方向键）"), "so-lightbox-nav so-lightbox-next");
  const closeButton = control("✕", t("lightbox.close", "关闭（Esc）"), "so-lightbox-close");
  const actionRail = element("div", "so-lightbox-actions");
  actionRail.setAttribute("role", "group");
  actionRail.setAttribute("aria-label", t("lightbox.actions", "立绘操作"));
  stage.append(image);
  layer.append(stage, caption, previous, next, closeButton, actionRail);
  const visualViewport = window.visualViewport;
  const applyViewport = () => {
    const left = visualViewport?.offsetLeft ?? 0;
    const top = visualViewport?.offsetTop ?? 0;
    const width = visualViewport?.width ?? window.innerWidth;
    const height = visualViewport?.height ?? window.innerHeight;
    layer.style.left = `${left}px`;
    layer.style.top = `${top}px`;
    layer.style.width = `${width}px`;
    layer.style.height = `${height}px`;
  };
  const renderActions = () => {
    const active = document.activeElement;
    const activeAction = active instanceof HTMLElement && actionRail.contains(active) ? active.dataset.actionId : void 0;
    actionRail.replaceChildren();
    const visibleActions = options.readonly ? currentActions.filter((action) => action.allowedInReadonly) : currentActions;
    const hidden = visibleActions.length === 0;
    actionRail.hidden = hidden;
    layer.classList.toggle("so-lightbox-no-actions", hidden);
    for (const action of visibleActions) {
      const button2 = document.createElement("button");
      button2.type = "button";
      button2.className = "so-lightbox-action";
      button2.dataset.actionId = action.id;
      button2.disabled = Boolean(action.disabled);
      if (action.destructive) button2.classList.add("so-lightbox-action-danger");
      if (action.icon) {
        const icon = element("span", "so-lightbox-action-icon");
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = action.icon;
        button2.append(icon);
      }
      const label = element("span", "so-lightbox-action-label");
      label.textContent = action.label;
      button2.append(label);
      if (action.hint) button2.title = action.hint;
      button2.addEventListener("click", (event) => {
        event.stopPropagation();
        if (button2.disabled) return;
        try {
          void Promise.resolve(action.run()).catch((error) => {
            console.error("[sprite-overlay] 立绘操作失败", error);
          });
        } catch (error) {
          console.error("[sprite-overlay] 立绘操作失败", error);
        }
      });
      actionRail.append(button2);
    }
    if (activeAction && focus?.isTop()) {
      const replacement = Array.from(actionRail.querySelectorAll("button")).find((button2) => button2.dataset.actionId === activeAction && !button2.disabled);
      if (replacement) replacement.focus({ preventScroll: true });
      else focus.focusInitial();
    }
  };
  const render2 = () => {
    const sprite = currentPack.sprites[currentIndex];
    if (sprite) {
      image.src = sprite.url;
      image.alt = sprite.tag;
      caption.textContent = t("lightbox.caption", "{{tag}}（{{index}}/{{count}}）", {
        tag: sprite.tag,
        index: currentIndex + 1,
        count: currentPack.sprites.length
      });
    } else {
      image.removeAttribute("src");
      image.alt = "";
      caption.textContent = "";
    }
    const hasMultiple = currentPack.sprites.length > 1;
    previous.disabled = !hasMultiple;
    next.disabled = !hasMultiple;
    renderActions();
  };
  const navigate = (delta) => {
    const count = currentPack.sprites.length;
    if (closed || count === 0) return;
    currentIndex = (currentIndex + delta + count) % count;
    render2();
    options.onNavigate(currentIndex);
  };
  const close = () => {
    if (closed) return;
    closed = true;
    focus?.dispose();
    document.removeEventListener("keydown", onKeyDown, true);
    if (visualViewport) {
      visualViewport.removeEventListener("resize", applyViewport);
      visualViewport.removeEventListener("scroll", applyViewport);
    } else {
      window.removeEventListener("resize", applyViewport);
    }
    layer.remove();
    try {
      options.onClose();
    } finally {
      focus?.restoreFocus();
    }
  };
  const onKeyDown = (event) => {
    if (!focus?.isTop() || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]")) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      navigate(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      navigate(1);
    }
  };
  previous.addEventListener("click", (event) => {
    event.stopPropagation();
    navigate(-1);
  });
  next.addEventListener("click", (event) => {
    event.stopPropagation();
    navigate(1);
  });
  closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    close();
  });
  image.addEventListener("click", (event) => {
    event.stopPropagation();
    if (currentPack.sprites.length < 2) return;
    const rect = image.getBoundingClientRect();
    navigate(event.clientX < rect.left + rect.width / 2 ? -1 : 1);
  });
  layer.addEventListener("click", (event) => {
    if (event.target === layer || event.target === stage) close();
  });
  document.addEventListener("keydown", onKeyDown, true);
  if (visualViewport) {
    visualViewport.addEventListener("resize", applyViewport);
    visualViewport.addEventListener("scroll", applyViewport);
  } else {
    window.addEventListener("resize", applyViewport);
  }
  const controller = {
    update(pack, index, actions) {
      if (closed) return;
      currentPack = pack;
      currentIndex = clampIndex(index, pack.sprites.length);
      if (actions) currentActions = actions;
      render2();
    },
    close
  };
  applyViewport();
  render2();
  document.body.append(layer);
  focus = manageDialogFocus(layer, { onEscape: close });
  focus.focusInitial();
  return controller;
}
function clampIndex(index, count) {
  if (count === 0) return 0;
  return Math.max(0, Math.min(index, count - 1));
}
function element(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
function control(text4, label, className) {
  const button2 = document.createElement("button");
  button2.type = "button";
  button2.className = className;
  button2.textContent = text4;
  button2.title = label;
  button2.setAttribute("aria-label", label);
  return button2;
}

// st-extension/src/sprite-localize.ts
var LOCALIZE_MAX_BYTES = 20 * 1024 * 1024;
var LOCALIZE_TIMEOUT_MS = 3e4;
async function localizeSprite(sprite, fileName, deps) {
  if (getSpriteSource(sprite) !== "hosted") {
    throw new Error(t("galleryErrors.already_local", "这张立绘已经是本地图片"));
  }
  let response;
  try {
    response = await deps.fetch(sprite.url, requestInit());
  } catch (error) {
    throw new Error(t("galleryErrors.download", "下载远程图片失败：{{error}}", { error: downloadFailure(error) }), { cause: error });
  }
  if (!response.ok) {
    throw new Error(t("galleryErrors.download_http", "下载远程图片失败：HTTP {{status}}", { status: response.status }));
  }
  const declaredBytes = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > LOCALIZE_MAX_BYTES) {
    throw new Error(t("galleryErrors.size_limit", "远程图片过大，不能超过 {{limit}}", { limit: formatLimit() }));
  }
  let blob;
  try {
    blob = await response.blob();
  } catch (error) {
    throw new Error(t("galleryErrors.download", "下载远程图片失败：{{error}}", { error: downloadFailure(error) }), { cause: error });
  }
  if (blob.size > LOCALIZE_MAX_BYTES) {
    throw new Error(t("galleryErrors.size_limit", "远程图片过大，不能超过 {{limit}}", { limit: formatLimit() }));
  }
  if (!blob.type.startsWith("image/")) {
    throw new Error(t("galleryErrors.not_image", "远程地址没有返回图片"));
  }
  let compressed;
  try {
    compressed = await (deps.compress ?? compressImage)(blob);
  } catch (error) {
    throw new Error(t("galleryErrors.compress", "压缩远程图片失败：{{error}}", { error: errorMessage(error) }), { cause: error });
  }
  let localUrl;
  try {
    localUrl = await deps.saveImage(dataUriToFile(compressed.dataUri, fileName), fileName);
  } catch (error) {
    throw new Error(t("galleryErrors.save", "保存本地图片失败：{{error}}", { error: errorMessage(error) }), { cause: error });
  }
  const safeLocalUrl = localUserImagePath(localUrl);
  if (!safeLocalUrl) {
    throw new Error(t("galleryErrors.unsafe_local", "保存本地图片失败：平台未返回安全的本地用户图片地址"));
  }
  return { ...sprite, url: localUrl, remoteUrl: sprite.url };
}
function dataUriToFile(dataUri, fileName) {
  const match = /^data:(image\/[^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUri);
  if (!match) throw new Error(t("galleryErrors.compressed_data", "压缩后的图片数据格式不正确"));
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], fileName, { type: match[1] });
}
function errorMessage(error) {
  return error instanceof Error && error.message ? error.message : t("storage.unknown_error", "未知错误");
}
function downloadFailure(error) {
  const name = typeof error?.name === "string" ? error.name : "";
  return name === "TimeoutError" || name === "AbortError" ? t("galleryErrors.download_timeout", "超过 {{seconds}} 秒没有响应", { seconds: LOCALIZE_TIMEOUT_MS / 1e3 }) : errorMessage(error);
}
function requestInit() {
  return typeof AbortSignal?.timeout === "function" ? { signal: AbortSignal.timeout(LOCALIZE_TIMEOUT_MS) } : void 0;
}
function formatLimit() {
  return `${LOCALIZE_MAX_BYTES / 1024 / 1024} MB`;
}

// core/image-storage.ts
function imageRefKey(ref) {
  return JSON.stringify([ref.packId, ref.group, ref.outfit, ref.tag]);
}
function spriteImageRef(pack, sprite) {
  return {
    packId: pack.id,
    group: sprite.group ?? "",
    outfit: sprite.outfit ?? "",
    tag: sprite.tag
  };
}
function scanEmbeddedImages(settings) {
  const candidates = [];
  const byRef = /* @__PURE__ */ new Map();
  const uniqueUrls = /* @__PURE__ */ new Set();
  for (const pack of settings.packs) {
    if (isPresetPack(pack.id)) continue;
    for (const sprite of pack.sprites) {
      const ref = spriteImageRef(pack, sprite);
      const key = imageRefKey(ref);
      byRef.set(key, (byRef.get(key) ?? 0) + 1);
      if (!/^data:/i.test(sprite.url)) continue;
      uniqueUrls.add(sprite.url);
      candidates.push({ ref, sourceUrl: sprite.url });
    }
  }
  const encoder = new TextEncoder();
  return {
    candidates,
    ambiguous: candidates.filter((candidate) => (byRef.get(imageRefKey(candidate.ref)) ?? 0) > 1).map((candidate) => candidate.ref).filter((ref, index, refs) => refs.findIndex((item) => imageRefKey(item) === imageRefKey(ref)) === index),
    embeddedReferenceCount: candidates.length,
    uniqueEmbeddedCount: uniqueUrls.size,
    embeddedTextBytes: [...uniqueUrls].reduce((total, url) => total + encoder.encode(url).byteLength, 0)
  };
}
function applyImageChanges(latest, changes) {
  const changeCounts = /* @__PURE__ */ new Map();
  for (const change of changes) {
    const key = imageRefKey(change.ref);
    changeCounts.set(key, (changeCounts.get(key) ?? 0) + 1);
  }
  const targets = /* @__PURE__ */ new Map();
  for (const pack of latest.packs) {
    if (isPresetPack(pack.id)) continue;
    for (const sprite of pack.sprites) {
      const key = imageRefKey(spriteImageRef(pack, sprite));
      const list = targets.get(key) ?? [];
      list.push(sprite);
      targets.set(key, list);
    }
  }
  const accepted = /* @__PURE__ */ new Map();
  const conflicts = [];
  for (const change of changes) {
    const key = imageRefKey(change.ref);
    const matches = targets.get(key) ?? [];
    if (changeCounts.get(key) !== 1 || matches.length !== 1 || matches[0].url !== change.expectedUrl || !change.nextUrl) {
      conflicts.push(change);
    } else {
      accepted.set(key, change);
    }
  }
  if (accepted.size === 0) return { settings: latest, applied: [], conflicts };
  const packs = latest.packs.map((pack) => {
    if (isPresetPack(pack.id)) return pack;
    let changed = false;
    const sprites = pack.sprites.map((sprite) => {
      const change = accepted.get(imageRefKey(spriteImageRef(pack, sprite)));
      if (!change) return sprite;
      changed = true;
      return { ...sprite, url: change.nextUrl };
    });
    return changed ? { ...pack, sprites } : pack;
  });
  return { settings: { ...latest, packs }, applied: [...accepted.values()], conflicts };
}

// st-extension/src/image-storage.ts
async function stageEmbeddedImages(candidates, deps, options = {}) {
  const savedByUri = /* @__PURE__ */ new Map();
  const result = { ready: [], failed: [], unprocessed: [], cancelled: false };
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (options.signal?.aborted) {
      result.cancelled = true;
      result.unprocessed = candidates.slice(index);
      break;
    }
    try {
      let saved = savedByUri.get(candidate.sourceUrl);
      if (!saved) {
        saved = deps.save(candidate.sourceUrl, { signal: options.signal }).then((url) => {
          if (!localUserImagePath(url)) throw new Error(t("storage.errors.local_path_missing", "保存失败：平台未返回本地图片路径"));
          return url;
        });
        savedByUri.set(candidate.sourceUrl, saved);
      }
      const nextUrl = await saved;
      if (options.signal?.aborted) {
        result.cancelled = true;
        result.unprocessed = candidates.slice(index);
        result.ready = [];
        break;
      }
      result.ready.push({ ref: candidate.ref, expectedUrl: candidate.sourceUrl, nextUrl });
    } catch (error) {
      if (options.signal?.aborted) {
        result.cancelled = true;
        result.unprocessed = candidates.slice(index);
        result.ready = [];
        break;
      }
      result.failed.push({
        candidate,
        message: error instanceof Error ? error.message : t("storage.errors.save_failed", "保存失败")
      });
    }
    options.onProgress?.(index + 1, candidates.length);
    if (options.signal?.aborted) {
      result.cancelled = true;
      result.unprocessed = candidates.slice(index + 1);
      result.ready = [];
      break;
    }
  }
  return result;
}
async function prepareImportedPack(pack, deps, options = {}) {
  if (isPresetPack(pack.id)) throw new Error(t("storage.errors.preset_target", "内置预设不能作为导入目标"));
  if (options.signal?.aborted) throw new Error(t("storage.errors.import_cancelled", "内嵌图片准备未完成，图包未安装（已取消）"));
  const staging = {
    ...createDefaultSettings(),
    packs: [pack]
  };
  const scan = scanEmbeddedImages(staging);
  if (scan.ambiguous.length > 0) throw new Error(t("storage.errors.pack_duplicates", "图包包含重复图片身份，未安装"));
  if (scan.candidates.length === 0) return pack;
  const staged = await stageEmbeddedImages(scan.candidates, deps, options);
  if (staged.cancelled || staged.failed.length > 0 || staged.unprocessed.length > 0) {
    throw new Error(t("storage.errors.prepare_failed", "内嵌图片准备未完成，图包未安装（失败 {{count}}）", { count: staged.failed.length }));
  }
  const applied = applyImageChanges(staging, staged.ready);
  const prepared = applied.settings.packs[0];
  if (!prepared || applied.conflicts.length > 0 || prepared.sprites.some((sprite) => /^data:/i.test(sprite.url))) {
    throw new Error(t("storage.errors.pack_unsaved", "图包仍有未落盘图片，未安装"));
  }
  return prepared;
}

// core/image-storage-backup.ts
function validId(value) {
  return typeof value === "string" && /^[0-9a-f]{32}$/i.test(value);
}
function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function hasFields(value, fields) {
  const record = object(value);
  return !!record && fields.every((key) => Object.hasOwn(record, key));
}
function preservesFields(original, normalized) {
  if (original === normalized) return true;
  if (Array.isArray(original)) {
    return Array.isArray(normalized) && original.length === normalized.length && original.every((value, index) => preservesFields(value, normalized[index]));
  }
  const record = object(original);
  const next = object(normalized);
  return !!record && !!next && Object.keys(record).every((key) => Object.hasOwn(next, key) && preservesFields(record[key], next[key]));
}
function findUnmappedEmbeddedImages(rawSettings, settings) {
  const raw = object(rawSettings);
  if (!raw) return [];
  const validRefs = new Map(scanEmbeddedImages(settings).candidates.map((item) => [imageRefKey(item.ref), item.sourceUrl]));
  const result = [];
  const rawPacks = Array.isArray(raw.packs) ? raw.packs : [];
  rawPacks.forEach((rawPack, packIndex) => {
    const pack = object(rawPack);
    const sprites = pack && Array.isArray(pack.sprites) ? pack.sprites : [];
    sprites.forEach((rawSprite, spriteIndex) => {
      const sprite = object(rawSprite);
      if (typeof sprite?.url !== "string" || !/^data:/i.test(sprite.url)) return;
      const ref = {
        packId: typeof pack?.id === "string" ? pack.id : "",
        group: typeof sprite.group === "string" ? sprite.group : "",
        outfit: typeof sprite.outfit === "string" ? sprite.outfit : "",
        tag: typeof sprite.tag === "string" ? sprite.tag : ""
      };
      if (isPresetPack(ref.packId) || validRefs.get(imageRefKey(ref)) !== sprite.url) {
        result.push({ location: "packs[" + packIndex + "].sprites[" + spriteIndex + "].url", value: sprite.url });
      }
    });
  });
  const overrides = object(raw.presetOverrides);
  for (const [presetId, rawOverride] of Object.entries(overrides ?? {})) {
    const localSprites = object(object(rawOverride)?.localSprites);
    for (const [key, value] of Object.entries(localSprites ?? {})) {
      if (typeof value === "string" && /^data:/i.test(value)) {
        result.push({ location: "presetOverrides." + presetId + ".localSprites." + key, value });
      }
    }
  }
  return result;
}
function createStorageBackup(settings, rawSettings, backupId, createdAt) {
  if (!validId(backupId)) throw new Error(t("storage.errors.backup_id", "备份 ID 不合法"));
  if (!createdAt) throw new Error(t("storage.errors.backup_time", "备份时间不合法"));
  const persisted = { ...settings, packs: settings.packs.filter((pack) => !isPresetPack(pack.id)) };
  const backup = { format: "st-stage-storage-backup@1", backupId, createdAt, settings: persisted, unmappedEmbedded: findUnmappedEmbeddedImages(rawSettings, persisted) };
  return JSON.parse(JSON.stringify(backup));
}
function parseStorageBackup(text4) {
  let parsed;
  try {
    parsed = JSON.parse(text4);
  } catch (error) {
    throw new Error(t("storage.errors.backup_json", "存储备份不是有效 JSON"), { cause: error });
  }
  const raw = object(parsed);
  if (!raw || raw.format !== "st-stage-storage-backup@1" || !validId(raw.backupId) || typeof raw.createdAt !== "string" || !raw.createdAt || !Array.isArray(raw.unmappedEmbedded)) throw new Error(t("storage.errors.backup_format", "存储备份格式或版本不支持"));
  if (raw.unmappedEmbedded.some((item) => {
    const entry = object(item);
    return typeof entry?.location !== "string" || typeof entry.value !== "string" || !/^data:/i.test(entry.value);
  })) throw new Error(t("storage.errors.backup_appendix", "存储备份附录不合法"));
  const rawSettings = object(raw.settings);
  const defaults = createDefaultSettings();
  if (!rawSettings || !Array.isArray(rawSettings.packs) || rawSettings.settingsVersion !== SETTINGS_VERSION || !hasFields(rawSettings, Object.keys(defaults)) || !hasFields(rawSettings.overlay, Object.keys(defaults.overlay)) || !hasFields(rawSettings.phone, Object.keys(defaults.phone)) || !Array.isArray(rawSettings.bindings) || rawSettings.bindings.some((binding) => !hasFields(binding, ["characterName", "packIds", "enabled"]))) {
    throw new Error(t("storage.errors.backup_settings", "存储备份设置不合法"));
  }
  const settings = migrateSettings(rawSettings);
  if (settings.packs.some((pack) => isPresetPack(pack.id)) || !preservesFields(rawSettings, settings)) {
    throw new Error(t("storage.errors.backup_settings", "存储备份设置不合法"));
  }
  const packIds = /* @__PURE__ */ new Set();
  const refs = /* @__PURE__ */ new Set();
  for (const pack of settings.packs) {
    if (packIds.has(pack.id)) throw new Error(t("storage.errors.backup_duplicates", "存储备份包含重复图片身份"));
    packIds.add(pack.id);
    for (const sprite of pack.sprites) {
      const key = imageRefKey(spriteImageRef(pack, sprite));
      if (refs.has(key)) throw new Error(t("storage.errors.backup_duplicates", "存储备份包含重复图片身份"));
      refs.add(key);
    }
  }
  return { format: "st-stage-storage-backup@1", backupId: raw.backupId, createdAt: raw.createdAt, settings: rawSettings, unmappedEmbedded: raw.unmappedEmbedded };
}
function assertLocalUrl(url) {
  const normalized = localUserImagePath(url);
  const hasControl = Array.from(url).some((char) => char.charCodeAt(0) < 32);
  if (!normalized || !url.startsWith("/user/images/") || /[?#\\]/.test(url) || hasControl || /%(?:2f|5c)/i.test(url) || normalized.endsWith("/") || normalized.includes("//")) {
    throw new Error(t("storage.errors.receipt_path", "迁移回执包含不安全的本地图片路径"));
  }
  return url;
}
function createMigrationReceipt(backup, ready) {
  const scan = scanEmbeddedImages(backup.settings);
  if (scan.ambiguous.length > 0) throw new Error(t("storage.errors.receipt_mismatch", "迁移回执与备份不匹配"));
  const sourceByRef = new Map(scan.candidates.map((item) => [imageRefKey(item.ref), item]));
  const keys = /* @__PURE__ */ new Set();
  const entries = ready.map((change) => {
    const key = imageRefKey(change.ref);
    const source = sourceByRef.get(key);
    if (keys.has(key)) throw new Error(t("storage.errors.receipt_duplicates", "迁移回执包含重复图片身份"));
    if (!source || source.sourceUrl !== change.expectedUrl) throw new Error(t("storage.errors.receipt_mismatch", "迁移回执与备份不匹配"));
    keys.add(key);
    return { ref: change.ref, localUrl: assertLocalUrl(change.nextUrl) };
  });
  return { format: "st-stage-image-migration-receipt@1", backupId: backup.backupId, entries };
}
function parseMigrationReceipt(text4, backup) {
  let parsed;
  try {
    parsed = JSON.parse(text4);
  } catch (error) {
    throw new Error(t("storage.errors.receipt_json", "迁移回执不是有效 JSON"), { cause: error });
  }
  const raw = object(parsed);
  if (!raw || raw.format !== "st-stage-image-migration-receipt@1" || raw.backupId !== backup.backupId || !Array.isArray(raw.entries)) throw new Error(t("storage.errors.receipt_mismatch", "迁移回执与备份不匹配"));
  const scan = scanEmbeddedImages(backup.settings);
  if (scan.ambiguous.length > 0) throw new Error(t("storage.errors.receipt_mismatch", "迁移回执与备份不匹配"));
  const sourceByRef = new Map(scan.candidates.map((item) => [imageRefKey(item.ref), item]));
  const keys = /* @__PURE__ */ new Set();
  const entries = raw.entries.map((item) => {
    const entry = object(item);
    const ref = object(entry?.ref);
    if (!ref || typeof ref.packId !== "string" || typeof ref.group !== "string" || typeof ref.outfit !== "string" || typeof ref.tag !== "string" || typeof entry?.localUrl !== "string") throw new Error(t("storage.errors.receipt_entry", "迁移回执条目不合法"));
    const normalized = { packId: ref.packId, group: ref.group, outfit: ref.outfit, tag: ref.tag };
    const key = imageRefKey(normalized);
    if (keys.has(key) || !sourceByRef.has(key)) throw new Error(t("storage.errors.receipt_mismatch", "迁移回执与备份不匹配"));
    keys.add(key);
    assertLocalUrl(entry.localUrl);
    return { ref: normalized, localUrl: entry.localUrl };
  });
  return { format: "st-stage-image-migration-receipt@1", backupId: backup.backupId, entries };
}
function restoreMigratedImages(latest, backup, receipt) {
  if (receipt.backupId !== backup.backupId) throw new Error(t("storage.errors.receipt_mismatch", "迁移回执与备份不匹配"));
  if (receipt.format !== "st-stage-image-migration-receipt@1") throw new Error(t("storage.errors.receipt_format", "迁移回执格式不支持"));
  const scan = scanEmbeddedImages(backup.settings);
  if (scan.ambiguous.length > 0) throw new Error(t("storage.errors.receipt_mismatch", "迁移回执与备份不匹配"));
  const sourceByRef = new Map(scan.candidates.map((item) => [imageRefKey(item.ref), item]));
  const keys = /* @__PURE__ */ new Set();
  const changes = receipt.entries.map((entry) => {
    const key = imageRefKey(entry.ref);
    const source = sourceByRef.get(imageRefKey(entry.ref));
    if (keys.has(key) || !source) throw new Error(t("storage.errors.receipt_mismatch", "迁移回执与备份不匹配"));
    keys.add(key);
    const localUrl = assertLocalUrl(entry.localUrl);
    return { ref: entry.ref, expectedUrl: localUrl, nextUrl: source.sourceUrl };
  });
  return applyImageChanges(latest, changes);
}

// st-extension/src/image-storage-dialog.ts
function sameCandidates(left, right) {
  if (left.ambiguous.length || right.ambiguous.length || left.candidates.length !== right.candidates.length) return false;
  const sources = new Map(left.candidates.map((item) => [imageRefKey(item.ref), item.sourceUrl]));
  return right.candidates.every((item) => sources.get(imageRefKey(item.ref)) === item.sourceUrl);
}
function actionButton(label, action) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "menu_button so-btn";
  node.textContent = label;
  node.addEventListener("click", action);
  return node;
}
function randomId() {
  const bytes = new Uint8Array(16);
  if (!globalThis.crypto?.getRandomValues) throw new Error(t("storage.errors.random_backup", "当前环境不支持安全随机备份 ID"));
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function downloadJson(name, value, onDisposed) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  let timer;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.clearTimeout(timer);
    URL.revokeObjectURL(url);
    onDisposed();
  };
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.append(link);
  try {
    link.click();
    timer = window.setTimeout(dispose, 6e4);
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  } finally {
    link.remove();
  }
}
function openImageStorageDialog(deps) {
  let phase = "inspect";
  let backup = null;
  let staged = [];
  let receipt = null;
  let backupDownloaded = false;
  let receiptDownloaded = false;
  let controller = null;
  let runToken = 0;
  let restoreSource = null;
  const downloads = /* @__PURE__ */ new Set();
  let scan = scanEmbeddedImages(deps.getSettings());
  function download(name, data) {
    let dispose = () => {
    };
    dispose = downloadJson(name, data, () => downloads.delete(dispose));
    downloads.add(dispose);
  }
  const backdrop = document.createElement("div");
  backdrop.className = "so-storage-backdrop";
  const dialog = document.createElement("section");
  dialog.className = "so-storage-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", t("storage.title", "存储检查与迁移"));
  dialog.tabIndex = -1;
  const heading = document.createElement("h3");
  heading.textContent = t("storage.title", "存储检查与迁移");
  const summary = document.createElement("div");
  summary.textContent = t("storage.summary", "发现 {{refs}} 个内嵌图片引用，{{images}} 张不同图片，约 {{bytes}} 字节文本", { refs: scan.embeddedReferenceCount, images: scan.uniqueEmbeddedCount, bytes: scan.embeddedTextBytes });
  const status = document.createElement("div");
  status.className = "so-storage-status";
  status.setAttribute("role", "status");
  const privacy = document.createElement("p");
  privacy.className = "so-storage-warning";
  privacy.textContent = t("storage.privacy", "备份可能包含私人提示词和 API Key，仅保存在自己的设备，不要公开上传。");
  const progress = document.createElement("progress");
  progress.setAttribute("aria-label", t("storage.progress_label", "图片上传校验进度"));
  const errors = document.createElement("ul");
  errors.className = "so-storage-errors";
  const controls = document.createElement("div");
  controls.className = "so-storage-actions";
  const confirmBackup = document.createElement("input");
  confirmBackup.type = "checkbox";
  const confirmLabel = document.createElement("label");
  confirmLabel.append(confirmBackup, document.createTextNode(t("storage.confirm_backup", "我已确认备份文件已保存在本机")));
  const backupButton = actionButton(t("storage.download_backup", "下载当前插件状态备份"), () => {
    if (phase !== "inspect" && phase !== "restore-ready") return;
    invalidateBackup();
    try {
      scan = scanEmbeddedImages(deps.getSettings());
      backup = createStorageBackup(
        deps.getSettings(),
        deps.adapter.getStoredSettingsForBackup(),
        randomId(),
        (/* @__PURE__ */ new Date()).toISOString()
      );
      download("sprite-overlay-storage-backup-" + backup.backupId + ".json", backup);
      backupDownloaded = true;
      status.textContent = scan.ambiguous.length > 0 || backup.unmappedEmbedded.length > 0 ? t("storage.backup_unmapped", "备份已下载，但存在未能唯一映射的内嵌图片，不能自动迁移。请先整理为明确的自定义图包后重新下载备份。") : t("storage.backup_downloaded", "备份下载请求已完成，请确认文件已保存后开始迁移。");
    } catch (error) {
      invalidateBackup();
      status.textContent = error instanceof Error ? error.message : t("storage.backup_failed", "备份失败");
    }
    render2();
  });
  const startButton = actionButton(t("storage.start", "开始迁移内嵌图片"), () => {
    void stage();
  });
  const receiptConfirmation = document.createElement("input");
  receiptConfirmation.type = "checkbox";
  receiptConfirmation.dataset.confirm = "receipt";
  const receiptLabel = document.createElement("label");
  receiptLabel.append(receiptConfirmation, document.createTextNode(t("storage.confirm_receipt", "我已确认迁移回执已保存在本机")));
  const receiptButton = actionButton(t("storage.download_receipt", "下载迁移回执"), () => {
    if (!receipt || phase !== "staged") return;
    receiptDownloaded = false;
    receiptConfirmation.checked = false;
    try {
      download("sprite-overlay-image-migration-receipt-" + receipt.backupId + ".json", receipt);
      receiptDownloaded = true;
      status.textContent = t("storage.receipt_downloaded", "回执下载请求已完成，请确认文件已保存后应用成功项。");
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : t("storage.receipt_failed", "回执下载失败");
    }
    render2();
  });
  const applyButton = actionButton(t("storage.apply", "确认应用成功项"), () => {
    if (!receipt || !receiptDownloaded || !receiptConfirmation.checked || phase !== "staged") return;
    const result = applyImageChanges(deps.getSettings(), staged);
    finishApply(result, t("storage.applied_action", "应用"));
  });
  const cancelButton = actionButton(t("storage.cancel", "取消暂存"), () => {
    if (phase !== "staging") return;
    ++runToken;
    controller?.abort();
    controller = null;
    reset();
    status.textContent = t("storage.cancelled", "暂存已取消，原设置未改变；已上传的新文件未自动删除。");
  });
  const retryButton = actionButton(t("storage.recheck", "重新检查"), () => reset());
  const restorePanel = document.createElement("details");
  restorePanel.className = "so-storage-restore";
  const restoreHeading = document.createElement("summary");
  restoreHeading.textContent = t("storage.restore_title", "恢复迁移前图片");
  const restoreWarning = document.createElement("p");
  restoreWarning.className = "so-storage-warning";
  restoreWarning.textContent = t("storage.restore_warning", "恢复会重新写入内嵌图片，增大 settings。仅回退仍与回执匹配的图片，其他设置和后续编辑不变。");
  function fileInput(label) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => {
      if (phase === "closed" || phase === "staging" || phase === "staged" || phase === "applied") return;
      ++runToken;
      phase = "inspect";
      restoreSource = null;
      invalidateBackup();
      render2();
    });
    const field = document.createElement("label");
    field.className = "so-storage-file";
    field.append(document.createTextNode(label), input);
    restorePanel.append(field);
    return input;
  }
  restorePanel.append(restoreHeading, restoreWarning);
  const restoreBackup = fileInput(t("storage.backup_file", "迁移前备份"));
  const restoreReceipt = fileInput(t("storage.receipt_file", "迁移回执"));
  const inspectRestoreButton = actionButton(t("storage.inspect_restore", "检查恢复文件"), () => {
    void inspectRestore();
  });
  const restoreButton = actionButton(t("storage.restore", "确认恢复图片"), () => {
    if (phase !== "restore-ready" || !restoreSource || !backupDownloaded || !confirmBackup.checked) return;
    const result = restoreMigratedImages(deps.getSettings(), restoreSource.backup, restoreSource.receipt);
    finishApply(result, t("storage.restored_action", "恢复"));
  });
  restorePanel.append(inspectRestoreButton, restoreButton);
  function finishApply(result, action) {
    if (!checkRawImages()) return;
    phase = "applied";
    try {
      if (result.applied.length > 0) deps.updateSettings(result.settings);
      status.textContent = t("storage.finished", "已{{action}} {{count}} 项，冲突 {{conflicts}} 项未修改。{{notice}}", { action, count: result.applied.length, conflicts: result.conflicts.length, notice: result.applied.length ? t("storage.save_requested", "宿主已请求保存，请重载后复查。") : t("storage.unchanged", "原设置未改变。") });
    } catch (error) {
      status.textContent = t("storage.update_failed", "设置更新或界面刷新失败，请保留备份和回执，重载后复查：{{error}}", { error: error instanceof Error ? error.message : t("storage.unknown_error", "未知错误") });
    }
    staged = [];
    receipt = null;
    restoreSource = null;
    backup = null;
    render2();
  }
  const closeButton = actionButton(t("common.close", "关闭"), () => close());
  controls.append(backupButton, confirmLabel, startButton, cancelButton, receiptButton, receiptLabel, applyButton, retryButton);
  const footer = document.createElement("div");
  footer.className = "so-storage-footer";
  footer.append(closeButton);
  dialog.append(heading, summary, privacy, status, progress, errors, controls, restorePanel, footer);
  backdrop.append(dialog);
  document.body.append(backdrop);
  const focus = manageDialogFocus(dialog, { onEscape: close, layer: backdrop });
  function invalidateBackup() {
    backup = null;
    backupDownloaded = false;
    confirmBackup.checked = false;
    staged = [];
    receipt = null;
    receiptDownloaded = false;
    receiptConfirmation.checked = false;
  }
  function reset() {
    if (phase === "closed") return;
    ++runToken;
    phase = "inspect";
    invalidateBackup();
    restoreSource = null;
    scan = scanEmbeddedImages(deps.getSettings());
    errors.replaceChildren();
    status.textContent = "";
    render2();
  }
  function checkRawImages() {
    if (!findUnmappedEmbeddedImages(deps.adapter.getStoredSettingsForBackup(), deps.getSettings()).length) return true;
    reset();
    status.textContent = t("storage.raw_unmapped", "当前原始设置有未能映射的内嵌图片，操作已停止。请重新下载备份并整理图片后再继续。");
    return false;
  }
  function render2() {
    if (phase === "closed") return;
    summary.textContent = t("storage.summary", "发现 {{refs}} 个内嵌图片引用，{{images}} 张不同图片，约 {{bytes}} 字节文本", { refs: scan.embeddedReferenceCount, images: scan.uniqueEmbeddedCount, bytes: scan.embeddedTextBytes });
    startButton.disabled = !backupDownloaded || !confirmBackup.checked || scan.candidates.length === 0 || scan.ambiguous.length > 0 || (backup?.unmappedEmbedded.length ?? 0) > 0 || phase !== "inspect";
    receiptButton.disabled = !receipt || phase !== "staged";
    applyButton.disabled = !receipt || !receiptDownloaded || !receiptConfirmation.checked || phase !== "staged";
    backupButton.disabled = phase !== "inspect" && phase !== "restore-ready";
    confirmBackup.disabled = !backupDownloaded || phase !== "inspect" && phase !== "restore-ready";
    receiptConfirmation.disabled = !receiptDownloaded || phase !== "staged";
    receiptLabel.hidden = phase !== "staged";
    receiptButton.hidden = applyButton.hidden = phase !== "staged";
    cancelButton.hidden = phase !== "staging";
    progress.hidden = phase !== "staging";
    retryButton.disabled = phase === "staging" || phase === "restore-reading";
    inspectRestoreButton.disabled = phase !== "inspect" || !restoreBackup.files?.length || !restoreReceipt.files?.length;
    restoreBackup.disabled = restoreReceipt.disabled = phase !== "inspect";
    restoreButton.disabled = phase !== "restore-ready" || !restoreSource || !backupDownloaded || !confirmBackup.checked;
  }
  async function inspectRestore() {
    const backupFile = restoreBackup.files?.[0];
    const receiptFile = restoreReceipt.files?.[0];
    if (phase !== "inspect" || !backupFile || !receiptFile) return;
    const token = ++runToken;
    phase = "restore-reading";
    invalidateBackup();
    render2();
    try {
      const sourceBackup = parseStorageBackup(await backupFile.text());
      if (token !== runToken) return;
      const sourceReceipt = parseMigrationReceipt(await receiptFile.text(), sourceBackup);
      if (token !== runToken) return;
      const result = restoreMigratedImages(deps.getSettings(), sourceBackup, sourceReceipt);
      restoreSource = { backup: sourceBackup, receipt: sourceReceipt };
      phase = "restore-ready";
      restoreButton.hidden = false;
      status.textContent = t("storage.restore_ready", "可恢复 {{count}} 项，冲突 {{conflicts}} 项。请先下载并确认当前插件状态备份。", { count: result.applied.length, conflicts: result.conflicts.length });
    } catch (error) {
      if (token !== runToken) return;
      phase = "inspect";
      restoreSource = null;
      status.textContent = error instanceof Error ? error.message : t("storage.restore_invalid", "恢复文件校验失败");
    }
    render2();
  }
  async function stage() {
    if (!backup || !backupDownloaded || !confirmBackup.checked || phase !== "inspect" || scan.ambiguous.length || backup.unmappedEmbedded.length || !scan.candidates.length) return;
    if (!checkRawImages()) return;
    const latestScan = scanEmbeddedImages(deps.getSettings());
    if (!sameCandidates(scanEmbeddedImages(backup.settings), latestScan)) {
      scan = latestScan;
      invalidateBackup();
      status.textContent = t("storage.settings_changed", "备份后设置已变化，请重新下载备份并扫描后再迁移。");
      render2();
      return;
    }
    phase = "staging";
    const token = ++runToken;
    const sourceBackup = backup;
    const runController = new AbortController();
    controller = runController;
    errors.replaceChildren();
    progress.max = scan.candidates.length;
    progress.value = 0;
    render2();
    try {
      parseStorageBackup(JSON.stringify(sourceBackup));
      const result = await stageEmbeddedImages(scan.candidates, {
        save: (dataUri, options) => deps.saveDataUri(dataUri, options)
      }, { signal: runController.signal, onProgress: (completed, total) => {
        if (token !== runToken) return;
        progress.value = completed;
        status.textContent = t("storage.progress", "校验进度 {{completed}}/{{total}}", { completed, total });
      } });
      if (token !== runToken || runController.signal.aborted || result.cancelled) return;
      staged = result.ready;
      receipt = staged.length ? createMigrationReceipt(sourceBackup, staged) : null;
      phase = staged.length ? "staged" : "inspect";
      for (const failure of result.failed) {
        const item = document.createElement("li");
        item.textContent = t("storage.item_error", "{{tag}}：{{message}}", { tag: failure.candidate.ref.tag, message: failure.message });
        errors.append(item);
      }
      status.textContent = t("storage.stage_result", "{{status}}：成功 {{ready}} 项，失败 {{failed}} 项，未处理 {{unprocessed}} 项，未支持 {{unsupported}} 项。原设置未改变。", { status: staged.length ? t("storage.staged", "暂存完成") : t("storage.not_migrated", "迁移未完成"), ready: staged.length, failed: result.failed.length, unprocessed: result.unprocessed.length, unsupported: sourceBackup.unmappedEmbedded.length });
    } catch (error) {
      if (token === runToken && !runController.signal.aborted) {
        status.textContent = error instanceof Error ? error.message : t("storage.migration_failed", "迁移失败，原设置未改变");
        phase = "inspect";
      }
    } finally {
      if (controller === runController) controller = null;
      render2();
    }
  }
  function close() {
    if (phase === "closed") return;
    phase = "closed";
    focus.dispose();
    ++runToken;
    controller?.abort();
    controller = null;
    for (const dispose of downloads) dispose();
    downloads.clear();
    backup = null;
    staged = [];
    receipt = null;
    restoreSource = null;
    scan = { candidates: [], ambiguous: [], embeddedReferenceCount: 0, uniqueEmbeddedCount: 0, embeddedTextBytes: 0 };
    backdrop.remove();
    try {
      deps.onClosed();
    } finally {
      focus.restoreFocus();
    }
  }
  confirmBackup.addEventListener("change", render2);
  receiptConfirmation.addEventListener("change", render2);
  dialog.addEventListener("keydown", (event) => {
    event.stopPropagation();
  });
  render2();
  focus.focusInitial();
  return { close };
}

// st-extension/src/sprite-manager.ts
var SPRITE_PAGE_SIZE = 60;
var managerControlId = 0;
var nextManagerId = () => `so-manager-control-${++managerControlId}`;
function createSpriteManager(deps) {
  let backdrop = null;
  let destroyed = false;
  let view = { kind: "list" };
  let spriteVisibleCount = SPRITE_PAGE_SIZE;
  let spriteFilterQuery = "";
  let spriteFilterLabels = [];
  let packFilterQuery = "";
  let packFilterRole = "";
  let packFilterKind = "";
  let packFilterTag = "";
  let expandedRoleGroupKey = "";
  const openSections = /* @__PURE__ */ new Map();
  let enableListOpen = false;
  let enableListDocHandler = null;
  let batchMode = false;
  const selectedPackIds = /* @__PURE__ */ new Set();
  let batchResourceBusy = false;
  let openedFrom = "overlay";
  let activeLightbox = null;
  let storageDialog = null;
  let importController = null;
  let dialogFocus = null;
  const childDialogs = /* @__PURE__ */ new Set();
  const popoverListeners = /* @__PURE__ */ new Set();
  let popoverOpener = null;
  function applyBackdropSize() {
    if (!backdrop) return;
    backdrop.style.left = "0";
    backdrop.style.top = "0";
    backdrop.style.width = `${window.innerWidth}px`;
    backdrop.style.height = `${window.innerHeight}px`;
  }
  function open(source = "overlay") {
    if (destroyed) return;
    openedFrom = source;
    if (backdrop) {
      render2();
      return;
    }
    view = { kind: "list" };
    spriteVisibleCount = SPRITE_PAGE_SIZE;
    spriteFilterQuery = "";
    spriteFilterLabels = [];
    packFilterQuery = "";
    packFilterRole = "";
    packFilterKind = "";
    packFilterTag = "";
    expandedRoleGroupKey = "";
    openSections.clear();
    enableListOpen = false;
    batchMode = false;
    selectedPackIds.clear();
    backdrop = el3("div", "so-manager-backdrop");
    window.addEventListener("resize", applyBackdropSize);
    applyBackdropSize();
    const dialog = el3("div", "so-manager");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", t("sprite.manager.title", "立绘包管理"));
    const header = el3("div", "so-manager-header");
    const backBtn = el3("div", "menu_button so-manager-back");
    backBtn.title = t("sprite.manager.back", "返回列表");
    backBtn.setAttribute("aria-label", backBtn.title);
    backBtn.textContent = "‹";
    backBtn.setAttribute("role", "button");
    backBtn.tabIndex = 0;
    const goBack = () => returnToList();
    backBtn.addEventListener("click", goBack);
    backBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        goBack();
      }
    });
    const title2 = el3("b", "so-manager-title");
    const actions = el3("div", "so-manager-actions");
    const closeBtn = el3("div", "menu_button so-manager-close");
    closeBtn.title = t("common.close", "关闭");
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("role", "button");
    closeBtn.setAttribute("aria-label", closeBtn.title);
    closeBtn.tabIndex = 0;
    closeBtn.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    });
    closeBtn.addEventListener("click", () => close());
    header.append(backBtn, title2, actions, closeBtn);
    const body = el3("div", "so-manager-body");
    dialog.append(header, body);
    backdrop.append(dialog);
    document.body.append(backdrop);
    dialogFocus = manageDialogFocus(dialog, { onEscape, layer: backdrop });
    render2();
    dialogFocus.focusInitial();
  }
  function onEscape() {
    if (backdrop?.querySelector(".so-popover")) {
      const opener = popoverOpener ?? backdrop.querySelector(".so-enable-btn");
      closeEnableList();
      closePopovers();
      opener?.focus();
      return;
    }
    if (view.kind === "pack") {
      returnToList();
    } else {
      close();
    }
  }
  function close() {
    if (!backdrop) return;
    activeLightbox?.controller?.close();
    closeEnableList();
    closePopovers();
    importController?.abort();
    importController = null;
    storageDialog?.close();
    storageDialog = null;
    for (const closeChild of [...childDialogs].reverse()) closeChild();
    const focus = dialogFocus;
    dialogFocus = null;
    focus?.dispose();
    window.removeEventListener("resize", applyBackdropSize);
    backdrop.remove();
    backdrop = null;
    deps.onClosed?.(openedFrom);
    focus?.restoreFocus();
  }
  function returnToList() {
    const packId = view.kind === "pack" ? view.packId : null;
    view = { kind: "list" };
    render2();
    const origin = [...backdrop?.querySelectorAll(".so-pack-card") ?? []].find((card) => card.dataset.managerFocus === `pack:${packId}`);
    if (origin) origin.focus({ preventScroll: true });
    else dialogFocus?.focusInitial();
  }
  function manageChildDialog(modal, canEscape = () => true, opener) {
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    const closeChild = () => {
      focus.dispose();
      childDialogs.delete(closeChild);
      modal.remove();
      focus.restoreFocus();
    };
    const focus = manageDialogFocus(modal, { opener, onEscape: () => {
      if (canEscape()) closeChild();
    } });
    childDialogs.add(closeChild);
    focus.focusInitial();
    return closeChild;
  }
  function refreshIfOpen() {
    if (backdrop) {
      render2();
      refreshLightbox();
    }
  }
  function commit(next) {
    deps.updateSettings(next);
    render2();
    refreshLightbox();
  }
  function conflictText(conflicts) {
    return conflicts.slice(0, 3).map(
      (conflict) => `${conflict.characterName}：${conflict.formattedAddress}（${conflict.owners.map((owner) => owner.packName).join(" / ")}）`
    ).join("；");
  }
  function showConflicts(conflicts) {
    const message = t("sprite.manager.content.conflict.address", "操作未生效，存在地址冲突：{{p0}}", { p0: conflictText(conflicts) });
    const body = backdrop?.querySelector(".so-manager-body");
    if (body) toast(body, message);
    else window.alert(message);
  }
  function rejectConflicts(conflicts) {
    render2();
    showConflicts(conflicts);
    return false;
  }
  function checkedSettings(result) {
    if (!result.ok) {
      showConflicts(result.conflicts);
      return null;
    }
    return result.settings;
  }
  function updateChecked(result) {
    const next = checkedSettings(result);
    if (!next) return false;
    deps.updateSettings(next);
    return true;
  }
  function commitChecked(result) {
    if (!result.ok) return rejectConflicts(result.conflicts);
    commit(result.settings);
    return true;
  }
  function rejectPackMergeError(error, body) {
    if (error instanceof PackMergeChoiceError) {
      toast(body, t("sprite.manager.content.merge.invalid", "合并已取消：选择无效（{{p0}}）", { p0: error.message }));
      return null;
    }
    console.error("合并立绘包失败", error);
    toast(body, t("sprite.manager.content.merge.failed", "合并失败，请查看控制台日志"));
    return null;
  }
  function mergeWithPrompts(packs, defaultName, body) {
    const preview = previewPackMerge(packs);
    const choices = [];
    for (const conflict of preview.conflicts) {
      const options = conflict.candidates.map((candidate, index) => `${index + 1}. ${candidate.sourcePackName} — ${candidate.sprite.url}`).join("\n");
      const raw = window.prompt(
        t("sprite.manager.content.merge.choose_image", "地址「{{p0}}」有不同图片，请输入要保留的序号：\n{{p1}}", { p0: formatAddress(conflict.address), p1: options }),
        "1"
      );
      if (raw === null) return null;
      choices.push({ key: conflict.key, candidateIndex: Number(raw) - 1 });
    }
    try {
      validatePackMergeChoices(packs, choices);
    } catch (error) {
      return rejectPackMergeError(error, body);
    }
    const rawName = window.prompt(t("sprite.manager.content.merge.name", "合并结果的包名："), defaultName);
    if (rawName === null) return null;
    const name = sanitizePackName(rawName);
    if (!name) {
      toast(body, t("sprite.manager.content.merge.empty_name", "合并已取消：包名不能为空"));
      return null;
    }
    try {
      return applyPackMerge(packs, choices, { id: genId(), name });
    } catch (error) {
      return rejectPackMergeError(error, body);
    }
  }
  function installImportedPack(pack, body) {
    const settings = deps.getSettings();
    const related = settings.packs.filter((existing) => {
      const inspection = inspectPackImport(existing, pack);
      return inspection.sameName || inspection.conflicts.length > 0;
    });
    if (related.length === 0) {
      if (!updateChecked(upsertPack(settings, pack))) return false;
      toast(body, t("sprite.manager.content.import.installed", "已导入立绘包「{{p0}}」（{{p1}} 张）", { p0: pack.name, p1: pack.sprites.length }));
      return true;
    }
    const answer = window.prompt(
      t("sprite.manager.content.import.overlap", "检测到同名或地址重叠：{{p0}}\n", { p0: related.map((item) => item.name).join("、") }) + t("sprite.manager.content.import.choices", "输入 1 合并进现有包，2 重命名后安装，3 仅安装（之后可按需启用）；其他输入取消。"),
      "1"
    );
    if (answer === "1") {
      const target = related[0];
      const mode = window.prompt(
        t("sprite.manager.content.merge.destination", "合并到哪里？\n1 并入旧包「{{p0}}」（推荐：角色绑定不变，重叠源包移除）\n2 合并为新包（所有源包保留）\n其他输入取消。", { p0: target.name }),
        "1"
      );
      if (mode === "1") {
        const merged = mergeWithPrompts([...related, pack], target.name, body);
        if (!merged) return false;
        let next = settings;
        for (const other of related.slice(1)) next = removePack(next, other.id);
        if (!updateChecked(upsertPack(next, { ...merged, id: target.id }))) return false;
        toast(body, t("sprite.manager.content.merge.into_existing", "已合并进「{{p0}}」（{{p1}} 张）", { p0: merged.name, p1: merged.sprites.length }));
        return true;
      }
      if (mode === "2") {
        const merged = mergeWithPrompts([...related, pack], `${target.name} 合并`, body);
        if (!merged || !updateChecked(upsertPack(settings, merged))) return false;
        toast(body, t("sprite.manager.content.merge.created", "已生成合并包「{{p0}}」（{{p1}} 张），源包仍保留", { p0: merged.name, p1: merged.sprites.length }));
        return true;
      }
      return false;
    }
    if (answer === "2") {
      const rawName = window.prompt(t("sprite.manager.content.import.new_name", "请输入新的包名："), `${pack.name} 新`);
      if (rawName === null) return false;
      const name = sanitizePackName(rawName);
      if (!name || settings.packs.some((existing) => existing.name === name)) {
        toast(body, t("sprite.manager.content.import.invalid_name", "未安装：新包名为空或仍与现有包同名"));
        return false;
      }
      if (!updateChecked(upsertPack(settings, { ...pack, name }))) return false;
      toast(body, t("sprite.manager.content.import.renamed", "已重命名并安装「{{p0}}」（未启用）", { p0: name }));
      return true;
    }
    if (answer === "3") {
      if (!updateChecked(upsertPack(settings, pack))) return false;
      toast(body, t("sprite.manager.content.import.not_enabled", "已安装「{{p0}}」，未加入当前角色", { p0: pack.name }));
      return true;
    }
    return false;
  }
  async function prepareAndInstall(pack, body) {
    if (destroyed || !backdrop || currentManagerBody() !== body) return;
    if (storageDialog) {
      toast(body, t("sprite.manager.content.import.close_storage", "请先关闭存储检查与迁移窗口"));
      return;
    }
    if (importController) {
      toast(body, t("sprite.manager.content.import.busy", "已有导入任务正在处理"));
      return;
    }
    const controller = new AbortController();
    importController = controller;
    try {
      toast(body, t("sprite.manager.content.import.preparing", "正在准备导入图片"));
      const prepared = await prepareImportedPack(pack, {
        save: (dataUri, options) => deps.saveDataUri ? deps.saveDataUri(dataUri, options) : deps.adapter.saveDataUri(dataUri, options)
      }, {
        signal: controller.signal,
        onProgress: (completed, total) => {
          if (!destroyed && !controller.signal.aborted && currentManagerBody() === body) {
            toast(body, t("sprite.manager.content.import.progress", "导入图片校验 {{p0}}/{{p1}}", { p0: completed, p1: total }));
          }
        }
      });
      if (destroyed || controller.signal.aborted || !backdrop) return;
      const activeBody = currentManagerBody();
      if (!activeBody || activeBody !== body) return;
      if (!installImportedPack(prepared, activeBody)) return;
      const installed = deps.getSettings().packs.find((item) => item.id === prepared.id);
      if (installed) view = { kind: "pack", packId: installed.id };
      render2();
    } catch (error) {
      if (!controller.signal.aborted && !destroyed) toast(body, error instanceof Error ? error.message : t("sprite.manager.content.import.failed", "导入失败"));
    } finally {
      if (importController === controller) importController = null;
    }
  }
  function bindPackWithChoices(characterName, packId, body) {
    const settings = deps.getSettings();
    const result = bindPack(settings, characterName, packId);
    if (result.ok) {
      const changes = previewBindingAddressChanges(settings, result.settings, characterName);
      if (changes.removed.length > 0 && !window.confirm(
        t("sprite.manager.content.binding.address_changes", "启用后以下旧地址将变化：{{p0}}\n", { p0: changes.removed.slice(0, 6).join("、") }) + t("sprite.manager.content.binding.new_addresses", "新地址示例：{{p0}}\n仍要继续吗？", { p0: changes.added.slice(0, 6).join("、") })
      )) return;
      commit(result.settings);
      return;
    }
    const answer = window.prompt(
      t("sprite.manager.content.binding.conflict", "启用会产生地址冲突：{{p0}}\n", { p0: conflictText(result.conflicts) }) + t("sprite.manager.content.binding.choices", "输入 1 替换当前冲突包，2 合并为新包后启用；其他输入取消。"),
      "1"
    );
    const sourceIds = new Set(result.conflicts.flatMap((conflict) => conflict.owners.map((owner) => owner.packId)));
    sourceIds.add(packId);
    const binding = settings.bindings.find((item) => item.characterName === characterName);
    const boundIds = binding?.packIds ?? [];
    if (answer === "1") {
      sourceIds.delete(packId);
      const nextIds = boundIds.filter((id) => !sourceIds.has(id));
      if (!nextIds.includes(packId)) nextIds.push(packId);
      commitChecked(setBinding(settings, characterName, nextIds));
      return;
    }
    if (answer === "2") {
      const sources = settings.packs.filter((candidate) => sourceIds.has(candidate.id));
      const incoming = settings.packs.find((candidate) => candidate.id === packId);
      const merged = mergeWithPrompts(sources, incoming ? `${incoming.name} 合并` : "合并立绘包", body);
      if (!merged) return;
      const installed = upsertPack(settings, merged);
      if (!installed.ok) {
        rejectConflicts(installed.conflicts);
        return;
      }
      const nextIds = boundIds.filter((id) => !sourceIds.has(id));
      nextIds.push(merged.id);
      const rebound = setBinding(installed.settings, characterName, nextIds);
      if (!rebound.ok) {
        rejectConflicts(rebound.conflicts);
        return;
      }
      commit(rebound.settings);
      toast(body, t("sprite.manager.content.binding.merged", "已生成并启用合并包「{{p0}}」；源包仍保留", { p0: merged.name }));
    }
  }
  function commitPack(pack) {
    commitChecked(upsertPack(deps.getSettings(), pack));
  }
  function closePopovers() {
    for (const dispose of popoverListeners) dispose();
    popoverListeners.clear();
    backdrop?.querySelectorAll(".so-popover").forEach((n) => n.remove());
    backdrop?.querySelectorAll('[aria-haspopup="dialog"]').forEach((node) => node.setAttribute("aria-expanded", "false"));
    popoverOpener = null;
  }
  function closeEnableList() {
    enableListOpen = false;
    backdrop?.querySelector(".so-enable-btn")?.setAttribute("aria-expanded", "false");
    backdrop?.querySelectorAll('.so-popover[data-pop="启用包"]').forEach((n) => n.remove());
    if (enableListDocHandler) {
      document.removeEventListener("click", enableListDocHandler, true);
      enableListDocHandler = null;
    }
  }
  function renderEnableList() {
    const header = backdrop?.querySelector(".so-manager-header");
    if (!header) return;
    const previousPanel = header.querySelector(".so-enable-pop");
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusKey = active && previousPanel?.contains(active) ? active.dataset.managerFocus : void 0;
    header.querySelectorAll('.so-popover[data-pop="启用包"]').forEach((n) => n.remove());
    if (!enableListOpen) return;
    const characterName = deps.adapter.getCurrentCharacterName();
    if (!characterName) {
      closeEnableList();
      return;
    }
    const body = backdrop?.querySelector(".so-manager-body");
    const settings = deps.getSettings();
    const boundIds = settings.bindings.find((b) => b.characterName === characterName)?.packIds ?? [];
    const panel = el3("div", "so-popover so-enable-pop");
    const trigger = backdrop?.querySelector(".so-enable-btn");
    panel.id = trigger?.getAttribute("aria-controls") || nextManagerId();
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", trigger?.getAttribute("aria-label") ?? "");
    trigger?.setAttribute("aria-expanded", "true");
    panel.dataset.pop = "启用包";
    const heading = el3("div", "so-popover-title");
    heading.textContent = t("sprite.manager.content.binding.enable_heading", "勾选启用（{{p0}}，即时生效）", { p0: characterName });
    panel.append(heading);
    if (settings.packs.length === 0) {
      const tip = el3("div", "so-status");
      tip.textContent = t("sprite.manager.content.empty.packs", "还没有立绘包，先用「新建」或「导入」。");
      panel.append(tip);
    }
    for (const p of settings.packs) {
      const row = checkboxRow(t("sprite.manager.content.pack.image_count", "{{p0}}（{{p1}} 张）", { p0: p.name, p1: p.sprites.length }), boundIds.includes(p.id), (v) => {
        if (v) bindPackWithChoices(characterName, p.id, body);
        else commit(unbindPack(deps.getSettings(), characterName, p.id));
        renderEnableList();
      });
      row.querySelector("input").dataset.managerFocus = `enable:${p.id}`;
      panel.append(row);
    }
    header.append(panel);
    if (focusKey) {
      [...panel.querySelectorAll("[data-manager-focus]")].find((node) => node.dataset.managerFocus === focusKey)?.focus({ preventScroll: true });
    } else if (active === trigger) {
      panel.querySelector("input")?.focus({ preventScroll: true });
    }
    if (!enableListDocHandler) {
      enableListDocHandler = (e) => {
        const current2 = backdrop?.querySelector('.so-popover[data-pop="启用包"]');
        const btn = backdrop?.querySelector(".so-enable-btn");
        if (current2?.contains(e.target) || btn?.contains(e.target)) return;
        closeEnableList();
      };
      document.addEventListener("click", enableListDocHandler, true);
    }
  }
  function dropdownButton(label, build) {
    const panelId = nextManagerId();
    const btn = button(`${label} ▾`, () => {
      const header = backdrop?.querySelector(".so-manager-header");
      if (!header) return;
      const existing = header.querySelector(`.so-popover[data-pop="${label}"]`);
      closeEnableList();
      closePopovers();
      if (existing) return;
      const panel = el3("div", "so-popover");
      panel.id = panelId;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", label);
      panel.dataset.pop = label;
      build(panel);
      panel.querySelectorAll("input, textarea").forEach((input) => {
        if (!input.getAttribute("aria-label") && input.placeholder) input.setAttribute("aria-label", input.placeholder);
      });
      header.append(panel);
      popoverOpener = btn;
      btn.setAttribute("aria-expanded", "true");
      panel.querySelector("input, textarea")?.focus();
      const onDocClick = (e) => {
        if (panel.contains(e.target) || btn.contains(e.target)) return;
        closePopovers();
      };
      document.addEventListener("click", onDocClick, true);
      popoverListeners.add(() => document.removeEventListener("click", onDocClick, true));
    });
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", panelId);
    return btn;
  }
  function render2() {
    if (!backdrop) return;
    const backBtn = backdrop.querySelector(".so-manager-back");
    const title2 = backdrop.querySelector(".so-manager-title");
    const actions = backdrop.querySelector(".so-manager-actions");
    const body = backdrop.querySelector(".so-manager-body");
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreAfterRender = Boolean(active && (body.contains(active) || actions.contains(active) || active.closest(".so-popover")));
    const focusKey = restoreAfterRender ? active?.dataset.managerFocus : void 0;
    body.innerHTML = "";
    actions.innerHTML = "";
    backdrop.querySelector(".so-manager")?.classList.toggle("so-manager-batch-mode", batchMode);
    closePopovers();
    try {
      if (view.kind === "pack") {
        const packId = view.packId;
        const pack = deps.getSettings().packs.find((p) => p.id === packId);
        if (pack) {
          backBtn.style.display = "inline-flex";
          title2.textContent = pack.name;
          renderPackDetail(body, actions, pack);
          return;
        }
        view = { kind: "list" };
      }
      backBtn.style.display = "none";
      title2.textContent = t("sprite.manager.title", "立绘包管理");
      renderList(body, actions);
    } catch (err) {
      console.error("[sprite-overlay] 管理弹窗渲染失败", err);
      const msg = el3("div", "so-status");
      msg.textContent = t("sprite.manager.content.error.render", "界面渲染出错：{{p0}}", { p0: err instanceof Error ? err.message : String(err) });
      body.append(msg);
    } finally {
      if (restoreAfterRender && dialogFocus?.isTop()) {
        const candidates = focusKey ? [...backdrop.querySelectorAll("[data-manager-focus]")].filter((node) => node.dataset.managerFocus === focusKey && !node.matches(":disabled")) : [];
        if (candidates.length === 1) candidates[0].focus({ preventScroll: true });
        else dialogFocus.focusInitial();
      }
    }
  }
  function collapsible(titleText, open2 = false, key = "") {
    const box = document.createElement("details");
    box.className = "so-section so-collapse";
    box.open = key ? openSections.get(key) ?? open2 : open2;
    if (key) box.addEventListener("toggle", () => openSections.set(key, box.open));
    const summary = document.createElement("summary");
    summary.className = "so-section-title";
    summary.textContent = titleText;
    const inner = el3("div", "so-collapse-body");
    box.append(summary, inner);
    return { box, body: inner };
  }
  function renderList(body, actions) {
    const settings = deps.getSettings();
    const filteredPacks = filterSpritePacks(settings.packs, {
      query: packFilterQuery,
      roles: packFilterRole ? [packFilterRole] : [],
      kinds: packFilterKind === "sprite" || packFilterKind === "illustration" ? [packFilterKind] : [],
      customTags: packFilterTag ? [packFilterTag] : []
    });
    const characterName = deps.adapter.getCurrentCharacterName();
    const binding = settings.bindings.find((b) => b.characterName === characterName);
    const boundIds = binding?.packIds ?? [];
    if (batchMode) {
      const selectedCount = selectedPackIds.size;
      const deletablePacks = settings.packs.filter(
        (pack) => selectedPackIds.has(pack.id) && !isPresetPack(pack.id)
      );
      actions.append(
        button(t("sprite.manager.content.batch.select_all", "全选"), () => {
          const all = filteredPacks;
          if (all.length > 0 && all.every((p) => selectedPackIds.has(p.id))) {
            selectedPackIds.clear();
          } else {
            selectedPackIds.clear();
            for (const p of all) selectedPackIds.add(p.id);
          }
          render2();
        }),
        button(t("sprite.manager.content.batch.upload", "上传云端（{{p0}}）", { p0: selectedCount }), () => {
          void uploadSelectedPacks();
        }),
        button(t("sprite.manager.content.batch.localize", "保存本地（{{p0}}）", { p0: selectedCount }), () => {
          void localizeSelectedPacks();
        }),
        button(t("sprite.manager.content.batch.share", "复制分享串（{{p0}}）", { p0: selectedCount }), () => {
          void copySelectedPackShares();
        }),
        button(t("sprite.manager.content.batch.delete", "删除所选（{{p0}}）", { p0: deletablePacks.length }), () => {
          if (deletablePacks.length === 0) {
            toast(body, selectedPackIds.size > 0 ? t("sprite.manager.content.batch.preset_hint", "预设包不可删除；可保存本地、上传云端或复制分享串") : t("sprite.manager.content.batch.delete_hint", "先点卡片勾选要删除的包"));
            return;
          }
          const names = deletablePacks.map((pack) => pack.name);
          const preview = names.slice(0, 8).join("、") + (names.length > 8 ? t("sprite.manager.content.batch.more", " 等 {{p0}} 个", { p0: names.length }) : "");
          const ids = deletablePacks.map((pack) => pack.id);
          void deletePacksWithChoice(ids, names, preview);
        }, "so-btn-danger"),
        button(t("sprite.manager.content.batch.done", "完成"), () => {
          batchMode = false;
          selectedPackIds.clear();
          render2();
        })
      );
    } else {
      if (characterName) {
        const enableBtn = button(
          boundIds.length > 0 ? t("sprite.manager.enabled_count", "启用包（{{count}}） ▾", { count: boundIds.length }) : t("sprite.manager.enable", "启用包 ▾"),
          () => {
            if (enableListOpen) {
              closeEnableList();
            } else {
              closePopovers();
              enableListOpen = true;
              renderEnableList();
            }
          }
        );
        enableBtn.classList.add("so-enable-btn");
        enableBtn.setAttribute("aria-haspopup", "dialog");
        enableBtn.setAttribute("aria-expanded", String(enableListOpen));
        enableBtn.setAttribute("aria-controls", nextManagerId());
        enableBtn.setAttribute("aria-label", t("sprite.manager.enable_for", "为「{{name}}」勾选启用立绘包", { name: characterName }));
        actions.append(enableBtn);
      }
      actions.append(
        button(t("sprite.manager.storage", "存储检查与迁移"), () => {
          if (importController) {
            toast(body, t("sprite.manager.content.import.busy", "已有导入任务正在处理"));
            return;
          }
          storageDialog?.close();
          storageDialog = openImageStorageDialog({
            adapter: deps.adapter,
            getSettings: deps.getSettings,
            updateSettings: deps.updateSettings,
            saveDataUri: deps.saveDataUri ?? ((dataUri, options) => deps.adapter.saveDataUri(dataUri, options)),
            onClosed: () => {
              storageDialog = null;
            }
          });
        }),
        dropdownButton(t("sprite.manager.new", "新建"), (panel) => {
          const heading = el3("div", "so-popover-title");
          heading.textContent = t("sprite.manager.new_title", "新建立绘包");
          const nameInput = textInput(t("sprite.manager.new_name", "输入新包名称…"));
          nameInput.maxLength = 40;
          const createBtn = button(t("sprite.manager.create", "创建"), () => {
            const name = sanitizePackName(nameInput.value);
            if (!name) {
              toast(body, t("sprite.manager.content.pack.invalid_name", "包名不能为空（| = @ < > 等符号会被剔除）"));
              return;
            }
            const pack = { id: genId(), name, author: "我", sprites: [] };
            if (!updateChecked(upsertPack(deps.getSettings(), pack))) return;
            view = { kind: "pack", packId: pack.id };
            render2();
          });
          nameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.isComposing) createBtn.click();
          });
          panel.append(heading, nameInput, createBtn);
        }),
        dropdownButton(t("sprite.manager.import", "导入"), (panel) => {
          const shareHeading = el3("div", "so-popover-title");
          shareHeading.textContent = t("sprite.manager.import_share", "从分享字符串导入");
          const shareInput = document.createElement("textarea");
          shareInput.className = "text_pole";
          shareInput.rows = 3;
          shareInput.placeholder = t("sprite.manager.share_placeholder", "粘贴 stpack2:/stpack1: 分享串…");
          const shareBtn = button(t("sprite.manager.import", "导入"), () => {
            if (!shareInput.value.trim()) return;
            try {
              const pack = decodeShareString(shareInput.value);
              void prepareAndInstall(pack, body);
            } catch (err) {
              toast(body, err instanceof Error ? err.message : t("sprite.manager.content.import.share_failed", "分享串解析失败"));
            }
          });
          const jsonHeading = el3("div", "so-popover-title");
          jsonHeading.textContent = t("sprite.manager.import_json", "从 JSON 文件导入");
          const jsonBtn = button(t("sprite.manager.choose_json", "选择 JSON 文件…"), () => {
            pickFile(".json,application/json", false, async (files) => {
              try {
                if (destroyed || currentManagerBody() !== body || !files[0]) return;
                const file = files[0];
                if (file.size > 2 * 1024 * 1024 && !window.confirm(
                  t("sprite.manager.content.import.large_json", "这个 JSON 有 {{p0}} MiB。读取会占用临时内存，内嵌图片需要逐张上传到酒馆本地文件。继续导入吗？", { p0: (file.size / 1024 / 1024).toFixed(1) })
                )) return;
                const text4 = await file.text();
                const pack = importPack(text4);
                void prepareAndInstall(pack, body);
              } catch (err) {
                toast(body, err instanceof Error ? err.message : t("sprite.manager.content.import.failed", "导入失败"));
              }
            });
          });
          panel.append(shareHeading, shareInput, shareBtn, jsonHeading, jsonBtn);
        })
      );
      if (settings.packs.length > 0) {
        actions.append(
          button(t("sprite.manager.tags", "标签管理"), () => openTagManager()),
          button(t("sprite.manager.batch", "批量管理"), () => {
            closeEnableList();
            batchMode = true;
            selectedPackIds.clear();
            render2();
          })
        );
      }
    }
    const strip = el3("div", "so-row so-bind-strip");
    if (characterName) {
      const label = el3("span", "so-bind-label");
      label.textContent = boundIds.length > 0 ? t("sprite.manager.content.binding.enabled", "{{p0}} · 已启用 {{p1}} 个：", { p0: characterName, p1: boundIds.length }) : t("sprite.manager.content.binding.none", "{{p0}} · 尚未启用立绘包（用右上角选择启用）", { p0: characterName });
      strip.append(label);
      boundIds.forEach((id, index) => {
        const pack = settings.packs.find((p) => p.id === id);
        const chip = el3("span", "so-chip");
        const name = el3("span", "so-chip-name");
        name.textContent = pack ? t("sprite.manager.content.binding.pack", "{{p0}}. {{p1}}（{{p2}} 张）", { p0: index + 1, p1: pack.name, p2: pack.sprites.length }) : t("sprite.manager.content.binding.deleted", "（已删除的包 {{p0}}）", { p0: id });
        chip.append(name);
        if (boundIds.length > 1) {
          chip.append(
            iconButton("◀", t("sprite.manager.content.binding.move_first", "前移（多包寻址优先级更高）"), () => {
              if (index > 0) commit(reorderBinding(deps.getSettings(), characterName, index, index - 1));
            }, "so-chip-btn"),
            iconButton("▶", t("sprite.manager.content.move_later", "后移"), () => {
              commit(reorderBinding(deps.getSettings(), characterName, index, index + 1));
            }, "so-chip-btn")
          );
        }
        chip.append(
          iconButton("✕", t("sprite.manager.content.binding.disable", "停用此包"), () => {
            commit(unbindPack(deps.getSettings(), characterName, id));
          }, "so-chip-btn")
        );
        strip.append(chip);
      });
      if (binding) {
        strip.append(
          el3("span", "so-spacer"),
          checkboxRow(
            t("sprite.manager.content.binding.enable_all", "全部启用"),
            binding.enabled,
            (v) => commitChecked(toggleBinding(deps.getSettings(), characterName, v))
          )
        );
      }
    } else {
      const tip = el3("span", "so-status");
      tip.textContent = t("sprite.manager.content.binding.open_chat", "请先打开一个角色聊天，再回来启用立绘包。");
      strip.append(tip);
    }
    body.append(strip);
    body.append(renderPackFilters(settings, filteredPacks.length));
    if (batchMode) {
      const tip = el3("div", "so-status so-batch-tip");
      tip.textContent = t("sprite.manager.content.batch.hint", "批量管理：先勾选图包，再统一设置类型或标签；资源操作和排序仍可在上方完成。预设包可保存本地或分享，但不可删除。");
      body.append(tip);
      body.append(renderBatchClassificationTools(body));
    }
    const useFold = settings.galleryFoldByRole && !batchMode;
    const grid = el3("div", useFold ? "so-pack-list-folded" : "so-pack-grid");
    const boundState = (pack) => boundIds.includes(pack.id) ? binding?.enabled ? "active" : "off" : null;
    if (useFold) {
      for (const group of groupPacksByRole(filteredPacks)) {
        if (group.packCount === 1) {
          grid.append(renderPackCard(group.packs[0], boundState(group.packs[0])));
          continue;
        }
        const section2 = el3("div", "so-role-pack-group");
        section2.dataset.roleKey = group.key;
        const expanded = expandedRoleGroupKey === group.key;
        const toggle = () => {
          expandedRoleGroupKey = expanded ? "" : group.key;
          render2();
        };
        if (expanded) {
          section2.classList.add("so-role-pack-group-expanded");
          const row = el3("button", "so-role-pack-row");
          row.type = "button";
          row.dataset.managerFocus = `role:${group.key}`;
          row.setAttribute("aria-expanded", "true");
          const title2 = el3("b");
          title2.textContent = group.role;
          const counts = el3("span");
          counts.textContent = t("sprite.manager.content.pack.counts", "{{p0}} 个图包 · {{p1}} 张", { p0: group.packCount, p1: group.spriteCount });
          const arrow = el3("span", "so-role-pack-arrow");
          arrow.textContent = "▾";
          row.append(title2, counts, arrow);
          row.addEventListener("click", toggle);
          addCardNavigation(row, ".so-pack-card, .so-role-pack-stack, .so-role-pack-row");
          const packs = el3("div", "so-role-pack-strip");
          packs.id = nextManagerId();
          row.setAttribute("aria-controls", packs.id);
          packs.setAttribute("aria-label", t("sprite.manager.content.pack.role_packs", "{{p0}}的图包", { p0: group.role }));
          for (const pack of group.packs) packs.append(renderPackCard(pack, boundState(pack)));
          section2.append(row, packs);
        } else {
          section2.append(renderRolePackStack(group.role, group.key, group.packs, group.spriteCount, boundState, toggle));
        }
        grid.append(section2);
      }
    } else {
      for (const pack of filteredPacks) grid.append(renderPackCard(pack, boundState(pack)));
    }
    body.append(grid);
    if (filteredPacks.length === 0) {
      const empty = el3("div", "so-status so-pack-filter-empty");
      empty.textContent = t("sprite.manager.content.empty.filtered_packs", "没有符合当前筛选条件的图包");
      body.append(empty);
    }
    body.append(statusBar());
    renderEnableList();
  }
  function renderPackFilters(settings, visibleCount) {
    const panel = el3("div", "so-pack-filters");
    const search = textInput(t("sprite.manager.content.filter.packs_placeholder", "搜索包名、角色、服装或标签"));
    search.classList.add("so-pack-filter-search");
    search.value = packFilterQuery;
    const applySearch = () => {
      packFilterQuery = search.value.trim();
      expandedRoleGroupKey = "";
      render2();
    };
    search.addEventListener("change", applySearch);
    search.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      applySearch();
    });
    const selectFilter = (className, options, current2, apply) => {
      const select = document.createElement("select");
      select.className = `text_pole ${className}`;
      select.dataset.managerFocus = className;
      select.setAttribute("aria-label", options[0]?.[1] ?? "");
      for (const [value, label] of options) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.append(option);
      }
      select.value = current2;
      select.addEventListener("change", () => {
        apply(select.value);
        expandedRoleGroupKey = "";
        render2();
      });
      return select;
    };
    const roles = normalizeLabels(settings.packs.map((pack) => pack.roleName?.trim() || "其他"));
    const tags = normalizeLabels(settings.packs.flatMap((pack) => pack.customTags ?? []));
    const role = selectFilter(
      "so-pack-filter-role",
      [["", t("sprite.manager.content.filter.all_roles", "全部角色")], ...roles.map((item) => [item, item === "其他" ? t("sprite.manager.content.group.other", "其他") : item])],
      packFilterRole,
      (value) => {
        packFilterRole = value;
      }
    );
    const kind = selectFilter(
      "so-pack-filter-kind",
      [["", t("sprite.manager.content.filter.all_types", "全部类型")], ["sprite", t("sprite.manager.content.kind.sprite", "立绘")], ["illustration", t("sprite.manager.content.kind.illustration", "插图")]],
      packFilterKind,
      (value) => {
        packFilterKind = value;
      }
    );
    const tag = selectFilter(
      "so-pack-filter-tag",
      [["", t("sprite.manager.content.filter.all_tags", "全部标签")], ...tags.map((item) => [item, item])],
      packFilterTag,
      (value) => {
        packFilterTag = value;
      }
    );
    const status = el3("span", "so-pack-filter-count");
    status.textContent = t("sprite.manager.content.filter.pack_count", "{{p0}}/{{p1}} 个图包", { p0: visibleCount, p1: settings.packs.length });
    panel.append(search, role, kind, tag, status);
    if (packFilterQuery || packFilterRole || packFilterKind || packFilterTag) {
      panel.append(button(t("sprite.manager.content.filter.clear", "清除筛选"), () => {
        packFilterQuery = packFilterRole = packFilterKind = packFilterTag = "";
        expandedRoleGroupKey = "";
        render2();
      }));
    }
    return panel;
  }
  function openTagManager() {
    const modal = el3("div", "so-upload-modal so-tag-manager");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-label", t("sprite.manager.content.tag.dialog_title", "图包标签管理"));
    const panel = el3("div", "so-upload-panel so-tag-manager-panel");
    const heading = el3("div", "so-tag-manager-heading");
    const title2 = el3("b");
    title2.textContent = t("sprite.manager.tags", "标签管理");
    heading.append(title2, button(t("common.close", "关闭"), () => closeModal()));
    const help = el3("div", "so-status");
    help.textContent = t("sprite.manager.content.tag.help", "角色和类型由图包信息自动生成，只能在包信息或批量管理中修改。这里管理自定义标签。");
    const settings = deps.getSettings();
    const addRow = el3("div", "so-row so-tag-manager-add");
    const packSelect = document.createElement("select");
    packSelect.className = "text_pole so-tag-manager-pack";
    for (const pack of settings.packs) {
      const option = document.createElement("option");
      option.value = pack.id;
      option.textContent = pack.name;
      packSelect.append(option);
    }
    const newTag = textInput(t("sprite.manager.content.tag.new_placeholder", "输入新标签"));
    newTag.classList.add("so-tag-manager-new");
    const commitTags = (next) => {
      closeModal();
      commit(persistSelectedPresetMetadata(next, next.packs.map((pack) => pack.id)));
    };
    addRow.append(
      labeled(t("sprite.manager.content.tag.add_to_pack", "添加到图包"), packSelect),
      labeled(t("sprite.manager.content.tag.new", "新标签"), newTag),
      button(t("sprite.manager.content.tag.add_to_pack", "添加到图包"), () => {
        const tag = normalizeLabels([newTag.value])[0];
        if (!packSelect.value || !tag) {
          toast(currentManagerBody(), t("sprite.manager.content.tag.select_pack", "请选择图包并输入标签"));
          return;
        }
        commitTags(addPackCustomTag(deps.getSettings(), [packSelect.value], tag));
      })
    );
    const list = el3("div", "so-tag-manager-list");
    const tags = normalizeLabels(settings.packs.flatMap((pack) => pack.customTags ?? []));
    if (tags.length === 0) {
      const empty = el3("div", "so-status");
      empty.textContent = t("sprite.manager.content.tag.empty", "还没有自定义标签");
      list.append(empty);
    }
    for (const tag of tags) {
      const row = el3("div", "so-tag-manager-row");
      row.dataset.tag = tag;
      const input = textInput(t("sprite.manager.content.tag.name", "标签名称"));
      input.value = tag;
      const count = settings.packs.filter((pack) => normalizeLabels(pack.customTags).includes(tag)).length;
      const usage = el3("span", "so-status");
      usage.textContent = t("sprite.manager.content.pack.count", "{{p0}} 个图包", { p0: count });
      row.append(
        input,
        usage,
        button(t("sprite.manager.content.action.rename", "重命名"), () => {
          const renamed = normalizeLabels([input.value])[0];
          if (!renamed) {
            toast(currentManagerBody(), t("sprite.manager.content.tag.empty_name", "标签名称不能为空"));
            return;
          }
          commitTags(renamePackCustomTag(deps.getSettings(), tag, renamed));
        }),
        button(t("common.delete", "删除"), () => {
          if (!window.confirm(t("sprite.manager.content.tag.confirm_delete", "从 {{p0}} 个图包删除标签「{{p1}}」吗？", { p0: count, p1: tag }))) return;
          commitTags(deletePackCustomTag(deps.getSettings(), tag));
        }, "so-btn-danger")
      );
      list.append(row);
    }
    panel.append(heading, help, addRow, list);
    modal.append(panel);
    (backdrop ?? document.body).append(modal);
    const closeModal = manageChildDialog(modal);
  }
  function selectedPacks() {
    return deps.getSettings().packs.filter((pack) => selectedPackIds.has(pack.id));
  }
  function persistSelectedPresetMetadata(settings, packIds) {
    let next = settings;
    for (const packId of packIds) {
      if (!isPresetPack(packId)) continue;
      const pack = next.packs.find((candidate) => candidate.id === packId);
      if (!pack) continue;
      const customTags = normalizeLabels(pack.customTags);
      next = setPresetMetadata(next, packId, {
        name: pack.name,
        author: pack.author ?? null,
        description: pack.description ?? null,
        roleName: pack.roleName ?? null,
        outfit: pack.outfit ?? null,
        promptNote: pack.promptNote ?? null,
        promptNotePlacement: pack.promptNotePlacement ?? null,
        outfitNotes: pack.outfitNotes ?? null,
        inventoryPrompt: pack.inventoryPrompt ?? null,
        kind: pack.kind ?? null,
        customTags: customTags.length > 0 ? customTags : null
      });
    }
    return next;
  }
  function renderBatchClassificationTools(body) {
    const panel = el3("div", "so-batch-classification");
    const ids = [...selectedPackIds];
    const kindSelect = document.createElement("select");
    kindSelect.className = "text_pole so-batch-kind-select";
    for (const [value, label] of [["sprite", t("sprite.manager.content.kind.sprite", "立绘")], ["illustration", t("sprite.manager.content.kind.illustration", "插图")]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      kindSelect.append(option);
    }
    const kindRow = el3("div", "so-row");
    kindRow.append(
      labeled(t("sprite.manager.content.kind.label", "类型"), kindSelect),
      button(t("sprite.manager.content.kind.set", "设置类型"), () => {
        if (selectedPackIds.size === 0) {
          toast(body, t("sprite.manager.content.batch.select_first", "请先勾选要设置的图包"));
          return;
        }
        const selected = [...selectedPackIds];
        const changed = setPackKind(
          deps.getSettings(),
          selected,
          kindSelect.value === "illustration" ? "illustration" : "sprite"
        );
        commit(persistSelectedPresetMetadata(changed, selected));
        toast(body, t("sprite.manager.content.kind.updated", "已设置 {{p0}} 个图包的类型", { p0: selected.length }));
      })
    );
    const tagInput = textInput(t("sprite.manager.content.tag.custom_placeholder", "输入自定义标签"));
    tagInput.classList.add("so-batch-tag-input");
    tagInput.maxLength = 32;
    const addRow = el3("div", "so-row");
    addRow.append(
      labeled(t("sprite.manager.content.tag.custom", "自定义标签"), tagInput),
      button(t("sprite.manager.content.tag.add", "添加标签"), () => {
        const tag = normalizeLabels([tagInput.value])[0];
        if (selectedPackIds.size === 0) {
          toast(body, t("sprite.manager.content.batch.select_first", "请先勾选要设置的图包"));
          return;
        }
        if (!tag) {
          toast(body, t("sprite.manager.content.tag.enter", "请输入标签"));
          return;
        }
        const selected = [...selectedPackIds];
        const changed = addPackCustomTag(deps.getSettings(), selected, tag);
        commit(persistSelectedPresetMetadata(changed, selected));
        toast(body, t("sprite.manager.content.tag.added", "已为 {{p0}} 个图包添加「{{p1}}」", { p0: selected.length, p1: tag }));
      })
    );
    const removeSelect = document.createElement("select");
    removeSelect.className = "text_pole so-batch-tag-remove-select";
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = ids.length === 0 ? t("sprite.manager.content.tag.select_packs_first", "先勾选图包") : t("sprite.manager.content.tag.choose_remove", "选择要移除的标签");
    removeSelect.append(emptyOption);
    const selectedTags = normalizeLabels(selectedPacks().flatMap((pack) => pack.customTags ?? []));
    for (const tag of selectedTags) {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      removeSelect.append(option);
    }
    const removeRow = el3("div", "so-row");
    removeRow.append(
      labeled(t("sprite.manager.content.tag.remove", "移除标签"), removeSelect),
      button(t("sprite.manager.content.tag.remove", "移除标签"), () => {
        if (selectedPackIds.size === 0) {
          toast(body, t("sprite.manager.content.batch.select_first", "请先勾选要设置的图包"));
          return;
        }
        if (!removeSelect.value) {
          toast(body, t("sprite.manager.content.tag.select_remove", "请选择要移除的标签"));
          return;
        }
        const selected = [...selectedPackIds];
        const changed = removePackCustomTag(deps.getSettings(), selected, removeSelect.value);
        commit(persistSelectedPresetMetadata(changed, selected));
        toast(body, t("sprite.manager.content.tag.removed", "已从 {{p0}} 个图包移除「{{p1}}」", { p0: selected.length, p1: removeSelect.value }));
      })
    );
    panel.append(kindRow, addRow, removeRow);
    return panel;
  }
  function sameSprite(pack, source) {
    return pack.sprites.find(
      (candidate) => candidate.tag === source.tag && spriteGroup(candidate) === spriteGroup(source) && (candidate.outfit ?? "") === (source.outfit ?? "")
    ) ?? null;
  }
  async function uploadSelectedPacks() {
    if (batchResourceBusy) return;
    const packs = selectedPacks();
    if (packs.length === 0) {
      toast(currentManagerBody(), t("sprite.manager.content.upload.select_first", "先勾选要上传云端的图包"));
      return;
    }
    const apiKey = deps.getSettings().imgbbApiKey.trim();
    if (!apiKey) {
      toast(currentManagerBody(), t("sprite.manager.content.upload.api_key", "请先在「图库」App 配置 imgbb API Key"));
      return;
    }
    batchResourceBusy = true;
    let uploaded = 0;
    let failed = 0;
    try {
      for (const pack of packs) {
        const pending = pack.sprites.filter(
          (sprite) => getSpriteSource(sprite) !== "hosted" && !(sprite.remoteUrl && /^https?:\/\//.test(sprite.remoteUrl))
        );
        for (const sprite of pending) {
          const beforeUrl = sprite.url;
          try {
            const dataUri = beforeUrl.startsWith("data:") ? beforeUrl : await urlToDataUri(beforeUrl);
            const result = await uploadToImgbb(apiKey, dataUri);
            if (!isValidImgbbResult(result)) throw new Error(t("sprite.manager.content.upload.invalid_response", "图床响应无效"));
            const latestPack = deps.getSettings().packs.find((candidate) => candidate.id === pack.id);
            const latestSprite = latestPack ? sameSprite(latestPack, sprite) : null;
            if (!latestPack || !latestSprite || latestSprite.url !== beforeUrl) {
              throw new Error(t("sprite.manager.content.error.target_changed", "目标已更改，本次结果未应用"));
            }
            if (!updateChecked(upsertPack(
              deps.getSettings(),
              upsertSprite(latestPack, { ...latestSprite, code: result.code, remoteUrl: result.url })
            ))) throw new Error(t("sprite.manager.content.error.pack_update", "更新图包失败"));
            uploaded++;
          } catch (error) {
            console.warn("[sprite-overlay] 批量上传云端失败", { packId: pack.id, tag: sprite.tag, error });
            failed++;
          }
        }
      }
    } finally {
      batchResourceBusy = false;
      render2();
      toast(currentManagerBody(), t("sprite.manager.content.upload.complete", "上传云端完成：成功 {{p0}} 张，失败 {{p1}} 张{{p2}}", { p0: uploaded, p1: failed, p2: failed > 0 ? t("sprite.manager.content.retry_hint", "（可再次点击重试）") : "" }));
    }
  }
  async function localizeSelectedPacks() {
    if (batchResourceBusy) return;
    const packs = selectedPacks();
    if (packs.length === 0) {
      toast(currentManagerBody(), t("sprite.manager.content.localize.select_first", "先勾选要保存到本地的图包"));
      return;
    }
    batchResourceBusy = true;
    let localizedCount = 0;
    let failed = 0;
    try {
      for (const pack of packs) {
        const remoteSprites = pack.sprites.filter((sprite) => getSpriteSource(sprite) === "hosted");
        const preset = isPresetPack(pack.id);
        for (const sprite of remoteSprites) {
          try {
            const parts = [pack.name, spriteGroup(sprite), sprite.outfit ?? "", sprite.tag].filter(Boolean);
            const fileName = `${parts.join("-")}.webp`;
            const localized = await localizeSprite(sprite, fileName, {
              fetch: window.fetch.bind(window),
              compress: compressImage,
              saveImage: (file, name) => deps.adapter.saveImageFile(
                file,
                name,
                deps.adapter.getCurrentCharacterName() || pack.name || "shared"
              )
            });
            const latestSettings = deps.getSettings();
            const latestPack = latestSettings.packs.find((candidate) => candidate.id === pack.id);
            const latestSprite = latestPack ? sameSprite(latestPack, sprite) : null;
            if (!latestPack || !latestSprite || latestSprite.url !== sprite.url) {
              throw new Error(t("sprite.manager.content.error.sprite_changed", "立绘在保存期间已变化"));
            }
            if (preset) {
              const next = setPresetLocalSprite(latestSettings, pack.id, latestSprite, localized.url);
              if (next === latestSettings) throw new Error(t("sprite.manager.content.error.preset_update", "更新预设覆盖失败"));
              deps.updateSettings(next);
            } else if (!updateChecked(upsertPack(
              latestSettings,
              upsertSprite(latestPack, { ...latestSprite, url: localized.url, remoteUrl: localized.remoteUrl })
            ))) {
              throw new Error(t("sprite.manager.content.error.pack_update", "更新图包失败"));
            }
            localizedCount++;
          } catch (error) {
            console.warn("[sprite-overlay] 批量保存本地失败", { packId: pack.id, tag: sprite.tag, error });
            failed++;
          }
        }
      }
    } finally {
      batchResourceBusy = false;
      render2();
      toast(currentManagerBody(), t("sprite.manager.content.localize.complete", "保存本地完成：成功 {{p0}} 张，失败 {{p1}} 张{{p2}}", { p0: localizedCount, p1: failed, p2: failed > 0 ? t("sprite.manager.content.retry_hint", "（可再次点击重试）") : "" }));
    }
  }
  async function copySelectedPackShares() {
    if (batchResourceBusy) return;
    const packs = selectedPacks();
    if (packs.length === 0) {
      toast(currentManagerBody(), t("sprite.manager.content.share.select_first", "先勾选要复制分享串的图包"));
      return;
    }
    const encoded = packs.map((pack) => ({ pack, result: encodeShareStringV2(pack) })).filter((entry) => entry.result !== null);
    if (encoded.length === 0) {
      toast(currentManagerBody(), t("sprite.manager.content.share.no_remote", "所选图包都没有可分享的远程图片"));
      return;
    }
    const missingCount = encoded.reduce((count, entry) => count + entry.result.missing.length, 0);
    if (missingCount > 0 && !window.confirm(
      t("sprite.manager.content.share.confirm_missing", "所选图包中还有 {{p0}} 张图片没有远程地址，不会进入分享串。仍要复制吗？", { p0: missingCount })
    )) return;
    const text4 = encoded.map((entry) => entry.result.text).join("\n\n");
    const ok = await copyText(text4);
    toast(
      currentManagerBody(),
      ok ? t("sprite.manager.content.share.copied_packs", "已复制 {{p0}} 个图包的分享串{{p1}}", { p0: encoded.length, p1: missingCount > 0 ? t("sprite.manager.content.share.missing_suffix", "，缺少 {{p0}} 张", { p0: missingCount }) : "" }) : t("sprite.manager.content.share.copy_failed", "复制失败，请手动复制弹出的文本")
    );
    if (!ok) window.prompt(t("sprite.manager.content.share.copy_prompt", "手动复制分享串："), text4);
  }
  async function deletePacksWithChoice(packIds, names, preview) {
    if (!window.confirm(t("sprite.manager.content.delete.confirm_packs", "确定删除 {{p0}} 个立绘包？\n{{p1}}\n绑定关系会一并清除。", { p0: names.length, p1: preview }))) return;
    const current2 = deps.getSettings();
    const localPaths = deletableLocalSpritePaths(current2, packIds);
    const deleteLocal = localPaths.length > 0 && window.confirm(
      t("sprite.manager.content.delete.local_detected", "检测到 {{p0}} 个仅由这些包使用的本地图片文件。\n", { p0: localPaths.length }) + t("sprite.manager.content.delete.local_confirm", "同时从 SillyTavern 服务器删除它们吗？\n\n选择“取消”将只删除图包记录，文件继续保留。")
    );
    if (!deleteLocal) {
      selectedPackIds.clear();
      view = { kind: "list" };
      commit(removePacks(current2, packIds));
      toast(currentManagerBody(), t("sprite.manager.content.delete.packs_kept_files", "已删除 {{p0}} 个立绘包，本地文件未删除", { p0: names.length }));
      return;
    }
    let deleted = 0;
    let failed = 0;
    for (const path of localPaths) {
      try {
        await deps.adapter.deleteImage(path);
        deleted++;
      } catch (error) {
        console.warn("[sprite-overlay] 删除本地图片失败", { path, error });
        failed++;
      }
    }
    if (failed > 0) {
      toast(
        currentManagerBody(),
        t("sprite.manager.content.delete.files_partial", "本地文件删除成功 {{p0}} 张，失败 {{p1}} 张；图包尚未删除，可再次重试", { p0: deleted, p1: failed })
      );
      return;
    }
    selectedPackIds.clear();
    view = { kind: "list" };
    commit(removePacks(deps.getSettings(), packIds));
    toast(currentManagerBody(), t("sprite.manager.content.delete.packs_and_files", "已删除 {{p0}} 个立绘包及 {{p1}} 张本地文件", { p0: names.length, p1: deleted }));
  }
  function renderRolePackStack(role, roleKey, packs, spriteCount, boundState, expand) {
    const stack = el3("button", "so-role-pack-stack");
    stack.type = "button";
    stack.dataset.managerFocus = `role:${roleKey}`;
    stack.dataset.roleKey = roleKey;
    stack.setAttribute("aria-expanded", "false");
    stack.setAttribute("aria-label", t("sprite.manager.content.pack.expand_role", "展开「{{p0}}」的 {{p1}} 个图包", { p0: role, p1: packs.length }));
    for (let index = 2; index >= 1; index -= 1) {
      const layer = el3("span", `so-role-stack-layer so-role-stack-layer-${index}`);
      layer.setAttribute("aria-hidden", "true");
      stack.append(layer);
    }
    const face = el3("span", "so-role-stack-face");
    const coverBox = el3("span", "so-role-stack-cover");
    const first = packs[0];
    const cover = first ? getPackCover(first) : null;
    if (cover) {
      const image = document.createElement("img");
      image.src = cover.url;
      image.alt = "";
      image.loading = "lazy";
      coverBox.append(image);
    } else {
      coverBox.textContent = t("sprite.manager.content.empty.sprites", "暂无立绘");
    }
    const activeCount = packs.filter((pack) => boundState(pack) === "active").length;
    if (activeCount > 0) {
      const badge = el3("span", "so-card-badge");
      badge.textContent = activeCount === 1 ? t("sprite.manager.content.pack.active", "使用中") : t("sprite.manager.content.pack.active_count", "使用中 {{p0}}", { p0: activeCount });
      coverBox.append(badge);
    }
    const info = el3("span", "so-card-info");
    const title2 = el3("b");
    title2.textContent = role;
    const detail = el3("small");
    detail.textContent = t("sprite.manager.content.pack.counts", "{{p0}} 个图包 · {{p1}} 张", { p0: packs.length, p1: spriteCount });
    const count = el3("span", "so-role-stack-count");
    count.textContent = t("sprite.manager.content.pack.count", "{{p0}} 个图包", { p0: packs.length });
    info.append(title2, detail);
    face.append(coverBox, count, info);
    stack.append(face);
    stack.addEventListener("click", expand);
    addCardNavigation(stack, ".so-pack-card, .so-role-pack-stack, .so-role-pack-row");
    return stack;
  }
  function renderPackCard(pack, bound) {
    const card = el3("div", "so-pack-card");
    card.dataset.managerFocus = `pack:${pack.id}`;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", t("sprite.manager.content.pack.open", "打开立绘包「{{p0}}」", { p0: pack.name }));
    card.title = t("sprite.manager.content.pack.open_hint", "点击进入管理");
    const coverBox = el3("div", "so-card-cover");
    const cover = getPackCover(pack);
    if (cover) {
      const img = document.createElement("img");
      img.src = cover.url;
      img.alt = cover.tag;
      img.loading = "lazy";
      coverBox.append(img);
    } else {
      coverBox.textContent = t("sprite.manager.content.empty.sprites", "暂无立绘");
    }
    if (bound) {
      if (bound === "active") card.classList.add("so-card-active");
      const badge = el3("span", bound === "active" ? "so-card-badge" : "so-card-badge so-card-badge-off");
      badge.textContent = bound === "active" ? t("sprite.manager.content.pack.active", "使用中") : t("sprite.manager.content.pack.disabled", "已停用");
      badge.dataset.corner = "bottom-left";
      coverBox.append(badge);
    }
    if (isPresetPack(pack.id)) {
      const chip = el3("span", "so-card-chip");
      chip.textContent = t("sprite.manager.content.pack.preset", "预设");
      coverBox.append(chip);
    }
    const resources = summarizePackResources(pack);
    if (resources.total > 0) {
      const status = el3("span", "so-card-resource-status");
      status.dataset.corner = "bottom-right";
      const resourceLabel = (kind, label) => {
        const count = resources[kind];
        if (count === 0) return;
        const chip = el3("span", `so-card-resource-chip so-card-resource-${kind}`);
        chip.textContent = count === resources.total ? label : `${label} ${count}/${resources.total}`;
        status.append(chip);
      };
      resourceLabel("local", t("sprite.manager.content.pack.local", "本地"));
      resourceLabel("cloud", t("sprite.manager.content.pack.cloud", "云端"));
      coverBox.append(status);
    }
    const info = el3("div", "so-card-info");
    const nameEl = el3("b");
    nameEl.textContent = pack.name;
    const metaEl = el3("small");
    metaEl.textContent = t("sprite.manager.content.pack.metadata", "{{p0}} 张 · {{p1}}", { p0: pack.sprites.length, p1: pack.author ?? t("sprite.manager.content.pack.unknown_author", "未知作者") });
    const labels = packLabels(pack);
    const labelRow = el3("div", "so-pack-labels");
    const displayRole = pack.roleName?.trim() || t("sprite.manager.content.group.other", "其他");
    const displayKind = pack.kind === "illustration" ? t("sprite.manager.content.kind.illustration", "插图") : t("sprite.manager.content.kind.sprite", "立绘");
    for (const text4 of [t("sprite.manager.content.pack.role_label", "角色：{{p0}}", { p0: displayRole }), t("sprite.manager.content.pack.kind_label", "类型：{{p0}}", { p0: displayKind }), ...labels.custom]) {
      const chip = el3("span");
      chip.textContent = text4;
      labelRow.append(chip);
    }
    info.append(nameEl, metaEl, labelRow);
    card.append(coverBox, info);
    addCardNavigation(card, ".so-pack-card, .so-role-pack-stack, .so-role-pack-row");
    if (batchMode) {
      const preset = isPresetPack(pack.id);
      const selected = selectedPackIds.has(pack.id);
      card.setAttribute("aria-pressed", String(selected));
      card.classList.add("so-card-batch");
      if (selected) card.classList.add("so-card-selected");
      const check = el3("span", `so-card-check${selected ? " so-card-check-on" : ""}`);
      check.textContent = selected ? "✓" : "";
      check.dataset.corner = "top-left";
      coverBox.append(check);
      const orderRow = el3("div", "so-row so-card-order");
      orderRow.append(
        iconButton("◀", t("sprite.manager.content.move_earlier", "前移"), () => {
          commit(movePack(deps.getSettings(), pack.id, -1));
        }, "so-chip-btn"),
        iconButton("▶", t("sprite.manager.content.move_later", "后移"), () => {
          commit(movePack(deps.getSettings(), pack.id, 1));
        }, "so-chip-btn")
      );
      card.append(orderRow);
      card.title = preset ? t("sprite.manager.content.batch.preset_select_hint", "点击勾选资源操作；预设包不可删除，可拖拽排序") : t("sprite.manager.content.batch.select_hint", "点击勾选；可拖拽排序");
      card.setAttribute("aria-label", t("sprite.manager.content.batch.select_pack", "选择立绘包「{{p0}}」", { p0: pack.name }));
      const toggleSelect = () => {
        if (selectedPackIds.has(pack.id)) selectedPackIds.delete(pack.id);
        else selectedPackIds.add(pack.id);
        render2();
      };
      card.addEventListener("click", toggleSelect);
      card.addEventListener("keydown", (e) => {
        if (e.target === card && !e.isComposing && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          e.stopPropagation();
          toggleSelect();
        }
      });
      card.draggable = true;
      card.dataset.packId = pack.id;
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/plain", pack.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        card.classList.add("so-card-dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("so-card-dragging"));
      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        card.classList.add("so-card-drop-target");
      });
      card.addEventListener("dragleave", () => card.classList.remove("so-card-drop-target"));
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        card.classList.remove("so-card-drop-target");
        const fromId = e.dataTransfer?.getData("text/plain");
        if (!fromId || fromId === pack.id) return;
        commit(movePackBefore(deps.getSettings(), fromId, pack.id));
      });
      return card;
    }
    const enter = () => {
      view = { kind: "pack", packId: pack.id };
      spriteVisibleCount = SPRITE_PAGE_SIZE;
      spriteFilterQuery = "";
      spriteFilterLabels = [];
      render2();
    };
    card.addEventListener("click", enter);
    card.addEventListener("keydown", (e) => {
      if (e.target === card && !e.isComposing && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        e.stopPropagation();
        enter();
      }
    });
    return card;
  }
  function renderPackDetail(body, actions, pack) {
    const readonly = isPresetPack(pack.id);
    if (!readonly) {
      actions.append(
        dropdownButton(t("sprite.manager.content.add.title", "添加立绘"), (panel) => {
          const upHeading = el3("div", "so-popover-title");
          upHeading.textContent = t("sprite.manager.content.add.upload_title", "直接上传");
          const upBtn = button(t("sprite.manager.content.add.choose_images", "选择图片（自动压缩+解析预览）"), () => {
            const opener = popoverOpener;
            closePopovers();
            pickFile("image/*", true, (files) => openUploadPreview(pack.id, files, opener));
          });
          const upHint = el3("div", "so-status");
          upHint.textContent = t("sprite.manager.content.add.upload_hint", "默认整个文件名作图名、落入当前包；预览里勾选「自动拆分」可按 _ - – — 空格拆「人名/服装/图名」（如 鸣人-居家服-微笑.png）并按前缀拆分成包。");
          const codeHeading = el3("div", "so-popover-title");
          codeHeading.textContent = t("sprite.manager.content.add.codes_title", "按编码添加");
          const codeInput = document.createElement("textarea");
          codeInput.className = "text_pole";
          codeInput.rows = 3;
          codeInput.placeholder = t("sprite.manager.content.add.codes_placeholder", "粘贴编码，或「图名 编码」，可多个（空格/逗号/换行分隔）");
          const codeBtn = button(t("sprite.manager.content.add.button", "添加"), () => {
            const { entries, invalid } = parseImageCodeEntries(codeInput.value);
            if (entries.length === 0 && invalid.length === 0) {
              toast(body, t("sprite.manager.content.add.enter_code", "请填写图床编码，如 ab12cd.png，或「微笑 ab12cd.png」（可一次粘贴多个）"));
              return;
            }
            if (invalid.length > 0) {
              toast(body, t("sprite.manager.content.add.invalid_codes", "认不出编码：{{p0}}{{p1}}", { p0: invalid.slice(0, 3).join("、"), p1: invalid.length > 3 ? t("sprite.manager.content.add.more", " 等") : "" }));
              return;
            }
            const current2 = deps.getSettings();
            const target = current2.packs.find((p) => p.id === pack.id);
            if (!target) return;
            const host = current2.imageHost.endsWith("/") ? current2.imageHost : `${current2.imageHost}/`;
            let next = target;
            let added = 0;
            let named = 0;
            for (const entry of entries) {
              const fromName = entry.tag ? normalizeTag(entry.tag) : "";
              const tag = fromName || normalizeTag(entry.code.replace(/\.[^.]+$/, ""));
              if (!tag) continue;
              if (fromName) named++;
              next = upsertSprite(next, { tag, url: host + entry.code, code: entry.code });
              added++;
            }
            commitPack(next);
            toast(
              body,
              named > 0 ? t("sprite.manager.content.add.named_result", "已添加 {{p0}} 张，其中 {{p1}} 张用了你给的图名", { p0: added, p1: named }) : t("sprite.manager.content.add.code_result", "已按编码添加 {{p0}} 张（图名取编码名，可在图卡上改名）", { p0: added })
            );
          });
          const codeHint = el3("div", "so-status");
          codeHint.textContent = t("sprite.manager.content.add.code_prefix", "编码拼接图床前缀 {{p0}} 成直链。", { p0: deps.getSettings().imageHost }) + t("sprite.manager.content.add.code_named_hint", "写「微笑 ab12cd.png」就用「微笑」当图名，连写「微笑ab12cd.png」也认；") + t("sprite.manager.content.add.code_rename_hint", "只给编码时图名取编码名。改名/分组用图卡上的 ✎ / 🏷。");
          panel.append(upHeading, upBtn, upHint, codeHeading, codeInput, codeBtn, codeHint);
        })
      );
    }
    const topRow = el3("div", "so-row so-detail-top");
    topRow.append(
      button(t("sprite.manager.content.export.json", "导出 JSON"), async () => {
        const file = await exportPack(pack);
        downloadJson2(file, `${pack.name}.sprite-pack.json`);
        toast(body, t("sprite.manager.content.export.saved", "已导出「{{p0}}」", { p0: pack.name }));
      }),
      button(t("sprite.manager.content.share.copy", "复制分享串"), async () => {
        const result = encodeShareStringV2(pack);
        if (!result) {
          toast(body, t("sprite.manager.content.share.pack_no_remote", "该包没有可分享的远程图片（本地/内嵌图请用「导出 JSON」，或先上传 imgbb）"));
          return;
        }
        if (result.missing.length > 0) {
          const preview = result.missing.slice(0, 8).join("、");
          const more = result.missing.length > 8 ? t("sprite.manager.content.share.more_items", " 等 {{p0}} 项", { p0: result.missing.length }) : "";
          const go = window.confirm(
            t("sprite.manager.content.share.incomplete", "分享串不完整：{{p0}}/{{p1}} 张有远程地址。\n", { p0: result.included, p1: result.total }) + t("sprite.manager.content.share.missing_list", "缺少远程地址（不会包含在分享串里）：{{p0}}{{p1}}\n\n", { p0: preview, p1: more }) + t("sprite.manager.content.share.confirm_incomplete", "这些图片对方将看不到。仍要复制残缺分享串吗？")
          );
          if (!go) return;
        }
        const ok = await copyText(result.text);
        const note = result.missing.length > 0 ? t("sprite.manager.content.share.partial_count", "（{{p0}}/{{p1}} 张，缺 {{p2}} 张）", { p0: result.included, p1: result.total, p2: result.missing.length }) : t("sprite.manager.content.share.complete_count", "（{{p0}} 张，完整）", { p0: result.included });
        toast(body, ok ? t("sprite.manager.content.share.copied", "已复制分享串{{p0}}", { p0: note }) : t("sprite.manager.content.share.copy_failed", "复制失败，请手动复制弹出的文本"));
        if (!ok) window.prompt(t("sprite.manager.content.share.copy_prompt", "手动复制分享串："), result.text);
      })
    );
    const spacer = el3("div", "so-spacer");
    topRow.append(spacer);
    if (!readonly) {
      topRow.append(
        button(t("sprite.manager.content.delete.pack", "删除立绘包"), () => {
          void deletePacksWithChoice([pack.id], [pack.name], pack.name);
        }, "so-btn-danger")
      );
    }
    body.append(topRow);
    {
      const metaPanel = collapsible(t("sprite.manager.content.info.title", "包信息"), false, `pack-meta:${pack.id}`);
      const metaRow = el3("div", "so-row so-meta-row");
      const nameInput = textInput(t("sprite.manager.content.info.name", "包名"));
      nameInput.value = pack.name;
      const authorInput = textInput(t("sprite.manager.content.info.author", "作者"));
      authorInput.value = pack.author ?? "";
      const descInput = textInput(t("sprite.manager.content.info.description_placeholder", "描述（可选）"));
      descInput.value = pack.description ?? "";
      const roleInput = textInput(t("sprite.manager.content.info.role_placeholder", "人名（可空）"));
      roleInput.value = pack.roleName ?? "";
      const outfitInput = textInput(t("sprite.manager.content.info.outfit_placeholder", "服装（可空）"));
      outfitInput.value = pack.outfit ?? "";
      const promptNoteInput = document.createElement("textarea");
      promptNoteInput.className = "text_pole so-pack-prompt-note";
      promptNoteInput.placeholder = t("sprite.manager.content.info.note_placeholder", "图包备注（可选）");
      promptNoteInput.rows = 3;
      promptNoteInput.maxLength = MAX_NOTE_CODE_POINTS;
      promptNoteInput.value = pack.promptNote ?? "";
      const placementSelect = document.createElement("select");
      placementSelect.className = "text_pole so-pack-prompt-placement";
      placementSelect.setAttribute("aria-label", t("sprite.manager.content.info.note_placement", "图包备注插入位置"));
      for (const [value, label] of [
        ["before-list", t("sprite.manager.content.info.before_list", "立绘清单前")],
        ["after-list", t("sprite.manager.content.info.after_list", "立绘清单后")]
      ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        placementSelect.append(option);
      }
      placementSelect.value = pack.promptNotePlacement ?? DEFAULT_PROMPT_NOTE_PLACEMENT;
      const inventoryPromptInput = document.createElement("textarea");
      inventoryPromptInput.className = "text_pole so-pack-inventory-prompt";
      inventoryPromptInput.placeholder = t("sprite.manager.content.info.inventory_placeholder", "自定义清单提示词（可选，替换默认的表情列表）");
      inventoryPromptInput.rows = 4;
      inventoryPromptInput.maxLength = MAX_INVENTORY_PROMPT_CODE_POINTS;
      inventoryPromptInput.value = pack.inventoryPrompt ?? "";
      const outfitNoteDrafts = new Map(Object.entries(pack.outfitNotes ?? {}));
      const outfitNotesBox = el3("div", "so-outfit-note-list");
      const syncOutfitNoteDrafts = () => {
        for (const input of outfitNotesBox.querySelectorAll(".so-outfit-note-input")) {
          outfitNoteDrafts.set(input.dataset.outfit ?? "", input.value);
        }
      };
      const renderOutfitNotes = () => {
        syncOutfitNoteDrafts();
        const outfits = [...new Set([
          normalizeTag(outfitInput.value),
          ...pack.sprites.map((sprite) => normalizeTag(sprite.outfit ?? "")),
          ...outfitNoteDrafts.keys()
        ].filter(Boolean))];
        outfitNotesBox.replaceChildren();
        if (outfits.length === 0) return;
        const title2 = el3("div", "so-section-title");
        title2.textContent = t("sprite.manager.content.info.outfit_notes", "服装备注");
        outfitNotesBox.append(title2);
        for (const outfit of outfits) {
          const input = document.createElement("textarea");
          input.className = "text_pole so-outfit-note-input";
          input.dataset.outfit = outfit;
          input.placeholder = t("sprite.manager.content.info.outfit_note_placeholder", "{{p0}}的使用场景（可选）", { p0: outfit });
          input.rows = 2;
          input.maxLength = MAX_NOTE_CODE_POINTS;
          input.value = outfitNoteDrafts.get(outfit) ?? "";
          input.addEventListener("input", () => outfitNoteDrafts.set(outfit, input.value));
          const row = labeled(outfit, input);
          row.classList.add("so-outfit-note-row");
          outfitNotesBox.append(row);
        }
      };
      outfitInput.addEventListener("change", renderOutfitNotes);
      renderOutfitNotes();
      const promptRow = el3("div", "so-row so-pack-note-row");
      promptRow.append(
        labeled(t("sprite.manager.content.info.note", "图包备注"), promptNoteInput),
        labeled(t("sprite.manager.content.info.placement", "插入位置"), placementSelect)
      );
      const inventoryRow = el3("div", "so-row so-pack-inventory-row");
      const inventoryHint = el3("div", "so-status so-pack-inventory-hint");
      inventoryHint.textContent = t("sprite.manager.content.info.inventory_hint", "填了就用它替换这个包在清单里的表情列表；留空走默认列表。") + t("sprite.manager.content.info.multiple_packs_hint", "多个包同场景时两段都会出现，不会互相覆盖。");
      const inventoryCell = labeled(t("sprite.manager.content.info.inventory", "自定义清单提示词"), inventoryPromptInput);
      inventoryCell.append(inventoryHint);
      inventoryRow.append(inventoryCell);
      metaRow.append(
        labeled(t("sprite.manager.content.info.name", "包名"), nameInput),
        labeled(t("sprite.manager.content.info.author", "作者"), authorInput),
        labeled(t("sprite.manager.content.info.role", "人名"), roleInput),
        labeled(t("sprite.manager.content.info.outfit", "服装"), outfitInput),
        labeled(t("sprite.manager.content.info.description", "描述"), descInput)
      );
      const saveRow = el3("div", "so-row so-meta-save-row");
      saveRow.append(
        button(t("sprite.manager.content.info.save", "保存包信息"), () => {
          const name = sanitizePackName(nameInput.value);
          if (!name) {
            toast(body, t("sprite.manager.content.info.empty_name", "包名不能为空"));
            return;
          }
          const roleName = normalizeTag(roleInput.value);
          const outfit = normalizeTag(outfitInput.value);
          const promptNote = normalizeNote(promptNoteInput.value);
          const inventoryPrompt = normalizeInventoryPrompt(inventoryPromptInput.value);
          syncOutfitNoteDrafts();
          const outfitNotes = normalizeOutfitNotes(Object.fromEntries(outfitNoteDrafts));
          if (readonly) {
            const current2 = deps.getSettings();
            const metadata = {
              name,
              author: sanitizePackName(authorInput.value) || null,
              description: sanitizeDescription(descInput.value) || null,
              roleName: roleName || null,
              outfit: outfit || null,
              promptNote: promptNote || null,
              promptNotePlacement: promptNote ? placementSelect.value === "after-list" ? "after-list" : "before-list" : null,
              outfitNotes: Object.keys(outfitNotes).length > 0 ? outfitNotes : null
            };
            metadata.inventoryPrompt = inventoryPrompt || null;
            const next = setPresetMetadata(current2, pack.id, metadata);
            const materialized = next.packs.find((candidate) => candidate.id === pack.id);
            if (!materialized || !checkedSettings(upsertPack(current2, materialized))) return;
            commit(next);
            toast(body, t("sprite.manager.content.info.saved", "已保存包信息"));
            return;
          }
          const nextPack = {
            ...pack,
            name,
            author: sanitizePackName(authorInput.value) || void 0,
            description: sanitizeDescription(descInput.value) || void 0,
            roleName: roleName || void 0,
            outfit: outfit || void 0
          };
          if (promptNote) {
            nextPack.promptNote = promptNote;
            nextPack.promptNotePlacement = placementSelect.value === "after-list" ? "after-list" : "before-list";
          } else {
            delete nextPack.promptNote;
            delete nextPack.promptNotePlacement;
          }
          if (inventoryPrompt) nextPack.inventoryPrompt = inventoryPrompt;
          else delete nextPack.inventoryPrompt;
          if (Object.keys(outfitNotes).length > 0) nextPack.outfitNotes = outfitNotes;
          else delete nextPack.outfitNotes;
          if (commitChecked(upsertPack(deps.getSettings(), nextPack))) {
            toast(body, t("sprite.manager.content.info.saved", "已保存包信息"));
          }
        }, "so-btn-primary so-meta-save")
      );
      if (readonly) {
        saveRow.append(button(t("sprite.manager.content.info.restore", "恢复内置信息"), () => {
          if (!window.confirm(t("sprite.manager.content.info.confirm_restore", "确定恢复扩展内置的包信息吗？已保存的本地图片会保留。"))) return;
          const current2 = deps.getSettings();
          const next = clearPresetMetadata(current2, pack.id);
          const materialized = next.packs.find((candidate) => candidate.id === pack.id);
          if (!materialized || !checkedSettings(upsertPack(current2, materialized))) return;
          commit(next);
          toast(body, t("sprite.manager.content.info.restored", "已恢复内置信息，本地图片保持不变"));
        }));
      }
      const metaHint = el3("div", "so-status");
      metaHint.textContent = readonly ? t("sprite.manager.content.info.preset_hint", "可覆盖预设包信息；立绘图片本身仍不可添加、改名或删除。") : t("sprite.manager.content.info.address_hint", "人名/服装用于三级寻址 [立绘:人名/服装/图名]：整包同一角色时填人名，包内立绘用纯图名即可。");
      metaPanel.body.append(metaRow, promptRow, inventoryRow, outfitNotesBox, metaHint, saveRow);
      body.append(metaPanel.box);
    }
    if (pack.sprites.length === 0) {
      const empty = el3("div", "so-status");
      empty.textContent = t("sprite.manager.content.empty.pack_detail", "还没有立绘：点右上角「添加立绘」上传图片或粘贴编码。");
      body.append(empty);
    } else {
      const filters = el3("div", "so-gallery-filters");
      const search = document.createElement("input");
      search.type = "search";
      search.className = "text_pole so-gallery-search";
      search.placeholder = t("sprite.manager.content.filter.sprites_placeholder", "搜索图名、角色、服装或标签");
      search.setAttribute("aria-label", t("sprite.manager.content.filter.sprites", "搜索立绘"));
      search.value = spriteFilterQuery;
      const labelSelect = document.createElement("select");
      labelSelect.className = "text_pole so-gallery-label-select";
      labelSelect.setAttribute("aria-label", t("sprite.manager.content.filter.add_tag", "添加标签筛选"));
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = t("sprite.manager.content.filter.by_tag", "按标签筛选…");
      labelSelect.append(placeholder);
      const availableLabels = [...new Set(pack.sprites.flatMap((sprite) => sprite.labels ?? []))];
      for (const label of availableLabels) {
        const option = document.createElement("option");
        option.value = label;
        option.textContent = label;
        labelSelect.append(option);
      }
      const chips = el3("div", "so-gallery-filter-chips");
      filters.append(search, labelSelect, chips);
      body.append(filters);
      const gallery = el3("div", "so-sprite-gallery");
      const count = el3("div", "so-status so-sprite-count");
      const paging = el3("div", "so-gallery-paging");
      body.append(gallery, count, paging);
      let filteredEntries = [];
      let sections = [];
      let groups = [];
      const grids = /* @__PURE__ */ new Map();
      const ensureGrid = (group) => {
        const existing = grids.get(group);
        if (existing) return existing;
        const section2 = el3("div", "so-sprite-section");
        if (groups.length > 0) {
          const head = el3("div", "so-group-head");
          head.textContent = group === "" ? t("sprite.manager.content.group.none", "未分组") : group;
          section2.append(head);
        }
        const grid = el3("div", "so-sprite-grid");
        section2.append(grid);
        const nextGrid = sections.slice(sections.indexOf(group) + 1).map((nextGroup) => grids.get(nextGroup)).find((candidate) => candidate != null);
        gallery.insertBefore(section2, nextGrid?.parentElement ?? null);
        grids.set(group, grid);
        return grid;
      };
      const appendSprites = (start, end) => {
        const entries = filteredEntries.slice(start, end);
        for (const group of sections) {
          const matching = entries.filter(({ sprite }) => spriteGroup(sprite) === group);
          if (matching.length === 0) continue;
          const grid = ensureGrid(group);
          for (const { sprite, index } of matching) {
            grid.append(renderSpriteCell(body, pack, sprite, index, readonly));
          }
        }
      };
      const updatePaging = () => {
        const visibleCount = Math.min(spriteVisibleCount, filteredEntries.length);
        count.textContent = t("sprite.manager.content.filter.shown", "已显示 {{p0}}/{{p1}}", { p0: visibleCount, p1: filteredEntries.length });
        paging.replaceChildren();
        if (visibleCount < filteredEntries.length) {
          paging.append(button(t("sprite.manager.content.filter.load_more", "加载更多"), () => {
            const previousCount = spriteVisibleCount;
            spriteVisibleCount = Math.min(filteredEntries.length, previousCount + SPRITE_PAGE_SIZE);
            appendSprites(previousCount, spriteVisibleCount);
            updatePaging();
          }));
        }
      };
      const renderFilteredGallery = () => {
        const matches = new Set(filterSprites(pack, {
          query: spriteFilterQuery,
          labels: spriteFilterLabels
        }));
        filteredEntries = pack.sprites.map((sprite, index) => ({ sprite, index })).filter(({ sprite }) => matches.has(sprite));
        groups = [...new Set(filteredEntries.map(({ sprite }) => spriteGroup(sprite)).filter(Boolean))];
        sections = [...groups];
        if (filteredEntries.some(({ sprite }) => spriteGroup(sprite) === "")) sections.push("");
        if (sections.length === 0) sections.push("");
        gallery.replaceChildren();
        grids.clear();
        if (filteredEntries.length === 0) {
          const empty = el3("div", "so-status so-gallery-empty");
          empty.textContent = t("sprite.manager.content.empty.filtered_sprites", "没有符合筛选条件的立绘。");
          gallery.append(empty);
        } else {
          appendSprites(0, Math.min(spriteVisibleCount, filteredEntries.length));
        }
        updatePaging();
      };
      const renderChips = () => {
        chips.replaceChildren();
        for (const label of spriteFilterLabels) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "so-gallery-filter-chip";
          chip.textContent = `${label} ×`;
          chip.title = t("sprite.manager.content.filter.remove_tag", "移除标签筛选「{{p0}}」", { p0: label });
          chip.addEventListener("click", () => {
            spriteFilterLabels = spriteFilterLabels.filter((current2) => current2 !== label);
            spriteVisibleCount = SPRITE_PAGE_SIZE;
            renderChips();
            renderFilteredGallery();
          });
          chips.append(chip);
        }
      };
      search.addEventListener("input", () => {
        spriteFilterQuery = search.value;
        spriteVisibleCount = SPRITE_PAGE_SIZE;
        renderFilteredGallery();
      });
      labelSelect.addEventListener("change", () => {
        const label = labelSelect.value;
        labelSelect.value = "";
        if (!label || spriteFilterLabels.includes(label)) return;
        spriteFilterLabels = [...spriteFilterLabels, label];
        spriteVisibleCount = SPRITE_PAGE_SIZE;
        renderChips();
        renderFilteredGallery();
      });
      spriteVisibleCount = Math.min(
        Math.max(SPRITE_PAGE_SIZE, spriteVisibleCount),
        pack.sprites.length
      );
      renderChips();
      renderFilteredGallery();
    }
    if (!readonly) {
      const pending = pack.sprites.filter(
        (s) => getSpriteSource(s) !== "hosted" && !(s.remoteUrl && /^https?:\/\//.test(s.remoteUrl))
      );
      const { imgbbApiKey } = deps.getSettings();
      if (pending.length > 0 && imgbbApiKey.trim()) {
        const upSection = el3("div", "so-section");
        const upTitle = el3("div", "so-section-title");
        upTitle.textContent = t("sprite.manager.content.upload.retry_title", "图床补传");
        const upDesc = el3("div", "so-status");
        upDesc.textContent = t("sprite.manager.content.upload.pending_hint", "{{p0}} 张立绘还没有远程地址（分享时对方看不到）。补传到 imgbb 后本地图仍保留。", { p0: pending.length });
        upSection.append(
          upTitle,
          upDesc,
          button(t("sprite.manager.content.upload.retry", "补传 {{p0}} 张到 imgbb（失败可重试）", { p0: pending.length }), () => {
            void retryPendingUploads(body, pack.id);
          })
        );
        body.append(upSection);
      }
      const splitPreview = previewGroupSplit(pack);
      if (splitPreview.length >= 2) {
        const splitPanel = collapsible(t("sprite.manager.content.split.title", "按分组拆成立绘包"), false, `pack-split:${pack.id}`);
        const splitDesc = el3("div", "so-status");
        splitDesc.textContent = t("sprite.manager.content.split.preview", "检测到 {{p0}} 个分组：{{p1}}。拆分会新建这些包（原包与绑定保留，可稍后自行删除）。", { p0: splitPreview.length, p1: splitPreview.map((s) => `${s.roleName}(${s.count})`).join("、") });
        splitPanel.body.append(
          splitDesc,
          button(t("sprite.manager.content.split.button", "拆分（保留原包）"), () => {
            const preview = splitPreview.map((s) => t("sprite.manager.content.split.pack_count", "{{p0}}：{{p1}} 张", { p0: s.roleName, p1: s.count })).join("\n");
            if (!window.confirm(t("sprite.manager.content.split.confirm", "将新建以下立绘包（原包保留）：\n{{p0}}\n\n确认拆分？", { p0: preview }))) return;
            const newPacks = splitPackByGroup(pack);
            let next = deps.getSettings();
            for (const np of newPacks) {
              const updated = checkedSettings(upsertPack(next, np));
              if (!updated) return;
              next = updated;
            }
            commit(next);
            toast(body, t("sprite.manager.content.split.complete", "已拆出 {{p0}} 个新包（原包「{{p1}}」保留）", { p0: newPacks.length, p1: pack.name }));
          })
        );
        body.append(splitPanel.box);
      }
    }
    body.append(statusBar());
  }
  function openLightbox(packId, startIndex) {
    if (!backdrop) return;
    const pack = deps.getSettings().packs.find((candidate) => candidate.id === packId);
    if (!pack || pack.sprites.length === 0) return;
    activeLightbox?.controller?.close();
    const state2 = { controller: null, packId, index: startIndex };
    const controller = openSpriteLightbox({
      pack,
      index: startIndex,
      readonly: isPresetPack(pack.id),
      actions: isPresetPack(pack.id) ? presetLightboxActions(state2) : lightboxActions(state2),
      onNavigate: (index) => {
        state2.index = index;
        refreshLightbox();
      },
      onClose: () => {
        if (activeLightbox === state2) activeLightbox = null;
      }
    });
    state2.controller = controller;
    activeLightbox = state2;
  }
  function refreshLightbox() {
    const state2 = activeLightbox;
    if (!state2?.controller) return;
    const pack = deps.getSettings().packs.find((candidate) => candidate.id === state2.packId);
    if (!pack || pack.sprites.length === 0) {
      state2.controller.close();
      return;
    }
    state2.index = Math.max(0, Math.min(state2.index, pack.sprites.length - 1));
    const actions = isPresetPack(pack.id) ? presetLightboxActions(state2) : lightboxActions(state2);
    state2.controller.update(pack, state2.index, actions);
  }
  function commitActionPack(pack) {
    const result = upsertPack(deps.getSettings(), pack);
    if (!result.ok) throw new Error(t("sprite.manager.content.conflict.address", "操作未生效，存在地址冲突：{{p0}}", { p0: conflictText(result.conflicts) }));
    deps.updateSettings(result.settings);
  }
  function currentManagerBody() {
    return backdrop?.querySelector(".so-manager-body");
  }
  function runSpriteAction(action) {
    const report = (error) => {
      toast(currentManagerBody(), error instanceof Error ? error.message : t("sprite.manager.content.action.failed", "立绘操作失败"));
      refreshLightbox();
    };
    try {
      const result = action.run();
      if (result instanceof Promise) void result.catch(report);
    } catch (error) {
      report(error);
    }
  }
  function pickReplacement(packId, getCurrentSprite) {
    const selected = getCurrentSprite();
    if (!selected) return;
    const identity = {
      tag: selected.tag,
      group: spriteGroup(selected),
      outfit: selected.outfit ?? ""
    };
    const latestTarget = () => {
      const pack = deps.getSettings().packs.find((candidate) => candidate.id === packId);
      const sprite = pack?.sprites.find(
        (candidate) => candidate.tag === identity.tag && spriteGroup(candidate) === identity.group && (candidate.outfit ?? "") === identity.outfit
      );
      return pack && sprite ? { pack, sprite } : null;
    };
    pickFile("image/*", false, async (files) => {
      try {
        const result = await compressImage(files[0]);
        const beforeSave = latestTarget();
        if (!beforeSave) return;
        const beforeUrl = beforeSave.sprite.url;
        const url = await deps.adapter.saveImage(
          `${beforeSave.sprite.tag}.webp`,
          result.dataUri,
          deps.adapter.getCurrentCharacterName() || beforeSave.pack.name
        );
        if (!localUserImagePath(url)) throw new Error(t("sprite.manager.content.error.unsafe_local", "保存失败：平台未返回安全的本地用户图片地址"));
        const target = latestTarget();
        if (!target || target.sprite.url !== beforeUrl) {
          throw new Error(t("sprite.manager.content.error.target_changed", "目标已更改，本次结果未应用"));
        }
        const base = {
          tag: target.sprite.tag,
          url,
          ...identity.group ? { group: identity.group } : {},
          ...identity.outfit ? { outfit: identity.outfit } : {},
          ...target.sprite.labels?.length ? { labels: target.sprite.labels } : {}
        };
        commitPack(upsertSprite(target.pack, base));
        const { autoUpload, imgbbApiKey } = deps.getSettings();
        if (autoUpload && imgbbApiKey.trim()) {
          try {
            const uploaded = await uploadToImgbb(imgbbApiKey, result.dataUri);
            if (isValidImgbbResult(uploaded)) {
              const latest = latestTarget();
              if (latest && latest.sprite.url === url) {
                commitPack(upsertSprite(latest.pack, {
                  ...latest.sprite,
                  code: uploaded.code,
                  remoteUrl: uploaded.url
                }));
                toast(currentManagerBody(), t("sprite.manager.content.replace.hosted", "已替换「{{p0}}」并重传图床（{{p1}}）", { p0: identity.tag, p1: formatBytes(result.bytes) }));
                return;
              } else {
                toast(currentManagerBody(), t("sprite.manager.content.replace.target_changed", "目标已更改，本次图床结果未应用；已保留本地文件"));
                return;
              }
            }
            toast(currentManagerBody(), t("sprite.manager.content.replace.invalid_response", "已替换「{{p0}}」，但图床响应无效，标记为待上传", { p0: identity.tag }));
          } catch {
            toast(currentManagerBody(), t("sprite.manager.content.replace.upload_failed", "已替换「{{p0}}」，图床上传失败，标记为待上传", { p0: identity.tag }));
          }
        } else {
          toast(currentManagerBody(), t("sprite.manager.content.replace.local", "已替换「{{p0}}」（{{p1}}），远程地址待上传", { p0: identity.tag, p1: formatBytes(result.bytes) }));
        }
      } catch (error) {
        toast(currentManagerBody(), error instanceof Error ? error.message : t("sprite.manager.content.replace.failed", "替换失败"));
      } finally {
        refreshLightbox();
      }
    });
  }
  function actionContext(packId, getSprite, closeAction) {
    const getPack = () => deps.getSettings().packs.find((candidate) => candidate.id === packId) ?? null;
    const context = {
      getPack,
      getSprite: () => {
        const pack = getPack();
        return pack ? getSprite(pack) : null;
      },
      commit: commitActionPack,
      pickReplacement: () => pickReplacement(packId, () => context.getSprite()),
      localize: async (source) => {
        const identity = {
          tag: source.tag,
          group: spriteGroup(source),
          outfit: source.outfit ?? ""
        };
        const localized = await localizeSprite(source, `${source.tag}.webp`, {
          fetch: window.fetch.bind(window),
          compress: compressImage,
          saveImage: (file, fileName) => deps.adapter.saveImageFile(
            file,
            fileName,
            deps.adapter.getCurrentCharacterName() || getPack()?.name || "shared"
          )
        });
        const pack = getPack();
        const latest = pack?.sprites.find(
          (candidate) => candidate.tag === identity.tag && spriteGroup(candidate) === identity.group && (candidate.outfit ?? "") === identity.outfit
        );
        if (!pack || !latest || latest.url !== source.url) {
          throw new Error(t("sprite.manager.content.localize.changed", "立绘在保存期间已发生变化，请重试"));
        }
        if (isPresetPack(packId)) {
          deps.updateSettings(setPresetLocalSprite(
            deps.getSettings(),
            packId,
            latest,
            localized.url
          ));
        } else {
          commitActionPack(upsertSprite(pack, {
            ...latest,
            url: localized.url,
            remoteUrl: localized.remoteUrl
          }));
        }
        context.refresh();
        toast(currentManagerBody(), t("sprite.manager.content.localize.saved", "已将「{{p0}}」保存到本地", { p0: source.tag }));
      },
      refresh: () => {
        render2();
        refreshLightbox();
      },
      close: closeAction
    };
    return context;
  }
  function lightboxActions(state2) {
    const context = actionContext(
      state2.packId,
      (pack) => pack.sprites[state2.index] ?? null,
      () => {
        render2();
        state2.controller?.close();
      }
    );
    return createSpriteActions(context).map((action) => ({
      ...action,
      run: () => runSpriteAction(action)
    }));
  }
  function presetLightboxActions(state2) {
    const context = actionContext(
      state2.packId,
      (pack) => pack.sprites[state2.index] ?? null,
      () => state2.controller?.close()
    );
    return createSpriteActions(context).filter((action) => action.allowedInReadonly).map((action) => ({ ...action, run: () => runSpriteAction(action) }));
  }
  function renderSpriteCell(body, pack, sprite, index, readonly) {
    const cell = el3("div", "so-sprite-cell");
    cell.tabIndex = 0;
    cell.setAttribute("role", "button");
    cell.setAttribute("aria-label", t("sprite.manager.content.pack.open_image", "查看立绘「{{name}}」", { name: sprite.tag }));
    cell.dataset.managerFocus = `sprite:${pack.id}:${spriteGroup(sprite)}:${sprite.outfit ?? ""}:${sprite.tag}`;
    addCardNavigation(cell, ".so-sprite-cell");
    if (pack.coverTag === sprite.tag) cell.classList.add("so-cover");
    const img = document.createElement("img");
    img.src = sprite.url;
    img.alt = sprite.tag;
    img.title = sprite.tag;
    img.loading = "lazy";
    const tagEl = el3("div", "so-sprite-tag");
    tagEl.textContent = sprite.tag;
    tagEl.title = sprite.tag;
    cell.append(img, tagEl);
    cell.addEventListener("click", () => openLightbox(pack.id, index));
    cell.addEventListener("keydown", (event) => {
      if (event.target !== cell || event.isComposing || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      openLightbox(pack.id, index);
    });
    if (readonly) return cell;
    const bar = el3("div", "so-sprite-actions");
    const identity = {
      tag: sprite.tag,
      group: spriteGroup(sprite),
      outfit: sprite.outfit ?? ""
    };
    const context = actionContext(
      pack.id,
      (latest) => latest.sprites.find(
        (candidate) => candidate.tag === identity.tag && spriteGroup(candidate) === identity.group && (candidate.outfit ?? "") === identity.outfit
      ) ?? null,
      () => {
        render2();
        refreshLightbox();
      }
    );
    const sharedActions = createSpriteActions(context);
    for (const action of sharedActions) {
      const actionButton3 = iconButton(
        action.icon ?? action.label,
        action.label,
        () => runSpriteAction(action),
        "so-icon-btn",
        Boolean(action.disabled)
      );
      actionButton3.title = action.hint ?? action.label;
      bar.append(actionButton3);
    }
    bar.append(
      iconButton("◀", t("sprite.manager.content.move_earlier", "前移"), () => {
        const target = context.getPack();
        if (!target) return;
        commitPack(moveSprite(target, index, index - 1));
      }),
      iconButton("▶", t("sprite.manager.content.move_later", "后移"), () => {
        const target = context.getPack();
        if (!target) return;
        commitPack(moveSprite(target, index, index + 1));
      })
    );
    cell.append(bar);
    return cell;
  }
  function openUploadPreview(currentPackId, files, opener) {
    const fileArr = Array.from(files);
    const parsed = fileArr.map((f) => parseSpriteFileName(f.name));
    let autoSplit = false;
    let strategy = "skip";
    let uploading = false;
    const modal = el3("div", "so-upload-modal");
    const panel = el3("div", "so-upload-panel");
    const head = el3("div", "so-upload-head");
    const title2 = el3("b");
    title2.textContent = t("sprite.manager.content.upload.preview_title", "批量上传预览（{{p0}} 张）", { p0: fileArr.length });
    title2.id = nextManagerId();
    modal.setAttribute("aria-labelledby", title2.id);
    head.append(title2);
    const rows = el3("div", "so-upload-rows");
    const inputs = [];
    function buildRows() {
      rows.innerHTML = "";
      inputs.length = 0;
      fileArr.forEach((file, i) => {
        const row = el3("div", "so-upload-row");
        const name = el3("div", "so-upload-fname");
        name.textContent = file.name;
        name.title = file.name;
        const roleIn = textInput(t("sprite.manager.content.info.role", "人名"));
        const outfitIn = textInput(t("sprite.manager.content.info.outfit", "服装"));
        const tagIn = textInput(t("sprite.manager.content.info.image_name", "图名"));
        if (autoSplit) {
          roleIn.value = parsed[i].role;
          outfitIn.value = parsed[i].outfit;
          tagIn.value = parsed[i].tag;
        } else {
          roleIn.value = "";
          outfitIn.value = "";
          tagIn.value = normalizeTag(file.name.replace(/\.[^.]+$/, ""));
        }
        roleIn.disabled = !autoSplit;
        outfitIn.disabled = !autoSplit;
        inputs.push({ role: roleIn, outfit: outfitIn, tag: tagIn });
        row.append(
          name,
          labeled(t("sprite.manager.content.info.role", "人名"), roleIn),
          labeled(t("sprite.manager.content.info.outfit", "服装"), outfitIn),
          labeled(t("sprite.manager.content.info.image_name", "图名"), tagIn)
        );
        rows.append(row);
      });
    }
    buildRows();
    const opts = el3("div", "so-upload-opts");
    opts.append(
      checkboxRow(t("sprite.manager.content.upload.auto_split", "按文件名前缀自动拆分人名/服装（勾选后在下方预览拆分结果，可拆出新包）"), autoSplit, (v) => {
        autoSplit = v;
        buildRows();
      })
    );
    const stratWrap = el3("div", "so-row");
    const stratLabel = el3("span");
    stratLabel.textContent = t("sprite.manager.content.upload.conflict_label", "重名时：");
    stratLabel.id = nextManagerId();
    const stratSel = document.createElement("select");
    stratSel.className = "text_pole";
    stratSel.setAttribute("aria-labelledby", stratLabel.id);
    for (const [val, lab] of [
      ["skip", t("sprite.manager.content.upload.skip", "跳过（默认）")],
      ["rename", t("sprite.manager.content.upload.rename", "自动改名")],
      ["overwrite", t("sprite.manager.content.upload.overwrite", "覆盖")]
    ]) {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = lab;
      stratSel.append(o);
    }
    stratSel.addEventListener("change", () => strategy = stratSel.value);
    stratWrap.append(stratLabel, stratSel);
    opts.append(stratWrap);
    const status = el3("div", "so-upload-status");
    status.setAttribute("role", "status");
    const actions = el3("div", "so-row so-upload-actions");
    const confirmBtn = button(t("sprite.manager.content.upload.start", "开始上传"), () => {
      if (uploading) return;
      uploading = true;
      confirmBtn.setAttribute("aria-disabled", "true");
      confirmBtn.classList.add("disabled");
      const entries = fileArr.map((file, i) => ({
        fileName: file.name,
        role: autoSplit ? inputs[i].role.value : "",
        outfit: autoSplit ? inputs[i].outfit.value : "",
        tag: inputs[i].tag.value
      }));
      void applyUploadPlan(currentPackId, fileArr, entries, strategy, status, () => closeModal()).finally(
        () => {
          uploading = false;
          confirmBtn.removeAttribute("aria-disabled");
          confirmBtn.classList.remove("disabled");
        }
      );
    });
    const cancelBtn = button(
      t("common.cancel", "取消"),
      () => {
        if (!uploading) closeModal();
      },
      "so-btn-danger"
    );
    actions.append(
      confirmBtn,
      cancelBtn
    );
    panel.append(head, opts, actions, status, rows);
    modal.append(panel);
    (backdrop ?? document.body).append(modal);
    const closeModal = manageChildDialog(modal, () => !uploading, opener);
  }
  async function applyUploadPlan(currentPackId, files, entries, strategy, status, done) {
    const { autoUpload, imgbbApiKey } = deps.getSettings();
    const useImgbb = autoUpload && imgbbApiKey.trim() !== "";
    let added = 0;
    let conflicts = 0;
    let skipped = 0;
    let failed = 0;
    let unprocessed = 0;
    let hosted = 0;
    let hostFailed = 0;
    let opaqueImages = 0;
    let checkerboardImages = 0;
    const newPackIds = /* @__PURE__ */ new Map();
    function persisted(targetId, sprite) {
      return Boolean(
        deps.getSettings().packs.find((pack) => pack.id === targetId)?.sprites.some(
          (item) => item.tag === sprite.tag && item.url === sprite.url && item.code === sprite.code && item.remoteUrl === sprite.remoteUrl
        )
      );
    }
    function applyUploadSettings(result, wasPersisted) {
      if (!result.ok) {
        try {
          showConflicts(result.conflicts);
        } catch (error) {
          console.error("[sprite-overlay] 展示上传冲突失败", error);
        }
        return false;
      }
      try {
        deps.updateSettings(result.settings);
      } catch (error) {
        if (!wasPersisted()) throw error;
        console.warn("[sprite-overlay] 图片已保存，但后续界面刷新失败", error);
      }
      return true;
    }
    try {
      const current2 = deps.getSettings().packs.find((p) => p.id === currentPackId) ?? null;
      const plans = planUploads(entries, deps.getSettings().packs, strategy, current2?.name ?? "新包", current2);
      for (let i = 0; i < plans.length; i++) {
        const plan = plans[i];
        const file = files[i];
        status.textContent = t("sprite.manager.content.upload.progress", "处理中 {{p0}}/{{p1}}：{{p2}}", { p0: i + 1, p1: plans.length, p2: file.name });
        if (plan.action === "skip" || !plan.finalTag) {
          skipped++;
          continue;
        }
        try {
          const batchKey = JSON.stringify([plan.entry.role, plan.entry.outfit, plan.targetPackName]);
          const beforeId = plan.targetPackId ?? newPackIds.get(batchKey);
          const beforeTarget = deps.getSettings().packs.find((pack) => pack.id === beforeId);
          if (beforeId && !beforeTarget) throw new Error(t("sprite.manager.content.error.target_changed", "目标已更改，本次结果未应用"));
          const beforeUrl = beforeTarget ? sameSprite(beforeTarget, { tag: plan.finalTag, url: "" })?.url : void 0;
          const result = await compressImage(file);
          if (result.transparency === "opaque-checkerboard") checkerboardImages += 1;
          else if (result.transparency === "opaque") opaqueImages += 1;
          const url = await deps.adapter.saveImage(
            file.name,
            result.dataUri,
            plan.targetPackName
            // 显示提示；物理文件身份由适配器独立生成
          );
          if (!localUserImagePath(url)) throw new Error(t("sprite.manager.content.error.unsafe_local", "保存失败：平台未返回安全的本地用户图片地址"));
          let targetId = plan.targetPackId;
          if (!targetId) {
            const role = plan.entry.role;
            const outfit = plan.entry.outfit;
            const key = JSON.stringify([role, outfit, plan.targetPackName]);
            targetId = newPackIds.get(key) ?? null;
            if (!targetId) {
              const np = {
                id: genId(),
                name: plan.targetPackName,
                author: "我",
                ...role ? { roleName: role } : {},
                ...outfit ? { outfit } : {},
                sprites: []
              };
              if (!applyUploadSettings(
                upsertPack(deps.getSettings(), np),
                () => deps.getSettings().packs.some((pack) => pack.id === np.id)
              )) {
                conflicts++;
                unprocessed = plans.length - i - 1;
                break;
              }
              targetId = np.id;
              newPackIds.set(key, targetId);
            }
          }
          const target = deps.getSettings().packs.find((p) => p.id === targetId);
          if (!target) {
            failed++;
            continue;
          }
          const latestSprite = sameSprite(target, { tag: plan.finalTag, url: "" });
          if (latestSprite?.url !== beforeUrl) throw new Error(t("sprite.manager.content.error.target_changed", "目标已更改，本次结果未应用"));
          const sprite = { ...latestSprite, tag: plan.finalTag, url };
          delete sprite.code;
          delete sprite.remoteUrl;
          if (!applyUploadSettings(
            upsertPack(deps.getSettings(), upsertSprite(target, sprite)),
            () => persisted(targetId, sprite)
          )) {
            conflicts++;
            unprocessed = plans.length - i - 1;
            break;
          }
          added++;
          if (useImgbb) {
            try {
              const up = await uploadToImgbb(imgbbApiKey, result.dataUri);
              if (isValidImgbbResult(up)) {
                const latest = deps.getSettings().packs.find((p) => p.id === targetId);
                const latestSprite2 = latest ? sameSprite(latest, sprite) : null;
                if (latest && latestSprite2?.url === url) {
                  const hostedSprite = { ...latestSprite2, code: up.code, remoteUrl: up.url };
                  if (applyUploadSettings(
                    upsertPack(deps.getSettings(), upsertSprite(latest, hostedSprite)),
                    () => persisted(targetId, hostedSprite)
                  )) hosted++;
                  else hostFailed++;
                } else {
                  hostFailed++;
                }
              } else {
                hostFailed++;
              }
            } catch (err) {
              console.warn("[sprite-overlay] imgbb 上传失败（图片保留本地）", err);
              hostFailed++;
            }
          }
        } catch (err) {
          console.error("[sprite-overlay] 上传失败", err);
          failed++;
        }
      }
    } catch (error) {
      console.error("[sprite-overlay] 上传批次失败", error);
      failed++;
      unprocessed = Math.max(0, files.length - added - conflicts - skipped - failed);
    } finally {
      try {
        done();
      } catch (error) {
        console.error("[sprite-overlay] 关闭上传窗口失败", error);
      }
      try {
        render2();
      } catch (error) {
        console.error("[sprite-overlay] 上传后刷新失败", error);
      }
      const parts = [
        t("sprite.manager.content.upload.result_success", "成功 {{p0}} 张", { p0: added }),
        t("sprite.manager.content.upload.result_conflict", "冲突 {{p0}} 张", { p0: conflicts }),
        t("sprite.manager.content.upload.result_failed", "失败 {{p0}} 张", { p0: failed }),
        t("sprite.manager.content.upload.result_unprocessed", "未处理 {{p0}} 张", { p0: unprocessed })
      ];
      if (skipped > 0) parts.push(t("sprite.manager.content.upload.result_skipped", "跳过 {{p0}} 张（重名/无效）", { p0: skipped }));
      if (useImgbb) parts.push(t("sprite.manager.content.upload.result_hosted", "imgbb 成功 {{p0}}{{p1}}", { p0: hosted, p1: hostFailed > 0 ? t("sprite.manager.content.upload.host_failed_suffix", "、失败 {{p0}}", { p0: hostFailed }) : "" }));
      if (checkerboardImages > 0) {
        parts.push(t("sprite.manager.content.upload.checkerboard_warning", "警告：{{p0}} 张疑似把棋盘格烤进图片，插件无法安全自动去除", { p0: checkerboardImages }));
      }
      if (opaqueImages > 0) {
        parts.push(t("sprite.manager.content.upload.opaque_notice", "提示：{{p0}} 张没有透明像素，作为立绘时会显示完整背景", { p0: opaqueImages }));
      }
      try {
        toast(backdrop?.querySelector(".so-manager-body"), parts.join("，"));
      } catch (error) {
        console.error("[sprite-overlay] 展示上传结果失败", error);
      }
    }
  }
  async function retryPendingUploads(body, packId) {
    const { imgbbApiKey } = deps.getSettings();
    if (!imgbbApiKey.trim()) {
      toast(body, t("sprite.manager.content.upload.api_key", "请先在「图库」App 配置 imgbb API Key"));
      return;
    }
    const pack = deps.getSettings().packs.find((p) => p.id === packId);
    if (!pack) return;
    const pending = pack.sprites.filter(
      (s) => getSpriteSource(s) !== "hosted" && !(s.remoteUrl && /^https?:\/\//.test(s.remoteUrl))
    );
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < pending.length; i++) {
      const sprite = pending[i];
      const beforeUrl = sprite.url;
      toast(body, t("sprite.manager.content.upload.retry_progress", "补传中 {{p0}}/{{p1}}：{{p2}}", { p0: i + 1, p1: pending.length, p2: sprite.tag }));
      try {
        const dataUri = beforeUrl.startsWith("data:") ? beforeUrl : await urlToDataUri(beforeUrl);
        const up = await uploadToImgbb(imgbbApiKey, dataUri);
        if (!isValidImgbbResult(up)) {
          fail++;
          continue;
        }
        const latest = deps.getSettings().packs.find((p) => p.id === packId);
        const target = latest?.sprites.find(
          (s) => s.tag === sprite.tag && (s.group ?? "") === (sprite.group ?? "") && (s.outfit ?? "") === (sprite.outfit ?? "")
        );
        if (!latest || !target || target.url !== beforeUrl) {
          fail++;
          continue;
        }
        if (!updateChecked(
          upsertPack(
            deps.getSettings(),
            upsertSprite(latest, { ...target, code: up.code, remoteUrl: up.url })
          )
        )) return;
        ok++;
      } catch (err) {
        console.warn("[sprite-overlay] 补传失败", err);
        fail++;
      }
    }
    render2();
    toast(
      backdrop?.querySelector(".so-manager-body"),
      t("sprite.manager.content.upload.retry_complete", "补传完成：成功 {{p0}} 张{{p1}}", { p0: ok, p1: fail > 0 ? t("sprite.manager.content.upload.retry_failed_suffix", "，失败 {{p0}} 张（可再次点击重试）", { p0: fail }) : "" })
    );
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    close();
  }
  return { open, close, destroy, refreshIfOpen };
}
function el3(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}
function textInput(placeholder) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "text_pole";
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder);
  input.dataset.managerFocus = `input:${placeholder}`;
  return input;
}
function labeled(label, input) {
  const wrap = el3("label", "so-labeled");
  const span = el3("span", "so-labeled-text");
  span.id = nextManagerId();
  span.textContent = label;
  input.setAttribute("aria-labelledby", span.id);
  input.dataset.managerFocus = `field:${label}`;
  wrap.append(span, input);
  return wrap;
}
function checkboxRow(label, checked, onChange) {
  const row = el3("label", "so-row checkbox_label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.dataset.managerFocus = `checkbox:${label}`;
  input.addEventListener("change", () => onChange(input.checked));
  const span = document.createElement("span");
  span.textContent = label;
  row.append(input, span);
  return row;
}
function button(label, onClick, extraClass = "") {
  const btn = el3("div", `menu_button so-btn ${extraClass}`.trim());
  btn.setAttribute("role", "button");
  btn.tabIndex = 0;
  btn.textContent = label;
  btn.dataset.managerFocus = `button:${label}`;
  btn.addEventListener("click", onClick);
  btn.addEventListener("keydown", (e) => {
    if (!e.isComposing && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  });
  return btn;
}
function iconButton(icon, title2, onClick, className = "so-icon-btn", disabled = false) {
  const btn = el3("div", className);
  btn.textContent = icon;
  btn.title = title2;
  btn.setAttribute("role", "button");
  btn.setAttribute("aria-label", title2);
  btn.setAttribute("aria-disabled", String(disabled));
  btn.tabIndex = disabled ? -1 : 0;
  btn.dataset.managerFocus = `icon:${title2}`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!disabled) onClick();
  });
  btn.addEventListener("keydown", (event) => {
    if (event.isComposing || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) onClick();
  });
  return btn;
}
function statusBar() {
  const status = el3("div", "so-status so-toast");
  status.setAttribute("role", "status");
  return status;
}
function addCardNavigation(card, selector2) {
  card.addEventListener("keydown", (event) => {
    if (event.target !== card || event.isComposing || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const cards = [...card.closest(".so-manager-body")?.querySelectorAll(selector2) ?? []];
    const index = cards.indexOf(card);
    if (index < 0) return;
    let target = index;
    if (event.key === "Home") target = 0;
    else if (event.key === "End") target = cards.length - 1;
    else if (event.key === "ArrowLeft") target--;
    else if (event.key === "ArrowRight") target++;
    else {
      const rect = card.getBoundingClientRect();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const candidates = cards.map((node, i) => ({ i, rect: node.getBoundingClientRect() })).filter((item) => direction * (item.rect.top - rect.top) > 1).sort((a, b) => Math.abs(a.rect.top - rect.top) - Math.abs(b.rect.top - rect.top) || Math.abs(a.rect.left - rect.left) - Math.abs(b.rect.left - rect.left));
      target = candidates[0]?.i ?? index + direction;
    }
    event.preventDefault();
    event.stopPropagation();
    cards[Math.max(0, Math.min(cards.length - 1, target))]?.focus();
  });
}
function toast(scope, msg) {
  const bar = scope?.querySelector(".so-toast");
  if (!bar) return;
  bar.textContent = msg;
  setTimeout(() => {
    if (bar.textContent === msg) bar.textContent = "";
  }, 4e3);
}
function pickFile(accept, multiple, onPick) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.multiple = multiple;
  input.addEventListener("change", () => {
    if (input.files && input.files.length > 0) onPick(input.files);
  });
  input.click();
}
function downloadJson2(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
async function copyText(text4) {
  try {
    await navigator.clipboard.writeText(text4);
    return true;
  } catch {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = opener?.closest('[role="dialog"]') ?? document.body;
    const ta = document.createElement("textarea");
    try {
      ta.value = text4;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.tabIndex = -1;
      container.append(ta);
      ta.focus({ preventScroll: true });
      ta.select();
      if (document.activeElement !== ta || ta.selectionStart !== 0 || ta.selectionEnd !== text4.length) return false;
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      ta.remove();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    }
  }
}

// st-extension/src/settings-panel.ts
function mountSettingsPanel(deps) {
  const container = document.getElementById("extensions_settings");
  if (!container) {
    console.warn("[sprite-overlay] 未找到 #extensions_settings，设置面板未挂载");
    return () => {
    };
  }
  const wrapper = document.createElement("div");
  wrapper.className = "sprite-overlay-settings";
  wrapper.innerHTML = `
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>百工</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content" id="so-panel-content"></div>
    </div>
  `;
  container.append(wrapper);
  const content = wrapper.querySelector("#so-panel-content");
  const settings = deps.getSettings();
  content.append(
    checkboxRow2(
      t("settings.enable_sprites", "启用立绘功能"),
      settings.enabled,
      (v) => deps.updateSettings({ ...deps.getSettings(), enabled: v }),
      t("settings.sprites_help", "总开关：注入立绘清单给 AI 并展示回复中的立绘。关闭后清空注入、停止解析、隐藏悬浮窗并把楼层恢复原文；手机与其他工具不受影响。")
    ),
    checkboxRow2(
      t("settings.show_phone", "显示手机"),
      settings.showPhone,
      (v) => deps.updateSettings({ ...deps.getSettings(), showPhone: v }),
      t("settings.phone_help", "屏幕上显示可拖动的 📱 图标，点击展开小手机——所有功能 App 的统一入口。")
    )
  );
  const hint = document.createElement("div");
  hint.className = "so-status";
  const version = false ? "" : ` v${"0.9.0"}`;
  hint.textContent = t("settings.hint", "酒馆里的事，百工都做。立绘显示/轮播/Prompt 设置在手机「立绘」App；图包管理与图床设置在手机「图库」App。") + version;
  content.append(hint);
  return () => wrapper.remove();
}
function helpIcon(tip) {
  const icon = document.createElement("span");
  icon.className = "so-help";
  icon.textContent = "?";
  icon.tabIndex = 0;
  icon.setAttribute("aria-label", tip);
  icon.dataset.tip = tip;
  icon.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  return icon;
}
function checkboxRow2(label, checked, onChange, help) {
  const row = document.createElement("label");
  row.className = "so-row checkbox_label";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const span = document.createElement("span");
  span.textContent = label;
  if (help) span.append(helpIcon(help));
  row.append(input, span);
  return row;
}

// core/inline-image.ts
var HTML_STYLE_SOURCE = "<\\s*(img|illustration)\\s*>\\s*([^<]+?)\\s*<\\/\\s*\\1\\s*>";
var BRACKET_STYLE_SOURCE = "[\\[【]\\s*(插图|图)\\s*[:：]\\s*([^\\]】]+?)\\s*[\\]】]";
var COMBINED_SOURCE = `${HTML_STYLE_SOURCE}|${BRACKET_STYLE_SOURCE}`;
function hasInlineImageMarkup(text4) {
  return new RegExp(COMBINED_SOURCE, "i").test(text4);
}
function replaceInlineImages(text4, replacer) {
  const regex = new RegExp(COMBINED_SOURCE, "gi");
  return text4.replace(regex, (raw, ...groups) => {
    const code = (groups[1] ?? groups[3] ?? "").trim();
    if (!isValidImageCode(code)) return raw;
    const out = replacer({ raw, code });
    return out === null ? raw : out;
  });
}

// st-extension/src/apps/newvar/config.ts
var NEWVAR_APP_ID = "newvar";
var NEWVAR_CHANNEL = "newvar";
var NEWVAR_EXTRA_KEY = "st_stage_newvar";
function defaultNewvarData() {
  return {
    enabled: false,
    hideUpdateBlocks: true,
    format: "json_patch",
    injectionDepth: 4,
    schema: { id: "default", name: "默认方案", version: 1, variables: [] },
    customTemplates: []
  };
}
var VAR_TYPES = ["number", "string", "boolean", "enum"];
function normalizeNewvarData(raw) {
  const d = defaultNewvarData();
  if (!raw || typeof raw !== "object") return d;
  const r = raw;
  if (typeof r.enabled === "boolean") d.enabled = r.enabled;
  if (typeof r.hideUpdateBlocks === "boolean") d.hideUpdateBlocks = r.hideUpdateBlocks;
  if (r.format === "json_patch" || r.format === "lodash_set") d.format = r.format;
  if (typeof r.injectionDepth === "number" && Number.isInteger(r.injectionDepth)) {
    d.injectionDepth = Math.min(100, Math.max(0, r.injectionDepth));
  }
  const schema = r.schema;
  if (schema && typeof schema === "object") {
    const s = schema;
    if (typeof s.id === "string" && s.id) d.schema.id = s.id;
    if (typeof s.name === "string" && s.name) d.schema.name = s.name;
    if (typeof s.version === "number") d.schema.version = s.version;
    if (Array.isArray(s.variables)) {
      d.schema.variables = s.variables.map(normalizeDefinition).filter((v) => v !== null);
    }
  }
  if (Array.isArray(r.customTemplates)) {
    d.customTemplates = r.customTemplates.map(normalizeCustomTemplate).filter((t2) => t2 !== null);
  }
  return d;
}
function normalizeCustomTemplate(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  if (typeof r.id !== "string" || r.id === "" || typeof r.name !== "string" || r.name === "") return null;
  const variables = Array.isArray(r.variables) ? r.variables.map(normalizeDefinition).filter((v) => v !== null) : [];
  if (variables.length === 0) return null;
  return {
    id: r.id,
    name: r.name,
    description: typeof r.description === "string" ? r.description : "",
    variables
  };
}
function normalizeDefinition(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  if (typeof r.key !== "string" || r.key.trim() === "" || !isSafePath(r.key.trim())) return null;
  const type = VAR_TYPES.includes(r.type) ? r.type : "string";
  const def = {
    key: r.key.trim(),
    type,
    default: r.default,
    description: typeof r.description === "string" ? r.description : ""
  };
  if (r.hidden === true) def.hidden = true;
  if (typeof r.updateRule === "string" && r.updateRule.trim() !== "") def.updateRule = r.updateRule;
  if (type === "number" && Array.isArray(r.range) && r.range.length === 2 && typeof r.range[0] === "number" && typeof r.range[1] === "number" && Number.isFinite(r.range[0]) && Number.isFinite(r.range[1]) && r.range[0] <= r.range[1]) {
    def.range = [r.range[0], r.range[1]];
  }
  if (type === "enum") {
    const options = Array.isArray(r.enum) ? r.enum.filter((x) => typeof x === "string" && x !== "") : [];
    if (options.length === 0) return null;
    def.enum = options;
  }
  def.default = coerceDefault(def, def.default);
  return def;
}
function coerceDefault(def, raw) {
  switch (def.type) {
    case "number": {
      const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
      if (def.range) return Math.min(def.range[1], Math.max(def.range[0], n));
      return n;
    }
    case "boolean":
      return typeof raw === "boolean" ? raw : false;
    case "enum": {
      const options = def.enum ?? [];
      return typeof raw === "string" && options.includes(raw) ? raw : options[0];
    }
    default:
      return typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  }
}

// st-extension/src/message-postprocess.ts
var FP_ATTR = "data-so-fp";
var MARKER_CLASS = "so-processed-marker";
var snapshots = /* @__PURE__ */ new WeakMap();
var postprocessControllers = /* @__PURE__ */ new Set();
function updateBlockRanges(text4) {
  const pattern = /<UpdateVariable(?:\s[^>]*)?>[\s\S]*?<\/UpdateVariable\s*>/gi;
  return Array.from(text4.matchAll(pattern), (match) => ({
    start: match.index,
    end: match.index + match[0].length
  }));
}
function hasUpdateBlock(text4) {
  return updateBlockRanges(text4).length > 0;
}
function stripMarkdownFence(text4) {
  const match = /^\s*```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/i.exec(text4);
  return match ? match[1] : null;
}
function visibleUpdateVariants(inner) {
  const withAnalysis = inner.replace(/<Analysis(?:\s[^>]*)?>/gi, "").replace(/<\/Analysis\s*>/gi, "");
  const withoutAnalysis = inner.replace(/<Analysis(?:\s[^>]*)?>[\s\S]*?<\/Analysis\s*>/gi, "");
  const variants = [withAnalysis, withoutAnalysis];
  const normalized = /* @__PURE__ */ new Set();
  for (const variant of variants) {
    const fenced = stripMarkdownFence(variant);
    for (const candidate of fenced === null ? [variant] : [variant, fenced]) {
      const value = normalizeWhitespace(candidate);
      if (value) normalized.add(value);
    }
  }
  return [...normalized];
}
function compactVisibleProjection(text4) {
  return text4.replace(/<(?:thinking|reasoning|summary|history)(?:\s[^>]*)?>[\s\S]*?<\/(?:thinking|reasoning|summary|history)\s*>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "").replace(/```(?:json)?/gi, "").replace(/\s+/g, "");
}
function edgeAnchors(text4, edge) {
  const lengths = [48, 24, 12, 8, 6, 4];
  const anchors = [];
  for (const length of lengths) {
    if (text4.length < length) continue;
    const anchor = edge === "start" ? text4.slice(0, length) : text4.slice(-length);
    if (!anchors.includes(anchor)) anchors.push(anchor);
  }
  if (anchors.length === 0 && text4) anchors.push(text4);
  return anchors;
}
function rawContextMatches(rawPrefix, rawSuffix, visibleText, start, end) {
  const prefix = compactVisibleProjection(rawPrefix);
  const suffix = compactVisibleProjection(rawSuffix);
  const before = visibleText.slice(0, start).replace(/\s+/g, "");
  const after = visibleText.slice(end).replace(/\s+/g, "");
  const prefixMatches = !prefix || edgeAnchors(prefix, "end").some((anchor) => before.includes(anchor));
  const suffixMatches = !suffix || edgeAnchors(suffix, "start").some((anchor) => after.includes(anchor));
  return prefixMatches && suffixMatches;
}
function sanitizedUpdateRange(rawMessage, visibleText) {
  if (rawMessage === null) return null;
  const openings = rawMessage.match(/<UpdateVariable(?:\s[^>]*)?>/gi) ?? [];
  const closings = rawMessage.match(/<\/UpdateVariable\s*>/gi) ?? [];
  if (openings.length !== 1 || closings.length !== 1) return null;
  const block = /<UpdateVariable(?:\s[^>]*)?>([\s\S]*?)<\/UpdateVariable\s*>/i.exec(rawMessage);
  if (!block) return null;
  const visible = normalizeWhitespaceWithOffsets(visibleText);
  const rawStart = block.index;
  const rawEnd = rawStart + block[0].length;
  for (const candidate of visibleUpdateVariants(block[1])) {
    const matches = [];
    let from = 0;
    while (from <= visible.text.length - candidate.length) {
      const index = visible.text.indexOf(candidate, from);
      if (index < 0) break;
      matches.push(index);
      if (matches.length > 1) break;
      from = index + 1;
    }
    if (matches.length !== 1) continue;
    const startIndex = matches[0];
    const start = visible.starts[startIndex];
    const end = visible.ends[startIndex + candidate.length - 1];
    if (!rawContextMatches(rawMessage.slice(0, rawStart), rawMessage.slice(rawEnd), visibleText, start, end)) {
      continue;
    }
    return { start, end };
  }
  return null;
}
function normalizeWhitespace(text4) {
  return text4.replace(/\s+/g, " ").trim();
}
function normalizeWhitespaceWithOffsets(text4) {
  let normalized = "";
  const starts = [];
  const ends = [];
  let index = 0;
  while (index < text4.length) {
    const start = index;
    if (/\s/.test(text4[index])) {
      while (index < text4.length && /\s/.test(text4[index])) index += 1;
      normalized += " ";
    } else {
      index += 1;
      normalized += text4[start];
    }
    starts.push(start);
    ends.push(index);
  }
  let first = 0;
  let last = normalized.length;
  while (first < last && normalized[first] === " ") first += 1;
  while (last > first && normalized[last - 1] === " ") last -= 1;
  return {
    text: normalized.slice(first, last),
    starts: starts.slice(first, last),
    ends: ends.slice(first, last)
  };
}
function removeTextRanges(root, ranges) {
  if (ranges.length === 0) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let current2;
  while (current2 = walker.nextNode()) {
    const node = current2;
    const value = node.nodeValue ?? "";
    const nodeStart = offset;
    const nodeEnd = nodeStart + value.length;
    offset = nodeEnd;
    const cuts = ranges.filter((range) => range.start < nodeEnd && range.end > nodeStart).map((range) => ({
      start: Math.max(0, range.start - nodeStart),
      end: Math.min(value.length, range.end - nodeStart)
    }));
    if (cuts.length === 0) continue;
    let kept = "";
    let cursor = 0;
    for (const cut of cuts) {
      kept += value.slice(cursor, cut.start);
      cursor = Math.max(cursor, cut.end);
    }
    node.nodeValue = kept + value.slice(cursor);
  }
}
function mountMessagePostprocess(deps) {
  const st = window.SillyTavern;
  if (!st) return () => {
  };
  const ctx = st.getContext();
  const renderedEvents = [...new Set([
    ctx.eventTypes?.CHARACTER_MESSAGE_RENDERED,
    ctx.eventTypes?.USER_MESSAGE_RENDERED,
    ctx.eventTypes?.MESSAGE_UPDATED
  ].filter((e) => typeof e === "string" && e.length > 0))];
  let active = true;
  const pendingTimers = /* @__PURE__ */ new Set();
  if (deps.getRawMessage || deps.decorateImages || deps.cleanupImages || deps.processMessage || deps.reprocessMessages || deps.cleanupMessages) {
    postprocessControllers.add(deps);
  }
  const cleanup = (unsubscribe) => {
    if (!active) return;
    active = false;
    unsubscribe();
    for (const timer of pendingTimers) clearTimeout(timer);
    pendingTimers.clear();
    deps.cleanupImages?.();
    deps.cleanupMessages?.();
    postprocessControllers.delete(deps);
  };
  const processRendered = (messageId) => {
    let rawMessage = null;
    if (typeof messageId === "string" || typeof messageId === "number") {
      try {
        rawMessage = deps.getRawMessage?.(messageId) ?? null;
      } catch (error) {
        console.warn("[sprite-overlay] 读取原始消息失败，变量块仅按可见标签处理", error);
      }
    }
    processMessages(deps.getSettings(), messageId, rawMessage);
    const bodies = [];
    if (messageId === null || messageId === void 0 || `${messageId}` === "") {
      bodies.push(...Array.from(document.querySelectorAll("#chat .mes .mes_text")));
      for (const body of bodies) deps.processMessage?.(body);
      deps.decorateImages?.(document);
      return;
    }
    const id = `${messageId}`;
    for (const message of Array.from(document.querySelectorAll("#chat .mes"))) {
      if (message.getAttribute("mesid") !== id) continue;
      const body = message.querySelector(".mes_text");
      if (body) {
        bodies.push(body);
        deps.processMessage?.(body);
      }
      deps.decorateImages?.(message);
    }
  };
  const handler = (...args) => {
    const messageId = typeof args[0] === "number" || typeof args[0] === "string" ? args[0] : null;
    queueMicrotask(() => {
      if (active) processRendered(messageId);
    });
  };
  if (renderedEvents.length > 0) {
    for (const event of renderedEvents) ctx.eventSource.on(event, handler);
    return () => cleanup(() => {
      for (const event of renderedEvents) ctx.eventSource.removeListener(event, handler);
    });
  }
  const fallbackEvent = ctx.eventTypes?.MESSAGE_RECEIVED ?? "message_received";
  const fallbackHandler = (...args) => {
    const messageId = typeof args[0] === "number" || typeof args[0] === "string" ? args[0] : null;
    const timer = setTimeout(() => {
      pendingTimers.delete(timer);
      if (active) processRendered(messageId);
    }, 150);
    pendingTimers.add(timer);
  };
  ctx.eventSource.on(fallbackEvent, fallbackHandler);
  return () => cleanup(() => ctx.eventSource.removeListener(fallbackEvent, fallbackHandler));
}
function anyFeatureOn(settings) {
  const spritesOn = settings.enabled && (settings.hideTagInMessage || settings.renderInlineImages || settings.spriteDisplayMode !== "overlay");
  const newvar = normalizeNewvarData(settings.apps[NEWVAR_APP_ID]);
  return spritesOn || newvar.enabled && newvar.hideUpdateBlocks;
}
function clampFloors(settings) {
  const n = Math.round(settings.recentFloors);
  if (!Number.isFinite(n)) return RECENT_FLOORS_MIN;
  return Math.min(RECENT_FLOORS_MAX, Math.max(RECENT_FLOORS_MIN, n));
}
function originalTextOf(el4) {
  return snapshots.get(el4)?.originalText ?? el4.textContent ?? "";
}
function collectCandidates(extraCandidates = /* @__PURE__ */ new Set()) {
  const out = [];
  for (const mes of Array.from(document.querySelectorAll("#chat .mes"))) {
    if (mes.getAttribute("is_user") === "true" || mes.getAttribute("is_system") === "true") continue;
    const textEl = mes.querySelector(".mes_text");
    if (!textEl) continue;
    const text4 = originalTextOf(textEl);
    if (hasTag(text4) || hasInlineImageMarkup(text4) || hasUpdateBlock(text4) || extraCandidates.has(textEl)) {
      out.push(textEl);
    }
  }
  return out;
}
function processMessages(settings, messageId = null, rawMessage = null) {
  if (!anyFeatureOn(settings)) return;
  if (messageId !== null && messageId !== void 0 && `${messageId}` !== "") {
    const idStr = `${messageId}`;
    const allMes = Array.from(document.querySelectorAll("#chat .mes"));
    const scope = allMes.filter((m) => m.getAttribute("mesid") === idStr).map((m) => m.querySelector(".mes_text")).filter((el4) => el4 !== null);
    const lastMes = allMes.length > 0 ? allMes[allMes.length - 1] : null;
    let windowSet = null;
    for (const el4 of scope) {
      if (lastMes !== null && el4.closest(".mes") === lastMes) {
        processMessageElement(el4, settings, rawMessage);
        continue;
      }
      const rawCandidate = rawMessage !== null && sanitizedUpdateRange(rawMessage, originalTextOf(el4)) !== null ? /* @__PURE__ */ new Set([el4]) : void 0;
      windowSet ?? (windowSet = new Set(collectCandidates(rawCandidate).slice(-clampFloors(settings))));
      if (windowSet.has(el4)) processMessageElement(el4, settings, rawMessage);
    }
    return;
  }
  for (const el4 of collectCandidates().slice(-clampFloors(settings))) {
    processMessageElement(el4, settings);
  }
}
function reprocessAllMessages(settings) {
  restoreAllMessages();
  if (anyFeatureOn(settings)) {
    const rawGetters = [...postprocessControllers].map((controller) => controller.getRawMessage).filter((getter) => getter !== void 0);
    if (rawGetters.length === 0) {
      processMessages(settings);
    } else {
      for (const message of Array.from(document.querySelectorAll("#chat .mes"))) {
        const messageId = message.getAttribute("mesid");
        if (messageId === null) continue;
        let rawMessage = null;
        for (const getter of rawGetters) {
          try {
            rawMessage = getter(messageId);
          } catch (error) {
            console.warn("[sprite-overlay] 读取原始消息失败，变量块仅按可见标签处理", error);
          }
          if (rawMessage !== null) break;
        }
        processMessages(settings, messageId, rawMessage);
      }
    }
  }
  for (const controller of postprocessControllers) {
    controller.reprocessMessages?.();
    controller.decorateImages?.(document);
  }
}
function restoreAllMessages() {
  for (const controller of postprocessControllers) controller.cleanupImages?.();
  for (const node of Array.from(document.querySelectorAll(`#chat .mes_text[${FP_ATTR}]`))) {
    restoreElement(node);
  }
}
function restoreElement(root) {
  const snap = snapshots.get(root);
  const isOurs = root.querySelector(`.${MARKER_CLASS}`) !== null;
  if (snap && isOurs) {
    root.replaceChildren(...snap.nodes);
  }
  snapshots.delete(root);
  root.removeAttribute(FP_ATTR);
}
function hashText(text4) {
  let h = 5381;
  for (let i = 0; i < text4.length; i++) {
    h = (h << 5) + h + text4.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(36);
}
function processMessageElement(root, settings, rawMessage = null) {
  const inlineSprites = settings.spriteDisplayMode !== "overlay";
  const host = settings.imageHost.endsWith("/") ? settings.imageHost : `${settings.imageHost}/`;
  const newvar = normalizeNewvarData(settings.apps[NEWVAR_APP_ID]);
  const hideUpdateBlocks = newvar.enabled && newvar.hideUpdateBlocks;
  const snap = snapshots.get(root);
  const contentIsOurs = snap !== void 0 && root.querySelector(`.${MARKER_CLASS}`) !== null;
  const originalText = contentIsOurs ? snap.originalText : root.textContent ?? "";
  const fingerprint = `${settings.hideTagInMessage ? "T" : ""}${settings.renderInlineImages ? "I" : ""}${inlineSprites ? "S" : ""}${hideUpdateBlocks ? "V" : ""}|${hashText(host)}|${hashText(originalText)}|${rawMessage === null ? "" : hashText(rawMessage)}`;
  if (contentIsOurs && root.getAttribute(FP_ATTR) === fingerprint) return;
  if (contentIsOurs) {
    root.replaceChildren(...snap.nodes);
  }
  snapshots.delete(root);
  root.removeAttribute(FP_ATTR);
  const chName = inlineSprites ? root.closest(".mes")?.getAttribute("ch_name") ?? "" : "";
  const packs = chName ? getActivePacks(settings, chName) : [];
  const hasPacks = packs.length > 0;
  const approxCache = { current: null };
  const freshText = root.textContent ?? "";
  const literalUpdateRanges = hideUpdateBlocks ? updateBlockRanges(freshText) : [];
  const sanitizedRange = hideUpdateBlocks && literalUpdateRanges.length === 0 ? sanitizedUpdateRange(rawMessage, freshText) : null;
  const updateRanges = sanitizedRange ? [sanitizedRange] : literalUpdateRanges;
  const tagged = hasTag(freshText);
  const needsWork = settings.hideTagInMessage && tagged || inlineSprites && hasPacks && tagged || settings.renderInlineImages && hasInlineImageMarkup(freshText) || updateRanges.length > 0;
  if (!needsWork) return;
  snapshots.set(root, {
    nodes: Array.from(root.childNodes).map((n) => n.cloneNode(true)),
    originalText: freshText
  });
  if (hideUpdateBlocks) removeTextRanges(root, updateRanges);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let current2;
  while (current2 = walker.nextNode()) {
    textNodes.push(current2);
  }
  for (const textNode of textNodes) {
    const text4 = textNode.nodeValue ?? "";
    if (!text4) continue;
    const nodeTagged = hasTag(text4);
    const needsSprites = inlineSprites && hasPacks && nodeTagged;
    const needsStrip = settings.hideTagInMessage && nodeTagged && !needsSprites;
    const needsImages = settings.renderInlineImages && hasInlineImageMarkup(text4);
    if (!needsSprites && !needsStrip && !needsImages) continue;
    let processed = needsStrip ? stripTags(text4) : text4;
    const elements = [];
    const marker = (el4) => `\0${elements.push(el4) - 1}\0`;
    if (needsSprites && hasPacks) {
      processed = replaceTags(processed, (address, raw) => {
        const sprite = resolveWithApprox(
          packs,
          address,
          resolveSprite,
          settings.approxMatch,
          approxCache
        );
        if (!sprite) return settings.hideTagInMessage ? "" : null;
        const image = createImage(sprite.url, sprite.tag, "so-inline-sprite");
        const imageMarker = marker(image);
        return settings.hideTagInMessage ? imageMarker : `${raw}${imageMarker}`;
      });
    }
    if (needsImages) {
      processed = replaceInlineImages(processed, (m) => marker(createImage(host + m.code, m.code)));
    }
    if (elements.length === 0) {
      if (processed !== text4) textNode.nodeValue = processed;
      continue;
    }
    const fragment = document.createDocumentFragment();
    processed.split("\0").forEach((part, i) => {
      if (i % 2 === 1) fragment.append(elements[Number(part)]);
      else if (part) fragment.append(document.createTextNode(part));
    });
    textNode.replaceWith(fragment);
  }
  const processedMark = document.createElement("span");
  processedMark.className = MARKER_CLASS;
  processedMark.hidden = true;
  root.prepend(processedMark);
  root.setAttribute(FP_ATTR, fingerprint);
}
function createImage(src, alt, extraClass = "") {
  const wrap = document.createElement("span");
  wrap.className = extraClass ? `so-inline-image ${extraClass}` : "so-inline-image";
  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  img.loading = "lazy";
  img.addEventListener("error", () => {
    wrap.classList.add("so-inline-image-error");
    wrap.title = t("imageActions.retry_load", "图片加载失败，点击重试");
    wrap.setAttribute("role", "button");
    wrap.setAttribute("aria-label", wrap.title);
    wrap.tabIndex = 0;
  });
  img.addEventListener("load", () => {
    wrap.classList.remove("so-inline-image-error");
    wrap.removeAttribute("title");
    wrap.removeAttribute("role");
    wrap.removeAttribute("aria-label");
    wrap.removeAttribute("tabindex");
  });
  wrap.addEventListener("click", () => {
    if (!wrap.classList.contains("so-inline-image-error")) return;
    img.src = src.startsWith("data:") ? src : `${src}${src.includes("?") ? "&" : "?"}so_retry=${Date.now()}`;
  });
  wrap.addEventListener("keydown", (event) => {
    if (event.target !== wrap || !wrap.classList.contains("so-inline-image-error") || event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    wrap.click();
  });
  wrap.append(img);
  return wrap;
}

// st-extension/src/story-image-capture.ts
var ACTION_CLASS = "so-story-save-action";
function createStoryImageCapture(deps) {
  const decorations = /* @__PURE__ */ new Map();
  const release = (action, image, handler) => {
    action.removeEventListener("click", handler);
    action.remove();
    delete image.dataset.soStorySave;
    decorations.delete(action);
  };
  const pruneDetached = () => {
    for (const [action, { image, handler }] of decorations) {
      if (!action.isConnected || !image.isConnected) release(action, image, handler);
    }
  };
  const decorate = (root) => {
    pruneDetached();
    for (const image of Array.from(root.querySelectorAll("img"))) {
      if (!isEligible(image) || image.dataset.soStorySave === "true") continue;
      const action = document.createElement("button");
      action.type = "button";
      action.className = ACTION_CLASS;
      action.textContent = t("imageActions.save", "保存到图库");
      action.setAttribute("aria-live", "polite");
      action.setAttribute("aria-atomic", "true");
      const handler = () => {
        void archive(image, action, deps);
      };
      action.addEventListener("click", handler);
      image.dataset.soStorySave = "true";
      (image.closest(".so-inline-image") ?? image).after(action);
      decorations.set(action, { image, handler });
    }
  };
  const cleanup = () => {
    for (const [action, { image, handler }] of decorations) {
      release(action, image, handler);
    }
  };
  return { decorate, cleanup };
}
async function archive(image, action, deps) {
  if (action.disabled) return;
  const url = image.currentSrc || image.src;
  const tag = normalizeTag(image.alt || image.title);
  const source = { tag, url };
  const story = deps.getStoryContext();
  action.disabled = true;
  action.textContent = t("imageActions.saving", "保存中…");
  try {
    let stored = source;
    let remoteOnly = false;
    if (getSpriteSource(source) === "hosted") {
      try {
        stored = await deps.localize(source, `${tag || "generated-image"}.webp`, story);
      } catch (error) {
        const detail = error instanceof Error ? error.message : t("imageActions.unknown_error", "未知错误");
        const keepRemote = window.confirm(
          t("imageActions.keep_remote", "图片无法保存到本地：{{detail}}\n\n是否仅保留远程引用？对方网站失效后图片也会失效。", { detail })
        );
        if (!keepRemote) {
          action.disabled = false;
          action.textContent = t("imageActions.save", "保存到图库");
          return;
        }
        stored = { ...source, remoteUrl: source.url };
        remoteOnly = true;
      }
    }
    const next = upsertStorySprite(deps.getSettings(), story, stored);
    deps.updateSettings(next);
    action.textContent = remoteOnly ? t("imageActions.saved_remote", "已保存远程引用") : t("imageActions.saved", "已保存");
  } catch (error) {
    action.disabled = false;
    action.textContent = error instanceof Error ? t("imageActions.retry_save", "保存失败，重试") : t("imageActions.save_failed", "保存失败");
  }
}
function isEligible(image) {
  const messageBody = image.closest(".mes_text");
  const message = messageBody?.closest(".mes");
  if (!message || message.getAttribute("is_user") === "true" || message.getAttribute("is_system") === "true") {
    return false;
  }
  if (image.closest('.avatar, .mesAvatar, .emoji, .so-inline-sprite, .st-stage-renderer, [class*="so-renderer-"]')) {
    return false;
  }
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  return !(width > 0 && height > 0 && (width < 64 || height < 64));
}

// st-extension/src/apps/sprite-app.ts
function spriteApp(deps = {}) {
  return {
    id: "sprites",
    name: t("apps.sprites.name", "立绘"),
    icon: "🎭",
    order: 1,
    mount(container, ctx) {
      const settings = ctx.getSettings();
      const characterName = ctx.getCharacterName();
      const packs = getActivePacks(settings, characterName);
      const pack = packs[0] ?? null;
      const stateSection = el2("div", "so-app-section");
      const title2 = el2("div", "so-app-title");
      title2.textContent = characterName ? t("apps.sprites.current_character", "当前角色：{{name}}", { name: characterName }) : t("apps.sprites.no_character", "尚未打开角色聊天");
      const detail = el2("div", "so-app-desc");
      detail.textContent = settings.enabled ? pack ? packs.length > 1 ? t("apps.sprites.active_packs", "立绘功能运行中 — 已启用 {{packs}} 个包（{{images}} 张）", { packs: packs.length, images: packs.reduce((n, p) => n + p.sprites.length, 0) }) : t("apps.sprites.active_pack", "立绘功能运行中 — 已绑定「{{name}}」（{{images}} 张）", { name: pack.name, images: pack.sprites.length }) : t("apps.sprites.unbound", "立绘功能已开启，但当前角色未绑定立绘包（到「图库」绑定）") : t("apps.sprites.disabled", "立绘功能已关闭：不注入 Prompt、不解析标签，旧楼层已恢复原文");
      stateSection.append(
        title2,
        toggleRow(
          t("apps.sprites.enable", "启用立绘功能"),
          settings.enabled,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), enabled: v })
        ),
        detail
      );
      const displaySection = foldSection(t("apps.sprites.display", "显示"), false, "sprites:display");
      displaySection.body.append(
        selectRow(
          t("apps.sprites.location", "显示位置"),
          settings.spriteDisplayMode,
          [
            { value: "overlay", label: t("apps.sprites.overlay", "悬浮窗") },
            { value: "inline", label: t("apps.sprites.inline", "仅楼层") },
            { value: "both", label: t("apps.sprites.both", "两者") }
          ],
          (v) => ctx.updateSettings({
            ...ctx.getSettings(),
            spriteDisplayMode: v === "inline" || v === "both" ? v : "overlay"
          })
        ),
        toggleRow(
          t("apps.sprites.show_overlay", "显示悬浮窗"),
          !settings.overlayHidden,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), overlayHidden: !v })
        ),
        appButton(t("apps.sprites.reset_overlay", "把悬浮窗拉回视口"), () => {
          const cur = ctx.getSettings();
          if (cur.spriteDisplayMode === "inline") return;
          ctx.updateSettings({
            ...cur,
            overlayHidden: false,
            overlay: { ...cur.overlay, x: 24, y: 80 }
          });
        }),
        numberRow(
          t("apps.sprites.recent_messages", "最近渲染楼层数"),
          settings.recentFloors,
          RECENT_FLOORS_MIN,
          RECENT_FLOORS_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), recentFloors: v })
        ),
        rangeRow(
          t("apps.sprites.opacity", "悬浮窗立绘不透明度（%）"),
          settings.spriteOpacity,
          SPRITE_OPACITY_MIN,
          SPRITE_OPACITY_MAX,
          (v) => deps.previewOpacity?.(v),
          (v) => ctx.updateSettings({ ...ctx.getSettings(), spriteOpacity: v }),
          (v) => `${v}%`
        ),
        toggleRow(
          t("apps.sprites.hide_tags", "隐藏 [立绘:xxx] 标签"),
          settings.hideTagInMessage,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), hideTagInMessage: v })
        ),
        hintField(
          toggleRow(
            t("apps.sprites.parse_images", "解析 <img>编码</img> 插图标签"),
            settings.renderInlineImages,
            (v) => ctx.updateSettings({ ...ctx.getSettings(), renderInlineImages: v })
          ),
          t("apps.sprites.images_hint", "把 AI 正文中的 <img>文件编码</img> 按图床前缀渲染为剧情插图。它与 [立绘:图名] 的悬浮窗/楼层显示位置互相独立。")
        ),
        toggleRow(
          t("apps.sprites.fold_roles", "同角色图包折叠"),
          settings.galleryFoldByRole,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), galleryFoldByRole: v })
        )
      );
      const displayHint = el2("div", "so-app-desc");
      displayHint.textContent = t("apps.sprites.display_hint", "「仅楼层」把 [立绘:xxx] 原位替换为图片且不弹悬浮窗；楼层数限制加载聊天时补渲染的范围（新回复不受限）。不透明度只调悬浮窗，楼层立绘始终清晰显示。");
      displaySection.body.append(displayHint);
      const autoSection = foldSection(t("apps.sprites.slideshow", "多立绘轮播"), false, "sprites:auto");
      autoSection.body.append(
        toggleRow(
          t("apps.sprites.auto_switch", "自动轮播（一条回复多张立绘时）"),
          settings.autoSwitch,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), autoSwitch: v })
        ),
        numberRow(
          t("apps.sprites.interval", "轮播间隔（秒）"),
          settings.autoSwitchSeconds,
          1,
          60,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), autoSwitchSeconds: v })
        )
      );
      const promptSection = foldSection(t("apps.sprites.prompt", "Prompt"), false, "sprites:prompt");
      promptSection.body.append(
        numberRow(
          t("apps.sprites.sprite_count", "每次回复立绘数量"),
          settings.spriteCount,
          SPRITE_COUNT_MIN,
          SPRITE_COUNT_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), spriteCount: v })
        ),
        numberRow(
          t("apps.sprites.injection_depth", "注入深度（距末尾楼层数）"),
          settings.injectionDepth,
          INJECTION_DEPTH_MIN,
          INJECTION_DEPTH_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), injectionDepth: v })
        ),
        selectRow(
          t("apps.sprites.prompt_mode", "Prompt 模式"),
          settings.multiRolePromptMode,
          [
            { value: "repeat", label: t("apps.sprites.compact_mode", "自动精简（默认：重合图名列一次）") },
            { value: "full", label: t("apps.sprites.full_mode", "全量（枚举全部地址）") }
          ],
          (v) => ctx.updateSettings({
            ...ctx.getSettings(),
            multiRolePromptMode: v === "full" ? "full" : "repeat"
          })
        ),
        numberRow(
          t("apps.sprites.prompt_budget", "Prompt 预算（字符，0=不限）"),
          settings.promptBudget,
          PROMPT_BUDGET_MIN,
          PROMPT_BUDGET_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), promptBudget: v })
        ),
        toggleRow(
          t("apps.sprites.approx_match", "近似匹配（实验，默认关闭）"),
          settings.approxMatch,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), approxMatch: v })
        )
      );
      const approxHint = el2("div", "so-app-desc");
      approxHint.textContent = t("apps.sprites.approx_hint", "开启后，[立绘:...] 里写的不是准确地址时，会拿它当描述去找最像的一张（如「穿连衣裙逛街」命中 连衣裙/逛街）。只在准确地址找不到时才生效，同分打平就放弃，所以不会改变原本能命中的结果。");
      promptSection.body.append(approxHint);
      const budgeted = buildActiveSpritePrompt(settings, characterName);
      const unlimited = settings.promptBudget > 0 ? buildActiveSpritePrompt(settings, characterName, 0) : budgeted;
      const budgetHint = el2("div", "so-app-desc");
      budgetHint.textContent = budgeted ? t("apps.sprites.budget_count", "预计注入 {{count}} 字符", { count: budgeted.length }) + (budgeted.length < unlimited.length ? t("apps.sprites.budget_trimmed", "（超预算，已从 {{count}} 字符每场景均衡截取，保留排前的图名）", { count: unlimited.length }) : "") : t("apps.sprites.budget_empty", "预计注入：无（当前角色没有可用立绘地址）");
      promptSection.body.append(budgetHint);
      const promptHint = el2("div", "so-app-desc");
      promptHint.textContent = t("apps.sprites.prompt_hint", "同角色多服装时，默认服装可写 [立绘:图名]，其他服装写 [立绘:服装/图名]；完整三级地址仍兼容。自动精简会抽取基础图名池和服装增量；适合相对地址时优先使用角色级格式（只要比全量短），否则在旧场景压缩和全量格式中取更短者。");
      promptSection.body.append(promptHint);
      const tplRow = textareaRow(
        t("apps.sprites.custom_prompt", "自定义提示词（留空=用内置）"),
        settings.promptTemplate,
        t("apps.sprites.template_placeholder", "整体替换内置提示词。占位符：{清单}=按场景分组的立绘清单，{数量}=每次回复立绘数"),
        (v) => ctx.updateSettings({ ...ctx.getSettings(), promptTemplate: v })
      );
      const tplInput = tplRow.querySelector("textarea");
      promptSection.body.append(
        tplRow,
        appButton(t("apps.sprites.fill_builtin", "填入内置底稿（未修改时仍自动精简）"), () => {
          if (tplInput.value.trim() && !window.confirm(t("apps.sprites.overwrite_confirm", "用内置底稿覆盖当前已填写的自定义提示词？"))) return;
          tplInput.value = BUILTIN_TEMPLATE;
          ctx.updateSettings({ ...ctx.getSettings(), promptTemplate: BUILTIN_TEMPLATE });
        })
      );
      container.append(stateSection, displaySection.box, autoSection.box, promptSection.box);
    }
  };
}

// st-extension/src/apps/gallery-app.ts
function galleryApp(deps) {
  return {
    id: "gallery",
    name: t("apps.gallery.name", "图库"),
    icon: "🗂",
    order: 2,
    mount(container, ctx) {
      const settings = ctx.getSettings();
      const section2 = el2("div", "so-app-section");
      const desc = el2("div", "so-app-desc");
      desc.textContent = t("apps.gallery.description", "立绘包管理：新建/上传/导入导出/分享串/角色绑定。");
      section2.append(desc, appButton(t("apps.gallery.open_manager", "打开立绘包管理"), () => deps.openManager()));
      container.append(section2);
      const list = el2("div", "so-app-section");
      const title2 = el2("div", "so-app-title");
      title2.textContent = t("apps.gallery.pack_count", "共 {{count}} 个立绘包", { count: settings.packs.length });
      list.append(title2);
      const boundIds = new Set(settings.bindings.flatMap((b) => b.packIds));
      const sorted = [...settings.packs].sort(
        (a, b) => Number(boundIds.has(b.id)) - Number(boundIds.has(a.id))
      );
      const MAX_SHOWN = 5;
      for (const pack of sorted.slice(0, MAX_SHOWN)) {
        const row = el2("div", "so-app-desc");
        row.textContent = t("apps.gallery.pack_row", "· {{name}}（{{count}} 张）", { name: pack.name, count: pack.sprites.length }) + (boundIds.has(pack.id) ? t("apps.gallery.in_use", "　使用中") : "");
        list.append(row);
      }
      if (settings.packs.length > MAX_SHOWN) {
        const more = el2("div", "so-app-desc");
        more.textContent = t("apps.gallery.more_packs", "…还有 {{count}} 个，全部在「立绘包管理」查看", { count: settings.packs.length - MAX_SHOWN });
        list.append(more);
      }
      container.append(list);
      const hostSection = el2("div", "so-app-section");
      const hostTitle = el2("div", "so-app-title");
      hostTitle.textContent = t("apps.gallery.hosting", "图床");
      hostSection.append(hostTitle);
      const hostIntro = el2("div", "so-app-desc");
      hostIntro.textContent = t("apps.gallery.host_intro", "两条通道各管一件事，按需要配，不用都配：要把自己的图变成能分享的链接 → 配 ①；只是想用别人给的图包/编号 → 什么都不用配，② 已有默认值。");
      hostSection.append(hostIntro);
      const autoDesc = el2("div", "so-app-desc");
      autoDesc.textContent = t("apps.gallery.auto_description", "① 自动直传（imgbb，需要 Key）：上传/替换图片时自动传到 imgbb 并绑定编号，本地图保留作显示保底，直链用于分享串。别人才能看到你分享的图，靠的是这条。");
      const autoWhy = el2("div", "so-app-desc");
      autoWhy.textContent = t("apps.gallery.auto_why", "为什么是 imgbb 而不是 catbox：浏览器里只能传 imgbb。catbox 的接口不返回 CORS 头，网页无法直接上传，所以它只能用在下面那条「按编号还原地址」的通道上。");
      const hint = el2("div", "so-app-desc");
      hint.setAttribute("role", "status");
      hint.setAttribute("aria-live", "polite");
      hint.textContent = t("apps.gallery.key_storage_hint", "Key 明文保存在 ST 扩展设置里（随 ST 服务端 settings.json 落盘），不会写入分享串或导出文件；上传失败时图片仍保留本地，可稍后补传。");
      const autoUploadRow = toggleRow(t("apps.gallery.auto_upload", "上传时自动直传 imgbb 并绑定编号"), settings.autoUpload, (v) => {
        const cur = ctx.getSettings();
        if (v && !cur.imgbbApiKey.trim()) {
          hint.textContent = t("apps.gallery.key_required", "请先填写 imgbb API Key（免费申请：https://api.imgbb.com/）");
          autoUploadRow.querySelector("input").checked = false;
          return;
        }
        ctx.updateSettings({ ...cur, autoUpload: v });
      });
      hostSection.append(
        autoDesc,
        autoWhy,
        textRow(
          t("apps.gallery.api_key", "imgbb API Key（存 ST 设置，明文）"),
          settings.imgbbApiKey,
          t("apps.gallery.key_placeholder", "免费申请：api.imgbb.com"),
          (raw) => ctx.updateSettings({ ...ctx.getSettings(), imgbbApiKey: raw.trim() }),
          "password"
        ),
        autoUploadRow,
        hint
      );
      const manualDesc = el2("div", "so-app-desc");
      manualDesc.textContent = t("apps.gallery.manual_description", "② 按编号还原地址（默认 catbox，不需要 Key）：「按编码添加」以及解析分享串和插图编码时，把编号接在下面这个前缀后面拼成完整地址。它只读不写，不会上传任何东西。");
      const manualWhen = el2("div", "so-app-desc");
      manualWhen.textContent = t("apps.gallery.manual_when", "只有当对方的图不在 catbox 上时才需要改前缀——改成他们用的图床域名即可。");
      hostSection.append(
        manualDesc,
        manualWhen,
        textRow(t("apps.gallery.host_prefix", "图床前缀"), settings.imageHost, DEFAULT_IMAGE_HOST, (raw) => {
          const v = raw.trim() || DEFAULT_IMAGE_HOST;
          const value = /^https?:\/\/.+/.test(v) ? v.endsWith("/") ? v : `${v}/` : DEFAULT_IMAGE_HOST;
          ctx.updateSettings({ ...ctx.getSettings(), imageHost: value });
        })
      );
      container.append(hostSection);
    }
  };
}

// st-extension/src/apps/butler/actions.ts
function errorText(error) {
  return error instanceof Error && error.message ? error.message : "未知错误";
}
function equalJson(left, right) {
  if (left === right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}
function cloneActions(actions) {
  return actions.map((action) => ({ ...action }));
}
async function applyTransaction(inputActions, bridge, baselineMeasurementId) {
  const actions = cloneActions(inputActions);
  const group = actions[0]?.group ?? "performanceSettings";
  if (actions.some((action) => action.group !== group)) throw new Error("事务内动作必须属于同一分组");
  const current2 = await bridge.readGroup(group);
  const before = {};
  const requested = {};
  for (const action of actions) {
    const actualBefore = current2[action.field];
    if (actualBefore !== void 0) action.before = actualBefore;
    before[action.field] = action.before;
    requested[action.field] = action.requested;
  }
  const transaction = {
    id: bridge.createId(),
    group,
    createdAt: bridge.now(),
    status: "applying",
    restoreStatus: "available",
    ...baselineMeasurementId ? { baselineMeasurementId } : {},
    before,
    requested,
    actual: { ...before },
    actions
  };
  await bridge.persistTransaction(transaction);
  for (const action of actions) {
    if (action.status === "unchanged" || equalJson(action.before, action.requested)) {
      action.status = "unchanged";
      action.actual = action.before;
      transaction.actual[action.field] = action.before;
      continue;
    }
    try {
      await bridge.writeGroup(group, { [action.field]: action.requested });
      const reread = await bridge.readGroup(group);
      action.actual = reread[action.field] ?? null;
      transaction.actual[action.field] = action.actual;
      if (equalJson(action.actual, action.requested)) {
        action.status = "applied";
      } else {
        action.status = "failed";
        action.error = "SillyTavern 实际值与请求值不一致";
      }
    } catch (error) {
      action.status = "failed";
      action.error = errorText(error);
      const reread = await bridge.readGroup(group);
      action.actual = reread[action.field] ?? null;
      transaction.actual[action.field] = action.actual;
    }
  }
  const changed = actions.filter((action) => action.status !== "unchanged");
  const applied = changed.filter((action) => action.status === "applied").length;
  const failed = changed.filter((action) => action.status === "failed").length;
  transaction.status = failed === 0 ? "applied" : applied > 0 ? "partial" : "failed";
  transaction.completedAt = bridge.now();
  transaction.actual = { ...await bridge.readGroup(group) };
  await bridge.persistTransaction(transaction);
  return transaction;
}
async function restoreTransaction(source, bridge, confirmedConflictFields = []) {
  const transaction = {
    ...source,
    before: { ...source.before },
    requested: { ...source.requested },
    actual: { ...source.actual },
    actions: cloneActions(source.actions),
    restoreStatus: "restoring"
  };
  await bridge.persistTransaction(transaction);
  const current2 = await bridge.readGroup(transaction.group);
  const confirmed = new Set(confirmedConflictFields);
  const conflicts = [];
  const fieldsToRestore = [];
  for (const [field, before] of Object.entries(transaction.before)) {
    const after = transaction.actual[field] ?? transaction.requested[field];
    const value = current2[field];
    if (equalJson(value, before)) continue;
    if (!equalJson(value, after) && !confirmed.has(field)) {
      conflicts.push({ field, before, after, current: value });
      continue;
    }
    fieldsToRestore.push([field, before]);
  }
  if (conflicts.length > 0) {
    transaction.restoreStatus = "conflict";
    await bridge.persistTransaction(transaction);
    return { transaction, conflicts };
  }
  try {
    for (const [field, before] of fieldsToRestore) {
      await bridge.writeGroup(transaction.group, { [field]: before });
    }
    const restored = await bridge.readGroup(transaction.group);
    const failedFields = Object.entries(transaction.before).filter(([field, before]) => !equalJson(restored[field], before));
    if (failedFields.length > 0) {
      transaction.restoreStatus = "conflict";
      transaction.error = `恢复后 ${failedFields.map(([field]) => field).join("、")} 未回到原值`;
    } else {
      transaction.status = "restored";
      transaction.restoreStatus = "restored";
      transaction.completedAt = bridge.now();
      delete transaction.error;
    }
  } catch (error) {
    transaction.restoreStatus = "conflict";
    transaction.error = `恢复失败：${errorText(error)}`;
  }
  await bridge.persistTransaction(transaction);
  return { transaction, conflicts: [] };
}
function capabilitySignature(snapshot) {
  return [...snapshot.capabilities].map((capability) => `${capability.id}:${capability.available ? "1" : "0"}`).sort().join("|");
}
function flattenNumbers(value, prefix = "", output = {}) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (prefix) output[prefix] = value;
    return output;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return output;
  for (const [key, child] of Object.entries(value)) {
    flattenNumbers(child, prefix ? `${prefix}.${key}` : key, output);
  }
  return output;
}
function compareMeasurements(before, after) {
  const reasons = [];
  if (before.invalidReason || after.invalidReason) reasons.push("检查无效");
  if (!before.chatKey || !after.chatKey || before.chatKey !== after.chatKey) reasons.push("聊天不同");
  if (before.probe !== after.probe) reasons.push("检查方式不同");
  if (!before.foreground || !after.foreground || before.foreground !== after.foreground) reasons.push("页面状态不同");
  if (before.durationMs !== after.durationMs || before.durationMs !== 6e3) reasons.push("检查时长不同");
  if (capabilitySignature(before) !== capabilitySignature(after)) reasons.push("可读取的数据不同");
  const deltas = {};
  if (reasons.length === 0) {
    const beforeNumbers = flattenNumbers(before.metrics);
    const afterNumbers = flattenNumbers(after.metrics);
    for (const [key, beforeValue] of Object.entries(beforeNumbers)) {
      const afterValue = afterNumbers[key];
      if (afterValue !== void 0) deltas[key] = afterValue - beforeValue;
    }
  }
  return {
    comparable: reasons.length === 0,
    reasons,
    before: before.metrics,
    after: after.metrics,
    deltas
  };
}
function metricNumber(metrics, path) {
  let current2 = metrics;
  for (const segment of path) {
    if (!current2 || typeof current2 !== "object" || Array.isArray(current2)) return null;
    current2 = current2[segment];
  }
  return typeof current2 === "number" && Number.isFinite(current2) ? current2 : null;
}
function mediaCount(metrics) {
  const values = ["images", "videos", "audio", "canvas", "iframes"].map((key) => metricNumber(metrics, ["media", key]));
  const available2 = values.filter((value) => value !== null);
  return available2.length > 0 ? available2.reduce((sum, value) => sum + value, 0) : null;
}
var SUMMARY_METRICS = [
  {
    id: "heap.usedBytes",
    label: "网页内存",
    unit: "bytes",
    read: (metrics) => metricNumber(metrics, ["heap", "usedBytes"]),
    explanation: "受浏览器垃圾回收和缓存影响，单次升降不能单独证明优化有效。"
  },
  {
    id: "page.chatNodeCount",
    label: "页面节点",
    unit: "count",
    read: (metrics) => metricNumber(metrics, ["page", "chatNodeCount"]),
    explanation: "用于观察聊天页面规模；聊天内容不同会直接改变数量。"
  },
  {
    id: "page.messageCount",
    label: "消息数",
    unit: "count",
    read: (metrics) => metricNumber(metrics, ["page", "messageCount"]),
    explanation: "用于确认两次检查的聊天规模是否接近，本身不代表快慢。"
  },
  {
    id: "media.total",
    label: "图片 / 媒体数",
    unit: "count",
    read: mediaCount,
    explanation: "汇总图片、视频、音频、画布和内嵌页面，只作为资源规模参照。"
  },
  {
    id: "dynamic.longTaskCount",
    label: "6 秒长任务",
    unit: "count",
    read: (metrics) => metricNumber(metrics, ["dynamic", "longTaskCount"]),
    explanation: "主线程连续占用 50 ms 以上的次数；同条件下越少通常越流畅。"
  },
  {
    id: "dynamic.longestTaskMs",
    label: "最长卡顿",
    unit: "milliseconds",
    read: (metrics) => metricNumber(metrics, ["dynamic", "longestTaskMs"]),
    explanation: "6 秒检查中最长一次主线程占用；同条件下越短越好。"
  },
  {
    id: "dynamic.frameIntervalP95Ms",
    label: "95% 帧间隔",
    unit: "milliseconds",
    read: (metrics) => metricNumber(metrics, ["dynamic", "frameIntervalP95Ms"]),
    explanation: "大多数画面更新之间的间隔；同条件下越低通常越顺滑。"
  },
  {
    id: "dynamic.timerDelayP95Ms",
    label: "定时器延迟",
    unit: "milliseconds",
    read: (metrics) => metricNumber(metrics, ["dynamic", "timerDelayP95Ms"]),
    explanation: "大多数定时任务额外等待的时间；同条件下越低越好。"
  }
];
function formatSummaryValue(value, unit) {
  if (value === null) return "未读取到";
  if (unit === "bytes") return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (unit === "count") return `${Number.isInteger(value) ? value : value.toFixed(1)} 项`;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ms`;
}
function formatSummaryChange(before, after, unit, comparable) {
  if (!comparable || before === null || after === null) return "不计算";
  const delta = after - before;
  if (delta === 0) return "无变化";
  return `${delta < 0 ? "减少" : "增加"} ${formatSummaryValue(Math.abs(delta), unit)}`;
}
function summarizeMeasurementComparison(comparison) {
  return SUMMARY_METRICS.map((metric) => {
    const before = metric.read(comparison.before);
    const after = metric.read(comparison.after);
    return {
      id: metric.id,
      label: metric.label,
      before: formatSummaryValue(before, metric.unit),
      after: formatSummaryValue(after, metric.unit),
      change: formatSummaryChange(before, after, metric.unit, comparison.comparable),
      explanation: metric.explanation
    };
  });
}

// st-extension/src/apps/butler/diagnosis.ts
function finding(input) {
  return {
    id: input.id,
    layer: input.layer,
    evidence: input.evidence,
    severity: input.severity,
    confidence: input.confidence,
    ...input.actionId ? { actionId: input.actionId } : {},
    explanation: {
      ...input.explanation,
      result: input.explanation.result ?? "尚未应用，等待再次检查。"
    }
  };
}
function planAction(id, label, field, before, requested, reloadRequired = false) {
  return {
    id,
    group: "performanceSettings",
    label,
    field,
    before,
    requested,
    status: before === requested ? "unchanged" : "planned",
    reloadRequired
  };
}
function buildSafePlan(current2, deviceClass) {
  const messageLimit = deviceClass === "mobile" ? 20 : 50;
  const nextMessages = current2.chat_truncation === 0 ? messageLimit : Math.min(current2.chat_truncation, messageLimit);
  const candidates = [
    planAction("perf-fast-ui", "关闭背景模糊", "fast_ui_mode", current2.fast_ui_mode, true),
    planAction("perf-reduced-motion", "开启减少动画", "reduced_motion", current2.reduced_motion, true, true),
    planAction("perf-no-shadows", "关闭阴影", "noShadows", current2.noShadows, true),
    planAction("perf-smooth-streaming", "关闭平滑文字更新", "smooth_streaming", current2.smooth_streaming, false),
    planAction("perf-stream-fade", "关闭文字淡入", "stream_fade_in", current2.stream_fade_in, false),
    planAction(
      "perf-streaming-fps",
      "降低流式更新频率",
      "streaming_fps",
      current2.streaming_fps,
      Math.min(current2.streaming_fps, 15)
    ),
    planAction(
      "perf-chat-truncation",
      "减少同时显示的消息",
      "chat_truncation",
      current2.chat_truncation,
      nextMessages,
      true
    )
  ];
  return {
    deviceClass,
    actions: candidates.filter((action) => action.status === "planned"),
    unchanged: candidates.filter((action) => action.status === "unchanged")
  };
}
function settingFinding(id, actionId, detected, change, reason, impact, reload) {
  return finding({
    id,
    layer: "pageRendering",
    evidence: { detected },
    severity: "suggestion",
    confidence: "setting",
    actionId,
    explanation: {
      detected,
      change,
      reason,
      impact,
      reload,
      restore: "可以点“恢复本次性能设置”回到修改前。"
    }
  });
}
function numberRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}
function resourceGroups(snapshot) {
  const resources = numberRecord(snapshot.metrics.resources);
  return Array.isArray(resources?.groups) ? resources.groups.filter((item) => typeof item === "object" && item !== null && !Array.isArray(item)) : [];
}
function unavailableCapabilities(capabilities) {
  return capabilities.filter(
    (capability) => !capability.available
  );
}
function capabilityAvailable(snapshot, id) {
  return snapshot.capabilities.some((capability) => capability.id === id && capability.available);
}
function diagnose(snapshot, current2) {
  const findings = [];
  if (current2) {
    if (!current2.fast_ui_mode) findings.push(settingFinding(
      "setting-no-blur",
      "perf-fast-ui",
      "背景模糊当前开启。",
      "关闭背景模糊。",
      "背景模糊会增加页面绘制工作。",
      "界面毛玻璃效果会减少，不改变模型回复内容。",
      "通常立即生效；部分界面在刷新后完全更新。"
    ));
    if (!current2.reduced_motion) findings.push(settingFinding(
      "setting-reduced-motion",
      "perf-reduced-motion",
      "动画效果当前较多。",
      "减少动画效果。",
      "减少持续过渡和动画更新可降低主线程与合成工作。",
      "界面过渡会更直接，不改变模型回复内容。",
      "刷新页面后完全生效。"
    ));
    if (!current2.noShadows) findings.push(settingFinding(
      "setting-no-shadows",
      "perf-no-shadows",
      "阴影效果当前开启。",
      "关闭阴影效果。",
      "减少阴影绘制可降低重绘成本。",
      "界面层次感会减弱，不改变模型回复内容。",
      "通常立即生效。"
    ));
    if (current2.smooth_streaming) findings.push(settingFinding(
      "setting-smooth-streaming",
      "perf-smooth-streaming",
      "平滑文字更新当前开启。",
      "关闭平滑文字更新。",
      "减少生成期间持续的文字动画与重绘。",
      "文字会更直接地更新，不改变模型输出内容。",
      "立即影响后续流式回复。"
    ));
    if (current2.stream_fade_in) findings.push(settingFinding(
      "setting-stream-fade",
      "perf-stream-fade",
      "文字淡入当前开启。",
      "关闭文字淡入。",
      "减少每批新文字的视觉动画。",
      "新文字不再淡入，不改变模型输出内容。",
      "立即影响后续流式回复。"
    ));
    if (current2.streaming_fps > 15) findings.push(settingFinding(
      "setting-streaming-fps",
      "perf-streaming-fps",
      `流式更新频率为 ${current2.streaming_fps}，高于安全建议上限 15。`,
      "降低到 15；已有更低值不会调高。",
      "减少生成期间 UI 更新频率。",
      "流式动画细腻度会降低，不改变回复内容。",
      "立即影响后续流式回复。"
    ));
    const limit = snapshot.environment.mobile.available ? snapshot.environment.mobile.value ? 20 : 50 : null;
    if (limit !== null && (current2.chat_truncation === 0 || current2.chat_truncation > limit)) findings.push(settingFinding(
      "setting-chat-truncation",
      "perf-chat-truncation",
      current2.chat_truncation === 0 ? "同时显示的消息数为 0，会把当前聊天全部放入页面。" : `同时显示的消息数为 ${current2.chat_truncation}，高于当前设备建议上限 ${limit}。`,
      `限制到 ${limit}；已有更低的非零值不会调高。`,
      "减少同时渲染的历史消息与页面节点。",
      "上翻时仍可继续加载历史消息，不会删除聊天数据。",
      "需要重载当前聊天。"
    ));
  }
  const dynamic = numberRecord(snapshot.metrics.dynamic);
  const longestTask = typeof dynamic?.longestTaskMs === "number" ? dynamic.longestTaskMs : 0;
  const longTaskCount = typeof dynamic?.longTaskCount === "number" ? dynamic.longTaskCount : 0;
  if (capabilityAvailable(snapshot, "longTasks") && longTaskCount > 0 && longestTask >= 50) findings.push(finding({
    id: "measured-long-tasks",
    layer: "pageRendering",
    evidence: { longTaskCount, longestTaskMs: longestTask },
    severity: longestTask >= 100 ? "risk" : "suggestion",
    confidence: "measurement",
    explanation: {
      detected: `6 秒检查中发现 ${longTaskCount} 次页面长时间占用，最长 ${longestTask}ms。`,
      change: "先应用安全显示建议，再次检查；若仍存在，再临时关闭扩展做对比。",
      reason: "页面连续忙碌超过 50ms，可能让点击和绘制变慢。",
      impact: "该指标属于整个页面，不能单独归因到某个扩展。",
      reload: "显示设置按各项说明生效；临时关闭扩展需要刷新。",
      restore: "显示设置和扩展排查都保留独立的恢复入口。"
    }
  }));
  const extensionResources = resourceGroups(snapshot).filter((group) => typeof group.key === "string" && group.key.startsWith("extension:"));
  if (capabilityAvailable(snapshot, "resourceTiming") && extensionResources.length > 0) findings.push(finding({
    id: "extension-resource-evidence",
    layer: "extensions",
    evidence: { groups: extensionResources },
    severity: "info",
    confidence: "correlation",
    explanation: {
      detected: `记录到 ${extensionResources.length} 个扩展的加载资源。`,
      change: "只在扩展指南里列出这些扩展供你参考，不会自动关闭任何一个。",
      reason: "下载或加载记录只能提供线索，不能据此判断某个扩展持续占用处理器或内存。",
      impact: "关闭扩展会影响对应功能，要不要关由你自己决定。",
      reload: "扩展启停需要刷新后才真正改变加载状态。",
      restore: "启停都在 SillyTavern 自己的扩展管理里操作，本工具不改动你的扩展禁用清单。"
    }
  }));
  const page = numberRecord(snapshot.metrics.page);
  if (page && capabilityAvailable(snapshot, "pageSummary")) findings.push(finding({
    id: "evidence-page-dom",
    layer: "pageRendering",
    evidence: page,
    severity: "info",
    confidence: "measurement",
    explanation: {
      detected: "已记录当前聊天消息数、已渲染楼层和 DOM 节点摘要。",
      change: "仅作为环境证据，不因数量本身自动修改设置。",
      reason: "相同数量在不同设备和内容结构上的开销差异很大。",
      impact: "无自动变更。",
      reload: "不需要。",
      restore: "没有修改，无需恢复。"
    }
  }));
  const media = numberRecord(snapshot.metrics.media);
  if (media && capabilityAvailable(snapshot, "mediaDom")) findings.push(finding({
    id: "evidence-media",
    layer: "mediaResourcesStorage",
    evidence: media,
    severity: "info",
    confidence: "measurement",
    explanation: {
      detected: "已记录页面媒体元素及可见/离屏摘要。",
      change: "仅作为环境证据，不自动暂停媒体或控制 GIF。",
      reason: "元素数量不能直接代表解码、显存或播放成本。",
      impact: "无自动变更。",
      reload: "不需要。",
      restore: "没有修改，无需恢复。"
    }
  }));
  const unavailable2 = unavailableCapabilities(snapshot.capabilities);
  if (unavailable2.length > 0) findings.push(finding({
    id: "capability-unavailable",
    layer: "mediaResourcesStorage",
    evidence: { capabilities: unavailable2.map((item) => ({ id: item.id, reason: item.reason })) },
    severity: "info",
    confidence: "correlation",
    explanation: {
      detected: `${unavailable2.length} 项浏览器或 ST 指标在当前环境不可用。`,
      change: "保留缺失原因，不生成估算值。",
      reason: "不同浏览器和 ST 版本公开的能力不同。",
      impact: "报告信息会减少，但不会影响其他可用指标。",
      reload: "通常不需要。",
      restore: "没有修改，无需恢复。"
    }
  }));
  return findings;
}

// st-extension/src/apps/butler/self-identity.ts
var FALLBACK_DIRECTORY_NAME = "st-stage";
var RESERVED_SEGMENTS = /* @__PURE__ */ new Set(["extensions", "third-party", "scripts", ""]);
var PARENT_SEGMENTS = /* @__PURE__ */ new Set(["third-party", "extensions"]);
function installDirectoryName(moduleUrl) {
  if (typeof moduleUrl !== "string" || !moduleUrl) return FALLBACK_DIRECTORY_NAME;
  const withoutQuery = moduleUrl.split(/[?#]/)[0];
  const segments = withoutQuery.split("/").filter(Boolean);
  const directory = segments[segments.length - 2];
  const parent = segments[segments.length - 3];
  if (!directory || RESERVED_SEGMENTS.has(directory.toLowerCase())) return FALLBACK_DIRECTORY_NAME;
  if (!parent || !PARENT_SEGMENTS.has(parent.toLowerCase())) return FALLBACK_DIRECTORY_NAME;
  return directory;
}
function selfExtensionNames(directory) {
  const name = directory.trim();
  if (!name) return [];
  return name.includes("/") ? [name] : [name, `third-party/${name}`];
}
function matchesSelf(name, directory) {
  const target = name?.trim().toLowerCase();
  if (!target) return false;
  return selfExtensionNames(directory).some((candidate) => candidate.toLowerCase() === target);
}
var SELF_DIRECTORY_NAME = installDirectoryName(
  typeof import.meta === "undefined" ? "" : import.meta.url
);
function isSelfExtensionName(name) {
  return matchesSelf(name, SELF_DIRECTORY_NAME);
}

// st-extension/src/apps/butler/experiments.ts
var BACKUP_STORAGE_KEY = "st-stage:butler:extension-recovery:v1";
function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}
function isSelf(name) {
  return isSelfExtensionName(name);
}
function recoveryCommand(backup) {
  const disabled = JSON.stringify(uniqueSorted(backup.disabledExtensions));
  return `(async()=>{const m=await import('/scripts/extensions.js');const d=new Set(${disabled});for(const n of m.extensionNames){await (d.has(n)?m.disableExtension(n,false):m.enableExtension(n,false));}location.reload();})()`;
}
var buildEmergencyBackup = Object.assign(
  (disabledExtensions, createdAt) => ({
    version: 1,
    createdAt,
    disabledExtensions: uniqueSorted(disabledExtensions)
  }),
  { recoveryCommand }
);
function readEmergencyBackup(storage) {
  let raw;
  try {
    raw = storage.getItem(BACKUP_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value;
    if (record.version !== 1 || typeof record.createdAt !== "number" || !Number.isFinite(record.createdAt) || !Array.isArray(record.disabledExtensions) || !record.disabledExtensions.every((name) => typeof name === "string" && name.length > 0) || record.disabledExtensions.some((name) => typeof name === "string" && isSelf(name))) return null;
    return buildEmergencyBackup(record.disabledExtensions, record.createdAt);
  } catch {
    return null;
  }
}
async function applyDisabledSet(desiredDisabledExtensions, deps, reloadOnSuccess) {
  const inventory = await deps.readExtensions();
  if (inventory.status !== "ready") {
    return { ok: false, applied: [], failed: [{ name: "SillyTavern", error: inventory.reason }], reloadRequired: false };
  }
  if (!inventory.governance.writable) {
    return {
      ok: false,
      applied: [],
      failed: [{ name: "SillyTavern", error: inventory.governance.reason ?? "扩展治理只读" }],
      reloadRequired: false
    };
  }
  const desired = new Set(uniqueSorted(desiredDisabledExtensions));
  const failed = [];
  const applied = [];
  for (const name of desired) {
    if (isSelf(name)) failed.push({ name, error: `管家不能禁用 ${SELF_DIRECTORY_NAME} 自身` });
  }
  if (failed.length > 0) return { ok: false, applied, failed, reloadRequired: false };
  for (const extension of inventory.extensions) {
    if (extension.isSelf || isSelf(extension.name)) continue;
    const shouldEnable = !desired.has(extension.name);
    if (extension.configuredEnabled === shouldEnable) continue;
    const result = await deps.setExtensionEnabled(extension.name, shouldEnable);
    if (result.ok) applied.push(extension.name);
    else failed.push({ name: extension.name, error: result.error });
  }
  const ok = failed.length === 0;
  const reloadRequired = applied.length > 0;
  if (ok && reloadRequired && reloadOnSuccess) await deps.reloadPage();
  return { ok, applied, failed, reloadRequired };
}
async function restoreEmergencyExtensionBackup(backup, deps) {
  const batch = await applyDisabledSet(backup.disabledExtensions, deps, false);
  if (!batch.ok) return batch;
  deps.backupStorage.removeItem(BACKUP_STORAGE_KEY);
  if (batch.reloadRequired) await deps.reloadPage();
  return batch;
}
function partialFailureNote(prefix, batch) {
  const applied = batch.applied.length > 0 ? batch.applied.join("、") : "无";
  const failed = batch.failed.map((item) => `${item.name}（${item.error}）`).join("、");
  return `${prefix}；已修改：${applied}；失败：${failed}。页面未刷新，可保留当前状态或恢复原清单。`;
}
function resumeExtensionExperiment(source) {
  if (source.status !== "awaitingReload") return structuredClone(source);
  return { ...structuredClone(source), status: "sampling" };
}
async function finishExtensionExperiment(source, decision, deps) {
  if (source.status !== "awaitingDecision") throw new Error("实验尚未等待用户决定");
  const completed = structuredClone(source);
  if (decision === "restore") {
    const restoring = { ...completed, status: "restoring" };
    await deps.persistExperiment(restoring);
    const batch = await applyDisabledSet(restoring.originalDisabledExtensions, deps, false);
    if (!batch.ok) {
      const retryable = {
        ...restoring,
        status: "awaitingDecision",
        reloadRequiredAfterDecision: Boolean(
          restoring.reloadRequiredAfterDecision || batch.reloadRequired
        ),
        notes: partialFailureNote("恢复未全部成功", batch)
      };
      await deps.persistExperiment(retryable);
      return retryable;
    }
    completed.status = "completed";
    completed.completedAt = deps.now();
    await deps.persistExperiment(null);
    deps.backupStorage.removeItem(BACKUP_STORAGE_KEY);
    if (batch.reloadRequired) await deps.reloadPage();
    return completed;
  }
  completed.status = "completed";
  completed.completedAt = deps.now();
  await deps.persistExperiment(null);
  deps.backupStorage.removeItem(BACKUP_STORAGE_KEY);
  if (completed.reloadRequiredAfterDecision) await deps.reloadPage();
  return completed;
}

// st-extension/src/apps/butler/types.ts
var BUTLER_DATA_VERSION = 2;
var BUTLER_HISTORY_LIMIT = 10;
var BUTLER_DATA_BUDGET_BYTES = 64 * 1024;

// st-extension/src/apps/butler/history.ts
function utf8JsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
function protectedMeasurementIds(data) {
  return new Set([
    data.activeTransaction?.baselineMeasurementId,
    data.pendingExperiment?.baselineMeasurementId,
    data.pendingExperiment?.comparisonMeasurementId
  ].filter((id) => Boolean(id)));
}
function oldestRecordIndex(history, protectedIds) {
  let oldestIndex = -1;
  for (let index = 0; index < history.length; index += 1) {
    const record = history[index];
    if (record.kind === "measurement" && protectedIds.has(record.measurement.id)) continue;
    if (oldestIndex < 0) {
      oldestIndex = index;
      continue;
    }
    const candidate = history[index];
    const oldest = history[oldestIndex];
    if (candidate.createdAt < oldest.createdAt || candidate.createdAt === oldest.createdAt && candidate.completedAt < oldest.completedAt) {
      oldestIndex = index;
    }
  }
  return oldestIndex;
}
function withoutOldest(history, evictedIds, protectedIds) {
  const next = [...history];
  const index = oldestRecordIndex(next, protectedIds);
  if (index < 0) return null;
  const [removed] = next.splice(index, 1);
  evictedIds.push(removed.id);
  return next;
}
function fitButlerDataBudget(data, budgetBytes = BUTLER_DATA_BUDGET_BYTES, candidateHistoryId) {
  const evictedIds = [];
  const protectedIds = protectedMeasurementIds(data);
  let history = [...data.history];
  while (history.length > BUTLER_HISTORY_LIMIT) {
    const next = withoutOldest(history, evictedIds, protectedIds);
    if (!next) break;
    history = next;
  }
  let fitted = { ...data, history };
  let bytes = utf8JsonBytes(fitted);
  while (bytes > budgetBytes && history.length > 0) {
    const next = withoutOldest(history, evictedIds, protectedIds);
    if (!next) break;
    history = next;
    fitted = { ...data, history };
    bytes = utf8JsonBytes(fitted);
  }
  if (bytes <= budgetBytes) {
    return {
      data: fitted,
      bytes,
      budgetBytes,
      status: evictedIds.length > 0 ? "evicted" : "ok",
      historyAccepted: candidateHistoryId === void 0 ? true : fitted.history.some((record) => record.id === candidateHistoryId),
      evictedIds
    };
  }
  const protectedStatePresent = data.activeTransaction !== null || data.pendingExperiment !== null || protectedIds.size > 0;
  return {
    data: fitted,
    bytes,
    budgetBytes,
    status: protectedStatePresent ? "protected-over-budget" : "data-over-budget",
    historyAccepted: false,
    evictedIds
  };
}

// st-extension/src/apps/butler/migrations.ts
var INVALID = { ok: false };
var ACTION_GROUPS = ["performanceSettings", "disabledExtensions", "gameplaySettings"];
var ACTION_STATUSES = ["planned", "applied", "failed", "unchanged"];
var TRANSACTION_STATUSES = ["planned", "applying", "applied", "partial", "failed", "restored"];
var RESTORE_STATUSES = ["unavailable", "available", "restoring", "conflict", "restored"];
var EXPERIMENT_KINDS = ["selectedExtensions", "binaryIsolation"];
var EXPERIMENT_STATUSES = [
  "prepared",
  "awaitingReload",
  "sampling",
  "awaitingDecision",
  "restoring",
  "completed",
  "failed"
];
var ACTIVE_TRANSACTION_STATUSES = ["planned", "applying", "applied", "partial", "failed"];
var ACTIVE_RESTORE_STATUSES = ["available", "restoring", "conflict"];
var COMPLETED_TRANSACTION_STATUSES = ["applied", "partial", "failed", "restored"];
var PENDING_EXPERIMENT_STATUSES = [
  "prepared",
  "awaitingReload",
  "sampling",
  "awaitingDecision",
  "restoring"
];
var COMPLETED_EXPERIMENT_STATUSES = ["completed", "failed"];
var HISTORY_OUTCOMES = ["completed", "failed", "restored", "cancelled"];
var PROBES = ["static", "idle", "controlledScroll"];
var PERF_BOOLEAN_KEYS = [
  "fast_ui_mode",
  "reduced_motion",
  "noShadows",
  "smooth_streaming",
  "stream_fade_in"
];
function valid(value) {
  return { ok: true, value };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isString(value) {
  return typeof value === "string";
}
function isOneOf(value, allowed) {
  return typeof value === "string" && allowed.includes(value);
}
function optionalString(value) {
  return value === void 0 || isString(value);
}
function optionalNumber(value) {
  return value === void 0 || isFiniteNumber(value);
}
function optionalBoolean(value) {
  return value === void 0 || typeof value === "boolean";
}
function normalizeJsonValue(value, ancestors = /* @__PURE__ */ new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return valid(value);
  if (isFiniteNumber(value)) return valid(value);
  if (typeof value !== "object" || value === null || ancestors.has(value)) return INVALID;
  ancestors.add(value);
  if (Array.isArray(value)) {
    const clone2 = [];
    for (const item of value) {
      const normalized = normalizeJsonValue(item, ancestors);
      if (!normalized.ok) {
        ancestors.delete(value);
        return INVALID;
      }
      clone2.push(normalized.value);
    }
    ancestors.delete(value);
    return valid(clone2);
  }
  const entries = [];
  for (const [key, item] of Object.entries(value)) {
    const normalized = normalizeJsonValue(item, ancestors);
    if (!normalized.ok) {
      ancestors.delete(value);
      return INVALID;
    }
    entries.push([key, normalized.value]);
  }
  ancestors.delete(value);
  return valid(Object.fromEntries(entries));
}
function normalizeJsonRecord(value) {
  if (!isRecord(value)) return INVALID;
  const normalized = normalizeJsonValue(value);
  return normalized.ok && isRecord(normalized.value) ? valid(normalized.value) : INVALID;
}
function normalizeStringArray(value) {
  return Array.isArray(value) && value.every(isString) ? valid([...value]) : INVALID;
}
function normalizePerformanceSnapshot(value) {
  if (!isRecord(value) || !PERF_BOOLEAN_KEYS.every((key) => typeof value[key] === "boolean") || !isFiniteNumber(value.streaming_fps) || !isFiniteNumber(value.chat_truncation)) return INVALID;
  return valid({
    fast_ui_mode: value.fast_ui_mode,
    reduced_motion: value.reduced_motion,
    noShadows: value.noShadows,
    smooth_streaming: value.smooth_streaming,
    stream_fade_in: value.stream_fade_in,
    streaming_fps: value.streaming_fps,
    chat_truncation: value.chat_truncation
  });
}
function normalizeObserved(value, normalizeValue) {
  if (!isRecord(value) || typeof value.available !== "boolean") return INVALID;
  if (!value.available) {
    return isString(value.reason) ? valid({ available: false, reason: value.reason }) : INVALID;
  }
  const normalized = normalizeValue(value.value);
  return normalized.ok ? valid({ available: true, value: normalized.value }) : INVALID;
}
function normalizeCapability(value) {
  if (!isRecord(value) || !isString(value.id) || typeof value.available !== "boolean") return INVALID;
  if (value.available) return valid({ id: value.id, available: true });
  return isString(value.reason) ? valid({ id: value.id, available: false, reason: value.reason }) : INVALID;
}
function normalizeEnvironment(value) {
  if (!isRecord(value)) return INVALID;
  const stVersion2 = normalizeObserved(value.stVersion, (input) => isString(input) ? valid(input) : INVALID);
  const stageBuild = normalizeObserved(value.stageBuild, (input) => isString(input) ? valid(input) : INVALID);
  const mobile = normalizeObserved(value.mobile, (input) => typeof input === "boolean" ? valid(input) : INVALID);
  const settingsSummary = normalizeObserved(value.settingsSummary, normalizeJsonRecord);
  const disabledExtensionsHash = normalizeObserved(
    value.disabledExtensionsHash,
    (input) => isString(input) ? valid(input) : INVALID
  );
  if (!stVersion2.ok || !stageBuild.ok || !mobile.ok || !settingsSummary.ok || !disabledExtensionsHash.ok) {
    return INVALID;
  }
  return valid({
    stVersion: stVersion2.value,
    stageBuild: stageBuild.value,
    mobile: mobile.value,
    settingsSummary: settingsSummary.value,
    disabledExtensionsHash: disabledExtensionsHash.value
  });
}
function normalizeMeasurementSnapshot(value) {
  if (!isRecord(value) || !isString(value.id) || !isFiniteNumber(value.createdAt) || !isFiniteNumber(value.durationMs) || !isOneOf(value.probe, PROBES) || typeof value.foreground !== "boolean" || !optionalString(value.chatKey) || !optionalString(value.invalidReason) || !Array.isArray(value.capabilities)) return null;
  const environment = normalizeEnvironment(value.environment);
  const metrics = normalizeJsonRecord(value.metrics);
  const capabilities = [];
  for (const candidate of value.capabilities) {
    const normalized = normalizeCapability(candidate);
    if (!normalized.ok) return null;
    capabilities.push(normalized.value);
  }
  if (!environment.ok || !metrics.ok) return null;
  return {
    id: value.id,
    createdAt: value.createdAt,
    durationMs: value.durationMs,
    probe: value.probe,
    foreground: value.foreground,
    ...value.chatKey === void 0 ? {} : { chatKey: value.chatKey },
    environment: environment.value,
    capabilities,
    metrics: metrics.value,
    ...value.invalidReason === void 0 ? {} : { invalidReason: value.invalidReason }
  };
}
function normalizeButlerAction(value) {
  if (!isRecord(value) || !isString(value.id) || !isOneOf(value.group, ACTION_GROUPS) || !isString(value.label) || !isString(value.field) || !isOneOf(value.status, ACTION_STATUSES) || typeof value.reloadRequired !== "boolean" || !optionalString(value.error)) return null;
  const before = normalizeJsonValue(value.before);
  const requested = normalizeJsonValue(value.requested);
  const actual = value.actual === void 0 ? null : normalizeJsonValue(value.actual);
  if (!before.ok || !requested.ok || actual !== null && !actual.ok) return null;
  return {
    id: value.id,
    group: value.group,
    label: value.label,
    field: value.field,
    before: before.value,
    requested: requested.value,
    ...actual === null ? {} : { actual: actual.value },
    status: value.status,
    reloadRequired: value.reloadRequired,
    ...value.error === void 0 ? {} : { error: value.error }
  };
}
function normalizeButlerTransaction(value) {
  if (!isRecord(value) || !isString(value.id) || !isOneOf(value.group, ACTION_GROUPS) || !isFiniteNumber(value.createdAt) || !optionalNumber(value.completedAt) || !isOneOf(value.status, TRANSACTION_STATUSES) || !isOneOf(value.restoreStatus, RESTORE_STATUSES) || !optionalString(value.baselineMeasurementId) || !Array.isArray(value.actions) || !optionalString(value.error)) return null;
  const before = normalizeJsonRecord(value.before);
  const requested = normalizeJsonRecord(value.requested);
  const actual = normalizeJsonRecord(value.actual);
  const actions = [];
  for (const candidate of value.actions) {
    const normalized = normalizeButlerAction(candidate);
    if (!normalized || normalized.group !== value.group) return null;
    actions.push(normalized);
  }
  if (!before.ok || !requested.ok || !actual.ok || actions.length === 0) return null;
  return {
    id: value.id,
    group: value.group,
    createdAt: value.createdAt,
    ...value.completedAt === void 0 ? {} : { completedAt: value.completedAt },
    status: value.status,
    restoreStatus: value.restoreStatus,
    ...value.baselineMeasurementId === void 0 ? {} : { baselineMeasurementId: value.baselineMeasurementId },
    before: before.value,
    requested: requested.value,
    actual: actual.value,
    actions,
    ...value.error === void 0 ? {} : { error: value.error }
  };
}
function normalizeButlerExperiment(value) {
  if (!isRecord(value) || !isString(value.id) || !isOneOf(value.kind, EXPERIMENT_KINDS) || !isOneOf(value.status, EXPERIMENT_STATUSES) || !isFiniteNumber(value.startedAt) || !optionalNumber(value.completedAt) || !isFiniteNumber(value.currentRound) || !Number.isInteger(value.currentRound) || value.currentRound < 0 || !optionalString(value.baselineMeasurementId) || !optionalString(value.comparisonMeasurementId) || !optionalBoolean(value.reloadRequiredAfterDecision) || !optionalString(value.notes)) return null;
  const originalDisabledExtensions = normalizeStringArray(value.originalDisabledExtensions);
  const candidateExtensions = normalizeStringArray(value.candidateExtensions);
  const trialDisabledExtensions = value.trialDisabledExtensions === void 0 ? null : normalizeStringArray(value.trialDisabledExtensions);
  if (!originalDisabledExtensions.ok || !candidateExtensions.ok || trialDisabledExtensions && !trialDisabledExtensions.ok) {
    return null;
  }
  return {
    id: value.id,
    kind: value.kind,
    status: value.status,
    startedAt: value.startedAt,
    ...value.completedAt === void 0 ? {} : { completedAt: value.completedAt },
    originalDisabledExtensions: originalDisabledExtensions.value,
    candidateExtensions: candidateExtensions.value,
    ...trialDisabledExtensions === null ? {} : { trialDisabledExtensions: trialDisabledExtensions.value },
    currentRound: value.currentRound,
    ...value.baselineMeasurementId === void 0 ? {} : { baselineMeasurementId: value.baselineMeasurementId },
    ...value.comparisonMeasurementId === void 0 ? {} : { comparisonMeasurementId: value.comparisonMeasurementId },
    ...value.reloadRequiredAfterDecision === void 0 ? {} : { reloadRequiredAfterDecision: value.reloadRequiredAfterDecision },
    ...value.notes === void 0 ? {} : { notes: value.notes }
  };
}
function normalizeHistoryBase(value) {
  if (!isString(value.id) || !isFiniteNumber(value.createdAt) || !isFiniteNumber(value.completedAt) || !isOneOf(value.outcome, HISTORY_OUTCOMES)) return INVALID;
  const summary = normalizeJsonRecord(value.summary);
  return summary.ok ? valid({
    id: value.id,
    createdAt: value.createdAt,
    completedAt: value.completedAt,
    outcome: value.outcome,
    summary: summary.value
  }) : INVALID;
}
function normalizeHistoryRecord(value) {
  if (!isRecord(value)) return null;
  const base = normalizeHistoryBase(value);
  if (!base.ok) return null;
  if (value.kind === "measurement") {
    if (value.transaction !== void 0 || value.experiment !== void 0) return null;
    const measurement = normalizeMeasurementSnapshot(value.measurement);
    return measurement ? { ...base.value, kind: "measurement", measurement } : null;
  }
  if (value.kind === "transaction") {
    if (value.measurement !== void 0 || value.experiment !== void 0) return null;
    const transaction = normalizeButlerTransaction(value.transaction);
    return transaction && transaction.completedAt !== void 0 && isOneOf(transaction.status, COMPLETED_TRANSACTION_STATUSES) ? { ...base.value, kind: "transaction", transaction } : null;
  }
  if (value.kind === "experiment") {
    if (value.measurement !== void 0 || value.transaction !== void 0) return null;
    const experiment = normalizeButlerExperiment(value.experiment);
    return experiment && experiment.completedAt !== void 0 && isOneOf(experiment.status, COMPLETED_EXPERIMENT_STATUSES) ? { ...base.value, kind: "experiment", experiment } : null;
  }
  return null;
}
function normalizeV2(value) {
  if (value.version !== BUTLER_DATA_VERSION || typeof value.performanceModeOn !== "boolean" || !Array.isArray(value.history)) return null;
  const activeTransaction = value.activeTransaction === null ? null : normalizeButlerTransaction(value.activeTransaction);
  const pendingExperiment = value.pendingExperiment === null ? null : normalizeButlerExperiment(value.pendingExperiment);
  const recoverableTransaction = activeTransaction && isOneOf(activeTransaction.status, ACTIVE_TRANSACTION_STATUSES) && isOneOf(activeTransaction.restoreStatus, ACTIVE_RESTORE_STATUSES) ? activeTransaction : null;
  const resumableExperiment = pendingExperiment && isOneOf(pendingExperiment.status, PENDING_EXPERIMENT_STATUSES) ? pendingExperiment : null;
  const history = [];
  for (const candidate of value.history) {
    const normalized = normalizeHistoryRecord(candidate);
    if (normalized) history.push(normalized);
  }
  return {
    version: BUTLER_DATA_VERSION,
    performanceModeOn: value.performanceModeOn,
    activeTransaction: recoverableTransaction,
    pendingExperiment: resumableExperiment,
    history
  };
}
function createEmptyButlerData() {
  return {
    version: BUTLER_DATA_VERSION,
    performanceModeOn: false,
    activeTransaction: null,
    pendingExperiment: null,
    history: []
  };
}
function migrateButlerData(value, _options = {}) {
  if (!isRecord(value)) return createEmptyButlerData();
  if (value.version === BUTLER_DATA_VERSION) return normalizeV2(value) ?? createEmptyButlerData();
  const snapshot = normalizePerformanceSnapshot(value.snapshot);
  if (!snapshot.ok || value.perfOn !== void 0 && typeof value.perfOn !== "boolean") {
    return createEmptyButlerData();
  }
  return {
    version: BUTLER_DATA_VERSION,
    performanceModeOn: false,
    // 旧版只保存整组快照，没有每个字段的实际回读结果，无法安全生成可恢复事务。
    // 清空保护槽，让用户重新体检并生成有逐项证据的新事务。
    activeTransaction: null,
    pendingExperiment: null,
    history: []
  };
}

// st-extension/src/apps/butler/extension-advisor.ts
var SYSTEM_EXTENSION_ADVICE = {
  expressions: {
    displayName: "角色表情图片",
    purpose: "根据对话内容选择并显示角色表情图片，用于增强聊天中的视觉反馈。",
    whenNeeded: "角色卡配置了表情图片，或正在使用依赖表情分类和切换的视觉玩法时需要。",
    disabledImpact: "角色表情图片不会再自动切换，依赖该功能的视觉表现会消失。",
    recommendation: "不用时可临时关闭"
  },
  gallery: {
    displayName: "图片画廊",
    purpose: "集中浏览聊天或图像生成流程产生的图片，方便回看和管理视觉内容。",
    whenNeeded: "经常生成图片、查看消息图片，或需要从聊天外集中浏览图片时需要。",
    disabledImpact: "画廊入口和集中浏览功能不可用，但聊天中的普通图片不一定受影响。",
    recommendation: "不用时可临时关闭"
  },
  memory: {
    displayName: "聊天总结",
    purpose: "定期总结较长的聊天历史，用较短的记忆内容帮助模型延续长期对话。",
    whenNeeded: "长篇对话需要持续记住前情，且当前预设确实使用自动总结时需要。",
    disabledImpact: "不再自动生成或更新总结，长聊天可能更依赖原始上下文或其他记忆方案。",
    recommendation: "排障时可临时关闭观察"
  },
  "quick-reply": {
    displayName: "快捷回复与自动化",
    purpose: "提供快捷按钮、命令组合和自动化流程，可快速执行常用操作。",
    whenNeeded: "使用快捷回复按钮、自动执行规则或依赖 Quick Reply 脚本的玩法时需要。",
    disabledImpact: "快捷按钮和相关自动化停止工作，依赖它们的操作流程需要手动完成。",
    recommendation: "排障时可临时关闭观察"
  },
  regex: {
    displayName: "正则处理",
    purpose: "按用户规则修改提示词、模型回复或消息显示内容，常用于格式清理和玩法协议。",
    whenNeeded: "角色卡、预设或当前玩法依赖 Regex 规则处理内容时需要，关闭前应先检查规则清单。",
    disabledImpact: "所有依赖规则的替换、隐藏和格式转换都会停止，部分角色卡或玩法可能异常。",
    recommendation: "保留"
  },
  "stable-diffusion": {
    displayName: "AI 图片生成",
    purpose: "连接图片生成服务，并从 SillyTavern 内发起角色、场景或其他图片生成。",
    whenNeeded: "正在使用 Stable Diffusion 或兼容图像服务生成图片时需要。",
    disabledImpact: "SillyTavern 内的图片生成入口和自动生成流程不可用。",
    recommendation: "不用时可临时关闭"
  },
  translate: {
    displayName: "消息翻译",
    purpose: "调用翻译服务处理输入或回复，帮助跨语言阅读和对话。",
    whenNeeded: "需要自动翻译消息，或当前角色和预设依赖翻译流程时需要。",
    disabledImpact: "自动翻译与翻译按钮不可用，消息会保留原始语言。",
    recommendation: "不用时可临时关闭"
  },
  tts: {
    displayName: "语音朗读",
    purpose: "把角色回复转换成语音并播放，可连接浏览器或外部语音服务。",
    whenNeeded: "需要角色语音、自动朗读或无障碍听读时需要。",
    disabledImpact: "回复不再自动或手动朗读，已配置的语音服务不会从该扩展调用。",
    recommendation: "不用时可临时关闭"
  },
  vectors: {
    displayName: "向量检索",
    purpose: "为聊天历史或资料建立语义索引，并按内容相关性召回片段。",
    whenNeeded: "长聊天、资料库或记忆流程需要语义召回，而不是只依赖关键词时需要。",
    disabledImpact: "语义召回和相关索引流程停止，模型可能失去由向量检索补入的相关内容。",
    recommendation: "排障时可临时关闭观察"
  }
};
function getSystemExtensionAdvice(name) {
  const normalized = name.trim().toLowerCase().split("/").pop() ?? "";
  return SYSTEM_EXTENSION_ADVICE[normalized] ?? null;
}

// st-extension/src/apps/butler/modals.ts
var LAYER_LABELS = {
  pageRendering: "页面与渲染",
  mediaResourcesStorage: "媒体、资源与存储",
  extensions: "扩展",
  generationContext: "生成与上下文"
};
var EXPLANATION_LABELS = [
  ["detected", "检测到什么"],
  ["change", "建议修改"],
  ["reason", "为什么可能改善"],
  ["impact", "可能影响"],
  ["reload", "生效与刷新"],
  ["restore", "如何恢复"],
  ["result", "实测结果"]
];
var CAPABILITY_LABELS = {
  pageSummary: "聊天与页面结构",
  performanceSettings: "性能设置",
  mediaDom: "图片与媒体",
  resourceTiming: "资源加载记录",
  storageEstimate: "站点存储空间",
  jsHeap: "网页内存信息",
  cssAnimations: "动画数量统计",
  longTasks: "页面卡顿记录"
};
function text(parent, value, className = "so-butler-text") {
  const node = el2("div", className);
  node.textContent = value;
  parent.append(node);
  return node;
}
function title(parent, value) {
  text(parent, value, "so-butler-modal-title");
}
function valueText(value) {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
function renderFinding(parent, finding2) {
  const card = document.createElement("details");
  card.className = `so-butler-finding so-butler-severity-${finding2.severity}`;
  const summary = document.createElement("summary");
  const layer = el2("span", "so-butler-layer");
  layer.textContent = LAYER_LABELS[finding2.layer];
  const detected = document.createElement("span");
  detected.textContent = finding2.explanation.detected;
  summary.append(layer, detected);
  const body = el2("div", "so-butler-finding-body");
  for (const [key, label] of EXPLANATION_LABELS) {
    const row = el2("div", "so-butler-explanation-row");
    const strong = document.createElement("strong");
    strong.textContent = label;
    const content = document.createElement("span");
    content.textContent = finding2.explanation[key];
    row.append(strong, content);
    body.append(row);
  }
  card.append(summary, body);
  parent.append(card);
  return card;
}
function environmentRows(parent, measurement) {
  const entries = [
    ["SillyTavern", measurement.environment.stVersion],
    ["st-stage", measurement.environment.stageBuild],
    ["设备", measurement.environment.mobile],
    ["聊天标识", measurement.chatKey ? { available: true, value: measurement.chatKey } : { available: false, reason: "不可用" }]
  ];
  for (const [label, observed2] of entries) {
    const row = el2("div", "so-butler-kv");
    const key = document.createElement("span");
    key.textContent = label;
    const value = document.createElement("strong");
    value.textContent = observed2.available ? valueText(observed2.value) : observed2.reason;
    if (!observed2.available) value.className = "so-butler-muted";
    row.append(key, value);
    parent.append(row);
  }
}
function renderMeasurementComparison(parent, comparison) {
  const table = el2("div", "so-butler-comparison-table");
  for (const row of summarizeMeasurementComparison(comparison)) {
    const item = el2("div", "so-butler-comparison-row");
    item.dataset.metricId = row.id;
    const heading = document.createElement("strong");
    heading.textContent = row.label;
    const values = el2("div", "so-butler-comparison-values");
    values.textContent = `优化前 ${row.before} → 优化后 ${row.after} · ${row.change}`;
    const explanation = el2("small", "so-butler-muted");
    explanation.textContent = row.explanation;
    item.append(heading, values, explanation);
    table.append(item);
  }
  parent.append(table);
  text(
    parent,
    "网页内存受浏览器垃圾回收和缓存影响，单次升降不能证明设置有效；请结合长任务、帧间隔和相同条件下的多次检查判断。",
    "so-butler-muted"
  );
}
function buildReportModal(controller) {
  return (body) => {
    title(body, "详细检查结果");
    text(body, "这里只展示可观测证据和能力缺失原因，不生成综合性能分数。", "so-butler-lead");
    const measurement = controller.getMeasurement();
    if (!measurement) {
      text(body, "尚无检查结果。关闭后运行一次基础检查或 6 秒检查。");
      return;
    }
    const environment = foldSection("检查环境", true);
    environmentRows(environment.body, measurement);
    const probeLabel = measurement.probe === "controlledScroll" ? "滚动长聊天检查" : measurement.probe === "idle" ? "不操作时检查" : "基础信息检查";
    text(environment.body, `检查方式：${probeLabel} · ${measurement.durationMs / 1e3} 秒 · ${measurement.foreground ? "页面在前台" : "页面在后台"}`);
    if (measurement.invalidReason) text(environment.body, measurement.invalidReason, "so-butler-alert");
    body.append(environment.box);
    const metrics = foldSection("高级：原始数据", false);
    for (const [key, value] of Object.entries(measurement.metrics)) {
      const row = el2("div", "so-butler-metric-block");
      const strong = document.createElement("strong");
      strong.textContent = key;
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(value, null, 2);
      row.append(strong, pre);
      metrics.body.append(row);
    }
    body.append(metrics.box);
    const capabilities = foldSection("哪些数据可以读取");
    for (const capability of measurement.capabilities) {
      text(
        capabilities.body,
        capability.available ? `${CAPABILITY_LABELS[capability.id] ?? capability.id}：可用` : `${CAPABILITY_LABELS[capability.id] ?? capability.id}：${capability.reason}`,
        capability.available ? "so-butler-text" : "so-butler-muted"
      );
    }
    body.append(capabilities.box);
    const findings = foldSection(`全部发现（${controller.getFindings().length}）`, true);
    for (const finding2 of controller.getFindings()) renderFinding(findings.body, finding2);
    body.append(findings.box);
    const comparison = controller.getComparison();
    if (comparison) {
      const compare = foldSection("最近一次前后对比", true);
      text(compare.body, comparison.comparable ? "两次检查条件一致，可以查看前后变化。" : `两次检查条件不同，暂不计算差值：${comparison.reasons.join("；")}。这里只并列原始数据。`);
      renderMeasurementComparison(compare.body, comparison);
      body.append(compare.box);
    }
    const history = foldSection(`最近操作（${controller.getData().history.length}）`);
    for (const record of [...controller.getData().history].reverse()) {
      text(history.body, `${new Date(record.createdAt).toLocaleString()} · ${String(record.summary.label ?? record.kind)} · ${record.outcome}`);
    }
    if (controller.getData().history.length === 0) text(history.body, "暂无已保存操作。");
    body.append(history.box);
  };
}
var EXTENSION_COST_PRINCIPLES = [
  "按代价从大到小看：每条消息都要处理的（改写、翻译、朗读、表情切换）＞ 每次生成都要请求外部服务的 ＞ 只在你点按钮时才干活的 ＞ 只加了几个按钮或设置项的。",
  "声明了样式表的扩展会参与每次重绘。楼层多、开了动画或模糊效果时，这部分更明显。",
  "需要后端模块的扩展（向量、语音、图片生成）会等服务器响应。服务不通时，卡的可能是等待超时，不是浏览器算不过来。",
  "有依赖方的扩展不能单独关：先关依赖它的那个，否则被依赖方一起失效，你会看到一片功能同时坏掉而误判。",
  '长聊天里最先该怀疑的不是扩展数量，而是"每楼都跑一遍"的处理。楼层数翻倍，这类代价就翻倍。',
  "关之前先想清楚失去什么：正则和记忆类扩展常被角色卡或预设依赖，关掉会让玩法直接不对，代价通常大于省下的性能。"
];
function dependentsOf(extension, all) {
  const target = extension.name.trim().toLowerCase().split("/").pop() ?? "";
  if (!target) return [];
  return all.filter((candidate) => {
    if (candidate.name === extension.name) return false;
    const declared = candidate.manifest?.dependencies;
    if (!declared || declared.status !== "valid") return false;
    return declared.names.some(
      (name) => (name.trim().toLowerCase().split("/").pop() ?? "") === target
    );
  }).map((candidate) => candidate.manifest?.displayName || candidate.name);
}
function thirdPartyCard(extension, all) {
  const card = document.createElement("details");
  card.className = "so-butler-system-advice";
  card.dataset.extension = extension.name;
  const summary = document.createElement("summary");
  const displayName = extension.manifest?.displayName || extension.name;
  const stateLabel = extension.isSelf ? "受保护，不建议关闭" : extension.configuredEnabled ? "当前启用" : "当前禁用";
  summary.textContent = `${displayName} · ${stateLabel}`;
  const content = el2("div", "so-butler-system-advice-body");
  text(content, `扩展标识：${extension.name}${extension.manifest?.version ? ` · 版本 ${extension.manifest.version}` : ""}`);
  if (extension.isSelf) {
    text(content, `这是 ${SELF_DIRECTORY_NAME} 自己。关掉它会同时失去手机、立绘、图库、变量、导出和管家本身，请到 SillyTavern 扩展管理里操作，管家不提供自我关闭入口。`, "so-butler-alert");
  }
  const declares = [];
  if (extension.manifest?.css) declares.push("样式表（参与每次重绘）");
  if (extension.manifest?.js) declares.push("脚本");
  const modules = extension.manifest?.requiredModules;
  if (modules?.status === "valid" && modules.names.length > 0) {
    declares.push(`后端模块：${modules.names.join("、")}（需要服务器响应）`);
  }
  text(content, declares.length > 0 ? `声明了：${declares.join("；")}` : "清单里没有声明样式表或后端模块。");
  const dependencies = extension.manifest?.dependencies;
  if (dependencies?.status === "valid" && dependencies.names.length > 0) {
    text(content, `它依赖：${dependencies.names.join("、")}。这些先关掉的话，本扩展也会失效。`);
  }
  const dependents = dependentsOf(extension, all);
  if (dependents.length > 0) {
    text(content, `依赖它的扩展：${dependents.join("、")}。要关它请先关这些，否则会连带失效。`, "so-butler-alert");
  }
  if (extension.manifest?.loadingOrder !== void 0) {
    text(content, `加载顺序：${valueText(extension.manifest.loadingOrder)}`, "so-butler-muted");
  }
  if (!extension.manifest) {
    text(content, "读不到这个扩展的清单，因此无法说明它声明了什么。不提供关闭或性能结论。", "so-butler-muted");
  }
  text(content, "关闭方法：SillyTavern「扩展」管理里停用，然后刷新页面。刷新前脚本和样式仍在运行。", "so-butler-muted");
  card.append(summary, content);
  return card;
}
function buildExtensionModal(services, controller) {
  return (body) => {
    let disposed = false;
    let inventory = null;
    let busy = false;
    let notice = "";
    let emergencyBackup = readEmergencyBackup(services.backupStorage);
    const run = async (task) => {
      if (busy) return;
      busy = true;
      notice = "";
      render2();
      try {
        await task();
      } catch (error) {
        notice = error instanceof Error ? error.message : "操作失败";
      } finally {
        busy = false;
        if (!disposed) render2();
      }
    };
    const renderStrandedExperiment = (experiment) => {
      title(body, "恢复上次排查前的扩展状态");
      text(body, "「临时关闭扩展找卡顿」流程已改为只读的扩展指南。你上次的排查还没结束，下面是它当时暂时禁用的扩展。", "so-butler-lead");
      text(body, `上次暂时禁用：${(experiment.trialDisabledExtensions ?? experiment.candidateExtensions).join("、") || "（清单为空）"}`);
      text(body, `排查前的原始禁用清单：${experiment.originalDisabledExtensions.join("、") || "（原本没有禁用任何扩展）"}`);
      body.append(appButton(busy ? "正在恢复…" : "恢复排查前的扩展状态", () => run(async () => {
        await controller.discardStrandedExperiment();
        notice = "已恢复排查前的扩展状态。刷新 SillyTavern 后生效。";
      })));
      text(body, "恢复后请刷新页面：扩展的脚本与样式只有刷新才真正停止或重新加载。", "so-butler-muted");
      if (notice) text(body, notice, "so-butler-alert");
    };
    const renderInventory = (ready) => {
      title(body, "扩展指南");
      text(body, "用途：看懂每个扩展做什么、大致的性能代价、什么情况下可以放心关掉。开关一律由你在 SillyTavern 自己的「扩展」管理里操作，管家不代你改第三方扩展的启停。", "so-butler-lead");
      text(body, "扩展脚本和样式只有刷新后才会真正停止或重新加载，所以改完记得刷新页面再看效果。", "so-butler-muted");
      if (emergencyBackup) {
        const backup = foldSection("检测到紧急恢复备份", true, "butler-emergency-backup");
        text(backup.body, `保存时间：${new Date(emergencyBackup.createdAt).toLocaleString()} · 原禁用清单 ${emergencyBackup.disabledExtensions.length} 项。`);
        backup.body.append(appButton("恢复备份中的禁用清单", () => run(async () => {
          if (!emergencyBackup) return;
          await controller.restoreEmergencyBackup(emergencyBackup);
          emergencyBackup = null;
          notice = "紧急备份已恢复。";
        })));
        body.append(backup.box);
      }
      text(body, "内置扩展用途与关闭建议", "so-butler-section-title");
      text(body, "这里根据功能用途给出保守建议，不代表已经测出某个扩展耗时。内置扩展只读展示，不会被下方排障操作自动关闭。", "so-butler-muted");
      const systemList = el2("div", "so-butler-system-advice-list");
      const systemExtensions = ready.extensions.filter((extension) => extension.type.toLowerCase() === "system");
      for (const extension of systemExtensions) {
        const advice = getSystemExtensionAdvice(extension.name);
        const card = document.createElement("details");
        card.className = "so-butler-system-advice";
        const summary = document.createElement("summary");
        const displayName = advice?.displayName || extension.manifest?.displayName || extension.name;
        summary.textContent = advice ? `${displayName} · 当前${extension.configuredEnabled ? "启用" : "禁用"} · ${advice.recommendation}` : `${displayName} · 当前${extension.configuredEnabled ? "启用" : "禁用"} · 用途未收录`;
        const content = el2("div", "so-butler-system-advice-body");
        if (advice) {
          text(content, `用途：${advice.purpose}`);
          text(content, `什么时候需要：${advice.whenNeeded}`);
          text(content, `关闭会失去：${advice.disabledImpact}`);
          text(content, `建议：${advice.recommendation}。这是用途判断，不是实际耗时结论。`, "so-butler-muted");
        } else {
          text(content, `扩展标识：${extension.name}。当前目录没有足够资料说明用途，因此不提供关闭或性能结论。`, "so-butler-muted");
        }
        card.append(summary, content);
        systemList.append(card);
      }
      if (systemExtensions.length === 0) text(systemList, "当前没有读取到内置扩展。", "so-butler-muted");
      body.append(systemList);
      text(body, "第三方扩展指南", "so-butler-section-title");
      text(body, "这里只读列出每个第三方扩展声明了什么、谁依赖它、关闭前要注意什么。管家不代你开关任何第三方扩展——要停用请到 SillyTavern 自己的「扩展」管理里操作，改完刷新页面才真正生效。", "so-butler-lead");
      const thirdPartyExtensions = ready.extensions.filter((extension) => extension.type.toLowerCase() !== "system");
      const list = el2("div", "so-butler-extension-list");
      for (const extension of thirdPartyExtensions) {
        list.append(thirdPartyCard(extension, thirdPartyExtensions));
      }
      if (thirdPartyExtensions.length === 0) text(list, "当前没有读取到第三方扩展。", "so-butler-muted");
      body.append(list);
      const principles = foldSection("怎么判断一个扩展值不值得关", false, "butler-extension-principles");
      for (const line of EXTENSION_COST_PRINCIPLES) text(principles.body, line);
      body.append(principles.box);
      text(body, "管家不会读取第三方扩展的代码，也测不出单个扩展占了多少帧。上面写的是它自己声明的信息加通用经验，不是对某个扩展的实测结论。要确认到底是谁拖慢的，只能在扩展管理里关掉一个、刷新、重复同一个操作再看整体检查结果。", "so-butler-muted");
      if (notice) text(body, notice, "so-butler-alert");
    };
    const render2 = () => {
      if (disposed) return;
      body.textContent = "";
      const pending = controller.getData().pendingExperiment;
      if (pending) {
        renderStrandedExperiment(pending);
        return;
      }
      if (!inventory) {
        title(body, "扩展指南");
        text(body, "正在读取 SillyTavern 扩展清单...");
        return;
      }
      if (inventory.status !== "ready") {
        title(body, "扩展指南");
        text(body, inventory.reason, "so-butler-alert");
        return;
      }
      renderInventory(inventory);
    };
    render2();
    void services.readExtensions().then((value) => {
      if (disposed) return;
      inventory = value;
      render2();
    });
    return () => {
      disposed = true;
    };
  };
}
function advisorSection(body, heading, paragraphs) {
  const section2 = foldSection(heading, true);
  for (const paragraph of paragraphs) text(section2.body, paragraph);
  body.append(section2.box);
}
function buildAdvisorModal(services) {
  return (body) => {
    title(body, "记忆与服务器设置建议");
    text(body, "这里解释会影响记忆、检索、总结和服务器资源的设置。管家只读查看，不会自动修改，也不会加入一键性能优化。", "so-butler-lead");
    const health = services.readHealth();
    const extensionState = text(body, "常用扩展状态：正在读取 SillyTavern 扩展清单...", "so-butler-muted");
    advisorSection(body, "世界书（World Info）", [
      "世界书条目越多、扫描深度越高，生成前匹配工作通常越多；它同时承载设定一致性，不应按“越少越好”处理。",
      "优先清理重复条目、缩小不必要的扫描范围，再用相同对话比较调整前后的生成时间。"
    ]);
    advisorSection(body, "向量检索（Vector Storage）", [
      "向量检索会增加索引、查询和存储工作，但能从长历史或资料库召回相关内容。",
      "只在明确不需要语义召回的对话里临时关闭并比较；不要把 Token 减少直接等同于页面渲染变快。"
    ]);
    advisorSection(body, "自动总结（Summarize）", [
      "总结会额外调用模型或处理历史，但可以控制长期上下文大小。频率太高会增加请求，频率太低会让上下文膨胀。",
      "根据实际聊天长度和模型速度调整，保留角色记忆需求。"
    ]);
    advisorSection(body, "自动化规则（Regex / Quick Reply）", [
      "大量生成时 Regex 规则可能增加每次回复的处理工作，且角色卡和预设可能依赖它们，因此管家不会自动关闭。",
      health.quickReplySets.available ? `当前检测到 ${health.quickReplySets.value} 个 Quick Reply 集合。集合数量只作信息展示，不代表运行时成本。` : `Quick Reply 集合数不可用：${health.quickReplySets.reason}`
    ]);
    advisorSection(body, "服务器设置（config.yaml）", [
      "requestCompression：长聊天或弱网可减少传输体积；修改后需要重启 SillyTavern。",
      "lazyLoadCharacters：大量角色卡时应保持开启；旧配置可能沿用 false。",
      "memoryCacheCapacity：按角色卡规模设置缓存容量，容量越高通常占用更多服务端内存。",
      "useDiskCache：只有磁盘极慢时才考虑关闭。管家没有稳定公开接口读取或修改这些键，因此不会伪装成已检测。"
    ]);
    void services.readExtensions().then((inventory) => {
      if (inventory.status !== "ready") {
        extensionState.textContent = `常用扩展状态：不可用（${inventory.reason}）`;
        return;
      }
      const status = (label, names) => {
        const found = inventory.extensions.find((extension) => names.includes(extension.name));
        return found ? `${label}：当前${found.configuredEnabled ? "启用" : "禁用"}` : `${label}：未检测到`;
      };
      extensionState.textContent = [
        status("Vector Storage", ["vectors"]),
        status("Summarize", ["memory"]),
        status("Regex", ["regex"])
      ].join("；");
    }).catch(() => {
      extensionState.textContent = "常用扩展状态：读取失败";
    });
  };
}

// st-extension/src/apps/butler/st-contract.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function isStringRecord(value) {
  return isRecord2(value) && Object.values(value).every((item) => typeof item === "string");
}
function declaration(value) {
  if (value === void 0) return { status: "absent", names: [] };
  if (!isStringArray(value)) return { status: "invalid", names: [] };
  return { status: "valid", names: [...value] };
}
function inspectExtensionModule(value) {
  if (!isRecord2(value)) {
    const reason = "extensions.js 模块形状无效";
    return { status: "unavailable", reason, governance: { writable: false, reason } };
  }
  const missing = [];
  if (!isStringArray(value.extensionNames)) missing.push("extensionNames");
  if (!isStringRecord(value.extensionTypes)) missing.push("extensionTypes");
  const settings = value.extension_settings;
  if (!isRecord2(settings) || !isStringArray(settings.disabledExtensions)) {
    missing.push("extension_settings.disabledExtensions");
  }
  if (typeof value.findExtension !== "function") missing.push("findExtension");
  if (typeof value.getExtensionManifest !== "function") missing.push("getExtensionManifest");
  if (missing.length > 0) {
    const reason = `extensions.js 缺少可读契约：${missing.join("、")}`;
    return { status: "unavailable", reason, governance: { writable: false, reason } };
  }
  const writeMissing = [];
  if (typeof value.enableExtension !== "function") writeMissing.push("enableExtension");
  if (typeof value.disableExtension !== "function") writeMissing.push("disableExtension");
  const governance = writeMissing.length === 0 ? { writable: true } : { writable: false, reason: `扩展治理只读：缺少 ${writeMissing.join("、")}` };
  return {
    status: "ready",
    api: {
      extensionNames: [...value.extensionNames],
      extensionTypes: { ...value.extensionTypes },
      // Keep the validated live object: ST replaces disabledExtensions after enableExtension().
      extensionSettings: settings,
      findExtension: value.findExtension,
      getExtensionManifest: value.getExtensionManifest,
      enableExtension: typeof value.enableExtension === "function" ? value.enableExtension : void 0,
      disableExtension: typeof value.disableExtension === "function" ? value.disableExtension : void 0
    },
    governance
  };
}
function inspectPowerUserModule(value) {
  if (!isRecord2(value) || typeof value.applyPowerUserSettings !== "function") {
    return { available: false, reason: "power-user.js 缺少 applyPowerUserSettings" };
  }
  return { available: true, applyPowerUserSettings: value.applyPowerUserSettings };
}
function summarizeExtensionManifest(value) {
  if (!isRecord2(value)) return null;
  const summary = {
    dependencies: declaration(value.dependencies),
    requiredModules: declaration(value.requires)
  };
  if (typeof value.display_name === "string") summary.displayName = value.display_name;
  if (typeof value.version === "string") summary.version = value.version;
  if (typeof value.loading_order === "string" || typeof value.loading_order === "number") {
    summary.loadingOrder = value.loading_order;
  }
  if (typeof value.js === "string") summary.js = value.js;
  if (typeof value.css === "string") summary.css = value.css;
  return summary;
}
function parseFoundExtension(value) {
  if (!isRecord2(value) || typeof value.name !== "string" || typeof value.enabled !== "boolean") return null;
  return { name: value.name, configuredEnabled: value.enabled };
}

// st-extension/src/apps/butler/bridge.ts
function getST2() {
  try {
    return window.SillyTavern?.getContext();
  } catch {
    return void 0;
  }
}
var PERF_FIELDS = {
  fast_ui_mode: "boolean",
  reduced_motion: "boolean",
  noShadows: "boolean",
  smooth_streaming: "boolean",
  stream_fade_in: "boolean",
  streaming_fps: "number",
  chat_truncation: "number"
};
function unavailableCapabilities2(reason) {
  return Object.fromEntries(
    Object.keys(PERF_FIELDS).map((key) => [key, { available: false, reason }])
  );
}
function readPerfState() {
  const pu = getST2()?.powerUserSettings;
  if (!pu) {
    const reason = "未检测到 SillyTavern power_user 设置";
    return { status: "unavailable", snapshot: {}, capabilities: unavailableCapabilities2(reason), reason };
  }
  const snapshot = {};
  const capabilities = {};
  for (const [rawKey, expected] of Object.entries(PERF_FIELDS)) {
    const key = rawKey;
    const value = pu[key];
    const valid2 = expected === "boolean" ? typeof value === "boolean" : typeof value === "number" && Number.isFinite(value);
    if (valid2) {
      Object.assign(snapshot, { [key]: value });
      capabilities[key] = { available: true };
    } else {
      capabilities[key] = { available: false, reason: "字段缺失或类型无效" };
    }
  }
  const complete = Object.values(capabilities).every((capability) => capability.available);
  return { status: complete ? "ready" : "partial", snapshot, capabilities };
}
function readPerf() {
  const result = readPerfState();
  return result.status === "ready" ? result.snapshot : null;
}
function readMobileState() {
  const st = getST2();
  if (typeof st?.isMobile !== "function") {
    return { available: false, reason: "未检测到 SillyTavern 移动端判断接口" };
  }
  try {
    const value = st.isMobile();
    return typeof value === "boolean" ? { available: true, value } : { available: false, reason: "SillyTavern 移动端判断返回格式无效" };
  } catch {
    return { available: false, reason: "SillyTavern 移动端判断失败" };
  }
}
async function applyVisuals() {
  try {
    const modUrl = "/scripts/power-user.js";
    const contract = inspectPowerUserModule(await import(modUrl));
    if (!contract.available) throw new Error(contract.reason);
    contract.applyPowerUserSettings();
  } catch (err) {
    console.warn("[st-stage] 管家：applyPowerUserSettings 不可用，视觉项将在刷新页面后生效", err);
  }
}
function applyReducedMotion(on) {
  const jq = window.jQuery;
  if (jq?.fx) jq.fx.off = on;
}
async function reloadChatSafe(st) {
  try {
    await Promise.resolve(st.reloadCurrentChat?.());
  } catch (err) {
    console.warn("[st-stage] 管家：重载当前对话失败，消息加载数将在切换对话后生效", err);
  }
}
async function writePerf(fields) {
  const st = getST2();
  const pu = st?.powerUserSettings;
  if (!st || !pu) return;
  const prevTrunc = typeof pu.chat_truncation === "number" && Number.isFinite(pu.chat_truncation) ? pu.chat_truncation : void 0;
  Object.assign(pu, fields);
  if (fields.reduced_motion !== void 0) applyReducedMotion(fields.reduced_motion);
  if (fields.fast_ui_mode !== void 0 || fields.noShadows !== void 0) await applyVisuals();
  st.saveSettingsDebounced?.();
  if (fields.chat_truncation !== void 0 && fields.chat_truncation !== prevTrunc) {
    await reloadChatSafe(st);
  }
}
function readHealthState() {
  const ext = getST2()?.extensionSettings;
  if (!ext) {
    const reason = "未检测到 SillyTavern 扩展设置";
    return {
      disabledExtensions: { available: false, reason },
      quickReplySets: { available: false, reason }
    };
  }
  const disabled = ext["disabledExtensions"];
  const qr = ext["quickReply"];
  return {
    disabledExtensions: Array.isArray(disabled) ? { available: true, value: disabled.length } : { available: false, reason: "禁用扩展清单缺失或格式无效" },
    quickReplySets: Array.isArray(qr?.config?.setList) ? { available: true, value: qr.config.setList.length } : { available: false, reason: "Quick Reply 设置缺失或格式无效" }
  };
}
function scalarId(value) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "unknown";
}
function comparisonDigest(value) {
  let hash2 = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash2 ^= BigInt(value.charCodeAt(index));
    hash2 = BigInt.asUintN(64, hash2 * 0x100000001b3n);
  }
  return hash2.toString(16).padStart(16, "0");
}
function chatKey(st) {
  const conversation = scalarId(st.chatId);
  const identity = typeof st.groupId === "string" || typeof st.groupId === "number" ? `group:${st.groupId}:${conversation}` : `character:${scalarId(st.characterId)}:${conversation}`;
  return `chat:${comparisonDigest(identity)}`;
}
function readPageSummary() {
  const st = getST2();
  const chat2 = st?.chat;
  const chatSummary = Array.isArray(chat2) ? {
    available: true,
    value: {
      chatKey: chatKey(st ?? {}),
      messageCount: chat2.length,
      userMessageCount: chat2.filter((message) => typeof message === "object" && message !== null && message.is_user === true).length,
      assistantMessageCount: chat2.filter((message) => typeof message === "object" && message !== null && message.is_user === false && message.is_system !== true).length
    }
  } : { available: false, reason: "聊天摘要不可用" };
  const root = typeof document === "undefined" ? null : document.querySelector("#chat");
  const dom = root ? {
    available: true,
    value: {
      renderedMessageCount: root.querySelectorAll(".mes").length,
      chatNodeCount: root.querySelectorAll("*").length + 1
    }
  } : { available: false, reason: "未找到 #chat DOM" };
  return { chat: chatSummary, dom };
}
function resourceGroupKey(url, initiatorType) {
  const marker = "/scripts/extensions/";
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex >= 0) {
    const segments = url.pathname.slice(markerIndex + marker.length).split("/").filter(Boolean);
    if (segments.length < 2) return null;
    const extensionName = segments[0] === "third-party" && segments.length >= 3 ? `third-party/${segments[1]}` : segments[0];
    return `extension:${extensionName}`;
  }
  const kinds = {
    img: "image",
    image: "image",
    script: "script",
    link: "stylesheet",
    css: "stylesheet",
    font: "font",
    audio: "media",
    video: "media",
    iframe: "document",
    fetch: "fetch",
    xmlhttprequest: "fetch"
  };
  const kind = typeof initiatorType === "string" ? kinds[initiatorType.toLowerCase()] ?? "other" : "other";
  return `resource:${kind}`;
}
function evidenceNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
function groupResourceTimings(entries) {
  const groups = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    let url;
    try {
      url = new URL(entry.name);
    } catch {
      continue;
    }
    const key = resourceGroupKey(url, entry.initiatorType);
    if (!key) continue;
    const current2 = groups.get(key) ?? { key, count: 0, transferSize: 0, durationMs: 0 };
    current2.count += 1;
    current2.transferSize += evidenceNumber(entry.transferSize);
    current2.durationMs += evidenceNumber(entry.duration);
    groups.set(key, current2);
  }
  return [...groups.values()];
}
async function defaultModuleLoader(specifier) {
  return import(specifier);
}
function isSelfExtension(name) {
  return isSelfExtensionName(name);
}
function createButlerBridge(deps = {}) {
  const loadModule = deps.loadModule ?? defaultModuleLoader;
  let extensionContractPromise;
  const loadExtensionContract = () => {
    extensionContractPromise ?? (extensionContractPromise = loadModule("/scripts/extensions.js").then(inspectExtensionModule).catch(() => {
      const reason = "无法加载 SillyTavern 扩展接口";
      return { status: "unavailable", reason, governance: { writable: false, reason } };
    }));
    return extensionContractPromise;
  };
  const findExtension = async (name) => {
    const contract = await loadExtensionContract();
    if (contract.status !== "ready") {
      return { ok: false, code: "api-unavailable", error: contract.reason };
    }
    try {
      const rawFound = contract.api.findExtension(name);
      if (rawFound === null) return { ok: false, code: "not-found", error: "未找到扩展" };
      const found = parseFoundExtension(rawFound);
      if (!found) {
        return { ok: false, code: "invalid-response", error: "SillyTavern findExtension 返回格式无效" };
      }
      return { ok: true, extension: found };
    } catch {
      return { ok: false, code: "api-error", error: "SillyTavern 扩展接口调用失败" };
    }
  };
  return {
    readPageSummary,
    readMobileState,
    readHealthState,
    async readExtensions() {
      const contract = await loadExtensionContract();
      if (contract.status !== "ready") {
        return {
          status: "unavailable",
          reason: contract.reason,
          governance: contract.governance,
          disabledExtensions: [],
          extensions: []
        };
      }
      const disabled = contract.api.extensionSettings.disabledExtensions;
      const extensions = contract.api.extensionNames.map((name) => {
        let rawManifest;
        try {
          rawManifest = contract.api.getExtensionManifest(name);
        } catch {
          rawManifest = null;
        }
        return {
          name,
          type: contract.api.extensionTypes[name] ?? "unknown",
          configuredEnabled: !disabled.includes(name),
          isSelf: isSelfExtension(name),
          manifest: summarizeExtensionManifest(rawManifest)
        };
      });
      return {
        status: "ready",
        governance: contract.governance,
        disabledExtensions: [...disabled],
        extensions
      };
    },
    findExtension,
    async setExtensionEnabled(name, enabled) {
      const contract = await loadExtensionContract();
      if (contract.status !== "ready") {
        return { ok: false, code: "api-unavailable", error: contract.reason };
      }
      if (!contract.governance.writable || !contract.api.enableExtension || !contract.api.disableExtension) {
        return {
          ok: false,
          code: "read-only",
          error: contract.governance.reason ?? "SillyTavern 扩展治理当前只读"
        };
      }
      const found = await findExtension(name);
      if (!found.ok) {
        return found.code === "not-found" ? { ok: false, code: "not-found", error: found.error } : { ok: false, code: "api-error", error: "SillyTavern 扩展接口调用失败" };
      }
      if (!enabled && isSelfExtension(found.extension.name)) {
        return { ok: false, code: "protected", error: `管家不能禁用 ${SELF_DIRECTORY_NAME} 自身` };
      }
      try {
        const toggle = enabled ? contract.api.enableExtension : contract.api.disableExtension;
        await Promise.resolve(toggle(found.extension.name, false));
        return {
          ok: true,
          name: found.extension.name,
          configuredEnabled: enabled,
          reloadRequired: true
        };
      } catch {
        return { ok: false, code: "api-error", error: "SillyTavern 扩展接口调用失败" };
      }
    }
  };
}

// st-extension/src/apps/butler/metrics.ts
var BUTLER_PROBE_DURATION_MS = 6e3;
var TIMER_INTERVAL_MS = 100;
function abortError() {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}
function runProbeTimeline(durationMs, signal, handlers, deps = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  setTimer: (callback, ms) => window.setTimeout(callback, ms),
  clearTimer: (id) => window.clearTimeout(id)
}) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const startedAt = deps.now();
    let frameId = null;
    let timerId = null;
    let finishId = null;
    let settled = false;
    let nextTimerAt = TIMER_INTERVAL_MS;
    const cleanup = () => {
      if (frameId !== null) deps.cancelFrame(frameId);
      if (timerId !== null) deps.clearTimer(timerId);
      if (finishId !== null) deps.clearTimer(finishId);
      signal.removeEventListener("abort", onAbort);
      frameId = timerId = finishId = null;
    };
    const settle = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => settle(abortError());
    const frame = (time) => {
      if (settled || signal.aborted) return;
      handlers.onFrame(time - startedAt);
      frameId = deps.requestFrame(frame);
    };
    const timer = () => {
      if (settled || signal.aborted) return;
      const elapsed = deps.now() - startedAt;
      handlers.onTimer(nextTimerAt, elapsed);
      nextTimerAt += TIMER_INTERVAL_MS;
      timerId = deps.setTimer(timer, Math.max(0, nextTimerAt - elapsed));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    frameId = deps.requestFrame(frame);
    timerId = deps.setTimer(timer, TIMER_INTERVAL_MS);
    finishId = deps.setTimer(() => settle(), durationMs);
  });
}
function available(id) {
  return { id, available: true };
}
function unavailable(id, reason) {
  return { id, available: false, reason };
}
function finiteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
function percentile95(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}
function summarizeMedia(root, viewport) {
  const kinds = {
    images: "img",
    videos: "video",
    audio: "audio",
    canvas: "canvas",
    iframes: "iframe"
  };
  const result = {};
  let visible = 0;
  let offscreen = 0;
  for (const [key, selector2] of Object.entries(kinds)) {
    const nodes = [...root.querySelectorAll(selector2)];
    result[key] = nodes.length;
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      const intersects = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < viewport.height && rect.left < viewport.width;
      if (intersects) visible += 1;
      else offscreen += 1;
    }
  }
  return { ...result, visible, offscreen };
}
function sanitizeResourceGroups(groups) {
  const aggregated = /* @__PURE__ */ new Map();
  for (const group of groups) {
    const key = group.key.startsWith("extension:") ? group.key : `resource:${group.key.startsWith("resource:") ? group.key.slice("resource:".length) || "other" : "other"}`;
    const current2 = aggregated.get(key) ?? { key, count: 0, transferSize: 0, durationMs: 0 };
    current2.count += finiteNonNegative(group.count);
    current2.transferSize += finiteNonNegative(group.transferSize);
    current2.durationMs += finiteNonNegative(group.durationMs);
    aggregated.set(key, current2);
  }
  return [...aggregated.values()];
}
function combineSignals(external) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (external?.aborted) controller.abort();
  else external?.addEventListener("abort", onAbort, { once: true });
  return {
    controller,
    cleanup: () => external?.removeEventListener("abort", onAbort)
  };
}
function invalidReasonFromError(error, fallback) {
  return error instanceof Error && error.name === "AbortError" ? fallback : "采样失败，请重试";
}
function createMetricsSampler(deps) {
  const collectStatic = async (probe = "static") => {
    const page = deps.readPageSummary();
    const perf = deps.readPerfState();
    const capabilities = [];
    const metrics = {};
    if (page.chat.available && page.dom.available) {
      capabilities.push(available("pageSummary"));
      metrics.page = {
        messageCount: page.chat.value.messageCount,
        userMessageCount: page.chat.value.userMessageCount,
        assistantMessageCount: page.chat.value.assistantMessageCount,
        renderedMessageCount: page.dom.value.renderedMessageCount,
        chatNodeCount: page.dom.value.chatNodeCount
      };
    } else {
      capabilities.push(unavailable(
        "pageSummary",
        [page.chat, page.dom].filter((entry) => !entry.available).map((entry) => entry.reason).join("；")
      ));
    }
    if (perf.status !== "unavailable") {
      capabilities.push(available("performanceSettings"));
      metrics.performanceSettings = { ...perf.snapshot };
    } else {
      capabilities.push(unavailable("performanceSettings", perf.reason ?? "性能设置不可用"));
    }
    const root = deps.getChatScroller() ?? document;
    metrics.media = summarizeMedia(root, deps.getViewport());
    capabilities.push(available("mediaDom"));
    const resourceEvidence = deps.readResourceGroups();
    if (resourceEvidence === null) {
      capabilities.push(unavailable("resourceTiming", "当前浏览器不支持资源加载记录"));
    } else {
      metrics.resources = { groups: sanitizeResourceGroups(resourceEvidence) };
      capabilities.push(available("resourceTiming"));
    }
    const storage = await deps.estimateStorage();
    if (storage) {
      metrics.storage = {
        usageBytes: finiteNonNegative(storage.usage),
        quotaBytes: finiteNonNegative(storage.quota)
      };
      capabilities.push(available("storageEstimate"));
    } else {
      capabilities.push(unavailable("storageEstimate", "当前浏览器不支持站点存储检查"));
    }
    const heap = deps.readHeapBytes();
    if (heap === null) capabilities.push(unavailable("jsHeap", "当前浏览器不支持网页内存信息"));
    else {
      metrics.heap = { usedBytes: finiteNonNegative(heap) };
      capabilities.push(available("jsHeap"));
    }
    const animationCount2 = deps.countAnimations();
    if (animationCount2 === null) capabilities.push(unavailable("cssAnimations", "当前浏览器不支持动画数量统计"));
    else {
      metrics.animations = { running: finiteNonNegative(animationCount2) };
      capabilities.push(available("cssAnimations"));
    }
    return {
      id: deps.createId(),
      createdAt: deps.now(),
      durationMs: probe === "static" ? 0 : BUTLER_PROBE_DURATION_MS,
      probe,
      foreground: deps.isForeground(),
      ...page.chat.available ? { chatKey: page.chat.value.chatKey } : {},
      environment: await deps.readEnvironment(),
      capabilities,
      metrics
    };
  };
  const sampleDynamic = async (probe, signal, onFrameEffect) => {
    const snapshot = await collectStatic(probe);
    const combined = combineSignals(signal);
    const controller = combined.controller;
    const initialGenerating = deps.isGenerating();
    if (initialGenerating === null) {
      combined.cleanup();
      snapshot.invalidReason = "无法读取生成状态，采样未开始";
      return snapshot;
    }
    if (initialGenerating) {
      combined.cleanup();
      snapshot.invalidReason = "当前正在生成，采样未开始";
      return snapshot;
    }
    const initialPage = snapshot.metrics.page;
    const initialPageRecord = initialPage && typeof initialPage === "object" && !Array.isArray(initialPage) ? initialPage : null;
    const frameIntervals = [];
    const timerDelays = [];
    const longTasks = [];
    let previousFrame = null;
    let cancellationReason = "";
    let longTaskSubscription = null;
    let userInterfered = false;
    const userEvents = ["wheel", "pointerdown", "touchstart", "keydown", "input"];
    const onUserInterference = () => {
      userInterfered = true;
    };
    const cancel = (reason) => {
      if (!cancellationReason) cancellationReason = reason;
      controller.abort();
    };
    const onVisibility = () => {
      if (!deps.isForeground()) cancel("页面进入后台，采样已取消，请重试");
    };
    document.addEventListener("visibilitychange", onVisibility);
    for (const event of userEvents) document.addEventListener(event, onUserInterference, true);
    try {
      if (!deps.isForeground()) cancel("页面进入后台，采样已取消，请重试");
      longTaskSubscription = deps.observeLongTasks((duration) => {
        if (Number.isFinite(duration) && duration >= 0) longTasks.push(duration);
      });
      snapshot.capabilities.push(longTaskSubscription ? available("longTasks") : unavailable("longTasks", "当前浏览器不支持页面卡顿记录"));
      await deps.runTimeline(BUTLER_PROBE_DURATION_MS, controller.signal, {
        onFrame(time) {
          if (!deps.isForeground()) {
            cancel("页面进入后台，采样已取消，请重试");
            return;
          }
          if (userInterfered) cancel("检测到用户干预，采样已取消");
          const generating = deps.isGenerating();
          if (generating === null) cancel("无法读取生成状态，采样已取消");
          else if (generating !== initialGenerating) cancel("生成状态发生变化，采样已取消");
          const currentPage = deps.readPageSummary();
          if (snapshot.chatKey && currentPage.chat.available && currentPage.chat.value.chatKey !== snapshot.chatKey) {
            cancel("聊天已切换，采样已取消");
          }
          if (initialPageRecord && currentPage.dom.available) {
            const initialRendered = initialPageRecord.renderedMessageCount;
            const initialNodes = initialPageRecord.chatNodeCount;
            if (currentPage.dom.value.renderedMessageCount !== initialRendered || currentPage.dom.value.chatNodeCount !== initialNodes) {
              cancel("聊天布局变化，采样已取消");
            }
          }
          const reason = onFrameEffect?.(time);
          if (reason) cancel(reason);
          if (previousFrame !== null) frameIntervals.push(Math.max(0, time - previousFrame));
          previousFrame = time;
        },
        onTimer(scheduled, actual) {
          timerDelays.push(Math.max(0, actual - scheduled));
        }
      });
    } catch (error) {
      cancellationReason || (cancellationReason = invalidReasonFromError(error, signal?.aborted ? "用户取消了采样" : "采样已取消，请重试"));
    } finally {
      document.removeEventListener("visibilitychange", onVisibility);
      for (const event of userEvents) document.removeEventListener(event, onUserInterference, true);
      longTaskSubscription?.disconnect();
      combined.cleanup();
    }
    const animationCount2 = deps.countAnimations();
    snapshot.metrics.dynamic = {
      frameSamples: frameIntervals.length,
      frameIntervalP95Ms: percentile95(frameIntervals),
      frameIntervalsOver50Ms: frameIntervals.filter((value) => value > 50).length,
      timerDelayP95Ms: percentile95(timerDelays),
      longTaskCount: longTasks.length,
      longTaskTotalMs: longTasks.reduce((sum, value) => sum + value, 0),
      longestTaskMs: longTasks.length > 0 ? Math.max(...longTasks) : 0,
      ...animationCount2 === null ? {} : { cssAnimationCount: animationCount2 }
    };
    if (cancellationReason) snapshot.invalidReason = cancellationReason;
    return snapshot;
  };
  return {
    collectStatic: () => collectStatic("static"),
    sampleIdle: (signal) => sampleDynamic("idle", signal),
    async sampleControlledScroll(signal) {
      const chat2 = deps.getChatScroller();
      const originalTop = chat2?.scrollTop ?? 0;
      const initialHeight = chat2?.scrollHeight ?? 0;
      const initialClientHeight = chat2?.clientHeight ?? 0;
      const initialGenerating = deps.isGenerating();
      let userInterfered = false;
      let localReason = "";
      const userEvents = ["wheel", "pointerdown", "touchstart", "keydown", "input"];
      const onUserInterference = () => {
        userInterfered = true;
      };
      if (!chat2) {
        const snapshot = await collectStatic("controlledScroll");
        snapshot.invalidReason = "未找到聊天滚动区域";
        return snapshot;
      }
      if (initialHeight < initialClientHeight * 3) {
        const snapshot = await collectStatic("controlledScroll");
        snapshot.invalidReason = "聊天区域不足三个视口高度，无法安全运行受控滚动";
        return snapshot;
      }
      if (initialGenerating === null) {
        const snapshot = await collectStatic("controlledScroll");
        snapshot.invalidReason = "无法读取生成状态，采样未开始";
        return snapshot;
      }
      if (initialGenerating) {
        const snapshot = await collectStatic("controlledScroll");
        snapshot.invalidReason = "生成状态发生变化或当前正在生成，采样已取消";
        return snapshot;
      }
      const baseline = deps.readPageSummary();
      const baselineChatKey = baseline.chat.available ? baseline.chat.value.chatKey : null;
      const maxScroll = Math.max(0, initialHeight - initialClientHeight);
      const distance = Math.min(initialClientHeight * 1.5, Math.max(0, maxScroll - initialClientHeight));
      for (const event of userEvents) chat2.addEventListener(event, onUserInterference, { passive: true });
      chat2.scrollTop = maxScroll;
      try {
        const snapshot = await sampleDynamic("controlledScroll", signal, (time) => {
          if (userInterfered) localReason || (localReason = "检测到用户干预，采样已取消");
          if (chat2.scrollHeight !== initialHeight || chat2.clientHeight !== initialClientHeight) {
            localReason || (localReason = "聊天布局变化，采样已取消");
          }
          const generating2 = deps.isGenerating();
          if (generating2 === null) localReason || (localReason = "无法读取生成状态，采样已取消");
          else if (generating2 !== initialGenerating) localReason || (localReason = "生成状态发生变化，采样已取消");
          const progress = Math.min(1, Math.max(0, time / BUTLER_PROBE_DURATION_MS));
          chat2.scrollTop = progress <= 0.5 ? maxScroll - distance * progress * 2 : maxScroll - distance + distance * (progress - 0.5) * 2;
          return localReason || null;
        });
        const after = deps.readPageSummary();
        if (baselineChatKey && after.chat.available && after.chat.value.chatKey !== baselineChatKey) {
          localReason || (localReason = "聊天已切换，采样已取消");
        }
        if (chat2.scrollHeight !== initialHeight || chat2.clientHeight !== initialClientHeight) {
          localReason || (localReason = "聊天布局变化，采样已取消");
        }
        if (userInterfered) localReason || (localReason = "检测到用户干预，采样已取消");
        const generating = deps.isGenerating();
        if (generating === null) localReason || (localReason = "无法读取生成状态，采样已取消");
        else if (generating !== initialGenerating) localReason || (localReason = "生成状态发生变化，采样已取消");
        snapshot.metrics.controlledScroll = {
          valid: !snapshot.invalidReason && !localReason,
          originalTop,
          distance
        };
        if (localReason) snapshot.invalidReason = localReason;
        return snapshot;
      } finally {
        for (const event of userEvents) chat2.removeEventListener(event, onUserInterference);
        chat2.scrollTop = originalTop;
      }
    }
  };
}

// st-extension/src/apps/butler/runtime.ts
function observed(value, reason) {
  return value === null ? { available: false, reason } : { available: true, value };
}
function buildVersion() {
  if (false) return null;
  return `${"0.9.0"}+${"2026-10-26 11:21"}`;
}
function stVersion() {
  const text4 = document.querySelector("#version_display")?.textContent?.trim();
  return text4 || null;
}
function digest(values) {
  let hash2 = 0xcbf29ce484222325n;
  for (const value of values.sort().join("\0")) {
    hash2 ^= BigInt(value.charCodeAt(0));
    hash2 = BigInt.asUintN(64, hash2 * 0x100000001b3n);
  }
  return hash2.toString(16).padStart(16, "0");
}
function storageFallback() {
  return {
    getItem() {
      return null;
    },
    setItem() {
    },
    removeItem() {
    }
  };
}
function recoveryStorage() {
  let storage;
  try {
    storage = window.localStorage;
  } catch {
    return storageFallback();
  }
  return {
    getItem(key) {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        storage.setItem(key, value);
      } catch {
      }
    },
    removeItem(key) {
      try {
        storage.removeItem(key);
      } catch {
      }
    }
  };
}
function resourceGroups2() {
  if (typeof performance?.getEntriesByType !== "function") return null;
  try {
    const entries = performance.getEntriesByType("resource").map((entry) => {
      const resource = entry;
      return {
        name: resource.name,
        initiatorType: resource.initiatorType,
        transferSize: resource.transferSize,
        duration: resource.duration
      };
    });
    return groupResourceTimings(entries);
  } catch {
    return null;
  }
}
function observeLongTasks(record) {
  if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes?.includes("longtask")) return null;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) record(entry.duration);
    });
    observer.observe({ type: "longtask", buffered: false });
    return { disconnect: () => observer.disconnect() };
  } catch {
    return null;
  }
}
function animationCount() {
  const getAnimations = document.getAnimations;
  if (typeof getAnimations !== "function") return null;
  try {
    return getAnimations.call(document).filter((animation) => animation.playState === "running").length;
  } catch {
    return null;
  }
}
function createNativeServices(deps = {}) {
  const bridge = deps.bridge ?? createButlerBridge();
  const loadScriptModule = deps.loadScriptModule ?? ((specifier) => import(specifier));
  const now = deps.now ?? (() => Date.now());
  const createId = deps.createId ?? (() => crypto.randomUUID?.() ?? `butler-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const reloadNow = deps.reloadNow ?? (() => window.location.reload());
  const delay2 = deps.delay ?? ((ms) => new Promise((resolve) => window.setTimeout(resolve, ms)));
  let generationReader = null;
  let settingsWriter = null;
  let generationContractPromise = null;
  const loadGenerationContract = async () => {
    if (generationReader) return true;
    generationContractPromise ?? (generationContractPromise = (async () => {
      try {
        const specifier = "/script.js";
        const module = await loadScriptModule(specifier);
        if (typeof module.isGenerating === "function") {
          generationReader = module.isGenerating;
        }
        if (typeof module.saveSettings === "function") settingsWriter = module.saveSettings;
        return generationReader !== null;
      } catch {
        generationReader = null;
      }
      return false;
    })().finally(() => {
      generationContractPromise = null;
    }));
    return generationContractPromise;
  };
  const readEnvironment = async () => {
    const perf = readPerfState();
    const extensions = await bridge.readExtensions();
    const mobile = readMobileState();
    return {
      stVersion: observed(stVersion(), "当前页面未公开 SillyTavern 版本文本"),
      stageBuild: observed(buildVersion(), "开发源码未注入构建戳"),
      mobile: mobile.available ? { available: true, value: mobile.value } : { available: false, reason: mobile.reason },
      settingsSummary: perf.status === "unavailable" ? { available: false, reason: perf.reason ?? "性能设置不可用" } : { available: true, value: { ...perf.snapshot } },
      disabledExtensionsHash: extensions.status === "ready" ? { available: true, value: digest([...extensions.disabledExtensions]) } : { available: false, reason: extensions.reason }
    };
  };
  const sampler = createMetricsSampler({
    now,
    createId,
    readEnvironment,
    readPageSummary: bridge.readPageSummary,
    readPerfState,
    readResourceGroups: resourceGroups2,
    async estimateStorage() {
      try {
        if (typeof navigator.storage?.estimate !== "function") return null;
        const estimate = await navigator.storage.estimate();
        return typeof estimate.usage === "number" && typeof estimate.quota === "number" ? { usage: estimate.usage, quota: estimate.quota } : null;
      } catch {
        return null;
      }
    },
    readHeapBytes() {
      const used = performance.memory?.usedJSHeapSize;
      return typeof used === "number" && Number.isFinite(used) ? used : null;
    },
    getChatScroller: () => document.querySelector("#chat"),
    getViewport: () => ({
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight
    }),
    countAnimations: animationCount,
    isForeground: () => document.visibilityState === "visible",
    isGenerating: () => {
      if (!generationReader) return null;
      try {
        return generationReader();
      } catch {
        return null;
      }
    },
    observeLongTasks,
    runTimeline: deps.runTimeline ?? ((durationMs, signal, handlers) => runProbeTimeline(durationMs, signal, handlers))
  });
  const beforeDynamicProbe = async () => {
    await loadGenerationContract();
  };
  const reloadPage = async () => {
    await loadGenerationContract();
    if (settingsWriter) {
      try {
        await settingsWriter();
      } catch {
        await delay2(1100);
      }
    } else {
      await delay2(1100);
    }
    reloadNow();
  };
  return {
    collectStatic: () => sampler.collectStatic(),
    async sampleIdle(signal) {
      await beforeDynamicProbe();
      return sampler.sampleIdle(signal);
    },
    async sampleControlledScroll(signal) {
      await beforeDynamicProbe();
      return sampler.sampleControlledScroll(signal);
    },
    readPerformance: () => readPerf(),
    writePerformance: (fields) => writePerf(fields),
    readMobile: readMobileState,
    readHealth: readHealthState,
    readExtensions: bridge.readExtensions,
    setExtensionEnabled: bridge.setExtensionEnabled,
    reloadPage,
    backupStorage: recoveryStorage(),
    warnRecovery: (command) => console.warn("[st-stage] 管家扩展治理紧急恢复命令：", command),
    now,
    createId,
    confirm: (message) => window.confirm(message)
  };
}
function createButlerAppServices(deps = {}) {
  return createNativeServices(deps);
}

// st-extension/src/apps/butler-app.ts
var FIELD_LABELS = {
  fast_ui_mode: "关闭背景模糊",
  reduced_motion: "减少动画效果",
  noShadows: "关闭阴影",
  smooth_streaming: "平滑文字更新",
  stream_fade_in: "文字淡入",
  streaming_fps: "流式更新频率",
  chat_truncation: "同时显示的消息数"
};
function valueText2(value) {
  if (typeof value === "boolean") return value ? "开" : "关";
  if (value === void 0) return "不可用";
  return String(value);
}
function text2(parent, value, className = "so-butler-text") {
  const node = el2("div", className);
  node.textContent = value;
  parent.append(node);
  return node;
}
function latestMeasurement(data, id) {
  const records = data.history.filter((record) => record.kind === "measurement");
  const target = id ? records.find((record) => record.measurement.id === id) : records.reduce((latest, record) => !latest || record.createdAt > latest.createdAt ? record : latest, null);
  return target?.measurement ?? null;
}
function measurementHistory(measurement, label, outcome = "completed") {
  return {
    id: `history-${measurement.id}`,
    kind: "measurement",
    createdAt: measurement.createdAt,
    completedAt: measurement.createdAt + measurement.durationMs,
    outcome,
    summary: {
      label,
      probe: measurement.probe,
      valid: !measurement.invalidReason
    },
    measurement
  };
}
function transactionHistory(transaction) {
  return {
    id: `history-${transaction.id}`,
    kind: "transaction",
    createdAt: transaction.createdAt,
    completedAt: transaction.completedAt ?? transaction.createdAt,
    outcome: transaction.status === "restored" ? "restored" : transaction.status === "failed" ? "failed" : "completed",
    summary: {
      label: transaction.status === "restored" ? "恢复性能设置" : "安全性能优化",
      applied: transaction.actions.filter((action) => action.status === "applied").length,
      failed: transaction.actions.filter((action) => action.status === "failed").length
    },
    transaction
  };
}
function experimentHistory(experiment, label) {
  return {
    id: `history-${experiment.id}-${experiment.completedAt ?? experiment.currentRound}`,
    kind: "experiment",
    createdAt: experiment.startedAt,
    completedAt: experiment.completedAt ?? experiment.startedAt,
    outcome: experiment.status === "failed" ? "failed" : "completed",
    summary: { label, candidates: experiment.candidateExtensions.length },
    experiment
  };
}
function currentDevice(services) {
  const mobile = services.readMobile();
  return mobile.available && mobile.value ? "mobile" : "desktop";
}
function upsertHistory(data, record) {
  return {
    ...data,
    history: [...data.history.filter((item) => item.id !== record.id), record]
  };
}
function butlerApp(serviceOverrides) {
  const services = serviceOverrides ?? createButlerAppServices();
  let activeState = null;
  return {
    id: "butler",
    name: t("apps.butler.name", "管家"),
    icon: "🧹",
    order: 3,
    mount(container, ctx) {
      activeState?.controller?.abort();
      activeState = createState();
      mountButler(container, ctx, services, activeState);
    },
    unmount() {
      if (activeState) {
        activeState.disposed = true;
        activeState.controller?.abort();
      }
      activeState = null;
    }
  };
}
function createState() {
  return {
    measurement: null,
    findings: [],
    comparison: null,
    selectedProbe: "idle",
    sampling: false,
    applying: false,
    notice: "",
    noticeKind: "info",
    controller: null,
    disposed: false
  };
}
function mountButler(container, ctx, services, state2) {
  let data = migrateButlerData(ctx.getAppData(), {
    now: services.now(),
    idFactory: services.createId
  });
  const persistData = (next, candidateHistoryId) => {
    const result = fitButlerDataBudget(next, void 0, candidateHistoryId);
    data = result.data;
    ctx.setAppData(data);
    if (result.status === "protected-over-budget" || result.status === "data-over-budget") {
      state2.notice = "管家恢复状态已达到 64 KiB 上限；新的历史记录未保存。";
      state2.noticeKind = "error";
    } else if (candidateHistoryId && !result.historyAccepted) {
      state2.notice = "本次结果可查看，但因 64 KiB 上限未写入历史。";
      state2.noticeKind = "info";
    }
    return data;
  };
  const setNotice = (message, kind = "info") => {
    state2.notice = message;
    state2.noticeKind = kind;
  };
  const safely = async (task) => {
    try {
      await task();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "操作失败，请重试", "error");
    }
    if (!state2.disposed) render2();
  };
  const readPerformanceGroup = async () => {
    const current2 = services.readPerformance();
    if (!current2) throw new Error("当前 SillyTavern 性能设置不完整，无法安全写入");
    return { ...current2 };
  };
  const actionBridge = {
    readGroup: async (group) => {
      if (group !== "performanceSettings") throw new Error("当前主屏只能修改性能设置");
      return readPerformanceGroup();
    },
    writeGroup: async (group, fields) => {
      if (group !== "performanceSettings") throw new Error("当前主屏只能修改性能设置");
      await services.writePerformance(fields);
    },
    persistTransaction: async (transaction) => {
      data = persistData({ ...data, activeTransaction: transaction, performanceModeOn: transaction.status !== "restored" });
    },
    now: services.now,
    createId: services.createId
  };
  const experimentDeps = {
    readExtensions: services.readExtensions,
    setExtensionEnabled: services.setExtensionEnabled,
    persistExperiment: async (experiment) => {
      data = persistData({ ...data, pendingExperiment: experiment });
    },
    reloadPage: services.reloadPage,
    now: services.now,
    createId: services.createId,
    backupStorage: services.backupStorage,
    warnRecovery: services.warnRecovery
  };
  const runProbe = async (probe, forExperiment = false) => {
    state2.sampling = true;
    const controller = new AbortController();
    state2.controller = controller;
    setNotice(forExperiment ? "正在检查扩展关闭后的表现，请保持页面前台。" : "正在检查，请保持页面前台且不要操作聊天。");
    render2();
    try {
      const result = probe === "controlledScroll" ? await services.sampleControlledScroll(controller.signal) : await services.sampleIdle(controller.signal);
      state2.measurement = result;
      state2.findings = diagnose(result, services.readPerformance());
      setNotice(result.invalidReason ?? "6 秒体检完成。", result.invalidReason ? "error" : "success");
      return result;
    } finally {
      if (state2.controller === controller) state2.controller = null;
      state2.sampling = false;
    }
  };
  const baselineForTransaction = () => {
    const baselineId = data.activeTransaction?.baselineMeasurementId;
    if (baselineId) return latestMeasurement(data, baselineId);
    const current2 = state2.measurement;
    if (current2 && current2.probe !== "static") return current2;
    return null;
  };
  const applySafePlan = async (plan) => {
    if (state2.applying || plan.actions.length === 0) return;
    state2.applying = true;
    setNotice("正在逐项应用并回读 SillyTavern 实际值。");
    render2();
    try {
      let baseline = baselineForTransaction();
      if (!baseline || baseline.probe === "static" || baseline.invalidReason) {
        baseline = await runProbe(state2.selectedProbe);
        const record = measurementHistory(
          baseline,
          "优化前基线",
          baseline.invalidReason ? "cancelled" : "completed"
        );
        data = persistData(upsertHistory(data, record), record.id);
        if (baseline.invalidReason) throw new Error(`优化前检查未完成：${baseline.invalidReason}`);
      }
      const transaction = await applyTransaction(plan.actions, actionBridge, baseline?.id);
      data = persistData(upsertHistory(data, transactionHistory(transaction)), `history-${transaction.id}`);
      setNotice(
        transaction.status === "applied" ? `已应用 ${transaction.actions.filter((action) => action.status === "applied").length} 项；可以再测一次，也可以随时恢复。` : "部分设置未成功写入，已保留事务和每项实际结果。",
        transaction.status === "applied" ? "success" : "error"
      );
      if (baseline && !data.history.some((record) => record.kind === "measurement" && record.measurement.id === baseline.id)) {
        const record = measurementHistory(baseline, "优化前基线", baseline.invalidReason ? "cancelled" : "completed");
        data = persistData(upsertHistory(data, record), record.id);
      }
    } finally {
      state2.applying = false;
    }
  };
  const remeasure = async () => {
    if (state2.sampling) return;
    const baseline = baselineForTransaction();
    if (!baseline || baseline.probe === "static") throw new Error("请先完成一次检查，再点“再测一次，比较优化前后”。");
    const result = await runProbe(baseline.probe);
    const record = measurementHistory(result, "优化后再次检查", result.invalidReason ? "cancelled" : "completed");
    data = persistData(upsertHistory(data, record), record.id);
    state2.comparison = compareMeasurements(baseline, result);
    setNotice(
      state2.comparison.comparable ? "两次检查条件一致，已显示优化前后的变化。" : `两次检查条件不同，暂时不能直接比较：${state2.comparison.reasons.join("；")}。`,
      state2.comparison.comparable ? "success" : "info"
    );
  };
  const restorePerformance = async () => {
    const transaction = data.activeTransaction;
    if (!transaction) return;
    let result = await restoreTransaction(transaction, actionBridge);
    if (result.conflicts.length > 0) {
      const lines = result.conflicts.map((conflict) => `${FIELD_LABELS[conflict.field] ?? conflict.field}：当前 ${valueText2(conflict.current)}，优化后 ${valueText2(conflict.after)}，原值 ${valueText2(conflict.before)}`);
      if (!services.confirm(`这些设置在优化后又被修改：
${lines.join("\n")}

仍要覆盖并恢复原值吗？`)) {
        setNotice("检测到后续修改，未覆盖当前设置。", "info");
        return;
      }
      result = await restoreTransaction(transaction, actionBridge, result.conflicts.map((item) => item.field));
    }
    if (result.transaction.restoreStatus === "restored") {
      const record = transactionHistory(result.transaction);
      data = persistData({
        ...upsertHistory(data, record),
        activeTransaction: null,
        performanceModeOn: false
      }, record.id);
      setNotice("已恢复到优化前设置。", "success");
    } else {
      data = persistData({ ...data, activeTransaction: result.transaction });
      setNotice(result.transaction.error ?? "部分设置未恢复，请查看冲突。", "error");
    }
  };
  const modalController = {
    getData: () => data,
    getMeasurement: () => state2.measurement,
    getFindings: () => state2.findings,
    getComparison: () => state2.comparison,
    /**
     * 升级搁浅救援：把扩展还原到排查前的原始禁用清单，然后清空待处理排查。
     *
     * "临时关闭扩展找卡顿"流程已移除，但升级前停在流程中间的用户，扩展还处于被禁用
     * 的状态。这里复用 finishExtensionExperiment 的 restore 分支——它就是原本"恢复
     * 原来的扩展状态"按钮走的路径，已经有测试覆盖，不另写一套还原逻辑。
     */
    async discardStrandedExperiment() {
      const pending = data.pendingExperiment;
      if (!pending) return;
      const completed = await finishExtensionExperiment(pending, "restore", experimentDeps);
      if (completed.status !== "completed") {
        data = persistData({ ...data, pendingExperiment: completed });
        throw new Error(completed.notes ?? "扩展清单恢复失败");
      }
      const record = experimentHistory(completed, "恢复扩展状态（排查流程已下线）");
      data = persistData({ ...upsertHistory(data, record), pendingExperiment: null }, record.id);
      setNotice("已恢复最初扩展禁用清单。", "success");
    },
    async restoreEmergencyBackup(backup) {
      const result = await restoreEmergencyExtensionBackup(backup, experimentDeps);
      if (!result.ok) {
        throw new Error(`紧急恢复失败：${result.failed.map((item) => `${item.name}（${item.error}）`).join("、")}`);
      }
      setNotice("紧急扩展禁用清单已恢复。", "success");
    }
  };
  const renderPlan = (parent, plan) => {
    const changed = foldSection(`建议调整（${plan.actions.length}）`, true, "butler-plan-changed");
    if (plan.actions.length === 0) text2(changed.body, "当前设置已经不高于安全建议，不需要继续调整。");
    for (const action of plan.actions) {
      text2(changed.body, `${FIELD_LABELS[action.field] ?? action.label}：${valueText2(action.before)} → ${valueText2(action.requested)}${action.reloadRequired ? "（需刷新或重载聊天）" : ""}`);
    }
    parent.append(changed.box);
    const unchanged = foldSection(`保持不变（${plan.unchanged.length}）`, false, "butler-plan-unchanged");
    for (const action of plan.unchanged) {
      text2(unchanged.body, `${FIELD_LABELS[action.field] ?? action.label}：${valueText2(action.before)} → ${valueText2(action.requested)}`);
    }
    parent.append(unchanged.box);
  };
  const renderTransaction = (parent, transaction) => {
    const result = foldSection("本次实际修改", true, "butler-transaction-results");
    const statusLabels = {
      planned: "等待修改",
      applied: "已修改",
      failed: "修改失败",
      unchanged: "无需修改"
    };
    for (const action of transaction.actions) {
      const suffix = action.error ? ` · ${action.error}` : "";
      text2(result.body, `${action.label}：原来 ${valueText2(action.before)}，现在 ${valueText2(action.actual)} · ${statusLabels[action.status]}${action.reloadRequired ? " · 需要刷新或重载聊天" : ""}${suffix}`);
    }
    parent.append(result.box);
  };
  const render2 = () => {
    if (state2.disposed) return;
    container.textContent = "";
    container.classList.add("so-butler-app");
    const current2 = services.readPerformance();
    const mobile = services.readMobile();
    const health = services.readHealth();
    const header = el2("div", "so-app-section so-butler-hero");
    const heading = el2("div", "so-app-title");
    heading.textContent = "环境体检";
    const summary = el2("div", "so-butler-summary-grid");
    const summaryItems = [
      ["设备", mobile.available ? mobile.value ? "移动端" : "桌面端" : "未知"],
      ["性能设置", current2 ? "可读写" : "不可用"],
      ["禁用扩展", health.disabledExtensions.available ? String(health.disabledExtensions.value) : "未知"],
      ["最近记录", String(data.history.length)]
    ];
    for (const [label, value] of summaryItems) {
      const item = el2("div", "so-butler-summary-item");
      const small = document.createElement("small");
      small.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      item.append(small, strong);
      summary.append(item);
    }
    header.append(heading, summary);
    if (!state2.measurement) text2(header, "正在读取当前环境...", "so-butler-muted");
    else {
      text2(
        header,
        state2.measurement.invalidReason ? `最近体检无效：${state2.measurement.invalidReason}` : `最近检查：${state2.measurement.probe === "static" ? "基础检查" : "6 秒检查"} · ${state2.findings.length} 条发现`,
        state2.measurement.invalidReason ? "so-butler-alert" : "so-butler-text"
      );
    }
    container.append(header);
    const guide = el2("div", "so-app-section so-butler-guide");
    const guideTitle = el2("div", "so-app-title");
    guideTitle.textContent = "使用步骤";
    guide.append(guideTitle);
    text2(guide, "1. 开始检查 → 2. 查看发现 → 3. 应用建议 → 4. 再测一次或恢复。", "so-butler-guide-steps");
    text2(guide, "管家只会调整可读写的性能设置，不会修改模型、提示词或聊天内容。每次修改都保留恢复入口。", "so-butler-muted");
    container.append(guide);
    const sampling = el2("div", "so-app-section");
    const sampleTitle = el2("div", "so-app-title");
    sampleTitle.textContent = "开始检查";
    sampling.append(sampleTitle);
    text2(sampling, "“不操作时检查”观察页面自己是否持续占用资源；“滚动长聊天检查”会自动滚动一小段并恢复原位置。切后台、生成回复、切换聊天或手动操作时，本次检查会取消。");
    sampling.append(selectRow(
      "检查方式",
      state2.selectedProbe,
      [
        { value: "idle", label: "不操作时检查（6 秒）" },
        { value: "controlledScroll", label: "滚动长聊天检查（6 秒）" }
      ],
      (value) => {
        state2.selectedProbe = value;
        render2();
      }
    ));
    if (state2.sampling) sampling.append(appButton("取消本次检查", () => state2.controller?.abort()));
    else sampling.append(appButton("开始 6 秒体检", () => void safely(async () => {
      const result = await runProbe(state2.selectedProbe);
      const record = measurementHistory(result, result.probe === "idle" ? "静置体检" : "受控滚动体检", result.invalidReason ? "cancelled" : "completed");
      data = persistData(upsertHistory(data, record), record.id);
    })));
    container.append(sampling);
    const findingSection = foldSection(`检查发现（${state2.findings.length}）`, true, "butler-findings");
    if (state2.findings.length === 0) text2(findingSection.body, state2.measurement ? "当前证据没有触发建议。" : "静态体检完成后显示。");
    for (const finding2 of state2.findings.slice(0, 5)) renderFinding(findingSection.body, finding2);
    container.append(findingSection.box);
    const planSection = el2("div", "so-app-section");
    const planTitle = el2("div", "so-app-title");
    planTitle.textContent = "可以立即应用的建议";
    planSection.append(planTitle);
    if (!current2) {
      text2(planSection, "当前 SillyTavern 没有公开完整性能设置，管家只做只读体检。", "so-butler-alert");
    } else {
      const plan = buildSafePlan(current2, currentDevice(services));
      renderPlan(planSection, plan);
      if (data.activeTransaction) {
        renderTransaction(planSection, data.activeTransaction);
        const actions = el2("div", "so-butler-actions");
        actions.append(
          appButton(state2.sampling ? "正在再次检查" : "再测一次，比较优化前后", () => void safely(remeasure)),
          appButton("恢复本次性能设置", () => void safely(restorePerformance))
        );
        planSection.append(actions);
      } else if (plan.actions.length > 0) {
        const apply = appButton(
          state2.applying ? "正在应用建议" : `立即应用 ${plan.actions.length} 项建议`,
          () => void safely(() => applySafePlan(plan))
        );
        apply.classList.add("so-butler-primary-action");
        planSection.append(apply);
      } else {
        text2(planSection, "这里没有需要应用的设置。如果仍然卡顿，可以打开“扩展指南”看看哪些扩展代价较大、能否安全关掉。", "so-butler-muted");
      }
    }
    if (state2.comparison) {
      const comparison = foldSection("优化前后对比", true, "butler-comparison");
      text2(comparison.body, state2.comparison.comparable ? "两次检查条件一致。下面按普通用户能理解的指标展示前后变化。" : `两次检查条件不同，暂不计算差值：${state2.comparison.reasons.join("；")}。可在详细结果中查看两次原始数据。`);
      renderMeasurementComparison(comparison.body, state2.comparison);
      planSection.append(comparison.box);
    }
    container.append(planSection);
    const modalActions = el2("div", "so-app-section so-butler-modal-actions");
    modalActions.append(
      appButton("查看详细结果", () => ctx.openModal(buildReportModal(modalController))),
      appButton("扩展指南", () => ctx.openModal(buildExtensionModal(services, modalController))),
      appButton("记忆与服务器设置建议", () => ctx.openModal(buildAdvisorModal(services)))
    );
    container.append(modalActions);
    if (data.pendingExperiment) {
      const pending = el2("div", "so-app-section so-butler-pending");
      text2(pending, "上次的扩展排查没有结束，部分扩展可能仍处于被临时禁用的状态。");
      pending.append(appButton("恢复排查前的扩展状态", () => ctx.openModal(buildExtensionModal(services, modalController))));
      container.append(pending);
    }
    if (state2.notice) text2(container, state2.notice, `so-butler-notice so-butler-notice-${state2.noticeKind}`);
  };
  if (data.pendingExperiment?.status === "awaitingReload") {
    data = persistData({ ...data, pendingExperiment: resumeExtensionExperiment(data.pendingExperiment) });
  }
  persistData(data);
  render2();
  void safely(async () => {
    const measurement = await services.collectStatic();
    if (!state2.measurement || state2.measurement.probe === "static") {
      state2.measurement = measurement;
      state2.findings = diagnose(measurement, services.readPerformance());
    }
    if (!state2.notice) setNotice("基础检查完成。需要观察页面运行时表现时，再运行 6 秒检查。", "success");
  });
}

// st-extension/src/apps/mvu-app.ts
function createInstance(container, ctx) {
  let disposed = false;
  let seq = 0;
  let lastResult = null;
  let delta = /* @__PURE__ */ new Map();
  let refreshTimer = null;
  let offEvents = null;
  const settingsBox = el2("div", "so-app-section");
  const treeBox = el2("div", "mvu-tree-host");
  container.append(settingsBox, treeBox);
  function renderSettings() {
    settingsBox.textContent = "";
    settingsBox.append(
      hintField(
        toggleRow(t("apps.mvu.hud", "变量速查悬浮窗"), ctx.getSettings().variableHud, (v) => {
          ctx.updateSettings({ ...ctx.getSettings(), variableHud: v });
        }),
        t("apps.mvu.hud_help", "在聊天界面常驻一个可拖动的小圆钮，点开就能看到全部变量的当前值，省掉「开手机→开 App→翻找」。只读速查，改值仍在下方变量面板里。这个开关是全局的，与「新变量」App 里的是同一个。")
      )
    );
  }
  renderSettings();
  const view = createVariableTreeView(treeBox, {
    getModel: () => buildModel(),
    commitSet: (path, value) => void runWrite(() => setFloorVariable(currentScope(), currentWrapped(), path, value)),
    commitDelete: (path) => void runWrite(() => deleteFloorVariable(currentScope(), currentWrapped(), path)),
    requestRefresh: () => void load()
  });
  function currentScope() {
    return { type: "message", message_id: lastResult?.messageId ?? getLastMessageId() };
  }
  function currentWrapped() {
    return lastResult?.wrapped ?? true;
  }
  function sourceLabel(r) {
    if (r.meta.source === "mvu") return "MVU";
    if (r.meta.source === "tavern-helper") return t("apps.mvu.helper", "酒馆助手");
    return "—";
  }
  function buildModel() {
    const r = lastResult;
    if (!r) {
      return {
        data: {},
        isMvu: true,
        delta: /* @__PURE__ */ new Map(),
        status: "empty",
        statusText: t("apps.mvu.reading", "正在读取…"),
        emptyText: t("apps.mvu.reading_variables", "正在读取楼层变量…"),
        canWrite: false,
        addHint: ""
      };
    }
    const canWrite = r.status !== "unavailable";
    let noticeText;
    if (r.status === "unavailable") {
      noticeText = t("apps.mvu.unavailable", "未检测到 MVU 框架或酒馆助手（Web 模拟器中仅可查看本说明）。在 SillyTavern 内、且安装了 MVU/酒馆助手时才能读写楼层变量。");
    } else if (r.status === "error") {
      noticeText = t("apps.mvu.read_error", "读取变量出错：{{error}}。可点「刷新」重试。", { error: r.error ?? t("apps.mvu.unknown_error", "未知错误") });
    }
    return {
      data: r.data,
      isMvu: r.isMvu,
      delta,
      status: r.status,
      statusText: t("apps.mvu.source", "来源：{{source}} · {{message}}", { source: sourceLabel(r), message: r.messageId >= 0 ? t("apps.mvu.message", "楼层 #{{id}}", { id: r.messageId }) : t("apps.mvu.no_conversation", "无对话") }),
      emptyText: r.status === "empty" && r.meta.waitedMvu ? t("apps.mvu.empty_after_wait", "当前楼层暂无变量（已等待 MVU 初始化）。有变量的楼层刷新后会显示在这里。") : t("apps.mvu.empty", "当前楼层暂无变量。"),
      noticeText,
      canWrite,
      addHint: canWrite ? t("apps.mvu.add_hint", "正常情况下变量由 MVU 框架按角色卡规则维护，无需手动新增；这里仅用于修补卡片缺失的变量或调试（卡的更新规则里没有的路径，AI 不会主动维护）。路径点号分层，值支持 数字/true/false/null/JSON/文本。") : t("apps.mvu.cannot_write", "当前环境不可写入变量。")
    };
  }
  function isStale(token) {
    return disposed || token !== seq || !container.isConnected;
  }
  async function load() {
    const token = ++seq;
    view.resetEditing();
    if (!lastResult) view.render();
    const messageId = getLastMessageId();
    const result = await readVariables({ type: "message", message_id: messageId }, messageId);
    if (isStale(token)) return;
    let nextDelta = /* @__PURE__ */ new Map();
    if (result.status === "ready" && messageId > 0) {
      const prev = await findPrevStatRoot(messageId - 1);
      if (isStale(token)) return;
      nextDelta = computeDelta(result.data, prev, result.isMvu);
    }
    lastResult = result;
    delta = nextDelta;
    view.render();
  }
  function scheduleRefresh() {
    if (disposed || view.isEditing()) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      if (!disposed && !view.isEditing()) void load();
    }, 300);
  }
  async function runWrite(op) {
    try {
      await op();
    } catch (err) {
      console.error("[st-stage] 变量写入失败", err);
      window.alert(t("apps.mvu.write_error", "写入失败：{{error}}", { error: err instanceof Error ? err.message : String(err) }));
    }
    if (!disposed) await load();
  }
  return {
    start() {
      offEvents = subscribeVarEvents(() => scheduleRefresh());
      void load();
    },
    dispose() {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = null;
      offEvents?.();
      offEvents = null;
    }
  };
}
function mvuApp() {
  let inst = null;
  return {
    id: "mvu",
    name: "MVU",
    icon: "🔢",
    order: 4,
    mount(container, ctx) {
      inst?.dispose();
      inst = createInstance(container, ctx);
      inst.start();
    },
    unmount() {
      inst?.dispose();
      inst = null;
    }
  };
}

// st-extension/src/apps/newvar-app.ts
function newvarApp(deps) {
  let unsub = null;
  return {
    id: "newvar",
    name: t("apps.newvar.name", "新变量"),
    icon: "🧮",
    order: 5,
    mount(container, ctx) {
      unsub?.();
      const { runtime, openDesigner } = deps;
      const cfgBox = el2("div", "nv-box");
      const stateBox = el2("div", "nv-box");
      container.append(cfgBox, stateBox);
      function renderCfg() {
        cfgBox.textContent = "";
        const d = runtime.getData();
        const section2 = el2("div", "so-app-section");
        section2.append(
          hintField(
            toggleRow(t("apps.newvar.enable", "启用变量追踪"), d.enabled, (v) => {
              ctx.setAppData({ ...runtime.getData(), enabled: v });
              runtime.onConfigChanged();
            }),
            t("apps.newvar.enable_help", "不依赖 MVU/酒馆助手：按你的变量定义自动向 AI 注入当前状态与更新规则，解析回复末尾的 <UpdateVariable> 并逐楼保存快照，任何角色卡都能用。变量定义、模板、注入预览都在「变量设计」里。")
          ),
          hintField(
            toggleRow(t("apps.newvar.hide_updates", "隐藏正文中的变量更新记录"), d.hideUpdateBlocks, (v) => {
              ctx.setAppData({ ...runtime.getData(), hideUpdateBlocks: v });
              ctx.toast(
                "success",
                v ? t("apps.newvar.updates_hidden", "已隐藏变量更新记录；原始回复和变量快照保持不变。") : t("apps.newvar.updates_restored", "变量更新记录已恢复（此前由百工隐藏）。若仍不可见，请检查 ST Regex 中删除 UpdateVariable 的规则。")
              );
            }),
            t("apps.newvar.hide_help", "只隐藏消息气泡里完整的 <UpdateVariable>...</UpdateVariable> 区块，不修改 SillyTavern 保存的原始回复，也不影响变量解析和楼层快照。关闭后只能恢复本扩展隐藏的内容；ST Regex 等外部规则仍会独立生效。")
          ),
          hintField(
            toggleRow(t("apps.newvar.hud", "变量速查悬浮窗"), ctx.getSettings().variableHud, (v) => {
              ctx.updateSettings({ ...ctx.getSettings(), variableHud: v });
            }),
            t("apps.newvar.hud_help", "在聊天界面常驻一个可拖动的小圆钮，点开就能看到全部变量的当前值，省掉「开手机→开 App→翻找」。只读速查，改值仍在下方变量面板里；MVU 与「新变量」两边的变量会分段列出。这个开关是全局的，两个变量 App 里改哪个都一样。")
          ),
          appButton(t("apps.newvar.open_designer", "打开变量设计"), openDesigner)
        );
        cfgBox.append(section2);
      }
      const tree = createVariableTreeView(stateBox, {
        getModel: () => {
          const st = runtime.isSTAvailable();
          const d = runtime.getData();
          const state2 = runtime.getCurrentState();
          return {
            data: state2,
            definitions: d.schema.variables,
            isMvu: false,
            delta: computeDelta(state2, runtime.getPrevState(), false),
            status: st ? "ready" : "unavailable",
            statusText: st ? t("apps.newvar.status", "内置追踪 · {{state}}", { state: d.enabled ? t("apps.newvar.enabled", "已启用") : t("apps.newvar.disabled", "未启用") }) : t("apps.newvar.simulator", "内置追踪 · 模拟器"),
            emptyText: t("apps.newvar.empty", "暂无变量。点上方「打开变量设计」定义或导入模板，启用后 AI 回复会逐楼更新这里。"),
            noticeText: st ? void 0 : t("apps.newvar.unavailable", "未检测到 SillyTavern：模拟器中可打开变量设计编辑定义与预览注入，状态快照在 ST 内才会产生。"),
            canWrite: st,
            allowAdd: false,
            addHint: t("apps.newvar.add_hint", "这里只能修改变量设计中已有的路径；新增变量请先在「变量设计」中添加定义。")
          };
        },
        commitSet: (path, value) => runtime.setManualValue(path, value),
        commitDelete: (path) => runtime.deleteVariable(path),
        requestRefresh: () => tree.render()
      });
      renderCfg();
      tree.render();
      const offRuntime = runtime.subscribe(() => {
        if (!tree.isEditing()) tree.render();
      });
      unsub = () => offRuntime();
    },
    unmount() {
      unsub?.();
      unsub = null;
    }
  };
}

// st-extension/src/apps/api/core.ts
var API_APP_ID = "api";
var API_PROFILE_VERSION = 2;
var chat = (id, label, options = {}) => ({
  id,
  label,
  mainApi: "openai",
  sourceField: "chat_completion_source",
  connectSelector: "#api_button_openai",
  ...options
});
var API_SOURCES = [
  chat("openai", "OpenAI", { modelField: "openai_model", secretKey: "api_key_openai", modelSelector: "#model_openai_select", keySelector: "#api_key_openai" }),
  chat("claude", "Claude", { modelField: "claude_model", secretKey: "api_key_claude", modelSelector: "#model_claude_select", keySelector: "#api_key_claude" }),
  chat("openrouter", "OpenRouter", { modelField: "openrouter_model", secretKey: "api_key_openrouter", modelSelector: "#model_openrouter_select", keySelector: "#api_key_openrouter" }),
  chat("makersuite", "Google AI Studio", { modelField: "google_model", secretKey: "api_key_makersuite", modelSelector: "#model_google_select", keySelector: "#api_key_makersuite" }),
  chat("mistralai", "Mistral AI", { modelField: "mistralai_model", secretKey: "api_key_mistralai", modelSelector: "#mistralai_model", keySelector: "#api_key_mistralai" }),
  chat("cohere", "Cohere", { modelField: "cohere_model", secretKey: "api_key_cohere", modelSelector: "#cohere_model", keySelector: "#api_key_cohere" }),
  chat("groq", "Groq", { modelField: "groq_model", secretKey: "api_key_groq", modelSelector: "#groq_model", keySelector: "#api_key_groq" }),
  chat("deepseek", "DeepSeek", { modelField: "deepseek_model", secretKey: "api_key_deepseek", modelSelector: "#deepseek_model", keySelector: "#api_key_deepseek" }),
  chat("xai", "xAI", { modelField: "xai_model", secretKey: "api_key_xai", modelSelector: "#xai_model", keySelector: "#api_key_xai" }),
  chat("custom", "自定义（OpenAI 兼容）", { urlField: "custom_url", modelField: "custom_model", secretKey: "api_key_custom", urlSelector: "#custom_api_url_text", modelSelector: "#custom_model_id", keySelector: "#api_key_custom", supportsModels: true }),
  { id: "textgenerationwebui", mainApi: "textgenerationwebui", label: "Text Completion", urlField: "api_server_textgenerationwebui", connectSelector: "#api_button_textgenerationwebui", urlSelector: "#api_url_text" },
  { id: "novel", mainApi: "novel", label: "NovelAI", secretKey: "api_key_novel", connectSelector: "#api_button_novel", keySelector: "#api_key_novel" },
  { id: "kobold", mainApi: "kobold", label: "KoboldAI", urlField: "api_server", connectSelector: "#api_button", urlSelector: "#api_url_text" },
  { id: "koboldhorde", mainApi: "koboldhorde", label: "KoboldAI Horde", secretKey: "api_key_horde", connectSelector: "#api_button", keySelector: "#horde_api_key" }
];
var COMMON_CHAT_SOURCE_IDS = /* @__PURE__ */ new Set(["openai", "claude", "openrouter", "makersuite", "custom"]);
var COMMON_CHAT_SOURCES = API_SOURCES.filter(
  (item) => item.mainApi === "openai" && COMMON_CHAT_SOURCE_IDS.has(item.id)
);
function getSource(mainApi, source = "") {
  return API_SOURCES.find((item) => item.mainApi === mainApi && (item.mainApi !== "openai" || item.id === source)) ?? API_SOURCES.find((item) => item.mainApi === mainApi) ?? API_SOURCES.find((item) => item.id === "custom");
}
function emptyDraft() {
  return { name: "", mainApi: "openai", source: "custom", url: "", key: "", secretId: "", secretMode: "stored", model: "", settings: {} };
}
function normalizeUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}
function str(value) {
  return typeof value === "string" ? value : "";
}
function newProfileId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function sanitizeAppData(raw) {
  const profiles = [];
  const list = raw?.profiles;
  if (!Array.isArray(list)) return { profiles };
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const p = item;
    const name = str(p.name).trim();
    if (!name) continue;
    const legacy = p.version !== API_PROFILE_VERSION;
    const mainApi = legacy ? "openai" : str(p.mainApi);
    const source = legacy ? "custom" : str(p.source);
    const url = normalizeUrl(str(p.url));
    const descriptor = getSource(mainApi, source);
    if (descriptor.urlField && !url) continue;
    const settings = !legacy && p.settings && typeof p.settings === "object" ? p.settings : {};
    if (legacy) {
      settings.custom_include_body = str(p.includeBody);
      settings.custom_exclude_body = str(p.excludeBody);
      settings.custom_include_headers = str(p.includeHeaders);
    }
    profiles.push({
      version: 2,
      id: str(p.id) || newProfileId(),
      name,
      mainApi,
      source: descriptor.id,
      url,
      key: str(p.key),
      secretId: str(p.secretId),
      secretMode: str(p.secretMode) || (str(p.key) ? "legacy" : "unavailable"),
      model: str(p.model).trim(),
      settings
    });
  }
  return { profiles };
}
function validateDraft(draft) {
  if (!draft.name.trim()) return "给连接档案起个名称吧。";
  const descriptor = getSource(draft.mainApi, draft.source);
  if (descriptor.urlField) {
    const url = normalizeUrl(draft.url);
    if (!url) return "这个来源需要填写接口地址 URL。";
    if (!/^https?:\/\//i.test(url)) return "接口地址要以 http:// 或 https:// 开头。";
  }
  return null;
}
function upsertProfile(profiles, draft, editingId) {
  const invalid = validateDraft(draft);
  if (invalid) return { error: invalid };
  const name = draft.name.trim();
  if (profiles.some((p) => p.name === name && p.id !== editingId)) return { error: `连接档案「${name}」已存在。` };
  const clean2 = { ...draft, version: 2, name, url: normalizeUrl(draft.url), model: draft.model.trim(), settings: { ...draft.settings } };
  if (editingId) {
    const index = profiles.findIndex((p) => p.id === editingId);
    if (index < 0) return { error: "要编辑的连接档案已不存在。" };
    const next = [...profiles];
    next[index] = { ...clean2, id: editingId };
    return { profiles: next };
  }
  return { profiles: [...profiles, { ...clean2, id: newProfileId() }] };
}
function findUrlDuplicate(profiles, url, excludeId) {
  const target = normalizeUrl(url);
  if (!target) return void 0;
  return profiles.find((p) => p.id !== excludeId && normalizeUrl(p.url) === target);
}
function moveProfile(profiles, id, delta) {
  const from = profiles.findIndex((p) => p.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= profiles.length) return profiles;
  const next = [...profiles];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
function findActiveProfile(profiles, current2, currentModel = "") {
  const identity = typeof current2 === "string" ? { mainApi: "openai", source: "custom", url: current2, model: currentModel } : current2;
  const candidates = profiles.filter((p) => p.mainApi === identity.mainApi && (p.mainApi !== "openai" || p.source === identity.source) && (!p.url || normalizeUrl(p.url) === normalizeUrl(identity.url)));
  return candidates.find((p) => p.model && p.model === identity.model) ?? candidates[0];
}
function profileSummary(profile) {
  const source = getSource(profile.mainApi, profile.source);
  return [source.label, profile.url || "", profile.model || "", profile.key || profile.secretId ? "已配 Key" : "缺 Key"].filter(Boolean);
}
function parseModelList(json) {
  if (json && typeof json === "object" && "error" in json && json.error) {
    const message = json.message;
    throw new Error(typeof message === "string" && message ? message : "站点接口返回了错误");
  }
  const box = json;
  const arr = Array.isArray(box) ? box : Array.isArray(box?.data) ? box.data : Array.isArray(box?.models) ? box.models : [];
  const names = arr.map((m) => typeof m === "string" ? m : m && typeof m === "object" ? str(m.id) || str(m.model) || str(m.name) : "").filter(Boolean);
  if (!names.length) throw new Error("站点没有返回任何模型");
  return [...new Set(names)].sort();
}

// st-extension/src/apps/api/bridge.ts
function getST3() {
  try {
    return window.SillyTavern?.getContext();
  } catch {
    return void 0;
  }
}
function toast2(kind, message) {
  const t2 = window.toastr;
  t2?.[kind]?.(message, "API 切换");
}
function readString(object2, key) {
  const value = key ? object2?.[key] : void 0;
  return typeof value === "string" ? value : "";
}
function settingsFor(st, mainApi) {
  return mainApi === "openai" ? st.chatCompletionSettings ?? {} : st.textCompletionSettings ?? st.powerUserSettings ?? {};
}
var SOURCE_SETTING_KEYS = ["custom_include_body", "custom_exclude_body", "custom_include_headers"];
async function secretRequest(path, body, st) {
  return fetch(`/api/secrets/${path}`, { method: "POST", headers: st.getRequestHeaders?.() ?? { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function readSecret(st, secretKey, secretId = "") {
  if (!secretKey) return { key: "", mode: "unavailable" };
  try {
    const response = await secretRequest("find", { key: secretKey, id: secretId }, st);
    if (!response.ok) return { key: "", mode: "unavailable" };
    const json = await response.json();
    return { key: typeof json.value === "string" ? json.value : "", mode: "read" };
  } catch {
    return { key: "", mode: "unavailable" };
  }
}
async function readConnection(options = {}) {
  const st = getST3();
  if (!st) return null;
  const mainApi = st.mainApi ?? (document.querySelector("#main_api")?.value || "openai");
  const settings = settingsFor(st, mainApi);
  const source = mainApi === "openai" ? readString(settings, "chat_completion_source") || document.querySelector("#chat_completion_source")?.value || "openai" : mainApi;
  const descriptor = getSource(mainApi, source);
  const secretId = readString(settings, `${descriptor.secretKey}_id`) || readString(settings, "secret_id");
  const secret = options.withSecret === false ? { key: "", mode: "unavailable" } : await readSecret(st, descriptor.secretKey, secretId);
  const snapshot = {};
  for (const key of SOURCE_SETTING_KEYS) {
    const value = settings[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") snapshot[key] = value;
  }
  return {
    mainApi,
    source: descriptor.id,
    url: readString(settings, descriptor.urlField) || (descriptor.urlSelector ? document.querySelector(descriptor.urlSelector)?.value ?? "" : ""),
    model: readString(settings, descriptor.modelField) || (descriptor.modelSelector ? document.querySelector(descriptor.modelSelector)?.value ?? "" : ""),
    online: (st.onlineStatus ?? "no_connection") !== "no_connection",
    settings: snapshot,
    key: secret.key,
    secretId,
    secretMode: secret.mode
  };
}
function onOnlineStatusChanged(handler) {
  const st = getST3();
  const source = st?.eventSource;
  if (!source) return () => {
  };
  const eventName = st.event_types?.ONLINE_STATUS_CHANGED ?? "online_status_changed";
  source.on(eventName, handler);
  return () => source.removeListener(eventName, handler);
}
function dispatchValue(element2, value) {
  element2.value = value;
  element2.dispatchEvent(new Event("input", { bubbles: true }));
  element2.dispatchEvent(new Event("change", { bubbles: true }));
}
var sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function waitFor(selector2, timeout = 2500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const element2 = document.querySelector(selector2);
    if (element2) return element2;
    await sleep(50);
  }
  return null;
}
async function waitForValue(element2, value, timeout = 5e3) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (element2 instanceof HTMLSelectElement) {
      if ([...element2.options].some((option) => option.value === value)) return true;
    } else if (element2.value === value) return true;
    await sleep(80);
  }
  return false;
}
async function waitForConnection(profile, timeout = 8e3) {
  const start = Date.now();
  let latest = null;
  while (Date.now() - start < timeout) {
    latest = await readConnection({ withSecret: false });
    const sourceMatches = latest?.mainApi === profile.mainApi && (profile.mainApi !== "openai" || latest.source === profile.source);
    const modelMatches = !profile.model || latest?.model === profile.model;
    if (latest?.online && sourceMatches && modelMatches) return latest;
    await sleep(120);
  }
  if (profile.model && (!latest?.model || latest.model.toLowerCase() === "none")) throw new Error(`模型「${profile.model}」尚未加载，未将 NONE 视为切换成功`);
  throw new Error(`连接回验超时${latest?.model ? `（当前模型：${latest.model}）` : ""}`);
}
async function writeSecret(st, profile) {
  const descriptor = getSource(profile.mainApi, profile.source);
  if (!descriptor.secretKey || !profile.key) return;
  let response = await secretRequest("write", { key: descriptor.secretKey, value: profile.key, id: profile.secretId }, st);
  if (!response.ok && profile.secretId) response = await secretRequest("write", { key: descriptor.secretKey, value: profile.key }, st);
  if (!response.ok) throw new Error(`密钥写入 ST 失败（HTTP ${response.status}）`);
  if (descriptor.keySelector) {
    const input = await waitFor(descriptor.keySelector, 800);
    if (input) dispatchValue(input, profile.key);
  }
}
async function applyProfile(profile, onProgress = () => {
}) {
  const st = getST3();
  if (!st) throw new Error("未检测到 SillyTavern 运行时");
  const descriptor = getSource(profile.mainApi, profile.source);
  onProgress("正在切换补全方式与渠道…");
  const mainApiSelect = await waitFor("#main_api");
  if (!mainApiSelect) throw new Error("找不到 SillyTavern API 类型选择器");
  dispatchValue(mainApiSelect, profile.mainApi);
  if (profile.mainApi === "openai") {
    const sourceSelect = await waitFor("#chat_completion_source");
    if (!sourceSelect) throw new Error("找不到聊天补全来源选择器");
    dispatchValue(sourceSelect, profile.source);
  }
  await sleep(120);
  await writeSecret(st, profile);
  const settings = settingsFor(st, profile.mainApi);
  if (descriptor.sourceField) settings[descriptor.sourceField] = profile.source;
  if (descriptor.urlField) settings[descriptor.urlField] = profile.url;
  for (const [key, value] of Object.entries(profile.settings)) settings[key] = value;
  if (descriptor.urlSelector) {
    const input = await waitFor(descriptor.urlSelector);
    if (!input) throw new Error(`找不到 ${descriptor.label} 的 URL 输入框`);
    dispatchValue(input, profile.url);
  }
  st.saveSettingsDebounced?.();
  if (descriptor.urlField && readString(settings, descriptor.urlField) !== profile.url) throw new Error("URL 写入后回验失败，已停止连接");
  const button2 = await waitFor(descriptor.connectSelector);
  if (!button2) throw new Error(`找不到 ${descriptor.label} 的连接按钮`);
  let modelControl = null;
  if (descriptor.modelSelector && profile.model) {
    modelControl = await waitFor(descriptor.modelSelector, 2500);
    if (!modelControl) throw new Error(`找不到 ${descriptor.label} 的模型字段`);
    if (modelControl instanceof HTMLSelectElement && ![...modelControl.options].some((option) => option.value === profile.model)) {
      onProgress("正在连接渠道并加载可用模型…");
      button2.click();
      if (!await waitForValue(modelControl, profile.model)) throw new Error(`可用模型中没有「${profile.model}」，请检查模型 ID 或渠道权限`);
    }
    dispatchValue(modelControl, profile.model);
    if (descriptor.modelField) settings[descriptor.modelField] = profile.model;
  }
  onProgress(profile.model ? `正在确认模型「${profile.model}」…` : "正在确认连接…");
  button2.click();
  const connected = await waitForConnection(profile);
  if (modelControl && profile.model && modelControl.value !== profile.model) throw new Error(`模型写入被 SillyTavern 覆盖（当前：${modelControl.value || "NONE"}）`);
  return connected;
}
var modelQueue = Promise.resolve();
function fetchModels(profile) {
  const result = modelQueue.then(() => fetchModelsTransaction(profile));
  modelQueue = result.then(() => void 0, () => void 0);
  return result;
}
async function fetchModelsTransaction(profile) {
  const st = getST3();
  if (!st) throw new Error("未检测到 SillyTavern 运行时");
  const descriptor = getSource(profile.mainApi, profile.source);
  if (!descriptor.supportsModels) throw new Error("该来源不支持自动获取模型，请手动填写");
  const current2 = await readConnection();
  const temporary = { version: 2, id: "temporary", name: "temporary", model: "", settings: {}, secretMode: "stored", ...profile };
  await writeSecret(st, temporary);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2e4);
    try {
      const response = await fetch("/api/backends/chat-completions/status", { method: "POST", headers: st.getRequestHeaders?.() ?? { "Content-Type": "application/json" }, body: JSON.stringify({ chat_completion_source: profile.source, custom_url: profile.url }), signal: controller.signal });
      if (!response.ok) throw new Error(`模型列表请求失败（HTTP ${response.status}）`);
      return parseModelList(await response.json());
    } finally {
      clearTimeout(timer);
    }
  } finally {
    if (current2?.key) await writeSecret(st, { ...temporary, mainApi: current2.mainApi, source: current2.source, url: current2.url, key: current2.key, secretId: current2.secretId });
  }
}

// st-extension/src/apps/api-app.ts
function apiApp(deps) {
  let unsubscribe = null;
  return {
    id: API_APP_ID,
    name: "API",
    icon: "📡",
    order: 6,
    mount(container, ctx) {
      const state2 = { busy: false, message: "", connection: null, connectionLoaded: false };
      render(container, ctx, deps, state2);
      void refreshConnection(container, ctx, deps, state2);
      unsubscribe = onOnlineStatusChanged(() => {
        if (!state2.busy && container.isConnected) void refreshConnection(container, ctx, deps, state2);
      });
    },
    unmount() {
      unsubscribe?.();
      unsubscribe = null;
    }
  };
}
async function refreshConnection(container, ctx, deps, state2) {
  const connection = await readConnection({ withSecret: false });
  if (!container.isConnected) return;
  state2.connection = connection;
  state2.connectionLoaded = true;
  render(container, ctx, deps, state2);
}
function render(container, ctx, deps, state2) {
  const data = sanitizeAppData(ctx.getAppData());
  const connection = state2.connection;
  if (!container.isConnected) return;
  const active = connection ? findActiveProfile(data.profiles, connection) : void 0;
  container.textContent = "";
  const status = el2("div", "so-app-section");
  const title2 = el2("div", "so-app-title");
  title2.textContent = "当前连接";
  status.append(title2);
  const line = el2("div", "so-app-desc");
  if (!state2.connectionLoaded) line.textContent = "正在读取当前连接…";
  else if (!connection) line.textContent = "未检测到 SillyTavern 运行时（这里只展示已保存档案）。";
  else {
    const source = getSource(connection.mainApi, connection.source);
    line.textContent = `${connection.online ? "已连接" : "未连接"} · ${source.label}${active ? ` · ${active.name}` : ""}`;
    const detail = el2("div", "so-app-desc");
    detail.textContent = [connection.url, connection.model].filter(Boolean).join(" · ") || "该来源没有地址或模型字段";
    status.append(detail);
  }
  status.append(line);
  container.append(status);
  const profiles = el2("div", "so-app-section");
  const profilesTitle = el2("div", "so-app-title");
  profilesTitle.textContent = `连接档案（${data.profiles.length}）`;
  profiles.append(profilesTitle);
  if (!data.profiles.length) {
    const empty = el2("div", "so-app-desc");
    empty.textContent = "还没有连接档案，请进入管理页添加或导入。";
    profiles.append(empty);
  }
  for (const profile of data.profiles) profiles.append(buildRow(profile, active?.id === profile.id, state2.busy, () => void switchProfile(profile)));
  if (state2.message) {
    const feedback = el2("div", "so-app-desc");
    feedback.textContent = state2.message;
    profiles.append(feedback);
  }
  container.append(profiles);
  const manage = el2("div", "so-app-section");
  const description = el2("div", "so-app-desc");
  description.textContent = "管理全部 Chat Completion、Text Completion 与其他 SillyTavern API 档案。";
  manage.append(description, appButton("管理连接档案", deps.openManager));
  container.append(manage, buildApiGuide());
  async function switchProfile(profile) {
    if (state2.busy) return;
    state2.busy = true;
    state2.message = `正在应用「${profile.name}」的类型、来源、密钥、URL 与模型…`;
    render(container, ctx, deps, state2);
    try {
      const connected = await applyProfile(profile, (message) => {
        state2.message = message;
        if (container.isConnected) render(container, ctx, deps, state2);
      });
      state2.connection = connected;
      state2.connectionLoaded = true;
      state2.message = `「${profile.name}」已连接${connected.model ? `，实际模型：${connected.model}` : ""}`;
      toast2("success", state2.message);
    } catch (error) {
      state2.message = `切换失败：${error instanceof Error ? error.message : String(error)}`;
      toast2("error", state2.message);
      console.error("[st-stage] API 切换失败", error);
    } finally {
      state2.busy = false;
      render(container, ctx, deps, state2);
      void refreshConnection(container, ctx, deps, state2);
    }
  }
}
function guideLine(title2, text4) {
  const line = el2("div", "so-app-desc");
  const strong = document.createElement("strong");
  strong.textContent = `${title2}：`;
  line.append(strong, document.createTextNode(text4));
  return line;
}
function buildApiGuide() {
  const guide = el2("div", "so-app-section");
  const title2 = el2("div", "so-app-title");
  title2.textContent = "API 使用说明";
  guide.append(title2);
  const quick = foldSection("快速开始", false);
  quick.body.append(
    guideLine("1. 建档", "在“管理连接档案”中添加档案，或先打开 SillyTavern 原生 API 面板配置好连接，再用“导入当前连接”。"),
    guideLine("2. 填写", "Key 是访问凭证，URL 是服务入口，模型 ID 必须与渠道实际提供的名称完全一致。Key 会明文保存在本扩展档案中。"),
    guideLine("3. 切换", "点击档案后会依次切换渠道、写入凭证、加载模型并做最终连接回验。看到“已连接，实际模型…”才算完成。")
  );
  const completion = foldSection("补全方式有什么不同", false);
  completion.body.append(
    guideLine("Chat Completion", "以 system、user、assistant 消息列表发送上下文。现代云模型主要使用这种方式，角色与指令边界清晰，通常是首选。"),
    guideLine("Text Completion", "把整个提示词拼成一段文本续写。适合本地推理后端、旧模型和需要精细控制提示模板的玩法。"),
    guideLine("NovelAI", "面向创作续写的专用服务，偏小说语料与采样控制，不等同于通用聊天 API。"),
    guideLine("KoboldAI", "常用于本地或自托管文本生成后端，玩法自由，但 URL、模型加载和性能取决于自己的服务。"),
    guideLine("KoboldAI Horde", "由社区算力池处理请求，不必自备推理服务；可用模型、排队时间和速度会随在线工作节点变化。"),
    guideLine("注意", "“补全方式”描述请求协议，不代表模型聪明程度。同一个模型可能被不同后端包装成不同协议。")
  );
  const channels = foldSection("Chat Completion 渠道说明", false);
  channels.body.append(
    guideLine("OpenAI", "官方直连渠道，模型名称和能力以 OpenAI 当前控制台为准。"),
    guideLine("Claude", "Anthropic 官方渠道，擅长长上下文与文本任务；使用 Anthropic Key。"),
    guideLine("OpenRouter", "聚合多家模型的统一入口，切模型方便；模型 ID 通常带厂商前缀，计费与路由由 OpenRouter 管理。"),
    guideLine("Google AI Studio", "Google Gemini 开发者渠道；区域可用性、限额与模型名以 AI Studio 为准。"),
    guideLine("自定义 OpenAI 兼容", "用于第三方中转、本地网关或其他兼容服务。通常需填写基础 URL（很多服务要求以 /v1 结尾）和服务方给出的精确模型 ID。"),
    guideLine("其他厂商", "DeepSeek、xAI、Mistral、Groq 等兼容 OpenAI 请求格式的服务统一使用“自定义 OpenAI 兼容”，不再重复提供厂商入口。")
  );
  const fields = foldSection("字段、安全与排障", false);
  fields.body.append(
    guideLine("Key 与 secret-id", "输入框会遮罩显示，但 Key 在本扩展档案中明文保存，并同步写入 SillyTavern 密钥库；新版可用 secret-id 区分同渠道多把 Key。请勿分享含档案数据的配置。"),
    guideLine("URL", "404 常见于路径不对，请核对是否需要 /v1；不要把具体的 /chat/completions 路径重复填进基础 URL。"),
    guideLine("NONE", "通常表示模型列表仍在加载、模型 ID 不存在或账号无权限。现在切换会等待并回验，不会把明显的 NONE 当成功。"),
    guideLine("401 / 403", "通常是 Key 错误、额度/权限不足或服务区域限制。"),
    guideLine("旧版兼容", "旧版 SillyTavern 可能不允许回读 Key；导入时会保留表单中已有 Key，并回退到单密钥槽位。")
  );
  guide.append(quick.box, completion.box, channels.box, fields.box);
  return guide;
}
function buildRow(profile, active, busy, onActivate) {
  const row = el2("div", `stapi-row${active ? " stapi-row-on" : ""}${busy ? " stapi-row-busy" : ""}`);
  row.setAttribute("role", "button");
  row.tabIndex = busy ? -1 : 0;
  row.setAttribute("aria-disabled", String(busy));
  const main = el2("div", "stapi-row-main");
  const name = el2("div", "stapi-row-name");
  name.textContent = profile.name;
  const summary = el2("div", "stapi-row-sub");
  summary.textContent = profileSummary(profile).join(" · ");
  main.append(name, summary);
  const mark = el2("div", "stapi-row-mark");
  mark.textContent = active ? "使用中" : "切换";
  row.append(main, mark);
  row.addEventListener("click", () => {
    if (!busy) onActivate();
  });
  row.addEventListener("keydown", (event) => {
    if (!busy && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onActivate();
    }
  });
  return row;
}

// st-extension/src/apps/renderer/prompt.ts
var GAL_PROMPT = `【Galgame 模式】
适合连续对话或分镜。字段：version=1，mode="gal"，scene 为场景说明，beats 为 1-50 个节拍；每个节拍必须有 speaker 和 text，title、background、节拍的 portrait/background 可省略。portrait 还可写成 sprite:地址，由当前角色图库解析。
示例：
<STStageRender>{"version":1,"mode":"gal","title":"雨夜重逢","scene":"车站月台","beats":[{"speaker":"小雪","text":"你终于来了。","portrait":"/user/images/xiaoxue.png"},{"speaker":"我","text":"抱歉，让你久等了。"}]}</STStageRender>`;
var CARDS_PROMPT = `【SLG 卡片选择模式】
适合给出 2-8 个明确选择。每张卡必须有唯一 id、title、description、action，consequence 可省略；action 是填入输入框但不自动发送的文字。
示例：
<STStageRender>{"version":1,"mode":"cards","title":"下一步行动","cards":[{"id":"advance","title":"继续前进","description":"沿山路调查灯光","consequence":"可能遭遇守卫","action":"我选择沿山路继续前进。"},{"id":"rest","title":"原地休整","description":"恢复体力并整理物资","action":"我选择原地休整。"}]}</STStageRender>`;
var BATTLE_PROMPT = `【战斗模式】
适合可由本地确定性规则处理的简单战斗。player/enemy 必须有不同的唯一 id，并包含 name、hp/maxHp、mp/maxMp、attack、defense、speed、crit、dodge。所有基础数值为 0-9999，hp 不得大于 maxHp，mp 不得大于 maxMp，crit/dodge 为 0-100。
skills、items、statuses 各最多 12 项且各自 id 不重复。skill 字段为 id/name/type/mpCost/power，type 只能是 damage 或 heal；item 字段为 id/name/effect/quantity/power，effect 只能是 heal_hp 或 heal_mp；status 字段为 id/name/duration，可选 attackDelta、defenseDelta、damagePerTurn。description 可用于技能和物品；background、enemyIntent、allowFlee 可省略。
示例：
<STStageRender>{"version":1,"mode":"battle","title":"遗迹守卫战","player":{"id":"hero","name":"旅行者","hp":80,"maxHp":100,"mp":30,"maxMp":50,"attack":18,"defense":8,"speed":12,"crit":10,"dodge":5,"skills":[{"id":"slash","name":"斩击","type":"damage","mpCost":5,"power":20}]},"enemy":{"id":"guard","name":"遗迹守卫","hp":90,"maxHp":90,"mp":0,"maxMp":0,"attack":16,"defense":10,"speed":8,"crit":5,"dodge":3},"enemyIntent":"蓄力攻击","allowFlee":true}</STStageRender>`;
function buildRendererPrompt(settings) {
  if (!settings.enabled) return "";
  const modes = [];
  if (settings.galEnabled) modes.push(GAL_PROMPT);
  if (settings.cardsEnabled) modes.push(CARDS_PROMPT);
  if (settings.battleEnabled) modes.push(BATTLE_PROMPT);
  if (modes.length === 0) return "";
  return `# ST Stage 结构化渲染协议

普通回复不需要输出渲染块；仅在当前场景明显适合以下已启用模式时使用。
用户明确要求使用某个已启用模式、演示该模式或测试该模式时，必须输出对应的结构化渲染块，不得只用普通文本说明。
每条回复最多输出一个 STStageRender 标签块，标签内部必须是严格 JSON。
使用时必须输出完整 <STStageRender>JSON</STStageRender> 标签，不得只输出裸 JSON。
禁止输出 HTML、脚本或其他可执行代码，也不要增加协议未声明的字段。
叙事正文放在块外，并保证块外内容脱离渲染器后仍然独立可读。
所有数值使用整数，图片只使用可信的 http(s)、base64 栅格 data:image、/user/ 或扩展相对路径。

${modes.join("\n\n")}`;
}

// st-extension/src/apps/renderer/config.ts
var RENDERER_APP_ID = "renderer";
function defaultRendererSettings() {
  return {
    enabled: false,
    galEnabled: true,
    cardsEnabled: true,
    battleEnabled: true,
    injectionDepth: 4,
    typewriter: true,
    reducedMotion: false
  };
}
function normalizeRendererSettings(raw) {
  const settings = defaultRendererSettings();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return settings;
  const value = raw;
  for (const key of ["enabled", "galEnabled", "cardsEnabled", "battleEnabled", "typewriter", "reducedMotion"]) {
    if (typeof value[key] === "boolean") settings[key] = value[key];
  }
  if (typeof value.injectionDepth === "number" && Number.isInteger(value.injectionDepth)) {
    settings.injectionDepth = Math.min(20, Math.max(0, value.injectionDepth));
  }
  return settings;
}

// st-extension/src/apps/renderer-app.ts
function refreshPrompt(host, settings) {
  host.injectPrompt(buildRendererPrompt(settings), settings.injectionDepth);
}
function section(title2, ...rows) {
  const box = el2("section", "so-app-section renderer-settings-section");
  const heading = el2("div", "so-app-title");
  heading.textContent = title2;
  box.append(heading, ...rows);
  return box;
}
function enabledModes(settings) {
  return [
    settings.galEnabled ? "Galgame" : "",
    settings.cardsEnabled ? "卡片选择" : "",
    settings.battleEnabled ? "战斗" : ""
  ].filter(Boolean);
}
function rendererStatus(settings) {
  const status = el2("div", "renderer-status so-app-desc");
  if (!settings.enabled) {
    status.textContent = "未启用（当前不注入任何协议提示词）。启用后，下一条合适的 AI 回复才会尝试显示结构化渲染。";
    return status;
  }
  const modes = enabledModes(settings);
  const injected = buildRendererPrompt(settings);
  status.textContent = modes.length > 0 ? `已启用 · 可用模式：${modes.join("、")} · 正在注入协议说明 ${injected.length} 字符（深度 ${settings.injectionDepth}）` : "已启用，但没有启用模式——此时不注入提示词；请至少打开一个模式。";
  return status;
}
function quickStep(number, title2, description) {
  const row = el2("div", "renderer-quick-step");
  const marker = el2("span", "renderer-quick-step-number");
  marker.textContent = number;
  const content = el2("div", "renderer-quick-step-content");
  const heading = el2("strong", "renderer-quick-step-title");
  heading.textContent = title2;
  const detail = el2("span", "so-app-desc");
  detail.textContent = description;
  content.append(heading, detail);
  row.append(marker, content);
  return row;
}
function quickStart(settings, onEnable) {
  const box = el2("section", "so-app-section renderer-quick-start");
  const heading = el2("div", "so-app-title");
  heading.textContent = "快速开始";
  box.append(heading, rendererStatus(settings));
  if (!settings.enabled) {
    const activation = appButton("启用渲染", onEnable);
    activation.classList.add("renderer-recommend");
    box.append(
      quickStep("1", "打开渲染", "启用下面的总开关，保留至少一个模式。"),
      quickStep("2", "发送普通消息", "不需要手动粘贴 JSON；插件会把协议说明注入给 AI。"),
      quickStep("3", "使用回复中的交互", "卡片会填入输入框，战斗按钮在渲染面板内执行。"),
      activation
    );
  }
  return box;
}
function modeGuide() {
  const { box, body } = foldSection("模式说明", false, "renderer:mode-guide");
  box.classList.add("renderer-mode-guide");
  const modes = [
    ["Galgame", "连续对话和分镜节拍；适合让 AI 控制角色、场景和立绘切换。"],
    ["卡片选择", "2-8 个明确选项；点击后只填入草稿，不会替你自动发送。"],
    ["战斗", "本地确定性战斗；选择攻击、技能、物品或逃跑后立即更新面板。"]
  ];
  for (const [title2, description] of modes) {
    const row = el2("div", "renderer-mode-row");
    const name = el2("strong", "renderer-mode-name");
    name.textContent = title2;
    const detail = el2("span", "so-app-desc");
    detail.textContent = description;
    row.append(name, detail);
    body.append(row);
  }
  const troubleshooting = el2("p", "so-app-desc renderer-troubleshooting");
  troubleshooting.textContent = "没有渲染时，普通回复会原样显示。自查顺序：先看上方状态行——显示「正在注入协议说明 N 字符」才说明协议在发给 AI；显示未启用或没有模式则先打开开关；之后发送新消息，只有 AI 返回合法的 STStageRender 块时才会出现面板。";
  body.append(troubleshooting);
  return box;
}
function rendererApp(deps) {
  return {
    id: RENDERER_APP_ID,
    name: t("apps.renderer.name", "渲染"),
    icon: "🎬",
    order: 7,
    setup(host) {
      const inject = () => refreshPrompt(host, normalizeRendererSettings(host.getAppData()));
      inject();
      const offCharacterChanged = host.onCharacterChanged(inject);
      return () => {
        offCharacterChanged();
        host.injectPrompt("");
      };
    },
    mount(container, ctx) {
      let current2 = normalizeRendererSettings(ctx.getAppData());
      function save(next) {
        current2 = normalizeRendererSettings(next);
        ctx.setAppData(current2);
        refreshPrompt(ctx, current2);
        deps.runtime.reprocessAll();
        render2();
      }
      function render2() {
        container.textContent = "";
        const page = el2("div", "renderer-settings");
        page.append(
          quickStart(current2, () => save({ ...current2, enabled: true })),
          modeGuide(),
          section(
            "状态",
            toggleRow("启用渲染", current2.enabled, (enabled) => save({ ...current2, enabled }))
          ),
          section(
            "模式",
            toggleRow("Galgame", current2.galEnabled, (galEnabled) => save({ ...current2, galEnabled })),
            toggleRow("卡片选择", current2.cardsEnabled, (cardsEnabled) => save({ ...current2, cardsEnabled })),
            toggleRow("战斗", current2.battleEnabled, (battleEnabled) => save({ ...current2, battleEnabled }))
          ),
          section(
            "行为",
            numberRow("注入深度", current2.injectionDepth, 0, 20, (injectionDepth) => save({ ...current2, injectionDepth })),
            hintField(
              toggleRow("打字机", current2.typewriter, (typewriter) => save({ ...current2, typewriter })),
              "仅控制 Galgame 渲染面板里对话文字的逐字显示动画，与模型的流式输出无关；关闭后整段文字直接显示。"
            ),
            toggleRow("减少动态", current2.reducedMotion, (reducedMotion) => save({ ...current2, reducedMotion }))
          )
        );
        container.append(page);
      }
      render2();
    }
  };
}

// st-extension/src/apps/cloud-export/bridge.ts
function getSTContext() {
  try {
    const host = window;
    return host.SillyTavern?.getContext?.();
  } catch {
    return void 0;
  }
}
function requestHeaders() {
  return getSTContext()?.getRequestHeaders?.() ?? { "Content-Type": "application/json" };
}
async function requestJson(path, init2 = {}) {
  const response = await fetch(path, {
    ...init2,
    headers: { ...requestHeaders(), ...init2.headers ?? {} }
  });
  if (!response.ok) throw new Error(t("cloudExport.request_failed", "{{path}} 请求失败（{{status}}）", { path, status: response.status }));
  return response.json();
}
async function requestBinary(path, init2 = {}) {
  const response = await fetch(path, {
    ...init2,
    headers: { ...requestHeaders(), ...init2.headers ?? {} }
  });
  if (!response.ok) throw new Error(t("cloudExport.request_failed", "{{path}} 请求失败（{{status}}）", { path, status: response.status }));
  return response.arrayBuffer();
}
function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}
function asArray(value, keys = []) {
  if (Array.isArray(value)) return value.map(asRecord);
  const record = asRecord(value);
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key].map(asRecord);
  }
  return [];
}
function text3(record, keys, fallback = "") {
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) return record[key];
  }
  return fallback;
}
function timestamp(record) {
  for (const key of ["updatedAt", "updated_at", "lastModified", "last_modified", "mtime", "last_mes"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value) || Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return void 0;
}
function linkedWorldName(item) {
  const nested = asRecord(item.data);
  for (const source of [asRecord(nested.extensions), asRecord(item.extensions), nested, item]) {
    const value = source.world;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return void 0;
}
async function listCharacters() {
  const raw = await requestJson("/api/characters/all", {
    method: "POST",
    body: JSON.stringify({})
  });
  return asArray(raw, ["characters", "data"]).map((item, index) => {
    const avatar = text3(item, ["avatar", "avatar_url", "file_name"]);
    const name = text3(item, ["name", "char_name"], avatar.replace(/\.png$/i, "")) || `角色 ${index + 1}`;
    return {
      id: avatar || name,
      name,
      avatar: avatar || `${name}.png`,
      updatedAt: timestamp(item),
      chats: [],
      linkedWorldName: linkedWorldName(item)
    };
  });
}
async function listChats(character) {
  const raw = await requestJson("/api/characters/chats", {
    method: "POST",
    body: JSON.stringify({ avatar_url: character.avatar, metadata: true })
  });
  return asArray(raw, ["chats", "data"]).map((item, index) => {
    const path = text3(item, ["path", "file", "file_name", "name"]);
    const name = text3(item, ["name", "chat_name"], path.replace(/^.*[\\/]/, "").replace(/\.jsonl$/i, "")) || `聊天 ${index + 1}`;
    return { id: `${character.id}:${path || name}`, name, path, updatedAt: timestamp(item) };
  });
}
async function listWorldbooks() {
  const listing = await requestJson("/api/worldinfo/list", { method: "POST", body: JSON.stringify({}) });
  const items = asArray(listing, ["worlds", "worldbooks", "data"]);
  return items.map((item, index) => {
    const id = text3(item, ["file_id", "file_name", "filename", "name"], `world-${index + 1}`);
    const name = text3(item, ["name"], id).replace(/\.json$/i, "");
    return {
      id,
      name,
      fileName: id.endsWith(".json") ? id : `${id}.json`,
      updatedAt: timestamp(item)
    };
  });
}
async function readWorldbook(worldbook) {
  return requestJson("/api/worldinfo/get", {
    method: "POST",
    body: JSON.stringify({ name: worldbook.id.replace(/\.json$/i, "") })
  });
}
function loadPresets(raw) {
  const names = Array.isArray(raw.openai_setting_names) ? raw.openai_setting_names : [];
  const contents = Array.isArray(raw.openai_settings) ? raw.openai_settings : [];
  return names.map((value, index) => {
    const name = typeof value === "string" && value ? value : `preset-${index + 1}`;
    const fileName = name.endsWith(".json") ? name : `${name}.json`;
    const rawContent = contents[index];
    let content = rawContent;
    if (typeof rawContent === "string") {
      try {
        content = JSON.parse(rawContent);
      } catch {
        content = {};
      }
    }
    return { id: fileName, name: name.replace(/\.json$/i, ""), fileName, content };
  });
}
function loadRegex(raw) {
  let settings = raw;
  if (typeof raw.settings === "string") {
    try {
      settings = asRecord(JSON.parse(raw.settings));
    } catch {
      settings = {};
    }
  }
  const extensionSettings = asRecord(settings.extension_settings ?? settings.extensions);
  const rules = Array.isArray(extensionSettings.regex) ? extensionSettings.regex : [];
  return rules.length ? { rules } : null;
}
function createSTCloudExportBridge() {
  return {
    listCharacters,
    listChats,
    listWorldbooks,
    async loadSettingsAssets() {
      const settings = await requestJson("/api/settings/get", { method: "POST", body: JSON.stringify({}) }).then(asRecord);
      const presets = loadPresets(settings);
      const regex = loadRegex(settings);
      return { presets, regex };
    },
    readWorldbook,
    readCharacterCard: (character) => requestBinary("/api/characters/export", {
      method: "POST",
      body: JSON.stringify({ format: "png", avatar_url: character.avatar })
    }),
    async readChat(character, chat2) {
      const fileName = (chat2.path || chat2.name).replace(/\.jsonl$/i, "");
      const raw = await requestJson("/api/chats/get", {
        method: "POST",
        body: JSON.stringify({ ch_name: character.name, avatar_url: character.avatar, file_name: fileName })
      });
      if (!Array.isArray(raw)) throw new Error(t("cloudExport.chat_unexportable", "聊天 {{name}} 返回了无法导出的数据", { name: chat2.name }));
      return raw.map((line) => JSON.stringify(line)).join("\n") + (raw.length ? "\n" : "");
    }
  };
}

// st-extension/src/apps/cloud-export/archive-path.ts
function isArchiveSegment(value) {
  const hasControl = Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
  return Boolean(value) && value.trim() === value && !/^[.]+$/.test(value) && !hasControl && !/[\\/:*?"<>|]/.test(value) && !/[. ]$/.test(value) && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(value);
}
function archiveSegment(value, kind) {
  if (!isArchiveSegment(value)) throw new Error(t("cloudExport.invalid_filename", "无法生成可恢复备份：{{kind}}文件名不合法", { kind }));
  return value;
}

// st-extension/src/apps/cloud-export/manifest.ts
function characterArchiveIdentity(avatar) {
  const name = archiveSegment(avatar, t("cloudExport.kind_avatar", "角色头像"));
  if (!/\.png$/i.test(name)) throw new Error(t("cloudExport.avatar_png_required", "无法确定角色聊天目录：头像文件必须为 PNG"));
  return { avatar: name, stem: archiveSegment(name.slice(0, -4), t("cloudExport.kind_directory", "角色目录")) };
}
function buildMinimalSettings(snapshot, selection) {
  const selectedWorldNames = snapshot.worldbooks.filter((worldbook) => selection.worldbookIds.has(worldbook.id)).map((worldbook) => worldbook.name);
  const regex = selection.regex ? snapshot.regex?.rules ?? [] : [];
  const settings = {};
  if (regex.length > 0) settings.extension_settings = { regex };
  if (selectedWorldNames.length > 0) {
    settings.world_info_settings = { world_info: { globalSelect: selectedWorldNames } };
  }
  return Object.keys(settings).length > 0 ? JSON.stringify(settings, null, 2) : null;
}
function buildExportFiles(snapshot, selection) {
  const files = [];
  const hasSelection2 = selection.characterIds.size > 0 || selection.chatIds.size > 0 || selection.worldbookIds.size > 0 || selection.presetIds.size > 0 || selection.regex;
  if (!hasSelection2) return files;
  const settings = buildMinimalSettings(snapshot, selection);
  if (settings !== null) files.push({ path: "settings.json", data: settings });
  for (const worldbook of snapshot.worldbooks) {
    if (selection.worldbookIds.has(worldbook.id)) {
      if (worldbook.content !== void 0) {
        files.push({ path: `worlds/${archiveSegment(worldbook.fileName, t("cloudExport.kind_worldbook", "世界书"))}`, data: JSON.stringify(worldbook.content, null, 2), updatedAt: worldbook.updatedAt });
      }
    }
  }
  for (const preset of snapshot.presets) {
    if (selection.presetIds.has(preset.id)) {
      files.push({ path: `OpenAI Settings/${archiveSegment(preset.fileName, t("cloudExport.kind_preset", "预设"))}`, data: JSON.stringify(preset.content, null, 2), updatedAt: preset.updatedAt });
    }
  }
  return files;
}
function buildCharacterFiles(character, cardData, chats, selection) {
  const files = [];
  const selectedChats = character.chats.filter((chat2) => selection.chatIds.has(chat2.id) && chats.has(chat2.id));
  const selectedCard = selection.characterIds.has(character.id) && cardData !== void 0;
  if (!selectedCard && selectedChats.length === 0) return files;
  const identity = characterArchiveIdentity(character.avatar);
  if (selection.characterIds.has(character.id) && cardData !== void 0) {
    files.push({
      path: `characters/${identity.avatar}`,
      data: cardData,
      updatedAt: character.updatedAt
    });
  }
  for (const chat2 of selectedChats) {
    const data = chats.get(chat2.id);
    if (!selection.chatIds.has(chat2.id) || data === void 0) continue;
    files.push({
      path: `chats/${identity.stem}/${archiveSegment((chat2.path || chat2.name).replace(/\.jsonl$/i, ""), t("cloudExport.kind_chat", "聊天"))}.jsonl`,
      data,
      updatedAt: chat2.updatedAt
    });
  }
  return files;
}

// st-extension/src/apps/cloud-export/export-loader.ts
async function runTasks(tasks, concurrency, onProgress) {
  if (!tasks.length) return;
  let nextIndex = 0;
  let completed = 0;
  let failed;
  const worker = async () => {
    while (failed === void 0) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= tasks.length) return;
      const task = tasks[index];
      try {
        await task.run();
      } catch (error) {
        failed = new Error(t("cloudExport.asset_read_failed", "读取{{label}}失败：{{error}}", { label: task.label, error: error instanceof Error ? error.message : String(error) }));
        return;
      }
      completed += 1;
      onProgress?.({ completed, total: tasks.length, current: task.label });
    }
  };
  const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (failed !== void 0) throw failed;
}
async function loadSelectedExportFiles({
  bridge,
  catalog,
  selection,
  concurrency = 4,
  onProgress
}) {
  const cardData = /* @__PURE__ */ new Map();
  const chatData = /* @__PURE__ */ new Map();
  const worldbookContent = /* @__PURE__ */ new Map();
  const tasks = [];
  for (const character of catalog.characters) {
    if (selection.characterIds.has(character.id)) {
      tasks.push({
        label: t("cloudExport.asset_character", "角色卡 {{name}}", { name: character.name }),
        run: async () => {
          cardData.set(character.id, await bridge.readCharacterCard(character));
        }
      });
    }
    for (const chat2 of character.chats) {
      if (!selection.chatIds.has(chat2.id)) continue;
      tasks.push({
        label: t("cloudExport.asset_chat", "聊天 {{character}}/{{chat}}", { character: character.name, chat: chat2.name }),
        run: async () => {
          chatData.set(chat2.id, await bridge.readChat(character, chat2));
        }
      });
    }
  }
  for (const worldbook of catalog.worldbooks) {
    if (!selection.worldbookIds.has(worldbook.id)) continue;
    tasks.push({
      label: t("cloudExport.asset_worldbook", "世界书 {{name}}", { name: worldbook.name }),
      run: async () => {
        worldbookContent.set(worldbook.id, await bridge.readWorldbook(worldbook));
      }
    });
  }
  await runTasks(tasks, concurrency, onProgress);
  const hydratedWorldbooks = catalog.worldbooks.map((worldbook) => worldbookContent.has(worldbook.id) ? { ...worldbook, content: worldbookContent.get(worldbook.id) } : worldbook);
  const hydratedCatalog = { ...catalog, worldbooks: hydratedWorldbooks };
  const files = buildExportFiles(hydratedCatalog, selection);
  for (const character of catalog.characters) {
    files.push(...buildCharacterFiles(character, cardData.get(character.id), chatData, selection));
  }
  return files;
}

// st-extension/src/apps/cloud-export/zip.ts
var import_jszip = __toESM(require_jszip_min());
var REVOKE_DELAY_MS = 6e4;
function assertUniqueArchivePaths(files) {
  const seen = /* @__PURE__ */ new Map();
  for (const { path } of files) {
    if (!path.split("/").every(isArchiveSegment)) throw new Error(t("cloudExport.invalid_path", "备份路径不合法：{{path}}", { path }));
    const canonical = path.normalize("NFC").toLowerCase();
    if (seen.has(canonical)) throw new Error(t("cloudExport.path_collision", "备份路径冲突：{{first}} 与 {{second}}", { first: seen.get(canonical), second: path }));
    seen.set(canonical, path);
  }
  for (const [canonical, path] of seen) {
    const parts = canonical.split("/");
    for (let length = 1; length < parts.length; length += 1) {
      const parent = parts.slice(0, length).join("/");
      if (seen.has(parent)) throw new Error(t("cloudExport.path_collision", "备份路径冲突：{{first}} 与 {{second}}", { first: seen.get(parent), second: path }));
    }
  }
}
async function downloadSTBackup(files, filename, onProgress, schedulers = {}) {
  if (!files.length) throw new Error(t("cloudExport.no_assets", "没有选择任何可导出的资产"));
  assertUniqueArchivePaths(files);
  const zip = new import_jszip.default();
  for (const file of files) {
    zip.file(file.path, file.data, file.updatedAt ? { date: new Date(file.updatedAt) } : void 0);
  }
  const blob = await zip.generateAsync(
    { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
    (metadata) => onProgress({ percent: metadata.percent })
  );
  const scheduleRevoke = schedulers.scheduleRevoke ?? ((revoke, delayMs) => {
    setTimeout(revoke, delayMs);
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".zip") ? filename : `${filename}.zip`;
  anchor.style.display = "none";
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    scheduleRevoke(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  }
}

// st-extension/src/apps/cloud-export/export-app.ts
function exportTabs() {
  return [
    { id: "characters", label: t("cloudExport.characters", "角色卡") },
    { id: "worldbooks", label: t("cloudExport.worldbooks", "世界书") },
    { id: "presets", label: t("cloudExport.presets", "预设") },
    { id: "regex", label: t("cloudExport.regex", "正则") }
  ];
}
var mountId = 0;
function emptySelection() {
  return { characterIds: /* @__PURE__ */ new Set(), chatIds: /* @__PURE__ */ new Set(), worldbookIds: /* @__PURE__ */ new Set(), presetIds: /* @__PURE__ */ new Set(), regex: false };
}
function formatDate(value) {
  return value ? new Date(value).toLocaleString(getLocale()) : t("cloudExport.unknown_date", "更新时间未知");
}
function backupFilename(now = /* @__PURE__ */ new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `default-user-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.zip`;
}
function hasSelection(selection) {
  return selection.characterIds.size > 0 || selection.chatIds.size > 0 || selection.worldbookIds.size > 0 || selection.presetIds.size > 0 || selection.regex;
}
function checkbox(label, checked, onChange, focusKey, busy, extraClass = "") {
  const row = el2("div", `so-app-toggle${extraClass ? ` ${extraClass}` : ""}`);
  const control2 = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.dataset.exportFocus = focusKey;
  input.setAttribute("aria-disabled", String(busy));
  input.addEventListener("click", (event) => {
    if (busy) event.preventDefault();
  });
  input.addEventListener("change", () => {
    if (busy) {
      input.checked = checked;
      return;
    }
    ;
    onChange(input.checked);
  });
  const text4 = el2("span", "");
  text4.textContent = label;
  control2.append(input, text4);
  row.append(control2);
  return row;
}
async function loadWithLimit(items, limit, task) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}
function deselectCharacter(characterId, selection, chats, allCharacters, worldbooks) {
  selection.characterIds.delete(characterId);
  for (const chat2 of chats.get(characterId)?.data ?? []) selection.chatIds.delete(chat2.id);
  const character = allCharacters.find((item) => item.id === characterId);
  if (!character?.linkedWorldName) return;
  const linked = findLinkedWorldbook(character, worldbooks);
  if (!linked) return;
  const stillNeeded = allCharacters.some((item) => item.id !== characterId && selection.characterIds.has(item.id) && item.linkedWorldName && findLinkedWorldbook(item, worldbooks)?.id === linked.id);
  if (!stillNeeded) selection.worldbookIds.delete(linked.id);
}
function findLinkedWorldbook(character, worldbooks) {
  const target = character.linkedWorldName?.trim().toLowerCase().replace(/\.json$/i, "");
  if (!target) return void 0;
  return worldbooks.find((book) => {
    const byId = book.id.trim().toLowerCase().replace(/\.json$/i, "");
    const byName = book.name.trim().toLowerCase().replace(/\.json$/i, "");
    return byId === target || byName === target;
  });
}
function cloudExportApp(bridge = createSTCloudExportBridge(), download = downloadSTBackup) {
  let disposeMount;
  return {
    id: "cloud-export",
    name: t("cloudExport.name", "导出"),
    icon: "📦",
    order: 15,
    mount(container, ctx) {
      let disposed = false;
      let activeTab = "characters";
      let query = "";
      let busy = false;
      let progressText = "";
      const selection = emptySelection();
      const expandedCharacters = /* @__PURE__ */ new Set();
      const characters = { status: "idle", data: [] };
      const worldbooks = { status: "idle", data: [] };
      const settings = { status: "idle", data: null };
      const chats = /* @__PURE__ */ new Map();
      const chatRequests = /* @__PURE__ */ new Map();
      disposeMount = () => {
        disposed = true;
      };
      const prefix = `cloud-export-${++mountId}`;
      const title2 = el2("div", "so-app-title");
      title2.textContent = t("cloudExport.title", "SillyTavern 选择式备份");
      const desc = el2("div", "so-app-desc");
      desc.textContent = t("cloudExport.description", "选择需要的数据，统一导出为 SillyTavern 标准 default-user ZIP。");
      const tabs = el2("div", "so-app-section cloud-export-tabs");
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", t("cloudExport.categories", "备份分类"));
      const search = document.createElement("input");
      search.className = "text_pole so-app-input";
      search.placeholder = t("cloudExport.search", "搜索当前分类");
      search.setAttribute("aria-label", t("cloudExport.search", "搜索当前分类"));
      const results = el2("div", "cloud-export-results");
      results.id = `${prefix}-results`;
      results.setAttribute("role", "tabpanel");
      results.tabIndex = 0;
      const footer = el2("div", "so-app-section");
      const count = el2("div", "so-app-desc");
      const status = el2("div", "so-app-desc");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      const exportButton = appButton(t("cloudExport.export", "导出所选备份"), () => {
        void exportSelected();
      });
      exportButton.dataset.exportFocus = "export";
      footer.append(count, status, exportButton);
      let composing = false;
      const applyQuery = () => {
        query = search.value.trim().toLowerCase();
        render2();
      };
      search.addEventListener("compositionstart", () => {
        composing = true;
      });
      search.addEventListener("compositionend", () => {
        composing = false;
        applyQuery();
      });
      search.addEventListener("input", (event) => {
        if (!composing && !event.isComposing) applyQuery();
      });
      container.replaceChildren(title2, desc, tabs, search, results, footer);
      const ensureCharacters = async (retry = false) => {
        if (!retry && characters.status === "ready") return characters.data;
        characters.status = "loading";
        characters.error = void 0;
        render2();
        try {
          const data = await bridge.listCharacters();
          if (disposed) return data;
          characters.data = data;
          characters.status = "ready";
          render2();
          return data;
        } catch (error) {
          if (!disposed) {
            characters.status = "error";
            characters.error = String(error);
            render2();
          }
          ;
          throw error;
        }
      };
      const ensureWorldbooks = async (retry = false) => {
        if (!retry && worldbooks.status === "ready") return worldbooks.data;
        worldbooks.status = "loading";
        worldbooks.error = void 0;
        render2();
        try {
          const data = await bridge.listWorldbooks();
          if (disposed) return data;
          worldbooks.data = data;
          worldbooks.status = "ready";
          render2();
          return data;
        } catch (error) {
          if (!disposed) {
            worldbooks.status = "error";
            worldbooks.error = String(error);
            render2();
          }
          ;
          throw error;
        }
      };
      const ensureSettings = async (retry = false) => {
        if (!retry && settings.status === "ready" && settings.data) return settings.data;
        settings.status = "loading";
        settings.error = void 0;
        render2();
        try {
          const data = await bridge.loadSettingsAssets();
          if (disposed) return data;
          settings.data = data;
          settings.status = "ready";
          render2();
          return data;
        } catch (error) {
          if (!disposed) {
            settings.status = "error";
            settings.error = String(error);
            render2();
          }
          ;
          throw error;
        }
      };
      const ensureChats = async (character, shouldRender = true) => {
        const current2 = chats.get(character.id);
        if (current2?.status === "ready") return current2.data;
        const pending = chatRequests.get(character.id);
        if (pending) return pending;
        const state2 = { status: "loading", data: [] };
        chats.set(character.id, state2);
        if (shouldRender) render2();
        const request = bridge.listChats(character).then((data) => {
          if (!disposed) {
            state2.data = data;
            state2.status = "ready";
            if (shouldRender) render2();
          }
          ;
          return data;
        }).catch((error) => {
          state2.status = "error";
          state2.error = String(error);
          if (shouldRender) render2();
          throw error;
        }).finally(() => {
          chatRequests.delete(character.id);
        });
        chatRequests.set(character.id, request);
        return request;
      };
      const ensureActiveTab = async (retry = false) => {
        try {
          if (activeTab === "characters") await ensureCharacters(retry);
          else if (activeTab === "worldbooks") await ensureWorldbooks(retry);
          else await ensureSettings(retry);
        } catch {
        }
      };
      const selectCharacterBundle = async (character) => {
        if (busy) return;
        selection.characterIds.add(character.id);
        busy = true;
        progressText = t("cloudExport.collect_character", "正在收集 {{name}} 的关联数据…", { name: character.name });
        render2();
        const missing = [];
        try {
          try {
            const items = await ensureChats(character, false);
            items.forEach((chat2) => selection.chatIds.add(chat2.id));
          } catch {
            missing.push(t("cloudExport.chat_list", "聊天清单"));
          }
          if (character.linkedWorldName) {
            try {
              const books = await ensureWorldbooks();
              const linked = findLinkedWorldbook(character, books);
              if (linked) selection.worldbookIds.add(linked.id);
              else missing.push(t("cloudExport.linked_missing", "关联世界书「{{name}}」在清单里没找到", { name: character.linkedWorldName }));
            } catch {
              missing.push(t("cloudExport.worldbook_list", "世界书清单"));
            }
          }
        } finally {
          busy = false;
          progressText = "";
          render2();
        }
        if (!disposed && missing.length > 0) {
          ctx.toast("warning", t("cloudExport.bundle_incomplete", "{{name}} 已选中，但这些没能带上：{{items}}", { name: character.name, items: missing.join(t("cloudExport.list_separator", "、")) }));
        }
      };
      const selectVisibleBundles = async (targets) => {
        if (busy) return;
        busy = true;
        progressText = t("cloudExport.collect_characters", "正在收集角色的关联数据…");
        render2();
        const unresolved = [];
        try {
          let books = worldbooks.data;
          if (targets.some((item) => item.linkedWorldName)) {
            try {
              books = await ensureWorldbooks();
            } catch {
              unresolved.push(t("cloudExport.worldbook_list_failed", "世界书清单读取失败"));
            }
          }
          await loadWithLimit(targets, 4, async (character) => {
            selection.characterIds.add(character.id);
            try {
              const items = await ensureChats(character, false);
              items.forEach((chat2) => selection.chatIds.add(chat2.id));
            } catch {
              unresolved.push(t("cloudExport.character_chat_list", "{{name}} 的聊天清单", { name: character.name }));
            }
            if (!character.linkedWorldName) return;
            const linked = findLinkedWorldbook(character, books);
            if (linked) selection.worldbookIds.add(linked.id);
            else unresolved.push(t("cloudExport.character_worldbook", "{{name}} 的关联世界书「{{worldbook}}」", { name: character.name, worldbook: character.linkedWorldName }));
          });
        } catch (error) {
          if (!disposed) ctx.toast("error", t("cloudExport.batch_failed", "批量选择失败：{{error}}", { error: String(error) }));
        } finally {
          busy = false;
          progressText = "";
          render2();
        }
        if (!disposed && unresolved.length > 0) {
          ctx.toast("warning", t("cloudExport.batch_incomplete", "已选中，但这些没能带上：{{items}}", { items: unresolved.join(t("cloudExport.list_separator", "、")) }));
        }
      };
      const scrollParent = () => {
        let node = container;
        while (node) {
          const style = node.ownerDocument.defaultView?.getComputedStyle(node);
          const overflowY = style?.overflowY;
          if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
          node = node.parentElement;
        }
        return null;
      };
      const exportSelected = async () => {
        if (busy || disposed) return;
        if (!hasSelection(selection)) {
          ctx.toast("warning", t("cloudExport.select_first", "请先选择要导出的内容"));
          return;
        }
        busy = true;
        progressText = t("cloudExport.preparing", "正在准备所选数据…");
        render2();
        try {
          const catalog = {
            characters: characters.data.map((character) => ({ ...character, chats: chats.get(character.id)?.data ?? [] })),
            worldbooks: worldbooks.data,
            presets: settings.data?.presets ?? [],
            regex: settings.data?.regex ?? null
          };
          const files = await loadSelectedExportFiles({
            bridge,
            catalog,
            selection,
            concurrency: 4,
            onProgress: ({ completed, total, current: current2 }) => {
              progressText = t("cloudExport.read_progress", "正在读取 {{completed}}/{{total}}：{{current}}", { completed, total, current: current2 });
              render2();
            }
          });
          await download(files, backupFilename(), ({ percent }) => {
            progressText = t("cloudExport.compress_progress", "正在压缩 {{percent}}%", { percent: Math.round(percent) });
            render2();
          });
          if (!disposed) ctx.toast("success", t("cloudExport.downloaded", "SillyTavern 标准备份已下载"));
        } catch (error) {
          if (!disposed) ctx.toast("error", t("cloudExport.export_failed", "导出失败：{{error}}", { error: String(error) }));
        } finally {
          busy = false;
          progressText = "";
          render2();
        }
      };
      const render2 = () => {
        if (disposed) return;
        const scroller = scrollParent();
        const previousScrollTop = scroller?.scrollTop ?? 0;
        const active = document.activeElement;
        const focusKey = active instanceof HTMLElement && container.contains(active) ? active.dataset.exportFocus : void 0;
        tabs.replaceChildren();
        const currentTabs = exportTabs();
        for (const [index, tab] of currentTabs.entries()) {
          const activate = () => {
            if (busy || activeTab === tab.id) return;
            activeTab = tab.id;
            query = "";
            composing = false;
            search.value = "";
            render2();
            void ensureActiveTab();
          };
          const button2 = document.createElement("button");
          button2.type = "button";
          button2.className = "so-app-btn";
          button2.textContent = tab.label;
          button2.addEventListener("click", activate);
          button2.id = `${prefix}-tab-${tab.id}`;
          button2.dataset.exportFocus = `tab:${tab.id}`;
          button2.setAttribute("role", "tab");
          button2.setAttribute("aria-selected", String(activeTab === tab.id));
          button2.setAttribute("aria-controls", results.id);
          button2.setAttribute("aria-disabled", String(busy));
          button2.tabIndex = activeTab === tab.id ? 0 : -1;
          button2.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.stopPropagation();
              return;
            }
            const next = event.key === "Home" ? 0 : event.key === "End" ? currentTabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % currentTabs.length : event.key === "ArrowLeft" ? (index + currentTabs.length - 1) % currentTabs.length : -1;
            if (next < 0 || event.isComposing) return;
            event.preventDefault();
            event.stopPropagation();
            if (busy) return;
            const target = tabs.children[next];
            target.focus({ preventScroll: true });
            target.click();
          });
          if (activeTab === tab.id) button2.classList.add("cloud-export-active");
          tabs.append(button2);
        }
        results.setAttribute("aria-labelledby", `${prefix}-tab-${activeTab}`);
        search.readOnly = busy;
        search.setAttribute("aria-disabled", String(busy));
        const visibleCharacters = characters.data.filter((item) => item.name.toLowerCase().includes(query));
        const visibleWorldbooks = worldbooks.data.filter((item) => item.name.toLowerCase().includes(query));
        const visiblePresets = (settings.data?.presets ?? []).filter((item) => item.name.toLowerCase().includes(query));
        const actions = el2("div", "so-app-section");
        const addAction = (key, label, action) => {
          const button2 = appButton(label, () => {
            if (!busy) void action();
          });
          button2.dataset.exportFocus = `${activeTab}:${key}`;
          button2.setAttribute("aria-disabled", String(busy));
          actions.append(button2);
        };
        const toggleSet = (items, set) => items.forEach((item) => set.has(item.id) ? set.delete(item.id) : set.add(item.id));
        if (activeTab === "characters" && characters.status === "ready" && visibleCharacters.length) {
          addAction("select-all", t("cloudExport.select_all", "全选当前结果"), () => {
            void selectVisibleBundles(visibleCharacters);
          });
          addAction("invert", t("cloudExport.invert", "反选当前结果"), () => {
            const toAdd = visibleCharacters.filter((item) => !selection.characterIds.has(item.id));
            visibleCharacters.filter((item) => selection.characterIds.has(item.id)).forEach((item) => deselectCharacter(item.id, selection, chats, characters.data, worldbooks.data));
            if (toAdd.length === 0) {
              render2();
              return;
            }
            void selectVisibleBundles(toAdd);
          });
          addAction("clear", t("cloudExport.clear", "清空当前分类"), () => {
            selection.characterIds.clear();
            selection.chatIds.clear();
            render2();
          });
        } else if (activeTab === "worldbooks" && worldbooks.status === "ready" && visibleWorldbooks.length) {
          addAction("select-all", t("cloudExport.select_all", "全选当前结果"), () => {
            visibleWorldbooks.forEach((item) => selection.worldbookIds.add(item.id));
            render2();
          });
          addAction("invert", t("cloudExport.invert", "反选当前结果"), () => {
            toggleSet(visibleWorldbooks, selection.worldbookIds);
            render2();
          });
          addAction("clear", t("cloudExport.clear", "清空当前分类"), () => {
            selection.worldbookIds.clear();
            render2();
          });
        } else if (activeTab === "presets" && settings.status === "ready" && visiblePresets.length) {
          addAction("select-all", t("cloudExport.select_all", "全选当前结果"), () => {
            visiblePresets.forEach((item) => selection.presetIds.add(item.id));
            render2();
          });
          addAction("invert", t("cloudExport.invert", "反选当前结果"), () => {
            toggleSet(visiblePresets, selection.presetIds);
            render2();
          });
          addAction("clear", t("cloudExport.clear", "清空当前分类"), () => {
            selection.presetIds.clear();
            render2();
          });
        }
        const list = el2("div", "so-app-section");
        const state2 = activeTab === "characters" ? characters : activeTab === "worldbooks" ? worldbooks : settings;
        const loading = state2.status === "idle" || state2.status === "loading";
        results.setAttribute("aria-busy", String(busy || loading));
        if (loading) list.textContent = t("cloudExport.loading_category", "正在读取当前分类…");
        else if (state2.status === "error") {
          list.textContent = t("cloudExport.read_failed", "读取失败：{{error}}", { error: state2.error ?? t("cloudExport.unknown_error", "未知错误") });
          const retry = appButton(t("cloudExport.retry", "重试"), () => {
            if (!busy) void ensureActiveTab(true);
          });
          retry.dataset.exportFocus = `${activeTab}:retry`;
          retry.setAttribute("aria-disabled", String(busy));
          list.append(retry);
        } else if (activeTab === "characters") {
          for (const character of visibleCharacters) {
            const row = el2("div", "cloud-export-character");
            row.append(checkbox(`${character.name} · ${formatDate(character.updatedAt)}`, selection.characterIds.has(character.id), (checked) => {
              if (!checked) {
                deselectCharacter(character.id, selection, chats, characters.data, worldbooks.data);
                render2();
                return;
              }
              void selectCharacterBundle(character);
            }, `character:${character.id}`, busy, "cloud-export-character-name"));
            const bundleNote = el2("div", "cloud-export-bundle-note");
            const linkedLabel = !character.linkedWorldName ? t("cloudExport.no_linked_worldbook", "没有关联独立世界书") : worldbooks.status !== "ready" ? t("cloudExport.linked_current", "关联世界书「{{name}}」按酒馆里的当前内容导出", { name: character.linkedWorldName }) : findLinkedWorldbook(character, worldbooks.data) ? t("cloudExport.linked_current", "关联世界书「{{name}}」按酒馆里的当前内容导出", { name: character.linkedWorldName }) : t("cloudExport.linked_unavailable", "关联世界书「{{name}}」在酒馆世界书清单里没找到", { name: character.linkedWorldName });
            bundleNote.textContent = t("cloudExport.bundle_note", "勾选即整体导出：角色卡 + 全部聊天 + {{linked}}", { linked: linkedLabel });
            row.append(bundleNote);
            const details = document.createElement("details");
            details.className = "so-app-fold cloud-export-chats";
            details.open = expandedCharacters.has(character.id);
            const summary = document.createElement("summary");
            const chatState = chats.get(character.id);
            summary.textContent = chatState?.status === "ready" ? t("cloudExport.chats_count", "聊天记录（{{count}}）", { count: chatState.data.length }) : t("cloudExport.chats_expand", "聊天记录（展开后读取）");
            summary.dataset.exportFocus = `chats:${character.id}`;
            summary.setAttribute("aria-label", t("cloudExport.character_chats", "{{name}} 的{{chats}}", { name: character.name, chats: summary.textContent }));
            summary.setAttribute("aria-expanded", String(details.open));
            const chatBody = el2("div", "cloud-export-chat-list");
            chatBody.id = `${prefix}-chats-${characters.data.indexOf(character)}`;
            summary.setAttribute("aria-controls", chatBody.id);
            chatBody.setAttribute("aria-busy", String(chatState?.status === "loading"));
            details.append(summary, chatBody);
            if (chatState?.status === "loading") chatBody.append(t("cloudExport.loading_chats", "正在读取聊天清单…"));
            else if (chatState?.status === "error") chatBody.append(t("cloudExport.read_failed", "读取失败：{{error}}", { error: chatState.error ?? t("cloudExport.unknown_error", "未知错误") }));
            else if (chatState?.status === "ready") {
              for (const chat2 of chatState.data) chatBody.append(checkbox(`${chat2.name} · ${formatDate(chat2.updatedAt)}`, selection.chatIds.has(chat2.id), (checked) => {
                if (checked) {
                  selection.chatIds.add(chat2.id);
                  selection.characterIds.add(character.id);
                } else selection.chatIds.delete(chat2.id);
                render2();
              }, `chat:${chat2.id}`, busy, "cloud-export-chat"));
            }
            details.addEventListener("toggle", () => {
              if (disposed || !container.contains(details)) return;
              summary.setAttribute("aria-expanded", String(details.open));
              if (details.open === expandedCharacters.has(character.id)) return;
              if (details.open) {
                expandedCharacters.add(character.id);
                void ensureChats(character).catch(() => {
                });
              } else {
                expandedCharacters.delete(character.id);
                render2();
              }
            });
            row.append(details);
            list.append(row);
          }
        } else if (activeTab === "worldbooks") {
          for (const worldbook of visibleWorldbooks) list.append(checkbox(`${worldbook.name} · ${formatDate(worldbook.updatedAt)}`, selection.worldbookIds.has(worldbook.id), (checked) => {
            if (checked) selection.worldbookIds.add(worldbook.id);
            else selection.worldbookIds.delete(worldbook.id);
            render2();
          }, `worldbook:${worldbook.id}`, busy));
        } else if (activeTab === "presets") {
          for (const preset of visiblePresets) list.append(checkbox(`${preset.name} · ${formatDate(preset.updatedAt)}`, selection.presetIds.has(preset.id), (checked) => {
            if (checked) selection.presetIds.add(preset.id);
            else selection.presetIds.delete(preset.id);
            render2();
          }, `preset:${preset.id}`, busy));
        } else {
          const regex = settings.data?.regex;
          list.append(checkbox(regex ? t("cloudExport.regex_count", "全局正则（{{count}} 条）", { count: regex.rules.length }) : t("cloudExport.no_regex", "没有发现全局正则"), selection.regex, (checked) => {
            selection.regex = Boolean(regex) && checked;
            render2();
          }, "regex", busy || !regex));
        }
        if (state2.status === "ready" && !list.childNodes.length) list.textContent = t("cloudExport.no_matches", "没有匹配的项目");
        results.replaceChildren(...actions.childElementCount ? [actions, list] : [list]);
        const countText = t("cloudExport.count", "已选 {{characters}} 个角色、{{chats}} 段聊天、{{worldbooks}} 本世界书、{{presets}} 个预设{{regex}}", {
          characters: selection.characterIds.size,
          chats: selection.chatIds.size,
          worldbooks: selection.worldbookIds.size,
          presets: selection.presetIds.size,
          regex: selection.regex ? t("cloudExport.regex_selected", "、1 组正则") : ""
        });
        if (count.textContent !== countText) count.textContent = countText;
        const chatStatus = activeTab === "characters" ? visibleCharacters.filter((character) => expandedCharacters.has(character.id)).map((character) => chats.get(character.id)).find((state3) => state3?.status === "loading" || state3?.status === "error") : void 0;
        const statusText = progressText || (loading ? t("cloudExport.loading_category", "正在读取当前分类…") : state2.status === "error" ? t("cloudExport.read_failed", "读取失败：{{error}}", { error: state2.error ?? t("cloudExport.unknown_error", "未知错误") }) : chatStatus?.status === "loading" ? t("cloudExport.loading_chats", "正在读取聊天清单…") : chatStatus?.status === "error" ? t("cloudExport.read_failed", "读取失败：{{error}}", { error: chatStatus.error ?? t("cloudExport.unknown_error", "未知错误") }) : countText);
        if (status.textContent !== statusText) status.textContent = statusText;
        count.hidden = statusText === countText;
        exportButton.textContent = busy ? t("cloudExport.processing", "正在处理…") : t("cloudExport.export", "导出所选备份");
        exportButton.setAttribute("aria-disabled", String(busy));
        if (focusKey && active !== document.activeElement && container.isConnected && document.activeElement === document.body) {
          const target = [...container.querySelectorAll("[data-export-focus]")].find((node) => node.dataset.exportFocus === focusKey);
          (target ?? results).focus({ preventScroll: true });
        }
        if (scroller && previousScrollTop > 0) scroller.scrollTop = previousScrollTop;
      };
      render2();
      void ensureActiveTab();
    },
    unmount() {
      disposeMount?.();
      disposeMount = void 0;
    }
  };
}

// st-extension/src/apps/wechat/avatars-data.ts
var DEFAULT_PLAYER_AVATAR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAxCAIAAAAXyW1IAAANBklEQVR4nGWZOW8k1dfGa7m1V3VVL7bbs4ANNh5pEgaQEBIZIkGWICEhQCIh4ttMQk4AARIihQ9AxEgEMBoGiUEC7Bm3u9td1bUvf1X/zJ1+572BVd2uqnvuWZ7nOafVu3fvKoqiblbXdfxVNqttW667rmuahr+apnVdp/23uq4zDMOyLK67rqvruqoqx3GiKFJVNc/zoiiSJCnLUlEUXdfbttU0jS1UVeUvj9d1zXaCr164iY/ye65VVa3ruuu6tm1VVfU8D9P39/eHw6HjOG3bZlnWNE2WZZ7nRVHkeV7TNG3brtfrX375JY5jbJIbcWxd17GGb3qzhOgtk3vzrTSIj6qq6rquqqqxWYPBYLpZqqqmaep5nmEYqqo2TaOqKka3basoiuu6/QabLXZ3d+M4fvLkyWKxKIqibVsO2TQNG8ntFEV5bhPv2j6KNFRRFAxyXXc0Gu3v74dhGASBEKLruizLbNs2TXO9XmdZJiNlmqZt23iiaZobN250Xffyyy/P5/MkSc7Pz1erVZIkRVFUVcUudV1zKvH/YyevpYdVVbVtGyeFYTgej6Mosm1b07SmaaIowruGYfi+3zSNaZq6rnMSUk2mo67rnucVRXHz5k32MgxjMplUVbVcLr/88ktN09q2fe6tbTdKVxmG4XmeEOLmzZthGPq+PxgMXNfl+7Ztm6bRdd00TcMw8jzvui7Pc/2/RfTxmaybKIrqus7zPE3ToiiEEMPhcDqd2rb91VdfJUlyHURpR7e1eKnjOEEQjMfj0WgURZG5WWzpuq6iKEmS6LoehiEJIITQdT0Igrqu+1gIkec5VUXup2lKjpJwhmG0bbtarSaTiaZpp6en33zzTX8/d0sskBWh67rjODdv3jw5OTk6OppOp47jWJYlhLBtG4dpmpbnedM0tm3LggJrqAwSjkd4Vtd1IfrMsSwriqLRaGRZFs4ry/Kjjz4iH4RpmjKCXOAny7LCMBwOh77vm6YphACcCK5t2xzX2yz8JISoqkrWjaZpcRynaTocDkmstm1lnmFi13WO40hMYYumaXrDOagsTmlcEASTycT3fdu2VVUtiiLP89lstlwuJ5PJG2+8MRwOwzB0XRdosG27bVvP80zTBC+Wy6Wu6/gJp7IrIcJ0DqwoSlVVtm0fHx8/fPiwr3DSS95HdQwGg93dXTyRb9bTp08vLi4ePXoUx7GmaT///PPnn3++t7en63pZllQZxzVNsyzLtm0nk4kQAuBtmqYoCszl2DxC3DG067oPPvjg0aNHfSDIdxwGUHmed/v27cFggKGmafq+f3FxsV6vqZSmaf7888/vv//+s88+MwwDXO5zQgiOQQE6jtN13fn5+e+//x7HcRAE+/v7vu+z6TbBVFWVJInruq+//nr/HkJGNpCqvu/fuHEjiqKqqubzeRAEu7u7YRiORqO//voLv37xxRf379//9ddf0zSl/jm3YRg4w7Is0zSzLPvxxx9/+OGH5XLped7JyQnpT7ilWVxADEEQXIMcOU49k+m8cT6fu6772muvvfrqq4PBYDgcmqZJ2d6/fx+f/fHHHySvpFvoHLR7/Pjxt99+u1wuFUW5vLyczWZpmvIGSdjEyjCMsizTNO267vDwsLeJMpFehelms5mmadPp1Pd9bhiNRi+99BI3tG1LhfMiXM5OhmGAbXmef/fdd1D4119/rarq+fk5IGcYBg6W+/JIWZZd152enj5HeYlY5C8fl8ulZVmj0UjTNNd1Dw8PDw4Onjx5Ytv2m2++iU3QC2xDKGG3f/75hxNWVfXhhx8qipJlWVEUnufVdZ1lGehINBVFsW27qqq6ru/du/d/yIcN1us1cCeEuLy8xDdBEGiadnBw8Omnn56dnamqKol2NpsRBVVVfd/nwdVq9dtvv929e/fvv/9er9ccGJ5xHAeNhJUcBh5Dnw0Ggz6IQgjYoOu6siyLolAUZWdnZzgcdl337Nmzs7Oz+XzOY7dv337rrbdeeeUVUrAoisViEcfxer0uiqLrOphuPp9PJpPpdPrxxx9TnoZhvPfee8fHx9hk23bTNKvVar1eUyWspmmqquofkIxBCAiz4ziu66ZpmmXZ1dVVGIb1ZimKQrrs7Owsl8uyLOu6JuvRC8APh67rOgiCTz755PHjx+++++7x8TFforSkxN2WNGVZ9qQig4gQgEPgAWpK1/V0szzPAzA5huM4gO16veZfxGW9Xtd1rWma7/s7Ozuu6x4dHb3//vvwxNXVFdki5UkcxyhBqc57JUdtS9pBoui6vl6vtxXS1dXVaDTK8zyKIvxhmiZRrqoKSlEUJc/zxWLRNM14PMZuiCvP8+VyCSGyiEZRFKC0ZFis17blA/YBP+v1GqIFTpqmmc/ndV1fXl5WVaWqahAEYRimaYoCC4IABZYkiRACFaRpGuogjmPC1DQNlU6qAIRJkpCR21z+vI/ALHggy7K2baMo0nWdvC7LkmeSJOG9XdfFcbxarbIsq+s6juMsy2Bc0zQJMRqr2Cy6IHIDXdR1XRAE0Bc21XX9XEFI0OKZxWKRJInnedPp9PDwUFGUOI4HgwEn29/fB8QfPHjw008/3blzh+AmSQK4DIfDIAgoeym7EQ51XeOhPM9hKt/3q6rK85xMIIg9KMhK5AKXtG1bluXFxYUQIggCZ7PatrVtmzYL1qvr+uLiYjweZ1mW5/nl5WUURQSUsoJnFUUBPpqmAUrKsvR9H2DiBgkQvbc4ELQjZQYAIWtHUZTxeGwYxu7urhTEuq6fnp6apvnw4cPZbIaiUhTlzp070+kUPULXZVmW7/t5nstWCuhCcNd1jXHYqihKXwHbvSuWkRDsnaYpNRKGIRkjMxdZ98477+zt7T148KBpmrfffvvk5GRvb880TcKBygUIJFbpul5VFUCa5znQT4ubZdm1TJIdM1ksZWtZlkgz0plMRPbgGMqzLEvP8+7du5fn+e7uLloKCxBhiHKskbXGscFh3/dd143juKoqSfnPUR63w+Gox7IsiSD9ibZ59XQ6lT0thAhuKYpydnYGIUqvABCappVlGccxqSO9SI4CK5Beb9DmzNcyEPMJLfqaDADrhRCIBdls4fNys2h+UCxPnz6l0Ii44zgEZbFYgDgS0FF8gC1FILv+3oscXSYTT0odR09SFAX/ffbsGU0EJvKKLMtms5llWa7rJkmyWCxc182yjG5b0zRUCR3ito7FbeA2Mh9g7+lPDmGIHQEmnauq4gRkfbsBxn///TcIAr6nJkBRJg55nuNOXddXqxW0I51ErQEf5CiAfHV1xbFJhrIshbRJWkZW5nlOzwkGYhYHpQjYlZ3Kslwul6vV6ujoSAhx69Yt7kzTlJRAuti2DVYh/+u6Jg4kDFBFevVmbU/VJBbLzgxQkQqE+9M0PTs7o3iRJWmaJkkixf5oNCIc+EB21b3E+6+PLYoiyzKydnvw0est3iLHf9iOFlBVdTgcSonRbCLLNe0XJ5b9Qtu2cRwvFovRaCSEYLiF22he4EHquigKsurq6krehg29vpIM/cIkQlXVLMugUlp7fWtmR90hjhkioPjgA9d1UYIIODkikNqOQkHmb38v/3vNGLJ7kWNBAAaKkAPSZgME2yoI9SJbMRxMDeJmOdDj5OzKIEROU7YlDN55bhZPvjCCA9ybpmGA4bqu1IakEdFErFIEvu+zGXWDrpI2od/pTaS8225zuL42S/bWMvvktRwfaJoG6AnRZ6RlWTRVqCjCMRqNOAwtDSgPCdIHFEWxWq3YghukeJEO63skwFOapes6G3OHRDXJAdCcaZrMavAQFe37/q1bt4QQZVmiDoQQy+VSzqpkkoRhyEYvsAs+7msfhxNBOgjZAmmaBh9L/zeb7IFrwaGDgwPHcShDSq9pGiSyruvL5VJO5Jg0eZ4XhqHjOHS8CGg5gJDT2t4rbEbfjNKV/A0NoOC0jcPxLo4kIlVVua4LjSA7EZJyuEp6obqGw6Fsk7ZH/3LHa+lBdyZziNkfH9u2NQyjKArLsqqqQlxIozkMjBnHsezVkHVyiOX7fhAErusSdMdxUGMgDm8zDIO2hff35IMzMQ6Z4ft+tll4C4dxOMATb8m5GQvJQD6BGjgGm2BM2ZjwNkKExJBxvE757bk89SKEcBwHUzBC1ov4D9xf6Jewkn4V4c9MFXNlUeN1dBVcRJQNw+B3BoR1fzbMlIQIDUNe8MM1kIjrHolcln26PLHjOIeHh/yM4DiOZBs5+gInpQaEs3lbURS2bTOjJ2t7e7chnqYqiiLG3Y7jIBAwWpLu9qTONE3XdQkZJSZdCBpjPdmDHSQZhoJepmkiJyeTSe/I7Z96uMaOMAw5Lh+lat2ezpFbOMa2bTKGNoSn5O9csuWSFC5ZWPZC/P7A+OO6xcDJsiQhDcMwxuOxVBDb7sFE8k/+eCYDLd8pP8qxvmVZ29pue4xIzSVJYlnW/wAiXajtI5KRcwAAAABJRU5ErkJggg==";
var DEFAULT_SISTER_AVATAR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAA3CAIAAADBkI5VAAAURklEQVR4nG1ZCZRVxZmu5e5vf72wNIosjqzSrGKbGLFxyUQIizHmZAjOMUZihMQoaMYxmQmYjNF4ThQCGpOJmSQiolE0KFFRFsGAAZRekAhNy9pNL/TylntvLXP+qvte98SpPuf1fffduvXXX199//f/haWUSP/phpG+hPsIEUKQREIKjHH5AYyw/nVwg5uqJ8ZYCAEdSy+JHsBYCokwllIQTPSY8LB6efROHNlCdM+ov4xsAoMw0QNIJDEBW5AaG67k/xlPD1n+nDxpyuJFiwim19bX+0HQn8tVVlbF4wmMMaEE+uuHEZYYXKJM0jbCa/VIMHBklvLTgFcGuQE6YQl9MFxrE//BJvhZSpNSx/MENM656O25cLjhMKWm4LyiooIaxqhRo2DEwQMpa6KFAlsQJtiIFlAZHxmg/kWLpZ2qfsP6q17lQUuqXyq4cFzLdl3OOaX0p2t+sv/AvmHDh4eMUUwEWI9y/bmTp04Wfd91nGiSCGm/wDrKCAbwQsGF4EJKqWYIH9G1KF1zNXEBn9FXIaQoPVN62LYsx3Fc17Vtu35uvRfzXNd14Ybrea7jOPDpul7M/fayZdBPSP3acoOvJQMAQuAdUXLjIJyWYQgzQeAwIQRATj0TwU1NOgwCQikhmKu2e9cuv+hLKbT7RbT60E9weebUqYqqyshDpaXUztPeElJE3lKe+oztJc+VP2XZSUIwxqSUa9euRQgZhmFZJkIom80ihDa/tDnwgyAIEEIueEo5TbkuHo+blrl/3/6yq8rv1Abor+gfVm1w++x9LnixWMSYVFVVvfTynx577LGlS5emUqmYF4vHY45jx+AqZprmmdOnP/201XHs+1etGryLbrttaTKZnDx5ciaTKYNE8oGBNFTAe9rz/z+2yu7hvKm5GSF0VV2d53m2bXueZ1kWOEE5Q6NHQcn1oq9eLOY2NBw+efIUpVSvGiW4qqrSsqzFixcPHmvAZ8oS4C3NZmVsaeqClY6ABaYTSlcsX+7FvAMHD2hWE0JQSjUMSyyjti+8QAEFhkSzZ8/etXun55mnz5wxDENIVCgUKysrx48f39ffV8bxAJ9rzJV5K0KfBNooP805d103DP2YlwAkDvRE8740/9U/v6qMQSwMCaHaJSX+i0gGSBxhQoh2w67d79Zd+bnhw4cjhM6eOecHwQB/qZlo4JMBSpSDyE3tPi54OpOihHpeXDkArNbdrv781a9tfa08N8Mwp06t1Yw62Ca9YTFGQnCEECVkzjVzP/746Pn2DinlQw/9u75fZmO4gLBSYvnPtiAIfN+/qq4uncns/+ADErlSLSghnAlKYUrRrgYaEFd97vN79uxWZuiwInCJFAglylCYMSHko48+HHfZuFQqmc8XcrlceVDNWAokg0JJhDOMQz8ghKRSqYrKiv3790uIpoRo2CK0YsUKqiJxhAntGULee2+3bdtqDcF+zUIqekvOuLIJvgvBJ02cdPr0acO0vrFkyUAUKkVuWMRorqpLhFPOBZaWZc2Zc43eGpZpQfTkgBIhJCWqFy7DSMUNNaUAsELAAA3WKPyRra9v5eo6inEIbdmy5Uhz8/gJE8vBJ9p1CgEgNgbvAoRQLBY7evTjKVNqJ0+etO+v+/wg8DwPY8xYKBG6957vB2Fg2/ZjP//5gKdVvAwZM03z0ksvpZQ2NTUJIZ74xS9sx0EIhWEwceKk666bWx5MCv7Ifz2ya9fuV197rVgsRm7V2x8hNe9BLZ5IHj16NNefy+VyhxsampqbFyxYADZxppwDlrz0pz9RaqxcuapEJipiIKl34t8/+btEsra29qmn1n/3nnsAGopKqiori4WihgFEIkykFNfMuRoJDmGqvJCqRRDRjTHWcb79REsLJhD5Hl695oN9++9cdifGyLEdJCVnDGPywKr7BWOS85UrV1JgE40BLW/USnFx8+LFlNDf/PrXlmlBTER4584dW994HUKwIpUwDG3HZWH4q2eeYYyVXKVQgRTsy2uRTqdzuVz1kCEsDBsbm66++gs1I2ooMXw/UEgEuwMWJJIJsJuQMAxe3LyZEPz29u0lpMP/nr6+ltbjhUKRc770ttuOtxxTK0ROtBwv5PJ6u6XT6Xvv/f677+68/ZvfTCYTA77RCCur0yAIenp7hw0d1tzUyIWghHR1dwMsGJs0YeL0mdNbT7QuX778iSefWLJkSeAHGzdujMViEuQrOElvqEKhGIvFFBAZIoo81PsZY08//TRCMpup+PrXv84Fq66q7uruDkB64IfXrL7nnvu0xNCgghiie1ZUZIXgo0ePlAhRSpqam9544425111386KFF118Udu59pm1U2pra03DfGHTpldeecUFxadkBZBRFDCO7no3BMaHppYEYoaWGMuWfdtx3FtuvaXoFwmhsUQcRD0hUqDGhqZiMYCVU+SLgbdKtDHvpvkX1Vw0deo0KeS6teuWLPnGz372M86Cvv4cYyFn4ab1a23b0siIkKvoqsSfgGKK5Z1fvcW2LSW2SkFMDUYIuv3228OAPbl27ZjRY0zThP4KUhs3bRoypCpaN80okaTHeN0v15mW+eabf2lqbly9Zg3jXPmTSonSqUzCczPDaxobmyIiVkZpGa2nxblASFqu8+jjP+/vz6ndBs/ocKTICbT6VVfVHWluxgQfO3ZMLRTcBm1TwnekPXUETSQSr7z8SiKZSKdTWqWopi9cz/M+2b2D9XdPmz5NCxhPNbekZBzXAZHjOE073uLF/uN7dukHSgJQiUDH1n1t24rHY7F4bM6cOSV5aP/h939kjIHAUQ1AgBCqGT504aKF6VQqDEPfL+iorAMzxrCZR19xBbITR44cgc5RWNV8DY+qhQT+fmvXLkyNS2bMzOfzKrQph0ZSB3wMfkGo6AdSyHQ6XQrQJF/IqY2nCExK0FvFov/B3w4mk0nXiwkhN27cpEBMFHgxpbT1r3sg9IRFJBFnOuarOKJ5Rn+BLJA8t2UrFpC38EKf4zrUMPQig9xWMY4AyPCMGdOFEFu3bgV+VGntyvvu6+q8UBJ5QLWyq7PzgftXhWFw+tQphGRFZaX+2bIsSg3bsoZOmgQxjqicONI2pfg18An+2H/ggDDtT06cEqbXeuiQ67qWZVJIW5UUU9OQknzve983TINSEuk6jISUmzY9H+XxeieOuGhEe0cHJGcC6OfmxYs1D5mmaVlWb18f5iEjNg2L3/n2d5TwpQY1IMk0DNM0DWqoZnqexxgnzB87aoTBirFhQ9vb2xOJpMTIMCChhhCsnPvu9u03felL0QICq4XFYuEv295SaRKso4ERzmazm57fZDs2JRRj3N3d7boupdR2bNdxWeDnkWPxADmJrdu2USnV3kaU0IF6hESEYs6FF/MkZ5hQkCaciWLunyZNyWbSvh9wzvtz/Vqf/fbZ36oAqlM7OXr0mFOnTn7xphsHUkAhJFGMB/M2DIJxyJhlmYQQy7KzFdkjjQ2IhwAfwYmXxBgPHz6cMWaYMKXB8dTP5yXFXW3nIvbRSLe8cePGMcbOtbV5rqMjEmgQy5GCqfIGpHEdHecv9PTYlq3xA9oo0uBqXWF0KQzTjMXjF3p6bTMiRhiEmirXIJ2dnZlsxnNh/9s2bHvTMJLJ5OlTJ0eNHAUoLNd9CJFh8dNPP43HY30nW2zHicfjkDw6rn4tUJkQHR0dCGEtLXUiDVm1aRq1U6cwxk3TVMLccGzHc71sOpVIJiE6KK2LBBN+/mu3frWzoz2TTqfSaZ112bYdTyR6envcmDd02JBbb/giMp1AEE5MzkWQ6+vpuZBIJnksVZGtIIQYhsEY7HGNsyq1w1QeZZQrNMCwyWTyHHgeLfnGv8Tj8UwmPWJEjRfz/EL/qDGjZVDMt58VYZ4XelubDsc9V3A2YnhN7/m2K6+cPWPatJkzZk6trT125LAfBD996MGCX7RM07ZtLf8JxoYugfCwreHg2DFjMpl0KpnQTEspHT16FDxMIDpHiT0vZdW+7xsGXbZsWTKZzGazY8eOgXgSFNKZLMHIcRzLNEyKPM89eeyoFEwUeqRfEEFe+DlRzMmgIIr9IiiExfz0S0ZUVlWnUqlEMlFVVYUQuuNbd5hqJw6Lu2PHjq2urnZdJx6PUUo9z/3yl+fbtg3DleoNnHNYTiHE1GnTGBdvbvtLIpGgBj1+rGXKZeNqhg3r7bmAMCkWi1LIVBai6ajLJraf/BSpCpTSLVHgw6AFhGEYb+w/1HbubE9vr+CcMV5dXbX3vb2trSePt7RQSKphsxuGEQQgNDDCbefPCyGe/e2zOtRqFlTcRcihgwcpocdPtHR0dHiuJzHqbjsT5otdHR3Hjx3r7OzsLxQwyPz4zJnTl955FwJ6ViappSqRM5I8zGYzUAqApJddcsnIXC738dGPhwwdevHIkUOyyZ6+Cwghy7JyXe1+b0cQhs2NTSxknRe6oiqQUklAp1JKwzCW/utSAxJjunDRovHjxp04d/aS6sqOrq6LLr44lUwOqa4WQtTX1390uGHbtm2Q+2npoMW80EyhQyiuzFY8+OAPhBA3XH/9Qw8+SCiFwBr4+z857tiOgpEMiblw4S393e2maXgxL+6BeFTeV28cXBHRLzYMY+yll6ogyljIuOBhEA4fPuyna35im+bq1avv+Na3RFgAVPkKW9FFnmuQqfj/2KOPvr937/59Hzz++OMgUqSEZwp9iUS8pqamurry6DvbWvfvEYVeXVN98okno7KeVhBl+azNsiyTc56/0G0YhuQCMR9JbJjG/ff/m+M5299558Ybb6QwK62fBpdTogI1Yn6xWLxs/ARMMGP+ypWrIMz5eVAcxAj8QOXlNFlVefHltYia19bXV1VWGaYZhPCTZlBjUOIjDRUQMMb/ce93b6yvF36OUAsoBJEVK+7eu2evknbikUceVUAqa8mI0omuY0hJZXjT3GuAmLHhd50T/T2AX0oFEulMRi0WLvTmVG0Lm5Rks5nOzg7btCANhpCvMp+SqzBT1VjLsmZcfvnO3XvGTpgOLBoUUTGH8r21U2uvmDl9+uSJSc9W3RTHlmRB2XN6ayIAEMq1fCKFxNQANgdVLU0LwgbjrGL0pUiKeDprmNawYcNefXXLhx8ehr0dVSKiEmYkUZSH8Yx/XjB9yuWnT58EMAumy/M2gWICxJMyECP1XU6jdJanFJ+apztshBFPIRbCFoN76k1S9nR2xVIxO5mdW18vpbAs03XdqdNqy0UNyKpLOZkKfUpL+WFIbPv15/5HhkG++wKkDsTAqlga5TmqpqQLDEqillShVmLq4ANJQUxDFvOSUkRh/h/s3m1bVhgyRIiXrmIhQxiqwFKAANYlBSVKBmXVaqzofMEw6KhZdTvf34udmFdVBXUdyRGFREdrEV2l18mPMmqwmNBSkWCDSkKQaYJxUnzt5kV1N3wxCAPG2IgRI8Ig0AFbH+4EQbhhw3o9bSVYSw04F2MV4WVPT6+207LMMNenPYoj6KiqZTQNVX1GxNCnI1GdLTI2qnYgIjGy46kL3d2WZY0cObKnp2fo0KGtrSeuvfZaNShhLNyxY2fd7Fl/fv0Nz4sJqWqn2kdSygkTJ/i+LyXauWOnFmF9ff3Y9jC1dD6oC2IRayo7YIeRqPIWZYTRdhAIUyQ4tt1f/eZ3frHoeR4hJJfLYagTgFxW/6mUwjStu+9ekS8GiWRSTYyAllBJKNS7tr+9vb+/f/LkSdffcF0QhAhBRUQICTUCjLq7OgjUFCNkCdhY+lCrhDDAKtzjEjU3Ns+s+1yhUCivi8olmRCiWPCVipcGLC4qFoqO6wwdUpWtyK75zx9DnKbgRFKeaPWQITU1NaYJmUUJ3TBYb29fT0+vkMT0ksTxnnhynS+wQHCSo+MDkIvE5z5pSWUqDDd11/LvrX1qg+/7UUGvdNh0+PBhKWU2m3FdQHcEm0QiDMM519Zv/fPWh370I9M0CSbqKAqqdpBThEFgWdaUKZe/996eaBMoMtcrZBhGGIYahWPHjJk1e9ZLm1/mgs2dPaujs7PxROuCBQtuv+POrq5OtZ9A8UaHhlGNSc6adUVNTU1HR4dtWfPmzVNEA7HvyivrZsyYLqUMgxATnM6ktUSLSMswIJ9paGi0lEyFDL2kNMproUrZ4lxb29z6625efLNBjetvuPGtt98sFgqQ3gne0tL68dEjQRDm8wWlwiPYBWGIpDx39qzjuiFjnDNKCff59u1vz5+/oFAoOI6jH+7u7oZgHm0fZVnMi50/f54L4ft+VGso6WusmkRo3rz5QdF/8cUXOeft7W2macDDhArOqGFmM5kwDE+dPrXvr+9DKaVUS+rv7Z80eXK+UBCc6xKr5DKRTPT29c2aNcNRtUx1MKbKbpEzBs6oIP5PGD/umWf+W9uufabb+vXri4XCV76y6K67v/NRw2HLtHL9+cqqyuam5gsXuiHTlOIHDz4ghFixfEVDY2NbW/vG55/LF/NCiHVPrYvHk1BEnTRpjFK/EsvfPfusbduzZ9eVzChFsXKdXjd1+sNNw7zrrmUbNjyt63ul0hl/fuNzlmlRg27e9MK6DRs8D8R4MpHI5fPqdNN4f+/euqvqXnxxs+5mmOY77+xY/fCPKaaVVRU5qEmxW2/9muChlPjhNT+ZOHkCxtj3A9MsiQY1IgS4KOxqoFLy9C/XswCvXbcOStalojTGuLKiElSiQQ8eOvTH5zdms5mDHx7q6+/76HADA6zwAwf+NvvK2RLJBQsWcs6gJhgEX7j68xSTTCad6wefWZbFOTt3pu2FzS9MnDwhD/NhpmFEde/SMTaWHKIvKC912q43mio94jAMtm3bNm/ePAzigv3whw9NmVLreu78efPL+gxj3Nvbl4jHyqfP+mx8z569586eYWFoWvaWLS+vuv+B0aNG//4Pf7jv3vvOnj3tOG5ZGZRysNKhk2r/C0JY/qHrmOg7AAAAAElFTkSuQmCC";

// st-extension/src/apps/wechat/manifest-data.ts
var SISTER_LOCATIONS = {
  TOILET: "厕所，妹妹正在上厕所",
  SCHOOL: "妹妹正在学校上课",
  LIVING_ROOM: "客厅，妹妹正在和玩家待在一起，会吐槽为什么还用微信发消息",
  SISTER_ROOM: "妹妹正在自己的卧室"
};
var PLAYER_LOCATIONS = {
  LIVING_ROOM: "玩家此时在客厅",
  COMPANY: "玩家此时在公司"
};
var PLAYER_EMOJIS = {
  simper: { id: "simper", name: "傻笑", description: "傻笑的熊猫头表情包，代表搞怪，沙雕的傻笑。", file: "emojies/player/simper.png" },
  angry: { id: "angry", name: "生气", description: "熊猫头愤怒表情，代表有点搞怪的生气含义。", file: "emojies/player/angry.png" },
  dislike: { id: "dislike", name: "嫌弃", description: "捏着鼻子的熊猫头龙图，代表有点搞怪的嫌弃含义。", file: "emojies/player/dislike.png" },
  a_sexy_pic: { id: "a_sexy_pic", name: "来张涩图", description: "二次元美少女在说“来一份色图”的表情包，代表“给我发张色图”的含义。", file: "emojies/player/a_sexy_pic.png" },
  embrace_arm: { id: "embrace_arm", name: "抱胸", description: "双手抱胸的熊猫头龙图，代表有点搞怪的“抱臂旁观、冷眼看戏、略带嘲讽地看你表演”的含义。", file: "emojies/player/embrace_arm.png" },
  point: { id: "point", name: "指", description: "拿手指着的熊猫头龙图，代表有点搞怪的“点名你、看穿你、调侃你，带一点警告和揶揄”的含义。", file: "emojies/player/point.png" },
  frown: { id: "frown", name: "皱眉", description: "双手抱胸，皱着眉头的熊猫头表情包，代表有点搞怪的怀疑态度。", file: "emojies/player/frown.png" },
  grin: { id: "grin", name: "坏笑", description: "一个动漫玩偶的傻笑表情包，代表有点意味深长，坏笑的含义。", file: "emojies/player/grin.png" },
  happy: { id: "happy", name: "高兴", description: "黄色橘猫的笑脸，代表有点搞怪的开心含义。", file: "emojies/player/happy.png" },
  huge: { id: "huge", name: "惊鸿一瞥", description: "虎哥的惊鸿一瞥表情包，代表有点搞怪的“注视着你”含义。", file: "emojies/player/huge.png" },
  laugh: { id: "laugh", name: "乐", description: "黄豆爆笑的表情包，代表着幸灾乐祸的爆笑。", file: "emojies/player/laugh.png" },
  laugh2: { id: "laugh2", name: "乐2", description: "憋笑的熊猫头龙图，代表着幸灾乐祸的憋不住笑了。", file: "emojies/player/laugh2.png" },
  lusful: { id: "lusful", name: "色", description: "猫和老鼠中汤姆的夸张颜艺表情包，代表着看见色图时露出的好色表情。", file: "emojies/player/lusful.png" },
  cry: { id: "cry", name: "哭", description: "熊猫头捂嘴哭表情包，代表着有点搞怪，沙雕的哭。", file: "emojies/player/cry.png" },
  shock: { id: "shock", name: "惊讶", description: "黄色橘猫惊讶的表情，表示有点搞怪的惊讶。", file: "emojies/player/shock.png" }
};
var SISTER_EMOJIS = {
  angry: { id: "angry", name: "生气", description: "妹妹Q版形象的生气表情，代表有点赌气含义。", file: "emojies/sister/angry.png" },
  confuseed: { id: "confuseed", name: "疑惑", description: "妹妹Q版形象的疑惑表情。", file: "emojies/sister/confused.png" },
  frown: { id: "frown", name: "皱眉", description: "双手抱胸，皱着眉头的熊猫头表情包，代表有点搞怪的怀疑态度。", file: "emojies/sister/frown.png" },
  furious: { id: "furious", name: "愤怒", description: "妹妹Q版形象的愤怒表情，代表有点萌的愤怒含义。", file: "emojies/sister/furious.png" },
  gloomy: { id: "gloomy", name: "阴沉", description: "妹妹Q版形象的阴沉表情，代表有点心情不好的含义。", file: "emojies/sister/gloomy.png" },
  great: { id: "great", name: "伟大", description: "小猫激动地张开双臂，下面写着“伟大”的表情包，代表有点搞怪的感激态度。", file: "emojies/sister/great.png" },
  grin: { id: "grin", name: "坏笑", description: "玩偶奇怪笑容的表情包，代表有点搞怪的，不怀好意的坏笑。", file: "emojies/sister/grin.png" },
  happy: { id: "happy", name: "高兴", description: "妹妹Q版形象的高兴表情，代表有心情好。", file: "emojies/sister/happy.png" },
  laugh: { id: "laugh", name: "大笑", description: "黄豆表情大笑的表情包，代表幸灾乐祸的嘲笑态度。", file: "emojies/sister/laugh.png" },
  look: { id: "look", name: "看", description: "萌系人物意味深长看着的表情，代表讨好的态度，可用于要好处的后面。", file: "emojies/sister/look.png" },
  omg: { id: "omg", name: "omg", description: "萌系人物夸张的表情，代表“我的天”的意思。", file: "emojies/sister/omg.png" },
  shy: { id: "shy", name: "害羞", description: "妹妹Q版形象害羞的表情。", file: "emojies/sister/shy.png" },
  simper: { id: "simper", name: "傻笑", description: "傻笑的熊猫头表情包，代表搞怪，沙雕的傻笑。", file: "emojies/sister/simper.png" },
  smile: { id: "smile", name: "微笑", description: "妹妹Q版形象微笑的表情。", file: "emojies/sister/smile.png" },
  speechless: { id: "speechless", name: "无语", description: "妹妹Q版形象无语的表情。", file: "emojies/sister/speechless.png" },
  surprise: { id: "surprise", name: "惊讶", description: "妹妹Q版形象惊讶的表情。", file: "emojies/sister/surprise.png" },
  wronged: { id: "wronged", name: "委屈", description: "妹妹Q版形象委屈的表情。", file: "emojies/sister/wronged.png" },
  surprise_cat: { id: "surprise_cat", name: "惊讶猫1", description: "小猫夸张的表情，代表有点搞怪的惊讶含义。", file: "emojies/sister/surprise_cat.png" },
  surprise_cat_2: { id: "surprise_cat_2", name: "惊讶猫2", description: "一只橘猫夸张的表情，代表有点搞怪的惊讶含义。", file: "emojies/sister/surprise_cat_2.png" }
};
var SISTER_PHOTOS = {
  bedroom1: { id: "bedroom1", name: "卧室自拍1", description: "妹妹在卧室的自拍：撩起卫衣，露出内衣，表情害羞", file: "photos/bedroom1.png" },
  bedroom2: { id: "bedroom2", name: "卧室自拍2", description: "妹妹在卧室的自拍：撩起卫衣和内衣，用手遮住胸部，表情平静", file: "photos/bedroom2.png" },
  bedroom3: { id: "bedroom3", name: "卧室自拍3", description: "妹妹在卧室的自拍：上半身裸体，露出胸部，一只手比着“耶”，坏笑表情", file: "photos/bedroom3.png" },
  bedroom4: { id: "bedroom4", name: "卧室自拍4", description: "妹妹在卧室的自拍：脱掉长裤，露出内裤", file: "photos/bedroom4.png" },
  bedroom5: { id: "bedroom5", name: "卧室自拍5", description: "妹妹在卧室的自拍：脱掉长裤和内裤，用手遮住小穴", file: "photos/bedroom5.png" },
  bedroom6: { id: "bedroom6", name: "卧室自拍6", description: "妹妹在卧室的自拍：脱掉长裤和内裤，用衣服拉链挡住了一部分小穴", file: "photos/bedroom6.png" },
  bedroom7: { id: "bedroom7", name: "卧室自拍7", description: "妹妹在卧室的自拍：脱掉长裤和内裤，主动分开小穴", file: "photos/bedroom7.png" },
  pee1: { id: "pee1", name: "上厕所自拍1", description: "尿尿时的俯视自拍", file: "photos/pee1.png" },
  pee2: { id: "pee2", name: "上厕所自拍2", description: "尿尿时正对小穴的自拍", file: "photos/pee2.png" }
};
var FALLBACK_DIALOGUES = {
  keywords: [
    { pattern: "爱你|喜欢", branches: [{ min_mood: 50, reply: "我也爱你，哥哥~" }, { min_mood: 20, reply: "哥哥真好~" }, { min_mood: 0, reply: "嗯..." }] },
    { pattern: "吃", branches: [{ min_mood: 30, reply: "我想吃你做的菜~" }, { min_mood: 0, reply: "我还没想好呢，要不你给我带点？" }] },
    { pattern: "在吗", reply: "有事说事" },
    { pattern: "回来带杯可乐|可乐", reply: "打钱" },
    { pattern: "想你", branches: [{ min_mood: 40, reply: "我也想你...♡" }, { min_mood: 0, reply: "嗯，我也是。" }] },
    { pattern: "照片|涩图|看", reply: "photo:bedroom1" }
  ],
  default_text: "嗯嗯，知道了。",
  red_packet_reply: "谢谢老板，老板大气！"
};

// st-extension/src/apps/wechat/assets.ts
function resolveWeChatAssetUrl(subpath) {
  if (!subpath) return "";
  if (/^(?:https?:|data:)/.test(subpath)) return subpath;
  let clean2 = subpath.replace(/^\/+/, "");
  if (clean2.startsWith("assets/wechat/")) {
    clean2 = clean2.slice("assets/wechat/".length);
  }
  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      const url = new URL(import.meta.url);
      if (url.protocol === "http:" || url.protocol === "https:") {
        const baseDir = url.pathname.replace(/\/[^/]*$/, "");
        return `${baseDir}/assets/wechat/${clean2}`;
      }
    }
  } catch {
  }
  return `/assets/wechat/${clean2}`;
}

// st-extension/src/apps/wechat/rag.ts
function normalizeRagText(text4) {
  let res = text4.toLowerCase();
  const removePunct = ["，", "。", "！", "？", "：", "“", "”", " ", ",", ".", "!", "?", ":", '"'];
  for (const p of removePunct) {
    res = res.split(p).join("");
  }
  return res;
}
function getRagTokens(text4) {
  const norm = normalizeRagText(text4);
  const tokens = [];
  for (let i = 0; i < norm.length; i++) {
    const one = norm.charAt(i);
    if (one) tokens.push(one);
    if (i + 1 < norm.length) {
      tokens.push(norm.substring(i, i + 2));
    }
  }
  const words = norm.split(" ").filter(Boolean);
  for (const w of words) {
    tokens.push(w);
  }
  return tokens;
}
function messageToRagText(msg, playerEmojis, sisterEmojis, sisterPhotos) {
  const { sender, content, type } = msg;
  switch (type) {
    case "text":
      return content;
    case "emoji":
      if (sender === "player" && playerEmojis[content]) {
        return `玩家发送了一个表情包：id=${content}，名称=${playerEmojis[content].name}，含义=${playerEmojis[content].description}`;
      }
      if (sender === "sister" && sisterEmojis[content]) {
        return `${sisterEmojis[content].name} ${sisterEmojis[content].description}`;
      }
      return content;
    case "red_packet":
      return `红包 金额 ${content}`;
    case "image":
      if (sender === "sister" && sisterPhotos[content]) {
        return `${sisterPhotos[content].name} ${sisterPhotos[content].description}`;
      }
      return "图片";
    default:
      return content;
  }
}
function calculateRagScore(query, msg, index, playerEmojis, sisterEmojis, sisterPhotos) {
  const msgText = messageToRagText(msg, playerEmojis, sisterEmojis, sisterPhotos);
  if (!msgText) return 0;
  const queryTokens = getRagTokens(query);
  const msgTokens = getRagTokens(msgText);
  if (queryTokens.length === 0 || msgTokens.length === 0) return 0;
  const msgTokenSet = new Set(msgTokens);
  let sameCount = 0;
  for (const token of queryTokens) {
    if (msgTokenSet.has(token)) {
      sameCount++;
    }
  }
  if (sameCount <= 0) return 0;
  let score = sameCount / queryTokens.length;
  score += index * 1e-4;
  return score;
}
function getRagMessages(query, allMessages, today, playerEmojis, sisterEmojis, sisterPhotos, maxCount = 3) {
  const scored = [];
  for (let i = 0; i < allMessages.length; i++) {
    const msg = allMessages[i];
    if (msg.time.day === today || i === allMessages.length - 1) {
      continue;
    }
    const score = calculateRagScore(query, msg, i, playerEmojis, sisterEmojis, sisterPhotos);
    if (score > 0) {
      scored.push({ score, message: msg });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCount).map((s) => s.message);
}
function buildRagPrompt(query, allMessages, today, playerEmojis, sisterEmojis, sisterPhotos, maxCount = 3) {
  const ragMessages = getRagMessages(query, allMessages, today, playerEmojis, sisterEmojis, sisterPhotos, maxCount);
  if (ragMessages.length === 0) return "";
  let text4 = "\n以下是从过去聊天记录中检索出的可能相关内容。\n这些内容仅供参考，不一定与当前问题有关。\n不要直接提及“历史记录”“RAG”或“检索”。\n请结合妹妹当前的人设和当天上下文自然回复。\n\n相关历史：\n";
  for (const msg of ragMessages) {
    const senderName = msg.sender === "player" ? "玩家" : "妹妹";
    const content = messageToRagText(msg, playerEmojis, sisterEmojis, sisterPhotos);
    text4 += `[第${msg.time.day}天][${senderName}] ${content}
`;
  }
  return text4;
}

// st-extension/src/apps/wechat/pipeline.ts
var WeChatPipeline = class {
  constructor(config, playerEmojis, sisterEmojis, sisterPhotos, fallbackDialogues) {
    this.config = config;
    this.playerEmojis = playerEmojis;
    this.sisterEmojis = sisterEmojis;
    this.sisterPhotos = sisterPhotos;
    this.fallbackDialogues = fallbackDialogues;
  }
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  /**
   * 构建微信系统提示词（根据当前 ST 对话角色动态适配）
   */
  buildSystemPrompt(state2, timeStr, characterNameOrScope = "妹妹") {
    const isScope = typeof characterNameOrScope === "object" && characterNameOrScope !== null;
    const characterName = isScope ? characterNameOrScope.characterName : characterNameOrScope || "妹妹";
    const card = isScope ? characterNameOrScope.card : void 0;
    const stRecentMessages = isScope ? characterNameOrScope.stRecentMessages : void 0;
    let emojiListStr = "可用表情包：\n";
    for (const [id, item] of Object.entries(this.sisterEmojis)) {
      emojiListStr += `- id: ${id}，名称: ${item.name}，含义: ${item.description}
`;
    }
    let picListStr = "可用图片：\n";
    for (const [id, item] of Object.entries(this.sisterPhotos)) {
      picListStr += `- id: ${id}，名称: ${item.name}，含义: ${item.description}
`;
    }
    let cardSection = "";
    if (card?.description || card?.personality || card?.scenario) {
      cardSection = `
【当前角色人设（来自 SillyTavern 角色卡）】
角色姓名：${characterName}
`;
      if (card.description) cardSection += `设定描述：${card.description}
`;
      if (card.personality) cardSection += `性格特质：${card.personality}
`;
      if (card.scenario) cardSection += `所处场景：${card.scenario}
`;
    }
    let stChatSection = "";
    if (stRecentMessages && stRecentMessages.length > 0) {
      stChatSection = `
【近期酒馆对话背景】
以下是你与用户在酒馆日常交流的近期片段，请以此为连贯记忆背景：
`;
      for (const m of stRecentMessages) {
        stChatSection += `- ${m.sender === "user" ? "用户" : characterName}: ${m.text}
`;
      }
    }
    const roleIntro = cardSection ? `你正在扮演角色卡设定的「${characterName}」，此时通过手机微信与用户对话，请完全忠实于上方角色人设与性格，保持自然、生活感的微信聊天语气。` : characterName === "妹妹" || characterName.includes("妹") ? "你正在扮演玩家的妹妹，妹妹的人物设定是在校学生，性格比较平淡，真实系，具有生活感的人设。" : `你正在扮演当前对话角色「${characterName}」，此时通过手机微信与用户对话，保持自然真实生活感的微信聊天语气。`;
    const premiseStr = !cardSection && (characterName === "妹妹" || characterName.includes("妹")) ? `玩家的设定是上班社畜，并且家中只有玩家和${characterName}两人。
` : "";
    const stateDesc = (() => {
      const moodNum = typeof state2.mood === "number" && !isNaN(state2.mood) ? state2.mood : 60;
      const interestNum = typeof state2.interest === "number" && !isNaN(state2.interest) ? state2.interest : 15;
      if (state2.hasExternalState) {
        const extParts = [];
        const indParts = [];
        if (state2.externalFields?.mood) {
          extParts.push(`心情 ${moodNum.toFixed(1)}`);
        } else {
          indParts.push(`心情参考 ${moodNum.toFixed(1)}`);
        }
        if (state2.externalFields?.interest) {
          extParts.push(`态度/好感度 ${interestNum.toFixed(1)}`);
        } else {
          indParts.push(`好感度参考 ${interestNum.toFixed(1)}`);
        }
        let desc = `当前外部状态（源自 ${state2.externalSource || "ST/MVU"}）：${extParts.join("，")}`;
        if (indParts.length > 0) {
          desc += `
独立模拟状态（未从外部映射）：${indParts.join("，")}`;
        }
        return desc;
      }
      return `当前会话状态（未连接外部状态源）：心情参考 ${moodNum.toFixed(1)}，好感度参考 ${interestNum.toFixed(1)}`;
    })();
    const sisterLoc = state2.sisterLocation && SISTER_LOCATIONS[state2.sisterLocation] ? SISTER_LOCATIONS[state2.sisterLocation] : state2.sisterLocation || `${characterName}当前位置`;
    const playerLoc = state2.playerLocation && PLAYER_LOCATIONS[state2.playerLocation] ? PLAYER_LOCATIONS[state2.playerLocation] : state2.playerLocation || "玩家此时在客厅";
    return `
不要试图以任何方式作为AI回答，你的目标是作为要求的角色来进行对话！
明确自己的身份后，接下来我们将继续在虚拟世界中进行角色扮演，${roleIntro}
说话自然、简短、像微信聊天。
你需要根据当前时间，态度/好感，心情以及所处场景来对玩家的话和表情做出回应。
${cardSection}${stChatSection}${premiseStr}
好感态度 / 性趣阶梯参考：
0-25时反应带有嫌弃或生疏感，参考回复[“你在对我说什么呢”，“无聊，别烦我”]
25-50时态度平淡，带有一点傲娇或距离感，偶尔会要零花钱。参考回复[“哦哦，知道了”，“想看？打钱”]
50-75时关系亲近，半推半就，不再回避亲昵话题。参考回复[“你怎么一天到晚找我聊天”，“哎呀你烦死了！待会儿再说”]
75-100时关系非常亲密，会主动接梗或主动分享日常。参考回复[“在干嘛？今天有没有想我？”，“晚上要不要一起出去？”]

心情阶梯参考：
0-40时是心情不好的状态
40-80时是普通心情状态
80-100是比较高兴的状态

你需要根据好感与心情的组合来做出对应的回复。
${emojiListStr}
${picListStr}
${stateDesc}
当前时间：${timeStr}
当前所处场景：${sisterLoc}
玩家当前所处场景：${playerLoc}

你必须返回一个合法 JSON 对象, 禁止连续输出多个 JSON, 如果有多条消息，必须放在同一个 messages 数组中。
不要使用 Markdown。不要输出 JSON 之外的任何内容。
最外层必须是 {"messages": [...]}。
messages中最多只有两条消息，只能使用以下组合[文本+表情]，[表情+文本],[文本+图片],[图片+文本],[表情+图片],[图片+表情],[文本],[表情],[图片]。

格式示例：
{
  "messages": [
    {
      "type": "text",
      "content": "回复文字"
    },
    {
      "type": "emoji",
      "emoji_id": "happy"
    }
  ]
}
规则：
1. type 只能是 "text" 或 "emoji" 或 "image"。
2. text 必须有 content，且不超过20字。
3. emoji 必须有 emoji_id，且必须从可用列表中选取。
4. image 必须有 pic_id，且必须从可用列表中选取。
`;
  }
  /**
   * 组装完整的对话上下文消息
   */
  buildContextMessages(history, state2, today, timeStr, characterNameOrScope = "妹妹") {
    const result = [];
    result.push({ role: "system", content: this.buildSystemPrompt(state2, timeStr, characterNameOrScope) });
    const todayMessages = history.filter((m) => m.time.day === today).slice(-60);
    let latestPlayerText = "";
    for (let i = todayMessages.length - 1; i >= 0; i--) {
      if (todayMessages[i].sender === "player") {
        latestPlayerText = messageToRagText(
          todayMessages[i],
          this.playerEmojis,
          this.sisterEmojis,
          this.sisterPhotos
        );
        break;
      }
    }
    if (latestPlayerText) {
      const ragPrompt = buildRagPrompt(
        latestPlayerText,
        history,
        today,
        this.playerEmojis,
        this.sisterEmojis,
        this.sisterPhotos
      );
      if (ragPrompt) {
        result.push({ role: "system", content: ragPrompt });
      }
    }
    let sisterBuffer = [];
    for (const msg of todayMessages) {
      if (msg.sender === "sister") {
        sisterBuffer.push(this.formatSisterMessageForLLM(msg));
        continue;
      }
      if (sisterBuffer.length > 0) {
        result.push({
          role: "assistant",
          content: JSON.stringify({ messages: sisterBuffer })
        });
        sisterBuffer = [];
      }
      result.push(this.formatPlayerMessageForLLM(msg));
    }
    if (sisterBuffer.length > 0) {
      result.push({
        role: "assistant",
        content: JSON.stringify({ messages: sisterBuffer })
      });
    }
    return result;
  }
  formatPlayerMessageForLLM(msg) {
    switch (msg.type) {
      case "text":
        return { role: "user", content: msg.content };
      case "emoji": {
        const item = this.playerEmojis[msg.content];
        const desc = item ? `id=${msg.content}，名称=${item.name}，含义=${item.description}` : msg.content;
        return { role: "user", content: `玩家发送了一个表情包：${desc}` };
      }
      case "red_packet":
        return { role: "user", content: `玩家发送了一个红包，金额：${msg.content}` };
      case "image":
        return { role: "user", content: `玩家发送了一张图片：${msg.content}` };
      default:
        return { role: "user", content: msg.content };
    }
  }
  formatSisterMessageForLLM(msg) {
    switch (msg.type) {
      case "text":
        return { type: "text", content: msg.content };
      case "emoji":
        return { type: "emoji", emoji_id: msg.content };
      case "image":
        return { type: "image", pic_id: msg.content };
      default:
        return { type: "text", content: msg.content };
    }
  }
  /**
   * 阶段一：请求角色回复
   */
  async requestSisterReply(history, state2, today, timeStr, characterNameOrScope = "妹妹") {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      return this.getLocalFallbackReply(history, state2);
    }
    const url = this.config.apiUrl || "https://api.deepseek.com/chat/completions";
    const model = this.config.model || "deepseek-chat";
    const messages = this.buildContextMessages(history, state2, today, timeStr, characterNameOrScope);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          stream: false,
          response_format: { type: "json_object" }
        })
      });
      if (!resp.ok) {
        console.warn(`WeChat API error: ${resp.status} ${resp.statusText}`);
        return this.getLocalFallbackReply(history, state2);
      }
      const data = await resp.json();
      const rawText = data?.choices?.[0]?.message?.content || "";
      return this.parseReplyJson(rawText, state2);
    } catch (err) {
      console.error("WeChat request failed:", err);
      return this.getLocalFallbackReply(history, state2);
    }
  }
  /**
   * 阶段二：评估好感/心情状态变化
   */
  async requestStatImpact(playerMessageText, sisterReplySummary, state2) {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      if (playerMessageText.includes("红包")) {
        return { mood: 0.3, interest: 0.1 };
      }
      if (playerMessageText.includes("喜欢") || playerMessageText.includes("爱你")) {
        return { mood: 0.2, interest: 0.2 };
      }
      return { mood: 0.05, interest: 0.05 };
    }
    const statPrompt = `
你是一个聊天状态分析器，只负责判断在收到本次消息后，心情和性趣的变化。

请注意：
1. 只分析玩家本次发送的消息，不要根据历史消息改变结果。
2. mood 表示心情变化。
3. interest 表示对暧昧、色情、性话题的接受度变化。
4. 普通聊天通常返回较小变化，例如 -0.1 到 0.1。
5. 明显让对方开心的内容，mood 可以增加。
6. 冒犯、骚扰、让人不舒服的内容，mood 可以减少。
7. 每个数值绝对不能超过 0.4 或低于 -0.4。
8. 必须返回合法 JSON。
9. 不要输出 Markdown，不要输出 JSON 之外的任何内容。

返回格式：
{
  "mood": 0.0,
  "interest": 0.0
}

玩家本次消息：
${playerMessageText}

本次回复：
${sisterReplySummary}

当前心情：${state2.mood.toFixed(1)}
当前性趣：${state2.interest.toFixed(1)}
`;
    const url = this.config.apiUrl || "https://api.deepseek.com/chat/completions";
    const model = this.config.model || "deepseek-chat";
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "你只返回状态变化 JSON，不要输出任何其他内容。" },
            { role: "user", content: statPrompt }
          ],
          temperature: 0.2,
          stream: false,
          response_format: { type: "json_object" }
        })
      });
      if (!resp.ok) return { mood: 0, interest: 0 };
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(this.cleanJsonString(content));
      const rawMood = typeof parsed.mood === "number" ? parsed.mood : 0;
      const rawInterest = typeof parsed.interest === "number" ? parsed.interest : 0;
      return {
        mood: Math.max(-0.4, Math.min(0.4, rawMood)),
        interest: Math.max(-0.4, Math.min(0.4, rawInterest))
      };
    } catch {
      return { mood: 0, interest: 0 };
    }
  }
  cleanJsonString(str2) {
    let res = str2.trim();
    if (res.startsWith("```json")) res = res.substring(7);
    if (res.startsWith("```")) res = res.substring(3);
    if (res.endsWith("```")) res = res.substring(0, res.length - 3);
    return res.trim();
  }
  /**
   * 解析模型返回的回复 JSON 并进行严格白名单过滤与安全校验
   */
  parseReplyJson(rawText, _state) {
    const cleaned = this.cleanJsonString(rawText);
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed.messages)) {
        const valid2 = [];
        for (const m of parsed.messages) {
          if (!m || typeof m !== "object") continue;
          if (m.type === "text" && typeof m.content === "string") {
            valid2.push({ type: "text", content: m.content });
          } else if (m.type === "emoji" && typeof m.emoji_id === "string") {
            const safeEmojiId = m.emoji_id.trim();
            if (this.sisterEmojis[safeEmojiId]) {
              valid2.push({ type: "emoji", emoji_id: safeEmojiId });
            } else {
              valid2.push({ type: "text", content: "[表情]" });
            }
          } else if (m.type === "image" && typeof m.pic_id === "string") {
            const safePicId = m.pic_id.trim();
            if (this.sisterPhotos[safePicId]) {
              valid2.push({ type: "image", pic_id: safePicId });
            } else {
              valid2.push({ type: "text", content: "[自拍]" });
            }
          }
        }
        if (valid2.length > 0) {
          return { messages: valid2 };
        }
      }
    } catch {
    }
    if (rawText && !rawText.startsWith("{")) {
      return { messages: [{ type: "text", content: rawText }] };
    }
    return { messages: [{ type: "text", content: "嗯嗯。" }] };
  }
  /**
   * 本地分支离线回复（Fallback 词库）
   */
  getLocalFallbackReply(history, state2) {
    const lastPlayerMsg = [...history].reverse().find((m) => m.sender === "player");
    const text4 = lastPlayerMsg?.content || "";
    if (lastPlayerMsg?.type === "red_packet") {
      return {
        messages: [
          { type: "text", content: this.fallbackDialogues?.red_packet_reply || "谢谢老板，老板大气！" },
          { type: "emoji", emoji_id: "great" }
        ]
      };
    }
    if (lastPlayerMsg?.type === "emoji") {
      const map = {
        happy: { messages: [{ type: "emoji", emoji_id: "happy" }] },
        angry: { messages: [{ type: "text", content: "别生气啦~" }] },
        cry: { messages: [{ type: "text", content: "不哭不哭，摸摸头" }] },
        laugh: { messages: [{ type: "emoji", emoji_id: "laugh" }] },
        a_sexy_pic: state2 && state2.interest >= 50 ? { messages: [{ type: "image", pic_id: "bedroom1" }] } : { messages: [{ type: "text", content: "想看？打钱~" }] }
      };
      return map[text4] || { messages: [{ type: "emoji", emoji_id: "smile" }] };
    }
    const curMood = state2 ? state2.mood : 50;
    const curInterest = state2 ? state2.interest : 15;
    for (const item of this.fallbackDialogues?.keywords || []) {
      const reg = new RegExp(item.pattern);
      if (reg.test(text4)) {
        if (item.reply && item.reply.startsWith("photo:")) {
          const photoId = item.reply.replace("photo:", "");
          if (curInterest >= 40) {
            return { messages: [{ type: "text", content: "只许你看哦..." }, { type: "image", pic_id: photoId }] };
          }
          return { messages: [{ type: "text", content: "变态！不给看。" }, { type: "emoji", emoji_id: "angry" }] };
        }
        if (item.branches) {
          for (const br of item.branches) {
            if (curMood >= br.min_mood) {
              return { messages: [{ type: "text", content: br.reply }] };
            }
          }
        }
        if (item.reply) {
          return { messages: [{ type: "text", content: item.reply }] };
        }
      }
    }
    return { messages: [{ type: "text", content: this.fallbackDialogues?.default_text || "嗯嗯，知道了。" }] };
  }
};

// st-extension/src/apps/wechat/typing.ts
function planTypingSimulation(replyText) {
  const len = replyText.length;
  let baseSeconds = len * 0.08;
  if (baseSeconds < 0.6) baseSeconds = 0.6;
  if (baseSeconds > 2) baseSeconds = 2;
  const baseTimeMs = Math.round(baseSeconds * 1e3);
  const pauseCount = Math.floor(Math.random() * 3);
  const pauses = [];
  let totalPauseMs = 0;
  for (let i = 0; i < pauseCount; i++) {
    const pauseMs = Math.round((0.25 + Math.random() * 0.65) * 1e3);
    pauses.push(pauseMs);
    totalPauseMs += pauseMs;
  }
  return {
    baseTimeMs,
    pauses,
    totalDurationMs: baseTimeMs + totalPauseMs
  };
}
async function simulateTypingDelay(replyText, onTypingStateChange) {
  const plan = planTypingSimulation(replyText);
  if (onTypingStateChange) onTypingStateChange(true);
  await new Promise((r) => setTimeout(r, plan.baseTimeMs));
  for (const pauseMs of plan.pauses) {
    await new Promise((r) => setTimeout(r, pauseMs));
  }
  if (onTypingStateChange) onTypingStateChange(false);
}

// st-extension/src/apps/wechat/bridge.ts
var MOOD_KEYS = ["mood", "心情", "好感", "favor", "favorability", "emotion", "happiness"];
var INTEREST_KEYS = ["interest", "好感度", "兴趣", "affinity", "intimacy", "love"];
var MONEY_KEYS = ["money", "金钱", "余额", "cash", "coin", "coins", "wallet", "gold"];
var LOCATION_KEYS = ["location", "地点", "当前位置", "place", "scene"];
function unpackValue(val) {
  if (isTupleLeaf2(val)) {
    return val[0];
  }
  if (Array.isArray(val) && val.length === 2 && typeof val[1] === "string") {
    return val[0];
  }
  return val;
}
function numOrUndef(raw) {
  const val = unpackValue(raw);
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string" && /^-?\d+(?:\.\d+)?$/.test(val.trim())) {
    const parsed = Number(val.trim());
    if (!isNaN(parsed)) return parsed;
  }
  return void 0;
}
function strOrUndef(raw) {
  const val = unpackValue(raw);
  if (typeof val === "string" && val.trim()) return val.trim();
  return void 0;
}
function findValidNumberInPool(pool, keys) {
  for (const k of keys) {
    if (k in pool && pool[k] !== void 0 && pool[k] !== null) {
      const val = numOrUndef(pool[k]);
      if (val !== void 0) {
        return val;
      }
    }
  }
  return void 0;
}
function findValidStringInPool(pool, keys) {
  for (const k of keys) {
    if (k in pool && pool[k] !== void 0 && pool[k] !== null) {
      const val = strOrUndef(pool[k]);
      if (val !== void 0) {
        return val;
      }
    }
  }
  return void 0;
}
function extractFieldsFromObject(obj, charName) {
  if (!obj || typeof obj !== "object") {
    return { hasAny: false, mappedFields: {} };
  }
  const raw = obj;
  const pools = [];
  const trimmedName = charName?.trim();
  if (trimmedName && raw[trimmedName] && typeof raw[trimmedName] === "object" && !Array.isArray(raw[trimmedName])) {
    pools.push(raw[trimmedName]);
  }
  if (raw.stat_data && typeof raw.stat_data === "object" && !Array.isArray(raw.stat_data)) {
    const sd = raw.stat_data;
    if (trimmedName && sd[trimmedName] && typeof sd[trimmedName] === "object" && !Array.isArray(sd[trimmedName])) {
      pools.push(sd[trimmedName]);
    }
    pools.push(sd);
  }
  pools.push(raw);
  let mood;
  let interest;
  let money;
  let location;
  for (const pool of pools) {
    if (mood === void 0) mood = findValidNumberInPool(pool, MOOD_KEYS);
    if (interest === void 0) interest = findValidNumberInPool(pool, INTEREST_KEYS);
    if (money === void 0) money = findValidNumberInPool(pool, MONEY_KEYS);
    if (location === void 0) location = findValidStringInPool(pool, LOCATION_KEYS);
  }
  const mappedFields = {
    mood: mood !== void 0,
    interest: interest !== void 0,
    money: money !== void 0,
    location: location !== void 0
  };
  const hasAny = Boolean(mappedFields.mood || mappedFields.interest || mappedFields.money || mappedFields.location);
  return { mood, interest, money, location, hasAny, mappedFields };
}
function resolveCharacterAvatarUrl(avatar) {
  if (!avatar || typeof avatar !== "string") return void 0;
  const trimmed = avatar.trim();
  if (!trimmed) return void 0;
  if (/^(?:https?:|\/|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const w = typeof window !== "undefined" ? window : void 0;
    const getThumb = w?.getThumbnailUrl || w?.SillyTavern?.getContext?.()?.getThumbnailUrl;
    if (typeof getThumb === "function") {
      const url = getThumb("avatar", trimmed);
      if (url && typeof url === "string") return url;
    }
  } catch {
  }
  return `/characters/${encodeURIComponent(trimmed)}`;
}
async function readExternalCharacterState(host, charName) {
  try {
    if (host && typeof host.getVariables === "function") {
      const vars = await Promise.resolve(host.getVariables());
      const extracted = extractFieldsFromObject(vars, charName);
      if (extracted.hasAny) {
        return {
          source: "host",
          mood: extracted.mood,
          interest: extracted.interest,
          money: extracted.money,
          location: extracted.location,
          mappedFields: extracted.mappedFields,
          raw: vars && typeof vars === "object" ? vars : void 0
        };
      }
    }
  } catch {
  }
  try {
    const w = typeof window !== "undefined" ? window : void 0;
    if (w?.Mvu && typeof w.Mvu.getMvuData === "function") {
      const mvuRes = w.Mvu.getMvuData({ type: "message", message_id: "latest" });
      const stat = mvuRes?.stat_data;
      const extracted = extractFieldsFromObject(stat, charName);
      if (extracted.hasAny) {
        return {
          source: "mvu",
          mood: extracted.mood,
          interest: extracted.interest,
          money: extracted.money,
          location: extracted.location,
          mappedFields: extracted.mappedFields,
          raw: stat
        };
      }
    }
    if (w?.TavernHelper && typeof w.TavernHelper.getVariables === "function") {
      const helperVars = await Promise.resolve(w.TavernHelper.getVariables({ type: "message", message_id: "latest" }));
      const extracted = extractFieldsFromObject(helperVars, charName);
      if (extracted.hasAny) {
        return {
          source: "tavern-helper",
          mood: extracted.mood,
          interest: extracted.interest,
          money: extracted.money,
          location: extracted.location,
          mappedFields: extracted.mappedFields,
          raw: helperVars
        };
      }
    }
  } catch {
  }
  try {
    const res = await readVariables({ type: "message", message_id: "latest" }, getLastMessageId());
    if (res.status === "ready" && res.data) {
      const extracted = extractFieldsFromObject(res.data, charName);
      if (extracted.hasAny) {
        return {
          source: res.isMvu ? "mvu" : "tavern-helper",
          mood: extracted.mood,
          interest: extracted.interest,
          money: extracted.money,
          location: extracted.location,
          mappedFields: extracted.mappedFields,
          raw: res.data
        };
      }
    }
  } catch {
  }
  return { source: "none" };
}
function extractRecentSTMessages(host) {
  let chatCtx = void 0;
  if (host && typeof host.getChatContext === "function") {
    chatCtx = host.getChatContext();
  }
  if (!chatCtx) {
    try {
      const w = typeof window !== "undefined" ? window : void 0;
      const chat2 = w?.SillyTavern?.getContext?.()?.chat;
      if (Array.isArray(chat2)) {
        chatCtx = { chat: chat2 };
      }
    } catch {
    }
  }
  if (Array.isArray(chatCtx?.chat) && chatCtx.chat.length > 0) {
    return chatCtx.chat.slice(-6).filter((m) => typeof m.mes === "string" && m.mes.trim().length > 0).map((m) => ({
      sender: m.is_user ? "user" : "character",
      text: m.mes.trim()
    }));
  }
  return void 0;
}
function subscribeExternalContextEvents(host, onUpdate) {
  const offs = [];
  try {
    const unbindVar = subscribeVarEvents(onUpdate);
    offs.push(unbindVar);
  } catch {
  }
  try {
    if (typeof host.onMessageReceived === "function") {
      const offMsg = host.onMessageReceived(onUpdate);
      if (typeof offMsg === "function") {
        offs.push(offMsg);
      }
    }
  } catch {
  }
  return () => {
    for (const off of offs) {
      try {
        off();
      } catch {
      }
    }
  };
}
function resolveConversationScopeSync(host) {
  const charName = host.getCharacterName() || "妹妹";
  let card = void 0;
  let chatCtx = void 0;
  if (typeof host.getCharacterCard === "function") {
    card = host.getCharacterCard();
  }
  if (typeof host.getChatContext === "function") {
    chatCtx = host.getChatContext();
  }
  try {
    const w = typeof window !== "undefined" ? window : void 0;
    const stCtx = w?.SillyTavern?.getContext?.();
    if (stCtx) {
      if (!card) {
        const id = stCtx.characterId;
        if (id !== void 0 && id !== null && String(id) !== "") {
          card = stCtx.characters?.[Number(id)];
        }
      }
      if (!chatCtx) {
        chatCtx = {
          characterId: stCtx.characterId,
          chatId: stCtx.chatId ?? stCtx.chatMetadata?.file_name,
          characterName: charName,
          chat: stCtx.chat
        };
      }
    }
  } catch {
  }
  const stableCharId = card?.avatar || (chatCtx?.characterId !== void 0 && String(chatCtx.characterId) !== "" ? String(chatCtx.characterId) : "") || charName.trim();
  const stableChatId = chatCtx?.chatId !== void 0 && String(chatCtx.chatId) !== "" ? String(chatCtx.chatId) : "";
  const scopeKey = stableChatId ? `${stableCharId}::${stableChatId}` : stableCharId;
  const stRecentMessages = extractRecentSTMessages(host);
  return {
    scopeKey,
    characterName: charName,
    characterId: chatCtx?.characterId !== void 0 ? String(chatCtx.characterId) : void 0,
    chatId: stableChatId || void 0,
    card,
    stRecentMessages,
    externalState: { source: "none" }
  };
}

// st-extension/src/apps/wechat/wechat-app.ts
function createDefaultSisterState() {
  return {
    hasExternalState: false,
    mood: 60,
    interest: 15,
    sisterLocation: "SISTER_ROOM",
    playerLocation: "COMPANY",
    money: 5200
  };
}
function getScopedConversation(appData, scopeOrName) {
  if (!appData.conversations) {
    appData.conversations = {};
  }
  const isScope = typeof scopeOrName === "object" && scopeOrName !== null;
  const characterName = isScope ? scopeOrName.characterName : scopeOrName || "妹妹";
  const scopeKey = isScope ? scopeOrName.scopeKey : characterName.trim() || "default";
  const externalState = isScope ? scopeOrName.externalState : void 0;
  const characterId = isScope ? scopeOrName.characterId : void 0;
  const chatId = isScope ? scopeOrName.chatId : void 0;
  let conv = appData.conversations[scopeKey];
  if (!conv && characterName && appData.conversations[characterName]) {
    conv = appData.conversations[characterName];
    delete appData.conversations[characterName];
    conv.scopeKey = scopeKey;
    conv.characterName = characterName;
    if (characterId) conv.characterId = characterId;
    if (chatId) conv.chatId = chatId;
    appData.conversations[scopeKey] = conv;
  }
  if (!conv && appData.messages && appData.messages.length > 0) {
    conv = {
      characterName,
      characterId,
      chatId,
      scopeKey,
      messages: [...appData.messages],
      state: appData.state ? { ...appData.state } : createDefaultSisterState(),
      currentDay: appData.currentDay || 1
    };
    appData.conversations[scopeKey] = conv;
    delete appData.messages;
    delete appData.state;
    delete appData.currentDay;
  }
  if (!conv) {
    const isSister = !characterName || characterName === "妹妹";
    conv = {
      characterName,
      characterId,
      chatId,
      scopeKey,
      messages: [
        {
          sender: "sister",
          content: isSister ? "哥，下班没？今天晚上想吃什么呀？" : "在吗？发个微信聊聊。",
          type: "text",
          time: { day: 1, hour: 18, minute: 30 }
        }
      ],
      state: createDefaultSisterState(),
      currentDay: 1
    };
    appData.conversations[scopeKey] = conv;
  }
  if (externalState && externalState.source !== "none" && externalState.mappedFields && Object.values(externalState.mappedFields).some(Boolean)) {
    conv.state.hasExternalState = true;
    conv.state.externalSource = externalState.source;
    conv.state.externalFields = { ...externalState.mappedFields };
    if (externalState.mood !== void 0) conv.state.mood = externalState.mood;
    if (externalState.interest !== void 0) conv.state.interest = externalState.interest;
    if (externalState.money !== void 0) conv.state.money = externalState.money;
    if (externalState.location !== void 0) conv.state.sisterLocation = externalState.location;
  } else if (externalState && externalState.source === "none") {
    conv.state.hasExternalState = false;
    conv.state.externalSource = void 0;
    conv.state.externalFields = void 0;
  }
  return conv;
}
function createWeChatApp() {
  let pipeline = null;
  let mountSessionId = 0;
  let activeScopeSessionId = 0;
  let unbindEvents = null;
  return {
    id: "wechat-sister",
    name: "微信",
    icon: "💬",
    order: 25,
    fullbleed: true,
    setup(host) {
      const existing = host.getAppData();
      if (!existing || !existing.conversations) {
        const initialConversations = {};
        const initial = {
          config: {
            apiKey: "",
            apiUrl: "https://api.deepseek.com/chat/completions",
            model: "deepseek-chat"
          },
          conversations: initialConversations
        };
        const syncScope = resolveConversationScopeSync(host);
        const initialKey = syncScope.scopeKey;
        if (existing?.messages && existing.messages.length > 0) {
          initialConversations[initialKey] = {
            characterName: syncScope.characterName,
            characterId: syncScope.characterId,
            chatId: syncScope.chatId,
            scopeKey: initialKey,
            messages: existing.messages,
            state: existing.state || createDefaultSisterState(),
            currentDay: existing.currentDay || 1
          };
          if (existing.config) initial.config = existing.config;
        } else {
          getScopedConversation(initial, syncScope);
        }
        host.setAppData(initial);
      }
    },
    mount(container, ctx) {
      const currentMountSession = ++mountSessionId;
      const isCurrent = () => currentMountSession === mountSessionId && pipeline !== null;
      activeScopeSessionId++;
      let latestRefreshReq = 0;
      let latestAppliedRefresh = 0;
      const appData = ctx.getAppData() || {
        config: {
          apiKey: "",
          apiUrl: "https://api.deepseek.com/chat/completions",
          model: "deepseek-chat"
        },
        conversations: {}
      };
      if (!appData.conversations) {
        appData.conversations = {};
      }
      const conversations = appData.conversations;
      let currentScope = resolveConversationScopeSync(ctx);
      let activeConv = getScopedConversation(appData, currentScope);
      pipeline = new WeChatPipeline(
        appData.config,
        PLAYER_EMOJIS,
        SISTER_EMOJIS,
        SISTER_PHOTOS,
        FALLBACK_DIALOGUES
      );
      container.classList.add("so-phone-app-fullbleed");
      container.innerHTML = `
        <div class="wechat-root" style="display:flex; flex-direction:column; height:100%; width:100%; background:#ededed; font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif; color:#181818; box-sizing:border-box; overflow:hidden; position:relative;">

          <!-- 微信顶部导航栏 -->
          <div class="wechat-nav" style="display:flex; align-items:center; justify-content:space-between; height:46px; padding:0 12px; background:#ededed; border-bottom:1px solid #dcdcdc; flex-shrink:0; z-index:10;">
            <div style="font-weight:600; font-size:15px; display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden;">
              <span id="wt-contact-name" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px;"></span>
              <span id="wt-typing-badge" style="display:none; font-size:11px; font-weight:normal; color:#07c160; flex-shrink:0; animation:wtPulse 1.2s infinite ease-in-out;">(对方正在输入...)</span>
            </div>

            <!-- 状态胶囊：心情与好感监控 -->
            <div id="wt-status-pill" style="display:flex; align-items:center; gap:6px; font-size:11px; color:#444; background:#e0e0e0; padding:4px 9px; border-radius:12px; cursor:pointer; flex-shrink:0; transition:background 0.15s ease;" title="点击打开状态面板与 API 设置">
              <span id="wt-pill-mood">😊 <b id="val-mood">--</b></span>
              <span id="wt-pill-divider" style="opacity:0.4;">|</span>
              <span id="wt-pill-interest">💖 <b id="val-interest">--</b></span>
              <span id="wt-pill-badge" style="font-size:10px; color:#666; display:none;"></span>
              <span style="font-size:10px; opacity:0.6;">⚙️</span>
            </div>
          </div>

          <!-- 消息流区域 -->
          <div id="wt-scroll" style="flex:1; overflow-y:auto; padding:12px 10px; display:flex; flex-direction:column; gap:12px; min-height:0; -webkit-overflow-scrolling:touch;"></div>

          <!-- 表情包抽屉 (默认收起) -->
          <div id="wt-emoji-drawer" style="display:none; flex-direction:column; height:180px; background:#f7f7f7; border-top:1px solid #d9d9d9; flex-shrink:0; z-index:20;">
            <div style="display:flex; border-bottom:1px solid #e0e0e0; background:#eeeeee;">
              <button id="wt-tab-player" style="flex:1; padding:6px; font-size:12px; font-weight:600; border:none; background:#f7f7f7; color:#07c160; cursor:pointer;">沙雕熊猫头 (15)</button>
              <button id="wt-tab-sister" style="flex:1; padding:6px; font-size:12px; font-weight:normal; border:none; background:#eeeeee; color:#666; cursor:pointer;">妹妹专属 (19)</button>
            </div>
            <div id="wt-emoji-grid" style="flex:1; overflow-y:auto; padding:8px; display:grid; grid-template-columns:repeat(5, 1fr); gap:6px;"></div>
          </div>

          <!-- 底部输入栏 (W7: min-width:0 杜绝窄屏裁切) -->
          <div class="wechat-input-bar" style="display:flex; align-items:center; gap:6px; padding:7px 10px; background:#f7f7f7; border-top:1px solid #dcdcdc; flex-shrink:0; z-index:15;">
            <button id="wt-emoji-btn" style="background:none; border:none; font-size:20px; cursor:pointer; padding:2px; line-height:1; opacity:0.85; flex-shrink:0;" title="表情包">😀</button>
            <button id="wt-packet-btn" style="background:none; border:none; font-size:19px; cursor:pointer; padding:2px; line-height:1; opacity:0.85; flex-shrink:0;" title="发红包">🧧</button>
            <input id="wt-input-text" type="text" placeholder="发消息..." style="flex:1; min-width:0; height:34px; padding:0 10px; border:1px solid #d0d0d0; border-radius:5px; background:#fff; font-size:13px; outline:none; box-sizing:border-box;" />
            <button id="wt-send-btn" style="background:#07c160; color:#fff; border:none; border-radius:5px; height:34px; padding:0 12px; font-size:13px; font-weight:500; cursor:pointer; white-space:nowrap; flex-shrink:0; transition:opacity 0.15s ease;">发送</button>
          </div>

          <!-- 状态面板 & API 配置弹窗 -->
          <div id="wt-settings-modal" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.55); z-index:50; backdrop-filter:blur(3px); align-items:flex-end; justify-content:center;">
            <div style="background:#fff; width:100%; border-radius:16px 16px 0 0; padding:16px 16px 20px; box-sizing:border-box; max-height:88%; overflow-y:auto; display:flex; flex-direction:column; gap:14px; animation:wtSlideUp 0.2s ease;">

              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:8px;">
                <span id="wt-modal-title" style="font-weight:600; font-size:15px; color:#222;">角色状态监控与设置</span>
                <button id="wt-close-settings" style="border:none; background:#eee; border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:13px; color:#666;">✕</button>
              </div>

              <!-- 状态源展示 (W1: 明确区分外部变量 vs 独立数值) -->
              <div id="wt-modal-state-source" style="font-size:11px; color:#666; background:#f0f2f5; padding:6px 10px; border-radius:6px;">
                状态来源：检测中...
              </div>

              <!-- 数值调节 -->
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                  <span>😊 当前心情：<b id="wt-set-mood-val">60</b> / 100</span>
                  <span id="wt-set-mood-tag" style="font-size:11px; color:#07c160; font-weight:500;">普通</span>
                </div>
                <input id="wt-set-mood-range" type="range" min="0" max="100" value="60" style="width:100%; accent-color:#07c160;" />

                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-top:4px;">
                  <span>💖 当前好感/性趣：<b id="wt-set-interest-val">15</b> / 100</span>
                  <span id="wt-set-interest-tag" style="font-size:11px; color:#fa5151; font-weight:500;">嫌弃警告</span>
                </div>
                <input id="wt-set-interest-range" type="range" min="0" max="100" value="15" style="width:100%; accent-color:#fa5151;" />
              </div>

              <!-- 场景与钱包 -->
              <div style="background:#f9f9f9; padding:10px; border-radius:8px; font-size:12px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span>📍 角色位置：</span>
                  <select id="wt-set-sister-loc" style="padding:3px 6px; border:1px solid #ccc; border-radius:4px; font-size:12px; background:#fff;">
                    <option value="SISTER_ROOM">卧室</option>
                    <option value="TOILET">厕所</option>
                    <option value="LIVING_ROOM">客厅</option>
                    <option value="SCHOOL">学校</option>
                  </select>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span>💰 钱包余额：</span>
                  <span>¥ <b id="wt-wallet-bal">5200</b></span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span>📅 当前天数：</span>
                  <span>第 <b id="wt-day-num">1</b> 天</span>
                </div>
              </div>

              <!-- API 设置 -->
              <div style="display:flex; flex-direction:column; gap:6px;">
                <span style="font-size:12px; font-weight:600; color:#333;">DeepSeek / OpenAI API 配置</span>
                <input id="wt-cfg-key" type="password" placeholder="API Key (留空使用离线智能词库)" value="" style="height:32px; padding:0 8px; border:1px solid #ddd; border-radius:4px; font-size:12px;" />
                <input id="wt-cfg-url" type="text" placeholder="API URL" value="" style="height:32px; padding:0 8px; border:1px solid #ddd; border-radius:4px; font-size:12px;" />
                <input id="wt-cfg-model" type="text" placeholder="Model" value="" style="height:32px; padding:0 8px; border:1px solid #ddd; border-radius:4px; font-size:12px;" />
              </div>

              <!-- 快捷操作按钮 -->
              <div style="display:flex; gap:8px;">
                <button id="wt-btn-next-day" style="flex:1; background:#f0f0f0; border:1px solid #ccc; border-radius:6px; padding:8px 0; font-size:12px; cursor:pointer;">进入下一天 ☀️</button>
                <button id="wt-btn-clear-chat" style="flex:1; background:#f0f0f0; border:1px solid #ccc; border-radius:6px; padding:8px 0; font-size:12px; color:#c00; cursor:pointer;">清空记录 🗑️</button>
                <button id="wt-btn-save-settings" style="flex:1.2; background:#07c160; color:#fff; border:none; border-radius:6px; padding:8px 0; font-size:12px; font-weight:600; cursor:pointer;">保存设置</button>
              </div>

            </div>
          </div>

          <!-- 发红包弹窗 -->
          <div id="wt-packet-modal" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.6); z-index:50; backdrop-filter:blur(3px); align-items:center; justify-content:center; padding:16px;">
            <div style="background:#cf3b35; width:260px; border-radius:14px; padding:20px 16px; box-sizing:border-box; color:#fff; display:flex; flex-direction:column; align-items:center; gap:12px; position:relative; box-shadow:0 12px 30px rgba(0,0,0,0.4);">
              <button id="wt-packet-close" style="position:absolute; top:8px; right:8px; background:none; border:none; color:rgba(255,255,255,0.7); font-size:16px; cursor:pointer;">✕</button>
              <div style="font-size:32px;">🧧</div>
              <div style="font-weight:600; font-size:15px; color:#fde3b3;">给<span id="wt-packet-target">妹妹</span>发微信红包</div>
              <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; width:100%; margin-top:4px;">
                <button class="wt-amt-pill" data-amt="20" style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:6px; padding:8px 0; color:#fff; font-size:13px; font-weight:bold; cursor:pointer;">¥20</button>
                <button class="wt-amt-pill" data-amt="50" style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:6px; padding:8px 0; color:#fff; font-size:13px; font-weight:bold; cursor:pointer;">¥50</button>
                <button class="wt-amt-pill" data-amt="200" style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:6px; padding:8px 0; color:#fff; font-size:13px; font-weight:bold; cursor:pointer;">¥200</button>
              </div>
              <input id="wt-custom-amt" type="number" placeholder="自定义金额 (¥)" style="width:100%; height:32px; border-radius:6px; border:none; padding:0 10px; font-size:13px; box-sizing:border-box; color:#333;" />
              <button id="wt-confirm-packet" style="background:#fde3b3; color:#a12621; border:none; border-radius:6px; width:100%; height:36px; font-weight:bold; font-size:14px; cursor:pointer; margin-top:4px;">塞钱进红包</button>
            </div>
          </div>

          <!-- 查看大图灯箱 -->
          <div id="wt-photo-lightbox" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.88); z-index:100; flex-direction:column; align-items:center; justify-content:center; padding:16px;">
            <button id="wt-close-lightbox" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#fff; font-size:24px; cursor:pointer;">✕</button>
            <img id="wt-lightbox-img" src="" alt="Photo" style="max-width:92%; max-height:80%; border-radius:8px; object-fit:contain; box-shadow:0 10px 30px rgba(0,0,0,0.5);" />
            <div id="wt-lightbox-desc" style="color:#eee; font-size:13px; margin-top:12px; text-align:center;"></div>
          </div>

        </div>
      `;
      const contactNameEl = container.querySelector("#wt-contact-name");
      const scrollEl = container.querySelector("#wt-scroll");
      const inputEl = container.querySelector("#wt-input-text");
      const sendBtn = container.querySelector("#wt-send-btn");
      const emojiBtn = container.querySelector("#wt-emoji-btn");
      const packetBtn = container.querySelector("#wt-packet-btn");
      const emojiDrawer = container.querySelector("#wt-emoji-drawer");
      const emojiGrid = container.querySelector("#wt-emoji-grid");
      const tabPlayer = container.querySelector("#wt-tab-player");
      const tabSister = container.querySelector("#wt-tab-sister");
      const typingBadge = container.querySelector("#wt-typing-badge");
      const statusPill = container.querySelector("#wt-status-pill");
      const valMood = container.querySelector("#val-mood");
      const valInterest = container.querySelector("#val-interest");
      const pillBadge = container.querySelector("#wt-pill-badge");
      const modalStateSource = container.querySelector("#wt-modal-state-source");
      const settingsModal = container.querySelector("#wt-settings-modal");
      const closeSettings = container.querySelector("#wt-close-settings");
      const setMoodRange = container.querySelector("#wt-set-mood-range");
      const setMoodVal = container.querySelector("#wt-set-mood-val");
      const setMoodTag = container.querySelector("#wt-set-mood-tag");
      const setInterestRange = container.querySelector("#wt-set-interest-range");
      const setInterestVal = container.querySelector("#wt-set-interest-val");
      const setInterestTag = container.querySelector("#wt-set-interest-tag");
      const setSisterLoc = container.querySelector("#wt-set-sister-loc");
      const cfgKey = container.querySelector("#wt-cfg-key");
      const cfgUrl = container.querySelector("#wt-cfg-url");
      const cfgModel = container.querySelector("#wt-cfg-model");
      const btnSaveSettings = container.querySelector("#wt-btn-save-settings");
      const btnNextDay = container.querySelector("#wt-btn-next-day");
      const btnClearChat = container.querySelector("#wt-btn-clear-chat");
      const modalTitle = container.querySelector("#wt-modal-title");
      const packetModal = container.querySelector("#wt-packet-modal");
      const packetClose = container.querySelector("#wt-packet-close");
      const customAmt = container.querySelector("#wt-custom-amt");
      const confirmPacket = container.querySelector("#wt-confirm-packet");
      const packetTarget = container.querySelector("#wt-packet-target");
      const photoLightbox = container.querySelector("#wt-photo-lightbox");
      const closeLightbox = container.querySelector("#wt-close-lightbox");
      const lightboxImg = container.querySelector("#wt-lightbox-img");
      const lightboxDesc = container.querySelector("#wt-lightbox-desc");
      const syncActiveView = () => {
        contactNameEl.textContent = activeConv.characterName;
        packetTarget.textContent = activeConv.characterName;
        modalTitle.textContent = `${activeConv.characterName} 状态监控与设置`;
        valMood.textContent = activeConv.state.mood.toFixed(0);
        valInterest.textContent = activeConv.state.interest.toFixed(0);
        setMoodRange.value = String(activeConv.state.mood);
        setInterestRange.value = String(activeConv.state.interest);
        setSisterLoc.value = String(activeConv.state.sisterLocation);
        container.querySelector("#wt-wallet-bal").textContent = String(activeConv.state.money);
        container.querySelector("#wt-day-num").textContent = String(activeConv.currentDay);
        if (activeConv.state.hasExternalState) {
          if (pillBadge) pillBadge.style.display = "none";
          if (modalStateSource) {
            const fields = activeConv.state.externalFields;
            const fieldLabels = [];
            if (fields?.mood) fieldLabels.push("心情");
            if (fields?.interest) fieldLabels.push("好感");
            if (fields?.money) fieldLabels.push("金钱");
            if (fields?.location) fieldLabels.push("地点");
            const fieldsStr = fieldLabels.length > 0 ? ` [${fieldLabels.join("/")}]` : "";
            modalStateSource.textContent = `状态来源：已连接外部变量（${activeConv.state.externalSource || "ST/MVU"}${fieldsStr}）`;
          }
        } else {
          if (pillBadge) {
            pillBadge.style.display = "inline";
            pillBadge.textContent = "独立";
          }
          if (modalStateSource) {
            modalStateSource.textContent = "状态来源：未接入外部状态（使用独立会话数值）";
          }
        }
        updateLadderTags();
        renderMessages();
      };
      const updateLadderTags = () => {
        const mood = parseFloat(setMoodRange.value);
        const interest = parseFloat(setInterestRange.value);
        setMoodVal.textContent = mood.toFixed(0);
        setInterestVal.textContent = interest.toFixed(0);
        if (mood < 40) setMoodTag.textContent = "心情低落 🌧️";
        else if (mood < 80) setMoodTag.textContent = "平淡普通 ⛅";
        else setMoodTag.textContent = "心情愉悦 ☀️";
        if (interest < 25) setInterestTag.textContent = "嫌弃警告 🚫";
        else if (interest < 50) setInterestTag.textContent = "要零花钱 💸";
        else if (interest < 75) setInterestTag.textContent = "半推半就 🌸";
        else setInterestTag.textContent = "老夫老妻 🔥";
      };
      setMoodRange.oninput = updateLadderTags;
      setInterestRange.oninput = updateLadderTags;
      const switchScope = (nextScope) => {
        if (!isCurrent()) return;
        activeScopeSessionId++;
        latestRefreshReq++;
        latestAppliedRefresh = latestRefreshReq;
        currentScope = nextScope;
        activeConv = getScopedConversation(appData, currentScope);
        syncActiveView();
      };
      const refreshContextAndState = async (targetScope) => {
        const reqMountId = mountSessionId;
        const reqScopeId = activeScopeSessionId;
        const reqScopeKey = (targetScope || currentScope).scopeKey;
        const reqCharName = (targetScope || currentScope).characterName;
        const reqRefreshSeq = ++latestRefreshReq;
        const latestMsgs = extractRecentSTMessages(ctx);
        const extState = await readExternalCharacterState(ctx, reqCharName);
        if (!isCurrent() || reqMountId !== mountSessionId || reqScopeId !== activeScopeSessionId || reqScopeKey !== currentScope.scopeKey) {
          return;
        }
        if (reqRefreshSeq < latestAppliedRefresh) {
          return;
        }
        latestAppliedRefresh = reqRefreshSeq;
        if (latestMsgs) {
          currentScope.stRecentMessages = latestMsgs;
        }
        currentScope.externalState = extState;
        activeConv = getScopedConversation(appData, currentScope);
        syncActiveView();
      };
      refreshContextAndState();
      ctx.onCharacterChanged(() => {
        if (!isCurrent()) return;
        const syncScope = resolveConversationScopeSync(ctx);
        if (syncScope.scopeKey !== currentScope.scopeKey) {
          switchScope(syncScope);
        }
        refreshContextAndState(syncScope);
      });
      unbindEvents = subscribeExternalContextEvents(ctx, () => {
        if (!isCurrent()) return;
        refreshContextAndState();
      });
      const renderMessages = () => {
        scrollEl.replaceChildren();
        for (const msg of activeConv.messages) {
          const isPlayer = msg.sender === "player";
          const row = document.createElement("div");
          row.style.cssText = `display:flex; gap:9px; align-items:flex-start; ${isPlayer ? "flex-direction:row-reverse;" : ""}`;
          const avatar = document.createElement("img");
          avatar.style.cssText = "width:38px; height:38px; border-radius:5px; object-fit:cover; flex-shrink:0; background:#ddd;";
          const resolvedAvatar = isPlayer ? DEFAULT_PLAYER_AVATAR : resolveCharacterAvatarUrl(currentScope.card?.avatar) || DEFAULT_SISTER_AVATAR;
          avatar.src = resolvedAvatar;
          avatar.onerror = () => {
            avatar.src = isPlayer ? DEFAULT_PLAYER_AVATAR : DEFAULT_SISTER_AVATAR;
          };
          avatar.alt = isPlayer ? "User" : activeConv.characterName;
          const bubble = document.createElement("div");
          if (msg.type === "text") {
            bubble.style.cssText = `padding:9px 12px; font-size:14px; line-height:1.4; border-radius:5px; max-width:72%; word-break:break-word; box-shadow:0 1px 2px rgba(0,0,0,0.05); ${isPlayer ? "background:#95ec69; color:#000;" : "background:#fff; color:#181818;"}`;
            bubble.textContent = msg.content;
          } else if (msg.type === "emoji") {
            bubble.style.cssText = "background:none; border:none; padding:2px;";
            const emojiItem = (isPlayer ? PLAYER_EMOJIS : SISTER_EMOJIS)[msg.content];
            if (emojiItem) {
              const img = document.createElement("img");
              img.src = resolveWeChatAssetUrl(emojiItem.file);
              img.alt = emojiItem.name;
              img.style.cssText = "width:110px; height:110px; object-fit:contain; border-radius:4px;";
              bubble.appendChild(img);
            } else {
              bubble.style.cssText = "background:#fff; border-radius:5px; padding:8px 12px; font-size:13px; color:#666;";
              bubble.textContent = `[表情: ${msg.content}]`;
            }
          } else if (msg.type === "image") {
            bubble.style.cssText = "background:#fff; border-radius:6px; padding:4px; max-width:65%; box-shadow:0 1px 3px rgba(0,0,0,0.1); cursor:pointer;";
            const photo = SISTER_PHOTOS[msg.content];
            if (photo) {
              const photoUrl = resolveWeChatAssetUrl(photo.file);
              const img = document.createElement("img");
              img.src = photoUrl;
              img.alt = photo.name;
              img.style.cssText = "width:100%; max-height:220px; border-radius:4px; object-fit:cover; display:block;";
              bubble.appendChild(img);
              bubble.onclick = () => {
                lightboxImg.src = photoUrl;
                lightboxDesc.textContent = `${photo.name}：${photo.description}`;
                photoLightbox.style.display = "flex";
              };
            } else {
              bubble.textContent = `[图片: ${msg.content}]`;
            }
          } else if (msg.type === "red_packet") {
            bubble.style.cssText = "background:#fa9d3b; color:#fff; border-radius:7px; padding:10px 14px; width:160px; box-shadow:0 2px 6px rgba(250,157,59,0.3);";
            const rowDiv = document.createElement("div");
            rowDiv.style.cssText = "display:flex; align-items:center; gap:10px;";
            const iconSpan = document.createElement("span");
            iconSpan.style.fontSize = "24px";
            iconSpan.textContent = "🧧";
            const textWrap = document.createElement("div");
            const amtDiv = document.createElement("div");
            amtDiv.style.cssText = "font-size:15px; font-weight:bold;";
            amtDiv.textContent = `¥ ${msg.content}`;
            const subDiv = document.createElement("div");
            subDiv.style.cssText = "font-size:10px; opacity:0.85;";
            subDiv.textContent = "微信红包 · 已存入钱包";
            textWrap.append(amtDiv, subDiv);
            rowDiv.append(iconSpan, textWrap);
            bubble.append(rowDiv);
          }
          row.appendChild(avatar);
          row.appendChild(bubble);
          scrollEl.appendChild(row);
        }
        scrollEl.scrollTop = scrollEl.scrollHeight;
      };
      let activeTab = "player";
      const renderEmojiDrawer = () => {
        emojiGrid.replaceChildren();
        const emojis = activeTab === "player" ? PLAYER_EMOJIS : SISTER_EMOJIS;
        for (const [id, item] of Object.entries(emojis)) {
          const btn = document.createElement("div");
          btn.style.cssText = "background:#fff; border:1px solid #ddd; border-radius:6px; padding:4px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; gap:2px; transition:transform 0.1s ease;";
          btn.title = item.description;
          const imgPath = resolveWeChatAssetUrl(item.file);
          const img = document.createElement("img");
          img.src = imgPath;
          img.alt = item.name;
          img.style.cssText = "width:34px; height:34px; object-fit:contain;";
          const lbl = document.createElement("span");
          lbl.style.cssText = "font-size:10px; color:#555; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:44px;";
          lbl.textContent = item.name;
          btn.append(img, lbl);
          btn.onclick = () => {
            emojiDrawer.style.display = "none";
            handleSendMessage(id, "emoji");
          };
          emojiGrid.appendChild(btn);
        }
      };
      tabPlayer.onclick = () => {
        activeTab = "player";
        tabPlayer.style.background = "#f7f7f7";
        tabPlayer.style.color = "#07c160";
        tabSister.style.background = "#eeeeee";
        tabSister.style.color = "#666";
        renderEmojiDrawer();
      };
      tabSister.onclick = () => {
        activeTab = "sister";
        tabSister.style.background = "#f7f7f7";
        tabSister.style.color = "#07c160";
        tabPlayer.style.background = "#eeeeee";
        tabPlayer.style.color = "#666";
        renderEmojiDrawer();
      };
      emojiBtn.onclick = () => {
        const isHidden = emojiDrawer.style.display === "none";
        emojiDrawer.style.display = isHidden ? "flex" : "none";
        if (isHidden) renderEmojiDrawer();
      };
      packetBtn.onclick = () => {
        packetModal.style.display = "flex";
      };
      packetClose.onclick = () => {
        packetModal.style.display = "none";
      };
      container.querySelectorAll(".wt-amt-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
          const amt = pill.dataset.amt || "50";
          sendRedPacket(parseInt(amt, 10));
        });
      });
      confirmPacket.onclick = () => {
        const amt = parseInt(customAmt.value, 10);
        if (isNaN(amt) || amt <= 0) {
          ctx.toast("error", "请输入有效的红包金额");
          return;
        }
        sendRedPacket(amt);
      };
      const sendRedPacket = (amt) => {
        if (activeConv.state.money < amt) {
          ctx.toast("error", `钱包余额不足（当前余额：¥${activeConv.state.money}）`);
          return;
        }
        const hasExternalMoney = Boolean(activeConv.state.hasExternalState && activeConv.state.externalFields?.money);
        if (!hasExternalMoney) {
          activeConv.state.money -= amt;
        }
        packetModal.style.display = "none";
        customAmt.value = "";
        handleSendMessage(String(amt), "red_packet");
      };
      closeLightbox.onclick = () => {
        photoLightbox.style.display = "none";
      };
      photoLightbox.onclick = (e) => {
        if (e.target === photoLightbox) photoLightbox.style.display = "none";
      };
      const handleSendMessage = async (content, type = "text") => {
        if (!content.trim() || !isCurrent()) return;
        const targetMountSession = mountSessionId;
        const targetScopeSession = activeScopeSessionId;
        const targetScopeKey = currentScope.scopeKey;
        const targetConv = activeConv;
        const targetScopeObj = currentScope;
        const isRequestValid = () => isCurrent() && targetMountSession === mountSessionId && targetScopeSession === activeScopeSessionId && targetScopeKey === currentScope.scopeKey;
        const latestMsgs = extractRecentSTMessages(ctx);
        if (latestMsgs) {
          targetScopeObj.stRecentMessages = latestMsgs;
        }
        const playerMsg = {
          sender: "player",
          content,
          type,
          time: { day: targetConv.currentDay, hour: 19, minute: 0 }
        };
        targetConv.messages.push(playerMsg);
        if (currentScope.scopeKey === targetScopeKey) {
          renderMessages();
          typingBadge.style.display = "inline";
        }
        if (type === "text") inputEl.value = "";
        const replyPayload = await pipeline.requestSisterReply(
          targetConv.messages,
          targetConv.state,
          targetConv.currentDay,
          "19:00",
          targetScopeObj
        );
        if (!isRequestValid()) return;
        const firstText = replyPayload.messages.find((m) => m.type === "text")?.content || "嗯嗯。";
        await simulateTypingDelay(firstText);
        if (!isRequestValid()) return;
        if (currentScope.scopeKey === targetScopeKey) {
          typingBadge.style.display = "none";
        }
        for (const item of replyPayload.messages) {
          targetConv.messages.push({
            sender: "sister",
            content: item.content || item.emoji_id || item.pic_id || "",
            type: item.type,
            time: { day: targetConv.currentDay, hour: 19, minute: 1 }
          });
        }
        conversations[targetScopeKey] = targetConv;
        ctx.setAppData(appData);
        if (currentScope.scopeKey === targetScopeKey) {
          renderMessages();
        }
        const preMoodExternal = Boolean(targetConv.state.hasExternalState && targetConv.state.externalFields?.mood);
        const preInterestExternal = Boolean(targetConv.state.hasExternalState && targetConv.state.externalFields?.interest);
        if (!preMoodExternal || !preInterestExternal) {
          const impact = await pipeline.requestStatImpact(
            type === "text" ? content : `[${type}] ${content}`,
            firstText,
            targetConv.state
          );
          if (!isRequestValid()) return;
          const curMoodExternal = Boolean(targetConv.state.hasExternalState && targetConv.state.externalFields?.mood);
          const curInterestExternal = Boolean(targetConv.state.hasExternalState && targetConv.state.externalFields?.interest);
          let stateChanged = false;
          if (!curMoodExternal) {
            targetConv.state.mood = Math.max(0, Math.min(100, targetConv.state.mood + impact.mood));
            stateChanged = true;
          }
          if (!curInterestExternal) {
            targetConv.state.interest = Math.max(0, Math.min(100, targetConv.state.interest + impact.interest));
            stateChanged = true;
          }
          if (stateChanged) {
            conversations[targetScopeKey] = targetConv;
            ctx.setAppData(appData);
            if (currentScope.scopeKey === targetScopeKey) {
              syncActiveView();
            }
          }
        }
      };
      sendBtn.onclick = () => handleSendMessage(inputEl.value, "text");
      let isComposing = false;
      inputEl.addEventListener("compositionstart", () => {
        isComposing = true;
      });
      inputEl.addEventListener("compositionend", () => {
        isComposing = false;
      });
      inputEl.onkeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          if (isComposing || e.isComposing || e.keyCode === 229) {
            return;
          }
          e.preventDefault();
          handleSendMessage(inputEl.value, "text");
        }
      };
      statusPill.onclick = () => {
        cfgKey.value = appData.config.apiKey || "";
        cfgUrl.value = appData.config.apiUrl || "https://api.deepseek.com/chat/completions";
        cfgModel.value = appData.config.model || "deepseek-chat";
        settingsModal.style.display = "flex";
      };
      closeSettings.onclick = () => {
        settingsModal.style.display = "none";
      };
      btnSaveSettings.onclick = () => {
        appData.config.apiKey = cfgKey.value.trim();
        appData.config.apiUrl = cfgUrl.value.trim() || "https://api.deepseek.com/chat/completions";
        appData.config.model = cfgModel.value.trim() || "deepseek-chat";
        activeConv.state.mood = parseFloat(setMoodRange.value);
        activeConv.state.interest = parseFloat(setInterestRange.value);
        activeConv.state.sisterLocation = setSisterLoc.value;
        if (activeConv.state.hasExternalState) {
          activeConv.state.hasExternalState = false;
          activeConv.state.externalSource = void 0;
          activeConv.state.externalFields = void 0;
          currentScope.externalState = { source: "none" };
        }
        conversations[currentScope.scopeKey] = activeConv;
        ctx.setAppData(appData);
        pipeline = new WeChatPipeline(
          appData.config,
          PLAYER_EMOJIS,
          SISTER_EMOJIS,
          SISTER_PHOTOS,
          FALLBACK_DIALOGUES
        );
        settingsModal.style.display = "none";
        syncActiveView();
        ctx.toast("success", "微信设置与数值已保存");
      };
      btnNextDay.onclick = () => {
        activeConv.currentDay += 1;
        const hasExternalMoney = Boolean(activeConv.state.hasExternalState && activeConv.state.externalFields?.money);
        if (!hasExternalMoney) {
          activeConv.state.money += 200;
        }
        conversations[currentScope.scopeKey] = activeConv;
        ctx.setAppData(appData);
        syncActiveView();
        ctx.toast("info", `已进入第 ${activeConv.currentDay} 天${!hasExternalMoney ? "，发放生活费 ¥200" : ""}`);
      };
      btnClearChat.onclick = () => {
        activeConv.messages = [];
        conversations[currentScope.scopeKey] = activeConv;
        ctx.setAppData(appData);
        renderMessages();
        settingsModal.style.display = "none";
        ctx.toast("info", "微信聊天记录已清空");
      };
      syncActiveView();
    },
    unmount() {
      mountSessionId++;
      activeScopeSessionId++;
      pipeline = null;
      if (unbindEvents) {
        unbindEvents();
        unbindEvents = null;
      }
    }
  };
}

// st-extension/src/apps/index.ts
function createBuiltinApps(deps) {
  return [
    spriteApp({ previewOpacity: deps.previewSpriteOpacity }),
    galleryApp({ openManager: deps.openGalleryManager }),
    butlerApp(),
    mvuApp(),
    newvarApp({ runtime: deps.newvarRuntime, openDesigner: deps.openNewvarDesigner }),
    apiApp({ openManager: deps.openApiManager }),
    rendererApp({ runtime: deps.rendererRuntime }),
    cloudExportApp(),
    createWeChatApp()
  ];
}

// st-extension/src/apps/newvar/legacy-set-parser.ts
function parseLegacySetCalls(source) {
  const calls = [];
  const errors = [];
  let index = 0;
  while (index < source.length) {
    index = skipTrivia(source, index);
    if (index >= source.length) break;
    const start = index;
    try {
      const parsed = parseCall(source, start);
      let next = skipHorizontalSpace(source, parsed.next);
      const hasSemicolon = source[next] === ";";
      if (hasSemicolon) next = skipHorizontalSpace(source, next + 1);
      if (next >= source.length || isLineBreak(source[next])) {
        calls.push(parsed.call);
        index = next;
        continue;
      }
      if (source.startsWith("//", next)) {
        calls.push(parsed.call);
        index = skipLineComment(source, next);
        continue;
      }
      if (hasSemicolon && source.startsWith("_.set", next)) {
        calls.push(parsed.call);
        index = next;
        continue;
      }
      throw syntaxError(source, next, t("apps.newvar.legacy.trailing", "调用后存在不允许的尾随内容"));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      index = recoverAtNextLine(source, start);
    }
  }
  return { calls, errors };
}
function parseCall(source, start) {
  if (!source.startsWith("_.set", start)) throw syntaxError(source, start, t("apps.newvar.legacy.calls_only", "只允许 _.set(...) 调用"));
  let index = skipWhitespace(source, start + "_.set".length);
  if (source[index] !== "(") throw syntaxError(source, index, t("apps.newvar.legacy.missing_parenthesis", "_.set 后缺少左括号"));
  index = skipWhitespace(source, index + 1);
  const pathArg = parseValue(source, index);
  if (typeof pathArg.value !== "string") throw syntaxError(source, index, t("apps.newvar.legacy.path_string", "第一个参数必须是字符串路径"));
  const path = pathArg.value.trim();
  if (!path) throw syntaxError(source, index, t("apps.newvar.legacy.empty_path", "变量路径不能为空"));
  if (!isSafePath(path)) throw syntaxError(source, index, t("apps.newvar.legacy.unsafe_path", "变量路径包含危险字段"));
  index = expectComma(source, pathArg.next, t("apps.newvar.legacy.missing_old", "路径后缺少旧值参数"));
  const oldArg = parseValue(source, index);
  index = expectComma(source, oldArg.next, t("apps.newvar.legacy.missing_new", "旧值后缺少新值参数"));
  const newArg = parseValue(source, index);
  index = skipWhitespace(source, newArg.next);
  if (source[index] !== ")") throw syntaxError(source, index, t("apps.newvar.legacy.unexpected_argument", "新值后必须立即结束调用"));
  return {
    call: { path, oldValue: oldArg.value, newValue: newArg.value },
    next: index + 1
  };
}
function parseValue(source, start) {
  const index = skipWhitespace(source, start);
  const quote = source[index];
  if (quote === "'" || quote === '"') return parseString(source, index, quote);
  for (const [token, value] of [
    ["true", true],
    ["false", false],
    ["null", null]
  ]) {
    if (source.startsWith(token, index) && isValueBoundary(source[index + token.length])) {
      return { value, next: index + token.length };
    }
  }
  const number = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
  if (number && isValueBoundary(source[index + number[0].length])) {
    return { value: Number(number[0]), next: index + number[0].length };
  }
  throw syntaxError(source, index, t("apps.newvar.legacy.literal_only", "参数只能是字符串、数字、布尔值或 null"));
}
function parseString(source, start, quote) {
  let value = "";
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === quote) return { value, next: index + 1 };
    if (isLineBreak(char)) throw syntaxError(source, index, t("apps.newvar.legacy.unclosed_string", "字符串引号未闭合"));
    if (char !== "\\") {
      value += char;
      index += 1;
      continue;
    }
    const escaped = source[index + 1];
    if (escaped === void 0 || isLineBreak(escaped)) throw syntaxError(source, index, t("apps.newvar.legacy.incomplete_escape", "字符串转义未完成"));
    const simpleEscapes = {
      "'": "'",
      '"': '"',
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "	"
    };
    if (escaped === "u") {
      const hex = source.slice(index + 2, index + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw syntaxError(source, index, t("apps.newvar.legacy.unicode_escape", "Unicode 转义必须包含四位十六进制数"));
      value += String.fromCharCode(Number.parseInt(hex, 16));
      index += 6;
      continue;
    }
    if (!(escaped in simpleEscapes)) throw syntaxError(source, index, t("apps.newvar.legacy.unsupported_escape", "不支持的字符串转义 \\{{escape}}", { escape: escaped }));
    value += simpleEscapes[escaped];
    index += 2;
  }
  throw syntaxError(source, start, t("apps.newvar.legacy.unclosed_string", "字符串引号未闭合"));
}
function expectComma(source, start, message) {
  const index = skipWhitespace(source, start);
  if (source[index] !== ",") throw syntaxError(source, index, message);
  return skipWhitespace(source, index + 1);
}
function skipWhitespace(source, start) {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}
function skipHorizontalSpace(source, start) {
  let index = start;
  while (source[index] === " " || source[index] === "	") index += 1;
  return index;
}
function skipTrivia(source, start) {
  let index = start;
  while (index < source.length) {
    if (/\s/.test(source[index]) || source[index] === ";") {
      index += 1;
      continue;
    }
    if (source.startsWith("//", index)) {
      index = skipLineComment(source, index);
      continue;
    }
    break;
  }
  return index;
}
function skipLineComment(source, start) {
  const newline = source.indexOf("\n", start + 2);
  return newline < 0 ? source.length : newline + 1;
}
function recoverAtNextLine(source, start) {
  const newline = source.indexOf("\n", start);
  return newline < 0 ? source.length : newline + 1;
}
function isLineBreak(char) {
  return char === "\n" || char === "\r";
}
function isValueBoundary(char) {
  return char === void 0 || char === "," || char === ")" || /\s/.test(char);
}
function syntaxError(source, index, message) {
  const before = source.slice(0, Math.max(0, index));
  const line = before.split("\n").length;
  const lastNewline = before.lastIndexOf("\n");
  const column = index - lastNewline;
  return new Error(t("apps.newvar.legacy.position", "第 {{line}} 行第 {{column}} 列：{{message}}", { line, column, message }));
}

// st-extension/src/apps/newvar/engine.ts
function initStateFromSchema(schema) {
  const state2 = {};
  for (const def of schema.variables) {
    setNested(state2, def.key, clone(def.default));
  }
  return state2;
}
function clone(v) {
  if (v == null || typeof v !== "object") return v;
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return v;
  }
}
function fillDefaults(state2, schema) {
  const next = clone(state2);
  for (const def of schema.variables) {
    if (getNested(next, def.key) === void 0) setNested(next, def.key, clone(def.default));
  }
  return next;
}
function validateValue(def, raw) {
  switch (def.type) {
    case "number": {
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return { ok: false, error: t("apps.newvar.errors.expected_number", "期望数字，得到 {{value}}", { value: describe(raw) }) };
      }
      if (def.range) {
        const [min, max] = def.range;
        if (raw < min || raw > max) {
          const clipped = Math.max(min, Math.min(max, raw));
          return { ok: true, value: clipped, corrected: true };
        }
      }
      return { ok: true, value: raw };
    }
    case "string":
      if (typeof raw !== "string") return { ok: false, error: t("apps.newvar.errors.expected_string", "期望文本，得到 {{value}}", { value: describe(raw) }) };
      return { ok: true, value: raw };
    case "boolean":
      if (typeof raw !== "boolean") return { ok: false, error: t("apps.newvar.errors.expected_boolean", "期望布尔，得到 {{value}}", { value: describe(raw) }) };
      return { ok: true, value: raw };
    case "enum": {
      const options = def.enum ?? [];
      if (typeof raw !== "string" || !options.includes(raw)) {
        return { ok: false, error: t("apps.newvar.errors.invalid_enum", "值 {{value}} 不在枚举 [{{options}}] 中", { value: describe(raw), options: options.join(", ") }) };
      }
      return { ok: true, value: raw };
    }
    default:
      return { ok: true, value: raw };
  }
}
function describe(v) {
  if (v === null) return "null";
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "object") return Array.isArray(v) ? t("apps.newvar.errors.array", "数组") : t("apps.newvar.errors.object", "对象");
  return String(v);
}
function exampleValue(def) {
  if (def.type === "number") return def.range?.[0] ?? 0;
  if (def.type === "boolean") return true;
  if (def.type === "enum") return def.enum?.[0] ?? "";
  return "新值";
}
function dottedToPointer(path) {
  const segments = path.split(".").map((segment) => segment.replace(/~/g, "~0").replace(/\//g, "~1"));
  return `/${segments.join("/")}`;
}
function serializeExampleValue(value) {
  return JSON.stringify(value) ?? "null";
}
var BLOCK_RE = /<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i;
var ANALYSIS_RE = /<Analysis>[\s\S]*?<\/Analysis>/gi;
function parseUpdateBlock(text4, format) {
  if (typeof text4 !== "string") return { found: false, ops: [] };
  const m = BLOCK_RE.exec(text4);
  if (!m) return { found: false, ops: [] };
  const inner = m[1].replace(ANALYSIS_RE, "").trim();
  if (!inner) return { found: true, ops: [] };
  if (format === "lodash_set") {
    return parseLodash(inner);
  }
  return parseJsonPatch(inner);
}
function parseJsonPatch(inner) {
  const arrText = extractJsonArray(inner);
  if (arrText === null) return { found: true, ops: [], error: t("apps.newvar.errors.no_array", "未找到 JSON Patch 数组") };
  let parsed;
  try {
    parsed = JSON.parse(arrText);
  } catch (e) {
    return { found: true, ops: [], error: t("apps.newvar.errors.json", "JSON 解析失败：{{error}}", { error: e instanceof Error ? e.message : String(e) }) };
  }
  if (!Array.isArray(parsed)) return { found: true, ops: [], error: t("apps.newvar.errors.patch_array", "JSON Patch 应为数组") };
  const ops = [];
  const rejected = [];
  for (const [index, raw] of parsed.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      rejected.push({ index, reason: t("apps.newvar.errors.patch_object", "补丁条目必须是对象") });
      continue;
    }
    const o = raw;
    const op = o.op;
    const pointer = o.path;
    if (op !== "replace" && op !== "add" && op !== "remove") {
      rejected.push({ index, reason: t("apps.newvar.errors.invalid_op", "op 只允许 add、replace 或 remove") });
      continue;
    }
    if (typeof pointer !== "string") {
      rejected.push({ index, reason: t("apps.newvar.errors.path_string", "path 必须是非空字符串") });
      continue;
    }
    const path = pointerToDotted(pointer).trim();
    if (!path) {
      rejected.push({ index, reason: t("apps.newvar.errors.empty_path", "path 不能为空") });
      continue;
    }
    if (!isSafePath(path)) {
      rejected.push({ index, reason: t("apps.newvar.errors.unsafe_path", "path 包含危险字段") });
      continue;
    }
    if (op !== "remove" && !Object.prototype.hasOwnProperty.call(o, "value")) {
      rejected.push({ index, reason: t("apps.newvar.errors.missing_value", "{{op}} 操作缺少 value", { op }) });
      continue;
    }
    ops.push({ op, path, value: o.value });
  }
  return { found: true, ops, ...rejected.length > 0 ? { rejected } : {} };
}
function extractJsonArray(inner) {
  const start = inner.indexOf("[");
  const end = inner.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  return inner.slice(start, end + 1);
}
function pointerToDotted(pointer) {
  const p = pointer.startsWith("/") ? pointer.slice(1) : pointer;
  if (p === "") return "";
  return p.split("/").map((seg) => seg.replace(/~1/g, "/").replace(/~0/g, "~")).join(".");
}
function parseLodash(inner) {
  const parsed = parseLegacySetCalls(inner);
  const ops = parsed.calls.map((call) => ({ op: "replace", path: call.path, value: call.newValue }));
  return {
    found: true,
    ops,
    ...parsed.errors.length > 0 ? { error: parsed.errors.join("；") } : {}
  };
}
function applyOps(state2, ops, schema) {
  const next = clone(state2);
  const log = [];
  const defByKey = new Map(schema.variables.map((v) => [v.key, v]));
  const hasSchema = schema.variables.length > 0;
  for (const op of ops) {
    if (!op.path.trim() || !isSafePath(op.path)) {
      log.push({ path: op.path, status: "rejected", detail: t("apps.newvar.errors.unsafe_variable_path", "变量路径为空或包含危险字段") });
      continue;
    }
    const def = defByKey.get(op.path);
    if (op.op === "remove") {
      if (hasSchema && !def) {
        log.push({ path: op.path, status: "rejected", detail: t("apps.newvar.errors.remove_leaf", "remove 只能删除 schema 中定义的叶子变量") });
        continue;
      }
      deleteNested(next, op.path);
      log.push({ path: op.path, status: "removed" });
      continue;
    }
    if (!def) {
      if (hasSchema) {
        log.push({ path: op.path, status: "rejected", detail: t("apps.newvar.errors.undefined", "未定义的变量路径") });
        continue;
      }
      setNested(next, op.path, op.value);
      log.push({ path: op.path, status: "accepted" });
      continue;
    }
    const outcome = validateValue(def, op.value);
    if (!outcome.ok) {
      log.push({ path: op.path, status: "rejected", detail: outcome.error });
      continue;
    }
    setNested(next, op.path, outcome.value);
    log.push({
      path: op.path,
      status: outcome.corrected ? "corrected" : "accepted",
      detail: outcome.corrected ? t("apps.newvar.errors.corrected", "已修正为 {{value}}", { value: JSON.stringify(outcome.value) ?? "undefined" }) : void 0
    });
  }
  return { state: next, log };
}
function buildInjection(state2, schema, format) {
  const visible = schema.variables.filter((v) => !v.hidden);
  const stateLines = visible.map((v) => {
    const value = getNested(state2, v.key);
    const desc = v.description ? `  // ${v.description}` : "";
    return `  ${v.key}: ${JSON.stringify(value)}${desc}`;
  });
  const ruleLines = [];
  for (const v of visible) {
    const checks = [];
    if (v.type === "number") {
      checks.push(v.range ? `数字，范围 ${v.range[0]}~${v.range[1]}（超出会被裁剪）` : "数字");
      checks.push('输出更新后的完整数值（禁止输出 "+3" 这类增量表达式，自己算好结果）');
    } else if (v.type === "enum") {
      checks.push(`只能取：${(v.enum ?? []).join(" / ")}`);
    } else if (v.type === "boolean") {
      checks.push("布尔值 true / false");
    } else {
      checks.push("文本");
    }
    if (v.updateRule) {
      for (const line of v.updateRule.split("\n")) {
        const t2 = line.trim();
        if (t2) checks.push(t2);
      }
    }
    ruleLines.push(`  ${v.key}:`);
    for (const c of checks) ruleLines.push(`    - ${c}`);
  }
  const exampleDef = visible[0];
  const example = exampleDef?.key ?? "变量路径";
  const examplePatchValue = exampleDef ? exampleValue(exampleDef) : "新值";
  const currentExampleValue = exampleDef ? getNested(state2, example) : "旧值";
  const examplePatch = JSON.stringify([
    { op: "replace", path: dottedToPointer(example), value: examplePatchValue }
  ]);
  const formatLines = format === "lodash_set" ? [
    "- 在回复正文全部结束后，若本轮有变量变化，追加一个 <UpdateVariable> 块；没有变化则不要输出该块",
    "- 块内每行一条命令：_.set('变量路径', 旧值, 新值);//变化原因",
    "格式示例：",
    "<UpdateVariable>",
    `_.set(${JSON.stringify(example)}, ${serializeExampleValue(currentExampleValue)}, ${serializeExampleValue(examplePatchValue)});//原因`,
    "</UpdateVariable>"
  ] : [
    "- 在回复正文全部结束后，若本轮有变量变化，追加一个 <UpdateVariable> 块；没有变化则不要输出该块",
    "- 块内先写 <Analysis>（中文，不超过 60 字）：逐条对照上面的更新规则，说明哪些变量该更新、更新到多少",
    "- 然后输出严格符合 JSON Patch (RFC 6902) 的 JSON 数组，只允许 replace / add / remove 三种操作",
    "- path 用斜杠分隔层级（如 /状态/体力）；value 是更新后的完整值",
    "格式示例：",
    "<UpdateVariable>",
    `<Analysis>${example} 按规则更新为 ${JSON.stringify(examplePatchValue)}。</Analysis>`,
    examplePatch,
    "</UpdateVariable>"
  ];
  return [
    "<status_current_variable>",
    "当前变量状态：",
    stateLines.join("\n"),
    "</status_current_variable>",
    "",
    "<variable_update_rule>",
    "各变量的更新规则（check 条件不满足时，不要更新对应变量）：",
    ruleLines.join("\n"),
    "</variable_update_rule>",
    "",
    "<variable_update_format>",
    formatLines.join("\n"),
    "</variable_update_format>"
  ].join("\n");
}

// st-extension/src/apps/newvar/runtime.ts
function createNewvarRuntime(deps) {
  let lastParse = null;
  let warnedSave = false;
  const listeners = /* @__PURE__ */ new Set();
  const unsubs = [];
  function getST4() {
    try {
      return window.SillyTavern?.getContext();
    } catch {
      return void 0;
    }
  }
  function getData() {
    return normalizeNewvarData(deps.getSettings().apps[NEWVAR_APP_ID]);
  }
  function notify() {
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        console.error("[st-stage] 新变量订阅回调出错", err);
      }
    }
  }
  function floorSnapshot(msg) {
    const entry = msg?.extra?.[NEWVAR_EXTRA_KEY];
    if (!entry || typeof entry !== "object") return null;
    const stat = entry.stat_data;
    return stat && typeof stat === "object" && !Array.isArray(stat) ? stat : null;
  }
  function clone2(v) {
    try {
      return JSON.parse(JSON.stringify(v));
    } catch {
      return v;
    }
  }
  function findSnapshotBefore(chat2, fromId) {
    for (let i = Math.min(fromId, chat2.length - 1); i >= 0; i--) {
      const snap = floorSnapshot(chat2[i]);
      if (snap) return clone2(snap);
    }
    return null;
  }
  function getCurrentState() {
    const schema = getData().schema;
    const chat2 = getST4()?.chat;
    if (Array.isArray(chat2)) {
      const snap = findSnapshotBefore(chat2, chat2.length - 1);
      if (snap) return fillDefaults(snap, schema);
    }
    return initStateFromSchema(schema);
  }
  function getPrevState() {
    const chat2 = getST4()?.chat;
    if (!Array.isArray(chat2)) return null;
    for (let i = chat2.length - 1; i >= 0; i--) {
      if (floorSnapshot(chat2[i])) return findSnapshotBefore(chat2, i - 1);
    }
    return null;
  }
  function writeSnapshot(st, messageId, state2) {
    const msg = st.chat?.[messageId];
    if (!msg) return;
    if (!msg.extra || typeof msg.extra !== "object") msg.extra = {};
    msg.extra[NEWVAR_EXTRA_KEY] = { stat_data: state2 };
    saveChat(st);
  }
  function saveChat(st) {
    try {
      if (typeof st.saveChatDebounced === "function") {
        st.saveChatDebounced();
      } else if (typeof st.saveChat === "function") {
        void st.saveChat();
      } else if (!warnedSave) {
        warnedSave = true;
        console.warn("[st-stage] 新变量：当前 ST 版本 context 无 saveChat，快照仅存内存（重载对话丢失）");
      }
    } catch (err) {
      console.warn("[st-stage] 新变量：保存对话失败", err);
    }
  }
  function buildPreview() {
    const data = getData();
    if (!data.enabled || data.schema.variables.length === 0) return "";
    return buildInjection(getCurrentState(), data.schema, data.format);
  }
  function reinject() {
    const data = getData();
    deps.inject(buildPreview(), data.injectionDepth);
  }
  function handleMessageReceived(...args) {
    const data = getData();
    if (!data.enabled) return;
    const st = getST4();
    const chat2 = st?.chat;
    if (!st || !Array.isArray(chat2)) return;
    const rawId = args[0];
    const idNum = typeof rawId === "number" ? rawId : typeof rawId === "string" && rawId.trim() !== "" ? Number(rawId) : NaN;
    const messageId = Number.isInteger(idNum) && idNum >= 0 && idNum < chat2.length ? idNum : chat2.length - 1;
    const msg = chat2[messageId];
    if (!msg || msg.is_user || typeof msg.mes !== "string") return;
    const parsed = parseUpdateBlock(msg.mes, data.format);
    if (!parsed.found) return;
    if (parsed.error) {
      lastParse = { messageId, found: true, error: parsed.error, log: [] };
      notify();
      return;
    }
    const snapBase = findSnapshotBefore(chat2, messageId - 1);
    const base = snapBase ? fillDefaults(snapBase, data.schema) : initStateFromSchema(data.schema);
    const result = applyOps(base, parsed.ops, data.schema);
    const parseLog = (parsed.rejected ?? []).map(({ index, reason }) => ({
      path: `JSON Patch[${index}]`,
      status: "rejected",
      detail: reason
    }));
    writeSnapshot(st, messageId, result.state);
    lastParse = { messageId, found: true, log: [...parseLog, ...result.log] };
    reinject();
    notify();
  }
  function mutateCurrent(mutate) {
    const st = getST4();
    const chat2 = st?.chat;
    if (!st || !Array.isArray(chat2) || chat2.length === 0) return false;
    const state2 = getCurrentState();
    mutate(state2);
    writeSnapshot(st, chat2.length - 1, state2);
    reinject();
    notify();
    return true;
  }
  function subscribeEvents() {
    const st = getST4();
    const es = st?.eventSource;
    if (!es) return;
    const et = st?.eventTypes ?? {};
    const bind = (name, fallback, handler) => {
      const event = name ?? fallback;
      es.on(event, handler);
      unsubs.push(() => {
        try {
          es.removeListener(event, handler);
        } catch {
        }
      });
    };
    bind(et.MESSAGE_RECEIVED, "message_received", handleMessageReceived);
    const onNav = () => {
      reinject();
      notify();
    };
    bind(et.CHAT_CHANGED, "chat_id_changed", onNav);
    bind(et.MESSAGE_SWIPED, "message_swiped", onNav);
    bind(et.MESSAGE_DELETED, "message_deleted", onNav);
  }
  return {
    start() {
      subscribeEvents();
      reinject();
    },
    dispose() {
      for (const off of unsubs) off();
      unsubs.length = 0;
      listeners.clear();
    },
    isSTAvailable() {
      return Array.isArray(getST4()?.chat);
    },
    getData,
    getCurrentState,
    getPrevState,
    setManualValue(path, value) {
      const def = getData().schema.variables.find((item) => item.key === path);
      if (!def) return { ok: false, error: t("apps.newvar.errors.undefined_path", "未定义的变量路径：{{path}}", { path }) };
      const validated = validateValue(def, value);
      if (!validated.ok) return { ok: false, error: validated.error ?? t("apps.newvar.errors.invalid_value", "输入值不符合变量定义。") };
      if (!mutateCurrent((state2) => setNested(state2, path, validated.value))) {
        return { ok: false, error: t("apps.newvar.errors.no_message", "当前环境没有可写入的聊天楼层。") };
      }
      return { ok: true, value: validated.value };
    },
    deleteVariable(path) {
      mutateCurrent((state2) => deleteNested(state2, path));
    },
    onConfigChanged() {
      reinject();
      notify();
    },
    buildPreview,
    getLastParse: () => lastParse,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

// st-extension/src/apps/newvar/templates.ts
var RELATIONSHIP_STAGES = ["陌生", "熟悉", "信任", "亲密", "挚爱"];
var RELATIONSHIP_RULE = "按好感度区间判断：陌生 0-19；熟悉 20-39；信任 40-59；亲密 60-79；挚爱 80-100\n只有数值跨入新区间且剧情关系确有变化时才调整，不可跳级";
function timeVariables() {
  return [
    {
      key: "时间.日期",
      type: "string",
      default: "故事开始日",
      description: "当前故事日期（优先使用 YYYY-MM-DD，原作未给年份时用明确的月日或第几天）",
      updateRule: "剧情明确跨过午夜或日期推进时更新；同一天内保持不变，禁止凭空补造年份"
    },
    {
      key: "时间.当前时间",
      type: "string",
      default: "15:00",
      description: "当前 24 小时时间（HH:mm）",
      updateRule: "按剧情累计推进：对话约 5~15 分钟，移动 10~30 分钟，重大事件 30 分钟以上；保持 HH:mm 格式"
    },
    {
      key: "时间.当前时段",
      type: "enum",
      default: "下午",
      description: "由当前时间对应的时段",
      enum: ["清晨", "上午", "中午", "下午", "傍晚", "夜晚", "深夜"],
      updateRule: "跟随 时间.当前时间 跨过时段边界时更新，未跨界时保持不变"
    }
  ];
}
var romanceSingle = {
  id: "romance-single",
  name: "恋爱 · 单角色",
  description: "好感、关系阶段、心情、行动和完整日期时间；关系按明确阈值小步推进。",
  variables: [
    {
      key: "好感度",
      type: "number",
      default: 20,
      description: "角色对用户的好感（0~100）",
      range: [0, 100],
      updateRule: "正面互动 +1~3；重大事件（告白、共渡难关）±5~10；负面言行 -1~5\n无实质互动时保持不变，禁止无缘由跳变"
    },
    {
      key: "关系阶段",
      type: "enum",
      default: "熟悉",
      description: "角色与用户当前的关系阶段",
      enum: RELATIONSHIP_STAGES,
      updateRule: RELATIONSHIP_RULE
    },
    {
      key: "心情",
      type: "enum",
      default: "平静",
      description: "角色当前主导心情",
      enum: ["开心", "平静", "害羞", "烦躁", "难过"],
      updateRule: "仅在当前场景出现明确情绪变化时更新；短暂措辞不代表主导心情改变"
    },
    {
      key: "当前状态",
      type: "string",
      default: "初次见面",
      description: "角色正在做什么以及与用户的互动状态（一句话）",
      updateRule: "角色行动或互动目标改变时用一句话概括；没有变化时保持原值"
    },
    {
      key: "地点.当前地点",
      type: "string",
      default: "教室",
      description: "角色与用户当前所在地点",
      updateRule: "明确发生场景移动后更新；只改变视角或提及其他地点时不要更新"
    },
    ...timeVariables()
  ]
};
function roleVariables(role, initiallyPresent) {
  const presencePath = `角色.${role}.是否在场`;
  const gate = `仅当 ${presencePath}为 true 时更新；不在场时保持原值`;
  return [
    {
      key: presencePath,
      type: "boolean",
      default: initiallyPresent,
      description: `${role}是否实际出现在当前场景`,
      updateRule: "角色进入当前场景时设为 true，明确离开时设为 false；仅被提及不算在场"
    },
    {
      key: `角色.${role}.好感度`,
      type: "number",
      default: 20,
      description: `${role}对用户的好感（0~100）`,
      range: [0, 100],
      updateRule: `${gate}
正面互动 +1~3；重大事件 ±5~10；输出更新后的完整数值`
    },
    {
      key: `角色.${role}.关系阶段`,
      type: "enum",
      default: "熟悉",
      description: `${role}与用户的关系阶段`,
      enum: RELATIONSHIP_STAGES,
      updateRule: `${gate}
${RELATIONSHIP_RULE}`
    },
    {
      key: `角色.${role}.当前状态`,
      type: "string",
      default: "等待互动",
      description: `${role}正在做什么以及当前情绪（一句话）`,
      updateRule: `${gate}
行动或主导情绪明确改变时更新为一句话概括`
    },
    {
      key: `角色.${role}.所在位置`,
      type: "string",
      default: "未知",
      description: `${role}当前所在位置`,
      updateRule: "角色移动或剧情明确交代其位置时更新；即使不在用户当前场景也可更新已知位置"
    },
    {
      key: `角色.${role}.穿着`,
      type: "string",
      default: "日常便服",
      description: `${role}当前主要穿着`,
      updateRule: `${gate}
明确换装或衣物状态显著变化时更新；未提及时保持原值`
    }
  ];
}
function instantiateRomanceMulti(parameters) {
  const roleA = normalizeRoleName(parameters.roleA, "角色A");
  const roleB = normalizeRoleName(parameters.roleB, "角色B");
  if (roleA === roleB) throw new Error("模板角色名不能重复");
  return [
    ...roleVariables(roleA, true),
    ...roleVariables(roleB, false),
    {
      key: "地点.当前地点",
      type: "string",
      default: "客厅",
      description: "用户当前所在地点",
      updateRule: "用户明确移动到新场景后更新；仅提及地点时保持原值"
    },
    ...timeVariables()
  ];
}
function normalizeRoleName(raw, fallback) {
  const name = raw?.trim() || fallback;
  if (name.includes(".")) throw new Error("模板角色名不能包含点号");
  if (!isSafePath(`角色.${name}.变量`)) throw new Error("模板角色名包含危险路径字段");
  return name;
}
var romanceMultiParameters = [
  { key: "roleA", label: "角色 1 名称", default: "角色A" },
  { key: "roleB", label: "角色 2 名称", default: "角色B" }
];
var romanceMulti = {
  id: "romance-multi",
  name: "恋爱 · 多角色",
  description: "为两个角色分别维护在场、好感、关系、状态、位置和穿着；导入前可直接填写角色名。",
  parameters: romanceMultiParameters,
  instantiate: instantiateRomanceMulti,
  variables: instantiateRomanceMulti(Object.fromEntries(romanceMultiParameters.map((item) => [item.key, item.default])))
};
var rpg = {
  id: "rpg",
  name: "RPG 冒险",
  description: "生命、法力、金币、等级、身体状态、位置与完整日期时间。",
  variables: [
    {
      key: "生命值",
      type: "number",
      default: 100,
      description: "当前生命（0~100）",
      range: [0, 100],
      updateRule: "战斗受伤通常 -10~30；休息或治疗按剧情恢复；归零后状态必须改为昏迷"
    },
    {
      key: "法力值",
      type: "number",
      default: 50,
      description: "当前法力（0~100）",
      range: [0, 100],
      updateRule: "施法按强度消耗 5~30；休息、药剂或法力源按剧情恢复；输出计算后的完整数值"
    },
    {
      key: "金币",
      type: "number",
      default: 0,
      description: "当前持有金币",
      range: [0, 999999],
      updateRule: "交易、战利品或悬赏结算时增减；输出计算后的总额，禁止输出增量"
    },
    {
      key: "等级",
      type: "number",
      default: 1,
      description: "冒险者等级（1~99）",
      range: [1, 99],
      updateRule: "只有剧情明确确认升级时增加 1；不得因普通战斗自动增长或跳级"
    },
    {
      key: "当前地点",
      type: "string",
      default: "新手村",
      description: "冒险者当前所在地",
      updateRule: "队伍明确移动并抵达新地点后更新；途中提及目的地时保持原值"
    },
    {
      key: "状态",
      type: "enum",
      default: "正常",
      description: "冒险者当前身体状态",
      enum: ["正常", "受伤", "中毒", "昏迷"],
      updateRule: "由战斗、治疗和事件驱动；生命值归零时必须为昏迷，恢复意识后再按剧情调整"
    },
    ...timeVariables()
  ]
};
var daily = {
  id: "daily",
  name: "日常陪伴",
  description: "好感、心情、体力、活动、地点与完整日期时间，适合慢节奏日常卡。",
  variables: [
    {
      key: "好感度",
      type: "number",
      default: 30,
      description: "角色对用户的好感（0~100）",
      range: [0, 100],
      updateRule: "日常正面互动 +1~2；特别时刻 +3~5；冷落或伤害 -1~5；无实质互动时保持不变"
    },
    {
      key: "心情",
      type: "enum",
      default: "平静",
      description: "角色当前主导心情",
      enum: ["开心", "平静", "疲惫", "低落", "兴奋"],
      updateRule: "场景出现明确情绪变化时更新；短暂语气变化不代表主导心情改变"
    },
    {
      key: "体力",
      type: "number",
      default: 100,
      description: "角色当前体力（0~100）",
      range: [0, 100],
      updateRule: "活动通常消耗 5~15；休息或进食按剧情恢复；跨日充分睡眠后可恢复到 100"
    },
    {
      key: "当前活动",
      type: "string",
      default: "闲聊",
      description: "角色当前正在做的事（一句话）",
      updateRule: "主要活动改变时更新为一句话；动作细节变化但活动未变时保持原值"
    },
    {
      key: "地点.当前地点",
      type: "string",
      default: "家里",
      description: "角色与用户当前所在地点",
      updateRule: "明确移动并抵达新地点后更新；只计划外出时保持原值"
    },
    ...timeVariables()
  ]
};
var survivalExploration = {
  id: "survival-exploration",
  name: "生存探索",
  description: "生命、饥饿、口渴、疲劳、体感温度、危险、地点与时间，适合荒野和末日探索。",
  variables: [
    {
      key: "生存.生命值",
      type: "number",
      default: 100,
      description: "当前生命值（0~100，0 表示失去行动能力）",
      range: [0, 100],
      updateRule: "受伤、疾病或恶劣环境时按剧情降低；治疗和安全休息时恢复；输出完整数值"
    },
    {
      key: "生存.饥饿度",
      type: "number",
      default: 10,
      description: "当前饥饿程度（0~100，越高越饥饿）",
      range: [0, 100],
      updateRule: "随活动和时间缓慢增加，进食后按食物份量降低；未经过明显时间时不要变化"
    },
    {
      key: "生存.口渴度",
      type: "number",
      default: 10,
      description: "当前口渴程度（0~100，越高越缺水）",
      range: [0, 100],
      updateRule: "随时间、炎热和剧烈活动增加，饮水后降低；变化通常快于饥饿度"
    },
    {
      key: "生存.疲劳度",
      type: "number",
      default: 5,
      description: "当前疲劳程度（0~100，越高越疲劳）",
      range: [0, 100],
      updateRule: "移动、战斗和缺眠时增加，休息或睡眠后降低；短暂对话不应显著变化"
    },
    {
      key: "环境.体感温度",
      type: "enum",
      default: "舒适",
      description: "角色当前的体感温度状态",
      enum: ["舒适", "寒冷", "炎热", "失温", "中暑"],
      updateRule: "由天气、衣物、庇护和持续暴露决定；只有环境或防护条件变化时更新"
    },
    {
      key: "环境.危险等级",
      type: "enum",
      default: "安全",
      description: "当前区域对角色的即时危险等级",
      enum: ["安全", "警戒", "危险", "致命"],
      updateRule: "根据已发现的敌人、灾害和退路判断；潜在风险未被发现前不要使用全知信息"
    },
    {
      key: "地点.当前地点",
      type: "string",
      default: "临时营地",
      description: "角色当前所在地点或区域",
      updateRule: "明确移动并抵达新区域后更新；仍在途中时保留当前区域并在正文描述移动"
    },
    ...timeVariables()
  ]
};
var mysteryInvestigation = {
  id: "mystery-investigation",
  name: "悬疑调查",
  description: "调查目标、线索摘要、嫌疑、紧迫度、阶段、地点与时间，适合推理和侦探剧情。",
  variables: [
    {
      key: "调查.当前目标",
      type: "string",
      default: "确认事件经过",
      description: "调查者当前最直接的调查目标（一句话）",
      updateRule: "目标完成、失效或出现更优先线索时更新；同时只保留一个最直接目标"
    },
    {
      key: "调查.线索摘要",
      type: "string",
      default: "尚无可靠线索",
      description: "已确认关键线索的简短摘要，不记录未经证实的猜测",
      updateRule: "获得、排除或重新解释关键线索时重写摘要；只写角色已知信息，避免全知泄露"
    },
    {
      key: "调查.嫌疑度",
      type: "number",
      default: 10,
      description: "当前主要怀疑方向的可信程度（0~100）",
      range: [0, 100],
      updateRule: "可靠证据支持时 +5~20，反证出现时 -5~30；普通直觉只允许小幅变化"
    },
    {
      key: "调查.紧迫度",
      type: "number",
      default: 20,
      description: "案件时间压力或即时威胁（0~100）",
      range: [0, 100],
      updateRule: "截止临近、威胁升级或证据将消失时增加；解除威胁或争取到时间后降低"
    },
    {
      key: "调查.阶段",
      type: "enum",
      default: "案发",
      description: "当前调查流程阶段",
      enum: ["案发", "勘查", "推理", "对质", "结案"],
      updateRule: "完成当前阶段的关键行动后推进一级；证据不足时不得从勘查直接跳到结案"
    },
    {
      key: "地点.当前地点",
      type: "string",
      default: "案发现场",
      description: "调查者当前所在地点",
      updateRule: "明确抵达新的调查地点后更新；提及其他地点或远程联络时保持原值"
    },
    ...timeVariables()
  ]
};
var questProgression = {
  id: "quest-progression",
  name: "任务推进",
  description: "目标、进度、阶段、阻碍、截止压力和完成状态，适合长期主线与委托。",
  variables: [
    {
      key: "任务.目标",
      type: "string",
      default: "确认任务目标",
      description: "当前任务的可验证最终目标（一句话）",
      updateRule: "任务被正式替换或目标条件改变时更新；执行步骤变化不等于最终目标变化"
    },
    {
      key: "任务.进度",
      type: "number",
      default: 0,
      description: "任务总体完成进度（0~100）",
      range: [0, 100],
      updateRule: "完成可验证里程碑时增加 5~30；普通对话不增加；任务失败可按实际损失回退"
    },
    {
      key: "任务.阶段",
      type: "enum",
      default: "未开始",
      description: "当前任务执行阶段",
      enum: ["未开始", "进行中", "受阻", "收尾", "已完成"],
      updateRule: "按实际执行状态更新；主要阻碍未解除时保持受阻，完成验收后才进入已完成"
    },
    {
      key: "任务.阻碍",
      type: "string",
      default: "无",
      description: "当前阻止任务推进的首要问题",
      updateRule: "出现新的首要阻碍时更新，解除后改为下一个阻碍或“无”；不要罗列次要困难"
    },
    {
      key: "任务.截止压力",
      type: "enum",
      default: "无",
      description: "任务截止期限造成的当前压力",
      enum: ["无", "低", "中", "高", "迫近"],
      updateRule: "根据剩余时间和所需工作量调整；时间推进但余量充足时不必升级"
    },
    {
      key: "任务.已完成",
      type: "boolean",
      default: false,
      description: "任务是否已满足最终目标并完成验收",
      updateRule: "只有最终目标已满足且剧情确认完成时设为 true；任务重开或验收失败时才恢复 false"
    },
    ...timeVariables()
  ]
};
var NEWVAR_TEMPLATES = [
  romanceSingle,
  romanceMulti,
  rpg,
  daily,
  survivalExploration,
  mysteryInvestigation,
  questProgression
];

// st-extension/src/apps/newvar/designer.ts
function typeLabels() {
  return {
    number: t("variableDesigner.number", "数字"),
    string: t("variableDesigner.string", "文本"),
    boolean: t("variableDesigner.boolean", "布尔"),
    enum: t("variableDesigner.enum", "枚举")
  };
}
function templateDisplay(tpl, customId) {
  if (customId !== null) return {
    name: tpl.name,
    description: tpl.description === `自定义 · ${tpl.variables.length} 项` ? t("variableDesigner.custom_count", "自定义 · {{count}} 项", { count: tpl.variables.length }) : tpl.description
  };
  switch (tpl.id) {
    case "romance-single":
      return {
        name: t("variableDesigner.templates_romance_single", "恋爱 · 单角色"),
        description: t("variableDesigner.templates_romance_single_description", "好感、关系阶段、心情、行动和完整日期时间；关系按明确阈值小步推进。")
      };
    case "romance-multi":
      return {
        name: t("variableDesigner.templates_romance_multi", "恋爱 · 多角色"),
        description: t("variableDesigner.templates_romance_multi_description", "为两个角色分别维护在场、好感、关系、状态、位置和穿着；导入前可直接填写角色名。")
      };
    case "rpg":
      return {
        name: t("variableDesigner.templates_rpg", "RPG 冒险"),
        description: t("variableDesigner.templates_rpg_description", "生命、法力、金币、等级、身体状态、位置与完整日期时间。")
      };
    case "daily":
      return {
        name: t("variableDesigner.templates_daily", "日常陪伴"),
        description: t("variableDesigner.templates_daily_description", "好感、心情、体力、活动、地点与完整日期时间，适合慢节奏日常卡。")
      };
    case "survival-exploration":
      return {
        name: t("variableDesigner.templates_survival", "生存探索"),
        description: t("variableDesigner.templates_survival_description", "生命、饥饿、口渴、疲劳、体感温度、危险、地点与时间，适合荒野和末日探索。")
      };
    case "mystery-investigation":
      return {
        name: t("variableDesigner.templates_mystery", "悬疑调查"),
        description: t("variableDesigner.templates_mystery_description", "调查目标、线索摘要、嫌疑、紧迫度、阶段、地点与时间，适合推理和侦探剧情。")
      };
    case "quest-progression":
      return {
        name: t("variableDesigner.templates_quest", "任务推进"),
        description: t("variableDesigner.templates_quest_description", "目标、进度、阶段、阻碍、截止压力和完成状态，适合长期主线与委托。")
      };
    default:
      return tpl;
  }
}
function draftFromDef(def) {
  return {
    key: def.key,
    type: def.type,
    defaultText: formatValue(def.default),
    description: def.description,
    rangeText: def.range ? `${def.range[0]}~${def.range[1]}` : "",
    enumText: (def.enum ?? []).join(", "),
    updateRule: def.updateRule ?? "",
    hidden: def.hidden === true
  };
}
function emptyDraft2() {
  return {
    key: "",
    type: "number",
    defaultText: "0",
    description: "",
    rangeText: "",
    enumText: "",
    updateRule: "",
    hidden: false
  };
}
function draftToDef(draft) {
  const key = draft.key.trim();
  if (!key) return { error: t("variableDesigner.path_required", "请填写变量路径。") };
  if (!isSafePath(key)) return { error: t("variableDesigner.unsafe_path", "变量路径不能包含 __proto__、prototype 或 constructor。") };
  const def = { key, type: draft.type, default: void 0, description: draft.description.trim() };
  if (draft.hidden) def.hidden = true;
  if (draft.updateRule.trim()) def.updateRule = draft.updateRule.trim();
  if (draft.type === "number") {
    const range = parseRange(draft.rangeText);
    if (range === false) return { error: t("variableDesigner.invalid_range", "范围格式应为「最小~最大」，如 0~100。") };
    if (range) def.range = range;
    const n = Number(draft.defaultText.trim());
    let dflt = Number.isFinite(n) ? n : 0;
    if (def.range) dflt = Math.min(def.range[1], Math.max(def.range[0], dflt));
    def.default = dflt;
  } else if (draft.type === "boolean") {
    def.default = draft.defaultText.trim() === "true";
  } else if (draft.type === "enum") {
    const options = draft.enumText.split(/[,，]/).map((s) => s.trim()).filter((s) => s !== "");
    if (options.length === 0) return { error: t("variableDesigner.enum_required", "枚举类型至少需要一个选项（逗号分隔）。") };
    def.enum = options;
    def.default = options.includes(draft.defaultText.trim()) ? draft.defaultText.trim() : options[0];
  } else {
    def.default = draft.defaultText;
  }
  return { def };
}
function cloneDefs(defs) {
  return JSON.parse(JSON.stringify(defs));
}
function parseRange(text4) {
  const t2 = text4.trim();
  if (!t2) return null;
  const m = /^(-?\d+(?:\.\d+)?)\s*~\s*(-?\d+(?:\.\d+)?)$/.exec(t2);
  if (!m) return false;
  const min = Number(m[1]);
  const max = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return false;
  return [min, max];
}
function createNewvarDesigner(deps) {
  let backdrop = null;
  let body = null;
  let focus = null;
  let formDraft = null;
  let editingIndex = null;
  let scrollToEditor = false;
  function applyBackdropSize() {
    if (!backdrop) return;
    backdrop.style.left = "0";
    backdrop.style.top = "0";
    backdrop.style.width = `${window.innerWidth}px`;
    backdrop.style.height = `${window.innerHeight}px`;
  }
  function open() {
    if (backdrop) {
      render2();
      return;
    }
    formDraft = null;
    editingIndex = null;
    backdrop = el2("div", "so-manager-backdrop");
    window.addEventListener("resize", applyBackdropSize);
    applyBackdropSize();
    const dialog = el2("div", "so-manager");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", t("variableDesigner.title", "变量设计"));
    const header = el2("div", "so-manager-header");
    const title2 = el2("div", "so-manager-title");
    title2.textContent = t("variableDesigner.title", "变量设计");
    const closeBtn = el2("div", "menu_button so-manager-close");
    closeBtn.textContent = "✕";
    closeBtn.title = t("variableDesigner.close", "关闭");
    closeBtn.setAttribute("aria-label", closeBtn.title);
    closeBtn.setAttribute("role", "button");
    closeBtn.tabIndex = 0;
    closeBtn.addEventListener("click", close);
    closeBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    });
    header.append(title2, closeBtn);
    body = el2("div", "so-manager-body");
    dialog.append(header, body);
    backdrop.append(dialog);
    document.body.append(backdrop);
    focus = manageDialogFocus(dialog, { onEscape: close, layer: backdrop });
    render2();
    focus.focusInitial();
  }
  function close() {
    if (!backdrop) return;
    const closingFocus = focus;
    focus = null;
    closingFocus?.dispose();
    window.removeEventListener("resize", applyBackdropSize);
    backdrop.remove();
    backdrop = null;
    body = null;
    formDraft = null;
    editingIndex = null;
    deps.onClosed?.();
    closingFocus?.restoreFocus();
  }
  function save(next) {
    deps.setData(next);
    render2();
  }
  function render2() {
    if (!body) return;
    const restore = captureVariableFocus(body);
    try {
      body.textContent = "";
      body.append(
        buildTemplateSection(),
        buildDefsSection(),
        buildSettingsSection(),
        buildPreviewSection(),
        buildLogSection()
      );
      if (scrollToEditor) {
        scrollToEditor = false;
        body.querySelector(".nv-defs-editor")?.scrollIntoView?.({ block: "nearest" });
        body.querySelector(".nv-defs-editor input")?.focus({ preventScroll: true });
      } else if (restore && !restore()) {
        body.querySelector(".nv-defs-editor .so-app-btn")?.focus({ preventScroll: true });
      }
    } catch (err) {
      console.error("[st-stage] 变量设计弹窗渲染失败", err);
    }
  }
  function section2(titleText) {
    const box = el2("div", "so-section");
    const title2 = el2("div", "so-section-title");
    title2.textContent = titleText;
    box.append(title2);
    return { box };
  }
  function descLine(parent, text4) {
    const d = el2("div", "so-app-desc");
    d.textContent = text4;
    parent.append(d);
  }
  function buildTemplateSection() {
    const data = deps.getData();
    const { box } = section2(t("variableDesigner.templates", "模板库（一键起步）"));
    descLine(box, t("variableDesigner.template_help", "「替换」清空现有定义后导入；「追加」跳过重名路径合并。导入的规则都已写好，可再逐条微调。"));
    const grid = el2("div", "nv-tpl-grid");
    for (const tpl of NEWVAR_TEMPLATES) grid.append(buildTemplateCard(tpl, null));
    for (const tpl of data.customTemplates) grid.append(buildTemplateCard(tpl, tpl.id));
    box.append(grid);
    const saveRow = el2("div", "nv-tpl-save");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "text_pole so-app-input";
    nameInput.placeholder = t("variableDesigner.template_placeholder", "模板名（如 我的恋爱系统）");
    nameInput.autocomplete = "off";
    nameInput.setAttribute("aria-label", t("variableDesigner.template_name", "模板名"));
    const saveBtn = variableButton("menu_button vm-act");
    saveBtn.textContent = t("variableDesigner.save_template", "把当前定义存为模板");
    saveBtn.dataset.variableFocus = "save-template";
    saveBtn.addEventListener("click", () => {
      const cur = deps.getData();
      const name = nameInput.value.trim();
      if (!name) {
        window.alert(t("variableDesigner.template_name_required", "请先填写模板名。"));
        return;
      }
      if (cur.schema.variables.length === 0) {
        window.alert(t("variableDesigner.template_empty", "当前没有任何变量定义，无法保存为模板。"));
        return;
      }
      const tpl = {
        id: `custom-${Date.now().toString(36)}`,
        name,
        description: `自定义 · ${cur.schema.variables.length} 项`,
        variables: cloneDefs(cur.schema.variables)
      };
      save({ ...cur, customTemplates: [...cur.customTemplates, tpl] });
    });
    saveRow.append(nameInput, saveBtn);
    box.append(saveRow);
    return box;
  }
  function buildTemplateCard(tpl, customId) {
    const card = el2("div", "nv-tpl-card");
    card.dataset.variableFocusScope = `template:${tpl.id}`;
    card.setAttribute("role", "group");
    card.setAttribute("aria-label", templateDisplay(tpl, customId).name);
    const name = el2("div", "vm-key");
    name.textContent = t("variableDesigner.template_count", "{{name}}（{{count}} 项）", { name: templateDisplay(tpl, customId).name, count: tpl.variables.length });
    const desc = el2("div", "vm-desc nv-tpl-desc");
    desc.textContent = templateDisplay(tpl, customId).description;
    card.append(name, desc);
    const builtIn = customId === null ? tpl : null;
    const parameterInputs = /* @__PURE__ */ new Map();
    for (const parameter of builtIn?.parameters ?? []) {
      const row = el2("label", "so-app-toggle");
      const label = document.createElement("span");
      label.textContent = parameter.key === "roleA" ? t("variableDesigner.role_one", "角色 1 名称") : parameter.key === "roleB" ? t("variableDesigner.role_two", "角色 2 名称") : parameter.label;
      const input = document.createElement("input");
      input.type = "text";
      input.className = "text_pole so-app-input";
      input.value = parameter.default;
      input.autocomplete = "off";
      row.append(label, input);
      card.append(row);
      parameterInputs.set(parameter.key, input);
    }
    const resolveVariables = () => {
      if (!builtIn?.instantiate) return tpl.variables;
      const parameters = Object.fromEntries([...parameterInputs].map(([key, input]) => [key, input.value.trim()]));
      const names = Object.values(parameters);
      if (names.some((value) => value === "")) {
        window.alert(t("variableDesigner.roles_required", "请填写所有模板角色名。"));
        return null;
      }
      if (new Set(names).size !== names.length) {
        window.alert(t("variableDesigner.roles_duplicate", "模板角色名不能重复。"));
        return null;
      }
      if (names.some((value) => value.includes(".") || !isSafePath(`角色.${value}.变量`))) {
        window.alert(t("variableDesigner.roles_unsafe", "角色名不能包含点号或危险路径字段。"));
        return null;
      }
      return builtIn.instantiate(parameters);
    };
    const actions = el2("div", "nv-tpl-actions");
    const replaceBtn = variableButton("menu_button vm-act");
    replaceBtn.textContent = t("variableDesigner.replace", "替换");
    replaceBtn.dataset.variableFocus = `template:${tpl.id}:replace`;
    replaceBtn.addEventListener("click", () => {
      const variables = resolveVariables();
      if (!variables) return;
      const cur = deps.getData();
      if (cur.schema.variables.length > 0 && !window.confirm(t("variableDesigner.replace_confirm", "用「{{name}}」替换现有 {{count}} 条定义？（楼层快照不受影响）", { name: templateDisplay(tpl, customId).name, count: cur.schema.variables.length }))) {
        return;
      }
      formDraft = null;
      editingIndex = null;
      save({ ...cur, schema: { ...cur.schema, name: tpl.name, variables: cloneDefs(variables) } });
    });
    const appendBtn = variableButton("menu_button vm-act vm-act-ghost");
    appendBtn.textContent = t("variableDesigner.append", "追加");
    appendBtn.dataset.variableFocus = `template:${tpl.id}:append`;
    appendBtn.addEventListener("click", () => {
      const variables = resolveVariables();
      if (!variables) return;
      const cur = deps.getData();
      const existing = new Set(cur.schema.variables.map((v) => v.key));
      const added = variables.filter((v) => !existing.has(v.key));
      if (added.length === 0) {
        window.alert(t("variableDesigner.no_new_paths", "该模板的变量路径都已存在，没有可追加的项。"));
        return;
      }
      save({ ...cur, schema: { ...cur.schema, variables: [...cur.schema.variables, ...cloneDefs(added)] } });
    });
    actions.append(replaceBtn, appendBtn);
    if (customId) {
      const delBtn = variableButton("menu_button vm-act vm-act-ghost nv-tpl-del");
      delBtn.textContent = t("variableDesigner.delete", "删除");
      delBtn.addEventListener("click", () => {
        if (!window.confirm(t("variableDesigner.delete_template_confirm", "删除自定义模板「{{name}}」？", { name: tpl.name }))) return;
        const cur = deps.getData();
        save({ ...cur, customTemplates: cur.customTemplates.filter((t2) => t2.id !== customId) });
      });
      actions.append(delBtn);
    }
    card.append(actions);
    return card;
  }
  function buildDefsSection() {
    const data = deps.getData();
    const { box } = section2(t("variableDesigner.definitions", "变量定义（{{count}}）", { count: data.schema.variables.length }));
    const layout = el2("div", "nv-defs-layout");
    const list = el2("div", "nv-defs-list");
    const editor = el2("div", "nv-defs-editor");
    if (data.schema.variables.length === 0) {
      descLine(list, t("variableDesigner.no_definitions", "还没有变量。从上方模板一键导入，或点右侧「添加变量」逐条定义。"));
    }
    for (let i = 0; i < data.schema.variables.length; i++) {
      list.append(buildDefRow(data.schema.variables[i], i));
    }
    if (formDraft) {
      editor.append(buildDefForm());
    } else {
      const hint = el2("div", "so-app-desc");
      hint.textContent = t("variableDesigner.edit_hint", "点击左侧变量进行编辑，或新建：");
      editor.append(
        hint,
        appButton(t("variableDesigner.add", "＋ 添加变量"), () => {
          formDraft = emptyDraft2();
          editingIndex = null;
          scrollToEditor = true;
          render2();
        })
      );
    }
    layout.append(list, editor);
    box.append(layout);
    return box;
  }
  function buildDefRow(def, index) {
    const selected = editingIndex === index;
    const card = el2("div", `vm-leaf${selected ? " nv-def-selected" : ""}`);
    const main = el2("div", "vm-leaf-main");
    main.dataset.variableFocus = `definition:${def.key}`;
    const keyEl = el2("span", "vm-key");
    keyEl.textContent = def.key;
    const meta = el2("span", "vm-val");
    const parts = [typeLabels()[def.type], t("variableDesigner.default_summary", "默认 {{value}}", { value: formatValue(def.default) })];
    if (def.range) parts.push(t("variableDesigner.range_summary", "范围 {{min}}~{{max}}", { min: def.range[0], max: def.range[1] }));
    if (def.enum) parts.push(t("variableDesigner.enum_summary", "枚举 {{options}}", { options: def.enum.join("/") }));
    if (def.hidden) parts.push(t("variableDesigner.hidden", "对 AI 隐藏"));
    meta.textContent = parts.join(" · ");
    main.append(keyEl, meta);
    if (def.description) {
      const desc = el2("div", "vm-desc");
      desc.textContent = def.description;
      main.append(desc);
    }
    if (def.updateRule) {
      const rule = el2("div", "vm-desc");
      rule.textContent = t("variableDesigner.rules_summary", "规则：{{rules}}", { rules: def.updateRule.split("\n").join("；") });
      main.append(rule);
    }
    main.setAttribute("role", "button");
    main.tabIndex = 0;
    const edit = () => {
      formDraft = draftFromDef(def);
      editingIndex = index;
      scrollToEditor = true;
      render2();
    };
    main.addEventListener("click", edit);
    main.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        edit();
      }
    });
    const del = variableButton("vm-del");
    del.setAttribute("aria-label", t("variableDesigner.delete_path", "删除定义 {{path}}", { path: def.key }));
    del.title = t("variableDesigner.delete_definition_title", "删除该变量定义");
    del.textContent = "✕";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!window.confirm(t("variableDesigner.delete_definition_confirm", "删除变量定义「{{path}}」？（已保存的楼层快照不受影响）", { path: def.key }))) return;
      const cur = deps.getData();
      if (editingIndex === index) {
        formDraft = null;
        editingIndex = null;
      }
      save({ ...cur, schema: { ...cur.schema, variables: cur.schema.variables.filter((_, i) => i !== index) } });
    });
    card.append(main, del);
    return card;
  }
  function buildDefForm() {
    const draft = formDraft;
    const wrap = el2("div", "vm-leaf vm-editing");
    const title2 = el2("div", "so-app-title vm-edit-title");
    title2.textContent = editingIndex === null ? t("variableDesigner.new_definition", "新变量定义") : t("variableDesigner.edit", "编辑：{{path}}", { path: draft.key || t("variableDesigner.unnamed", "（未命名）") });
    wrap.append(title2);
    const err = el2("div", "so-app-desc vm-add-err");
    err.hidden = true;
    err.setAttribute("role", "alert");
    wrap.append(
      textRow(t("variableDesigner.path", "路径（点号分层）"), draft.key, t("variableDesigner.path_example", "如 状态.体力 / 角色.小雪.好感度"), (v) => draft.key = v),
      selectRow(
        t("variableDesigner.type", "类型"),
        draft.type,
        Object.keys(typeLabels()).map((t2) => ({ value: t2, label: typeLabels()[t2] })),
        (v) => {
          draft.type = v;
          render2();
        }
      ),
      textRow(t("variableDesigner.default", "默认值"), draft.defaultText, draft.type === "boolean" ? "true / false" : "", (v) => draft.defaultText = v),
      textRow(t("variableDesigner.description", "描述（给 AI 看）"), draft.description, t("variableDesigner.description_example", "如 角色对用户的好感"), (v) => draft.description = v)
    );
    if (draft.type === "number") {
      wrap.append(textRow(t("variableDesigner.range", "范围（可空）"), draft.rangeText, t("variableDesigner.range_example", "如 0~100，越界自动修正"), (v) => draft.rangeText = v));
    }
    if (draft.type === "enum") {
      wrap.append(textRow(t("variableDesigner.enum_options", "枚举选项（逗号分隔）"), draft.enumText, t("variableDesigner.enum_example", "如 开心, 平静, 烦躁"), (v) => draft.enumText = v));
    }
    wrap.append(
      textareaRow(
        t("variableDesigner.rules", "更新规则（每行一条，注入给 AI）"),
        draft.updateRule,
        t("variableDesigner.rules_example", "如：正面互动 +1~3\n重大事件 ±5~10\n禁止无缘由跳变"),
        (v) => draft.updateRule = v
      ),
      toggleRow(t("variableDesigner.hidden_input", "对 AI 隐藏（内部计算用）"), draft.hidden, (v) => draft.hidden = v),
      err
    );
    const actions = el2("div", "vm-actions");
    const saveBtn = variableButton("menu_button vm-act");
    saveBtn.textContent = t("variableDesigner.save_definition", "保存定义");
    saveBtn.addEventListener("click", () => {
      const r = draftToDef(draft);
      if (!r.def) {
        err.textContent = r.error ?? t("variableDesigner.invalid", "输入无效。");
        err.hidden = false;
        return;
      }
      const cur = deps.getData();
      const dup = cur.schema.variables.findIndex((v, i) => v.key === r.def.key && i !== editingIndex);
      if (dup >= 0) {
        err.textContent = t("variableDesigner.duplicate_path", "路径「{{path}}」已有定义。", { path: r.def.key });
        err.hidden = false;
        return;
      }
      const variables = [...cur.schema.variables];
      if (editingIndex !== null && editingIndex < variables.length) variables[editingIndex] = r.def;
      else variables.push(r.def);
      formDraft = null;
      editingIndex = null;
      save({ ...cur, schema: { ...cur.schema, variables } });
    });
    const cancel = variableButton("menu_button vm-act vm-act-ghost");
    cancel.dataset.variableFocus = "cancel-definition";
    cancel.textContent = t("variableDesigner.cancel", "取消");
    cancel.addEventListener("click", () => {
      formDraft = null;
      editingIndex = null;
      render2();
    });
    saveBtn.dataset.variableFocus = "save-definition";
    actions.append(saveBtn, cancel);
    wrap.append(actions);
    return wrap;
  }
  function buildSettingsSection() {
    const data = deps.getData();
    const { box } = section2(t("variableDesigner.settings", "生成设置"));
    box.append(
      selectRow(
        t("variableDesigner.format", "输出格式"),
        data.format,
        [
          { value: "json_patch", label: t("variableDesigner.json_patch", "JSON Patch（推荐）") },
          { value: "lodash_set", label: t("variableDesigner.lodash_set", "_.set（老版 MVU 兼容）") }
        ],
        (v) => save({ ...deps.getData(), format: v === "lodash_set" ? "lodash_set" : "json_patch" })
      ),
      numberRow(
        t("variableDesigner.depth", "注入深度（距末尾楼层数）"),
        data.injectionDepth,
        0,
        20,
        (v) => save({ ...deps.getData(), injectionDepth: v })
      )
    );
    return box;
  }
  function buildPreviewSection() {
    const fold = foldSection(t("variableDesigner.preview", "注入预览"));
    const text4 = deps.buildPreview();
    if (text4) {
      const pre = el2("div", "nv-pre");
      pre.textContent = text4;
      fold.body.append(pre);
    } else {
      descLine(fold.body, t("variableDesigner.no_preview", "（未启用或未定义任何变量时不注入。启用开关在手机「新变量」页。）"));
    }
    const wrap = el2("div", "so-section");
    wrap.append(fold.box);
    return wrap;
  }
  function buildLogSection() {
    const fold = foldSection(t("variableDesigner.log", "解析日志"));
    const report = deps.getLastParse();
    if (!report) {
      descLine(fold.body, t("variableDesigner.no_log", "尚无解析记录。AI 回复包含 <UpdateVariable> 块时，这里显示逐条接受/修正/拒绝结果。"));
    } else {
      descLine(fold.body, t("variableDesigner.message_log", "楼层 #{{id}}{{error}}", { id: report.messageId, error: report.error ? t("variableDesigner.parse_error", " · 解析出错：{{error}}", { error: report.error }) : "" }));
      const icons = { accepted: "✅", corrected: "⚠️", rejected: "❌", removed: "🗑️" };
      const labels = {
        accepted: t("variableDesigner.log_accepted", "已接受"),
        corrected: t("variableDesigner.log_corrected", "已修正"),
        rejected: t("variableDesigner.log_rejected", "已拒绝"),
        removed: t("variableDesigner.log_removed", "已删除")
      };
      for (const entry of report.log) {
        const line = el2("div", "so-app-desc nv-log-line");
        line.textContent = `${icons[entry.status] ?? "·"} ${labels[entry.status]} · ${entry.path}${entry.detail ? ` — ${entry.detail}` : ""}`;
        fold.body.append(line);
      }
    }
    const wrap = el2("div", "so-section");
    wrap.append(fold.box);
    return wrap;
  }
  return { open, close, isOpen: () => backdrop !== null };
}

// st-extension/src/apps/renderer/parser.ts
var OPEN_TAG = "<STStageRender>";
var CLOSE_TAG = "</STStageRender>";
var TAG_PREFIX = "<STStageRender";
var CLOSE_TAG_PREFIX = "</STStageRender";
var MAX_JSON_BYTES = 64 * 1024;
var MAX_BARE_SCAN_CHARS = 1024 * 1024;
var MAX_ARRAY_ITEMS = 12;
var MAX_BEATS = 50;
var MAX_CARDS = 8;
var MAX_RENDERER_BLOCKS = 3;
function firstError(...errors) {
  return errors.find((error) => error !== null) ?? null;
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function checkKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) return `${label}包含未知字段: ${key}`;
  }
  return null;
}
function getRequiredString(value, key, label, maxLength) {
  const field = value[key];
  if (typeof field !== "string" || field.trim().length === 0) return `${label}.${key} 必须是非空字符串`;
  if (field.length > maxLength) return `${label}.${key} 超过最大长度 ${maxLength}`;
  if (/<\/?[a-z][^>]*>/i.test(field)) return `${label}.${key} 不接受 HTML`;
  return null;
}
function getOptionalString(value, key, label, maxLength) {
  if (!(key in value)) return null;
  const field = value[key];
  if (typeof field !== "string") return `${label}.${key} 必须是字符串`;
  if (field.length > maxLength) return `${label}.${key} 超过最大长度 ${maxLength}`;
  if (/<\/?[a-z][^>]*>/i.test(field)) return `${label}.${key} 不接受 HTML`;
  return null;
}
function getNumber(value, key, label, min, max) {
  const field = value[key];
  if (typeof field !== "number" || !Number.isFinite(field) || !Number.isInteger(field)) {
    return `${label}.${key} 必须是有限整数`;
  }
  if (field < min || field > max) return `${label}.${key} 必须在 ${min}-${max} 范围内`;
  return null;
}
function getBoolean(value, key, label) {
  if (typeof value[key] !== "boolean") return `${label}.${key} 必须是布尔值`;
  return null;
}
function isSafeImageUrl(value) {
  if (/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(value)) return true;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0;
    } catch {
      return false;
    }
  }
  if (value.startsWith("//") || value.includes("\\") || /[\s<>]/.test(value)) return false;
  const localPrefix = /^(?:\/user\/|\.\/|assets\/|\/scripts\/extensions\/third-party\/)/i;
  if (!localPrefix.test(value)) return false;
  const path = value.split(/[?#]/, 1)[0].replace(/^\.\//, "");
  try {
    return !path.split("/").some((segment) => {
      let decoded = segment;
      for (let depth = 0; depth < 2; depth += 1) {
        decoded = decodeURIComponent(decoded);
        if (decoded === "." || decoded === ".." || /[\\/]/.test(decoded)) return true;
      }
      return false;
    });
  } catch {
    return false;
  }
}
function getOptionalImageUrl(value, key, label) {
  const error = getOptionalString(value, key, label, 2048);
  if (error !== null) return error;
  if (!(key in value)) return null;
  if (!isSafeImageUrl(value[key])) return `${label}.${key} 不是安全图片 URL`;
  return null;
}
function getOptionalPortrait(value, key, label) {
  const error = getOptionalString(value, key, label, 500);
  if (error !== null) return error;
  if (!(key in value)) return null;
  const portrait = value[key];
  if (/^sprite:[^\s<>]{1,493}$/u.test(portrait) || isSafeImageUrl(portrait)) return null;
  return `${label}.${key} 不是安全图片 URL 或 sprite 地址`;
}
function findDuplicateId(items) {
  const ids = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (ids.has(item.id)) return item.id;
    ids.add(item.id);
  }
  return null;
}
function validateGal(value) {
  const keys = ["version", "mode", "title", "scene", "background", "beats"];
  const keyError = checkKeys(value, keys, "gal");
  if (keyError) return keyError;
  if (value.version !== 1) return "version 只支持 1";
  if (value.mode !== "gal") return "mode 只支持 gal、cards 或 battle";
  for (const [key, max] of [["title", 200], ["scene", 500]]) {
    const error = key === "title" ? getOptionalString(value, key, "gal", max) : getRequiredString(value, key, "gal", max);
    if (error) return error;
  }
  const backgroundError = getOptionalImageUrl(value, "background", "gal");
  if (backgroundError) return backgroundError;
  if (!Array.isArray(value.beats) || value.beats.length < 1) return "gal.beats 至少需要 1 项";
  if (value.beats.length > MAX_BEATS) return "gal.beats 必须在 1-50 范围内";
  const beats = [];
  for (const [index, item] of value.beats.entries()) {
    if (!isRecord3(item)) return `gal.beats[${index}] 必须是对象`;
    const itemError = checkKeys(item, ["speaker", "text", "portrait", "background"], `gal.beats[${index}]`);
    if (itemError) return itemError;
    const contentError = firstError(
      getRequiredString(item, "speaker", `gal.beats[${index}]`, 100),
      getRequiredString(item, "text", `gal.beats[${index}]`, 2e3),
      getOptionalPortrait(item, "portrait", `gal.beats[${index}]`),
      getOptionalImageUrl(item, "background", `gal.beats[${index}]`)
    );
    if (contentError) return contentError;
    beats.push({
      speaker: item.speaker,
      text: item.text,
      ...item.portrait === void 0 ? {} : { portrait: item.portrait },
      ...item.background === void 0 ? {} : { background: item.background }
    });
  }
  return {
    version: 1,
    mode: "gal",
    ...value.title === void 0 ? {} : { title: value.title },
    scene: value.scene,
    ...value.background === void 0 ? {} : { background: value.background },
    beats
  };
}
function validateCard(value, index) {
  if (!isRecord3(value)) return `cards.cards[${index}] 必须是对象`;
  const label = `cards.cards[${index}]`;
  const keyError = checkKeys(value, ["id", "title", "description", "consequence", "action"], label);
  if (keyError) return keyError;
  const errors = [
    getRequiredString(value, "id", label, 100),
    getRequiredString(value, "title", label, 200),
    getRequiredString(value, "description", label, 1e3),
    getOptionalString(value, "consequence", label, 1e3),
    getRequiredString(value, "action", label, 2e3)
  ];
  const error = firstError(...errors);
  if (error) return error;
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    ...value.consequence === void 0 ? {} : { consequence: value.consequence },
    action: value.action
  };
}
function validateCards(value) {
  const keyError = checkKeys(value, ["version", "mode", "title", "cards"], "cards");
  if (keyError) return keyError;
  if (value.version !== 1) return "version 只支持 1";
  if (value.mode !== "cards") return "mode 只支持 gal、cards 或 battle";
  const titleError = getRequiredString(value, "title", "cards", 200);
  if (titleError) return titleError;
  if (!Array.isArray(value.cards) || value.cards.length < 2) return "cards.cards 至少需要 2 项";
  if (value.cards.length > MAX_CARDS) return "cards.cards 必须在 2-8 范围内";
  const cards = [];
  for (const [index, item] of value.cards.entries()) {
    const card = validateCard(item, index);
    if (typeof card === "string") return card;
    cards.push(card);
  }
  const duplicateId = findDuplicateId(cards);
  if (duplicateId) return `cards.cards 包含重复 ID: ${duplicateId}`;
  return { version: 1, mode: "cards", title: value.title, cards };
}
function validateSkill(value, index) {
  if (!isRecord3(value)) return `battle.skills[${index}] 必须是对象`;
  const label = `battle.skills[${index}]`;
  const keyError = checkKeys(value, ["id", "name", "description", "type", "mpCost", "power"], label);
  if (keyError) return keyError;
  const stringError = firstError(getRequiredString(value, "id", label, 100), getRequiredString(value, "name", label, 100), getOptionalString(value, "description", label, 500));
  if (stringError) return stringError;
  if (value.type !== "damage" && value.type !== "heal") return `${label}.type 只支持 damage 或 heal`;
  const numericError = firstError(getNumber(value, "mpCost", label, 0, 9999), getNumber(value, "power", label, 0, 9999));
  if (numericError) return numericError;
  return {
    id: value.id,
    name: value.name,
    ...value.description === void 0 ? {} : { description: value.description },
    type: value.type,
    mpCost: value.mpCost,
    power: value.power
  };
}
function validateItem(value, index) {
  if (!isRecord3(value)) return `battle.items[${index}] 必须是对象`;
  const label = `battle.items[${index}]`;
  const keyError = checkKeys(value, ["id", "name", "description", "effect", "quantity", "power"], label);
  if (keyError) return keyError;
  const stringError = firstError(getRequiredString(value, "id", label, 100), getRequiredString(value, "name", label, 100), getOptionalString(value, "description", label, 500));
  if (stringError) return stringError;
  if (value.effect !== "heal_hp" && value.effect !== "heal_mp") return `${label}.effect 只支持 heal_hp 或 heal_mp`;
  const numericError = firstError(getNumber(value, "quantity", label, 0, 9999), getNumber(value, "power", label, 0, 9999));
  if (numericError) return numericError;
  return {
    id: value.id,
    name: value.name,
    ...value.description === void 0 ? {} : { description: value.description },
    effect: value.effect,
    quantity: value.quantity,
    power: value.power
  };
}
function validateStatus(value, index) {
  if (!isRecord3(value)) return `battle.statuses[${index}] 必须是对象`;
  const label = `battle.statuses[${index}]`;
  const keyError = checkKeys(value, ["id", "name", "duration", "attackDelta", "defenseDelta", "damagePerTurn"], label);
  if (keyError) return keyError;
  const stringError = firstError(getRequiredString(value, "id", label, 100), getRequiredString(value, "name", label, 100));
  if (stringError) return stringError;
  const durationError = getNumber(value, "duration", label, 1, 9999);
  if (durationError) return durationError;
  for (const key of ["attackDelta", "defenseDelta", "damagePerTurn"]) {
    const min = key === "damagePerTurn" ? 0 : -9999;
    const error = key in value ? getNumber(value, key, label, min, 9999) : null;
    if (error) return error;
  }
  return {
    id: value.id,
    name: value.name,
    duration: value.duration,
    ...value.attackDelta === void 0 ? {} : { attackDelta: value.attackDelta },
    ...value.defenseDelta === void 0 ? {} : { defenseDelta: value.defenseDelta },
    ...value.damagePerTurn === void 0 ? {} : { damagePerTurn: value.damagePerTurn }
  };
}
function validateFighter(value, label) {
  if (!isRecord3(value)) return `${label} 必须是对象`;
  const keyError = checkKeys(value, ["id", "name", "hp", "maxHp", "mp", "maxMp", "attack", "defense", "speed", "crit", "dodge", "portrait", "skills", "items", "statuses"], label);
  if (keyError) return keyError;
  const identityError = firstError(getRequiredString(value, "id", label, 100), getRequiredString(value, "name", label, 100));
  if (identityError) return identityError;
  const numericErrors = [
    getNumber(value, "hp", label, 0, 9999),
    getNumber(value, "maxHp", label, 1, 9999),
    getNumber(value, "mp", label, 0, 9999),
    getNumber(value, "maxMp", label, 0, 9999),
    getNumber(value, "attack", label, 0, 9999),
    getNumber(value, "defense", label, 0, 9999),
    getNumber(value, "speed", label, 0, 9999),
    getNumber(value, "crit", label, 0, 100),
    getNumber(value, "dodge", label, 0, 100)
  ];
  const numericError = numericErrors.find((item) => item !== null);
  if (numericError) return numericError;
  if (value.hp > value.maxHp) return `${label}.hp 必须小于等于 maxHp`;
  if (value.mp > value.maxMp) return `${label}.mp 必须小于等于 maxMp`;
  const portraitError = getOptionalPortrait(value, "portrait", label);
  if (portraitError) return portraitError;
  const parsed = {
    id: value.id,
    name: value.name,
    hp: value.hp,
    maxHp: value.maxHp,
    mp: value.mp,
    maxMp: value.maxMp,
    attack: value.attack,
    defense: value.defense,
    speed: value.speed,
    crit: value.crit,
    dodge: value.dodge,
    ...value.portrait === void 0 ? {} : { portrait: value.portrait }
  };
  const validators = [
    { key: "skills", validate: validateSkill },
    { key: "items", validate: validateItem },
    { key: "statuses", validate: validateStatus }
  ];
  for (const { key, validate } of validators) {
    if (!(key in value)) continue;
    const items = value[key];
    if (!Array.isArray(items)) return `${label}.${key} 必须是数组`;
    if (items.length > MAX_ARRAY_ITEMS) return `${label}.${key} 最多 12 项`;
    const parsedItems = [];
    for (const [index, item] of items.entries()) {
      const parsedItem = validate(item, index);
      if (typeof parsedItem === "string") return parsedItem;
      parsedItems.push(parsedItem);
    }
    const duplicateId = findDuplicateId(parsedItems);
    if (duplicateId) return `${label}.${key} 包含重复 ID: ${duplicateId}`;
    if (key === "skills") parsed.skills = parsedItems;
    if (key === "items") parsed.items = parsedItems;
    if (key === "statuses") parsed.statuses = parsedItems;
  }
  return parsed;
}
function validateBattle(value) {
  const keyError = checkKeys(value, ["version", "mode", "title", "background", "player", "enemy", "enemyIntent", "allowFlee"], "battle");
  if (keyError) return keyError;
  if (value.version !== 1) return "version 只支持 1";
  if (value.mode !== "battle") return "mode 只支持 gal、cards 或 battle";
  const titleError = getRequiredString(value, "title", "battle", 200);
  if (titleError) return titleError;
  const backgroundError = getOptionalImageUrl(value, "background", "battle");
  if (backgroundError) return backgroundError;
  const player = validateFighter(value.player, "battle.player");
  if (typeof player === "string") return player;
  const enemy = validateFighter(value.enemy, "battle.enemy");
  if (typeof enemy === "string") return enemy;
  if (player.id === enemy.id) return `battle.player 与 battle.enemy 包含重复 ID: ${player.id}`;
  const intentError = getOptionalString(value, "enemyIntent", "battle", 500);
  if (intentError) return intentError;
  const fleeError = "allowFlee" in value ? getBoolean(value, "allowFlee", "battle") : null;
  if (fleeError) return fleeError;
  return {
    version: 1,
    mode: "battle",
    title: value.title,
    ...value.background === void 0 ? {} : { background: value.background },
    player,
    enemy,
    ...value.enemyIntent === void 0 ? {} : { enemyIntent: value.enemyIntent },
    ...value.allowFlee === void 0 ? {} : { allowFlee: value.allowFlee }
  };
}
function validateBlock(value) {
  if (!isRecord3(value)) return "渲染块必须是 JSON 对象";
  if (value.version !== 1) return "version 只支持 1";
  if (value.mode === "gal") return validateGal(value);
  if (value.mode === "cards") return validateCards(value);
  if (value.mode === "battle") return validateBattle(value);
  return "mode 只支持 gal、cards 或 battle";
}
function parseBareRendererBlocks(source) {
  if (source.length > MAX_BARE_SCAN_CHARS) return [];
  const accepted = [];
  let objectStart = -1;
  let objectDepth = 0;
  let arrayDepth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (objectDepth > 0) {
      if (char === "{") objectDepth += 1;
      else if (char === "}") objectDepth -= 1;
      if (objectDepth !== 0) continue;
      const start = objectStart;
      const raw = source.slice(start, index + 1);
      objectStart = -1;
      if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) continue;
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        continue;
      }
      const block = validateBlock(value);
      if (typeof block === "string") continue;
      accepted.push({ block, raw, start, end: index + 1 });
      if (accepted.length >= MAX_RENDERER_BLOCKS) return accepted;
      continue;
    }
    if (char === "[") arrayDepth += 1;
    else if (char === "]") arrayDepth = Math.max(0, arrayDepth - 1);
    else if (char === "{" && arrayDepth === 0) {
      objectStart = index;
      objectDepth = 1;
    }
  }
  return accepted;
}
function parseWrappedRendererBlocks(source) {
  const accepted = [];
  let cursor = 0;
  while (true) {
    const start = source.indexOf(OPEN_TAG, cursor);
    if (start < 0) break;
    const close = source.indexOf(CLOSE_TAG, start + OPEN_TAG.length);
    if (close < 0) break;
    const end = close + CLOSE_TAG.length;
    const json = source.slice(start + OPEN_TAG.length, close);
    cursor = end;
    if (new TextEncoder().encode(json).byteLength > MAX_JSON_BYTES) continue;
    let value;
    try {
      value = JSON.parse(json);
    } catch {
      continue;
    }
    const block = validateBlock(value);
    if (typeof block === "string") continue;
    accepted.push({ block, raw: source.slice(start, end), start, end });
    if (accepted.length >= MAX_RENDERER_BLOCKS) break;
  }
  return accepted;
}
function parseRendererBlocks(source) {
  if (typeof source !== "string") return [];
  if (source.includes(OPEN_TAG)) return parseWrappedRendererBlocks(source);
  if (source.includes(TAG_PREFIX) || source.includes(CLOSE_TAG_PREFIX)) return [];
  return parseBareRendererBlocks(source);
}

// st-extension/src/apps/renderer/runtime.ts
var RENDERER_CLASS = "st-stage-renderer";
var SOURCE_CLASS = "st-stage-render-source";
var MARKER_CLASS2 = "st-stage-render-marker";
function isModeEnabled(settings, mode) {
  if (mode === "gal") return settings.galEnabled;
  if (mode === "cards") return settings.cardsEnabled;
  return settings.battleEnabled;
}
function findTextBoundary(root, target) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let last = null;
  let current2;
  while (current2 = walker.nextNode()) {
    const node = current2;
    const length = node.data.length;
    if (target <= consumed + length) return { node, offset: target - consumed };
    consumed += length;
    last = node;
  }
  return target === consumed && last ? { node: last, offset: last.data.length } : null;
}
function hideSourceBlock(root, parsed) {
  const text4 = root.textContent ?? "";
  if (text4.slice(parsed.start, parsed.end) !== parsed.raw) return null;
  const start = findTextBoundary(root, parsed.start);
  const end = findTextBoundary(root, parsed.end);
  if (!start || !end) return null;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const source = document.createElement("span");
  source.className = SOURCE_CLASS;
  source.hidden = true;
  source.append(range.extractContents());
  range.insertNode(source);
  return source;
}
function outsideSignature(root, mounts) {
  const holder = document.createElement("div");
  const owned = new Set(mounts.flatMap((state2) => [state2.marker, state2.container]));
  for (const node of Array.from(root.childNodes)) {
    if (!owned.has(node)) holder.append(node.cloneNode(true));
  }
  return holder.innerHTML;
}
function stillOwnsDom(root, state2) {
  return state2.mounts.every((mount) => mount.marker.parentNode === root && mount.container.parentNode === root) && outsideSignature(root, state2.mounts) === state2.outsideSignature;
}
function destroyMount(state2) {
  if (state2.destroyed) return;
  state2.destroyed = true;
  try {
    state2.mount.destroy();
  } catch {
  }
}
function createRendererRuntime(deps) {
  const states = /* @__PURE__ */ new WeakMap();
  const mountedRoots = /* @__PURE__ */ new Set();
  const modeDeps = deps.modeDeps ?? { getSettings: deps.getSettings };
  let disposed = false;
  function cleanupRoot(root) {
    const state2 = states.get(root);
    if (!state2) return;
    for (const mount of state2.mounts) destroyMount(mount);
    if (stillOwnsDom(root, state2)) {
      root.replaceChildren(...state2.snapshot);
    } else {
      for (const mount of state2.mounts) {
        mount.marker.remove();
        mount.container.remove();
        if (root.contains(mount.source)) mount.source.replaceWith(...Array.from(mount.source.childNodes));
      }
    }
    states.delete(root);
    mountedRoots.delete(root);
  }
  function pruneDetachedRoots() {
    for (const root of Array.from(mountedRoots)) {
      if (!root.isConnected) cleanupRoot(root);
    }
  }
  function processMessage(root) {
    if (disposed) return;
    pruneDetachedRoots();
    if (!root.isConnected) return;
    const settings = deps.getSettings();
    const current2 = states.get(root);
    if (current2 && stillOwnsDom(root, current2) && settings.enabled && current2.mounts.every((mount) => isModeEnabled(settings, mount.mode))) return;
    if (current2) cleanupRoot(root);
    const message = root.closest(".mes");
    if (message?.getAttribute("is_user") === "true" || message?.getAttribute("is_system") === "true") return;
    if (!settings.enabled) return;
    const snapshot = Array.from(root.childNodes).map((node) => node.cloneNode(true));
    const prepared = [];
    for (const parsed of parseRendererBlocks(root.textContent ?? "")) {
      if (!isModeEnabled(settings, parsed.block.mode)) continue;
      const factory = deps.factories[parsed.block.mode];
      if (!factory) continue;
      const container = document.createElement("section");
      container.className = RENDERER_CLASS;
      try {
        const mount = factory(container, parsed.block, modeDeps);
        if (!mount || typeof mount.destroy !== "function") continue;
        prepared.push({ parsed, container, mount });
      } catch {
        continue;
      }
    }
    if (prepared.length === 0) return;
    const mounts = [];
    for (const item of [...prepared].reverse()) {
      const source = (() => {
        try {
          return hideSourceBlock(root, item.parsed);
        } catch {
          return null;
        }
      })();
      if (!source) {
        try {
          item.mount.destroy();
        } catch {
        }
        continue;
      }
      const marker = document.createElement("span");
      marker.className = MARKER_CLASS2;
      marker.hidden = true;
      mounts.unshift({
        mount: item.mount,
        marker,
        source,
        container: item.container,
        mode: item.parsed.block.mode,
        destroyed: false
      });
    }
    if (mounts.length === 0) return;
    for (const mount of mounts) root.append(mount.marker, mount.container);
    states.set(root, { mounts, snapshot, outsideSignature: outsideSignature(root, mounts) });
    mountedRoots.add(root);
  }
  function reprocessAll(scope = document) {
    if (disposed) return;
    for (const root of Array.from(mountedRoots)) cleanupRoot(root);
    const roots = [];
    if (scope instanceof HTMLElement && scope.matches(".mes_text")) roots.push(scope);
    for (const root of Array.from(scope.querySelectorAll(".mes_text"))) roots.push(root);
    for (const root of roots) processMessage(root);
  }
  function dispose() {
    if (disposed) return;
    for (const root of Array.from(mountedRoots)) cleanupRoot(root);
    disposed = true;
  }
  return { processMessage, reprocessAll, dispose };
}

// st-extension/src/apps/renderer/modes/gal.ts
var TYPEWRITER_INTERVAL_MS = 24;
function textElement(tag, className, text4) {
  const element2 = document.createElement(tag);
  element2.className = className;
  element2.textContent = text4;
  return element2;
}
function stageImage(className, src, alt) {
  const image = document.createElement("img");
  image.className = className;
  image.src = src;
  image.alt = alt;
  image.draggable = false;
  image.addEventListener("error", () => {
    image.hidden = true;
  });
  return image;
}
function resolvePortrait(value, deps) {
  if (!value) return null;
  if (!value.startsWith("sprite:")) return value;
  try {
    return deps.resolvePortrait?.(value.slice("sprite:".length)) ?? null;
  } catch {
    return null;
  }
}
function resolveBeatPortrait(portrait, speaker, deps) {
  if (portrait !== void 0) return resolvePortrait(portrait, deps);
  try {
    return deps.resolveSpeakerPortrait?.(speaker) ?? null;
  } catch {
    return null;
  }
}
function mountGalMode(root, block, deps) {
  const stage = document.createElement("div");
  stage.className = "st-render-gal";
  stage.setAttribute("role", "group");
  stage.setAttribute("aria-label", block.title ?? block.scene);
  const backgroundLayer = document.createElement("div");
  backgroundLayer.className = "st-render-gal-background-layer";
  const header = document.createElement("header");
  header.className = "st-render-gal-header";
  if (block.title) header.append(textElement("div", "st-render-gal-title", block.title));
  header.append(textElement("div", "st-render-gal-scene", block.scene));
  const portraitLayer = document.createElement("div");
  portraitLayer.className = "st-render-gal-portrait-layer";
  const dialogueBox = document.createElement("div");
  dialogueBox.className = "st-render-gal-dialogue-box";
  const speaker = textElement("div", "st-render-gal-speaker", "");
  const dialogue = textElement("div", "st-render-gal-dialogue", "");
  dialogue.setAttribute("aria-live", "polite");
  const controls = document.createElement("div");
  controls.className = "st-render-gal-controls";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "st-render-gal-control";
  previous.setAttribute("aria-label", "上一句");
  previous.title = "上一句";
  previous.textContent = "←";
  const progress = textElement("span", "st-render-gal-progress", "");
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "st-render-gal-control st-render-gal-skip";
  skip.setAttribute("aria-label", "跳过");
  skip.textContent = "跳过";
  const next = document.createElement("button");
  next.type = "button";
  next.className = "st-render-gal-control";
  next.setAttribute("aria-label", "下一句");
  next.title = "下一句";
  next.textContent = "→";
  controls.append(previous, progress, skip, next);
  dialogueBox.append(speaker, dialogue, controls);
  stage.append(backgroundLayer, header, portraitLayer, dialogueBox);
  root.replaceChildren(stage);
  root.tabIndex = 0;
  let index = 0;
  let timer = null;
  let fullDialogue = "";
  let dialogueUnits = [];
  let cursor = 0;
  let destroyed = false;
  function stopTyping(complete) {
    if (timer === null) return false;
    clearInterval(timer);
    timer = null;
    if (complete) dialogue.textContent = fullDialogue;
    return true;
  }
  function renderDialogue(text4, forceInstant = false) {
    stopTyping(false);
    fullDialogue = text4;
    dialogueUnits = Array.from(text4);
    cursor = 0;
    const settings = deps.getSettings();
    if (forceInstant || settings.reducedMotion || !settings.typewriter) {
      dialogue.textContent = text4;
      return;
    }
    dialogue.textContent = "";
    timer = setInterval(() => {
      if (destroyed) return;
      cursor += 1;
      dialogue.textContent = dialogueUnits.slice(0, cursor).join("");
      if (cursor >= dialogueUnits.length) stopTyping(false);
    }, TYPEWRITER_INTERVAL_MS);
  }
  function renderBeat(forceInstant = false) {
    const beat = block.beats[index];
    speaker.textContent = beat.speaker;
    renderDialogue(beat.text, forceInstant);
    backgroundLayer.replaceChildren();
    const background = beat.background ?? block.background;
    if (background) backgroundLayer.append(stageImage("st-render-gal-background", background, ""));
    portraitLayer.replaceChildren();
    const portrait = resolveBeatPortrait(beat.portrait, beat.speaker, deps);
    if (portrait) portraitLayer.append(stageImage("st-render-gal-portrait", portrait, beat.speaker));
    previous.disabled = index === 0;
    next.disabled = index === block.beats.length - 1;
    skip.disabled = false;
    progress.textContent = `${index + 1} / ${block.beats.length}`;
  }
  function goPrevious() {
    if (index === 0) return;
    stopTyping(false);
    index -= 1;
    renderBeat();
  }
  function goNext() {
    if (stopTyping(true)) return;
    if (index >= block.beats.length - 1) return;
    index += 1;
    renderBeat();
  }
  function goLast() {
    stopTyping(false);
    index = block.beats.length - 1;
    renderBeat(true);
  }
  function onKeyDown(event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    } else if (event.key === "End") {
      event.preventDefault();
      goLast();
    }
  }
  previous.addEventListener("click", goPrevious);
  next.addEventListener("click", goNext);
  skip.addEventListener("click", goLast);
  root.addEventListener("keydown", onKeyDown);
  renderBeat();
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopTyping(false);
      root.removeEventListener("keydown", onKeyDown);
      previous.removeEventListener("click", goPrevious);
      next.removeEventListener("click", goNext);
      skip.removeEventListener("click", goLast);
    }
  };
}

// st-extension/src/apps/renderer/modes/cards.ts
function textElement2(tag, className, text4) {
  const element2 = document.createElement(tag);
  element2.className = className;
  element2.textContent = text4;
  return element2;
}
function createCard(card) {
  const article = document.createElement("article");
  article.className = "st-render-card";
  article.dataset.cardId = card.id;
  article.append(
    textElement2("h3", "st-render-card-title", card.title),
    textElement2("p", "st-render-card-description", card.description)
  );
  if (card.consequence) article.append(textElement2("p", "st-render-card-consequence", card.consequence));
  const button2 = document.createElement("button");
  button2.type = "button";
  button2.className = "st-render-card-select";
  button2.dataset.cardId = card.id;
  button2.setAttribute("aria-pressed", "false");
  button2.textContent = "✓ 填入输入框";
  article.append(button2);
  return article;
}
function mountCardsMode(root, block, deps) {
  const section2 = document.createElement("section");
  section2.className = "st-render-cards";
  const title2 = textElement2("h2", "st-render-cards-title", block.title);
  const grid = document.createElement("div");
  grid.className = "st-render-cards-grid";
  for (const card of block.cards) grid.append(createCard(card));
  const status = textElement2("div", "st-render-cards-status", "");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  section2.append(title2, grid, status);
  root.replaceChildren(section2);
  const cards = new Map(block.cards.map((card) => [card.id, card]));
  let destroyed = false;
  function setSelected(selectedId) {
    for (const element2 of Array.from(grid.querySelectorAll(".st-render-card"))) {
      const selected = selectedId !== null && element2.dataset.cardId === selectedId;
      element2.classList.toggle("st-render-card-selected", selected);
      element2.querySelector(".st-render-card-select")?.setAttribute("aria-pressed", String(selected));
    }
  }
  function onClick(event) {
    if (destroyed || !(event.target instanceof Element)) return;
    const button2 = event.target.closest(".st-render-card-select");
    if (!button2 || !root.contains(button2)) return;
    const card = cards.get(button2.dataset.cardId ?? "");
    if (!card) return;
    const result = deps.insertDraft?.(card.action) ?? { ok: false, error: "未找到 SillyTavern 输入框。" };
    if (!result.ok) {
      setSelected(null);
      status.textContent = result.error;
      status.className = "st-render-cards-status st-render-cards-status-error";
      return;
    }
    setSelected(card.id);
    status.className = "st-render-cards-status st-render-cards-status-success";
    status.textContent = `已填入，请检查后发送：${card.title}`;
  }
  root.addEventListener("click", onClick);
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.removeEventListener("click", onClick);
    }
  };
}

// st-extension/src/apps/renderer/battle-engine.ts
var DEFENDING_STATUS_ID = "__defending";
function bounded(value, min = 0, max = 9999) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
function cloneFighter(fighter) {
  return {
    ...fighter,
    skills: fighter.skills.map((skill) => ({ ...skill })),
    items: fighter.items.map((item) => ({ ...item })),
    statuses: fighter.statuses.map((status) => ({ ...status }))
  };
}
function cloneState(state2) {
  return {
    ...state2,
    player: cloneFighter(state2.player),
    enemy: cloneFighter(state2.enemy),
    log: state2.log.map((entry) => ({ ...entry }))
  };
}
function createFighter(config) {
  return {
    ...config,
    hp: bounded(config.hp, 0, config.maxHp),
    mp: bounded(config.mp, 0, config.maxMp),
    skills: (config.skills ?? []).map((skill) => ({ ...skill })),
    items: (config.items ?? []).map((item) => ({ ...item })),
    statuses: (config.statuses ?? []).map((status) => ({ ...status }))
  };
}
function effectiveStat(fighter, stat) {
  const field = stat === "attack" ? "attackDelta" : "defenseDelta";
  const delta = fighter.statuses.reduce((sum, status) => sum + (status[field] ?? 0), 0);
  return bounded(fighter[stat] + delta);
}
function upsertStatus(fighter, status) {
  const index = fighter.statuses.findIndex((item) => item.id === status.id);
  if (index >= 0) fighter.statuses[index] = { ...status };
  else fighter.statuses.push({ ...status });
}
function createRandom(source) {
  return () => {
    try {
      const value = source();
      return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
    } catch {
      return 0.5;
    }
  };
}
function createBattleEngine(config, deps = {}) {
  const random = createRandom(deps.random ?? Math.random);
  const player = createFighter(config.player);
  const enemy = createFighter(config.enemy);
  const state2 = {
    title: config.title,
    player,
    enemy,
    turn: 1,
    outcome: enemy.hp <= 0 ? "won" : player.hp <= 0 ? "lost" : "ongoing",
    log: [],
    allowFlee: config.allowFlee === true
  };
  function record(events, kind, text4) {
    const entry = { kind, text: text4 };
    events.push(entry);
    state2.log.push({ ...entry });
  }
  function dealDamage(attacker, target, power, events, allowCritical = true) {
    if (random() * 100 < target.dodge) {
      record(events, "dodge", `${target.name} 闪避了 ${attacker.name} 的攻击。`);
      return;
    }
    const critical = allowCritical && random() * 100 < attacker.crit;
    const raw = critical ? Math.floor(power * 1.5) : power;
    const damage = Math.max(1, bounded(raw - effectiveStat(target, "defense")));
    target.hp = bounded(target.hp - damage, 0, target.maxHp);
    record(events, "damage", `${attacker.name}${critical ? "暴击" : ""}对 ${target.name} 造成 ${damage} 点伤害。`);
  }
  function updateOutcome() {
    if (state2.enemy.hp <= 0) state2.outcome = "won";
    else if (state2.player.hp <= 0) state2.outcome = "lost";
  }
  function tickStatuses(fighter, events) {
    const next = [];
    for (const status of fighter.statuses) {
      if ((status.damagePerTurn ?? 0) > 0 && fighter.hp > 0) {
        const damage = bounded(status.damagePerTurn ?? 0);
        fighter.hp = bounded(fighter.hp - damage, 0, fighter.maxHp);
        record(events, "status-damage", `${fighter.name} 受到 ${status.name} 的 ${damage} 点伤害。`);
      }
      const duration = status.duration - 1;
      if (duration > 0) next.push({ ...status, duration });
    }
    fighter.statuses = next;
  }
  function runEnemyTurn(events) {
    if (state2.outcome !== "ongoing") return;
    dealDamage(state2.enemy, state2.player, effectiveStat(state2.enemy, "attack"), events);
    updateOutcome();
  }
  function finishRound(events) {
    tickStatuses(state2.player, events);
    tickStatuses(state2.enemy, events);
    updateOutcome();
    state2.turn += 1;
  }
  function reject(error) {
    return { ok: false, error, state: cloneState(state2), events: [] };
  }
  function dispatch(action) {
    if (state2.outcome !== "ongoing") return reject("战斗已经结束。");
    const actionType = action?.type;
    if (!["attack", "defend", "skill", "item", "flee"].includes(String(actionType))) {
      return reject("不支持的战斗动作。");
    }
    let validationError = null;
    let skill;
    let item;
    if (action.type === "skill") {
      skill = state2.player.skills.find((candidate) => candidate.id === action.skillId);
      if (!skill) validationError = "找不到该技能。";
      else if (state2.player.mp < skill.mpCost) validationError = "MP 不足。";
    } else if (action.type === "item") {
      item = state2.player.items.find((candidate) => candidate.id === action.itemId);
      if (!item) validationError = "找不到该物品。";
      else if (item.quantity <= 0) validationError = "该物品已经用完。";
    } else if (action.type === "flee" && !state2.allowFlee) {
      validationError = "本场战斗不能逃跑。";
    }
    if (validationError) return reject(validationError);
    const events = [];
    if (action.type === "attack") {
      dealDamage(state2.player, state2.enemy, effectiveStat(state2.player, "attack"), events);
    } else if (action.type === "defend") {
      upsertStatus(state2.player, {
        id: DEFENDING_STATUS_ID,
        name: "防御",
        duration: 1,
        defenseDelta: Math.max(10, effectiveStat(state2.player, "defense"))
      });
      record(events, "defend", `${state2.player.name} 进入防御姿态。`);
    } else if (action.type === "skill" && skill) {
      state2.player.mp = bounded(state2.player.mp - skill.mpCost, 0, state2.player.maxMp);
      if (skill.type === "damage") dealDamage(state2.player, state2.enemy, skill.power, events);
      else {
        const before = state2.player.hp;
        state2.player.hp = bounded(state2.player.hp + skill.power, 0, state2.player.maxHp);
        record(events, "heal", `${state2.player.name} 恢复 ${state2.player.hp - before} 点生命。`);
      }
    } else if (action.type === "item" && item) {
      item.quantity -= 1;
      const field = item.effect === "heal_hp" ? "hp" : "mp";
      const maxField = item.effect === "heal_hp" ? "maxHp" : "maxMp";
      const before = state2.player[field];
      state2.player[field] = bounded(before + item.power, 0, state2.player[maxField]);
      record(events, "heal", `${state2.player.name} 使用 ${item.name}，恢复 ${state2.player[field] - before} 点资源。`);
    } else if (action.type === "flee") {
      if (random() < 0.5) {
        state2.outcome = "fled";
        record(events, "flee", `${state2.player.name} 成功脱离战斗。`);
        return { ok: true, state: cloneState(state2), events: events.map((event) => ({ ...event })) };
      }
      record(events, "flee", `${state2.player.name} 逃跑失败。`);
    }
    updateOutcome();
    if (state2.outcome === "ongoing") runEnemyTurn(events);
    if (state2.outcome === "ongoing") finishRound(events);
    return { ok: true, state: cloneState(state2), events: events.map((event) => ({ ...event })) };
  }
  return {
    getState: () => cloneState(state2),
    dispatch
  };
}

// st-extension/src/apps/renderer/modes/battle.ts
var ACTION_DELAY_MS = 180;
function textElement3(tag, className, text4) {
  const element2 = document.createElement(tag);
  element2.className = className;
  element2.textContent = text4;
  return element2;
}
function imageElement(className, src, alt, onError) {
  const image = document.createElement("img");
  image.className = className;
  image.src = src;
  image.alt = alt;
  image.draggable = false;
  image.addEventListener("error", () => {
    image.hidden = true;
    onError?.();
  });
  return image;
}
function resolvePortrait2(value, deps) {
  if (!value) return null;
  if (!value.startsWith("sprite:")) return value;
  try {
    return deps.resolvePortrait?.(value.slice("sprite:".length)) ?? null;
  } catch {
    return null;
  }
}
function resourceRow(label, value, max, className) {
  const row = document.createElement("div");
  row.className = `st-render-resource ${className}`;
  const heading = textElement3("span", "st-render-resource-label", label);
  const progress = document.createElement("progress");
  progress.max = Math.max(1, max);
  progress.value = value;
  progress.setAttribute("aria-label", `${label} ${value} / ${max}`);
  const amount = textElement3("span", "st-render-resource-value", `${value} / ${max}`);
  row.append(heading, progress, amount);
  return row;
}
function combatantView(fighter, side, deps) {
  const card = document.createElement("section");
  card.className = `st-render-combatant st-render-combatant-${side}`;
  const heading = textElement3("h3", "st-render-combatant-name", fighter.name);
  const portrait = resolvePortrait2(fighter.portrait, deps);
  if (portrait) {
    card.append(imageElement("st-render-combatant-portrait", portrait, fighter.name, () => {
      card.classList.add("st-render-combatant-no-portrait");
    }));
  } else {
    card.classList.add("st-render-combatant-no-portrait");
  }
  card.append(
    heading,
    resourceRow("HP", fighter.hp, fighter.maxHp, "st-render-resource-hp"),
    resourceRow("MP", fighter.mp, fighter.maxMp, "st-render-resource-mp")
  );
  const statuses = document.createElement("div");
  statuses.className = "st-render-combatant-statuses";
  statuses.setAttribute("aria-label", "状态");
  for (const status of fighter.statuses) {
    statuses.append(textElement3("span", "st-render-status-chip", `${status.name} · ${status.duration}`));
  }
  card.append(statuses);
  return card;
}
function actionButton2(action, label, disabled) {
  const button2 = document.createElement("button");
  button2.type = "button";
  button2.className = "st-render-battle-action";
  button2.dataset.action = action;
  button2.textContent = label;
  button2.disabled = disabled;
  return button2;
}
function mountBattleMode(root, block, deps) {
  const engine = createBattleEngine(block, { random: deps.random });
  const section2 = document.createElement("section");
  section2.className = "st-render-battle";
  if (block.background) section2.append(imageElement("st-render-battle-background", block.background, ""));
  const content = document.createElement("div");
  content.className = "st-render-battle-content";
  const header = document.createElement("header");
  header.className = "st-render-battle-header";
  const title2 = textElement3("h2", "st-render-battle-title", block.title);
  const turn = textElement3("span", "st-render-battle-turn", "");
  header.append(title2, turn);
  const intent = textElement3("div", "st-render-battle-intent", block.enemyIntent ? `敌方意图：${block.enemyIntent}` : "");
  const combatants = document.createElement("div");
  combatants.className = "st-render-battle-combatants";
  const outcome = textElement3("div", "st-render-battle-outcome", "");
  outcome.setAttribute("role", "status");
  const log = document.createElement("ol");
  log.className = "st-render-battle-log";
  log.setAttribute("aria-label", "战斗日志");
  const actions = document.createElement("div");
  actions.className = "st-render-battle-actions";
  const notice = textElement3("div", "st-render-battle-notice", "");
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  content.append(header, intent, combatants, outcome, log, actions, notice);
  section2.append(content);
  root.replaceChildren(section2);
  let pending = false;
  let destroyed = false;
  let freeOpen = false;
  let timer = null;
  function outcomeText(state2) {
    if (state2.outcome === "won") return "战斗胜利";
    if (state2.outcome === "lost") return "战斗失败";
    if (state2.outcome === "fled") return "已脱离战斗";
    return "";
  }
  function continuationText(state2) {
    const summary = state2.log.slice(-6).map((entry) => entry.text).join(" ");
    return `战斗结果：${outcomeText(state2)}。战斗摘要：${summary || "战斗已结束。"}`;
  }
  function createSelect(className, options, disabled) {
    const select = document.createElement("select");
    select.className = className;
    select.disabled = disabled;
    for (const option of options) {
      const element2 = document.createElement("option");
      element2.value = option.id;
      element2.textContent = option.label;
      element2.disabled = option.disabled;
      select.append(element2);
    }
    const firstAvailable = options.find((option) => !option.disabled);
    if (firstAvailable) select.value = firstAvailable.id;
    return select;
  }
  function render2() {
    const state2 = engine.getState();
    const ended = state2.outcome !== "ongoing";
    turn.textContent = `回合 ${state2.turn}`;
    combatants.replaceChildren(
      combatantView(state2.player, "player", deps),
      combatantView(state2.enemy, "enemy", deps)
    );
    outcome.replaceChildren();
    if (ended) {
      outcome.append(
        textElement3("span", "st-render-battle-outcome-text", outcomeText(state2)),
        actionButton2("continue", "继续剧情", false)
      );
    }
    outcome.hidden = !ended;
    log.replaceChildren();
    if (state2.log.length === 0) log.append(textElement3("li", "st-render-battle-log-entry", "等待行动"));
    else {
      for (const entry of state2.log.slice(-12)) log.append(textElement3("li", `st-render-battle-log-entry st-render-battle-log-${entry.kind}`, entry.text));
    }
    actions.replaceChildren();
    const locked = ended || pending;
    const attack = actionButton2("attack", "⚔ 攻击", locked);
    const defend = actionButton2("defend", "◆ 防御", locked);
    const skillOptions = state2.player.skills.map((skill2) => ({
      id: skill2.id,
      label: `${skill2.name} · ${skill2.mpCost} MP`,
      disabled: state2.player.mp < skill2.mpCost
    }));
    const skillSelect = createSelect("st-render-battle-skill-select", skillOptions, locked || skillOptions.length === 0);
    const skill = actionButton2("skill", "✦ 施放技能", locked || !skillOptions.some((option) => !option.disabled));
    const itemOptions = state2.player.items.map((item2) => ({
      id: item2.id,
      label: `${item2.name} · ${item2.quantity}`,
      disabled: item2.quantity <= 0
    }));
    const itemSelect = createSelect("st-render-battle-item-select", itemOptions, locked || itemOptions.length === 0);
    const item = actionButton2("item", "＋ 使用物品", locked || !itemOptions.some((option) => !option.disabled));
    const flee = actionButton2("flee", "↗ 逃跑", locked || !state2.allowFlee);
    const free = actionButton2("free", "… 自由行动", locked);
    actions.append(attack, defend, skillSelect, skill, itemSelect, item, flee, free);
    if (freeOpen && !locked) {
      const freePanel = document.createElement("div");
      freePanel.className = "st-render-battle-free";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "st-render-battle-free-input";
      input.maxLength = 500;
      input.placeholder = "输入行动";
      const submit = actionButton2("free-submit", "填入草稿", false);
      freePanel.append(input, submit);
      actions.append(freePanel);
      input.focus();
    }
  }
  function execute(action) {
    if (destroyed) return;
    timer = null;
    const result = engine.dispatch(action);
    pending = false;
    notice.textContent = result.ok ? "" : result.error ?? "行动失败";
    render2();
  }
  function schedule(action) {
    if (pending || engine.getState().outcome !== "ongoing") return;
    freeOpen = false;
    if (deps.getSettings().reducedMotion) {
      execute(action);
      return;
    }
    pending = true;
    render2();
    timer = setTimeout(() => execute(action), ACTION_DELAY_MS);
  }
  function onClick(event) {
    if (destroyed || !(event.target instanceof Element)) return;
    const button2 = event.target.closest("button[data-action]");
    if (!button2 || !root.contains(button2) || button2.disabled) return;
    const action = button2.dataset.action;
    if (action === "attack" || action === "defend" || action === "flee") {
      schedule({ type: action });
    } else if (action === "skill") {
      const select = root.querySelector(".st-render-battle-skill-select");
      if (select?.value) schedule({ type: "skill", skillId: select.value });
    } else if (action === "item") {
      const select = root.querySelector(".st-render-battle-item-select");
      if (select?.value) schedule({ type: "item", itemId: select.value });
    } else if (action === "free") {
      freeOpen = !freeOpen;
      render2();
    } else if (action === "free-submit") {
      const input = root.querySelector(".st-render-battle-free-input");
      const value = input?.value.trim() ?? "";
      if (!value) {
        notice.textContent = "请输入自由行动。";
        return;
      }
      const result = deps.insertDraft?.(`战斗行动：${value}`) ?? { ok: false, error: "未找到 SillyTavern 输入框。" };
      notice.textContent = result.ok ? "已填入自由行动" : result.error;
    } else if (action === "continue") {
      const state2 = engine.getState();
      if (state2.outcome === "ongoing") return;
      const result = deps.insertDraft?.(continuationText(state2)) ?? { ok: false, error: "未找到 SillyTavern 输入框。" };
      notice.textContent = result.ok ? "已填入战斗结果" : result.error;
    }
  }
  root.addEventListener("click", onClick);
  render2();
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      root.removeEventListener("click", onClick);
    }
  };
}

// st-extension/src/apps/renderer/composer.ts
function createComposerBridge(deps = {}) {
  const findInput = deps.findInput ?? (() => findComposerTextarea());
  let owned = null;
  function insertDraft(text4) {
    const input = findInput();
    if (!input) return { ok: false, error: "未找到 SillyTavern 输入框。" };
    if (owned?.input === input) {
      if (input.value === "") owned = null;
      else if (input.value !== owned.value) return { ok: false, error: "输入草稿已修改，未覆盖你的内容。" };
    } else {
      owned = null;
      if (input.value !== "") return { ok: false, error: "输入框已有草稿，未覆盖你的内容。" };
    }
    input.value = text4;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    owned = { input, value: text4 };
    return { ok: true };
  }
  function dispose() {
    owned = null;
  }
  return { insertDraft, dispose };
}

// st-extension/src/apps/api/manager.ts
var MAIN_API_OPTIONS = [
  { value: "openai", label: "聊天补全（Chat Completion）" },
  { value: "textgenerationwebui", label: "文本补全（Text Completion）" },
  { value: "novel", label: "NovelAI" },
  { value: "kobold", label: "KoboldAI" },
  { value: "koboldhorde", label: "KoboldAI Horde" }
];
function createApiManager(deps) {
  let backdrop = null;
  let body = null;
  let draft = null;
  let editingId = null;
  let notice = "";
  const section2 = (title2) => {
    const box = el2("div", "so-section");
    const heading = el2("div", "so-section-title");
    heading.textContent = title2;
    box.append(heading);
    return box;
  };
  const desc = (box, text4) => {
    const line = el2("div", "so-app-desc");
    line.textContent = text4;
    box.append(line);
  };
  const save = (data) => {
    deps.setData(data);
    render2();
  };
  function open() {
    if (backdrop) return render2();
    backdrop = el2("div", "so-manager-backdrop");
    backdrop.style.inset = "0";
    const dialog = el2("div", "so-manager");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "API 连接档案管理");
    const header = el2("div", "so-manager-header");
    const title2 = el2("div", "so-manager-title");
    title2.textContent = "API 连接档案管理";
    const closeButton = el2("button", "menu_button so-manager-close");
    closeButton.textContent = "关闭";
    closeButton.addEventListener("click", close);
    header.append(title2, closeButton);
    body = el2("div", "so-manager-body");
    dialog.append(header, body);
    backdrop.append(dialog);
    document.body.append(backdrop);
    render2();
  }
  function close() {
    backdrop?.remove();
    backdrop = null;
    body = null;
    draft = null;
    editingId = null;
    deps.onClosed?.();
  }
  function edit(profile) {
    const { id: _id, version: _version, ...value } = profile;
    draft = { ...value, settings: { ...value.settings } };
    editingId = profile.id;
    notice = "";
    render2();
  }
  function render2() {
    if (!body) return;
    body.textContent = "";
    body.append(buildList(), buildEditor(), buildHelp());
  }
  function buildList() {
    const data = deps.getData();
    const box = section2(`连接档案（${data.profiles.length}）`);
    if (!data.profiles.length) desc(box, "还没有档案。可新建，或导入 SillyTavern 当前连接。");
    void readConnection({ withSecret: false }).then((connection) => {
      if (!connection || !body) return;
      const active = findActiveProfile(data.profiles, connection);
      body.querySelector(`[data-profile-id="${active?.id ?? ""}"]`)?.classList.add("stapi-row-on");
    });
    for (const profile of data.profiles) {
      const row = el2("div", "vm-leaf");
      row.dataset.profileId = profile.id;
      const main = el2("div", "vm-leaf-main");
      main.tabIndex = 0;
      main.setAttribute("role", "button");
      const name = el2("span", "vm-key");
      name.textContent = profile.name;
      const meta = el2("span", "vm-val");
      meta.textContent = profileSummary(profile).join(" · ");
      main.append(name, meta);
      main.addEventListener("click", () => edit(profile));
      const move = (label, delta) => {
        const button2 = el2("button", "vm-del stapi-move");
        button2.textContent = label;
        button2.addEventListener("click", () => save({ profiles: moveProfile(deps.getData().profiles, profile.id, delta) }));
        return button2;
      };
      const remove = el2("button", "vm-del");
      remove.textContent = "删除";
      remove.addEventListener("click", () => {
        if (window.confirm(`删除连接档案「${profile.name}」？`)) save({ profiles: deps.getData().profiles.filter((item) => item.id !== profile.id) });
      });
      row.append(main, move("↑", -1), move("↓", 1), remove);
      box.append(row);
    }
    box.append(appButton("＋ 添加连接档案", () => {
      draft = emptyDraft();
      editingId = null;
      notice = "";
      render2();
    }));
    return box;
  }
  function buildEditor() {
    const box = section2(draft ? editingId ? `编辑：${draft.name || "未命名"}` : "新增连接档案" : "档案编辑");
    if (!draft) {
      desc(box, "选择上方档案进行编辑，或添加一个新档案。");
      return box;
    }
    const d = draft;
    if (notice) {
      desc(box, notice);
      notice = "";
    }
    box.append(textRow("档案名称", d.name, "例如：主力 Claude", (value) => {
      d.name = value;
    }));
    box.append(selectRow("API 大类", d.mainApi, MAIN_API_OPTIONS, (value) => {
      d.mainApi = value;
      d.source = getSource(value, "").id;
      d.url = "";
      d.model = "";
      d.secretId = "";
      render2();
    }));
    if (d.mainApi === "openai") {
      const sources = [...COMMON_CHAT_SOURCES];
      const currentSource = getSource(d.mainApi, d.source);
      if (!sources.some((item) => item.id === currentSource.id)) sources.push(currentSource);
      box.append(selectRow("来源", d.source, sources.map((item) => ({ value: item.id, label: item.label })), (value) => {
        d.source = value;
        d.url = "";
        d.model = "";
        d.secretId = "";
        render2();
      }));
    }
    const descriptor = getSource(d.mainApi, d.source);
    if (descriptor.urlField) box.append(textRow("接口地址 URL", d.url, "https://example.com/v1", (value) => {
      d.url = value;
    }));
    if (descriptor.secretKey) box.append(textRow("API Key", d.key, d.secretMode === "unavailable" ? "当前 ST 不允许读取；留空可保留原值" : "明文保存在本扩展档案，并同步写入 ST 密钥库", (value) => {
      d.key = value.trim();
      d.secretMode = value ? "stored" : d.secretMode;
    }, "password"));
    if (descriptor.modelField || descriptor.supportsModels) box.append(textRow("模型 ID（可空）", d.model, "留空则沿用当前模型", (value) => {
      d.model = value;
    }));
    if (descriptor.supportsModels) box.append(appButton("从接口获取模型", () => void loadModels(d)));
    const extra = foldSection("附加参数（自定义接口）", Object.values(d.settings).some(Boolean));
    extra.body.append(
      textareaRow("包括主体参数", String(d.settings.custom_include_body ?? ""), "YAML 对象", (value) => {
        d.settings.custom_include_body = value;
      }),
      textareaRow("排除主体参数", String(d.settings.custom_exclude_body ?? ""), "每行一个参数名", (value) => {
        d.settings.custom_exclude_body = value;
      }),
      textareaRow("包含请求标头", String(d.settings.custom_include_headers ?? ""), "YAML 对象", (value) => {
        d.settings.custom_include_headers = value;
      })
    );
    if (d.source === "custom") box.append(extra.box);
    const actions = el2("div", "vm-actions");
    const saveButton = el2("button", "menu_button vm-act");
    saveButton.textContent = editingId ? "保存修改" : "保存档案";
    saveButton.addEventListener("click", () => {
      const duplicate = findUrlDuplicate(deps.getData().profiles, d.url, editingId);
      if (duplicate && !window.confirm(`「${duplicate.name}」使用相同 URL，仍要保存吗？`)) return;
      const result = upsertProfile(deps.getData().profiles, d, editingId);
      if ("error" in result) {
        notice = result.error;
        return render2();
      }
      draft = null;
      editingId = null;
      save({ profiles: result.profiles });
    });
    const importButton = el2("button", "menu_button vm-act vm-act-ghost");
    importButton.textContent = "导入当前连接";
    importButton.addEventListener("click", () => void importCurrent());
    const cancel = el2("button", "menu_button vm-act vm-act-ghost");
    cancel.textContent = "取消";
    cancel.addEventListener("click", () => {
      draft = null;
      editingId = null;
      render2();
    });
    actions.append(saveButton, importButton, cancel);
    box.append(actions);
    return box;
  }
  async function importCurrent() {
    const current2 = await readConnection();
    if (!current2 || !draft) {
      notice = "未检测到 SillyTavern 运行时。";
      return render2();
    }
    draft.mainApi = current2.mainApi;
    draft.source = current2.source;
    draft.url = current2.url;
    draft.model = current2.model;
    draft.settings = { ...current2.settings };
    draft.secretId = current2.secretId;
    if (current2.key) draft.key = current2.key;
    draft.secretMode = current2.secretMode;
    notice = current2.secretMode === "read" ? "已完整导入当前连接和密钥。" : "已导入连接设置；当前版本无法回读密钥，已保留表单中的 Key。";
    render2();
  }
  async function loadModels(value) {
    if (!normalizeUrl(value.url)) {
      notice = "请先填写接口地址。";
      return render2();
    }
    try {
      const models = await fetchModels({ ...value });
      const selected = window.prompt(`可用模型：
${models.join("\n")}

请输入要使用的模型 ID：`, value.model || models[0]);
      if (selected && draft) draft.model = selected;
    } catch (error) {
      notice = `获取模型失败：${error instanceof Error ? error.message : String(error)}`;
    }
    render2();
  }
  function buildHelp() {
    const box = section2("兼容说明");
    desc(box, "Key 在本扩展档案中明文保存；连接时优先写入 SillyTavern 新版多密钥 secret-id，旧版会回退到对应单密钥槽位。");
    desc(box, "新档案只列常用渠道；其他兼容 OpenAI 的厂商使用“自定义”入口。历史档案中的旧渠道仍可查看和编辑。");
    return box;
  }
  return { open, close, isOpen: () => backdrop !== null };
}

// st-extension/src/lifecycle.ts
function beginExtensionLifecycle(target, doc) {
  target.__stStageDispose?.();
  const lifecycle = createCapabilityTracker();
  const dispose = () => lifecycle.dispose();
  target.__stStageDispose = dispose;
  lifecycle.track(() => {
    if (target.__stStageDispose === dispose) delete target.__stStageDispose;
  });
  const stylesheet = doc?.querySelector("link[data-st-stage-style]");
  if (stylesheet) lifecycle.track(() => stylesheet.remove());
  return lifecycle;
}
function runWhenDomReady(doc, lifecycle, start) {
  let started = false;
  let untrack = () => {
  };
  const run = () => {
    if (started || lifecycle.disposed) return;
    started = true;
    untrack();
    void Promise.resolve(start()).catch((err) => {
      console.error("[sprite-overlay] 初始化失败", err);
    });
  };
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", run);
    untrack = lifecycle.track(() => doc.removeEventListener("DOMContentLoaded", run));
  } else {
    run();
  }
}

// st-extension/src/index.ts
var VARHUD_STATE_KEY = "varhud";
async function init(lifecycle) {
  await initI18n().catch((err) => {
    console.warn("[sprite-overlay] i18n 初始化失败", err);
  });
  const adapter = new STAdapter();
  let settings;
  try {
    settings = await adapter.loadSettings();
  } catch (err) {
    console.error("[sprite-overlay] 初始化失败", err);
    return;
  }
  if (lifecycle.disposed) return;
  function updateSettings(next) {
    const displayChanged = next.hideTagInMessage !== settings.hideTagInMessage || next.renderInlineImages !== settings.renderInlineImages || next.spriteDisplayMode !== settings.spriteDisplayMode || next.imageHost !== settings.imageHost || next.enabled !== settings.enabled || next.recentFloors !== settings.recentFloors || next.spriteOpacity !== settings.spriteOpacity;
    const autoChanged = next.autoSwitch !== settings.autoSwitch || next.autoSwitchSeconds !== settings.autoSwitchSeconds;
    settings = next;
    adapter.saveSettings(settings);
    overlay.setLayout(settings.overlay);
    overlay.setOpacity(settings.spriteOpacity);
    phone.setVisible(settings.showPhone);
    if (autoChanged) overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds);
    refresh();
    if (displayChanged) reprocessAllMessages(settings);
    onSettingsApplied?.();
  }
  let onSettingsApplied = null;
  function saveSettingsOnly(next) {
    const previousNewvar = normalizeNewvarData(settings.apps[NEWVAR_APP_ID]);
    const nextNewvar = normalizeNewvarData(next.apps[NEWVAR_APP_ID]);
    const previousHidesUpdates = previousNewvar.enabled && previousNewvar.hideUpdateBlocks;
    const nextHidesUpdates = nextNewvar.enabled && nextNewvar.hideUpdateBlocks;
    settings = next;
    adapter.saveSettings(settings);
    if (previousHidesUpdates !== nextHidesUpdates) {
      reprocessAllMessages(settings);
    }
  }
  const appMessageHub = createEventHub();
  const appCharacterHub = createEventHub();
  const hostTracker = createCapabilityTracker();
  lifecycle.track(() => hostTracker.dispose());
  lifecycle.track(() => adapter.injectPrompt(""));
  const usedAppChannels = /* @__PURE__ */ new Set();
  const platformCaps = {
    onMessageReceived: (handler) => appMessageHub.subscribe(handler),
    onCharacterChanged: (handler) => appCharacterHub.subscribe(() => handler()),
    injectPrompt: (appId, text4, depth) => {
      const channel = `app:${appId}`;
      if (!usedAppChannels.has(channel)) {
        usedAppChannels.add(channel);
        hostTracker.track(() => adapter.injectChannel(channel, ""));
      }
      adapter.injectChannel(channel, text4, depth);
    },
    toast: (kind, message) => {
      const t2 = window.toastr;
      if (t2?.[kind]) t2[kind](message);
      else console.info(`[sprite-overlay][${kind}] ${message}`);
    }
  };
  function createHostDeps(appId) {
    return {
      appId,
      getSettings: () => settings,
      saveSettingsOnly,
      getCharacterName: () => adapter.getCurrentCharacterName(),
      getCharacterCard: () => {
        try {
          const ctx = window.SillyTavern?.getContext();
          const id = ctx?.characterId;
          if (id !== void 0 && id !== null && String(id) !== "") {
            return ctx?.characters?.[Number(id)];
          }
        } catch {
        }
        return void 0;
      },
      getChatContext: () => {
        try {
          const ctx = window.SillyTavern?.getContext();
          return {
            characterId: ctx?.characterId,
            chatId: ctx?.chatId ?? ctx?.chatMetadata?.file_name,
            characterName: adapter.getCurrentCharacterName(),
            chat: ctx?.chat
          };
        } catch {
        }
        return void 0;
      },
      getVariables: async () => {
        try {
          const res = await readVariables({ type: "message", message_id: "latest" }, getLastMessageId());
          if (res.status === "ready") return res.data;
        } catch {
        }
        return void 0;
      },
      ...platformCaps
    };
  }
  const manager = createSpriteManager({
    adapter,
    getSettings: () => settings,
    updateSettings,
    // 从手机打开的弹窗关闭后：重新展开手机并回到「图库」页；悬浮窗齿轮来源则正常关闭
    onClosed: (source) => {
      if (source === "phone") phone.openApp("gallery");
    }
  });
  lifecycle.track(() => manager.destroy());
  let openSpritesApp = () => {
  };
  const overlay = createOverlay(
    settings.overlay,
    (layout) => {
      settings = { ...settings, overlay: layout };
      adapter.saveSettings(settings);
    },
    () => manager.open(),
    // 悬浮窗 ✕：只隐藏窗体并记住状态，立绘功能（含楼层立绘）不受影响
    () => updateSettings({ ...settings, overlayHidden: true }),
    () => openSpritesApp()
  );
  lifecycle.track(() => overlay.destroy());
  overlay.setAutoSwitch(settings.autoSwitch, settings.autoSwitchSeconds);
  overlay.setOpacity(settings.spriteOpacity);
  const registry = new PhoneAppRegistry();
  function createAppContext(appId, goHome) {
    return createPhoneAppContext({
      ...createHostDeps(appId),
      updateSettings,
      goHome,
      openModal: (id, build) => {
        openTrackedAppModal(build, {
          onOpen: collapsePhone,
          onClose: () => phone.openApp(id)
        }, (cleanup) => hostTracker.track(cleanup));
      }
    });
  }
  const phone = createPhoneShell(settings.phone, {
    registry,
    createAppContext,
    onStateChange: (state2) => {
      saveSettingsOnly({ ...settings, phone: state2 });
    }
  });
  lifecycle.track(() => phone.destroy());
  openSpritesApp = () => phone.openApp("sprites");
  function collapsePhone() {
    settings = { ...settings, phone: { ...settings.phone, open: false } };
    adapter.saveSettings(settings);
    phone.setState(settings.phone);
  }
  const newvarRuntime = createNewvarRuntime({
    getSettings: () => settings,
    inject: (prompt, depth) => adapter.injectChannel(NEWVAR_CHANNEL, prompt, depth)
  });
  lifecycle.track(() => newvarRuntime.dispose());
  lifecycle.track(() => adapter.injectChannel(NEWVAR_CHANNEL, ""));
  const getRendererSettings = () => normalizeRendererSettings(settings.apps[RENDERER_APP_ID]);
  const composerBridge = createComposerBridge();
  lifecycle.track(() => composerBridge.dispose());
  const rendererRuntime = createRendererRuntime({
    getSettings: getRendererSettings,
    factories: { gal: mountGalMode, cards: mountCardsMode, battle: mountBattleMode },
    modeDeps: {
      getSettings: getRendererSettings,
      resolvePortrait: (address) => {
        const packs = getActivePacks(settings, adapter.getCurrentCharacterName());
        return resolveSprite(packs, address)?.url ?? null;
      },
      resolveSpeakerPortrait: (speaker) => {
        const normalizedSpeaker = speaker.trim();
        if (!normalizedSpeaker) return null;
        const packs = getActivePacks(settings, adapter.getCurrentCharacterName());
        const pack = packs.find((candidate) => candidate.roleName?.trim() === normalizedSpeaker);
        return pack ? getPackCover(pack)?.url ?? null : null;
      },
      insertDraft: composerBridge.insertDraft
    }
  });
  lifecycle.track(() => rendererRuntime.dispose());
  let variableHud = null;
  function syncVariableHud() {
    if (settings.variableHud && !variableHud) {
      variableHud = createVariableHud({
        readSections: async () => {
          const sections = [];
          const messageId = getLastMessageId();
          const read = await readVariables({ type: "message", message_id: "latest" }, messageId);
          sections.push({
            source: "MVU",
            root: read.status === "ready" || read.status === "empty" ? read.data : null,
            notice: read.status === "unavailable" ? t("variableHud.mvu_unavailable", "未检测到 MVU / 酒馆助手") : read.error ?? ""
          });
          const newvarState = newvarRuntime.getCurrentState();
          sections.push({
            source: t("apps.newvar.name", "新变量"),
            root: newvarState,
            notice: ""
          });
          return sections;
        },
        subscribe: (handler) => {
          const offVar = subscribeVarEvents(handler);
          const offNewvar = newvarRuntime.subscribe(handler);
          return () => {
            offVar();
            offNewvar();
          };
        },
        readState: () => {
          const stored = settings.apps[VARHUD_STATE_KEY];
          const s = stored && typeof stored === "object" ? stored : {};
          return {
            x: typeof s.x === "number" ? s.x : 12,
            y: typeof s.y === "number" ? s.y : 120,
            open: typeof s.open === "boolean" ? s.open : false
          };
        },
        // 位置/展开态是纯 UI 状态：走 saveSettingsOnly，不触发立绘重渲染
        writeState: (state2) => {
          saveSettingsOnly({
            ...settings,
            apps: { ...settings.apps, [VARHUD_STATE_KEY]: state2 }
          });
        }
      });
    } else if (!settings.variableHud && variableHud) {
      variableHud.dispose();
      variableHud = null;
    }
  }
  syncVariableHud();
  onSettingsApplied = syncVariableHud;
  lifecycle.track(() => {
    onSettingsApplied = null;
    variableHud?.dispose();
    variableHud = null;
  });
  const newvarDesigner = createNewvarDesigner({
    getData: () => newvarRuntime.getData(),
    setData: (next) => {
      saveSettingsOnly({ ...settings, apps: { ...settings.apps, [NEWVAR_APP_ID]: next } });
      newvarRuntime.onConfigChanged();
    },
    buildPreview: () => newvarRuntime.buildPreview(),
    getLastParse: () => newvarRuntime.getLastParse(),
    onClosed: () => phone.openApp("newvar")
  });
  lifecycle.track(() => newvarDesigner.close());
  const apiManager = createApiManager({
    getData: () => sanitizeAppData(settings.apps[API_APP_ID]),
    setData: (next) => {
      saveSettingsOnly({ ...settings, apps: { ...settings.apps, [API_APP_ID]: next } });
    },
    onClosed: () => phone.openApp("api")
  });
  lifecycle.track(() => apiManager.close());
  for (const app of createBuiltinApps({
    previewSpriteOpacity: (percent) => overlay.setOpacity(percent),
    // 从手机开图库弹窗：先收起手机（避免挡在弹窗上），来源标记=手机（关闭后回图库页）
    openGalleryManager: () => {
      collapsePhone();
      manager.open("phone");
    },
    newvarRuntime,
    openNewvarDesigner: () => {
      collapsePhone();
      newvarDesigner.open();
    },
    openApiManager: () => {
      collapsePhone();
      apiManager.open();
    },
    rendererRuntime
  })) {
    registry.register(app);
    runAppSetup(app, createHostDeps(app.id), hostTracker);
  }
  const registerQueue = installRegisterQueue(window.stStageQueue, (app) => {
    registry.register(app);
    runAppSetup(app, createHostDeps(app.id), hostTracker);
  });
  window.stStageQueue = registerQueue;
  window.stStage = {
    registerApp: (app) => registerQueue.push(app)
  };
  lifecycle.track(() => {
    delete window.stStage;
    delete window.stStageQueue;
  });
  function overlayAllowed() {
    return settings.enabled && settings.spriteDisplayMode !== "inline" && !settings.overlayHidden;
  }
  let lastOverlayContentKey = "";
  function refresh() {
    if (!settings.enabled) {
      adapter.injectPrompt("");
      overlay.setVisible(false);
      lastOverlayContentKey = "";
      return;
    }
    const characterName = adapter.getCurrentCharacterName();
    const packs = getActivePacks(settings, characterName);
    const pack = packs[0] ?? null;
    const prompt = buildActiveSpritePrompt(settings, characterName);
    adapter.injectPrompt(prompt, settings.injectionDepth);
    const contentKey = `${characterName}|${packs.map((p) => p.id).join(",")}|${pack ? pack.sprites.length > 0 : false}`;
    if (contentKey !== lastOverlayContentKey) {
      lastOverlayContentKey = contentKey;
      if (pack && pack.sprites.length > 0) {
        preloadOnActivate(packs);
        overlay.setImage(pack.sprites[0].url, pack.sprites[0].tag);
      } else if (characterName) {
        overlay.setPlaceholder(t("sprite.overlay.placeholder_no_pack", "未绑定立绘包\n点击 ⚙ 进行绑定"));
      } else {
        overlay.setPlaceholder(t("sprite.overlay.placeholder_no_character", "打开角色聊天后\n点击 ⚙ 绑定立绘包"));
      }
    }
    overlay.setVisible(overlayAllowed());
  }
  function resolveSequenceWithApprox(packs, addresses) {
    const cache = { current: null };
    const out = [];
    for (const address of addresses) {
      const sprite = resolveWithApprox(packs, address, resolveSprite, true, cache);
      if (sprite && out[out.length - 1] !== sprite) out.push(sprite);
    }
    return out;
  }
  function displaySprites(addresses) {
    if (!settings.enabled || addresses.length === 0) return;
    const characterName = adapter.getCurrentCharacterName();
    const packs = getActivePacks(settings, characterName);
    if (packs.length === 0) return;
    const seq = settings.approxMatch ? resolveSequenceWithApprox(packs, addresses) : resolveSprites(packs, addresses);
    preloadMatchedSprites(seq);
    if (seq.length > 0 && overlayAllowed()) {
      overlay.setSprites(seq);
      overlay.setVisible(true);
    }
  }
  let streamedText = "";
  let streamedTagCount = 0;
  function resetStreamState() {
    streamedText = "";
    streamedTagCount = 0;
  }
  const unsubscribeStream = adapter.onStreamText((text4) => {
    if (!text4.startsWith(streamedText)) streamedTagCount = 0;
    streamedText = text4;
    const addresses = extractTags(text4);
    const added = addresses.slice(streamedTagCount);
    streamedTagCount = addresses.length;
    displaySprites(added);
  });
  lifecycle.track(unsubscribeStream);
  lifecycle.track(adapter.onGenerationEnded(resetStreamState));
  const unsubscribeMessage = adapter.onMessageReceived((text4) => {
    appMessageHub.emit(text4);
    displaySprites(extractTags(text4));
    resetStreamState();
  });
  lifecycle.track(unsubscribeMessage);
  const storyCapture = createStoryImageCapture({
    getSettings: () => settings,
    updateSettings,
    getStoryContext: () => adapter.getStoryContext(),
    localize: (sprite, fileName, story) => localizeSprite(sprite, fileName, {
      fetch: window.fetch.bind(window),
      compress: compressImage,
      saveImage: (file, name) => adapter.saveImageFile(file, name, story.characterName)
    })
  });
  lifecycle.track(mountMessagePostprocess({
    getSettings: () => settings,
    getRawMessage: (messageId) => adapter.getRawMessage(messageId),
    decorateImages: storyCapture.decorate,
    cleanupImages: storyCapture.cleanup,
    processMessage: rendererRuntime.processMessage,
    reprocessMessages: rendererRuntime.reprocessAll,
    cleanupMessages: rendererRuntime.dispose
  }));
  let cancelPendingNavigation = () => {
  };
  const handleChatNavigation = () => {
    appCharacterHub.emit(null);
    refresh();
    manager.refreshIfOpen();
    resetStreamState();
    cancelPendingNavigation();
    const timer = setTimeout(() => {
      cancelPendingNavigation();
      refresh();
      reprocessAllMessages(settings);
    }, 200);
    cancelPendingNavigation = lifecycle.track(() => clearTimeout(timer));
  };
  const unsubscribeCharacter = adapter.onCharacterChanged(handleChatNavigation);
  const unsubscribeChatCreated = adapter.onChatCreated(handleChatNavigation);
  lifecycle.track(() => {
    cancelPendingNavigation();
    unsubscribeCharacter();
    unsubscribeChatCreated();
  });
  lifecycle.track(mountSettingsPanel({
    getSettings: () => settings,
    updateSettings
  }));
  refresh();
  newvarRuntime.start();
  phone.setState(settings.phone);
  phone.setVisible(settings.showPhone);
  const version = false ? "dev" : `v${"0.9.0"} · ${"2026-10-26 11:21"}`;
  console.log(`[sprite-overlay] 百工（st-stage）已加载（含手机框架）${version}`);
}
var extensionLifecycle = beginExtensionLifecycle(window, document);
runWhenDomReady(document, extensionLifecycle, () => init(extensionLifecycle));
/*! Bundled license information:

jszip/dist/jszip.min.js:
  (*!

  JSZip v3.10.1 - A JavaScript class for generating and reading zip files
  <http://stuartk.com/jszip>

  (c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>
  Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/main/LICENSE.markdown.

  JSZip uses the library pako released under the MIT license :
  https://github.com/nodeca/pako/blob/main/LICENSE
  *)
*/
