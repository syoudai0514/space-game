// 起動・入力・DOM(画面/HUD)配線・メインループ。

import { Game } from './game.js';
import { unlock, toggleSfx, toggleBgm, sfxEnabled, bgmEnabled, stopBgm, Sfx } from './audio.js';
import * as Meta from './meta.js';
import * as Monet from './monetize.js';
import * as LB from './leaderboard.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');

// ---- 画面/HUD 要素 ----
const el = {
  score: $('hud-score'), hi: $('hud-hi'), wave: $('hud-wave'),
  lives: $('hud-lives'), weapon: $('hud-weapon'), bombs: $('hud-bombs'),
  combo: $('hud-combo'), healthFill: $('health-fill'), stardust: $('hud-stardust'),
  bossBar: $('boss-bar'), bossFill: $('boss-fill'), bossName: $('boss-name'),
  toast: $('toast'), banner: $('banner'),
  start: $('start-screen'), startHi: $('start-hi'), startBest: $('start-bestwave'), startSd: $('start-stardust'),
  pause: $('pause-screen'), gameover: $('gameover-screen'),
  goScore: $('go-score'), goHi: $('go-hi'), goWave: $('go-wave'), goNew: $('go-new'), goSd: $('go-stardust'),
  goRevive: $('go-revive'), goDouble: $('go-double'),
  shop: $('shop-screen'), shopSd: $('shop-stardust'), shopList: $('shop-list'),
  bombBtn: $('bomb-btn'), pauseBtn: $('pause-btn'),
  sfxBtn: $('sfx-toggle'), bgmBtn: $('bgm-toggle'),
  rank: $('rank-screen'), rankList: $('rank-list'), rankMode: $('rank-mode'),
  rankSend: $('rank-send'), rankName: $('rank-name'), rankResult: $('rank-result'),
};

let bannerT = 0, toastT = 0;
let lastResult = { score: 0, wave: 0 };  // 直近リザルト(ランキング登録用)

// ---- UI コールバック(Game から呼ばれる) ----
const ui = {
  hud(s) {
    el.score.textContent = s.score.toLocaleString('en-US');
    el.hi.textContent = s.hiscore.toLocaleString('en-US');
    el.wave.textContent = s.wave;
    el.weapon.textContent = 'Lv' + s.weapon;
    el.bombs.textContent = '×' + s.bombs;
    el.combo.textContent = s.combo >= 1.5 ? '×' + s.combo.toFixed(1) : '';
    el.stardust.textContent = s.stardust || 0;
    el.lives.textContent = '♥'.repeat(Math.max(0, s.lives));
    el.healthFill.style.width = Math.round(s.health * 100) + '%';
    el.healthFill.style.background = s.health > 0.5 ? 'linear-gradient(90deg,#3affa0,#7fffd0)'
      : s.health > 0.25 ? 'linear-gradient(90deg,#ffd23a,#ffe98a)' : 'linear-gradient(90deg,#ff4a4a,#ff8a8a)';
    if (s.boss) {
      el.bossBar.classList.add('show');
      el.bossFill.style.width = Math.round(s.boss.hp * 100) + '%';
      el.bossName.textContent = s.boss.name;
    } else {
      el.bossBar.classList.remove('show');
    }
  },
  bannerWave(n) { showBanner('WAVE ' + n, 'はぐれ天体 接近中'); },
  bannerBoss(def) { showBanner('⚠ WARNING ⚠', def.name + '<br><span class="banner-sub">' + def.desc + '</span>', true); },
  toast(msg) { el.toast.innerHTML = msg; el.toast.classList.add('show'); toastT = 1.6; },
  showPause(on) { el.pause.classList.toggle('show', on); },
  showGameOver(r) {
    el.goScore.textContent = r.score.toLocaleString('en-US');
    el.goHi.textContent = r.hiscore.toLocaleString('en-US');
    el.goWave.textContent = r.wave;
    el.goSd.textContent = r.stardust;
    el.goNew.style.display = r.isHi ? 'block' : 'none';
    // 世界ランキング登録ブロックの初期化
    lastResult = { score: r.score, wave: r.wave };
    el.rankName.value = LB.getName();
    el.rankResult.textContent = '';
    el.rankResult.classList.remove('err');
    el.rankSend.disabled = r.score <= 0;
    el.rankSend.textContent = '🏆 ランキングに登録';
    // 復活ボタン: 残数があるとき or 1ラン1回の広告復活が可能なとき
    el.goRevive.style.display = r.canRevive ? 'block' : 'none';
    el.goRevive.textContent = r.reviveIsFree ? '❤️‍🔥 無料で復活して続ける' : '📺 広告を見て復活';
    el.goRevive.disabled = false;
    // 報酬2倍ボタン
    el.goDouble.style.display = r.stardust > 0 ? 'block' : 'none';
    el.goDouble.disabled = false;
    el.goDouble.textContent = '📺 💎を2倍にする（' + r.stardust + '→' + r.stardust * 2 + '）';
    el.gameover.classList.add('show');
  },
};

