/*!
 * 데이터 시험 — 화면에 실은 자료와 정답이 서로 어긋나지 않게 지킨다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 * ⚠ 이 앱에서 가장 중요한 시험은 「죽은 사이트를 링크로 만들지 않았는가」이다.
 *   2026-09-03 에 수업 참고 자료의 bigdatahub.co.kr 이 도박 광고 사이트가 되어 있었다.
 */
import { describe, test, ok, eq, deepEq } from './harness.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadData } = require('../tools/gas-load.js');

const DATA = loadData();

describe('데이터 사이트 도감', () => {
  test('공공 9곳 · 민간 4곳, 모두 13곳', () => {
    const pub = DATA.sites.filter((s) => s.kind === 'public');
    const pri = DATA.sites.filter((s) => s.kind === 'private');
    eq(pub.length, 9, '공공');
    eq(pri.length, 4, '민간');
    eq(DATA.sites.length, 13);
  });
  test('열쇠가 겹치지 않는다', () => {
    const keys = DATA.sites.map((s) => s.key);
    eq(new Set(keys).size, keys.length);
  });
  test('주소가 모두 https:// 로 시작한다', () => {
    DATA.sites.forEach((s) => {
      ok(/^https:\/\//.test(s.url), s.name + ' — ' + s.url);
    });
  });
  test('사이트마다 무엇을·언제 확인했는지·어떤 형태로 주는지가 있다', () => {
    DATA.sites.forEach((s) => {
      ok(s.name && s.org && s.what && s.good && s.forms && s.tip, s.key + ' 에 빈 항목이 있습니다');
      ok(/^\d{4}-\d{2}-\d{2}$/.test(s.checked), s.key + ' 의 확인한 날이 날짜 모양이 아닙니다');
    });
  });
  test('수업 참고 자료의 살아 있는 곳이 모두 들어 있다', () => {
    /* 슬라이드에 있던 곳 가운데 지금도 열리는 것들 */
    ['datago', 'kosis', 'seoul', 'gg', 'mdis', 'kaggle', 'trends', 'datalab', 'odi']
      .forEach((k) => {
        ok(DATA.sites.some((s) => s.key === k), k + ' 가 도감에 없습니다');
      });
  });
});

describe('⚠ 지금은 쓸 수 없는 곳', () => {
  test('네 곳을 밝혀 두었다', () => {
    eq(DATA.deadSites.length, 4);
  });
  test('모두 link:false — 누를 수 있는 링크로 만들지 않는다', () => {
    DATA.deadSites.forEach((d) => {
      eq(d.link, false, d.name + ' 이(가) 링크가 될 수 있습니다');
    });
  });
  test('도박 광고가 된 SK 빅데이터 허브가 danger 로 표시된다', () => {
    const d = DATA.deadSites.filter((x) => x.addr === 'bigdatahub.co.kr')[0];
    ok(d, 'bigdatahub.co.kr 이 목록에 없습니다');
    eq(d.level, 'danger');
    ok(d.msg.indexOf('들어가지 마세요') >= 0, '들어가지 말라는 말이 없습니다');
  });
  test('죽은 주소가 도감에 섞여 있지 않다', () => {
    DATA.deadSites.forEach((d) => {
      DATA.sites.forEach((s) => {
        ok(s.url.indexOf(d.addr) < 0, s.name + ' 의 주소가 죽은 주소 ' + d.addr + ' 와 겹칩니다');
      });
    });
  });
  test('주소가 바뀐 곳(mdis)은 새 주소가 도감에 있다', () => {
    const moved = DATA.deadSites.filter((d) => d.level === 'moved');
    eq(moved.length, 1);
    eq(moved[0].addr, 'mdis.kostat.go.kr');
    const now = DATA.sites.filter((s) => s.key === 'mdis')[0];
    ok(now.url.indexOf('mdis.mods.go.kr') >= 0, '새 주소가 mdis.mods.go.kr 이 아닙니다');
  });
});

describe('관심 분야', () => {
  test('공공데이터포털의 열여섯 갈래', () => {
    eq(DATA.interests.length, 16);
  });
  test('이름과 열쇠가 겹치지 않는다', () => {
    eq(new Set(DATA.interests.map((f) => f.key)).size, 16);
    eq(new Set(DATA.interests.map((f) => f.name)).size, 16);
  });
  test('분야마다 예시 3개 · 검색어 3개 · 추천 사이트가 있다', () => {
    DATA.interests.forEach((f) => {
      eq(f.examples.length, 3, f.name + ' 예시');
      eq(f.keywords.length, 3, f.name + ' 검색어');
      ok(f.sites.length >= 2, f.name + ' 추천 사이트가 두 곳보다 적습니다');
      ok(f.icon, f.name + ' 아이콘 없음');
    });
  });
  test('추천 사이트가 모두 도감에 실재한다', () => {
    const keys = DATA.sites.map((s) => s.key);
    DATA.interests.forEach((f) => {
      f.sites.forEach((k) => {
        ok(keys.indexOf(k) >= 0, f.name + ' 이(가) 없는 사이트 ' + k + ' 를 가리킵니다');
      });
    });
  });
});

describe('데이터 형태 네 가지', () => {
  test('정형·비정형·반정형·동적', () => {
    deepEq(DATA.types.map((t) => t.key), ['정형', '비정형', '반정형', '동적']);
  });
  test('형태마다 미리보기 조각이 있다', () => {
    DATA.types.forEach((t) => {
      ok(t.preview && t.preview.length > 20, t.key + ' 의 미리보기가 없습니다');
      ok(t.previewKind, t.key + ' 의 미리보기 종류가 없습니다');
      ok(t.formats && t.what && t.how && t.why, t.key + ' 에 빈 항목이 있습니다');
    });
  });
  test('겹칠 수 있다는 것을 밝혀 두었다', () => {
    ok(DATA.typeOverlap.indexOf('JSON') >= 0);
    ok(DATA.typeOverlap.indexOf('반정형') >= 0);
  });
  test('형태마다 속성 표의 물음·머리글·예시가 따로 있다', () => {
    DATA.types.forEach((t) => {
      const p = DATA.attrPrompt[t.key];
      ok(p, t.key + ' 의 속성 표 안내가 없습니다');
      ok(p.ask && p.head && p.what, t.key + ' 의 안내에 빈 항목이 있습니다');
      ok(p.ph && p.ph.name && p.ph.desc && p.ph.ex, t.key + ' 의 예시가 모자랍니다');
    });
  });
  test('정형용 예시(학생수·241)가 다른 형태에 새지 않는다', () => {
    ['반정형', '동적', '비정형'].forEach((k) => {
      const ph = DATA.attrPrompt[k].ph;
      ok(ph.name.indexOf('학생수') < 0 && ph.ex.indexOf('241') < 0,
         k + ' 에 정형용 예시가 들어 있습니다');
    });
  });
});

describe('이용 조건 · 문제 틀 · 예시', () => {
  test('공공누리 네 유형 + 이용약관 + 미확인', () => {
    eq(DATA.licenses.length, 6);
    ['제1유형', '제2유형', '제3유형', '제4유형'].forEach((s) => {
      ok(DATA.licenses.some((l) => l.short === s), s + ' 가 없습니다');
    });
    ok(DATA.licenses.some((l) => l.key.indexOf('확인하지 못함') >= 0), '미확인 항목이 없습니다');
  });
  test('제1유형만 상업적 이용이 열려 있다', () => {
    const l1 = DATA.licenses.filter((l) => l.short === '제1유형')[0];
    ok(l1.mark === '출처표시', '제1유형의 표시가 「출처표시」 가 아닙니다');
    ['제2유형', '제4유형'].forEach((s) => {
      const l = DATA.licenses.filter((x) => x.short === s)[0];
      ok(l.mark.indexOf('상업적 이용금지') >= 0, s + ' 에 상업적 이용금지가 없습니다');
    });
    ['제3유형', '제4유형'].forEach((s) => {
      const l = DATA.licenses.filter((x) => x.short === s)[0];
      ok(l.mark.indexOf('변경금지') >= 0, s + ' 에 변경금지가 없습니다');
    });
  });
  test('문제 결 네 가지에 틀과 보기가 있다', () => {
    eq(DATA.problemKinds.length, 4);
    DATA.problemKinds.forEach((k) => {
      ok(k.frame && k.ex && k.icon, k.key + ' 에 빈 항목이 있습니다');
    });
  });
  test('완성 예시 두 가지가 여덟 항목을 모두 담고 있다', () => {
    eq(DATA.samples.length, 2);
    DATA.samples.forEach((s) => {
      ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'].forEach((no) => {
        ok(s.rows.some((r) => r[0].indexOf(no) === 0), s.title + ' 에 ' + no + ' 항목이 없습니다');
      });
    });
  });
  test('예시의 링크가 지어낸 상세 페이지 주소가 아니다', () => {
    /* 있지도 않은 데이터 번호를 지어내면 학생이 눌렀을 때 열리지 않는다 */
    DATA.samples.forEach((s) => {
      const link = s.rows.filter((r) => r[0].indexOf('④ ') === 0)[0][1];
      ok(link.indexOf('https://www.data.go.kr/') === 0, s.title + ' 의 링크가 포털 첫 화면이 아닙니다');
      ok(link.indexOf('예시') >= 0, s.title + ' 의 링크에 「예시」라는 밝힘이 없습니다');
    });
  });
  test('제공 기관 예시가 넉넉하다', () => {
    ok(DATA.orgs.length >= 15);
  });
  test('속성 자료형이 여섯 가지', () => {
    eq(DATA.attrTypes.length, 6);
  });
  test('편향 자기 점검 물음 5가지 · 문제 자기 점검 물음 4가지', () => {
    eq(DATA.biasSelf.length, 5);
    eq(DATA.problemSelf.length, 4);
  });
});
