# 自動更新の本体（Windows）。タスクスケジューラが1時間ごとに裏で呼ぶ。
# 拡張機能のフォルダを origin/main と同じにする（メンバーはこのフォルダを編集しない前提。update と同じ扱い）。
# 結果はログに1行残す: %LOCALAPPDATA%\snowwe\update.log
# 拡張機能のフォルダは、このファイルの1つ上（autoupdate の親）。タスクの起動コマンドを短くするため引数にしない
param([string]$ExtDir = (Split-Path -Parent $PSScriptRoot))
$env:GIT_TERMINAL_PROMPT = '0'
# Git for Windows は、消せないフォルダ（旧 project1 の scout など）があると「Should I try again? (y/n)」と聞いて止まる。
# 聞かずに「n」（消さずに続ける）にする
$env:GIT_ASK_YESNO = 'false'
$logDir = Join-Path $env:LOCALAPPDATA 'snowwe'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'update.log'
function Log($msg) { Add-Content -Encoding UTF8 -Path $log -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg) }
function Version { ([regex]::Match((Get-Content -Raw -Encoding UTF8 (Join-Path $ExtDir 'manifest.json')), '"version":\s*"([0-9.]+)"')).Groups[1].Value }

if ((Test-Path $log) -and ((Get-Content $log).Count -gt 1000)) { (Get-Content $log -Tail 500) | Set-Content -Encoding UTF8 $log }
if (-not (Test-Path (Join-Path $ExtDir '.git'))) { Log "NG フォルダがありません: $ExtDir"; exit 0 }
$origin = git -C $ExtDir remote get-url origin 2>$null
if ($origin -notmatch '(taichi536|Snow-we-hp)/snowwe-extension') { Log "NG 取得先が違うため何もしません: $origin"; exit 0 }
$branch = git -C $ExtDir rev-parse --abbrev-ref HEAD 2>$null
if ($branch -ne 'main') { Log "NG ブランチが main ではないため何もしません: $branch"; exit 0 }

git -C $ExtDir fetch -q origin main 2>$null
if ($LASTEXITCODE -ne 0) { Log 'NG 取得できませんでした（ネットワーク）'; exit 0 }
$local = git -C $ExtDir rev-parse HEAD
$remote = git -C $ExtDir rev-parse origin/main
$dirty = git -C $ExtDir status --porcelain --untracked-files=no
if ($local -eq $remote -and -not $dirty) { Log ("OK 最新です (v{0})" -f (Version)); exit 0 }
$before = Version
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $ExtDir '.git\index.lock')
git -C $ExtDir reset -q --hard origin/main 2>$null
if ($LASTEXITCODE -eq 0) { Log ("UPDATED v{0} → v{1}" -f $before, (Version)) } else { Log 'NG 更新に失敗しました' }
exit 0
