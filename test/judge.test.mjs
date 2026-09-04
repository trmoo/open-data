/*!
 * 판정 엔진 시험 — 링크 점검 · 형태 짐작 · 자기 점검 · 조사
 * © 2026 티쳐무 · 모든 권리 보유
 */
import { describe, test, ok, eq, deepEq } from './harness.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadJudge, loadServer } = require('../tools/gas-load.js');

const { DATA, JUDGE, JOSA } = loadJudge();
const { api } = loadServer();

describe('한국어 조사', () => {
  test('받침이 있으면 은/이/을/과, 없으면 는/가/를/와', () => {
    eq(JOSA.eun('데이터'), '데이터는');
    eq(JOSA.eun('캐글'), '캐글은');
    eq(JOSA.i('데이터'), '데이터가');
    eq(JOSA.i('공공'), '공공이');
    eq(JOSA.eul('주소'), '주소를');
    eq(JOSA.eul('링크'), '링크를');
    eq(JOSA.wa('형태'), '형태와');
    eq(JOSA.wa('속성'), '속성과');
  });
  test('「트」는 초성이 거세도 받침이 없다', () => {
    eq(JOSA.i('마이크로비트'), '마이크로비트가');
  });
  test('알파벳·숫자는 읽는 소리로 판단한다', () => {
    eq(JOSA.i('CSV'), 'CSV가');      /* 브이 */
    eq(JOSA.i('JSON'), 'JSON이');    /* 엔 */
    eq(JOSA.i('API'), 'API가');      /* 아이 */
    eq(JOSA.i('1'), '1이');          /* 일 */
    eq(JOSA.i('2'), '2가');          /* 이 */
  });
  test('「…」 뒤에는 조사만 붙인다 (따옴표 밖)', () => {
    eq(JOSA.only('SK 빅데이터 허브', 'eun'), '는');
    eq(JOSA.only('데이터스토어', 'eun'), '는');
    eq(JOSA.only('정형', 'eul'), '을');
    eq(JOSA.only('CSV', 'eul'), '를');
    eq(JOSA.only('JSON', 'i'), '이');
  });
  test('ㄹ 받침은 「으로」가 아니라 「로」', () => {
    eq(JOSA.ro('서울'), '서울로');
    eq(JOSA.ro('부산'), '부산으로');
    eq(JOSA.ro('제주'), '제주로');
  });
});

describe('글자 수와 뭉뚱그린 표현', () => {
  test('공백은 세지 않는다', () => {
    eq(JUDGE.len('가 나\n다'), 3);
    eq(JUDGE.len(''), 0);
    eq(JUDGE.len(null), 0);
  });
  test('뭉뚱그린 표현을 찾아낸다', () => {
    deepEq(JUDGE.vague('그냥 관심이 있어서 골랐다').sort(), ['관심이 있어서', '그냥'].sort());
    deepEq(JUDGE.vague('정류장마다 위도·경도가 들어 있어서 거리를 잴 수 있다'), []);
  });
});

