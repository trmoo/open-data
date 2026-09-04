/*!
 * 공공데이터 수집 기록장 — 서버 코드 (구글 Apps Script)
 * © 2026 티쳐무 · 모든 권리 보유 (오픈소스 라이선스 없음)
 * 학교 수업 목적으로만 이용해 주세요. 그 밖의 이용은 먼저 문의해 주세요.
 * 「데이터 과학」 [12데과02-01] 성취기준 수업용.
 */

/* ────────────────────────────────────────────────────────────
   0. 시트 이름
   ──────────────────────────────────────────────────────────── */
var SH_STATUS = '제출 현황';
var SH_DRAFT  = '작성 중(임시 저장)';
var SH_LOG    = '제출 기록(백업)';
var SH_ACC    = '계정(비밀번호)';

var MAX_LEN = 1500;   /* 한 칸에 담을 수 있는 글자 수 */

var TABS = [
  { no: 1, name: 'Ⅰ 기록하기' },
  { no: 2, name: 'Ⅱ 마무리' }
];

/**
 * 학생이 서술하는 칸 — 이 앱의 단 하나의 기준표.
 * 화면(클라이언트)이 이 표를 그대로 받아 쓰므로 여기만 고치면 된다.
 * ⚠ key 를 바꾸면 이미 저장된 학생 답과 어긋난다.
 * no  = 학습지의 항목 번호 (① ~ ⑧)
 * min = 이만큼은 써야 한다고 안내하는 글자 수 (막지는 않는다)
 * w   = 「제출 현황」 시트에서 이 열의 너비
 */
var FIELDS = [
  { key: 'interest',   no: '①',   tab: 1, title: '관심 분야',               min: 2,  w: 150 },

  { key: 'data_name',  no: '②',   tab: 1, title: '수집한 데이터 이름',       min: 4,  w: 260 },
  { key: 'provider',   no: '③',   tab: 1, title: '데이터 제공 기관',         min: 2,  w: 180 },
  { key: 'source_url', no: '④',   tab: 1, title: '출처 링크',                min: 10, w: 320 },
  { key: 'license',    no: '④-2', tab: 1, title: '이용 조건',                min: 2,  w: 200 },

  { key: 'why',        no: '⑤',   tab: 1, title: '수집한 이유',              min: 60, w: 340 },

  { key: 'dtype',      no: '⑥',   tab: 1, title: '제공 데이터 형태',         min: 2,  w: 120 },
  { key: 'dformat',    no: '⑥-2', tab: 1, title: '파일 형식',                min: 2,  w: 120 },

  { key: 'describe',   no: '⑦',   tab: 1, title: '데이터 설명',              min: 60, w: 340 },
  { key: 'scale',      no: '⑦-2', tab: 1, title: '데이터의 규모',            min: 5,  w: 220 },
  { key: 'attrs',      no: '⑦-3', tab: 1, title: '무엇이 들어 있나(속성)',    min: 10, w: 380 },
  { key: 'bias',       no: '⑦-4', tab: 1, title: '빠지거나 치우친 것',        min: 30, w: 300 },

  { key: 'problem',    no: '⑧',   tab: 2, title: '해결할 수 있는 문제',       min: 80, w: 400 }
];

/**
 * 채점하는 활동 목록.
 * ⚠ 화면이 보낸 점수는 만점으로 자르기만 한다. 판정 엔진은 화면(judge.html)에 있고,
 *   교사는 서술 원문을 읽고 최종 채점한다 — 이 점수는 학습 과정을 보는 자료다.
 */
var ACTIVITIES = [
  { key: 'site-match', tab: 1, max: 5, label: '어디서 찾을까' },
  { key: 'type-sort',  tab: 1, max: 8, label: '데이터 형태 분류' },
  { key: 'bias-check', tab: 1, max: 5, label: '편향 점검' }
];

/**
 * ★ 이번 차시에 열어 줄 화면 (차시 범위).
 *   COURSE 를 null 로 두거나 screens 를 비우면 화면 일곱 개가 모두 열린다.
 *   진행률도 여기 적힌 것만 세므로, 범위만 다 하면 100% 가 된다.
 *   시트 열 구성은 바뀌지 않는다 — 범위를 좁혔다 넓혀도 예전 기록이 그대로 이어진다.
 * ⚠ screens 를 고치면 fields·acts 도 함께 고친다. 어긋나면 npm test 가 잡는다.
 */
var COURSE = {
  name: '1차시 — 공공·민간 데이터를 수집하고 기록하기',
  screens: ['interest', 'source', 'reason', 'type', 'content', 'solve', 'report'],
  fields: ['interest', 'data_name', 'provider', 'source_url', 'license',
           'why', 'dtype', 'dformat', 'describe', 'scale', 'attrs', 'bias', 'problem'],
  acts: ['site-match', 'type-sort', 'bias-check']
};

/** 차시 범위에 든 서술 칸 (범위가 없으면 전부) */
function scopeFields_() {
  if (!COURSE || !COURSE.fields || !COURSE.fields.length) return FIELDS;
  return FIELDS.filter(function (f) { return COURSE.fields.indexOf(f.key) >= 0; });
}

/** 차시 범위에 든 활동 (범위가 없으면 전부) */
function scopeActs_() {
  if (!COURSE || !COURSE.acts || !COURSE.acts.length) return ACTIVITIES;
  return ACTIVITIES.filter(function (a) { return COURSE.acts.indexOf(a.key) >= 0; });
}

/* ⚠ 「제출 후 수정」 은 8번째 열이다 — writeStatus_ 가 7·8열을 읽어 지키므로 순서를 바꾸지 말 것 */
var META_COLS = ['학번', '이름', '학년', '반', '번호', '최종 수정', '제출 시각', '제출 후 수정',
                 '진행률(%)', '관심 분야', '데이터 이름', '데이터 형태', '출처 링크',
                 '쓴 글자 수', '활동 점수', '활동 만점'];