function showBanner(title, sub, danger) {
  el.banner.innerHTML = `<div class="banner-title">${title}</div><div class="banner-sub">${sub}</div>`;
  el.banner.classList.toggle('danger', !!danger);
  el.banner.classList.add('show');
  bannerT = danger ? 2.2 : 1.4;
}

const game = new Game(canvas, ui);

// ---- リサイズ ----
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  game.resize(window.innerWidth, window.innerHeight, dpr);
}
window.addEventListener('resize', resize);
resize();

// ---- 入力: ポインタ(タッチ/マウス) ----
let pointerActive = false;
function pointerPos(e) {
  const t = e.touches ? e.touches[0] : e;
  return { x: t.clientX, y: t.clientY };
}
function onPointerMove(e) {
  if (game.state !== 'playing' || !game.player) return;
  const isTouch = e.pointerType === 'touch' || e.touches;
  const p = pointerPos(e);
  game.player.setTarget(p.x, p.y - (isTouch ? 56 : 0));
  e.preventDefault();
}
canvas.addEventListener('pointerdown', (e) => { pointerActive = true; onPointerMove(e); });
canvas.addEventListener('pointermove', (e) => { if (pointerActive || e.pointerType !== 'touch') onPointerMove(e); });
window.addEventListener('pointerup', () => { pointerActive = false; });
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// ---- 入力: キーボード(デスクトップ) ----
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key === ' ') game.useBomb();
  if (e.key.toLowerCase() === 'p' || e.key === 'Escape') game.togglePause();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function applyKeyboard(dt) {
  if (game.state !== 'playing' || !game.player) return;
  const sp = 520 * dt;
  let dx = 0, dy = 0;
  if (keys.has('arrowleft') || keys.has('a')) dx -= sp;
  if (keys.has('arrowright') || keys.has('d')) dx += sp;
  if (keys.has('arrowup') || keys.has('w')) dy -= sp;
  if (keys.has('arrowdown') || keys.has('s')) dy += sp;
  if (dx || dy) game.player.setTarget(game.player.tx + dx, game.player.ty + dy);
}

// ---- ボタン ----
function firstTouchUnlock() { unlock(); }
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, firstTouchUnlock, { once: true }));

function refreshTitle() {
  el.startHi.textContent = game.hiscore.toLocaleString('en-US');
  el.startBest.textContent = Meta.get().bestWave;
  el.startSd.textContent = Meta.stardust();
}
function showTitle() { game.state = 'menu'; el.start.classList.add('show'); refreshTitle(); }

// ランから離脱する共通処理: 集めた💎を確定 → たまにインタースティシャル広告
async function leaveRun() {
  game.commitRun();
  if (Monet.shouldShowInterstitial()) { try { await Monet.showInterstitial(); } catch { /* ignore */ } }
}

$('start-btn').addEventListener('click', () => { Sfx.ui(); unlock(); el.start.classList.remove('show'); game.start(); });

$('go-restart').addEventListener('click', async () => { Sfx.ui(); el.gameover.classList.remove('show'); await leaveRun(); game.start(); });
$('go-menu').addEventListener('click', async () => { Sfx.ui(); el.gameover.classList.remove('show'); await leaveRun(); showTitle(); });
$('go-shop').addEventListener('click', () => { Sfx.ui(); game.commitRun(); openShop('gameover'); });

// リワード復活
el.goRevive.addEventListener('click', async () => {
  Sfx.ui();
  el.goRevive.disabled = true;
  if (game.freeRevives > 0) {
    game.revive(false); el.gameover.classList.remove('show');
  } else {
    const r = await Monet.showRewarded('revive');
    if (r.granted) { game.revive(true); el.gameover.classList.remove('show'); if (r.demo) ui.toast('デモ復活（アプリ版は広告視聴で復活）'); }
    else { el.goRevive.disabled = false; ui.toast('広告を読み込めませんでした'); }
  }
});