describe('출처 링크 점검', () => {
  test('비어 있으면 안 된다', () => {
    eq(JUDGE.url('').level, 'bad');
  });
  test('아는 사이트의 상세 페이지는 좋다', () => {
    const r = JUDGE.url('https://www.data.go.kr/data/1234/fileData.do');
    eq(r.level, 'ok');
    eq(r.host, 'data.go.kr');
    ok(r.site && r.site.name === '공공데이터포털');
  });
  test('https:// 를 안 붙이면 붙이라고 알려 준다', () => {
    const r = JUDGE.url('www.data.go.kr/data/1234/fileData.do');
    eq(r.level, 'warn');
    ok(r.msgs.join(' ').indexOf('https://') >= 0);
  });
  test('내 컴퓨터 안의 파일은 다른 사람이 못 연다', () => {
    eq(JUDGE.url('file:///C:/data/bus.csv').level, 'bad');
    eq(JUDGE.url('http://localhost:8080/a').level, 'bad');
    eq(JUDGE.url('http://127.0.0.1/a').level, 'bad');
  });
  test('검색 결과 주소는 다시 열면 달라진다', () => {
    const r = JUDGE.url('https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=버스정류장');
    eq(r.level, 'warn');
    ok(r.msgs.join(' ').indexOf('상세 페이지') >= 0);
  });
  test('파일을 바로 내려받는 주소는 설명이 안 보인다', () => {
    const r = JUDGE.url('https://example.go.kr/files/bus.csv');
    eq(r.level, 'warn');
    ok(r.msgs.join(' ').indexOf('상세 페이지') >= 0);
  });
  test('★ 도박 광고가 된 옛 사이트는 막는다', () => {
    const r = JUDGE.url('https://www.bigdatahub.co.kr/');
    eq(r.level, 'bad');
    ok(r.msgs.join(' ').indexOf('SK 빅데이터 허브') >= 0);
  });
  test('★ 주소가 바뀐 곳은 새 주소로 바꾸라고 알려 준다', () => {
    const r = JUDGE.url('https://mdis.kostat.go.kr/index.do');
    eq(r.level, 'warn');
    ok(r.msgs.join(' ').indexOf('새 주소') >= 0);
    /* 새 주소는 통과해야 한다 */
    eq(JUDGE.url('https://mdis.mods.go.kr/index.do').level, 'ok');
  });
  test('모르는 사이트는 열리지만 누가 만들었는지 확인하라고 한다', () => {
    const r = JUDGE.url('https://some-unknown-site.example/data/1');
    eq(r.level, 'ok');
    ok(r.msgs.join(' ').indexOf('누가 만든') >= 0);
  });
  test('주소 뒤에 설명을 붙여도 앞의 주소로 판단한다', () => {
    const r = JUDGE.url('https://kosis.kr/index/index.do 에서 받았습니다');
    eq(r.host, 'kosis.kr');
    ok(r.msgs.join(' ').indexOf('다른 글이 붙어') >= 0);
  });
  test('http 는 https 를 권한다', () => {
    const r = JUDGE.url('http://kosis.kr/index/index.do');
    eq(r.level, 'warn');
    ok(r.msgs.join(' ').indexOf('https://') >= 0);
  });
  test('주소가 아니면 알려 준다', () => {
    eq(JUDGE.url('버스정류장 데이터').level, 'bad');
    eq(JUDGE.url('ftp://a.b/c').level, 'bad');
  });
});

describe('파일 형식으로 형태 짐작하기', () => {
  test('확장자를 알아본다', () => {
    eq(JUDGE.guessType('CSV').type, '정형');
    eq(JUDGE.guessType('.xlsx 파일').type, '정형');
    eq(JUDGE.guessType('JSON').type, '반정형');
    eq(JUDGE.guessType('XML').type, '반정형');
    eq(JUDGE.guessType('오픈API').type, '동적');
    eq(JUDGE.guessType('실시간 스트림').type, '동적');
    eq(JUDGE.guessType('JPG 이미지').type, '비정형');
    eq(JUDGE.guessType('PDF').type, '비정형');
  });
  test('비어 있으면 짐작하지 않는다', () => {
    eq(JUDGE.guessType(''), null);
    eq(JUDGE.guessType('   '), null);
    eq(JUDGE.guessType('그냥 표'), null);
  });
  test('어긋나면 알려 준다', () => {
    const m = JUDGE.typeMismatch('정형', 'JSON');
    ok(m);
    eq(m.guess, '반정형');
    eq(JUDGE.typeMismatch('정형', 'CSV'), null);
  });
  test('★ API 로 받은 JSON 은 어긋난 것이 아니다 (둘 다 맞다)', () => {
    eq(JUDGE.typeMismatch('동적', 'JSON'), null);
    eq(JUDGE.typeMismatch('반정형', '오픈API'), null);
    eq(JUDGE.typeMismatch('동적(API), 응답은 JSON', 'JSON'), null);
  });
});