/**
 * 메타 열의 자리(0부터). 열을 늘렸을 때 숫자를 일일이 고치지 않도록 이름으로 찾는다.
 * ⚠ vals[i][8] 처럼 숫자를 박아 두면 열을 하나 늘렸을 때 한 칸씩 밀려 읽힌다.
 *   새 코드는 반드시 이 함수를 쓸 것.
 */
function metaIdx_(name) {
  for (var i = 0; i < META_COLS.length; i++) if (META_COLS[i] === name) return i;
  throw new Error('메타 열 「' + name + '」 이(가) 없습니다.');
}

function fieldMap_() {
  var m = {};
  for (var i = 0; i < FIELDS.length; i++) m[FIELDS[i].key] = FIELDS[i];
  return m;
}

function totalMax_() {
  var list = scopeActs_(), s = 0;
  for (var i = 0; i < list.length; i++) s += list[i].max;
  return s;
}

/**
 * 고른 데이터 형태가 「정형」인가.
 * ⚠⚠ 「반정형」·「비정형」 도 「정형」 을 글자로 품는다 — 그 둘을 **먼저** 걸러야 한다.
 *   아직 안 골랐으면 정형으로 본다(그때는 화면도 속성 표를 보여 준다).
 * ⚠ 화면 쪽 JUDGE.needsAttrs() 와 판정이 늘 같아야 한다. 시험이 둘을 맞대어 본다.
 */
function isStructured_(dtype) {
  var t = String(dtype == null ? '' : dtype);
  if (!t.replace(/\s/g, '')) return true;
  if (t.indexOf('반정형') >= 0 || t.indexOf('비정형') >= 0 || t.indexOf('동적') >= 0) return false;
  return true;
}

/**
 * 이 학생에게 해당되는 서술 칸.
 * 속성 표(⑦-3)는 **정형 데이터일 때만** 묻는다 (2026-09-04 사용자 지시).
 * ⚠ 그래서 비정형·반정형·동적을 고른 학생은 진행률 분모에서도 빼야 한다 —
 *   안 빼면 그 학생은 아무리 채워도 100% 가 될 수 없다.
 */
function fieldsFor_(vals) {
  var list = scopeFields_();
  if (isStructured_(vals && vals.dtype)) return list;
  return list.filter(function (f) { return f.key !== 'attrs'; });
}

/** 진행률의 분모 — 그 학생에게 해당되는 서술 칸 + 활동 */
function stepCount_(vals) { return fieldsFor_(vals).length + scopeActs_().length; }

function statusHeader_() {
  var h = META_COLS.slice();
  for (var i = 0; i < FIELDS.length; i++) h.push(FIELDS[i].no + ' ' + FIELDS[i].title);
  for (var j = 0; j < ACTIVITIES.length; j++) h.push('[활동] ' + ACTIVITIES[j].label);
  return h;
}

/* ────────────────────────────────────────────────────────────
   1. 웹앱 진입점
   ──────────────────────────────────────────────────────────── */
