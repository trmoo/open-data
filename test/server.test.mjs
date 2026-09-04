/*!
 * 서버 시험 — 가짜 시트 위에서 진짜 Code.gs 를 그대로 돌린다.
 * © 2026 티쳐무 · 모든 권리 보유
 */
import { describe, test, ok, eq, deepEq, near, throws } from './harness.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { freshServer, loadServer, withStudent } = require('../tools/gas-load.js');

const LONG = (n) => '가'.repeat(n);

/** 서술 칸을 기준 글자 수만큼 다 채운 payload */
function fullPayload(api, extra) {
  const vals = {};
  api.FIELDS.forEach((f) => { vals[f.key] = LONG(f.min); });
  Object.keys(extra || {}).forEach((k) => { vals[k] = extra[k]; });
  const scores = {};
  api.ACTIVITIES.forEach((a) => { scores[a.key] = { g: a.max, a: true }; });
  return { v: 1, vals: vals, scores: scores, answers: { 'attr-rows': [{ name: '가' }] } };
}

function cell(gas, sheet, row, colName, api) {
  const head = gas.sheets[sheet].dump()[0];
  return gas.sheets[sheet].dump()[row][head.indexOf(colName)];
}

describe('시트 준비', () => {
  test('시트 네 장을 만든다', () => {
    const { api, gas } = freshServer();
    deepEq(Object.keys(gas.sheets).sort(),
      ['계정(비밀번호)', '작성 중(임시 저장)', '제출 기록(백업)', '제출 현황'].sort());
    ok(api);
  });
  test('제출 현황의 머리글이 기준표와 같다', () => {
    const { api, gas } = freshServer();
    deepEq(gas.sheets['제출 현황'].dump()[0], api.statusHeader_());
  });
  test('머리글은 메타 16 + 서술 13 + 활동 3 = 32열', () => {
    const { api } = freshServer();
    eq(api.META_COLS.length, 16);
    eq(api.statusHeader_().length, 32);
  });
  test('계정 시트는 숨긴다 (비밀번호 해시가 보이지 않게)', () => {
    const { gas } = freshServer();
    ok(gas.sheets['계정(비밀번호)'].hidden);
  });
  test('두 번 실행해도 머리글이 망가지지 않는다', () => {
    const { api, gas } = freshServer();
    api.setupSheets();
    deepEq(gas.sheets['제출 현황'].dump()[0], api.statusHeader_());
  });
  test('메타 열은 이름으로 찾는다 (숫자를 박지 않는다)', () => {
    const { api } = freshServer();
    eq(api.metaIdx_('학번'), 0);
    eq(api.metaIdx_('제출 시각'), 6);
    eq(api.metaIdx_('제출 후 수정'), 7);
    throws(() => api.metaIdx_('없는 열'));
  });
  test('시트를 만들기 전에 부르면 안내 문구가 나온다', () => {
    const { api } = loadServer();
    let msg = '';
    try { api.apiLookup('20101'); } catch (e) { msg = e.message; }
    ok(msg.indexOf('① 시트 준비하기') >= 0, '안내 문구: ' + msg);
  });
});

describe('학번·이름', () => {
  const { api } = freshServer();
  test('다섯 자리 학번을 학년·반·번호로 나눈다', () => {
    deepEq(api.parseSid_('20315'), { grade: 2, cls: 3, num: 15 });
    deepEq(api.parseSid_('1102'), { grade: 1, cls: 1, num: 2 });
  });
  test('학번은 숫자 4~5자리만 받는다', () => {
    eq(api.normSid_('20315'), '20315');
    eq(api.normSid_(' 2 0 3 1 5 '), '20315');
    eq(api.normSid_('203'), '');
    eq(api.normSid_('20315a'), '');
  });
  test('이름을 홍*동 처럼 가린다', () => {
    eq(api.maskName_('홍길동'), '홍*동');
    eq(api.maskName_('남궁민수'), '남**수');
    eq(api.maskName_('김철'), '김*');
  });
});

