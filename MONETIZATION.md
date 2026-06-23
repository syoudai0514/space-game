# ゲームデザイン & マネタイズ設計

「何時間でも遊べる中毒性」と「将来の課金・広告収益」を両立するための設計メモ。
プレイヤー心理を起点に、難易度・成長・収益化を1つのループに組み込んでいる。

## 1. コアループ(中毒性の源泉)

```
プレイ → 敵を倒して💎スターダスト獲得 → 死ぬ
   ↑                                        ↓
   └─ 強くなって再挑戦 ← 💎で永続アップグレード ←┘
```

- **見える成長**: 死んでも💎は残り、機体が恒久的に強くなる。「次はもっと行ける」が再挑戦の動機。
- **収集の快感**: 💎は敵から飛び散り、機体に吸い寄せられて回収(マグネット)。集める手応えが「もう1回」を生む。
- **自己ベスト更新**: ハイスコア・最高到達ウェーブを保存し、タイトルに常時表示。

## 2. 難易度カーブ(離脱を防ぐ)

- ウェーブ係数 `diff = 1 + (wave-1)*0.09` を敵HP・速度・ボスHPに反映(`game.js`)。
- 急に理不尽にならず**なめらかに上昇**。同時にプレイヤーも強化されるため、
  「歯ごたえはあるが理不尽ではない」フロー状態を維持。
- ボスは5ウェーブごと+周回ごとに強化(エンドレスでも上限なく成長)。

## 3. 広告設計(フローを壊さない)

| 種別 | タイミング | 意図 |
|------|-----------|------|
| **リワード=復活** | 死亡時「復活して続ける」 | 最も満足度が高く収益性も高い。記録更新中ほど見たくなる |
| **リワード=報酬2倍** | リザルトで「💎を2倍」 | 自発視聴。損失回避心理を利用しつつ“得”の形に |
| **インタースティシャル** | ゲームオーバー**3回に1回**(最初の数回は出さない) | まず楽しさを体験させてから。初期離脱を防ぐ |
| **バナー** | （任意）メニューのみ | ゲーム中は出さない=没入を守る |

- 1ラン中の**広告復活は1回まで**(+アップグレードの無料リバイブ)。スコアの価値を守る。
- 実装は `js/monetize.js` に集約。`shouldShowInterstitial()` が頻度制御を担う。

## 4. 課金(IAP)/有料版

- **広告削除(Remove Ads)**: ショップの「🚫 広告を消す」。継続プレイヤーの定番課金。
- `monetize.purchaseRemoveAds()` で購入 → `isPremium()` が true になり、以後インタースティシャル/バナーを停止。
- 将来の拡張余地: 💎パック直接購入、限定スキン、スターターパックなど。

## 5. 実装の差し込み点(AdMob / 課金)

Web 版(GitHub Pages)では広告は動かず、リワードは**デモ報酬**として付与される
(続きを試せるように)。Android 版で実際の広告/課金を有効にするには、
`src/native/main.js` から `window.__ADS__` を実装するだけでよい:

```js
// src/native/main.js (Capacitor / AdMob 版でのみ読み込まれる)
import { AdMob } from '@capacitor-community/admob';
await AdMob.initialize();

window.__ADS__ = {
  async interstitial() {
    await AdMob.prepareInterstitial({ adId: 'ca-app-pub-XXXX/XXXX' });
    await AdMob.showInterstitial();
  },
  async rewarded(kind) {
    await AdMob.prepareRewardVideoAd({ adId: 'ca-app-pub-XXXX/XXXX' });
    const res = await AdMob.showRewardVideoAd();        // 視聴完了で報酬
    return !!res; // true を返すとゲーム側が報酬を付与
  },
  async purchaseRemoveAds() {
    // RevenueCat / Google Play Billing で購入処理 → 成功なら true
    return false;
  },
};
```

`js/monetize.js` は `window.__ADS__` があればそれを使い、無ければ Web フォールバックで動く。
**ゲーム本体のコードは一切変更不要**。テスト ID→本番 ID の切替や審査の注意は
[RELEASE.md](./RELEASE.md) を参照。

## 6. 倫理・配慮

- ゲーム中に広告を出さない。広告は必ず「区切り」かつ「ユーザーの得」になる形に限定。
- 個人情報は収集しない([privacy.html](./privacy.html))。広告 ID の扱いは AdMob 導入時に明記。
- 子どもも遊ぶ前提で、過度に射幸性を煽る課金導線(ガチャ等)は採用しない。
