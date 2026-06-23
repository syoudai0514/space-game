# 🚀 もしも宇宙シューター (Moshimo Space Shooter)

**重力が暴走した太陽系を、研究艇〈ラボ号〉で切り抜けろ。**

[「もしも宇宙ラボ」](https://github.com/syoudai0514/moshimo-space-lab) の世界観をベースにした宇宙シューティングゲーム。
ラボの実験で太陽系の重力バランスが崩壊。はぐれ惑星・彗星・小惑星が飛び交うなか、
5ウェーブごとに現れる「もしもボス」(恒星化した木星、暴走ブラックホールなど)を撃破していく。

🎯 **Google Play での公開を目指して開発中。**

## 特徴

- **片手で遊べる縦スクロールシューティング**: ドラッグで移動、ショットは自動。スマホ最適化
- **エンドレス&逓増する難易度**: ウェーブが進むほど敵が硬く・速く・多くなる(なめらかな曲線)
- **「もしも」ボス戦**: ☄️ 巨大小惑星セレス / ⭐ 恒星化した木星 / 🕳️ 暴走ブラックホール。周回ごとに強化
- **💎スターダスト経済 & 永続強化ショップ**: 倒した敵が落とす💎を集め、機体を恒久アップグレード(装甲/連射/初期武装/ボム/回収/リバイブ)。死んでも強くなる中毒ループ
- **コンティニュー&報酬2倍**: 死亡時の復活、リザルトの💎2倍(将来のリワード広告に対応)
- **パワーアップ**: 🔫ショット強化 / 🛡️シールド / 💚装甲回復 / 💣ボム / ⚡スピードアップ
- **手続き生成サウンド**: Web Audio API による効果音・BGM(音源ファイル不要・著作権フリー)
- **発光する宇宙ビジュアル**: 視差スクロールの星空・星雲、パーティクル爆発、画面シェイク、スコアポップ
- **ビルド不要**: 素の HTML5 Canvas + ES Modules。依存ライブラリなしで動く

> ゲームデザインと収益化(広告タイミング・課金・AdMob連携)の方針は **[MONETIZATION.md](./MONETIZATION.md)** を参照。

## 操作方法

| 操作 | スマホ | PC |
|------|--------|----|
| 移動 | 画面をドラッグ | WASD / 矢印キー |
| 攻撃 | 自動発射 | 自動発射 |
| ボム | 右下の💣ボタン | スペース |
| ポーズ | 右上の⏸ボタン | P / Esc |

## 開発(Web 版)

ビルド不要の静的サイト。

```bash
python3 -m http.server 8000   # または npm start
# → http://localhost:8000
```

## ディレクトリ構成

```
index.html          画面・HUD のマークアップ
css/style.css       UI スタイル(宇宙ラボの発光テーマ)
js/
  main.js           起動・入力・DOM 配線・ショップ・メインループ
  game.js           ゲーム状態・スポーン・当たり判定・難易度・描画
  entities.js       自機・敵・弾・ボス・パワーアップ・💎スターダスト
  starfield.js      視差スクロールの星空背景
  audio.js          Web Audio による効果音・BGM
  meta.js           永続データ(💎通貨・永続アップグレード)
  monetize.js       広告/課金の統合フック(AdMob 差し込み口)
  util.js           汎用ヘルパー
src/native/main.js  Android 版だけで読まれるネイティブ起動(将来の AdMob 等)
scripts/build-web.mjs  Capacitor 用 www/ ビルド
```

## Android アプリ版(Capacitor)

Web アプリを Capacitor で Android アプリ化する想定。手順は **[RELEASE.md](./RELEASE.md)** を参照。

```bash
npm install
npx cap add android      # 初回のみ
npm run sync             # www/ を生成し Android プロジェクトに反映
npx cap open android     # Android Studio で開く
```

## クレジット

- 元になった世界観: [syoudai0514/moshimo-space-lab](https://github.com/syoudai0514/moshimo-space-lab)
- そのさらに元: [syoudai0514/space](https://github.com/syoudai0514/space)
