// Android(Capacitor)版でだけ読み込まれるネイティブ起動スクリプト。
// Web 版(GitHub Pages)では index.html に差し込まれないため実行されない。
//
// いまは何もしないが、将来ここに以下を足せる:
//   - AdMob(@capacitor-community/admob)の初期化・バナー/インタースティシャル表示
//   - StatusBar / SplashScreen 制御
//   - ゲーム結果のネイティブ共有 など
//
// 例(AdMob を入れる場合):
//   import { AdMob } from '@capacitor-community/admob';
//   AdMob.initialize();

(function () {
  // ネイティブ環境かどうかの簡易判定(必要になったら使う)
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (isNative) {
    document.documentElement.classList.add('native');
  }
})();
