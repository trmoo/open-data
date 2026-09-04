/*!
 * 배포 전 점검 — 앱스 스크립트는 오류가 나도 「흰 화면」만 뜨므로 미리 잡는다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 *   node tools/check.js
 *
 *   ① 모든 소스의 자바스크립트 문법
 *   ② index.html 의 include 목록과 순서
 *   ③ 화면이 쓰는 CSS 클래스가 css.html 에 있는가
 *   ③-2 클래스 이름 충돌 (단추 수식 클래스 ↔ 홀로 쓰는 클래스)
 *   ③-3 h() 자식 자리에 HTML 태그를 넣지 않았는가
 *   ③-4 브라우저 기본 창(alert·confirm·prompt) 을 쓰지 않았는가
 *   ④ 저작권 표시
 *   ⑤ 화면 수명 규칙 (setInterval·resize 직접 사용 금지)
 *   ⑥ 바깥 링크 — 죽은 주소를 누를 수 있게 두지 않았는가  ★ 이 앱만의 점검
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const SCREENS = ['s1.html', 's2.html'];
const SCRIPTED = ['data.html', 'judge.html', 'core.html', 'boot.html'].concat(SCREENS);
const ALL = ['Code.gs', 'index.html', 'css.html'].concat(SCRIPTED);
const WANT = ['css', 'data', 'judge', 'core', 's1', 's2', 'boot'];

let errors = 0, warns = 0;
const fail = (m) => { errors++; console.log('  ✗ ' + m); };
const warn = (m) => { warns++; console.log('  ! ' + m); };
const pass = (m) => console.log('  ✓ ' + m);

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const scriptOf = (f) => {
  const m = read(f).match(/<script>([\s\S]*)<\/script>/);
  return m ? m[1] : null;
};

/* ── ① 문법 ─────────────────────────────────────────── */
console.log('\n① 자바스크립트 문법');
['Code.gs'].concat(SCRIPTED).forEach((f) => {
  const code = f.endsWith('.gs') ? read(f) : scriptOf(f);
  if (code == null) { fail(f + ' 안에 <script> 가 없습니다'); return; }
  try { new Function(code); pass(f); }
  catch (e) { fail(f + ' — ' + e.message); }
});