// リワード報酬2倍
el.goDouble.addEventListener('click', async () => {
  Sfx.ui();
  el.goDouble.disabled = true;
  const r = await Monet.showRewarded('double');
  if (r.granted) { game.doubleStardust(); el.goSd.textContent = game.runStardust; el.goDouble.textContent = '✅ 2倍 獲得!'; if (r.demo) ui.toast('デモ: 💎2倍（アプリ版は広告視聴）'); }
  else { el.goDouble.disabled = false; ui.toast('広告を読み込めませんでした'); }
});

$('resume-btn').addEventListener('click', () => { Sfx.ui(); game.togglePause(); });
$('quit-btn').addEventListener('click', () => { Sfx.ui(); game.commitRun(); el.pause.classList.remove('show'); stopBgm(); showTitle(); });
el.pauseBtn.addEventListener('click', () => { Sfx.ui(); game.togglePause(); });
el.bombBtn.addEventListener('click', () => game.useBomb());

// ===== ショップ =====
let shopFrom = 'title';
function openShop(from) { shopFrom = from || 'title'; renderShop(); el.shop.classList.add('show'); }
function renderShop() {
  el.shopSd.textContent = Meta.stardust();
  el.shopList.innerHTML = '';
  for (const u of Meta.UPGRADES) {
    const lv = Meta.level(u.id), max = Meta.maxLevel(u.id), maxed = Meta.isMax(u.id);
    const row = document.createElement('div');
    row.className = 'shop-item';
    let pips = '';
    for (let i = 0; i < max; i++) pips += `<div class="pip ${i < lv ? 'on' : ''}"></div>`;
    const btn = maxed
      ? '<button class="shop-buy maxed" disabled>MAX</button>'
      : `<button class="shop-buy" data-id="${u.id}" ${Meta.canBuy(u.id) ? '' : 'disabled'}>💎 ${Meta.cost(u.id)}</button>`;
    row.innerHTML = `<div class="shop-icon">${u.icon}</div>
      <div class="shop-info"><div class="shop-name">${u.name} <span style="color:#7d92c0;font-size:11px">Lv${lv}/${max}</span></div>
      <div class="shop-desc">${u.desc}</div><div class="shop-pips">${pips}</div></div>${btn}`;
    el.shopList.appendChild(row);
  }
  el.shopList.querySelectorAll('.shop-buy[data-id]').forEach((b) => {
    b.addEventListener('click', () => {
      if (Meta.buy(b.dataset.id)) { Sfx.power(); renderShop(); }
      else { Sfx.ui(); }
    });
  });
}
$('shop-btn').addEventListener('click', () => { Sfx.ui(); unlock(); openShop('title'); });
$('shop-close').addEventListener('click', () => {
  Sfx.ui(); el.shop.classList.remove('show');
  if (shopFrom === 'gameover') { el.gameover.classList.remove('show'); showTitle(); }
  else refreshTitle();
});
$('shop-remove-ads').addEventListener('click', async () => {
  Sfx.ui();
  const r = await Monet.purchaseRemoveAds();
  if (r.ok) ui.toast('✅ 広告を削除しました。ありがとうございます!');
  else ui.toast('🚫 アプリ版で購入できます');
});

// ===== 世界ランキング =====
let rankFrom = 'title';   // 'title' | 'gameover' — 閉じたときの戻り先
let rankPeriod = 'all';

// ゲームオーバー画面から「登録」
el.rankSend.addEventListener('click', async () => {
  Sfx.ui();
  el.rankSend.disabled = true;
  el.rankSend.textContent = '⏳ 送信中…';
  el.rankResult.classList.remove('err');
  el.rankResult.textContent = '';
  const name = LB.setName(el.rankName.value);
  el.rankName.value = name;
  const res = await LB.submitScore({ name, score: lastResult.score, wave: lastResult.wave });
  if (res.ok && res.online) {
    el.rankSend.textContent = '✅ 登録しました';
    el.rankResult.innerHTML = res.rank
      ? `世界 <span class="rank-big">${res.rank}</span> 位!`
      : '登録完了! 「順位」から確認できます';
  } else if (res.ok && !res.online) {
    el.rankSend.textContent = '✅ 記録しました';
    el.rankResult.textContent = 'この端末に記録(サーバー未設定)';
  } else {
    el.rankSend.disabled = false;
    el.rankSend.textContent = '🏆 もう一度試す';
    el.rankResult.classList.add('err');
    el.rankResult.textContent = res.error === 'timeout'
      ? '⚠ 通信がタイムアウトしました' : '⚠ 送信に失敗しました。通信状況をご確認ください';
  }
});

