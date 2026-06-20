// 起動・入力・DOM(画面/HUD)配線・メインループ。

import { Game } from './game.js';
import { unlock, toggleSfx, toggleBgm, sfxEnabled, bgmEnabled, Sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');

// ---- 画面/HUD 要素 ----
const el = {
  score: $('hud-score'), hi: $('hud-hi'), wave: $('hud-wave'),
  lives: $('hud-lives'), weapon: $('hud-weapon'), bombs: $('hud-bombs'),
  combo: $('hud-combo'), healthFill: $('health-fill'),
  bossBar: $('boss-bar'), bossFill: $('boss-fill'), bossName: $('boss-name'),
  toast: $('toast'), banner: $('banner'),
  start: $('start-screen'), startHi: $('start-hi'),
  pause: $('pause-screen'), gameover: $('gameover-screen'),
  goScore: $('go-score'), goHi: $('go-hi'), goWave: $('go-wave'), goNew: $('go-new'),
  bombBtn: $('bomb-btn'), pauseBtn: $('pause-btn'),
  sfxBtn: $('sfx-toggle'), bgmBtn: $('bgm-toggle'),
};

let bannerT = 0, toastT = 0;

// ---- UI コールバック(Game から呼ばれる) ----
const ui = {
  hud(s) {
    el.score.textContent = s.score.toLocaleString('en-US');
    el.hi.textContent = s.hiscore.toLocaleString('en-US');
    el.wave.textContent = s.wave;
    el.weapon.textContent = 'Lv' + s.weapon;
    el.bombs.textContent = '×' + s.bombs;
    el.combo.textContent = s.combo >= 1.5 ? '×' + s.combo.toFixed(1) : '';
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
  showGameOver(score, hi, wave, isNew) {
    el.goScore.textContent = score.toLocaleString('en-US');
    el.goHi.textContent = hi.toLocaleString('en-US');
    el.goWave.textContent = wave;
    el.goNew.style.display = isNew ? 'block' : 'none';
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

$('start-btn').addEventListener('click', () => { Sfx.ui(); unlock(); el.start.classList.remove('show'); game.start(); });
$('go-restart').addEventListener('click', () => { Sfx.ui(); el.gameover.classList.remove('show'); game.start(); });
$('go-menu').addEventListener('click', () => { Sfx.ui(); el.gameover.classList.remove('show'); el.start.classList.add('show'); el.startHi.textContent = game.hiscore.toLocaleString('en-US'); game.state = 'menu'; });
$('resume-btn').addEventListener('click', () => { Sfx.ui(); game.togglePause(); });
$('quit-btn').addEventListener('click', () => { Sfx.ui(); el.pause.classList.remove('show'); el.start.classList.add('show'); game.state = 'menu'; stopBgmSafe(); });
el.pauseBtn.addEventListener('click', () => { Sfx.ui(); game.togglePause(); });
el.bombBtn.addEventListener('click', () => game.useBomb());

function stopBgmSafe() { import('./audio.js').then((m) => m.stopBgm()); }

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
el.startHi.textContent = game.hiscore.toLocaleString('en-US');
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
