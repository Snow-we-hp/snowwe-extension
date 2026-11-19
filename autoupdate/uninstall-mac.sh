#!/bin/bash
# 自動更新を外す（Mac）。拡張機能のフォルダは触らない。
#   curl -fsSL https://raw.githubusercontent.com/taichi536/snowwe-extension/main/autoupdate/uninstall-mac.sh | bash
AGENT="$HOME/Library/LaunchAgents/jp.snowwe.autoupdate.plist"
launchctl bootout "gui/$(id -u)" "$AGENT" 2>/dev/null
rm -f "$AGENT"
rm -rf "$HOME/Applications/Snow-we 自動更新.app" "$HOME/Library/Application Support/snowwe"
echo "自動更新を外しました（拡張機能のフォルダと記録 ~/Library/Logs/snowwe-update.log はそのままです）。"