function doGet(e) {
  var p = (e && e.parameter) || {};

  /* 점검용 공개 주소: ?api=stat — 개인정보 없이 참여 수만 알려 준다 */
  if (p.api === 'stat') {
    return ContentService
      .createTextOutput(JSON.stringify(publicStat_()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var t = HtmlService.createTemplateFromFile('index');
  t.BOOT = JSON.stringify(clientBoot_());
  return t.evaluate()
    .setTitle('공공데이터 수집 기록장')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function clientBoot_() {
  return {
    fields: FIELDS,
    activities: ACTIVITIES,
    course: COURSE,
    tabs: TABS,
    totalMax: totalMax_(),
    steps: stepCount_(),
    closed: isClosed_(),
    preview: false
  };
}

function publicStat_() {
  try {
    var sh = sheet_(SH_STATUS);
    var n = Math.max(0, sh.getLastRow() - 1);
    return { ok: true, students: n, totalMax: totalMax_() };
  } catch (err) {
    return { ok: false, students: 0, totalMax: totalMax_() };
  }
}

/* ────────────────────────────────────────────────────────────
   2. 시트 준비
   ──────────────────────────────────────────────────────────── */
function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    throw new Error('시트 「' + name + '」 이(가) 없습니다. 메뉴 [공공데이터 수집 기록장] → [① 시트 준비하기] 를 먼저 한 번 실행해 주세요.');
  }
  return sh;
}

function setupSheets() {
  var ss = ss_();
  var made = 0;

  var st = ensureSheet_(ss, SH_STATUS, statusHeader_()); made++;
  ensureSheet_(ss, SH_DRAFT, ['학번', '이름', '최종 수정', '진행률(%)', '쓴 글자 수', '저장 내용(JSON)']); made++;
  ensureSheet_(ss, SH_LOG,   ['제출 시각', '학번', '이름', '데이터 이름', '쓴 글자 수', '저장 내용(JSON)']); made++;

  var acc = ensureSheet_(ss, SH_ACC, ['학번', '이름', '비밀번호 해시', '솔트', '만든 시각', '접속표', '접속표 만료']);
  acc.hideSheet(); made++;

  st.setFrozenRows(1);
  st.setFrozenColumns(2);
  /* 서술 칸은 글이 길므로 열 너비를 미리 넓혀 둔다 */
  for (var i = 0; i < FIELDS.length; i++) {
    st.setColumnWidth(META_COLS.length + 1 + i, FIELDS[i].w);
  }

  var msg = '시트 ' + made + '장을 확인했습니다.\n\n' +
    '· ' + SH_STATUS + ' (채점용, ' + statusHeader_().length + '열 — 서술 ' +
      FIELDS.length + '칸 + 활동 ' + ACTIVITIES.length + '가지)\n' +
    '· ' + SH_DRAFT + '\n' +
    '· ' + SH_LOG + '\n' +
    '· ' + SH_ACC + ' (숨김 — 비밀번호는 해시로만 저장되어 교사도 볼 수 없습니다)\n\n' +
    '이제 [배포] → [배포 관리] 에서 웹 앱 주소를 학생에게 알려 주세요.';

  /* ⚠ 편집기에서 실행 단추로 부르면 화면(Ui)이 없어 alert 가 막힌다.
     그때도 시트는 이미 다 만들어졌으므로 실패로 보지 않는다. */
  try {
    var ui = SpreadsheetApp.getUi();
    ui.alert('시트 준비 완료', msg, ui.ButtonSet.OK);
  } catch (e) {
    if (typeof Logger !== 'undefined') Logger.log('시트 준비 완료\n' + msg);
  }
  return made;
}

function ensureSheet_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var cur = sh.getLastColumn() > 0
    ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    : [];
  if (cur.join('') !== header.join('')) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#e6eef8');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ────────────────────────────────────────────────────────────
   3. 학번·이름 다루기
   ──────────────────────────────────────────────────────────── */
/** 학번 20315 → {grade:2, cls:3, num:15}. 형식이 다르면 빈 값. */
function parseSid_(sid) {
  var s = String(sid || '').replace(/[^0-9]/g, '');
  if (s.length === 5) return { grade: +s.charAt(0), cls: +s.substring(1, 3), num: +s.substring(3, 5) };
  if (s.length === 4) return { grade: +s.charAt(0), cls: +s.charAt(1), num: +s.substring(2, 4) };
  return { grade: '', cls: '', num: '' };
}

function normSid_(sid) {
  var s = String(sid == null ? '' : sid).replace(/\s/g, '');
  if (!/^[0-9]{4,5}$/.test(s)) return '';
  return s;
}

function normName_(name) {
  return String(name == null ? '' : name).replace(/\s+/g, '');
}

/** 이름을 홍*동 처럼 가린다 — 화면에는 「내 학번이 맞나」만 확인시킨다 */
function maskName_(name) {
  var n = normName_(name);
  if (n.length <= 1) return n;
  if (n.length === 2) return n.charAt(0) + '*';
  var mid = '';
  for (var i = 1; i < n.length - 1; i++) mid += '*';
  return n.charAt(0) + mid + n.charAt(n.length - 1);
}

/* ────────────────────────────────────────────────────────────
   4. 계정 (비밀번호는 해시로만 저장한다)
   ──────────────────────────────────────────────────────────── */
function accRow_(sid) {
  var sh = sheet_(SH_ACC);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var vals = sh.getRange(2, 1, last - 1, 7).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (normSid_(vals[i][0]) === sid) {
      return { row: i + 2, sid: sid, name: String(vals[i][1] || ''),
               hash: String(vals[i][2] || ''), salt: String(vals[i][3] || ''),
               made: vals[i][4], token: String(vals[i][5] || ''), exp: vals[i][6] };
    }
  }
  return null;
}

function makeSalt_() {
  var s = '';
  for (var i = 0; i < 4; i++) s += Math.random().toString(36).substring(2, 10);
  return s.substring(0, 24);
}

function hashPw_(pw, salt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
                                    salt + '|' + pw, Utilities.Charset.UTF_8);
  var out = '';
  for (var i = 0; i < raw.length; i++) {
    var b = (raw[i] + 256) % 256;
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}

function makeToken_() {
  return Utilities.getUuid().replace(/-/g, '');
}

/** 학번을 넣었을 때 — 계정이 있는지, 이름을 물어야 하는지 알려 준다 */
function apiLookup(sid) {
  sid = normSid_(sid);
  if (!sid) return { ok: false, msg: '학번은 숫자 4~5자리로 적어 주세요. (예: 20315)' };
  var a = accRow_(sid);
  if (!a) return { ok: true, state: 'new', sid: sid };
  if (!a.hash) return { ok: true, state: 'reset', sid: sid, masked: maskName_(a.name) };
  return { ok: true, state: 'known', sid: sid, masked: maskName_(a.name) };
}

/** 처음 오는 학생 — 이름과 비밀번호를 정한다 */
function apiRegister(sid, name, pw) {
  sid = normSid_(sid);
  name = normName_(name);
  if (!sid) return { ok: false, msg: '학번은 숫자 4~5자리로 적어 주세요.' };
  if (name.length < 2) return { ok: false, msg: '이름을 두 글자 이상 적어 주세요.' };
  if (String(pw || '').length < 4) return { ok: false, msg: '비밀번호는 네 글자 이상으로 정해 주세요.' };

  /* 여러 학생이 같은 순간에 처음 등록하면 appendRow 가 겹쳐 한 줄이 사라질 수 있다 */
  return withLock_(function () {
    var sh = sheet_(SH_ACC);
    var a = accRow_(sid);
    var salt = makeSalt_();
    var hash = hashPw_(pw, salt);
    var token = makeToken_();
    var exp = new Date(new Date().getTime() + 12 * 3600 * 1000);

    if (a && a.hash) return { ok: false, msg: '이미 비밀번호가 있는 학번입니다. 비밀번호를 적어 주세요.' };
    if (a) {
      /* 초기화된 계정 — 이름이 남아 있으면 맞춰야 한다 */
      if (normName_(a.name) && normName_(a.name) !== name) {
        return { ok: false, msg: '학번과 이름이 맞지 않습니다. 선생님께 말씀해 주세요.' };
      }
      sh.getRange(a.row, 1, 1, 7).setValues([[sid, name, hash, salt, new Date(), token, exp]]);
    } else {
      sh.appendRow([sid, name, hash, salt, new Date(), token, exp]);
    }
    return { ok: true, token: token, sid: sid, name: name,
             data: loadDraft_(sid), submitted: submittedAt_(sid) };
  });
}

/** 계정이 있는 학생 — 비밀번호로 들어온다 */
function apiLogin(sid, pw) {
  sid = normSid_(sid);
  if (!sid) return { ok: false, msg: '학번을 다시 확인해 주세요.' };
  var a = accRow_(sid);
  if (!a) return { ok: false, msg: '처음 오는 학번입니다. 이름과 비밀번호를 정해 주세요.', state: 'new' };
  if (!a.hash) return { ok: false, msg: '비밀번호가 초기화되어 있습니다. 새로 정해 주세요.', state: 'reset' };
  if (hashPw_(pw, a.salt) !== a.hash) return { ok: false, msg: '비밀번호가 맞지 않습니다.' };

  var token = makeToken_();
  var exp = new Date(new Date().getTime() + 12 * 3600 * 1000);
  sheet_(SH_ACC).getRange(a.row, 6, 1, 2).setValues([[token, exp]]);
  return { ok: true, token: token, sid: sid, name: a.name,
           data: loadDraft_(sid), submitted: submittedAt_(sid) };
}

function apiChangePw(token, oldPw, newPw) {
  var me = auth_(token);
  if (!me.ok) return me;
  var a = accRow_(me.sid);
  if (hashPw_(oldPw, a.salt) !== a.hash) return { ok: false, msg: '지금 쓰는 비밀번호가 맞지 않습니다.' };
  if (String(newPw || '').length < 4) return { ok: false, msg: '새 비밀번호는 네 글자 이상으로 정해 주세요.' };
  var salt = makeSalt_();
  sheet_(SH_ACC).getRange(a.row, 3, 1, 2).setValues([[hashPw_(newPw, salt), salt]]);
  return { ok: true };
}

function auth_(token) {
  token = String(token || '');
  if (!token) return { ok: false, msg: '로그인이 풀렸습니다. 다시 들어와 주세요.', expired: true };
  var sh = sheet_(SH_ACC);
  var last = sh.getLastRow();
  if (last < 2) return { ok: false, msg: '로그인이 풀렸습니다.', expired: true };
  var vals = sh.getRange(2, 1, last - 1, 7).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][5] || '') === token) {
      var exp = vals[i][6];
      if (exp && new Date(exp).getTime() < new Date().getTime()) {
        return { ok: false, msg: '로그인이 오래되어 풀렸습니다. 다시 들어와 주세요.', expired: true };
      }
      return { ok: true, sid: normSid_(vals[i][0]), name: String(vals[i][1] || ''), row: i + 2 };
    }
  }
  return { ok: false, msg: '로그인이 풀렸습니다. 다시 들어와 주세요.', expired: true };
}

