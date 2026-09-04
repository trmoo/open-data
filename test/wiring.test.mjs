/*!
 * 이어짐 점검 — 서버의 기준표(FIELDS·ACTIVITIES)와 화면이 어긋나지 않게 지킨다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 * ⚠ 활동이나 서술 칸을 늘릴 때는 세 곳을 함께 고친다 —
 *   Code.gs 의 FIELDS·ACTIVITIES·COURSE · data.html 의 screenActs·screenFields ·
 *   화면의 field()·pickField()·attrTable()·grader().
 *   여기서 그 어긋남을 잡는다.
 */
import { describe, test, ok, eq, deepEq } from './harness.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadData, loadServer, readScript, loadScreens, loadCalls } = require('../tools/gas-load.js');

const DATA = loadData();
const { api } = loadServer();
const regs = loadScreens();

const graderCalls = loadCalls('grader');
const fieldCalls = loadCalls('field').concat(loadCalls('pickField')).concat(loadCalls('attrTable'));
const fieldKeys = new Set(fieldCalls.map((c) => c.key));
const graderKeys = new Set(graderCalls.map((c) => c.key));

describe('화면 등록', () => {
  test('화면 일곱 개 — 탭 Ⅰ 다섯 · 탭 Ⅱ 둘', () => {
    eq(regs.length, 7);
    eq(regs.filter((r) => r.tab === 1).length, 5);
    eq(regs.filter((r) => r.tab === 2).length, 2);
  });
  test('아이디가 겹치지 않는다', () => {
    eq(new Set(regs.map((r) => r.id)).size, regs.length);
  });
  test('차시 범위(COURSE.screens)와 실제 화면이 같다', () => {
    deepEq(regs.map((r) => r.id).sort(), api.COURSE.screens.slice().sort());
  });
  test('차시 범위의 차례가 수업 흐름과 같다', () => {
    deepEq(api.COURSE.screens,
      ['interest', 'source', 'reason', 'type', 'content', 'solve', 'report']);
  });
  test('화면 제목이 겹치지 않는다', () => {
    eq(new Set(regs.map((r) => r.title)).size, regs.length);
  });
});

describe('기준표', () => {
  test('서술 칸 13개 · 활동 3가지(만점 18점)', () => {
    eq(api.FIELDS.length, 13);
    eq(api.ACTIVITIES.length, 3);
    eq(api.totalMax_(), 18);
  });
  test('진행률의 분모는 13 + 3 = 16', () => {
    eq(api.stepCount_(), 16);
  });
  test('열쇠가 겹치지 않는다', () => {
    eq(new Set(api.FIELDS.map((f) => f.key)).size, 13);
    eq(new Set(api.ACTIVITIES.map((a) => a.key)).size, 3);
  });
  test('학습지 여덟 항목(①~⑧)이 모두 있다', () => {
    ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'].forEach((no) => {
      ok(api.FIELDS.some((f) => f.no === no), no + ' 번 칸이 없습니다');
    });
  });
  test('차시 범위가 기준표와 같다 (이번 차시는 전부 연다)', () => {
    deepEq(api.COURSE.fields.slice().sort(), api.FIELDS.map((f) => f.key).sort());
    deepEq(api.COURSE.acts.slice().sort(), api.ACTIVITIES.map((a) => a.key).sort());
  });
  test('시트 열 너비가 모든 칸에 정해져 있다', () => {
    api.FIELDS.forEach((f) => ok(f.w >= 100, f.key + ' 의 열 너비가 없습니다'));
  });
});

