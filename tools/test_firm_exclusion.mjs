// 在籍歴のあるファームのポジションを提案から外す処理（firm-exclusion.js）のテスト。
// 実行: node tools/test_firm_exclusion.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {
  detectFormerFirms, positionFirmKey, excludeFormerFirmPositions, describeFirmExclusion,
} = require('../firm-exclusion.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { console.log(`FAIL ${name}\n     ${e.message}`); process.exitCode = 1; }
}
const keys = text => detectFormerFirms(text).map(f => f.key).sort();

// ── 経歴の中のファーム名を見つける（表記ゆれ） ──
test('アクセンチュアの表記ゆれ', () => {
  for (const t of [
    'アクセンチュア株式会社 2018年4月〜現在',
    'Accenture Japan Ltd.',
    'ACCENTURE',
    'Ａｃｃｅｎｔｕｒｅ（全角）',
    'アクセンチュア　株式会社',
    'アク セン チュア',
  ]) assert.deepEqual(keys(t), ['Accenture'], t);
});

test('PwC はグループ全体を同じファームとして扱う', () => {
  for (const t of [
    'PwCコンサルティング合同会社',
    'PwCアドバイザリー合同会社',
    'PwC Japan有限責任監査法人',
    'ＰｗＣ税理士法人',
    'プライスウォーターハウスクーパース株式会社',
    'PricewaterhouseCoopers Aarata',
    'あらた監査法人',
    'Strategy& (PwC)',
  ]) assert.deepEqual(keys(t), ['PwC'], t);
});

test('BIG4・戦略ファームも同じ仕組みで見つかる', () => {
  assert.deepEqual(keys('デロイト トーマツ コンサルティング合同会社'), ['Deloitte']);
  assert.deepEqual(keys('有限責任監査法人トーマツ'), ['Deloitte']);
  assert.deepEqual(keys('Deloitte Tohmatsu Consulting'), ['Deloitte']);
  assert.deepEqual(keys('EYストラテジー・アンド・コンサルティング株式会社'), ['EY']);
  assert.deepEqual(keys('Ernst & Young'), ['EY']);
  assert.deepEqual(keys('EY新日本有限責任監査法人'), ['EY']);
  assert.deepEqual(keys('KPMGコンサルティング株式会社'), ['KPMG']);
  assert.deepEqual(keys('有限責任 あずさ監査法人'), ['KPMG']);
  assert.deepEqual(keys('ボストン コンサルティング グループ'), ['BCG']);
  assert.deepEqual(keys('Boston Consulting Group'), ['BCG']);
  assert.deepEqual(keys('BCG'), ['BCG']);
  assert.deepEqual(keys('マッキンゼー・アンド・カンパニー'), ['McKinsey']);
  assert.deepEqual(keys('McKinsey & Company'), ['McKinsey']);
  assert.deepEqual(keys('ベイン・アンド・カンパニー'), ['Bain']);
  assert.deepEqual(keys('株式会社ベイカレント・コンサルティング'), ['BayCurrent']);
  assert.deepEqual(keys('アビームコンサルティング株式会社'), ['ABeam']);
  assert.deepEqual(keys('フューチャーアーキテクト株式会社'), ['Future']);
  assert.deepEqual(keys('フューチャー株式会社'), ['Future']);
  assert.deepEqual(keys('フューチャー（株）'), ['Future']);
  assert.deepEqual(keys('株式会社カタリス'), ['Catalys']);
  assert.deepEqual(keys('株式会社日立コンサルティング'), ['HitachiConsulting']);
});

test('過去の在籍も含めて、複数のファームを全部拾う', () => {
  const text = `【職務経歴】
2020年4月〜現在 株式会社ベイカレント・コンサルティング シニアコンサルタント
2015年4月〜2020年3月 アクセンチュア株式会社 テクノロジーコンサルティング本部
2012年4月〜2015年3月 PwCアドバイザリー合同会社`;
  assert.deepEqual(keys(text), ['Accenture', 'BayCurrent', 'PwC']);
});

// ── 関係のない言葉に反応しない ──
test('紛らわしい言葉には反応しない', () => {
  for (const t of [
    'key account management / survey design / money forward / they',
    'future vision を描く',               // フューチャー（社名）ではない
    'フューチャーセンターの運営',         // 同上
    '株式会社フューチャーショップ',       // 別の会社
    'カタリストとして組織変革を推進',     // カタリス（社名）ではない
    'あらた めて振り返ると',             // あらた監査法人ではない
    '新日本製鐵 生産管理',                // EY新日本ではない
    'ベインキャピタル投資先の事業会社',   // ベイン・アンド・カンパニーではない
    'Strategy & Consulting 部門',         // Strategy&（PwC）ではない
    '株式会社リクルート 法人営業',
  ]) assert.deepEqual(keys(t), [], t);
});

