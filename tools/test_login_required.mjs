// ログイン必須まわりのテスト
//   node tools/test_login_required.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const bg = read('background.js'), content = read('content.js'), popupJs = read('popup.js'), popupHtml = read('popup.html');

function pick(src, name) {
  const m = src.match(new RegExp(`^(?:async\\s+)?function\\s+${name}\\s*\\(`, 'm'));
  if (!m) throw new Error(`${name} が無い`);
  let j = src.indexOf('{', src.indexOf(')', m.index)), depth = 0;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') { for (j++; j < src.length && src[j] !== c; j++) if (src[j] === '\\') j++; continue; }
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
    if (c === '{') depth++; else if (c === '}' && --depth === 0) break;
  }
  return src.slice(m.index, j + 1);
}

// chrome.storage の作り物
const store = {};
const chrome = { storage: { local: {
  get: async keys => Object.fromEntries(keys.filter(k => k in store).map(k => [k, store[k]])),
  set: async obj => { Object.assign(store, obj); },
} } };
const ctx = vm.createContext({ chrome, console });
vm.runInContext([pick(bg, 'isPermanentSupabaseError'), pick(bg, 'requeueAuthDeadLetters'), pick(content, 'isCompanyLogin')].join('\n') +
  '\n;globalThis.api = { isPermanentSupabaseError, requeueAuthDeadLetters, isCompanyLogin };', ctx);
const api = ctx.api;

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`✓ ${name}`); };

await t('ログインしていない・鍵が切れた（401・403）記録は諦めず、ログインするまで取っておく', () => {
  assert.equal(api.isPermanentSupabaseError({ status: 401 }), false);
  assert.equal(api.isPermanentSupabaseError({ status: 403 }), false);
  assert.equal(api.isPermanentSupabaseError({ status: 400 }), true); // 項目の不備は今までどおり諦める
  assert.equal(api.isPermanentSupabaseError({ status: 500 }), false);
  assert.equal(api.isPermanentSupabaseError({}), false);
});

await t('ログインしたら、前に権限が無いとして諦めた記録を送り直しの列に戻す', async () => {
  store.supabaseDeadLetter = [
    { _queueId: 'a', _lastError: 'HTTP 401: {"message":"new row violates row-level security policy"}', _attempts: 3, _deadAt: 1 },
    { _queueId: 'b', _lastError: 'HTTP 400: bad column', _attempts: 3, _deadAt: 1 },
    { _queueId: 'c', _lastError: 'HTTP 403: forbidden', _attempts: 3, _deadAt: 1 },
  ];
  store.supabaseScoutQueue = [{ _queueId: 'q' }];
  assert.equal(await api.requeueAuthDeadLetters(), 2);
  assert.deepEqual(store.supabaseScoutQueue.map(x => x._queueId), ['q', 'a', 'c']);
  assert.ok(store.supabaseScoutQueue.every(x => !('_deadAt' in x) && (x._queueId === 'q' || x._attempts === 0)));
  assert.deepEqual(store.supabaseDeadLetter.map(x => x._queueId), ['b']);
});

await t('会社のアカウント（@snow-we.jp）でログインしているときだけ、ログイン済みとみなす', () => {
  assert.equal(api.isCompanyLogin({ access_token: 'x', email: 'someone@snow-we.jp' }), true);
  assert.equal(api.isCompanyLogin({ access_token: 'x', email: 'someone@gmail.com' }), false);
  assert.equal(api.isCompanyLogin({ email: 'someone@snow-we.jp' }), false);
  assert.equal(api.isCompanyLogin(undefined), false);
});

await t('媒体の画面: ログインしていなければ閉じられない案内を出し、ログインしたら消す', () => {
  const block = content.slice(content.indexOf('function showLoginRequiredOverlay'), content.indexOf('// ページを開いた時点で担当者名を確認する。'));
  assert.ok(!/onClose/.test(block), '閉じるボタンを付けない');
  assert.ok(block.includes("if (!isCompanyLogin(r.supabaseAuth)) setTimeout(showLoginRequiredOverlay, 1500);"));
  assert.ok(block.includes('document.getElementById(LOGIN_OVERLAY_ID)?.remove();'));
});

await t('拡張の画面: ログインしていなければ、ログインの欄以外を隠す', () => {
  assert.ok(popupJs.includes("document.body.classList.toggle('login-required', required);"));
  assert.ok(popupHtml.includes('body.login-required .tabs'));
  assert.ok(popupHtml.includes('id="login-gate"'));
});

await t('ログインしたら、待っていた記録をすぐ送る', () => {
  const login = pick(bg, 'supabaseLogin');
  assert.ok(login.includes('await requeueAuthDeadLetters();'));
  assert.ok(login.includes('await recordSupabaseSuccess();'));
  assert.ok(login.includes('flushSupabaseScoutQueue()'));
});

console.log(`\n${n} 件 OK`);