describe('로그인', () => {
  test('처음 오는 학번', () => {
    const { api } = freshServer();
    const r = api.apiLookup('20101');
    eq(r.state, 'new');
  });
  test('등록하면 접속표를 받는다', () => {
    const { api } = freshServer();
    const r = api.apiRegister('20101', '홍길동', 'pw1234');
    ok(r.ok);
    ok(r.token && r.token.length > 10);
    eq(api.apiLookup('20101').state, 'known');
    eq(api.apiLookup('20101').masked, '홍*동');
  });
  test('비밀번호는 해시로만 저장된다', () => {
    const { api, gas } = freshServer();
    api.apiRegister('20101', '홍길동', 'pw1234');
    const row = gas.sheets['계정(비밀번호)'].dump()[1];
    ok(row.join('|').indexOf('pw1234') < 0, '비밀번호가 그대로 저장되어 있습니다');
    ok(/^[0-9a-f]{64}$/.test(row[2]), '해시가 아닙니다');
  });
  test('비밀번호가 틀리면 못 들어온다', () => {
    const { api } = freshServer();
    api.apiRegister('20101', '홍길동', 'pw1234');
    ok(!api.apiLogin('20101', 'wrong').ok);
    ok(api.apiLogin('20101', 'pw1234').ok);
  });
  test('네 글자보다 짧은 비밀번호는 막는다', () => {
    const { api } = freshServer();
    ok(!api.apiRegister('20101', '홍길동', '123').ok);
  });
  test('같은 학번으로 두 번 등록할 수 없다', () => {
    const { api } = freshServer();
    api.apiRegister('20101', '홍길동', 'pw1234');
    ok(!api.apiRegister('20101', '다른이름', 'pw5678').ok);
  });
  test('초기화된 계정은 이름을 맞혀야 새로 정할 수 있다', () => {
    const { api, gas } = freshServer();
    api.apiRegister('20101', '홍길동', 'pw1234');
    const a = api.accRow_('20101');
    gas.sheets['계정(비밀번호)'].getRange(a.row, 3, 1, 5).setValues([['', '', '', '', '']]);
    eq(api.apiLookup('20101').state, 'reset');
    ok(!api.apiRegister('20101', '김영희', 'new1234').ok, '남의 이름으로 뺏을 수 있습니다');
    ok(api.apiRegister('20101', '홍길동', 'new1234').ok);
  });
  test('초기화해도 작성한 내용은 남는다', () => {
    const { api, gas } = freshServer();
    const tk = withStudent(api, '20101', '홍길동', 'pw1234');
    api.apiSave(tk, fullPayload(api, { data_name: '버스정류장' }));
    const a = api.accRow_('20101');
    gas.sheets['계정(비밀번호)'].getRange(a.row, 3, 1, 5).setValues([['', '', '', '', '']]);
    const r = api.apiRegister('20101', '홍길동', 'new1234');
    ok(r.ok);
    eq(r.data.vals.data_name, '버스정류장');
  });
  test('접속표가 없으면 저장할 수 없다', () => {
    const { api } = freshServer();
    const r = api.apiSave('없는표', { vals: {} });
    ok(!r.ok);
    ok(r.expired);
  });
  test('나가면 접속표가 지워진다', () => {
    const { api } = freshServer();
    const tk = withStudent(api);
    api.apiLogout(tk);
    ok(!api.apiLoad(tk).ok);
  });
  test('비밀번호를 바꿀 수 있다', () => {
    const { api } = freshServer();
    const tk = withStudent(api, '20101', '홍길동', 'pw1234');
    ok(!api.apiChangePw(tk, '틀림', 'new1234').ok);
    ok(api.apiChangePw(tk, 'pw1234', 'new1234').ok);
    ok(api.apiLogin('20101', 'new1234').ok);
  });
});

