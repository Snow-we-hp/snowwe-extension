// firm-exclusion.js — 候補者が在籍したことのあるファームのポジションを、提案に出さない
//
// ■ なぜ必要か
// アクセンチュア出身の人に「アクセンチュアのポジション」でスカウトを打っても意味がない
// （出戻りの案内になってしまう）。現職だけでなく、過去に在籍していた場合も同じ扱いにする。
// 依頼の言葉が「履歴があったら」であり、スクリーニングの除外企業も「過去・現職問わず」で
// 揃えているため。
//
// ■ 仕組み
// 職務経歴の文章の中に、下の対応表にある社名・別名が出てくるかを見る。表記ゆれ
// （全角半角・大文字小文字・空白・中黒「・」・「株式会社」の有無）は、比べる前に
// 両方を同じ形にそろえて吸収する。
// PwC のようにグループ会社が多いファームは、グループ全体を1つのファームとして扱う
// （PwCコンサルティング・PwCアドバイザリー・PwC Japan有限責任監査法人 など）。
//
// ■ 別名を足すとき
// FIRM_GROUPS だけを直せばよい（ほかの場所に社名を書かない）。
// ・aliases: 職務経歴の中で探す名前。短い英字（EY など）は、前後が英数字でない
//   ときだけ一致させる（"key" や "survey" に反応しないように）。
//   一般的な言葉と紛らわしい名前（「フューチャー」「あらた」「新日本」など）は
//   単独では入れず、社名として紛れのない形で入れる。
// ・firmValues: ポジション側（候補者管理システムの firm 列）の値。英語表記で入っている。
//
// popup.html から読み込まれ、popup.js から使う。node のテスト
// （tools/test_firm_exclusion.mjs）からも読み込めるよう、最後に module.exports を置く。

const FIRM_GROUPS = [
  {
    key: 'Accenture', name: 'アクセンチュア',
    firmValues: ['Accenture'],
    aliases: ['アクセンチュア', 'Accenture'],
  },
  {
    key: 'PwC', name: 'PwC',
    firmValues: ['PwC'],
    aliases: [
      'PwC', 'プライスウォーターハウスクーパース', 'プライスウォーターハウス',
      'PricewaterhouseCoopers', 'Price Waterhouse',
      // 「ストラテジーアンド」は入れない。EYストラテジー・アンド・コンサルティングに当たってしまう
      'あらた監査法人', 'Strategy&',
    ],
  },
  {
    key: 'Deloitte', name: 'デロイト トーマツ',
    firmValues: ['Deloitte'],
    aliases: ['デロイト', 'Deloitte', 'トーマツ', 'Tohmatsu'],
  },
  {
    key: 'EY', name: 'EY',
    firmValues: ['EY'],
    aliases: [
      'EY', 'アーンスト・アンド・ヤング', 'アーンストアンドヤング', 'Ernst & Young',
      'EY新日本', '新日本有限責任監査法人',
    ],
  },
  {
    key: 'KPMG', name: 'KPMG',
    firmValues: ['KPMG'],
    aliases: ['KPMG', 'あずさ監査法人'],
  },
  {
    key: 'BCG', name: 'ボストン コンサルティング グループ',
    firmValues: ['BCG'],
    aliases: ['BCG', 'ボストン・コンサルティング', 'ボストンコンサルティング', 'Boston Consulting'],
  },
  {
    key: 'McKinsey', name: 'マッキンゼー',
    firmValues: ['McKinsey'],
    aliases: ['マッキンゼー', 'McKinsey'],
  },
  {
    key: 'Bain', name: 'ベイン・アンド・カンパニー',
    firmValues: ['Bain'],
    aliases: ['ベイン・アンド・カンパニー', 'Bain & Company'],
  },
  {
    key: 'BayCurrent', name: 'ベイカレント',
    firmValues: ['ベイカレント', 'BayCurrent'],
    aliases: ['ベイカレント', 'BayCurrent'],
  },
  {
    key: 'ABeam', name: 'アビーム',
    firmValues: ['アビーム', 'ABeam'],
    aliases: ['アビーム', 'ABeam'],
  },
  {
    key: 'Dirbato', name: 'Dirbato',
    firmValues: ['Dirbato'],
    aliases: ['Dirbato', 'ディルバート'],
  },
  {
    key: 'Future', name: 'フューチャー',
    // 「フューチャー」「future」は一般的な言葉なので、経歴側は社名の形でだけ探す
    firmValues: ['future', 'Future'],
    // 「株式会社」は比べる前に消えるので、「フューチャー株式会社」は正規表現で書く
    aliases: [
      'フューチャーアーキテクト', 'Future Architect',
      /フューチャー ?(?:株式会社|\(株\))/, /(?:株式会社|\(株\)) ?フューチャー(?![ァ-ヶー])/,
    ],
  },
  {
    key: 'Catalys', name: 'カタリス',
    firmValues: ['カタリス', 'Catalys'],
    // 「カタリスト」（一般的な言葉・別の会社名）には反応させない
    aliases: [/カタリス(?!ト)/, 'Catalys'],
  },
  {
    key: 'HitachiConsulting', name: '日立コンサルティング',
    firmValues: ['日立コンサルティング', 'Hitachi Consulting'],
    aliases: ['日立コンサルティング', 'Hitachi Consulting'],
  },
];

