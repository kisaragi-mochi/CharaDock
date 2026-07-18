# GitHub公開チェックリスト

## 公開前の必須確認

- [ ] `assets/amber-avatar/**`、`assets/bronze-avatar/**`、`assets/silver-hood-avatar/**`の元絵と生成差分を公開配布できる権利がある。
- [ ] `docs/images/purupet-work-mode.png`と`app-icon.ico`を公開できる。
- [ ] `DISTRIBUTION_ASSET_LICENSE.md`の条件が権利者の意図と一致している。
- [ ] 上流PuruPuru PNGTuberの`LICENSE`、`NOTICE`、`MODIFICATIONS.md`、`THIRD_PARTY_NOTICES.md`を残している。
- [ ] READMEの「非公式派生アプリ」という表記を残している。

画像の権利確認が終わるまでは、GitHubリポジトリをPublicにしないでください。

## ローカル監査

```bash
npm ci
npm test
npm audit
uv lock --check
uv run python scripts/verify_vendor_checksums.py
git status --short --ignored
```

確認項目:

- [ ] `.env`、`.npmrc`、APIキー、秘密鍵、Codex認証情報がない。
- [ ] `source/`、`work/`、`dist/`、`node_modules/`、`.venv/`が追跡対象外である。
- [ ] 100MB以上のGit対象ファイルがない。
- [ ] README内の相対リンクと画像が表示できる。
- [ ] Electronスモークテストが通る。

## 初回コミット

このリポジトリの既定ブランチは`main`です。公開先を作成した後、内容を再確認してから実行します。

```bash
git add .
git status --short
git commit -m "Initial public release preparation"
git remote add origin <repository-url>
git push -u origin main
```

この手順は認証情報や画像権利の確認を代替しません。`git add .`の後に必ず一覧を確認してください。

## GitHub側の推奨設定

- [ ] Actionsの既定権限をread-onlyにする。
- [ ] `main`へプルリクエストとCI成功を必須にする。
- [ ] Secret scanningとPush protectionを有効にする。
- [ ] Dependabot alertsとDependabot security updatesを有効にする。
- [ ] Private vulnerability reportingを有効にする。
- [ ] Issue templatesとSecurity policyが表示されることを確認する。

## Windows配布時

- [ ] クリーンなWindows 10/11 x64で初回起動を確認する。
- [ ] ChatGPTログイン、通常会話、作業モード、音声フォールバックを確認する。
- [ ] ZIP/インストーラーへ旧デモアバターと旧faviconが混入していない。
- [ ] `LICENSE`、`NOTICE`、`MODIFICATIONS.md`、アセット条件、第三者通知を同梱する。
- [ ] SHA-256を公開する。
- [ ] 一般配布前にコード署名を検討する。

## Git LFSについて

現時点ではGit対象の最大ファイルがGitHubの100MB上限未満なので、Git LFSは必須ではありません。画像やモデルを頻繁に更新して履歴が急増する場合だけ、移行手順と利用者への影響を決めてから導入してください。