describe('정리하기(tally_)', () => {
  const { api } = freshServer();
  test('진행률 = (채운 칸 + 손댄 활동) ÷ 16', () => {
    const t = api.tally_(fullPayload(api));
    eq(t.filled, 13);
    eq(t.tried, 3);
    eq(t.progress, 100);
  });
  test('★ 비정형을 고르면 속성 칸을 빼고 세어 100% 가 된다', () => {
    /* 안 빼면 그 학생은 아무리 채워도 100% 가 될 수 없다 */
    const p = fullPayload(api, { dtype: '비정형', attrs: '' });
    const t = api.tally_(p);
    eq(t.filled, 12, '13칸 가운데 속성 칸을 뺀 12칸');
    eq(t.progress, 100);
  });
  test('정형이면 속성 칸을 세므로 비우면 100% 가 아니다', () => {
    const t = api.tally_(fullPayload(api, { dtype: '정형', attrs: '' }));
    eq(t.filled, 12);
    ok(t.progress < 100, '정형인데도 100% 가 되었습니다: ' + t.progress);
  });
  test('반정형·동적도 마찬가지다 (「정형」 을 글자로 품는 함정)', () => {
    ['반정형', '동적', '동적(API), 응답은 JSON'].forEach((d) => {
      eq(api.tally_(fullPayload(api, { dtype: d, attrs: '' })).progress, 100, d);
    });
  });
  test('아직 형태를 안 골랐으면 속성 칸을 센다', () => {
    ok(api.tally_(fullPayload(api, { dtype: '', attrs: '' })).progress < 100);
  });
  test('아무것도 안 쓰면 0%', () => {
    const t = api.tally_({ vals: {}, scores: {} });
    eq(t.progress, 0);
    eq(t.chars, 0);
  });
  test('만점은 서버를 믿는다 (화면이 부풀려 보내도 잘린다)', () => {
    const t = api.tally_({ vals: {}, scores: { 'type-sort': { g: 999, a: true } } });
    eq(t.per['type-sort'], 8);
    eq(t.got, 8);
  });
  test('음수 점수는 0으로', () => {
    const t = api.tally_({ vals: {}, scores: { 'type-sort': { g: -5, a: true } } });
    eq(t.per['type-sort'], 0);
  });
  test('시트에 따로 적을 값(관심 분야·데이터 이름·형태·링크)을 꺼낸다', () => {
    const t = api.tally_(fullPayload(api, {
      interest: '환경기상', data_name: '미세먼지', dtype: '동적',
      source_url: 'https://www.data.go.kr/'
    }));
    eq(t.interest, '환경기상');
    eq(t.dataName, '미세먼지');
    eq(t.dtype, '동적');
    eq(t.url, 'https://www.data.go.kr/');
  });
  test('너무 긴 글은 1500자에서 자른다', () => {
    const t = api.tally_({ vals: { why: LONG(3000) }, scores: {} });
    eq(t.vals.why.length, 1500);
  });
  test('제어문자를 걷어 낸다', () => {
    const t = api.tally_({ vals: { why: 'a bc' }, scores: {} });
    eq(t.vals.why, 'abc');
  });
});

