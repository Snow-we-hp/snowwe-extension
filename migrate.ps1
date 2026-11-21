# 引っ越し用（Windows）: taichi536/project1（非公開になった）から読み込んでいる拡張機能のフォルダを、
# 同じ場所のまま Snow-we-hp/snowwe-extension から更新できるように切り替える。
#
#   powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Snow-we-hp/snowwe-extension/main/migrate.ps1 | iex"
#
# 同じフォルダのまま切り替えるので、拡張機能のID・設定（APIキー・担当者名）・記録は変わらない。
# 切り替えるのは、manifest.json が Snow-we の拡張機能で、取得先が project1 / snowwe-extension で、
# ブランチが main のフォルダだけ（開発用のフォルダは触らない）。
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$NewRepo = 'https://github.com/Snow-we-hp/snowwe-extension.git'
$ExtName = 'Snow-we スカウト パーソナライズ生成'
$env:GIT_TERMINAL_PROMPT = '0'
# Git for Windows は、消せないフォルダ（旧 project1 の scout など）があると「Should I try again? (y/n)」と聞いて止まる。
# 聞かずに「n」（消さずに続ける）にする
$env:GIT_ASK_YESNO = 'false'

Write-Host '========================================'
Write-Host ' Snow-we 拡張機能 引っ越し（Windows）'
Write-Host '========================================'
Write-Host ''

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host 'git が見つかりません。たいちさんに連絡してください。'
  return
}

$roots = @($env:USERPROFILE)
if ($env:OneDrive -and -not $env:OneDrive.StartsWith($env:USERPROFILE)) { $roots += $env:OneDrive }
$manifests = foreach ($r in $roots) {
  Get-ChildItem -Path $r -Filter manifest.json -Recurse -Depth 6 -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\(AppData|node_modules|\.claude)\\' }
}

$done = 0
$skipped = @()
foreach ($m in ($manifests | Sort-Object FullName -Unique)) {
  $dir = $m.DirectoryName
  $text = Get-Content -Raw -Encoding UTF8 -Path $m.FullName -ErrorAction SilentlyContinue
  if (-not $text -or $text -notmatch [regex]::Escape("""name"": ""$ExtName""")) { continue }
  if (-not (Test-Path (Join-Path $dir '.git'))) { $skipped += "$dir（git のフォルダではない）"; continue }

  $origin = (git -C $dir remote get-url origin 2>$null)
  if ($origin -notmatch '(taichi536/(project1|snowwe-extension)|Snow-we-hp/snowwe-extension)') { $skipped += "$dir（取得先が違う: $origin）"; continue }
  $branch = (git -C $dir rev-parse --abbrev-ref HEAD 2>$null)
  if ($branch -ne 'main') { $skipped += "$dir（ブランチが main ではない: $branch）"; continue }

  $before = ([regex]::Match($text, '"version":\s*"([0-9.]+)"')).Groups[1].Value
  Write-Host "▶ $dir（いま v$before）"
  Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $dir '.git\index.lock')
  git -C $dir remote set-url origin $NewRepo
  git -C $dir fetch origin main
  if ($LASTEXITCODE -ne 0) {
    Write-Host '  取得できませんでした（ネットワークを確認して、もう一度実行してください）'
    git -C $dir remote set-url origin $origin
    continue
  }
  # 履歴がつながっていないので pull ではなく中身を入れ替える（git で管理していないファイルは消さない）
  git -C $dir reset --hard origin/main | Out-Null
  git -C $dir branch --set-upstream-to=origin/main main 2>$null | Out-Null
  $after = ([regex]::Match((Get-Content -Raw -Encoding UTF8 (Join-Path $dir 'manifest.json')), '"version":\s*"([0-9.]+)"')).Groups[1].Value
  Write-Host "  完了: v$before → v$after に切り替えました"
  $done++
}

Write-Host ''
if ($skipped.Count -gt 0) {
  Write-Host '触らなかったフォルダ:'
  $skipped | ForEach-Object { Write-Host "  - $_" }
  Write-Host ''
}
if ($done -eq 0) {
  Write-Host '切り替えるフォルダが見つかりませんでした。'
  Write-Host 'chrome://extensions の「Snow-we」に表示されているフォルダの場所を、たいちさんに送ってください。'
  return
}
Write-Host '完了しました。拡張機能は30分以内に自動で新しい版を読み込みます。'
Write-Host 'すぐ反映したいときは chrome://extensions を開き、「Snow-we」の ↻（再読み込み）を押してください。'
Write-Host 'これからの更新は、今までどおりフォルダの中の update.bat で行えます。'
