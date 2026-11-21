// 会社のアカウントから担当者名を決める処理（staff-from-account.js）のテスト。
// 実行: node tools/test_staff_from_account.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { staffNameFromEmail, recruiterFixFor, STAFF_BY_ACCOUNT_NAME } = require('../staff-from-account.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { console.log(`FAIL ${name}\n     ${e.message}`); process.exitCode = 1; }
}

test('@ の前の最初のローマ字で担当者名を決める', () => {
  assert.equal(staffNameFromEmail('taichi.example@snow-we.jp'), 'たいち');
  assert.equal(staffNameFromEmail('Taketo.Example@SNOW-WE.JP'), 'たけと');
  assert.equal(staffNameFromEmail('yuki_example@snow-we.jp'), 'ゆうき');
  assert.equal(staffNameFromEmail('reishiro@snow-we.jp'), 'れいしろう');
  assert.equal(staffNameFromEmail('kojiro.example@snow-we.jp'), 'こうじ');
});

test('会社以外のアカウント・だれか分からないアカウントでは決めない', () => {
  assert.equal(staffNameFromEmail('taichi.example@gmail.com'), '');
  assert.equal(staffNameFromEmail('info@snow-we.jp'), '');
  assert.equal(staffNameFromEmail(''), '');
  assert.equal(staffNameFromEmail(null), '');
});

test('ほかの人の名前が選ばれていたら、アカウントの名前に直す（こうじのPCで「たけと」の例）', () => {
  const fix = recruiterFixFor('koji.example@snow-we.jp', { recruiter: 'たけと', url: 'https://example' }, 'たけと');
  assert.deepEqual(fix, {
    gasSettings: { recruiter: 'こうじ', url: 'https://example' }, recruiterName: 'こうじ', recruiterBeforeAccount: 'たけと',
  });
});

test('名前が合っていれば何もしない。決められないアカウントでも何もしない', () => {
  assert.equal(recruiterFixFor('taichi.example@snow-we.jp', { recruiter: 'たいち' }, 'たいち'), null);
  assert.equal(recruiterFixFor('info@snow-we.jp', { recruiter: 'たけと' }, 'たけと'), null);
  // 片方だけ違っても直す
  assert.equal(recruiterFixFor('taichi.example@snow-we.jp', { recruiter: 'たいち' }, '').recruiterName, 'たいち');
});

test('決める名前は popup の担当者名の選択肢にあるものだけ', () => {
  const html = readFileSync(new URL('../popup.html', import.meta.url), 'utf8');
  const sel = html.slice(html.indexOf('id="gas-recruiter"'), html.indexOf('</select>', html.indexOf('id="gas-recruiter"')));
  const options = [...sel.matchAll(/<option value="([^"]+)">/g)].map(m => m[1]);
  for (const name of new Set(Object.values(STAFF_BY_ACCOUNT_NAME))) assert.ok(options.includes(name), name);
});

test('background.js が staff-from-account.js を読み込んでいる', () => {
  const bg = readFileSync(new URL('../background.js', import.meta.url), 'utf8');
  assert.ok(bg.includes("importScripts('staff-from-account.js')"));
});

console.log(`\n${passed} 件 OK`);