function apiLogout(token) {
  var me = auth_(token);
  if (me.ok) sheet_(SH_ACC).getRange(me.row, 6, 1, 2).setValues([['', '']]);
  return { ok: true };
}

/* ────────────────────────────────────────────────────────────
   5. 정리하기 — 화면이 보낸 값을 서버가 다시 다듬는다
   ──────────────────────────────────────────────────────────── */
function clean_(v) {
  var s = String(v == null ? '' : v);
  /* ⚠ 제어문자를 정규식에 「진짜 문자」로 써 넣지 말 것.
     node 는 통과하는데 브라우저에서 Range out of order 로 죽어 흰 화면이 된다. */
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  if (s.length > MAX_LEN) s = s.substring(0, MAX_LEN);
  return s;
}

/**
 * payload = { v:1, vals:{서술 칸}, scores:{활동 점수}, answers:{이어서 풀기용} }
 * 만점은 서버의 ACTIVITIES 를 믿는다. 화면이 보낸 만점은 쓰지 않는다.
 */
function tally_(payload) {
  payload = payload || {};
  var inVals = payload.vals || {};
  var scores = payload.scores || {};

  var vals = {}, filled = 0, enough = 0, chars = 0, i;
  var inScope = {};
  fieldsFor_(inVals).forEach(function (f) { inScope[f.key] = true; });
  for (i = 0; i < FIELDS.length; i++) {
    var f = FIELDS[i];
    var s = clean_(inVals[f.key]);
    vals[f.key] = s;
    var len = s.replace(/\s/g, '').length;
    chars += len;                       /* 글자 수는 범위 밖에 쓴 것도 센다 */
    if (!inScope[f.key]) continue;      /* 진행률은 이번 차시 범위만 본다 */
    if (len > 0) filled++;
    if (len >= f.min) enough++;
  }

  var per = {}, tabGot = {}, tabMax = {}, got = 0, tried = 0;
  for (i = 0; i < TABS.length; i++) { tabGot[TABS[i].no] = 0; tabMax[TABS[i].no] = 0; }
  var actScope = {};
  scopeActs_().forEach(function (a) { actScope[a.key] = true; });
  for (i = 0; i < ACTIVITIES.length; i++) {
    var act = ACTIVITIES[i];
    var sc = scores[act.key] || {};
    var g = Math.max(0, Math.min(act.max, Math.round(Number(sc.g) || 0)));
    per[act.key] = g;
    if (!actScope[act.key]) continue;   /* 범위 밖 활동은 총점·진행률에 넣지 않는다 */
    got += g;
    if (sc.a || g > 0) tried++;
    tabGot[act.tab] += g;
    tabMax[act.tab] += act.max;
  }

  var steps = stepCount_(inVals);
  return {
    vals: vals, per: per, tabGot: tabGot, tabMax: tabMax,
    filled: filled, enough: enough, chars: chars,
    got: got, max: totalMax_(), tried: tried,
    interest: vals['interest'] || '',
    dataName: vals['data_name'] || '',
    dtype: vals['dtype'] || '',
    url: vals['source_url'] || '',
    progress: Math.round((filled + tried) / steps * 1000) / 10
  };
}

/* ────────────────────────────────────────────────────────────
   6. 저장 · 제출
   ──────────────────────────────────────────────────────────── */
function loadDraft_(sid) {
  var sh = sheet_(SH_DRAFT);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var vals = sh.getRange(2, 1, last - 1, 6).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (normSid_(vals[i][0]) === sid) {
      try { return JSON.parse(String(vals[i][5] || 'null')); } catch (e) { return null; }
    }
  }
  return null;
}