describe('저장과 제출', () => {
  test('저장하면 「작성 중」과 「제출 현황」에 함께 쓰인다', () => {
    const { api, gas } = freshServer();
    const tk = withStudent(api, '20101', '홍길동');
    const r = api.apiSave(tk, fullPayload(api, { interest: '교통물류' }));
    ok(r.ok);
    eq(r.progress, 100);
    eq(gas.sheets['작성 중(임시 저장)'].dump().length, 2);
    eq(gas.sheets['제출 현황'].dump().length, 2);
    eq(cell(gas, '제출 현황', 1, '관심 분야'), '교통물류');
  });
  test('작성 중에는 제출 시각이 비어 있다', () => {
    const { api, gas } = freshServer();
    const tk = withStudent(api);
    api.apiSave(tk, fullPayload(api));
    eq(cell(gas, '제출 현황', 1, '제출 시각'), '');
  });
  test('여러 번 저장해도 줄이 늘지 않는다', () => {
    const { api, gas } = freshServer();
    const tk = withStudent(api);
    api.apiSave(tk, fullPayload(api));
    api.apiSave(tk, fullPayload(api));
    api.apiSave(tk, fullPayload(api));
    eq(gas.sheets['제출 현황'].dump().length, 2);
  });
  test('제출하면 시각이 찍히고 백업에 한 줄 쌓인다', () => {
    const { api, gas } = freshServer();
    const tk = withStudent(api);
    const r = api.apiSubmit(tk, fullPayload(api, { data_name: '버스정류장 위치정보' }));
    ok(r.ok);
    ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(r.at), '제출 시각 모양: ' + r.at);
    ok(cell(gas, '제출 현황', 1, '제출 시각'));
    eq(gas.sheets['제출 기록(백업)'].dump().length, 2);
    eq(gas.sheets['제출 기록(백업)'].dump()[1][3], '버스정류장 위치정보');
  });
  test('★ 제출한 뒤 자동 저장해도 제출 시각이 지워지지 않는다', () => {
    const { api, gas } = freshServer();
    const tk = withStudent(api);
    api.apiSubmit(tk, fullPayload(api));
    const at = cell(gas, '제출 현황', 1, '제출 시각');
    api.apiSave(tk, fullPayload(api, { why: '고쳐 씀' }));
    eq(cell(gas, '제출 현황', 1, '제출 시각'), at, '제출 시각이 지워졌습니다');
  });
  test('제출한 뒤에 고치면 「제출 후 수정」이 찍힌다', () => {
    const { api, gas } = freshServer();
    const tk = withStudent(api);
    api.apiSubmit(tk, fullPayload(api));
    eq(cell(gas, '제출 현황', 1, '제출 후 수정'), '');
    api.apiSave(tk, fullPayload(api, { why: '고쳐 씀' }));
    ok(cell(gas, '제출 현황', 1, '제출 후 수정'), '고친 사실이 안 적혔습니다');
  });
  test('다시 제출하면 「제출 후 수정」이 지워진다', () => {
    const { api, gas } = freshServer();
    const tk = withStudent(api);
    api.apiSubmit(tk, fullPayload(api));
    api.apiSave(tk, fullPayload(api, { why: '고쳐 씀' }));
    api.apiSubmit(tk, fullPayload(api, { why: '고쳐 씀' }));
    eq(cell(gas, '제출 현황', 1, '제출 후 수정'), '');
  });
  test('집에서 이어 쓰기 — 다시 들어오면 쓰던 내용이 온다', () => {
    const { api } = freshServer();
    const tk = withStudent(api, '20101', '홍길동', 'pw1234');
    api.apiSave(tk, fullPayload(api, { data_name: '이어서 쓰기' }));
    api.apiLogout(tk);
    const again = api.apiLogin('20101', 'pw1234');
    eq(again.data.vals.data_name, '이어서 쓰기');
  });
  test('활동 풀이 상태도 함께 이어진다', () => {
    const { api } = freshServer();
    const tk = withStudent(api, '20101', '홍길동', 'pw1234');
    api.apiSave(tk, { v: 1, vals: {}, scores: {}, answers: { 'site-match': ['학교알리미'] } });
    const again = api.apiLogin('20101', 'pw1234');
    deepEq(again.data.answers['site-match'], ['학교알리미']);
  });
  test('마감하면 제출이 막히지만 저장은 계속된다', () => {
    const { api, gas } = freshServer();
    const tk = withStudent(api);
    gas.PropertiesService.getDocumentProperties().setProperty('closed', '1');
    const r = api.apiSubmit(tk, fullPayload(api));
    ok(!r.ok);
    ok(r.msg.indexOf('마감') >= 0);
    ok(api.apiSave(tk, fullPayload(api)).ok, '마감해도 저장은 되어야 합니다');
  });
});

