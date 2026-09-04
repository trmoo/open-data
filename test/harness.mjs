/*!
 * 시험 도구 — 아주 작은 시험 틀 (자료구조 실습실에서 가져왔다)
 * © 2026 티쳐무 · 모든 권리 보유
 */
const CASES = [];
let group = '(그룹 없음)';

export function describe(name, fn) {
  const prev = group;
  group = name;
  fn();
  group = prev;
}

export function test(name, fn) {
  CASES.push({ group, name, fn });
}

class Fail extends Error {}

function show(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

export function ok(cond, msg) {
  if (!cond) throw new Fail(msg || '참이어야 합니다');
}

export function eq(got, want, msg) {
  if (got !== want) {
    throw new Fail((msg ? msg + ' — ' : '') + '기대 ' + show(want) + ' · 실제 ' + show(got));
  }
}

export function deepEq(got, want, msg) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) {
    throw new Fail((msg ? msg + ' — ' : '') + '\n    기대 ' + b + '\n    실제 ' + a);
  }
}

export function near(got, want, tol, msg) {
  if (Math.abs(got - want) > (tol == null ? 1e-9 : tol)) {
    throw new Fail((msg ? msg + ' — ' : '') + '기대 ' + want + ' · 실제 ' + got);
  }
}

export function throws(fn, msg) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; }
  if (!threw) throw new Fail(msg || '예외가 나야 합니다');
}

export function run() {
  let pass = 0;
  const fails = [];
  let lastGroup = null;
  for (const c of CASES) {
    if (c.group !== lastGroup) {
      process.stdout.write('\n  ── ' + c.group + '\n');
      lastGroup = c.group;
    }
    try {
      c.fn();
      pass++;
    } catch (e) {
      fails.push({ ...c, err: e });
      process.stdout.write('  ✗ ' + c.name + '\n      ' + (e && e.message) + '\n');
    }
  }
  process.stdout.write('\n' + '═'.repeat(58) + '\n');
  process.stdout.write('  통과 ' + pass + ' / ' + CASES.length + '\n');
  if (fails.length) {
    process.stdout.write('  실패 ' + fails.length + '가지\n');
    for (const f of fails) {
      process.stdout.write('    · [' + f.group + '] ' + f.name + '\n');
    }
    process.stdout.write('═'.repeat(58) + '\n');
    process.exit(1);
  }
  process.stdout.write('  모두 통과했습니다.\n');
  process.stdout.write('═'.repeat(58) + '\n');
}