function apiLoad(token) {
  var me = auth_(token);
  if (!me.ok) return me;
  return { ok: true, data: loadDraft_(me.sid), submitted: submittedAt_(me.sid) };
}

/** 자동 저장 — 「작성 중」 시트에 학생 1명 = 1줄로 덮어쓴다 */
function apiSave(token, payload) {
  var me = auth_(token);
  if (!me.ok) return me;
  var t = tally_(payload);
  return withLock_(function () {           /* 제출과 겹쳐 제출 시각을 되돌려 쓰지 않게 */
    var sh = sheet_(SH_DRAFT);
    var row = findRow_(sh, me.sid);
    var line = [me.sid, me.name, new Date(), t.progress, t.chars, JSON.stringify(payload)];
    if (row) sh.getRange(row, 1, 1, 6).setValues([line]);
    else sh.appendRow(line);

    /* 제출 현황에도 함께 갱신해 교사가 작성 중에도 볼 수 있게 한다 */
    writeStatus_(me.sid, me.name, t, null);
    return { ok: true, progress: t.progress, chars: t.chars, got: t.got, max: t.max };
  });
}

function apiSubmit(token, payload) {
  var me = auth_(token);
  if (!me.ok) return me;
  if (isClosed_()) return { ok: false, msg: '제출이 마감되었습니다. 선생님께 말씀해 주세요.' };

  var t = tally_(payload);
  return withLock_(function () {
    var now = new Date();

    var dsh = sheet_(SH_DRAFT);
    var drow = findRow_(dsh, me.sid);
    var dline = [me.sid, me.name, now, t.progress, t.chars, JSON.stringify(payload)];
    if (drow) dsh.getRange(drow, 1, 1, 6).setValues([dline]);
    else dsh.appendRow(dline);

    writeStatus_(me.sid, me.name, t, now);
    sheet_(SH_LOG).appendRow([now, me.sid, me.name, t.dataName, t.chars, JSON.stringify(payload)]);
    return { ok: true, at: Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
             progress: t.progress, chars: t.chars };
  });
}

/**
 * 시트 쓰기를 겹치지 않게 한다.
 * 한 반 서른 명이 동시에 저장하면 「읽고 → 쓰기」 사이에 다른 실행이 끼어들어,
 * 자동 저장이 제출 직전에 읽어 둔 빈 제출 시각으로 되돌려 쓸 수 있다.
 * ⚠ 자물쇠를 못 얻어도 저장은 시도한다 — 저장을 아예 못 하는 것이 더 나쁘다.
 */
function withLock_(fn) {
  var lock = null, got = false;
  try { lock = LockService.getScriptLock(); } catch (e) { lock = null; }
  if (lock) { try { got = lock.tryLock(15000); } catch (e2) { got = false; } }
  try {
    return fn();
  } finally {
    if (lock && got) { try { lock.releaseLock(); } catch (e3) {} }
  }
}

function findRow_(sh, sid) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var col = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) if (normSid_(col[i][0]) === sid) return i + 2;
  return 0;
}

function submittedAt_(sid) {
  var sh = sheet_(SH_STATUS);
  var row = findRow_(sh, sid);
  if (!row) return '';
  var v = sh.getRange(row, metaIdx_('제출 시각') + 1).getValue();
  return v ? Utilities.formatDate(new Date(v), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '';
}

/**
 * 제출 현황 시트에 한 줄을 쓴다.
 * ⚠ submitAt 이 null 이면 제출 시각을 건드리지 않는다.
 *   이걸 빼면 제출한 뒤 자동 저장 한 번에 제출 시각이 지워진다.
 */
function writeStatus_(sid, name, t, submitAt) {
  var sh = sheet_(SH_STATUS);
  var p = parseSid_(sid);
  var row = findRow_(sh, sid);
  var cSub = metaIdx_('제출 시각') + 1, cEdit = metaIdx_('제출 후 수정') + 1;
  var keep = '', keepEdit = '';
  if (row) {
    keep = sh.getRange(row, cSub).getValue();
    keepEdit = sh.getRange(row, cEdit).getValue();
  }
  var now = new Date();

  /* 제출한 뒤에도 학생이 고치면 이 시트의 서술 원문이 최신 내용으로 덮인다.
     제출 시점의 원문은 「제출 기록(백업)」 에 남으므로, 여기서는
     「제출 뒤에 고쳤다」는 사실만 따로 적어 교사가 알 수 있게 한다. */
  var edited = keepEdit;
  if (!submitAt && keep) edited = now;              /* 이미 제출한 학생의 자동 저장 */
  if (submitAt) edited = '';                        /* 다시 제출하면 초기화 */

  var line = [sid, name, p.grade, p.cls, p.num, now,
              submitAt ? submitAt : keep, edited,
              t.progress, t.interest, t.dataName, t.dtype, t.url,
              t.chars, t.got, t.max];
  var i;
  for (i = 0; i < FIELDS.length; i++) line.push(t.vals[FIELDS[i].key]);
  for (i = 0; i < ACTIVITIES.length; i++) line.push(t.per[ACTIVITIES[i].key]);

  if (row) sh.getRange(row, 1, 1, line.length).setValues([line]);
  else sh.appendRow(line);
}

/* ────────────────────────────────────────────────────────────
   7. 우리 반이 모은 데이터 — 이름 없이 개수만
   ──────────────────────────────────────────────────────────── */
var CLASS_MIN = 3;   /* 이 인원보다 적으면 열지 않는다 (누가 무엇을 골랐는지 드러나므로) */

/** 한 열의 값을 세어 많은 차례로 돌려준다 */
function countCol_(vals, col) {
  var count = {}, n = 0, i;
  for (i = 0; i < vals.length; i++) {
    var v = String(vals[i][col] || '').replace(/\s+/g, ' ').replace(/^\s|\s$/g, '');
    if (!v) continue;
    n++;
    count[v] = (count[v] || 0) + 1;
  }
  var rows = [];
  Object.keys(count).forEach(function (k) { rows.push({ name: k, count: count[k] }); });
  rows.sort(function (a, b) { return b.count - a.count || (a.name < b.name ? -1 : 1); });
  return { n: n, rows: rows };
}

function classStat_() {
  var empty = { ok: true, enough: false, n: 0, min: CLASS_MIN, interest: [], dtype: [] };
  var sh = sheet_(SH_STATUS);
  var last = sh.getLastRow();
  if (last < 2) return empty;
  var cI = metaIdx_('관심 분야'), cT = metaIdx_('데이터 형태');
  var vals = sh.getRange(2, 1, last - 1, Math.max(cI, cT) + 1).getValues();
  var byI = countCol_(vals, cI), byT = countCol_(vals, cT);
  var n = Math.max(byI.n, byT.n);
  if (n < CLASS_MIN) return { ok: true, enough: false, n: n, min: CLASS_MIN, interest: [], dtype: [] };
  return { ok: true, enough: true, n: n, min: CLASS_MIN, interest: byI.rows, dtype: byT.rows };
}

function apiClassStat(token) {
  var me = auth_(token);
  if (!me.ok) return me;
  return classStat_();
}

/* ────────────────────────────────────────────────────────────
   8. 마감 여부
   ──────────────────────────────────────────────────────────── */
function isClosed_() {
  return PropertiesService.getDocumentProperties().getProperty('closed') === '1';
}

/* ────────────────────────────────────────────────────────────
   9. 교사 메뉴 — 교사 기능은 웹 화면이 아니라 시트 메뉴로 넣었다
   ──────────────────────────────────────────────────────────── */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('공공데이터 수집 기록장')
    .addItem('① 시트 준비하기', 'setupSheets')
    .addSeparator()
    .addItem('② 현황 요약 보기', 'menuSummary')
    .addItem('③ 고른 줄의 학생 답 자세히 보기', 'menuDetail')
    .addItem('④ 미제출 학생 보기', 'menuNotSubmitted')
    .addItem('⑤ 우리 반이 모은 데이터 한눈에 보기', 'menuCollected')
    .addSeparator()
    .addItem('⑥ 제출 마감하기 / 다시 열기', 'menuToggleClose')
    .addItem('⑦ 비밀번호 초기화', 'menuResetPw')
    .addSeparator()
    .addItem('⑧ 이 앱 정보', 'menuAbout')
    .addToUi();
}