/* ── ② include ──────────────────────────────────────── */
console.log('\n② index.html 의 부품 불러오기');
const idx = read('index.html');
const found = [];
const re = /include\('(\w+)'\)/g;
let m;
while ((m = re.exec(idx)) !== null) found.push(m[1]);
if (found.join(',') === WANT.join(',')) pass('순서가 맞습니다: ' + found.join(' → '));
else fail('순서가 다릅니다\n      기대 ' + WANT.join(' → ') + '\n      실제 ' + found.join(' → '));
WANT.forEach((n) => {
  if (!fs.existsSync(path.join(SRC, n + '.html'))) fail(n + '.html 파일이 없습니다');
});
const leftover = idx.match(/<\?[\s\S]{0,50}?\?>/g) || [];
const okScriptlets = leftover.filter((s) => /include\('|BOOT/.test(s));
if (okScriptlets.length === leftover.length) pass('스크립틀릿 ' + leftover.length + '개가 모두 알려진 것입니다');
else fail('알 수 없는 스크립틀릿: ' + leftover.filter((s) => okScriptlets.indexOf(s) < 0).join(' '));

/* ── ③ CSS 클래스 ───────────────────────────────────── */
console.log('\n③ CSS 클래스 대조');
const css = read('css.html');
const defined = new Set();
(css.match(/\.[-\w]+/g) || []).forEach((c) => defined.add(c.slice(1)));
const used = new Map();
SCRIPTED.forEach((f) => {
  const code = scriptOf(f) || '';
  const r1 = /\bh\('([a-zA-Z][\w]*(?:\.[-\w]+)+)'/g;
  let x;
  while ((x = r1.exec(code)) !== null) {
    x[1].split('.').slice(1).forEach((c) => { if (c) used.set(c, f); });
  }
  const r2 = /classList\.(?:add|remove|toggle)\(([^)]*)\)/g;
  while ((x = r2.exec(code)) !== null) {
    (x[1].match(/'([-\w]+)'/g) || []).forEach((q) => used.set(q.replace(/'/g, ''), f));
  }
  const r3 = /class:\s*'([-\w ]+)'/g;
  while ((x = r3.exec(code)) !== null) {
    x[1].split(/\s+/).forEach((c) => { if (c) used.set(c, f); });
  }
  /* className = 'x y' 로 통째로 정하는 곳 */
  const r4 = /className\s*=\s*'([-\w ]+)'/g;
  while ((x = r4.exec(code)) !== null) {
    x[1].split(/\s+/).forEach((c) => { if (c) used.set(c, f); });
  }
});
const missing = [...used.keys()].filter((c) => !defined.has(c));
if (!missing.length) pass('화면이 쓰는 클래스 ' + used.size + '가지가 모두 css.html 에 있습니다');
else missing.forEach((c) => fail('css.html 에 없는 클래스: .' + c + '  (' + used.get(c) + ')'));

/* ── ③-2 클래스 이름 충돌 ────────────────────────────
   .btn.big 처럼 「수식 클래스」와 「홀로 쓰는 클래스」의 이름이 같으면,
   홀로 쓰는 쪽이 정한 color·font 가 단추에 새어 들어와 글씨가 안 보일 수 있다. */
console.log('\n③-2 클래스 이름 충돌 (단추 수식 클래스 ↔ 홀로 쓰는 클래스)');
{
  const BASES = ['btn', 'pill', 'tab', 'chip', 'dcard', 'badge', 'card', 'bdg', 'chk', 'site'];
  const decl = {};
  /* ⚠ 주석을 먼저 걷어 낸다 — 주석이 붙어 있으면 선택자가 「주석+.big」 으로 잡혀 규칙을 놓친다 */
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = bare.match(/[^{}]+\{[^{}]*\}/g) || [];
  rules.forEach((r) => {
    const sel = r.slice(0, r.indexOf('{')).trim();
    const body = r.slice(r.indexOf('{') + 1, r.lastIndexOf('}'));
    sel.split(',').forEach((one) => {
      const last = one.trim().split(/\r?\n/).pop().trim();
      const mm = last.match(/^\.([-\w]+)$/);
      if (!mm) return;
      const props = (body.match(/(^|;)\s*(color|font-family|font-size|font-weight|background)\s*:/g) || [])
        .map((x) => x.replace(/[;:\s]/g, ''));
      if (props.length) decl[mm[1]] = (decl[mm[1]] || []).concat(props);
    });
  });
  let bad = 0;
  BASES.forEach((base) => {
    const rx = new RegExp('\\.' + base + '\\.([-\\w]+)', 'g');
    let mm;
    const seen = new Set();
    while ((mm = rx.exec(bare)) !== null) seen.add(mm[1]);
    seen.forEach((mod) => {
      if (decl[mod]) {
        bad++;
        fail('.' + base + '.' + mod + ' 와 홀로 쓰는 .' + mod + ' 의 이름이 같습니다 — .' + mod +
             ' 가 정하는 ' + [...new Set(decl[mod])].join('·') + ' 이(가) 새어 들어옵니다. 수식 클래스 이름을 바꾸세요');
      }
    });
  });
  if (!bad) pass('단추 수식 클래스와 홀로 쓰는 클래스의 이름이 겹치지 않습니다');
}

/* ── ③-3 h() 자식 자리의 HTML 태그 ───────────────────
   h('p.small', '… <b>여기</b> …') 처럼 자식 자리에 넘긴 문자열은 (일부러) 글자 그대로 들어간다.
   태그를 쓰려면 {html:'…'} 를 써야 한다. */
console.log('\n③-3 h() 자식 자리에 HTML 태그를 넣지 않았는가');
{
  const TAG = /<\/?(?:b|i|br|em|strong|span|div|p|ul|ol|li|code|small)\b[^>]*>/i;

  function callBody(code, start) {
    let depth = 0, q = null;
    for (let i = start; i < code.length; i++) {
      const c = code[i], prev = code[i - 1];
      if (q) { if (c === q && prev !== '\\') q = null; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') {
        depth--;
        if (depth === 0) return code.slice(start + 1, i);
      }
    }
    return null;
  }

  function splitArgs(s) {
    const out = [];
    let depth = 0, q = null, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i], prev = s[i - 1];
      if (q) { cur += c; if (c === q && prev !== '\\') q = null; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue; }
      if ('([{'.includes(c)) depth++;
      if (')]}'.includes(c)) depth--;
      if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }

  let hits = 0;
  SCRIPTED.forEach((f) => {
    const code = scriptOf(f) || '';
    const rx = /\bh\(\s*'/g;
    let mm;
    while ((mm = rx.exec(code)) !== null) {
      const open = code.indexOf('(', mm.index);
      const body = callBody(code, open);
      if (body == null) continue;
      const args = splitArgs(body);
      args.slice(1).forEach((raw) => {
        const arg = raw.trim();
        const cands = [];
        if (arg[0] === "'" || arg[0] === '"' || arg[0] === '`') cands.push(arg);
        else if (arg[0] === '[') {
          splitArgs(arg.slice(1, -1)).forEach((e) => {
            const t = e.trim();
            if (t[0] === "'" || t[0] === '"' || t[0] === '`') cands.push(t);
          });
        }
        cands.forEach((c) => {
          if (TAG.test(c)) {
            hits++;
            const snip = c.replace(/\s+/g, ' ').slice(0, 62);
            fail(f + ' — h() 자식 자리에 HTML 태그가 있습니다 (글자로 보입니다): ' + snip +
                 '\n      → {html: …} 로 넘기거나 rich() 를 쓰세요');
          }
        });
      });
    }
  });
  if (!hits) pass('h() 자식 자리에 HTML 태그를 넘긴 곳이 없습니다');
}

/* ── ③-4 브라우저 기본 창 ────────────────────────────
   앱스 스크립트 웹앱은 googleusercontent.com iframe 안에서 돌아가므로,
   alert·confirm·prompt 를 쓰면 크롬이 「…googleusercontent.com 에 삽입된 페이지 내용:」
   이라는 주소를 학생 화면에 붙여 보여 준다. core.html 의 say()·ask()·modal() 을 쓸 것. */
console.log('\n③-4 브라우저 기본 창(alert·confirm·prompt) 을 쓰지 않았는가');
{
  let hits = 0;
  SCRIPTED.forEach((f) => {
    const code = scriptOf(f) || '';
    ['alert', 'confirm', 'prompt'].forEach((fn) => {
      const rx = new RegExp('(^|[^.\\w])' + fn + '\\s*\\(', 'g');
      let mm;
      while ((mm = rx.exec(code)) !== null) {
        const line = code.slice(0, mm.index).split('\n').length;
        hits++;
        fail(f + ':' + line + ' — 브라우저 기본 ' + fn + '() 을 씁니다 ' +
             '(크롬이 googleusercontent.com 주소를 붙여 보여 줍니다)\n' +
             '      → say() · ask() · modal() 을 쓰세요');
      }
    });
  });
  if (!hits) pass('브라우저 기본 창을 쓰는 곳이 없습니다 (say·ask·modal 만 씁니다)');
}

/* ── ③-5 조사 ────────────────────────────────────────
   데이터 이름·사이트 이름이 자료에서 오므로 「은(는)」 처럼 두 개를 늘어놓으면 안 된다.
   judge.html 의 JOSA 로 가른다 (조사만 필요하면 JOSA.only(이름,'eun')). */
console.log('\n③-5 화면에 「은(는)」 같은 조사를 늘어놓지 않았는가');
{
  let hits = 0;
  const PAIRS = ['은(는)', '을(를)', '이(가)', '와(과)', '과(와)', '으로(로)', '로(으로)'];
  SCRIPTED.forEach((f) => {
    const code = scriptOf(f) || '';
    PAIRS.forEach((p) => {
      let at = code.indexOf(p);
      while (at >= 0) {
        hits++;
        fail(f + ':' + code.slice(0, at).split('\n').length + ' — 「' + p + '」 → JOSA 로 가르세요');
        at = code.indexOf(p, at + 1);
      }
    });
  });
  if (!hits) pass('화면 글에 늘어놓은 조사가 없습니다 (Code.gs 의 교사용 알림은 그대로 둡니다)');
}

/* ── ③-6 **굵게** 표시가 화면까지 살아 나가는가 ────────
   자료(DATA·JUDGE)의 글은 이 앱의 공통 표기인 **굵게** 를 쓴다.
   그 글을 그대로 html 로 넣는 상자는 md() 를 거쳐야 별표가 <b> 로 바뀐다.
   (2026-09-04 형태 안내 상자와 뱃지 힌트 두 곳에서 별표가 그대로 보였다) */
console.log('\n③-6 안내 상자가 **굵게** 표시를 처리하는가');
{
  const core = scriptOf('core.html') || '';
  const SINKS = ['goalBox', 'noteBox', 'tipBox', 'askBox', 'badBox', 'badgeRow'];
  let bad = 0;
  SINKS.forEach((fn) => {
    const at = core.indexOf('function ' + fn);
    if (at < 0) { bad++; fail(fn + '() 이 core.html 에 없습니다'); return; }
    /* 그 함수 몸통만 잘라 본다 (다음 function 선언 앞까지) */
    const rest = core.slice(at + 8);
    const end = rest.indexOf('\nfunction ');
    const body = end < 0 ? rest : rest.slice(0, end);
    if (body.indexOf('md(') < 0) {
      bad++;
      fail(fn + '() 이 md() 를 거치지 않습니다 — 자료의 **굵게** 가 별표로 보입니다');
    }
  });
  if (!bad) pass('안내 상자 ' + SINKS.length + '가지가 모두 md() 를 거칩니다');

  /* 화면이 직접 html 을 넣는 자리에 자료를 이어 붙이면 md() 를 놓치기 쉽다 */
  let raw = 0;
  SCREENS.forEach((f) => {
    const code = scriptOf(f) || '';
    const rx = /html:\s*'[^']*'\s*\+\s*(DATA|JUDGE)\./g;
    let mm;
    while ((mm = rx.exec(code)) !== null) {
      raw++;
      fail(f + ':' + code.slice(0, mm.index).split('\n').length +
           ' — 자료를 html 자리에 바로 이어 붙였습니다. md() 나 안내 상자를 쓰세요');
    }
  });
  if (!raw) pass('화면이 자료를 html 자리에 그대로 이어 붙이지 않습니다');
}

/* ── ④ 저작권 ───────────────────────────────────────── */
console.log('\n④ 저작권 표시');
ALL.forEach((f) => {
  if (read(f).indexOf('티쳐무') >= 0) pass(f);
  else fail(f + ' 에 저작권 표시가 없습니다');
});
['LICENSE', 'README.md', 'CLAUDE.md', 'package.json'].forEach((f) => {
  const p = path.join(SRC, '..', f);
  if (!fs.existsSync(p)) { fail(f + ' 파일이 없습니다'); return; }
  const raw = fs.readFileSync(p, 'utf8');
  if (f === 'package.json') {
    if (JSON.parse(raw).license === 'UNLICENSED') pass('package.json 의 license 가 UNLICENSED');
    else fail('package.json 의 license 를 UNLICENSED 로 둘 것');
  } else if (raw.indexOf('티쳐무') >= 0) pass(f);
  else fail(f + ' 에 저작권 표시가 없습니다');
});
{
  const n = (read('index.html').match(/티쳐무/g) || []).length;
  if (n >= 2) pass('index.html 안에 저작권 표시가 ' + n + '곳 (주석 · 화면 푸터)');
  else fail('index.html 의 저작권 표시가 ' + n + '곳뿐입니다 (주석과 푸터 두 곳이어야 합니다)');
}
{
  /* appsscript.json 은 JSON 이라 주석을 넣을 수 없다 — 그 사실이 LICENSE 에 적혀 있어야 한다 */
  const licPath = path.join(SRC, '..', 'LICENSE');
  const lic = fs.existsSync(licPath) ? fs.readFileSync(licPath, 'utf8') : '';
  if (lic.indexOf('appsscript.json') >= 0) pass('appsscript.json 에 표시가 없는 까닭이 LICENSE 에 적혀 있습니다');
  else warn('appsscript.json 은 JSON 이라 주석을 못 넣습니다 — 그 사실을 LICENSE 에 적어 두세요');
}

/* ── ⑤ 화면 수명 규칙 ───────────────────────────────── */
console.log('\n⑤ 화면 수명 규칙');
SCREENS.forEach((f) => {
  const code = scriptOf(f) || '';
  const bad = [];
  if (code.indexOf("window.addEventListener('resize'") >= 0) bad.push('resize 리스너를 직접 걺 → onResize()');
  if (/[^n]setInterval\(/.test(code)) bad.push('setInterval 을 직접 부름 → screenTimer()');
  if (bad.length) fail(f + ' — ' + bad.join(' / '));
  else pass(f);
});

/* ── ⑥ 바깥 링크 ────────────────────────────────────
   ★ 이 앱만의 점검. 데이터 사이트는 문을 닫거나 남에게 넘어가는 일이 잦다.
     2026-09-03 에 실제로 bigdatahub.co.kr 이 도박 광고 사이트가 되어 있었다.
     죽은 주소를 학생이 누를 수 있게 두면 안 된다. */
console.log('\n⑥ 바깥 링크 — 죽은 주소를 누를 수 있게 두지 않았는가');
{
  const dataCode = scriptOf('data.html') || '';
  const DATA = new Function(dataCode + '\n; return DATA;')();

  let bad = 0;
  (DATA.sites || []).forEach((s) => {
    if (!/^https:\/\//.test(s.url)) { bad++; fail(s.name + ' 의 주소가 https:// 로 시작하지 않습니다: ' + s.url); }
    if (!s.checked) { bad++; fail(s.name + ' 에 확인한 날(checked)이 없습니다'); }
  });
  if (!bad) pass('도감 사이트 ' + (DATA.sites || []).length + '곳이 모두 https 이고 확인한 날이 적혀 있습니다');

  /* 죽은 주소가 도감에도 들어 있으면 안 된다 */
  let dup = 0;
  (DATA.deadSites || []).forEach((d) => {
    (DATA.sites || []).forEach((s) => {
      if (s.url.indexOf(d.addr) >= 0) { dup++; fail('죽은 주소 ' + d.addr + ' 가 도감(' + s.name + ')에도 있습니다'); }
    });
    if (d.link !== false) { dup++; fail(d.addr + ' 의 link 가 false 가 아닙니다 — 누를 수 있는 링크가 됩니다'); }
  });
  if (!dup) pass('죽은 주소 ' + (DATA.deadSites || []).length + '곳이 도감에 섞여 있지 않고 link:false 입니다');

  /* 화면 코드가 deadSites 를 linkOut 으로 넘기지 않는지 눈으로 확인할 수 있게 알려 준다 */
  const s1 = scriptOf('s1.html') || '';
  if (/linkOut\(\s*d\.addr/.test(s1) || /linkOut\(\s*d\.url/.test(s1)) {
    fail('s1.html 이 deadSites 의 주소를 linkOut() 으로 넘깁니다 — 링크로 만들면 안 됩니다');
  } else {
    pass('화면이 죽은 주소를 linkOut() 으로 만들지 않습니다');
  }
}

/* ── 마무리 ─────────────────────────────────────────── */
console.log('\n' + '─'.repeat(56));
if (errors) {
  console.log('  잘못된 곳 ' + errors + '가지' + (warns ? ' · 살펴볼 곳 ' + warns + '가지' : ''));
  process.exit(1);
}
console.log('  모두 통과' + (warns ? ' (살펴볼 곳 ' + warns + '가지)' : '') + '. 배포해도 됩니다.');
