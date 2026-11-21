#!/bin/bash
# 自動更新の導入（Mac。1回だけ）:
#   curl -fsSL https://raw.githubusercontent.com/Snow-we-hp/snowwe-extension/main/autoupdate/install-mac.sh | bash
#
# やること:
#   1. Chrome が読み込んでいる Snow-we 拡張機能のフォルダを見つける（まだ project1 から取っていれば引っ越しもする）
#   2. 「Snow-we 自動更新」アプリを作り、1回起動する
#      → 「デスクトップのファイルへのアクセスを求めています」と出たら【許可】を押す
#        （macOS は、許可の無い裏の処理がデスクトップのファイルを書き換えるのを止めるため）
#   3. そのアプリを1時間ごとに裏で起動する設定を入れる
# 外すとき: curl -fsSL https://raw.githubusercontent.com/Snow-we-hp/snowwe-extension/main/autoupdate/uninstall-mac.sh | bash
set -u
NEW_REPO="${SNOWWE_REPO:-https://github.com/Snow-we-hp/snowwe-extension.git}"
EXT_NAME="Snow-we スカウト パーソナライズ生成"
APP="$HOME/Applications/Snow-we 自動更新.app"
SUPPORT="$HOME/Library/Application Support/snowwe"
AGENT_LABEL="jp.snowwe.autoupdate"
AGENT="$HOME/Library/LaunchAgents/$AGENT_LABEL.plist"
LOG="$HOME/Library/Logs/snowwe-update.log"
export GIT_TERMINAL_PROMPT=0

echo "========================================"
echo " Snow-we 拡張機能 自動更新の設定（Mac）"
echo "========================================"
echo ""
command -v git > /dev/null 2>&1 || { echo "❌ git が見つかりません。たいちさんに連絡してください。"; exit 1; }

# ---- 1. フォルダを見つける ----
cands=()
if [ $# -ge 1 ]; then
  cands=("$1")
else
  while IFS= read -r m; do
    d=$(dirname "$m")
    grep -q "\"name\": \"$EXT_NAME\"" "$m" 2>/dev/null || continue
    [ -d "$d/.git" ] || continue
    o=$(git -C "$d" remote get-url origin 2>/dev/null)
    case "$o" in *taichi536/project1*|*taichi536/snowwe-extension*|*Snow-we-hp/snowwe-extension*) ;; *) continue ;; esac
    [ "$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null)" = "main" ] || continue
    cands+=("$d")
  done < <(find "$HOME" -maxdepth 6 -name manifest.json -not -path "*/Library/*" \
      -not -path "*/node_modules/*" -not -path "*/.Trash/*" -not -path "*/.claude/*" 2>/dev/null)
fi
if [ ${#cands[@]} -gt 1 ]; then
  # 複数あるときは、Chrome が実際に読み込んでいるフォルダを選ぶ
  loaded=$(cat "$HOME/Library/Application Support/Google/Chrome/"*/Preferences \
      "$HOME/Library/Application Support/Google/Chrome/"*/"Secure Preferences" 2>/dev/null)
  picked=()
  for d in "${cands[@]}"; do
    case "$loaded" in *"\"path\":\"$d\""*) picked+=("$d") ;; esac
  done
  [ ${#picked[@]} -ge 1 ] && cands=("${picked[@]}")
fi
if [ ${#cands[@]} -ne 1 ]; then
  echo "❌ 拡張機能のフォルダを1つに決められませんでした（${#cands[@]} 件）。"
  for d in "${cands[@]}"; do echo "   - $d"; done
  echo "   chrome://extensions の「Snow-we」に表示されているフォルダの場所を、たいちさんに送ってください。"
  exit 1
fi
EXT_DIR="${cands[0]}"
echo "拡張機能のフォルダ: $EXT_DIR"

# まだ project1 から取っていれば、同じフォルダのまま引っ越す（拡張機能のID・設定は変わらない）
if git -C "$EXT_DIR" remote get-url origin | grep -q "taichi536/project1"; then
  echo "取得先を新しいリポジトリに切り替えます..."
  git -C "$EXT_DIR" remote set-url origin "$NEW_REPO"
  if ! git -C "$EXT_DIR" fetch -q origin main; then
    git -C "$EXT_DIR" remote set-url origin "https://github.com/taichi536/project1.git"
    echo "❌ 取得できませんでした。ネットワークを確認して、もう一度実行してください。"
    exit 1
  fi
  rm -f "$EXT_DIR/.git/index.lock"
  git -C "$EXT_DIR" reset -q --hard origin/main
  git -C "$EXT_DIR" branch -q --set-upstream-to=origin/main main 2>/dev/null || true
fi
[ -f "$EXT_DIR/autoupdate/auto-update.sh" ] || { git -C "$EXT_DIR" fetch -q origin main && git -C "$EXT_DIR" reset -q --hard origin/main; }
echo "いまのバージョン: v$(sed -nE 's/.*"version": "([0-9.]+)".*/\1/p' "$EXT_DIR/manifest.json" | head -1)"
echo ""

# ---- 2. アプリを作る ----
mkdir -p "$SUPPORT" "$HOME/Applications" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
# アプリが呼ぶ入口。フォルダの場所だけを持ち、更新の本体は拡張機能のフォルダの中のものを使う
cat > "$SUPPORT/run.sh" <<RUN
#!/bin/bash
exec /bin/bash "$EXT_DIR/autoupdate/auto-update.sh" "$EXT_DIR"
RUN
# アプリは、すでにあれば作り直さない（作り直すと macOS の許可が外れる）
if [ ! -d "$APP" ]; then
  osacompile -o "$APP" -e 'try
  do shell script "/bin/bash " & quoted form of (POSIX path of (path to home folder) & "Library/Application Support/snowwe/run.sh")
end try' || { echo "❌ アプリを作れませんでした。"; exit 1; }
  # Dock にアイコンを出さない
  /usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$APP/Contents/Info.plist" 2>/dev/null || true
  codesign --force --sign - "$APP" 2>/dev/null || true
fi

echo "これから「Snow-we 自動更新」を1回起動します。"
echo "「“Snow-we 自動更新”がデスクトップフォルダ内のファイルにアクセスしようとしています」と出たら、"
echo "👉【許可】を押してください。（出ない場合は、すでに許可されています）"
echo ""
mark=0; [ -f "$LOG" ] && mark=$(wc -l < "$LOG")
open -W "$APP"
result=$(tail -n +"$((mark + 1))" "$LOG" 2>/dev/null | tail -1)
echo "結果: ${result:-（記録がありません）}"
case "$result" in
  *"OK "*|*UPDATED*) ;;
  *)
    echo ""
    echo "❌ 自動更新が拡張機能のフォルダを読めませんでした。"
    echo "   「システム設定 → プライバシーとセキュリティ → ファイルとフォルダ」で"
    echo "   「Snow-we 自動更新」の「デスクトップフォルダ」をオンにしてから、もう一度この1行を実行してください。"
    exit 1 ;;
esac

# ---- 3. 1時間ごとに裏で起動する ----
cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$AGENT_LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/usr/bin/open</string><string>-g</string><string>-j</string><string>$APP</string></array>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
PLIST
launchctl bootout "gui/$(id -u)" "$AGENT" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENT" || { echo "❌ 自動実行の設定に失敗しました。"; exit 1; }

echo ""
echo "✅ 設定しました。これから1時間ごとに自動で最新版にします。"
echo "   新しい版になると、拡張機能は30分以内に自分で読み込み直します。"
echo "   動いた記録: $LOG"
