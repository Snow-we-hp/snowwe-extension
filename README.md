# Snow-we スカウト拡張機能

候補者プロフィールからパーソナライズ文を作り、スカウトの送信を自動で記録する Chrome 拡張機能。

## 更新

フォルダの中の `update.command`（Mac）／`update.bat`（Windows）を実行する。
手元のファイルが新しくなると、拡張機能は30分以内に自分で読み込み直す（すぐ反映したいときは
`chrome://extensions` で「Snow-we」の ↻ を押す）。

## 旧リポジトリ（taichi536/project1）から読み込んでいる人

project1 は非公開になり、そこからは更新できなくなった。下の1行を1回だけ実行すると、
**今と同じフォルダのまま**取得先をこのリポジトリに切り替える（拡張機能の設定・記録はそのまま残る）。

Mac（ターミナルに貼り付けて Enter）:

```
curl -fsSL https://raw.githubusercontent.com/taichi536/snowwe-extension/main/migrate.sh | bash
```

Windows（PowerShell に貼り付けて Enter）:

```
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/taichi536/snowwe-extension/main/migrate.ps1 | iex"
```

## 自動更新（1回だけ設定）

設定すると、1時間ごとに自動で最新版になる（引っ越しがまだなら一緒に行う）。

Mac（ターミナルに貼り付けて Enter。途中で「デスクトップフォルダ内のファイルにアクセス」と出たら【許可】）:

```
curl -fsSL https://raw.githubusercontent.com/taichi536/snowwe-extension/main/autoupdate/install-mac.sh | bash
```

Windows（PowerShell に貼り付けて Enter）:

```
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/taichi536/snowwe-extension/main/autoupdate/install-windows.ps1 | iex"
```

Mac は、許可の無い裏の処理がデスクトップのファイルを書き換えるのを止めるため、
「Snow-we 自動更新」アプリを作って、そのアプリに1回だけ許可を出してもらう。動いた記録は
`~/Library/Logs/snowwe-update.log`（Windows は `%LOCALAPPDATA%\snowwe\update.log`）。

## 最低バージョン

`min-version.json` の `min` より古い版は、スカウトの送信ボタンを押すと止まり、更新を促す。
