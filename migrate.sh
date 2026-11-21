#!/bin/bash
# 引っ越し用（Mac）: taichi536/project1（非公開になった）から読み込んでいる拡張機能のフォルダを、
# 同じ場所のまま Snow-we-hp/snowwe-extension から更新できるように切り替える。
#
#   curl -fsSL https://raw.githubusercontent.com/Snow-we-hp/snowwe-extension/main/migrate.sh | bash
#   （フォルダを指定する場合: ... | bash -s -- /path/to/folder）
#
# 同じフォルダのまま切り替えるので、拡張機能のID・設定（APIキー・担当者名）・記録は変わらない。
# 新しい場所に入れ直すとIDが変わって設定が消えるので、そうはしない。
#
# 切り替えるのは、次をすべて満たすフォルダだけ:
#   - manifest.json が「Snow-we スカウト パーソナライズ生成」
#   - git の取得先が taichi536/project1 か Snow-we-hp/snowwe-extension
#   - 今のブランチが main（開発用のフォルダ・別ブランチのフォルダは触らない）
set -u
NEW_REPO="${SNOWWE_REPO:-https://github.com/Snow-we-hp/snowwe-extension.git}"
EXT_NAME="Snow-we スカウト パーソナライズ生成"
export GIT_TERMINAL_PROMPT=0

echo "========================================"
echo " Snow-we 拡張機能 引っ越し（Mac）"
echo "========================================"
echo ""

if ! command -v git > /dev/null 2>&1; then
  echo "❌ git が見つかりません。たいちさんに連絡してください。"
  exit 1
fi

# 対象のフォルダを探す（指定があればそれだけ）
candidates=()
if [ $# -ge 1 ]; then
  candidates=("$1")
else
  while IFS= read -r m; do
    candidates+=("$(dirname "$m")")
  done < <(find "$HOME" -maxdepth 6 -name manifest.json \
      -not -path "*/Library/*" -not -path "*/node_modules/*" -not -path "*/.Trash/*" \
      -not -path "*/.claude/*" 2>/dev/null)
fi

done_count=0
skipped=()
for dir in "${candidates[@]}"; do
  [ -f "$dir/manifest.json" ] || continue
  grep -q "\"name\": \"$EXT_NAME\"" "$dir/manifest.json" 2>/dev/null || continue
  [ -d "$dir/.git" ] || { skipped+=("$dir（git のフォルダではない）"); continue; }

  origin=$(git -C "$dir" remote get-url origin 2>/dev/null || echo "")
  case "$origin" in
    *taichi536/project1*|*taichi536/snowwe-extension*|*Snow-we-hp/snowwe-extension*) ;;
    *) skipped+=("$dir（取得先が違う: ${origin:-なし}）"); continue ;;
  esac
  branch=$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [ "$branch" != "main" ]; then
    skipped+=("$dir（ブランチが main ではない: $branch。開発用のフォルダとみなして触りません）")
    continue
  fi

  before=$(grep -m1 '"version"' "$dir/manifest.json" | sed -E 's/.*"([0-9.]+)".*/\1/')
  echo "▶ $dir（いま v$before）"
  rm -f "$dir/.git/index.lock"
  git -C "$dir" remote set-url origin "$NEW_REPO"
  if ! git -C "$dir" fetch origin main; then
    echo "  ❌ 取得できませんでした（ネットワークを確認して、もう一度実行してください）"
    git -C "$dir" remote set-url origin "$origin"
    continue
  fi
  # 新しいリポジトリは履歴がつながっていないので、pull ではなく中身を入れ替える。
  # メンバーはこのフォルダのファイルを編集しない前提（update と同じ扱い）。
  # git で管理していないファイル（手元のメモ等）は消さない
  git -C "$dir" reset --hard origin/main > /dev/null
  git -C "$dir" branch --set-upstream-to=origin/main main > /dev/null 2>&1 || true
  after=$(grep -m1 '"version"' "$dir/manifest.json" | sed -E 's/.*"([0-9.]+)".*/\1/')
  echo "  ✅ v$before → v$after に切り替えました"
  done_count=$((done_count + 1))
done

echo ""
if [ ${#skipped[@]} -gt 0 ]; then
  echo "触らなかったフォルダ:"
  for s in "${skipped[@]}"; do echo "  - $s"; done
  echo ""
fi
if [ "$done_count" -eq 0 ]; then
  echo "❌ 切り替えるフォルダが見つかりませんでした。"
  echo "   chrome://extensions の「Snow-we」に表示されているフォルダの場所を、たいちさんに送ってください。"
  exit 1
fi
echo "完了しました。"
echo "拡張機能は30分以内に自動で新しい版を読み込みます。"
echo "すぐ反映したいときは chrome://extensions を開き、「Snow-we」の ↻（再読み込み）を押してください。"
echo "これからの更新は、今までどおりフォルダの中の update.command で行えます。"
