/*!
 * 시험 모으기 — 새 시험 파일을 만들면 여기에 한 줄 넣는다.
 * © 2026 티쳐무 · 모든 권리 보유
 */
import { run } from './harness.mjs';
import './data.test.mjs';
import './judge.test.mjs';
import './wiring.test.mjs';
import './server.test.mjs';

process.stdout.write('\n공공데이터 수집 기록장 — 점검\n');
run();
