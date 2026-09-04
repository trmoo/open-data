/*!
 * 가짜 구글 앱스 스크립트 환경 — 시험(node)과 미리보기(브라우저)가 함께 쓴다.
 * (자료구조 실습실에서 가져와 setColumnWidth 를 더했다)
 * © 2026 티쳐무 · 모든 권리 보유
 *
 * ⚠ 이 파일은 node 와 브라우저 양쪽에서 돌아야 하므로 ES5 문법으로만 쓴다.
 *   (let·const·화살표 함수·템플릿 문자열을 쓰지 말 것)
 */
(function (root) {
  'use strict';

  /* ── SHA-256 (동기) ──────────────────────────────────────
     앱스 스크립트의 Utilities.computeDigest 를 흉내 내기 위해 직접 구현했다.
     브라우저의 crypto.subtle 은 비동기라 여기서는 쓸 수 없다. */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8Bytes(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
      else if (c < 0xd800 || c >= 0xe000) { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
      else {
        i++;
        c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  function sha256Bytes(str) {
    var msg = utf8Bytes(str);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var len = msg.length * 8;
    msg = msg.slice();
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    // 길이는 64비트지만 우리 입력은 짧으므로 상위 32비트는 0
    msg.push(0, 0, 0, 0,
      (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255);

    var w = new Array(64), i, j, a, b, c, d, e, f, g, hh, t1, t2, s0, s1, ch, maj;
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

    for (i = 0; i < msg.length; i += 64) {
      for (j = 0; j < 16; j++) {
        w[j] = (msg[i + j * 4] << 24) | (msg[i + j * 4 + 1] << 16) |
               (msg[i + j * 4 + 2] << 8) | msg[i + j * 4 + 3];
      }
      for (j = 16; j < 64; j++) {
        s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      a = H[0]; b = H[1]; c = H[2]; d = H[3]; e = H[4]; f = H[5]; g = H[6]; hh = H[7];
      for (j = 0; j < 64; j++) {
        s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        ch = (e & f) ^ (~e & g);
        t1 = (hh + s1 + ch + K[j] + w[j]) | 0;
        s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        maj = (a & b) ^ (a & c) ^ (b & c);
        t2 = (s0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + hh) | 0;
    }
    var out = [];
    for (i = 0; i < 8; i++) {
      out.push((H[i] >>> 24) & 255, (H[i] >>> 16) & 255, (H[i] >>> 8) & 255, H[i] & 255);
    }
    return out;
  }

  /* ── 가짜 시트 ───────────────────────────────────────── */
  function FakeSheet(name) {
    this.name = name;
    this.cells = [];        // cells[r][c] — 0부터
    this.hidden = false;
    this.frozenRows = 0;
    this.frozenCols = 0;
  }

  FakeSheet.prototype.getName = function () { return this.name; };
  FakeSheet.prototype.hideSheet = function () { this.hidden = true; return this; };
  FakeSheet.prototype.setFrozenRows = function (n) { this.frozenRows = n; return this; };
  FakeSheet.prototype.setFrozenColumns = function (n) { this.frozenCols = n; return this; };
  FakeSheet.prototype.setColumnWidth = function (c, w) {
    if (!this.widths) this.widths = {};
    this.widths[c] = w;
    return this;
  };

  FakeSheet.prototype.getLastRow = function () {
    var last = 0;
    for (var r = 0; r < this.cells.length; r++) {
      var row = this.cells[r] || [];
      for (var c = 0; c < row.length; c++) {
        if (row[c] !== '' && row[c] !== null && row[c] !== undefined) { last = r + 1; break; }
      }
    }
    return last;
  };

  FakeSheet.prototype.getLastColumn = function () {
    var last = 0;
    for (var r = 0; r < this.cells.length; r++) {
      var row = this.cells[r] || [];
      for (var c = 0; c < row.length; c++) {
        if (row[c] !== '' && row[c] !== null && row[c] !== undefined) {
          if (c + 1 > last) last = c + 1;
        }
      }
    }
    return last;
  };

  FakeSheet.prototype._cell = function (r, c) {
    if (!this.cells[r]) this.cells[r] = [];
    var v = this.cells[r][c];
    return v === undefined ? '' : v;
  };

  FakeSheet.prototype.getRange = function (row, col, nr, nc) {
    var sh = this;
    nr = nr == null ? 1 : nr;
    nc = nc == null ? 1 : nc;
    var api = {
      getValues: function () {
        var out = [];
        for (var r = 0; r < nr; r++) {
          var line = [];
          for (var c = 0; c < nc; c++) line.push(sh._cell(row - 1 + r, col - 1 + c));
          out.push(line);
        }
        return out;
      },
      setValues: function (vals) {
        for (var r = 0; r < vals.length; r++) {
          if (!sh.cells[row - 1 + r]) sh.cells[row - 1 + r] = [];
          for (var c = 0; c < vals[r].length; c++) sh.cells[row - 1 + r][col - 1 + c] = vals[r][c];
        }
        return api;
      },
      getValue: function () { return sh._cell(row - 1, col - 1); },
      setValue: function (v) {
        if (!sh.cells[row - 1]) sh.cells[row - 1] = [];
        sh.cells[row - 1][col - 1] = v;
        return api;
      },
      setFontWeight: function () { return api; },
      setBackground: function () { return api; },
      getRow: function () { return row; }
    };
    return api;
  };

  FakeSheet.prototype.appendRow = function (vals) {
    var r = this.getLastRow();
    if (!this.cells[r]) this.cells[r] = [];
    for (var c = 0; c < vals.length; c++) this.cells[r][c] = vals[c];
    return this;
  };

  FakeSheet.prototype.dump = function () {
    var last = this.getLastRow(), wide = this.getLastColumn(), out = [];
    for (var r = 0; r < last; r++) {
      var line = [];
      for (var c = 0; c < wide; c++) line.push(this._cell(r, c));
      out.push(line);
    }
    return out;
  };

  /* ── 가짜 스프레드시트 · 나머지 서비스 ────────────────── */
  function makeGas(opts) {
    opts = opts || {};
    var sheets = {};
    var order = [];
    var props = {};
    var uuidSeq = 0;
    var active = null;
    var activeRow = 1;
    var alerts = [];
    var promptAnswer = opts.promptAnswer || '';

    function getSheetByName(n) { return sheets[n] || null; }
    function insertSheet(n) { sheets[n] = new FakeSheet(n); order.push(n); return sheets[n]; }

    var ss = {
      getSheetByName: getSheetByName,
      insertSheet: insertSheet,
      getSheets: function () { return order.map(function (n) { return sheets[n]; }); }
    };

    var UI_BUTTON = { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO' };
    var ui = {
      alert: function () {
        var args = Array.prototype.slice.call(arguments);
        alerts.push(args.join(' | '));
        /* 진짜 앱스 스크립트는 YES_NO 로 물으면 YES/NO 를 돌려준다 */
        return args[args.length - 1] === 'YES_NO' ? UI_BUTTON.YES : UI_BUTTON.OK;
      },
      prompt: function () {
        return {
          getSelectedButton: function () { return UI_BUTTON.OK; },
          getResponseText: function () { return promptAnswer; }
        };
      },
      showModalDialog: function () {},
      createMenu: function () {
        var m = { addItem: function () { return m; }, addSeparator: function () { return m; },
                  addToUi: function () { return m; } };
        return m;
      },
      ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
      Button: UI_BUTTON
    };

    var SpreadsheetApp = {
      getActiveSpreadsheet: function () { return ss; },
      // opts.noUi 는 「편집기에서 ▶ 실행」 상황을 흉내 낸다 — 그때는 화면이 없어 getUi() 가 막힌다
      getUi: function () {
        if (opts.noUi) throw new Error('Cannot call SpreadsheetApp.getUi() from this context.');
        return ui;
      },
      getActiveSheet: function () { return active || ss.getSheets()[0]; },
      _setActive: function (name, row) { active = sheets[name]; activeRow = row; },
      _sheets: sheets,
      _alerts: alerts
    };
    // 고른 줄을 흉내 낸다
    Object.defineProperty(SpreadsheetApp, '_activeRow', { get: function () { return activeRow; } });
    var origGetActiveSheet = SpreadsheetApp.getActiveSheet;
    SpreadsheetApp.getActiveSheet = function () {
      var sh = origGetActiveSheet();
      if (sh && !sh.getActiveRange) {
        sh.getActiveRange = function () { return { getRow: function () { return activeRow; } }; };
      }
      return sh;
    };

    /* 가짜 자물쇠 — 진짜 앱스 스크립트의 LockService 흉내.
       node·브라우저는 한 줄로 돌아가므로 실제 경쟁은 없지만, 코드 경로를 그대로 태운다. */
    var lockHeld = false;
    var LockService = {
      getScriptLock: function () {
        return {
          tryLock: function () { if (lockHeld) return false; lockHeld = true; return true; },
          waitLock: function () { lockHeld = true; },
          releaseLock: function () { lockHeld = false; },
          hasLock: function () { return lockHeld; }
        };
      },
      getDocumentLock: function () { return LockService.getScriptLock(); },
      getUserLock: function () { return LockService.getScriptLock(); }
    };

    var PropertiesService = {
      getDocumentProperties: function () {
        return {
          getProperty: function (k) { return props[k] === undefined ? null : props[k]; },
          setProperty: function (k, v) { props[k] = String(v); return this; },
          deleteProperty: function (k) { delete props[k]; return this; }
        };
      }
    };

    function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

    var Utilities = {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: function (algo, text) { return sha256Bytes(String(text)); },
      getUuid: function () {
        uuidSeq++;
        return 'fake-uuid-' + pad(uuidSeq, 4) + '-' + pad((uuidSeq * 7919) % 10000, 4);
      },
      formatDate: function (d, tz, fmt) {
        d = new Date(d);
        return String(fmt)
          .replace('yyyy', d.getFullYear())
          .replace('MM', pad(d.getMonth() + 1, 2))
          .replace('dd', pad(d.getDate(), 2))
          .replace('HH', pad(d.getHours(), 2))
          .replace('mm', pad(d.getMinutes(), 2))
          .replace('ss', pad(d.getSeconds(), 2));
      }
    };

    var ContentService = {
      MimeType: { JSON: 'application/json' },
      createTextOutput: function (t) {
        return { _t: t, setMimeType: function () { return this; }, getContent: function () { return this._t; } };
      }
    };

    var HtmlService = {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
      createHtmlOutput: function (s) {
        return { _s: s, setWidth: function () { return this; }, setHeight: function () { return this; },
                 getContent: function () { return this._s; } };
      },
      createHtmlOutputFromFile: function (n) {
        return { getContent: function () { return '<!-- ' + n + ' -->'; } };
      },
      createTemplateFromFile: function () {
        return { evaluate: function () {
          return { setTitle: function () { return this; }, addMetaTag: function () { return this; },
                   setXFrameOptionsMode: function () { return this; } };
        } };
      }
    };

    return {
      SpreadsheetApp: SpreadsheetApp,
      PropertiesService: PropertiesService,
      LockService: LockService,
      Utilities: Utilities,
      ContentService: ContentService,
      HtmlService: HtmlService,
      sheets: sheets,
      props: props,
      alerts: alerts,
      sha256Bytes: sha256Bytes
    };
  }

  var api = { makeGas: makeGas, FakeSheet: FakeSheet, sha256Bytes: sha256Bytes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FAKEGAS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