describe('화면 ↔ 기준표 맞물림', () => {
  test('screenFields 에 적은 화면이 모두 실재한다', () => {
    const ids = regs.map((r) => r.id);
    Object.keys(DATA.screenFields).forEach((sid) => {
      ok(ids.indexOf(sid) >= 0, 'screenFields 의 ' + sid + ' 화면이 없습니다');
    });
    Object.keys(DATA.screenActs).forEach((sid) => {
      ok(ids.indexOf(sid) >= 0, 'screenActs 의 ' + sid + ' 화면이 없습니다');
    });
  });
  test('모든 화면이 screenFields·screenActs 에 적혀 있다', () => {
    regs.forEach((r) => {
      ok(DATA.screenFields[r.id] !== undefined, r.id + ' 이(가) screenFields 에 없습니다');
      ok(DATA.screenActs[r.id] !== undefined, r.id + ' 이(가) screenActs 에 없습니다');
    });
  });
  test('screenFields 를 모두 모으면 기준표와 같다', () => {
    const all = [];
    Object.keys(DATA.screenFields).forEach((k) => { DATA.screenFields[k].forEach((x) => all.push(x)); });
    deepEq(all.slice().sort(), api.FIELDS.map((f) => f.key).sort());
    eq(new Set(all).size, all.length, '한 칸이 두 화면에 겹쳐 적혀 있습니다');
  });
  test('screenActs 를 모두 모으면 활동 목록과 같다', () => {
    const all = [];
    Object.keys(DATA.screenActs).forEach((k) => { DATA.screenActs[k].forEach((x) => all.push(x)); });
    deepEq(all.slice().sort(), api.ACTIVITIES.map((a) => a.key).sort());
    eq(new Set(all).size, all.length, '한 활동이 두 화면에 겹쳐 있습니다');
  });
  test('화면이 실제로 그리는 칸과 screenFields 가 같다', () => {
    const listed = [];
    Object.keys(DATA.screenFields).forEach((k) => { DATA.screenFields[k].forEach((x) => listed.push(x)); });
    deepEq([...fieldKeys].sort(), listed.slice().sort());
  });
  test('화면이 실제로 부르는 grader 와 screenActs 가 같다', () => {
    const listed = [];
    Object.keys(DATA.screenActs).forEach((k) => { DATA.screenActs[k].forEach((x) => listed.push(x)); });
    deepEq([...graderKeys].sort(), listed.slice().sort());
  });
  test('모르는 칸·활동을 부르지 않는다', () => {
    const fk = new Set(api.FIELDS.map((f) => f.key));
    fieldCalls.forEach((c) => ok(fk.has(c.key), c.file + ' 이(가) 없는 칸 ' + c.key + ' 를 부릅니다'));
    const ak = new Set(api.ACTIVITIES.map((a) => a.key));
    graderCalls.forEach((c) => ok(ak.has(c.key), c.file + ' 이(가) 없는 활동 ' + c.key + ' 를 부릅니다'));
  });
  test('한 칸을 두 번 그리지 않는다 (자동 저장이 서로 덮어쓴다)', () => {
    const seen = {};
    fieldCalls.forEach((c) => { seen[c.key] = (seen[c.key] || 0) + 1; });
    Object.keys(seen).forEach((k) => eq(seen[k], 1, k + ' 를 ' + seen[k] + '번 그립니다'));
  });
  test('한 활동에 grader 를 한 번만 만든다', () => {
    const seen = {};
    graderCalls.forEach((c) => { seen[c.key] = (seen[c.key] || 0) + 1; });
    Object.keys(seen).forEach((k) => eq(seen[k], 1, k + ' 의 grader 를 ' + seen[k] + '번 만듭니다'));
  });
});

describe('활동의 문항 수와 만점', () => {
  const max = {};
  api.ACTIVITIES.forEach((a) => { max[a.key] = a.max; });

  test('어디서 찾을까 — 문항 5 = 만점 5', () => {
    eq(DATA.siteQuiz.length, max['site-match']);
  });
  test('데이터 형태 분류 — 문항 8 = 만점 8', () => {
    eq(DATA.typeQuiz.length, max['type-sort']);
  });
  test('편향 점검 — 문항 5 = 만점 5', () => {
    eq(DATA.biasQuiz.length, max['bias-check']);
  });
});

describe('화면이 지켜야 할 규칙', () => {
  const s1 = readScript('s1.html');
  const s2 = readScript('s2.html');

  test('report 화면에 제출 단추가 있다', () => {
    ok(s2.indexOf('제출하기') >= 0);
    ok(s2.indexOf('APP.submit') >= 0);
  });
  test('편향 화면이 성취기준을 밝힌다', () => {
    ok(s1.indexOf('12데과02-01') >= 0, '성취기준 코드가 화면에 없습니다');
  });
  test('완성 예시가 지어낸 것임을 밝힌다', () => {
    ok(s2.indexOf('지어낸 것') >= 0);
  });
  test('죽은 사이트를 linkOut 으로 만들지 않는다', () => {
    ok(!/linkOut\(\s*d\.(addr|url)/.test(s1), '죽은 주소를 링크로 만들고 있습니다');
  });
  test('자기 점검이 채점이 아니라고 밝힌다', () => {
    ok(s2.indexOf('점수가 아니라') >= 0);
  });
  test('예시 데이터 이름이 실제 이름이 아님을 밝힌다', () => {
    ok(s1.indexOf('실제 데이터 이름이 아닙니다') >= 0);
  });
});

describe('교사 시트 메뉴', () => {
  const fs = require('fs');
  const path = require('path');
  const { SRC } = require('../tools/gas-load.js');
  const codeGs = fs.readFileSync(path.join(SRC, 'Code.gs'), 'utf8');
  const MENUS = ['setupSheets', 'menuSummary', 'menuDetail', 'menuNotSubmitted',
                 'menuCollected', 'menuToggleClose', 'menuResetPw', 'menuAbout'];

  test('메뉴 여덟 가지가 모두 함수로 있다', () => {
    MENUS.forEach((fn) => eq(typeof api[fn], 'function', fn + ' 이(가) 없습니다'));
  });
  test('onOpen 이 그 여덟 가지를 모두 건다', () => {
    /* ⚠ 함수만 만들고 메뉴에 안 걸면 교사가 쓸 수 없다 — 실제로 놓치기 쉬운 곳이다 */
    const block = codeGs.slice(codeGs.indexOf('function onOpen'));
    const menu = block.slice(0, block.indexOf('addToUi'));
    MENUS.forEach((fn) => ok(menu.indexOf("'" + fn + "'") >= 0, fn + ' 이(가) 메뉴에 없습니다'));
  });
  test('메뉴에 없는 함수를 걸지 않는다', () => {
    const block = codeGs.slice(codeGs.indexOf('function onOpen'));
    const menu = block.slice(0, block.indexOf('addToUi'));
    const called = (menu.match(/addItem\('[^']*',\s*'([\w]+)'\)/g) || [])
      .map((s) => s.replace(/.*'([\w]+)'\)$/, '$1'));
    deepEq(called, MENUS);
  });
});