test('EYストラテジー・アンド・コンサルティングを PwC（Strategy&）と取り違えない', () => {
  assert.deepEqual(keys('EYストラテジー・アンド・コンサルティング'), ['EY']);
  assert.deepEqual(keys('EY Strategy and Consulting'), ['EY']);
});

test('空の経歴では何も見つからない', () => {
  assert.deepEqual(keys(''), []);
  assert.deepEqual(keys(null), []);
});

// ── ポジション側がどのファームか ──
test('ポジションのファームを firm 列・表示名から引く', () => {
  assert.equal(positionFirmKey({ firm: 'Accenture', label: 'アクセンチュア｜戦略コンサルタント' }), 'Accenture');
  assert.equal(positionFirmKey({ firm: 'PwC' }), 'PwC');
  assert.equal(positionFirmKey({ firm: 'future' }), 'Future');
  assert.equal(positionFirmKey({ firm: 'アビーム' }), 'ABeam');
  assert.equal(positionFirmKey({ firm: 'ベイカレント' }), 'BayCurrent');
  assert.equal(positionFirmKey({ firmJa: 'デロイト トーマツ コンサルティング' }), 'Deloitte');
  assert.equal(positionFirmKey('EYストラテジー・アンド・コンサルティング｜DXコンサルタント'), 'EY');
  assert.equal(positionFirmKey({ position: 'PwCコンサルティング｜SCMコンサルタント' }), 'PwC');
  // ポジション名にほかのファーム名が入っていても、ファーム名の部分だけで判断する
  assert.equal(positionFirmKey('KPMGコンサルティング｜アクセンチュア出身者歓迎ポジション'), 'KPMG');
  assert.equal(positionFirmKey('戦略コンサルタント'), '');
});

// ── 取り除く ──
const positions = [
  { id: 1, firm: 'Accenture', firmJa: 'アクセンチュア', label: 'アクセンチュア｜戦略コンサルタント' },
  { id: 2, firm: 'PwC', firmJa: 'PwCコンサルティング', label: 'PwCコンサルティング｜SCM' },
  { id: 3, firm: 'Deloitte', firmJa: 'デロイト トーマツ コンサルティング', label: 'デロイト トーマツ コンサルティング｜M&A' },
  { id: 4, firm: 'EY', firmJa: 'EYストラテジー・アンド・コンサルティング', label: 'EYストラテジー・アンド・コンサルティング｜DX' },
  { id: 5, firm: 'Accenture', firmJa: 'アクセンチュア', label: 'アクセンチュア｜SAPコンサルタント' },
];

test('在籍歴のあるファームのポジションだけが外れる', () => {
  const firms = detectFormerFirms('2016年 アクセンチュア入社 / 2021年 PwCアドバイザリーに転職（現職）');
  const { kept, removed } = excludeFormerFirmPositions(positions, firms);
  assert.deepEqual(kept.map(p => p.id), [3, 4]);
  assert.deepEqual(removed.map(p => p.id), [1, 2, 5]);
});

test('ファームの在籍歴が無ければ何も外さない', () => {
  const { kept, removed } = excludeFormerFirmPositions(positions, detectFormerFirms('株式会社リクルート 法人営業'));
  assert.equal(kept.length, positions.length);
  assert.equal(removed.length, 0);
});

test('表示名の文字列の一覧・AIの提案結果からも外せる', () => {
  const firms = detectFormerFirms('Accenture');
  const labels = positions.map(p => p.label);
  assert.deepEqual(excludeFormerFirmPositions(labels, firms).kept,
    ['PwCコンサルティング｜SCM', 'デロイト トーマツ コンサルティング｜M&A', 'EYストラテジー・アンド・コンサルティング｜DX']);
  const suggestions = [
    { position: 'アクセンチュア｜戦略コンサルタント', match_score: 90 },
    { position: 'PwCコンサルティング｜SCM', match_score: 80 },
  ];
  assert.deepEqual(excludeFormerFirmPositions(suggestions, firms).kept.map(s => s.match_score), [80]);
});

test('画面に出す説明に、理由になった語と件数が入る', () => {
  const firms = detectFormerFirms('アクセンチュア株式会社');
  const msg = describeFirmExclusion(firms, 2);
  assert.match(msg, /アクセンチュア/);
  assert.match(msg, /2件/);
  assert.equal(describeFirmExclusion([], 0), '');
});

console.log(`\n${passed}件 成功${process.exitCode ? '（失敗あり）' : ''}`);