describe('우리 반이 모은 데이터', () => {
  function seed(api, list) {
    list.forEach((s) => {
      const tk = withStudent(api, s[0], s[1], 'pw1234');
      api.apiSave(tk, { v: 1, vals: { interest: s[2], dtype: s[3] }, scores: {}, answers: {} });
      api.apiLogout(tk);
    });
  }
  test('세 명보다 적으면 열리지 않는다 (누가 골랐는지 드러나므로)', () => {
    const { api } = freshServer();
    seed(api, [['20101', '가나다', '교통물류', '정형'], ['20102', '라마바', '환경기상', '동적']]);
    const st = api.classStat_();
    ok(!st.enough);
    eq(st.n, 2);
    eq(st.min, 3);
    deepEq(st.interest, []);
  });
  test('세 명 이상이면 분야·형태를 개수로 보여 준다', () => {
    const { api } = freshServer();
    seed(api, [['20101', '가나다', '환경기상', '정형'],
               ['20102', '라마바', '환경기상', '정형'],
               ['20103', '사아자', '교통물류', '동적']]);
    const st = api.classStat_();
    ok(st.enough);
    eq(st.n, 3);
    deepEq(st.interest[0], { name: '환경기상', count: 2 });
    deepEq(st.dtype[0], { name: '정형', count: 2 });
  });
  test('이름은 담지 않는다', () => {
    const { api } = freshServer();
    seed(api, [['20101', '홍길동', '환경기상', '정형'],
               ['20102', '김영희', '환경기상', '정형'],
               ['20103', '이철수', '교통물류', '동적']]);
    const txt = JSON.stringify(api.classStat_());
    ok(txt.indexOf('홍길동') < 0 && txt.indexOf('20101') < 0, '이름이나 학번이 섞였습니다');
  });
  test('접속표가 없으면 볼 수 없다', () => {
    const { api } = freshServer();
    ok(!api.apiClassStat('없는표').ok);
  });
});

