/*!
 * 미리보기 만들기 — 배포하지 않고 브라우저에서 확인한다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 *   node tools/preview.js   →   dist/preview.html (더블클릭하면 열린다)
 *
 * 가짜 시트 위에서 진짜 Code.gs 가 돌아가므로 로그인·자동 저장·제출까지 그대로 확인된다.
 * (브라우저를 닫으면 가짜 시트는 사라진다)
 *
 * 미리 넣어 둔 학생
 *   20101 / pw1234  — 계정이 있는 학생
 *   20102           — 비밀번호가 초기화된 학생 (이름 「김영희」 를 맞혀야 한다)
 *   20103           — 처음 오는 학생
 *   그리고 「우리 반이 모은 데이터」를 보려면 세 명 이상이 적어야 하므로,
 *   보이지 않는 학생 넷의 답을 미리 넣어 두었다.
 * 콘솔에서 sheetDump('제출 현황') 을 쳐 보면 시트에 들어간 값을 표로 볼 수 있다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

function read(p) { return fs.readFileSync(p, 'utf8'); }

const INCLUDES = ['css', 'data', 'judge', 'core', 's1', 's2', 'boot'];

const fakeGas = read(path.join(ROOT, 'tools', 'fake-gas.js'));
const codeGs = read(path.join(SRC, 'Code.gs'));

const setup = `
<script>
/* 가짜 앱스 스크립트 환경을 전역에 깔아 둔다 (Code.gs 가 이 이름들을 쓴다) */
var _FAKE = FAKEGAS.makeGas();
var SpreadsheetApp     = _FAKE.SpreadsheetApp;
var PropertiesService  = _FAKE.PropertiesService;
var Utilities          = _FAKE.Utilities;
var ContentService     = _FAKE.ContentService;
var HtmlService        = _FAKE.HtmlService;
var LockService        = _FAKE.LockService;
</script>
<script>
/* ── 여기부터 진짜 서버 코드(src/Code.gs) ── */
${codeGs}
</script>
<script>
/* 미리보기용 씨앗 데이터 */
setupSheets();
apiRegister('20101', '홍길동', 'pw1234');
apiRegister('20102', '김영희', 'temp1234');
(function () {                                    // 20102 는 비밀번호를 초기화해 둔다
  var a = accRow_('20102');
  sheet_('계정(비밀번호)').getRange(a.row, 3, 1, 5).setValues([['', '', '', '', '']]);
})();

/* 「우리 반이 모은 데이터」 화면을 확인하려면 적은 학생이 세 명 이상 있어야 한다 */
[['20111', '박서연', '환경기상', '정형'],
 ['20112', '최민준', '교통물류', '동적'],
 ['20113', '정하윤', '환경기상', '정형'],
 ['20114', '김도윤', '교육',     '반정형']].forEach(function (s) {
  var r = apiRegister(s[0], s[1], 'pw1234');
  apiSave(r.token, { v: 1, vals: { interest: s[2], dtype: s[3] }, scores: {}, answers: {} });
  apiLogout(r.token);
});

/** boot.html 이 부르는 통로 — google.script.run 대신 이것을 쓴다 */
function FAKE_SERVER(fn, args) {
  if (typeof window[fn] !== 'function') return { ok: false, msg: '없는 함수: ' + fn };
  return window[fn].apply(null, args);
}

/** 콘솔에서 시트를 들여다보는 도우미 — sheetDump('제출 현황') */
function sheetDump(name) {
  var sh = _FAKE.sheets[name];
  if (!sh) { console.log('시트 목록:', Object.keys(_FAKE.sheets)); return; }
  console.table(sh.dump());
  return sh.dump();
}
console.log('%c공공데이터 수집 기록장 — 미리보기 모드',
  'font:bold 14px sans-serif;color:#1d5fa8');
console.log('학생 20101 / pw1234 · 20102(초기화됨, 이름 김영희) · 20103(처음)');
console.log("시트 보기: sheetDump('제출 현황')");
</script>
`;

let html = read(path.join(SRC, 'index.html'));

/* <?!= include('x'); ?> 를 실제 내용으로 바꾼다.
   data 자리에는 가짜 환경 + 진짜 Code.gs 를 함께 끼워 넣는다 (boot 보다 앞이어야 한다). */
INCLUDES.forEach((name) => {
  const body = read(path.join(SRC, name + '.html'));
  const rx = new RegExp("<\\?!=\\s*include\\('" + name + "'\\);?\\s*\\?>", 'g');
  if (!rx.test(html)) throw new Error("index.html 에 include('" + name + "') 가 없습니다.");
  const filled = (name === 'data')
    ? '<script>\n' + fakeGas + '\n</script>\n' + setup + '\n' + body
    : body;
  html = html.replace(rx, () => filled);
});

/* BOOT_DATA 는 Code.gs 의 clientBoot_() 를 그대로 부른다 */
html = html.replace('<script>var BOOT_DATA = <?!= BOOT ?>;</script>',
  '<script>var BOOT_DATA = clientBoot_(); BOOT_DATA.preview = true;</script>');

const left = html.match(/<\?!?=?[\s\S]{0,40}?\?>/g);
if (left) throw new Error('바꾸지 못한 스크립틀릿이 있습니다: ' + left.join(' , '));

/* 미리보기임을 화면에도 밝힌다 */
html = html.replace('<footer>',
  '<div style="background:#fff6e0;border-bottom:2px solid #d9a12a;padding:9px 14px;' +
  'font:14px/1.6 sans-serif;color:#8a5a00;text-align:center">' +
  '<b>미리보기 모드</b> — 배포 전 확인용입니다. 저장은 이 브라우저 안의 가짜 시트에만 되고 ' +
  '창을 닫으면 사라집니다. (학생 <b>20101 / pw1234</b>)</div>\n<footer>');

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
const out = path.join(DIST, 'preview.html');
fs.writeFileSync(out, html, 'utf8');

const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
console.log('만들었습니다 → dist/preview.html  (' + kb + 'KB)');
console.log('더블클릭해서 열고, 학생 20101 / pw1234 로 들어가 보세요.');
