// 送信の記録まわりの判定のテスト（content.js の関数を取り出して動かす）
//   node tools/test_record_logic.mjs
// content.js はブラウザの画面で動くため、そのままでは読み込めない。名前を指定した関数・定数だけを
// 文字列として取り出して確かめる。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../content.js', import.meta.url), 'utf8');

// 「function 名前(」または「const 名前 =」から、対応する閉じかっこまでを取り出す
function pick(name) {
  const m = src.match(new RegExp(`^(?:async\\s+)?function\\s+${name}\\s*\\(|^const\\s+${name}\\s*=`, 'm'));
  if (!m) throw new Error(`content.js に ${name} が無い`);
  const i = m.index;
  if (/^const/.test(m[0])) {
    let depth = 0, j = src.indexOf('=', i) + 1;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "'" || c === '"' || c === '`') { for (j++; j < src.length && src[j] !== c; j++) if (src[j] === '\\') j++; continue; }
      if (c === '{' || c === '(' || c === '[') depth++;
      else if (c === '}' || c === ')' || c === ']') depth--;
      else if (c === ';' && depth === 0) break;
    }
    return src.slice(i, j + 1);
  }
  let j = src.indexOf('{', src.indexOf(')', i));
  let depth = 0;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') { for (j++; j < src.length && src[j] !== c; j++) if (src[j] === '\\') j++; continue; }
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  return src.slice(i, j + 1);
}

const names = ['isSameLocalDay', 'recordedMessage', 'dodaxMemberNumbersIn', 'UNSURE_CANDIDATE_REMARK', 'judgeRepeatedSendRequest',
  'RECORD_DEDUPE_MS', 'SAME_SEND_EVENT_MS'];
const ctx = vm.createContext({ console });
vm.runInContext(names.map(pick).join('\n') +
  `\n;globalThis.api = { ${names.join(', ')} };`, ctx);
const api = ctx.api;

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`✓ ${name}`); };

t('同じ日かどうか（この PC の時計で）', () => {
  const d = (h, day = 2) => new Date(2026, 11, day, h, 0).getTime();
  assert.equal(api.isSameLocalDay(d(9), d(23)), true);
  assert.equal(api.isSameLocalDay(d(23, 1), d(0, 2)), false);
  assert.equal(api.isSameLocalDay(0, d(9)), false);
  assert.equal(api.isSameLocalDay(undefined, d(9)), false);
});

t('記録できたときの文言（担当者・会社・年齢）。担当者が空・候補者を確かめられなかったときは注意を出す', () => {
  assert.equal(api.recordedMessage({ company: '日本製鉄株式会社', age: '40歳' }, 'たいち', false), '✅ 記録しました（たいち・日本製鉄株式会社・40歳）');
  assert.equal(api.recordedMessage({}, 'たいち', false), '✅ 記録しました（たいち）');
  assert.ok(api.recordedMessage({ company: 'NEC' }, '', false).startsWith('⚠️ 記録しましたが、担当者名が空です'));
  assert.ok(api.recordedMessage({ company: 'NEC' }, 'たいち', true).startsWith('⚠️ 記録しましたが、候補者を確かめられませんでした'));
});

t('doda X: 「00」で始まる8桁の数字が1種類だけなら会員番号として使える', () => {
  assert.deepEqual([...api.dodaxMemberNumbersIn('山田 00950456\n00950456 32歳')], ['00950456']);
  assert.deepEqual([...api.dodaxMemberNumbersIn('00950456 / 00920421')].sort(), ['00920421', '00950456']); // 2種類 → 使わない
  assert.deepEqual([...api.dodaxMemberNumbersIn('2026年11月21日 20261121 12345678')], []); // 日付などは拾わない
  assert.deepEqual([...api.dodaxMemberNumbersIn('100950456')], []); // 9桁の一部は拾わない
});

t('候補者を確かめられなかった記録の備考は、集計の側（gas/送信記録チェック.gs）が見分ける文字と同じ', () => {
  assert.equal(api.UNSURE_CANDIDATE_REMARK, '続けての送信で候補者を確かめられなかった');
  assert.ok(src.includes('...(opts && opts.forceNew ? { remarks: UNSURE_CANDIDATE_REMARK } : {})'));
});

t('同じ候補者を同じ日にもう一度記録しない（送信の通信で確かめた別の送信は除く）', () => {
  assert.ok(src.includes('if (isSameLocalDay(prev && prev.date, now)) {'));
  assert.ok(/if \(!\(opts && opts\.forceNew\)\) \{\s*try \{\s*const prev = \(await getScoutHistory\(\)\)\[candidateId\];/.test(src));
});

t('続けての送信の判定（3秒未満は同じ送信、5分までは続けて送った）', () => {
  const last = { id: 'rds_mid_A', at: 1_000_000 };
  assert.equal(api.judgeRepeatedSendRequest('rds_mid_A', last, 1_000_000 + 1500), 'same-event');
  assert.equal(api.judgeRepeatedSendRequest('rds_mid_A', last, 1_000_000 + 9_000), 'repeat');
  assert.equal(api.judgeRepeatedSendRequest('rds_mid_B', last, 1_000_000 + 9_000), 'new');
});

console.log(`\n${n} 件 OK`);