describe('교사 메뉴가 만드는 글', () => {
  test('기록이 없으면 요약이 null', () => {
    const { api } = freshServer();
    eq(api.summaryText_(), null);
    eq(api.collectedText_(), null);
  });
  test('현황 요약에 인원·제출·진행률이 들어간다', () => {
    const { api } = freshServer();
    const tk = withStudent(api, '20101', '홍길동');
    api.apiSubmit(tk, fullPayload(api));
    const t = api.summaryText_();
    ok(t.indexOf('학생 1명') >= 0, t);
    ok(t.indexOf('제출 1명') >= 0);
    ok(t.indexOf('평균 진행률 100%') >= 0);
    ok(t.indexOf('활동별 평균') >= 0);
    ok(t.indexOf('보는 범위') >= 0, '차시 범위를 밝혀야 합니다');
  });
  test('반 평균이 절반에 못 미치는 활동에 ⚠ 를 붙인다', () => {
    const { api } = freshServer();
    const tk = withStudent(api, '20101', '홍길동');
    const p = fullPayload(api);
    p.scores['bias-check'] = { g: 1, a: true };      /* 5점 만점에 1점 */
    api.apiSubmit(tk, p);
    const t = api.summaryText_();
    ok(/⚠ 편향 점검/.test(t), t);
  });
  test('학생 답 자세히 보기에 서술 원문과 활동 점수가 나온다', () => {
    const { api } = freshServer();
    const tk = withStudent(api, '20101', '홍길동');
    api.apiSave(tk, fullPayload(api, { data_name: '전국 버스정류장 위치정보' }));
    const t = api.detailText_('20101', '홍길동', '', null);
    ok(t.indexOf('전국 버스정류장 위치정보') >= 0);
    ok(t.indexOf('활동 점수') >= 0);
    ok(t.indexOf('Ⅰ 기록하기') >= 0);
    ok(t.indexOf('Ⅱ 마무리') >= 0);
  });
  test('기준에 못 미친 칸에 △ 를 붙인다', () => {
    const { api } = freshServer();
    const tk = withStudent(api, '20101', '홍길동');
    api.apiSave(tk, fullPayload(api, { why: '짧다' }));
    const t = api.detailText_('20101', '홍길동', '', null);
    ok(/△ \[⑤\] 수집한 이유/.test(t), t);
  });
  test('제출 뒤 고쳤으면 그 사실을 알려 준다', () => {
    const { api } = freshServer();
    const tk = withStudent(api, '20101', '홍길동');
    api.apiSave(tk, fullPayload(api));
    const t = api.detailText_('20101', '홍길동', new Date(), null);
    ok(t.indexOf('제출한 뒤에 고쳤습니다') >= 0);
  });
  test('모은 데이터 한눈에 보기 — 분포와 학생별 목록', () => {
    const { api } = freshServer();
    const tk = withStudent(api, '20101', '홍길동');
    api.apiSave(tk, fullPayload(api, {
      interest: '환경기상', data_name: '미세먼지 측정정보', provider: '한국환경공단',
      dtype: '동적', source_url: 'https://www.data.go.kr/'
    }));
    const t = api.collectedText_();
    ok(t.indexOf('관심 분야') >= 0);
    ok(t.indexOf('데이터 형태') >= 0);
    ok(t.indexOf('학생별 목록') >= 0);
    ok(t.indexOf('미세먼지 측정정보') >= 0);
    ok(t.indexOf('한국환경공단') >= 0);
    ok(t.indexOf('https://www.data.go.kr/') >= 0, '교사가 링크를 눌러 볼 수 있어야 합니다');
  });
  test('여러 학생이 같은 데이터를 골랐으면 알려 준다', () => {
    const { api } = freshServer();
    ['20101', '20102'].forEach((sid) => {
      const tk = withStudent(api, sid, '학생' + sid, 'pw1234');
      api.apiSave(tk, fullPayload(api, { data_name: '같은 데이터' }));
      api.apiLogout(tk);
    });
    const t = api.collectedText_();
    ok(t.indexOf('여러 학생이 고른 같은 데이터') >= 0);
    ok(t.indexOf('2명  같은 데이터') >= 0, t);
  });
  test('미제출 학생 목록에 필요한 열이 있다', () => {
    const { api } = freshServer();
    const tk = withStudent(api, '20101', '홍길동');
    api.apiSave(tk, fullPayload(api));
    eq(typeof api.menuNotSubmitted, 'function');
    eq(api.submittedAt_('20101'), '');
    api.apiSubmit(tk, fullPayload(api));
    ok(api.submittedAt_('20101'));
  });
});

describe('공개 주소 ?api=stat', () => {
  test('개인정보 없이 참여 수만 알려 준다', () => {
    const { api } = freshServer();
    withStudent(api, '20101', '홍길동');
    const tk = api.apiLogin('20101', 'pw1234').token;
    api.apiSave(tk, fullPayload(api));
    const st = api.publicStat_();
    ok(st.ok);
    eq(st.students, 1);
    eq(st.totalMax, 18);
    ok(JSON.stringify(st).indexOf('홍길동') < 0);
  });
});

describe('화면에 넘겨 주는 기준표(clientBoot_)', () => {
  test('기준표·차시 범위·탭을 함께 넘긴다', () => {
    const { api } = freshServer();
    const b = api.clientBoot_();
    eq(b.fields.length, 13);
    eq(b.activities.length, 3);
    eq(b.tabs.length, 2);
    eq(b.totalMax, 18);
    eq(b.steps, 16);
    eq(b.closed, false);
    deepEq(b.course.screens, api.COURSE.screens);
  });
});