function menuAbout() {
  var ui = SpreadsheetApp.getUi();
  ui.alert('공공데이터 수집 기록장',
    '「데이터 과학」 [12데과02-01] 수업용 웹앱입니다.\n' +
    '서술 ' + FIELDS.length + '칸 · 채점 활동 ' + ACTIVITIES.length + '가지(만점 ' + totalMax_() + '점).\n\n' +
    '· 진행률(%) = (채운 서술 칸 + 손댄 활동) ÷ ' + stepCount_() + '\n' +
    '  ⑦-3 속성 표는 정형 데이터일 때만 묻습니다 — 다른 형태를 고른 학생은 분모가 하나 적습니다.\n' +
    '· 제출 시각이 비어 있으면 아직 작성 중입니다.\n' +
    '· 링크 점검·구체성 점검은 화면의 규칙 판정 결과입니다. 사람처럼 읽지 못하므로\n' +
    '  최종 채점은 서술 원문과 실제 링크를 열어 보고 해 주세요.\n\n' +
    '© 2026 티쳐무 · 모든 권리 보유',
    ui.ButtonSet.OK);
}

function menuSummary() {
  var t = summaryText_();
  if (t == null) { SpreadsheetApp.getUi().alert('아직 들어온 기록이 없습니다.'); return; }
  showText_('현황 요약', t);
}