function openRank(from) {
  rankFrom = from || 'title';
  el.rank.classList.add('show');
  loadRank();
}
async function loadRank() {
  el.rankList.innerHTML = '<div class="rank-empty">読み込み中…</div>';
  el.rankMode.textContent = LB.isOnline() ? '' : '📴 サーバー未設定 — この端末内の記録を表示中';
  el.rankMode.classList.toggle('offline', !LB.isOnline());
  const res = await LB.fetchTop(rankPeriod, 100);
  renderRank(res);
}
function renderRank(res) {
  if (res.error) {
    el.rankList.innerHTML = `<div class="rank-empty">⚠ 読み込みに失敗しました<br>(${res.error === 'timeout' ? 'タイムアウト' : '通信エラー'})</div>`;
    return;
  }
  if (!res.rows.length) {
    el.rankList.innerHTML = '<div class="rank-empty">まだ記録がありません。<br>一番乗りを目指そう! 🚀</div>';
    return;
  }
  el.rankList.innerHTML = res.rows.map((r, i) => {
    const pos = i + 1;
    const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
    const cls = ['rank-row', pos <= 3 ? 'top' + pos : '', r.mine ? 'me' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}">
      <div class="rank-pos">${medal}</div>
      <div class="rank-nm">${escapeHtml(r.name)}</div>
      <div class="rank-wv">W${r.wave}</div>
      <div class="rank-sc">${r.score.toLocaleString('en-US')}</div>
    </div>`;
  }).join('');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('rank-btn').addEventListener('click', () => { Sfx.ui(); unlock(); openRank('title'); });
$('go-rank').addEventListener('click', () => { Sfx.ui(); openRank('gameover'); });
$('rank-refresh').addEventListener('click', () => { Sfx.ui(); loadRank(); });
$('rank-close').addEventListener('click', () => {
  Sfx.ui(); el.rank.classList.remove('show');
  if (rankFrom === 'title') refreshTitle();
});
el.rank.querySelectorAll('.rank-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    if (tab.classList.contains('active')) return;
    Sfx.ui();
    el.rank.querySelectorAll('.rank-tab').forEach((t) => t.classList.toggle('active', t === tab));
    rankPeriod = tab.dataset.period;
    loadRank();
  });
});

function refreshToggles() {
  el.sfxBtn.textContent = '🔊 効果音: ' + (sfxEnabled() ? 'ON' : 'OFF');
  el.sfxBtn.classList.toggle('off', !sfxEnabled());
  el.bgmBtn.textContent = '🎵 BGM: ' + (bgmEnabled() ? 'ON' : 'OFF');
  el.bgmBtn.classList.toggle('off', !bgmEnabled());
}
el.sfxBtn.addEventListener('click', () => { toggleSfx(); refreshToggles(); });
el.bgmBtn.addEventListener('click', () => { toggleBgm(); refreshToggles(); });
refreshToggles();

// 共有
$('go-share')?.addEventListener('click', async () => {
  const text = `もしも宇宙シューターでスコア ${game.score.toLocaleString('en-US')}(WAVE ${game.wave})を達成! 🚀`;
  try {
    if (navigator.share) await navigator.share({ title: 'もしも宇宙シューター', text });
    else { await navigator.clipboard.writeText(text); ui.toast('📋 結果をコピーしました'); }
  } catch { /* canceled */ }
});

// 初期表示
refreshTitle();
el.start.classList.add('show');

// ---- メインループ ----
let last = performance.now();
function loop(t) {
  let dt = (t - last) / 1000;
  last = t;
  if (dt > 0.05) dt = 0.05; // タブ復帰などの巨大 dt を抑制

  applyKeyboard(dt);
  game.update(dt);
  game.render();

  // バナー/トーストのタイマー
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) el.banner.classList.remove('show'); }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) el.toast.classList.remove('show'); }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
