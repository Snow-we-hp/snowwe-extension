# 自動更新の導入（Windows。1回だけ）。PowerShell に貼り付けて Enter:
#   powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Snow-we-hp/snowwe-extension/main/autoupdate/install-windows.ps1 | iex"
# まだ project1 から取っていれば、同じフォルダのまま引っ越してから、1時間ごとに自動で最新版にするタスクを入れる。
# 外すとき: schtasks /Delete /TN "Snow-we 自動更新" /F
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$NewRepo = 'https://github.com/Snow-we-hp/snowwe-extension.git'
$ExtName = 'Snow-we スカウト パーソナライズ生成'
$TaskName = 'Snow-we 自動更新'
$env:GIT_TERMINAL_PROMPT = '0'
# Git for Windows は、消せないフォルダ（旧 project1 の scout など）があると「Should I try again? (y/n)」と聞いて止まる。
# 聞かずに「n」（消さずに続ける）にする
$env:GIT_ASK_YESNO = 'false'

Write-Host '========================================'
Write-Host ' Snow-we 拡張機能 自動更新の設定（Windows）'
Write-Host '========================================'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host 'git が見つかりません。たいちさんに連絡してください。'; return }

$roots = @($env:USERPROFILE)
if ($env:OneDrive -and -not $env:OneDrive.StartsWith($env:USERPROFILE)) { $roots += $env:OneDrive }
$cands = @()
foreach ($r in $roots) {
  Get-ChildItem -Path $r -Filter manifest.json -Recurse -Depth 6 -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\(AppData|node_modules|\.claude)\\' } | ForEach-Object {
      $d = $_.DirectoryName
      $t = Get-Content -Raw -Encoding UTF8 $_.FullName -ErrorAction SilentlyContinue
      if ($t -and $t -match [regex]::Escape("""name"": ""$ExtName""") -and (Test-Path (Join-Path $d '.git'))) {
        $o = git -C $d remote get-url origin 2>$null
        $b = git -C $d rev-parse --abbrev-ref HEAD 2>$null
        if ($o -match '(taichi536/(project1|snowwe-extension)|Snow-we-hp/snowwe-extension)' -and $b -eq 'main') { $cands += $d }
      }
    }
}
$cands = @($cands | Sort-Object -Unique)
if ($cands.Count -gt 1) {
  # 複数あるときは、Chrome が実際に読み込んでいるフォルダを選ぶ
  $prefs = Get-ChildItem "$env:LOCALAPPDATA\Google\Chrome\User Data\*\*Preferences" -ErrorAction SilentlyContinue | ForEach-Object { Get-Content -Raw $_.FullName }
  $picked = @($cands | Where-Object { ($prefs -join '') -match [regex]::Escape(($_ -replace '\\', '\\')) })
  if ($picked.Count -ge 1) { $cands = $picked }
}
if ($cands.Count -ne 1) {
  Write-Host ("拡張機能のフォルダを1つに決められませんでした（{0} 件）。" -f $cands.Count)
  $cands | ForEach-Object { Write-Host "  - $_" }
  Write-Host 'chrome://extensions の「Snow-we」に表示されているフォルダの場所を、たいちさんに送ってください。'
  return
}
$ExtDir = $cands[0]
Write-Host "拡張機能のフォルダ: $ExtDir"

if ((git -C $ExtDir remote get-url origin) -match 'taichi536/project1') {
  Write-Host '取得先を新しいリポジトリに切り替えます...'
  git -C $ExtDir remote set-url origin $NewRepo
  git -C $ExtDir fetch -q origin main
  if ($LASTEXITCODE -ne 0) {
    git -C $ExtDir remote set-url origin 'https://github.com/taichi536/project1.git'
    Write-Host '取得できませんでした。ネットワークを確認して、もう一度実行してください。'; return
  }
  Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $ExtDir '.git\index.lock')
  git -C $ExtDir reset -q --hard origin/main
  git -C $ExtDir branch -q --set-upstream-to=origin/main main 2>$null
}

$script = Join-Path $ExtDir 'autoupdate\auto-update.ps1'
if (-not (Test-Path $script)) { Write-Host '自動更新のファイルが見つかりません。たいちさんに連絡してください。'; return }
# 1回動かして確かめる
powershell -NoProfile -ExecutionPolicy Bypass -File $script
$log = Join-Path $env:LOCALAPPDATA 'snowwe\update.log'
$last = Get-Content $log -Tail 1 -ErrorAction SilentlyContinue
Write-Host "結果: $last"
if ($last -notmatch '(OK |UPDATED)') { Write-Host '自動更新が動きませんでした。この画面のスクリーンショットをたいちさんに送ってください。'; return }

# 1時間ごとに、画面を出さずに動かす
$action = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
if ($action.Length -gt 261) { Write-Host "フォルダの場所が長すぎて自動実行を設定できません: $ExtDir"; return }
schtasks /Create /TN $TaskName /TR $action /SC HOURLY /F | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host '自動実行の設定に失敗しました。この画面のスクリーンショットをたいちさんに送ってください。'; return }
Write-Host ''
Write-Host '設定しました。これから1時間ごとに自動で最新版にします。'
Write-Host '新しい版になると、拡張機能は30分以内に自分で読み込み直します。'
Write-Host "動いた記録: $log"
