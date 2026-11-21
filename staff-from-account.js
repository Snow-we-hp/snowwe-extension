// 会社の Google アカウント（@snow-we.jp）から担当者名を決める。
// 担当者名を手で選ぶと、ほかの人の名前を選んだまま送ってしまうことがある
// （実例: こうじの PC で「たけと」が選ばれていて、10/15〜11/9 のこうじの送信がたけとの記録になっていた）。
// ログインしていれば、メールアドレスの @ の前の最初のローマ字（例: taichi.endo → taichi）で名前を決め、手では変えられなくする。
// background.js（importScripts）と popup.html（<script>）から読み込む。

const STAFF_ACCOUNT_DOMAIN = '@snow-we.jp';

// @ の前の最初のローマ字 → 担当者名（popup.html の担当者名の選択肢と同じ書き方）
const STAFF_BY_ACCOUNT_NAME = {
  taketo: 'たけと',
  yuki: 'ゆうき', yuuki: 'ゆうき',
  taichi: 'たいち',
  reishiro: 'れいしろう', reishirou: 'れいしろう',
  koji: 'こうじ', kouji: 'こうじ', kojiro: 'こうじ', koujiro: 'こうじ', kojirou: 'こうじ', koujirou: 'こうじ',
};

// メールアドレスから担当者名。会社のアカウントでない・だれか分からないときは ''
function staffNameFromEmail(email) {
  if (typeof email !== 'string' || !email.toLowerCase().endsWith(STAFF_ACCOUNT_DOMAIN)) return '';
  const first = email.split('@')[0].toLowerCase().split(/[._\-+]/)[0];
  return STAFF_BY_ACCOUNT_NAME[first] || '';
}

// 保存している設定（chrome.storage.local の gasSettings・recruiterName）を、アカウントから決めた名前に合わせるときの書き込み内容。
// 合わせる必要が無ければ null
function recruiterFixFor(email, gasSettings, recruiterName) {
  const name = staffNameFromEmail(email);
  if (!name) return null;
  const gas = gasSettings || {};
  if (gas.recruiter === name && recruiterName === name) return null;
  return {
    gasSettings: { ...gas, recruiter: name },
    recruiterName: name,
    // 前に選ばれていた名前（違っていたときの確認用）
    recruiterBeforeAccount: gas.recruiter || recruiterName || '',
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STAFF_BY_ACCOUNT_NAME, staffNameFromEmail, recruiterFixFor };
}