// 比べる前に、表記ゆれを同じ形にそろえる（日本語の社名用）。
// 全角英数→半角、大文字→小文字、空白・中黒・「株式会社」などを取り除く
function normalizeFirmText(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/株式会社|\(株\)|有限会社|合同会社/g, '')
    .replace(/[\s・･·]/g, '');
}

// 英字の社名用。空白を消すと「Accenture Japan」が「accenturejapan」になり、
// 単語の区切りで判定できなくなるため、空白は1つにまとめて残す
function normalizeFirmTextLoose(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・･·]+/g, ' ');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 別名1つを「どちらの形の文章に当てるか」と正規表現の組にする。
// 正規表現で書いた別名は、「株式会社」や空白を残した形（loose）の文章に当てる
function aliasToMatcher(alias) {
  if (alias instanceof RegExp) return { loose: true, re: new RegExp(alias.source) };
  const n = String(alias).normalize('NFKC').toLowerCase().trim();
  if (/^[a-z0-9&.\s]+$/.test(n)) {
    // 英字の別名: 語の間の空白はあってもなくてもよい。前後が英数字のときは
    // 一致させない（EY が "key" や "survey" に当たらないように）
    const body = n.split(/\s+/).map(escapeRegExp).join('\\s*');
    return { loose: true, re: new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`) };
  }
  return { loose: false, re: new RegExp(escapeRegExp(normalizeFirmText(n))) };
}

const _FIRM_MATCHERS = FIRM_GROUPS.map(g => ({
  group: g,
  matchers: g.aliases.map(aliasToMatcher),
  firmValues: new Set(g.firmValues.map(normalizeFirmText)),
}));

// そろえた2つの形の文章に、そのファームの別名のどれかが出てくるか。見つかった語を返す
function findFirmHit(m, compact, loose) {
  for (const { loose: useLoose, re } of m.matchers) {
    const hit = re.exec(useLoose ? loose : compact);
    if (hit) return hit[0];
  }
  return '';
}

// 職務経歴の文章に出てくるファームを返す。
// 戻り値: [{ key, name, hit }]（hit は見つかった語。画面で理由として見せる）
function detectFormerFirms(profileText) {
  const compact = normalizeFirmText(profileText);
  const loose = normalizeFirmTextLoose(profileText);
  const found = [];
  for (const m of _FIRM_MATCHERS) {
    const hit = findFirmHit(m, compact, loose);
    if (hit) found.push({ key: m.group.key, name: m.group.name, hit });
  }
  return found;
}

// ポジションがどのファームのものかを返す（分からなければ空文字）。
// firm 列の値で引き、無ければ表示名の「ファーム名｜」の部分を別名で引く
function positionFirmKey(p) {
  if (!p) return '';
  if (typeof p === 'string') p = { label: p };
  const firm = normalizeFirmText(p.firm);
  if (firm) {
    const byValue = _FIRM_MATCHERS.find(m => m.firmValues.has(firm));
    if (byValue) return byValue.group.key;
  }
  // 提案結果（AIの返答）は表示名を position に持っている
  const label = String(p.label || p.position || '');
  const prefix = label.includes('｜') ? label.split('｜')[0] : '';
  for (const src of [p.firm, p.firmJa, prefix]) {
    const compact = normalizeFirmText(src);
    if (!compact) continue;
    const loose = normalizeFirmTextLoose(src);
    const m = _FIRM_MATCHERS.find(mm => findFirmHit(mm, compact, loose));
    if (m) return m.group.key;
  }
  return '';
}

// 在籍歴のあるファームのポジションを取り除く。
// positions はオブジェクト（firm / firmJa / label / position を持つ）でも、表示名の文字列でもよい
function excludeFormerFirmPositions(positions, formerFirms) {
  const keys = new Set((formerFirms || []).map(f => (typeof f === 'string' ? f : f.key)));
  if (keys.size === 0) return { kept: positions || [], removed: [] };
  const kept = [];
  const removed = [];
  for (const p of positions || []) {
    (keys.has(positionFirmKey(p)) ? removed : kept).push(p);
  }
  return { kept, removed };
}

// 画面に出す説明文。何が理由で外れたのかが見えないと、誤って外れたときに気づけない
function describeFirmExclusion(formerFirms, removedCount) {
  if (!formerFirms || formerFirms.length === 0) return '';
  const names = formerFirms.map(f => `${f.name}（経歴に「${f.hit}」）`).join('、');
  return `在籍歴のあるファームを除外: ${names}`
    + (typeof removedCount === 'number' ? ` → ${removedCount}件を候補から外しました` : '');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FIRM_GROUPS, normalizeFirmText, detectFormerFirms, positionFirmKey,
    excludeFormerFirmPositions, describeFirmExclusion,
  };
}
