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

## 最低バージョン

`min-version.json` の `min` より古い版は、スカウトの送信ボタンを押すと止まり、更新を促す。