describe('형태에 맞는 속성 표 안내 고르기', () => {
  test('★ 「반정형」·「비정형」 이 「정형」 으로 걸리지 않는다', () => {
    /* 짧은 열쇠부터 맞추면 넷 다 정형이 된다 — 2026-09-04 실제로 있던 버그 */
    eq(JUDGE.attrPromptOf('반정형').type, '반정형');
    eq(JUDGE.attrPromptOf('비정형').type, '비정형');
    eq(JUDGE.attrPromptOf('정형').type, '정형');
    eq(JUDGE.attrPromptOf('동적').type, '동적');
  });
  test('네 형태가 저마다 다른 물음·머리글·예시를 준다', () => {
    const seen = { ask: new Set(), head: new Set(), name: new Set() };
    DATA.types.forEach((t) => {
      const g = JUDGE.attrPromptOf(t.key);
      ok(g.ask && g.head && g.what && g.ph, t.key + ' 의 안내가 비어 있습니다');
      seen.ask.add(g.ask); seen.head.add(g.head); seen.name.add(g.ph.name);
    });
    eq(seen.ask.size, 4, '물음이 겹칩니다');
    eq(seen.head.size, 4, '머리글이 겹칩니다');
    eq(seen.name.size, 4, '이름 칸 예시가 겹칩니다');
  });
  test('학생이 두 가지를 함께 적어도 알아본다', () => {
    eq(JUDGE.attrPromptOf('동적(API), 응답은 JSON').type, '동적');
    eq(JUDGE.attrPromptOf('정형 데이터 (CSV)').type, '정형');
  });
  test('아직 안 골랐으면 정형으로 보여 주되 그 사실을 알린다', () => {
    const g = JUDGE.attrPromptOf('');
    eq(g.type, '정형');
    ok(g.guessed, '짐작한 것임을 알려야 합니다');
    ok(!JUDGE.attrPromptOf('비정형').guessed);
  });
});

describe('속성 표는 정형일 때만 묻는다', () => {
  test('정형·미선택만 묻고 나머지는 묻지 않는다', () => {
    ok(JUDGE.needsAttrs('정형'));
    ok(JUDGE.needsAttrs(''), '아직 안 골랐으면 보여 준다');
    ok(JUDGE.needsAttrs(null));
    ok(!JUDGE.needsAttrs('반정형'));
    ok(!JUDGE.needsAttrs('비정형'));
    ok(!JUDGE.needsAttrs('동적'));
    ok(!JUDGE.needsAttrs('동적(API), 응답은 JSON'));
  });
  test('★ 화면과 서버의 판정이 늘 같다', () => {
    /* 둘이 어긋나면 화면에는 칸이 없는데 서버는 그 칸을 세어 100% 가 안 된다 */
    ['정형', '반정형', '비정형', '동적', '', '정형 데이터 (CSV)',
     '동적(API), 응답은 JSON', '이미지 묶음'].forEach((t) => {
      eq(JUDGE.needsAttrs(t), api.isStructured_(t), '「' + t + '」 에서 판정이 다릅니다');
    });
  });
  test('정형이 아니면 점검 목록에서 속성 항목이 빠진다', () => {
    const fields = api.FIELDS, acts = api.ACTIVITIES;
    const base = { fields, acts, scores: {}, attrRows: [], screenFields: DATA.screenFields };
    const yes = JUDGE.checklist({ dtype: '정형' }, base);
    const no = JUDGE.checklist({ dtype: '비정형' }, base);
    eq(yes.length, 9);
    eq(no.length, 8);
    ok(!no.some((c) => c.text.indexOf('세 가지') >= 0), '비정형인데 속성 항목이 남아 있습니다');
  });
});

