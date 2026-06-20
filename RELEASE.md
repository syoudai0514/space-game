# リリース手順(Google Play)

「もしも宇宙シューター」を Android アプリ化して Google Play で公開するための手順メモ。
Web 版(GitHub Pages = リポジトリ直下の `index.html`)はそのまま、Android 版だけを
Capacitor で生成します。

## 前提

- Node.js 18+ / npm
- Android Studio(Android SDK・JDK 17 同梱)
- Google Play Console の開発者アカウント(登録料 $25)

## 手順 1: 依存のインストールと Android プロジェクト生成

```bash
npm install
npx cap add android      # 初回のみ。android/ が生成される
npm run sync             # www/ をビルドし android へ反映
```

`npm run sync` は内部で次を行います。
1. `scripts/build-web.mjs` が `www/`(index.html / css / js + native.bundle.js)を生成
2. `cap sync android` が `www/` を Android プロジェクトへコピー

以降、Web 側を更新するたびに `npm run sync` を実行してください。

## 手順 2: アプリ情報の確認

- アプリ ID / 名前: `capacitor.config.json`
  - `appId`: `com.moshimospace.shooter`
  - `appName`: `もしも宇宙シューター`
- 背景色 / スプラッシュ: `capacitor.config.json` の `backgroundColor`

## 手順 3: アイコン・スプラッシュ生成

`resources/icon.png`(1024×1024 推奨)と `resources/splash.png`(2732×2732 推奨)を用意し:

```bash
npm run assets       # capacitor-assets が各解像度を生成
```

## 手順 4: 署名鍵(キーストア)の作成

```bash
keytool -genkey -v -keystore moshimo-shooter.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

> キーストアとパスワードは**絶対に紛失しないこと**(再発行不可)。`.gitignore` 済みなのでコミットされません。

## 手順 5: リリースビルド(AAB)

Android Studio で開いて署名付きビルド:

```bash
npx cap open android
# Build > Generate Signed Bundle / APK > Android App Bundle (.aab)
```

または Gradle で:

```bash
cd android
./gradlew bundleRelease     # app/build/outputs/bundle/release/app-release.aab
```

## 手順 6: Play Console へアップロード

1. アプリを作成(カテゴリ: ゲーム / アーケード)
2. ストア掲載情報を入力(`store/listing-ja.md` の草案を利用)
3. グラフィック素材をアップロード(アイコン 512、フィーチャーグラフィック 1024×500、スクショ 2〜8枚)
4. プライバシーポリシー URL を設定: `https://syoudai0514.github.io/space-game/privacy.html`
5. データ セーフティ フォーム: 本アプリは個人情報を収集しない(広告導入時は要更新)
6. 製品版トラックに AAB をアップロード → 審査提出

## 広告(任意・将来)

AdMob を入れる場合は `@capacitor-community/admob` を追加し、`src/native/main.js` で
初期化します(Web 版には影響しません)。本番広告 ID に切り替える前に必ずテスト ID で確認。

---

## チェックリスト

- [ ] `npm run sync` が成功する
- [ ] 実機 / エミュレータで起動・操作・ボス戦を確認
- [ ] アイコン・スプラッシュ・スクショを用意
- [ ] キーストアを安全に保管(バックアップ)
- [ ] プライバシーポリシーを公開(GitHub Pages)
- [ ] データ セーフティ・対象年齢・コンテンツのレーティングを記入
- [ ] AAB をアップロードして審査提出
