#!/bin/bash
# 自動更新の本体（Mac）。Snow-we更新.app が1時間ごとに裏で呼ぶ。
# 拡張機能のフォルダを origin/main と同じにする（メンバーはこのフォルダを編集しない前提。update と同じ扱い）。
# 手元のファイルが新しくなると、拡張機能が30分以内に自分で読み込み直す。
#
# このファイルは拡張機能と一緒に更新される（アプリは作り直さない。作り直すと macOS の許可が外れるため）。
# 何があっても止まらず、結果はログに1行残す: ~/Library/Logs/snowwe-update.log
EXT_DIR="${1:?拡張機能のフォルダを指定してください}"
LOG="$HOME/Library/Logs/snowwe-update.log"
export GIT_TERMINAL_PROMPT=0
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

# ログが大きくなりすぎないよう、後ろの500行だけ残す
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 1000 ]; then
  tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

cd "$EXT_DIR" 2>/dev/null || { log "NG フォルダに入れません（macOS の許可が無い可能性）: $EXT_DIR"; exit 0; }
origin=$(git remote get-url origin 2>/dev/null)
case "$origin" in
  *taichi536/snowwe-extension*|*Snow-we-hp/snowwe-extension*) ;;
  *) log "NG 取得先が違うため何もしません: ${origin:-なし}"; exit 0 ;;
esac
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
[ "$branch" = "main" ] || { log "NG ブランチが main ではないため何もしません: $branch"; exit 0; }

if ! git fetch -q origin main 2>>"$LOG"; then
  log "NG 取得できませんでした（ネットワーク）"
  exit 0
fi
local_head=$(git rev-parse HEAD)
remote_head=$(git rev-parse origin/main)
if [ "$local_head" = "$remote_head" ] && [ -z "$(git status --porcelain --untracked-files=no)" ]; then
  log "OK 最新です (v$(sed -nE 's/.*"version": "([0-9.]+)".*/\1/p' manifest.json | head -1))"
  exit 0
fi
before=$(sed -nE 's/.*"version": "([0-9.]+)".*/\1/p' manifest.json | head -1)
rm -f .git/index.lock
if git reset -q --hard origin/main 2>>"$LOG"; then
  after=$(sed -nE 's/.*"version": "([0-9.]+)".*/\1/p' manifest.json | head -1)
  log "UPDATED v$before → v$after"
else
  log "NG 更新に失敗しました"
fi
exit 0
