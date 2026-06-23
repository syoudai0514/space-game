// マネタイズ統合の単一窓口。広告(AdMob)と課金(広告削除/有料版)のフックをここに集約する。
//
// 設計意図(プレイヤー心理):
//  - ゲーム中は広告を一切出さない(没入を守る)。広告はリザルト/メニュー等の「区切り」だけ。
//  - インタースティシャルは「ゲームオーバー3回に1回」かつ「最初の数回は出さない」。
//    → まず楽しさを体験させてから広告を出すことで、初期離脱を防ぎ受容性を高める。
//  - リワード広告は“得をする”形(復活・報酬2倍)に限定。自発的に見たくなる=満足度と収益の両立。
//  - 有料版/広告削除(IAP)で広告を完全に消せる導線を用意 → 継続プレイヤーの課金につなげる。
//
// Web 版(GitHub Pages)では AdMob が無いため、リワードは「デモとして報酬を付与」して
// 続きを試せるようにする。Android 版では src/native/main.js から実装を差し込む
// (window.__ADS__ を実装すれば本物の広告に切り替わる)。

const KEY = 'mss-monet';
let state = load();

function load() {
  try { return { premium: false, goCount: 0, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { premium: false, goCount: 0 }; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }

// ネイティブ実装が注入されていれば使う(将来 AdMob を src/native から window.__ADS__ に設定)
const ads = () => (typeof window !== 'undefined' ? window.__ADS__ : null);
export const isNativeAds = () => !!ads();
export const isPremium = () => !!state.premium;

// インタースティシャル: 出すべきか?(課金者は出さない / 最初の2回は出さない / 3回に1回)
export function shouldShowInterstitial() {
  if (state.premium) return false;
  return state.goCount >= 3 && state.goCount % 3 === 0;
}
export function noteGameOver() { state.goCount++; save(); }

export async function showInterstitial() {
  if (state.premium) return;
  const a = ads();
  if (a && a.interstitial) { try { await a.interstitial(); } catch { /* ignore */ } }
  // Web: 何もしない
}

// リワード広告。戻り値 { granted, demo }。granted=true で報酬を付与してよい。
export async function showRewarded(kind) {
  const a = ads();
  if (a && a.rewarded) {
    try { const ok = await a.rewarded(kind); return { granted: !!ok, demo: false }; }
    catch { return { granted: false, demo: false }; }
  }
  // Web/デモ: 広告は無いが、続きを試せるよう報酬を付与する(本番はAdMobに置換)
  return { granted: true, demo: true };
}

// 広告削除 / 有料版の購入(IAP)。
export async function purchaseRemoveAds() {
  const a = ads();
  if (a && a.purchaseRemoveAds) {
    try { const ok = await a.purchaseRemoveAds(); if (ok) { state.premium = true; save(); } return { ok: !!ok }; }
    catch { return { ok: false }; }
  }
  return { ok: false, reason: 'native-only' }; // Web では購入不可
}