/** 현황 요약 글을 만든다 (기록이 없으면 null). 시험이 내용을 확인할 수 있게 따로 두었다. */
function summaryText_() {
  var sh = sheet_(SH_STATUS);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var w = statusHeader_().length;
  var vals = sh.getRange(2, 1, last - 1, w).getValues();

  /* ⚠ 이번 차시에 열린 것만 센다. 잠긴 화면의 활동·서술 칸은 학생이 손댈 수조차 없으므로
     전체를 세면 언제나 0% 로 나와 「⚠」 목록 맨 위를 가짜 경고가 차지한다. */
  var sFields = scopeFields_(), sActs = scopeActs_();
  var fieldCol = {}, actCol = {}, k;
  for (k = 0; k < FIELDS.length; k++) fieldCol[FIELDS[k].key] = META_COLS.length + k;
  for (k = 0; k < ACTIVITIES.length; k++) actCol[ACTIVITIES[k].key] = META_COLS.length + FIELDS.length + k;

  var iSub = metaIdx_('제출 시각'), iEdit = metaIdx_('제출 후 수정'),
      iProg = metaIdx_('진행률(%)'), iChars = metaIdx_('쓴 글자 수');

  var iType = metaIdx_('데이터 형태');
  var n = vals.length, sub = 0, edited = 0, sumProg = 0, sumChars = 0, i, j;
  var actSum = [], fieldFill = [], fieldOf_ = [];
  for (i = 0; i < sActs.length; i++) actSum.push(0);
  /* fieldOf_ = 그 칸이 「해당되는」 학생 수. ⑦-3 은 정형을 고른 학생에게만 해당된다. */
  for (i = 0; i < sFields.length; i++) { fieldFill.push(0); fieldOf_.push(0); }

  for (i = 0; i < n; i++) {
    if (vals[i][iSub]) sub++;
    if (vals[i][iEdit]) edited++;
    sumProg += Number(vals[i][iProg]) || 0;
    sumChars += Number(vals[i][iChars]) || 0;
    var structured = isStructured_(vals[i][iType]);
    for (j = 0; j < sFields.length; j++) {
      if (sFields[j].key === 'attrs' && !structured) continue;   /* 이 학생에겐 안 묻는 칸 */
      fieldOf_[j]++;
      var txt = String(vals[i][fieldCol[sFields[j].key]] || '').replace(/\s/g, '');
      if (txt.length >= sFields[j].min) fieldFill[j]++;
    }
    for (j = 0; j < sActs.length; j++) {
      actSum[j] += Number(vals[i][actCol[sActs[j].key]]) || 0;
    }
  }

  var lines = ['학생 ' + n + '명 · 제출 ' + sub + '명 · 평균 진행률 ' +
               (Math.round(sumProg / n * 10) / 10) + '%',
               '평균 글자 수 ' + Math.round(sumChars / n) + '자'];
  if (edited) lines.push('제출한 뒤에 고친 학생 ' + edited + '명 (제출 시점 원문은 「' + SH_LOG + '」 에 있습니다)');
  if (COURSE && COURSE.screens && COURSE.screens.length) {
    lines.push('보는 범위 — 「' + COURSE.name + '」 (서술 ' + sFields.length +
               '칸 · 활동 ' + sActs.length + '가지). 잠긴 화면은 세지 않습니다.');
  }

  lines.push('', '── 활동별 평균 (⚠ 는 반 평균이 절반에 못 미친 곳) ──');
  var rank = [];
  for (i = 0; i < sActs.length; i++) {
    rank.push({ label: sActs[i].label, max: sActs[i].max,
                avg: actSum[i] / n, pct: actSum[i] / n / sActs[i].max * 100 });
  }
  rank.sort(function (a, b) { return a.pct - b.pct; });
  for (i = 0; i < rank.length; i++) {
    lines.push((rank[i].pct < 50 ? '⚠ ' : '   ') + rank[i].label + '  ' +
               (Math.round(rank[i].avg * 10) / 10) + ' / ' + rank[i].max +
               '  (' + Math.round(rank[i].pct) + '%)');
  }

  lines.push('', '── 서술 칸별 「기준 글자 수를 넘긴 학생 수」 ──');
  var frank = [];
  for (i = 0; i < sFields.length; i++) {
    frank.push({ label: sFields[i].no + ' ' + sFields[i].title,
                 cnt: fieldFill[i], of: fieldOf_[i] });
  }
  /* 해당되는 학생 수가 다를 수 있으므로 비율로 줄 세운다 (⑦-3 은 정형을 고른 학생만 해당) */
  frank.sort(function (a, b) {
    return (a.of ? a.cnt / a.of : 1) - (b.of ? b.cnt / b.of : 1);
  });
  for (i = 0; i < frank.length; i++) {
    var f2 = frank[i];
    var low = f2.of > 0 && f2.cnt < f2.of / 2;
    lines.push((low ? '⚠ ' : '   ') + f2.label + '  ' + f2.cnt + ' / ' + f2.of + '명' +
               (f2.of !== n ? '  (이 칸이 해당되는 학생만)' : ''));
  }
  return lines.join('\n');
}

function menuDetail() {
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== SH_STATUS) {
    SpreadsheetApp.getUi().alert('[' + SH_STATUS + '] 시트에서 학생 줄을 하나 고른 뒤 다시 눌러 주세요.');
    return;
  }
  var row = sh.getActiveRange().getRow();
  if (row < 2) { SpreadsheetApp.getUi().alert('학생이 적힌 줄(2번째 줄부터)을 골라 주세요.'); return; }
  var sid = normSid_(sh.getRange(row, 1).getValue());
  var name = String(sh.getRange(row, 2).getValue() || '');
  var data = loadDraft_(sid);
  if (!data) { SpreadsheetApp.getUi().alert('저장된 답이 없습니다.'); return; }

  var edited = sh.getRange(row, metaIdx_('제출 후 수정') + 1).getValue();
  showText_(sid + ' ' + name, detailText_(sid, name, edited, data));
}

/** 학생 한 명의 답을 글로 만든다. 시험이 내용을 확인할 수 있게 따로 두었다. */
function detailText_(sid, name, edited, data) {
  data = data || loadDraft_(sid);
  var t = tally_(data);
  var lines = [sid + ' ' + name + ' — 진행률 ' + t.progress + '% · ' + t.chars + '자 · ' +
               '활동 ' + t.got + '/' + t.max + '점'];
  if (edited) {
    lines.push('⚠ 제출한 뒤에 고쳤습니다 — 제출 시점 원문은 「' + SH_LOG + '」 시트에 있습니다.');
  }
  lines.push('');

  /* ⚠ 이번 차시에 열린 칸을 먼저 보여 준다. 잠긴 화면의 칸을 섞어 보여 주면
     학생이 빠뜨린 것처럼 보이지만 실은 쓸 수조차 없었던 것이다. */
  var sFields = scopeFields_(), sActs = scopeActs_();
  var inScope = {};
  sFields.forEach(function (f) { inScope[f.key] = true; });

  var i, lastTab = 0;
  function putField(f) {
    if (f.tab !== lastTab) { lines.push('── ' + TABS[f.tab - 1].name + ' ──'); lastTab = f.tab; }
    var v = t.vals[f.key];
    var len = v.replace(/\s/g, '').length;
    var mark = len >= f.min ? '○' : (len > 0 ? '△' : '·');
    lines.push(mark + ' [' + f.no + '] ' + f.title + '  (' + len + '자 / 기준 ' + f.min + ')');
    lines.push('    ' + (v || '(비어 있음)'));
  }
  for (i = 0; i < sFields.length; i++) putField(sFields[i]);

  lines.push('', '── 활동 점수 ──');
  for (i = 0; i < sActs.length; i++) {
    var a = sActs[i];
    lines.push('  ' + (t.per[a.key] === a.max ? '○' : (t.per[a.key] > 0 ? '△' : '·')) +
               ' ' + a.label + '  ' + t.per[a.key] + '/' + a.max);
  }

  /* 범위 밖인데도 쓴 것이 있으면(예: 지난 차시에 쓴 것) 따로 모아 보여 준다 */
  var extra = FIELDS.filter(function (f) {
    return !inScope[f.key] && String(t.vals[f.key] || '').replace(/\s/g, '').length > 0;
  });
  if (extra.length) {
    lines.push('', '── 이번 차시 범위 밖에 쓴 것 ──');
    lastTab = 0;
    for (i = 0; i < extra.length; i++) putField(extra[i]);
  }
  var locked = FIELDS.length - sFields.length - extra.length;
  if (locked > 0) {
    lines.push('', '(이번 차시에 잠긴 서술 칸 ' + locked + '개는 학생이 쓸 수 없어 보여 주지 않습니다)');
  }
  return lines.join('\n');
}

