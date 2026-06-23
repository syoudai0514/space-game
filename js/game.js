// ゲーム本体。状態管理・スポーン・当たり判定・描画をまとめる。
// 描画は Canvas 2D。ループ駆動は main.js が担当する。

import { TAU, clamp, rand, randInt, pick, chance, hitCircle, shake, fmt } from './util.js';
import { Player, Bullet, Enemy, PowerUp, Boss, Crystal } from './entities.js';
import { Starfield } from './starfield.js';
import { Sfx, startBgm, stopBgm } from './audio.js';
import * as Meta from './meta.js';
import * as Monet from './monetize.js';

const HISCORE_KEY = 'mss-hiscore';
const POWER_TYPES = ['double', 'double', 'shield', 'heal', 'bomb', 'speed'];

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;                 // DOM 更新コールバック群
    this.dpr = 1;
    this.W = 0; this.H = 0;
    this.state = 'menu';          // menu | playing | paused | over
    this.stars = new Starfield(360, 640);
    this.reset();
    this.hiscore = this.loadHi();
  }

  loadHi() { try { return parseInt(localStorage.getItem(HISCORE_KEY) || '0', 10) || 0; } catch { return 0; } }
  saveHi() { try { localStorage.setItem(HISCORE_KEY, String(this.hiscore)); } catch { /* ignore */ } }

  resize(w, h, dpr) {
    this.W = w; this.H = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.stars.resize(w, h);
    if (this.player) { this.player.tx = clamp(this.player.tx, 0, w); }
  }

  reset() {
    this.player = null;
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.crystals = [];      // 💎スターダスト
    this.floats = [];        // フローティングテキスト(+score など)
    this.boss = null;
    this.runStardust = 0;    // このランで集めた💎
    this.magnetRange = 0;
    this.freeRevives = 0;
    this.adReviveUsed = false;
    this.committed = false;
    this.score = 0;
    this.combo = 1;
    this.comboT = 0;
    this.wave = 0;
    this.waveT = 0;
    this.spawnCd = 0;
    this.toSpawn = 0;
    this.shakeAmt = 0;
    this.over = false;
    this.bossIndex = 0;
    this.flash = 0;
    this.toastT = 0;
    this.transition = 0;   // ウェーブ間の小休止(秒)。>0 の間は次ウェーブへ進まない
  }

  start() {
    this.reset();
    this.player = new Player(this.W, this.H);
    // 永続アップグレードを反映(パワーファンタジー = 強くなった実感)
    const b = Meta.bonuses();
    this.player.maxHealth = b.maxHealth;
    this.player.health = b.maxHealth;
    this.player.weapon = clamp(b.startWeapon, 1, 5);
    this.player.bombs = b.startBombs;
    this.player.baseFireRate = 0.16 * b.fireRateMul;
    this.magnetRange = b.magnetRange;
    this.freeRevives = b.freeRevives;
    this.adReviveUsed = false;
    this.committed = false;
    this.runStardust = 0;
    this.runStartHi = this.hiscore;   // 「記録更新」判定はラン開始前の値と比べる
    this.state = 'playing';
    this.over = false;
    this.nextWave();
    startBgm();
    this.syncHud();
  }

  // 難易度係数: ウェーブが進むほど上がる(なめらかな逓増曲線)
  get diff() { return 1 + (this.wave - 1) * 0.09; }

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; stopBgm(0.4); this.ui.showPause(true); }
    else if (this.state === 'paused') { this.state = 'playing'; startBgm(); this.ui.showPause(false); }
  }

  // ---------- ウェーブ進行 ----------
  nextWave() {
    this.wave++;
    this.waveT = 0;
    if (this.wave % 5 === 0) {
      // ボスウェーブ
      Sfx.bossWarn();
      this.boss = new Boss(this.W, this.H, this.bossIndex, this.diff);
      this.ui.bannerBoss(this.boss.def);
      this.toSpawn = 0;
    } else {
      const base = 5 + this.wave * 1.6;
      this.toSpawn = Math.round(base);
      this.spawnCd = 0.6;
      this.ui.bannerWave(this.wave);
      Sfx.levelUp();
    }
    this.syncHud();
  }

  onBossDefeated() {
    this.boss = null;
    this.bossIndex++;
    this.flash = 0.6;
    this.transition = 1.6;   // 撃破演出の小休止。これが切れると次ウェーブへ自然に進む
    this.toast('🎉 ボス撃破!');
  }

  spawnEnemy() {
    const x = rand(30, this.W - 30);
    const roll = Math.random();
    let kind;
    if (this.wave < 2) kind = roll < 0.85 ? 'asteroid' : 'comet';
    else if (this.wave < 4) kind = roll < 0.6 ? 'asteroid' : roll < 0.85 ? 'comet' : 'alien';
    else kind = roll < 0.45 ? 'asteroid' : roll < 0.68 ? 'comet' : roll < 0.86 ? 'alien' : 'planet';
    this.enemies.push(new Enemy(kind, x, -30, { diff: this.diff }));
  }

  // ---------- ヘルパー(entities から呼ばれる) ----------
  addScore(n) {
    this.score += Math.round(n * this.combo);
    this.combo = Math.min(8, this.combo + 0.12);
    this.comboT = 2.5;
    if (this.score > this.hiscore) { this.hiscore = this.score; }
    this.syncHud();
  }
  spawnHit(x, y) {
    for (let i = 0; i < 4; i++) this.particles.push(mkParticle(x, y, '#fff', rand(1.5, 3), rand(0.15, 0.3), 160));
  }
  spawnExplosion(x, y, color, n = 18, scale = 1) {
    for (let i = 0; i < n; i++) {
      const sp = rand(60, 260) * scale;
      const a = rand(TAU);
      const p = mkParticle(x, y, color, rand(2, 5) * scale, rand(0.3, 0.7), 0);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      this.particles.push(p);
    }
    // 中心フラッシュ
    const f = mkParticle(x, y, color, 18 * scale, 0.25, 0);
    f.glow = true; this.particles.push(f);
    this.shakeAmt = Math.max(this.shakeAmt, 4 * scale);
  }
  spawnRing(x, y, color) {
    const r = mkParticle(x, y, color, 6, 0.4, 0);
    r.ring = true; r.vr = 200; this.particles.push(r);
  }
  dropPowerUp(x, y) { this.powerups.push(new PowerUp(x, y, pick(POWER_TYPES))); }
  toast(msg) { this.ui.toast(msg); }

  // 💎スターダスト: 落とす / 回収する
  dropStardust(x, y, value) {
    const n = clamp(Math.round(value / 2), 1, 8);    // 個数に分割して撒く(集める手応え)
    for (let i = 0; i < n; i++) this.crystals.push(new Crystal(x, y, Math.ceil(value / n)));
  }
  collectStardust(value) {
    this.runStardust += value;
    Sfx.shield(); // 軽いキラッ音
    this.syncHud();
  }
  float(x, y, text, color, size = 14) {
    this.floats.push({ x, y, vy: -40, text, color, size, life: 0.9, maxLife: 0.9 });
  }

  useBomb() {
    if (this.state !== 'playing' || !this.player || this.player.bombs <= 0) return;
    this.player.bombs--;
    Sfx.bomb();
    this.flash = 0.5;
    this.shakeAmt = 18;
    this.enemyBullets = [];
    for (const e of this.enemies) { this.spawnExplosion(e.x, e.y, '#ffd27f', 14, 1); this.addScore(e.score * 0.5); }
    this.enemies = [];
    if (this.boss) this.boss.damage(80, this);
    this.syncHud();
  }

  triggerGameOver() {
    this.over = true;
    this.state = 'over';
    stopBgm();
    Sfx.gameOver();
    const isHi = this.score > this.runStartHi;
    this.saveHi();
    Meta.recordRun(this.wave, this.score);
    Monet.noteGameOver();
    setTimeout(() => this.ui.showGameOver({
      score: this.score, hiscore: this.hiscore, wave: this.wave, isHi,
      stardust: this.runStardust,
      canRevive: this.canRevive(),
      reviveIsFree: this.freeRevives > 0,
    }), 700);
  }

  canRevive() { return this.freeRevives > 0 || !this.adReviveUsed; }

  // コンティニュー(復活)。useAd=true なら広告視聴ぶん、false なら無料リバイブ消費。
  revive(useAd) {
    if (!this.player) return;
    if (useAd) this.adReviveUsed = true; else this.freeRevives = Math.max(0, this.freeRevives - 1);
    this.over = false;
    this.state = 'playing';
    this.player.dead = false;
    this.player.lives = Math.max(this.player.lives, 0);
    this.player.health = this.player.maxHealth;
    this.player.invuln = 2.8;
    this.player.x = this.player.tx = this.W / 2;
    this.player.y = this.player.ty = this.H - 120;
    this.enemyBullets = [];
    this.flash = 0.5;
    startBgm();
    this.syncHud();
  }

  doubleStardust() { this.runStardust *= 2; this.syncHud(); }

  // ランで集めた💎を所持金に確定(離脱時に1回だけ)
  commitRun() {
    if (this.committed) return;
    Meta.addStardust(this.runStardust);
    this.committed = true;
  }

  syncHud() {
    if (this.ui.hud) this.ui.hud({
      score: this.score, hiscore: this.hiscore, wave: this.wave,
      lives: this.player ? Math.max(0, this.player.lives) : 0,
      health: this.player ? this.player.health / this.player.maxHealth : 0,
      bombs: this.player ? this.player.bombs : 0,
      weapon: this.player ? this.player.weapon : 1,
      combo: this.combo,
      stardust: this.runStardust,
      boss: this.boss ? { hp: this.boss.hp / this.boss.maxHp, name: this.boss.def.name } : null,
    });
  }

  // ---------- 更新 ----------
  update(dt) {
    // 背景は常に動かす
    const bgSpeed = this.state === 'playing' ? 1.6 : 0.6;
    this.stars.update(dt, bgSpeed);
    this.flash = Math.max(0, this.flash - dt * 2);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 30);
    this.toastT = Math.max(0, this.toastT - dt);

    // パーティクル/フローティングテキストは状態に依らず進める
    for (const p of this.particles) updateParticle(p, dt);
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floats) { f.y += f.vy * dt; f.life -= dt; }
    this.floats = this.floats.filter((f) => f.life > 0);

    if (this.state !== 'playing') return;

    this.waveT += dt;
    if (this.transition > 0) this.transition -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 1; }

    // 通常ウェーブのスポーン
    if (!this.boss && this.toSpawn > 0) {
      this.spawnCd -= dt;
      if (this.spawnCd <= 0) {
        this.spawnEnemy();
        this.toSpawn--;
        this.spawnCd = clamp(0.9 - this.wave * 0.04, 0.28, 0.9);
      }
    }
    // ウェーブクリア判定
    if (!this.boss && this.transition <= 0 && this.toSpawn <= 0 && this.enemies.length === 0 && this.waveT > 1.2) {
      this.nextWave();
    }

    this.player.update(dt, this);
    if (this.boss) { this.boss.update(dt, this); this.syncHud(); }

    for (const b of this.bullets) b.update(dt, this);
    for (const b of this.enemyBullets) b.update(dt, this);
    for (const e of this.enemies) e.update(dt, this);
    for (const p of this.powerups) p.update(dt, this);
    for (const c of this.crystals) c.update(dt, this);

    this.collisions();

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.enemyBullets = this.enemyBullets.filter((b) => !b.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.powerups = this.powerups.filter((p) => !p.dead);
    this.crystals = this.crystals.filter((c) => !c.dead);

    this.syncHud();
  }

  collisions() {
    const p = this.player;
    // 自弾 vs 敵 / ボス
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (hitCircle(b.x, b.y, b.r, e.x, e.y, e.r)) { e.damage(b.dmg, this); b.dead = true; break; }
      }
      if (b.dead) continue;
      if (this.boss && !this.boss.entering && hitCircle(b.x, b.y, b.r, this.boss.x, this.boss.y, this.boss.r)) {
        this.boss.damage(b.dmg, this); b.dead = true;
      }
    }
    if (!p || p.dead) return;
    // 敵弾 vs 自機
    for (const b of this.enemyBullets) {
      if (!b.dead && hitCircle(b.x, b.y, b.r, p.x, p.y, p.r)) { b.dead = true; p.damage(b.dmg ?? 12, this); }
    }
    // 敵本体 vs 自機
    for (const e of this.enemies) {
      if (!e.dead && hitCircle(e.x, e.y, e.r * 0.8, p.x, p.y, p.r)) {
        const dmg = e.kind === 'planet' ? 30 : 18;
        e.damage(99, this); p.damage(dmg, this);
      }
    }
    // ボス本体接触
    if (this.boss && !this.boss.entering && hitCircle(this.boss.x, this.boss.y, this.boss.r * 0.85, p.x, p.y, p.r)) {
      p.damage(2, this); // 押し付けダメージ
    }
    // パワーアップ取得
    for (const pw of this.powerups) {
      if (!pw.dead && hitCircle(pw.x, pw.y, pw.r + 6, p.x, p.y, p.r + 8)) { pw.dead = true; p.applyPower(pw.type, this); }
    }
  }

  // ---------- 描画 ----------
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.fillStyle = '#05030f';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.save();
    if (this.shakeAmt > 0.5) ctx.translate(shake(this.shakeAmt), shake(this.shakeAmt));

    this.stars.render(ctx);

    for (const pw of this.powerups) pw.render(ctx);
    for (const c of this.crystals) c.render(ctx);
    for (const e of this.enemies) e.render(ctx);
    if (this.boss) this.boss.render(ctx);
    for (const b of this.bullets) b.render(ctx);
    for (const b of this.enemyBullets) b.render(ctx);
    if (this.player && !this.player.dead) this.player.render(ctx);
    for (const p of this.particles) renderParticle(ctx, p);
    this.renderFloats(ctx);

    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.5})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  renderFloats(ctx) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      ctx.globalAlpha = clamp(f.life / f.maxLife, 0, 1);
      ctx.font = `800 ${f.size}px system-ui, sans-serif`;
      ctx.fillStyle = f.color; ctx.shadowColor = f.color; ctx.shadowBlur = 8;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }
}

// ---------------- パーティクル(軽量・関数ベース) ----------------
function mkParticle(x, y, color, size, life, drift) {
  return { x, y, vx: rand(-drift, drift), vy: rand(-drift, drift), color, size, life, maxLife: life, glow: false, ring: false, vr: 0 };
}
function updateParticle(p, dt) {
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.vx *= 0.96; p.vy *= 0.96;
  if (p.ring) p.size += p.vr * dt;
  p.life -= dt;
}
function renderParticle(ctx, p) {
  const a = clamp(p.life / p.maxLife, 0, 1);
  ctx.globalAlpha = a;
  if (p.ring) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU);
    ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.shadowColor = p.color; ctx.shadowBlur = 12; ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU);
    ctx.fillStyle = p.color;
    if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 26; }
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}