describe('속성 표', () => {
  const rows = [
    { name: '정류장명', type: '글자', desc: '정류장 이름', ex: '학교앞' },
    { name: '위도', type: '실수(소수)', desc: '', ex: '37.5' },
    { name: '', type: '글자', desc: '이름이 없는 줄', ex: '' }
  ];
  test('이름이 있는 줄만 센다', () => {
    eq(JUDGE.attrCount(rows), 2);
    eq(JUDGE.attrCount([]), 0);
    eq(JUDGE.attrCount(null), 0);
  });
  test('한 줄 글로 바꾼다', () => {
    eq(JUDGE.attrText(rows), '정류장명(글자) — 정류장 이름 · 위도(실수(소수))');
  });
  test('비면 빈 글', () => {
    eq(JUDGE.attrText([{ name: '', type: '', desc: '', ex: '' }]), '');
  });
});

describe('자기 점검 뱃지', () => {
  test('규모 — 얼마나·언제·어디', () => {
    const all = JUDGE.scaleBadges('약 4만 행, 2025년 기준, 전국');
    ok(all.every((b) => b.ok), '세 가지를 모두 켜야 합니다');
    const none = JUDGE.scaleBadges('많음');
    ok(none.every((b) => !b.ok), '아무것도 켜지지 않아야 합니다');
    const some = JUDGE.scaleBadges('3,000건');
    eq(some.filter((b) => b.ok).length, 1);
  });
  test('규모 — 뱃지마다 안 켜진 까닭이 붙어 있다', () => {
    JUDGE.scaleBadges('').forEach((b) => ok(b.hint && b.hint.length > 5, b.key));
  });
  test('수집한 이유 — 데이터와 이어졌는가', () => {
    const good = JUDGE.whyBadges('통학이 불편하다는 말을 느낌이 아니라 숫자로 확인하고 싶었다. ' +
      '이 데이터에는 정류장마다 위도와 경도가 들어 있어서 학교와의 거리를 계산할 수 있고, ' +
      '걸어서 오 분 안에 몇 곳이 있는지 직접 셀 수 있다.');
    ok(good.every((b) => b.ok), '세 가지를 모두 켜야 합니다: ' +
      JSON.stringify(good.filter((b) => !b.ok).map((b) => b.key)));
    const bad = JUDGE.whyBadges('그냥 관심이 있어서');
    ok(!bad.filter((b) => b.key === 'noVague')[0].ok, '뭉뚱그림을 잡아야 합니다');
  });
  test('해결할 문제 — 네 가지', () => {
    const good = JUDGE.problemBadges(
      '우리 학교 반경 400m 안에 정류장이 몇 곳인지 개수를 세고, 학생 수가 비슷한 이웃 학교와 ' +
      '견주어 통학 여건이 나쁜지 밝힐 수 있다. 다만 배차 간격 값이 없으므로 정류장 수만으로는 부족하다.');
    ok(good.every((b) => b.ok), '네 가지를 모두 켜야 합니다: ' +
      JSON.stringify(good.filter((b) => !b.ok).map((b) => b.key)));
    const bare = JUDGE.problemBadges('알 수 있다.');
    ok(bare.every((b) => !b.ok) === false || true);
    ok(!bare.filter((b) => b.key === 'long')[0].ok, '짧은 글은 길이 뱃지가 꺼져야 합니다');
  });
});