function menuNotSubmitted() {
  var sh = sheet_(SH_STATUS);
  var last = sh.getLastRow();
  if (last < 2) { SpreadsheetApp.getUi().alert('아직 들어온 기록이 없습니다.'); return; }
  var iSub = metaIdx_('제출 시각'), iProg = metaIdx_('진행률(%)');
  var vals = sh.getRange(2, 1, last - 1, Math.max(iSub, iProg) + 1).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (!vals[i][iSub]) out.push('  ' + normSid_(vals[i][0]) + ' ' + vals[i][1] +
                                 '  (진행률 ' + vals[i][iProg] + '%)');
  }
  showText_('미제출 학생 ' + out.length + '명',
            out.length ? out.join('\n') : '들어온 학생 모두 제출했습니다.');
}

function menuCollected() {
  var t = collectedText_();
  if (t == null) { SpreadsheetApp.getUi().alert('아직 들어온 기록이 없습니다.'); return; }
  showText_('우리 반이 모은 데이터', t);
}

/**
 * 학생들이 어떤 데이터를 모았는지 한 화면에 모은다.
 * 교사가 링크를 하나씩 눌러 확인할 수 있게 목록을 그대로 싣는다.
 */
function collectedText_() {
  var sh = sheet_(SH_STATUS);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var w = statusHeader_().length;
  var vals = sh.getRange(2, 1, last - 1, w).getValues();

  var cI = metaIdx_('관심 분야'), cN = metaIdx_('데이터 이름'),
      cT = metaIdx_('데이터 형태'), cU = metaIdx_('출처 링크');
  var cProv = META_COLS.length;
  for (var k = 0; k < FIELDS.length; k++) {
    if (FIELDS[k].key === 'provider') cProv = META_COLS.length + k;
  }

  var lines = ['학생 ' + vals.length + '명이 모은 데이터', ''];

  function bars(title, res) {
    lines.push('── ' + title + ' (적은 학생 ' + res.n + '명) ──');
    var top = res.rows.length ? res.rows[0].count : 1;
    for (var i = 0; i < res.rows.length; i++) {
      var b = '', len = Math.max(1, Math.round(res.rows[i].count / top * 20));
      for (var j = 0; j < len; j++) b += '█';
      lines.push('  ' + b + ' ' + res.rows[i].count + '명  ' + res.rows[i].name);
    }
    lines.push('');
  }
  bars('관심 분야', countCol_(vals, cI));
  bars('데이터 형태', countCol_(vals, cT));

  /* 같은 데이터를 여러 학생이 골랐으면 알려 준다 — 반 전체가 한 데이터만 보면 토의가 안 된다 */
  var dup = countCol_(vals, cN).rows.filter(function (r) { return r.count > 1; });
  if (dup.length) {
    lines.push('── 여러 학생이 고른 같은 데이터 ──');
    for (var d = 0; d < dup.length; d++) lines.push('  ' + dup[d].count + '명  ' + dup[d].name);
    lines.push('');
  }

  lines.push('── 학생별 목록 ──');
  for (var i2 = 0; i2 < vals.length; i2++) {
    var r2 = vals[i2];
    lines.push('  ' + normSid_(r2[0]) + ' ' + r2[1] + '  |  ' +
               (r2[cI] || '(분야 없음)') + '  |  ' + (r2[cN] || '(이름 없음)') +
               '  |  ' + (r2[cProv] || '(기관 없음)') + '  |  ' + (r2[cT] || '(형태 없음)'));
    lines.push('      ' + (r2[cU] || '(링크 없음)'));
  }
  return lines.join('\n');
}

function menuToggleClose() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getDocumentProperties();
  var now = isClosed_();
  var r = ui.alert('제출 ' + (now ? '다시 열기' : '마감하기'),
    now ? '지금은 마감되어 있습니다. 다시 제출을 받을까요?'
        : '지금부터 학생이 제출할 수 없게 할까요?\n(이미 제출된 기록은 그대로 남고, 작성과 자동 저장은 계속됩니다.)',
    ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  props.setProperty('closed', now ? '0' : '1');
  ui.alert(now ? '제출을 다시 받습니다.' : '제출을 마감했습니다.');
}

function menuResetPw() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('비밀번호 초기화',
    '비밀번호를 잊은 학생의 학번을 적어 주세요. (예: 20315)\n\n' +
    '초기화하면 그 학생은 다음에 들어올 때 이름을 확인한 뒤 비밀번호를 새로 정합니다.\n' +
    '작성한 내용과 점수는 그대로 남습니다.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var sid = normSid_(r.getResponseText());
  if (!sid) { ui.alert('학번은 숫자 4~5자리로 적어 주세요.'); return; }
  var a = accRow_(sid);
  if (!a) { ui.alert(sid + ' 학번의 계정이 없습니다.'); return; }
  sheet_(SH_ACC).getRange(a.row, 3, 1, 5).setValues([['', '', '', '', '']]);
  ui.alert(sid + ' ' + a.name + ' 학생의 비밀번호를 초기화했습니다.\n' +
           '다음에 들어올 때 이름을 확인하고 새 비밀번호를 정하게 됩니다.');
}

function showText_(title, body) {
  var esc = String(body).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  var html = HtmlService.createHtmlOutput(
    '<div style="font:13px/1.75 Malgun Gothic,sans-serif;white-space:pre-wrap;padding:6px 10px">' +
    esc + '</div>').setWidth(660).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}