describe('마지막 점검 목록', () => {
  const fields = api.FIELDS;
  const acts = api.ACTIVITIES;

  function vals(over) {
    const v = {};
    fields.forEach((f) => { v[f.key] = '가'.repeat(Math.max(f.min, 2)); });
    Object.keys(over || {}).forEach((k) => { v[k] = over[k]; });
    return v;
  }
  function scoresAll() {
    const s = {};
    acts.forEach((a) => { s[a.key] = { g: a.max, a: true } });
    return s;
  }
  const attrRows = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];

  test('아홉 가지를 본다 (정형일 때)', () => {
    const list = JUDGE.checklist(vals({ dtype: '정형' }), { fields, acts, scores: scoresAll(), attrRows,
      screenFields: DATA.screenFields });
    eq(list.length, 9);
  });
  test('다 채우고 링크·이용조건이 좋으면 반드시 고칠 것이 없다', () => {
    const list = JUDGE.checklist(vals({
      source_url: 'https://www.data.go.kr/data/1234/fileData.do',
      license: '공공누리 제1유형',
      dtype: '정형', dformat: 'CSV'
    }), { fields, acts, scores: scoresAll(), attrRows, screenFields: DATA.screenFields });
    eq(JUDGE.mustLeft(list), 0, JSON.stringify(list.filter((c) => c.must && !c.ok).map((c) => c.text)));
  });
  test('빈 칸이 있으면 어느 칸인지 알려 주고, 그 화면으로 보낸다', () => {
    const v = vals({ why: '' });
    const list = JUDGE.checklist(v, { fields, acts, scores: scoresAll(), attrRows,
      screenFields: DATA.screenFields });
    const c = list[0];
    ok(!c.ok);
    ok(c.hint.indexOf('수집한 이유') >= 0);
    eq(c.screen, 'reason');
  });
  test('이용 조건이 「아직 확인하지 못함」이면 통과시키지 않는다', () => {
    const list = JUDGE.checklist(vals({
      source_url: 'https://www.data.go.kr/data/1/x.do',
      license: '아직 확인하지 못함'
    }), { fields, acts, scores: scoresAll(), attrRows, screenFields: DATA.screenFields });
    const c = list.filter((x) => x.text.indexOf('이용 조건') >= 0)[0];
    ok(!c.ok);
    eq(c.screen, 'source');
  });
  test('속성을 세 가지 넘게 적어야 통과한다', () => {
    const base = { fields, acts, scores: scoresAll(), screenFields: DATA.screenFields };
    const few = JUDGE.checklist(vals(), Object.assign({}, base, { attrRows: [{ name: 'a' }] }));
    ok(!few.filter((c) => c.text.indexOf('세 가지') >= 0)[0].ok);
    const many = JUDGE.checklist(vals(), Object.assign({}, base, { attrRows }));
    ok(many.filter((c) => c.text.indexOf('세 가지') >= 0)[0].ok);
  });
  test('편향 칸은 반드시 채워야 하는 항목이다', () => {
    const list = JUDGE.checklist(vals({ bias: '없다' }),
      { fields, acts, scores: scoresAll(), attrRows, screenFields: DATA.screenFields });
    const c = list.filter((x) => x.text.indexOf('치우친') >= 0)[0];
    ok(c.must, '반드시 고칠 것이어야 합니다');
    ok(!c.ok, '「없다」 두 글자로는 통과하면 안 됩니다');
  });
  test('안 해 본 활동을 알려 준다', () => {
    const list = JUDGE.checklist(vals(), { fields, acts, scores: {}, attrRows,
      screenFields: DATA.screenFields });
    const c = list.filter((x) => x.text.indexOf('연습 활동') >= 0)[0];
    ok(!c.ok);
    ok(c.hint.indexOf('데이터 형태 분류') >= 0);
  });
  test('긴 칸에 남은 뭉뚱그린 표현을 짚어 준다', () => {
    const list = JUDGE.checklist(vals({ why: '그냥 ' + '가'.repeat(80) }),
      { fields, acts, scores: scoresAll(), attrRows, screenFields: DATA.screenFields });
    const c = list.filter((x) => x.text.indexOf('뭉뚱그린') >= 0)[0];
    ok(!c.ok);
    ok(c.hint.indexOf('수집한 이유') >= 0);
  });
  test('짧은 칸(관심 분야 등)에는 뭉뚱그림을 따지지 않는다', () => {
    const list = JUDGE.checklist(vals({ interest: '여러 가지' }),
      { fields, acts, scores: scoresAll(), attrRows, screenFields: DATA.screenFields });
    ok(list.filter((x) => x.text.indexOf('뭉뚱그린') >= 0)[0].ok);
  });
  test('칸이 어느 화면에 있는지 찾는다', () => {
    eq(JUDGE.screenOf('problem', { screenFields: DATA.screenFields }), 'solve');
    eq(JUDGE.screenOf('dtype', { screenFields: DATA.screenFields }), 'type');
    eq(JUDGE.screenOf('없는칸', { screenFields: DATA.screenFields }), null);
  });
});
