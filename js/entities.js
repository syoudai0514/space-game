// ゲーム内の登場物すべて。各クラスは update(dt, game) と render(ctx) を持つ。
// 世界観:「もしも宇宙ラボ」の実験で重力が暴走し、はぐれ惑星・彗星・小惑星が
// 飛び交う太陽系。プレイヤーは研究艇〈ラボ号〉でこれを切り抜ける。

import { TAU, clamp, rand, randInt, chance, pick, approach, hitCircle } from './util.js';
import { Sfx } from './audio.js';

// ---------------- プレイヤー機体 ----------------
export class Player {
  constructor(W, H) {
    this.x = W / 2;
    this.y = H - 120;
    this.tx = this.x;
    this.ty = this.y;
    this.r = 15;
    this.maxHealth = 100;
    this.health = 100;
    this.lives = 3;
    this.weapon = 1;          // 1..5 でショットが強化
    this.fireCd = 0;
    this.baseFireRate = 0.16; // 秒
    this.shieldT = 0;         // シールド残り秒
    this.speedT = 0;          // スピードブースト残り秒
    this.invuln = 1.2;        // リスポーン後の無敵
    this.bombs = 1;
    this.thruster = 0;
    this.dead = false;
  }

  get shielded() { return this.shieldT > 0; }

  setTarget(x, y) { this.tx = x; this.ty = y; }

  update(dt, game) {
    const speed = this.speedT > 0 ? 26 : 18;
    this.x = approach(this.x, clamp(this.tx, this.r, game.W - this.r), dt, speed);
    this.y = approach(this.y, clamp(this.ty, this.r + 40, game.H - this.r - 10), dt, speed);

    this.fireCd -= dt;
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.speedT = Math.max(0, this.speedT - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.thruster = (this.thruster + dt * 30) % 1000;

    if (this.fireCd <= 0 && !game.over) {
      this.fire(game);
      this.fireCd = this.baseFireRate;
    }
  }

  fire(game) {
    const lv = this.weapon;
    const speed = 720;
    const mk = (ang, dmg = 1) => {
      const b = new Bullet(this.x, this.y - this.r, Math.sin(ang) * speed, -Math.cos(ang) * speed, dmg, true);
      game.bullets.push(b);
    };
    if (lv === 1) { mk(0); }
    else if (lv === 2) { mk(-0.05); mk(0.05); }
    else if (lv === 3) { mk(0); mk(-0.16); mk(0.16); }
    else if (lv === 4) { mk(-0.04); mk(0.04); mk(-0.22); mk(0.22); }
    else { mk(0, 1.4); mk(-0.12); mk(0.12); mk(-0.26); mk(0.26); }
    if (lv >= 3) Sfx.shootBig(); else Sfx.shoot();
  }

  damage(amount, game) {
    if (this.invuln > 0 || this.dead) return;
    if (this.shielded) { this.shieldT = 0; game.spawnRing(this.x, this.y, '#7fd0ff'); Sfx.shield(); this.invuln = 0.6; return; }
    this.health -= amount;
    game.shakeAmt = Math.max(game.shakeAmt, 12);
    Sfx.playerHit();
    if (this.health <= 0) {
      this.health = 0;
      this.loseLife(game);
    } else {
      this.invuln = 1.0;
    }
  }

  loseLife(game) {
    this.lives--;
    game.spawnExplosion(this.x, this.y, '#ffd27f', 40, 3);
    Sfx.explodeBig();
    if (this.lives < 0) {
      this.dead = true;
      game.triggerGameOver();
    } else {
      this.health = this.maxHealth;
      this.invuln = 2.2;
      this.weapon = Math.max(1, this.weapon - 1);
      this.x = this.tx = game.W / 2;
      this.y = this.ty = game.H - 120;
    }
  }

  applyPower(type, game) {
    Sfx.power();
    if (type === 'double') { this.weapon = Math.min(5, this.weapon + 1); game.toast('🔫 ショット強化 Lv' + this.weapon); }
    else if (type === 'shield') { this.shieldT = 8; game.toast('🛡️ シールド'); }
    else if (type === 'heal') { this.health = Math.min(this.maxHealth, this.health + 40); game.toast('💚 装甲回復'); }
    else if (type === 'bomb') { this.bombs = Math.min(5, this.bombs + 1); game.toast('💣 ボム +1'); }
    else if (type === 'speed') { this.speedT = 7; game.toast('⚡ スピードアップ'); }
  }

  render(ctx) {
    const blink = this.invuln > 0 && (Math.floor(this.invuln * 14) % 2 === 0);
    ctx.save();
    ctx.translate(this.x, this.y);
    if (blink) ctx.globalAlpha = 0.4;

    // スラスター炎
    const fl = 10 + Math.sin(this.thruster) * 4 + (this.speedT > 0 ? 8 : 0);
    ctx.beginPath();
    ctx.moveTo(-5, 8); ctx.lineTo(0, 8 + fl); ctx.lineTo(5, 8);
    ctx.fillStyle = this.speedT > 0 ? '#9fe7ff' : '#ff9b4a';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16;
    ctx.fill();

    // 機体
    ctx.shadowColor = '#6fa8ff'; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, -this.r);
    ctx.lineTo(this.r - 2, this.r);
    ctx.lineTo(0, this.r - 6);
    ctx.lineTo(-this.r + 2, this.r);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -this.r, 0, this.r);
    g.addColorStop(0, '#dff0ff'); g.addColorStop(1, '#5b8fe0');
    ctx.fillStyle = g; ctx.fill();
    // コックピット
    ctx.beginPath(); ctx.arc(0, -2, 4, 0, TAU);
    ctx.fillStyle = '#9becff'; ctx.shadowBlur = 8; ctx.fill();

    // シールド
    if (this.shielded) {
      ctx.beginPath(); ctx.arc(0, 0, this.r + 11, 0, TAU);
      ctx.strokeStyle = 'rgba(127,208,255,' + (0.5 + 0.3 * Math.sin(this.thruster * 0.4)) + ')';
      ctx.lineWidth = 2.5; ctx.shadowColor = '#7fd0ff'; ctx.shadowBlur = 14; ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------------- 弾 ----------------
export class Bullet {
  constructor(x, y, vx, vy, dmg, friendly) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.dmg = dmg; this.friendly = friendly;
    this.r = friendly ? 4 : 5;
    this.dead = false;
    this.life = 3;
  }
  update(dt, game) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < -20 || this.x > game.W + 20 || this.y < -20 || this.y > game.H + 20) this.dead = true;
  }
  render(ctx) {
    ctx.save();
    if (this.friendly) {
      ctx.fillStyle = '#bdeaff'; ctx.shadowColor = '#7fd0ff'; ctx.shadowBlur = 12;
      ctx.fillRect(this.x - 2, this.y - 8, 4, 14 * (this.dmg > 1 ? 1.4 : 1));
    } else {
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU);
      ctx.fillStyle = '#ff8a5c'; ctx.shadowColor = '#ff5a3c'; ctx.shadowBlur = 12; ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------- 敵(小惑星・彗星・はぐれ惑星・エイリアン) ----------------
const PLANET_COLORS = [['#c98b5a', '#7a4a26'], ['#6fb0e0', '#2b5a8a'], ['#d8c08a', '#9a7a3a'], ['#b86b6b', '#7a3a3a'], ['#8fd0a0', '#3a7a52']];

export class Enemy {
  constructor(kind, x, y, opt = {}) {
    this.kind = kind;
    this.x = x; this.y = y;
    this.dead = false;
    this.angle = rand(TAU);
    this.spin = rand(-1.5, 1.5);
    this.fireCd = rand(1, 2.5);
    this.t = 0;
    if (kind === 'asteroid') {
      this.r = opt.r ?? rand(16, 28);
      this.hp = this.maxHp = Math.round(this.r / 6);
      this.vx = rand(-40, 40); this.vy = rand(70, 130);
      this.score = 50;
      this.verts = Array.from({ length: 9 }, () => 0.7 + rand(0.6));
    } else if (kind === 'comet') {
      this.r = 12;
      this.hp = this.maxHp = 2;
      this.vx = opt.vx ?? rand(-60, 60); this.vy = rand(160, 230);
      this.score = 80;
      this.trail = [];
    } else if (kind === 'planet') {
      this.r = rand(30, 44);
      this.hp = this.maxHp = Math.round(this.r / 3);
      this.vx = rand(-25, 25); this.vy = rand(40, 70);
      this.score = 200;
      this.col = pick(PLANET_COLORS);
      this.ring = chance(0.5);
    } else if (kind === 'alien') {
      this.r = 18;
      this.hp = this.maxHp = 5;
      this.vx = rand(-30, 30); this.vy = rand(40, 70);
      this.score = 150;
      this.swing = rand(TAU);
    }
    // 難易度スケーリング: ウェーブが進むほど硬く・速くなる(なめらかな逓増)
    const d = opt.diff ?? 1;
    this.maxHp = this.hp = Math.max(this.hp, Math.ceil(this.hp * (0.7 + d * 0.3)));
    this.vy *= 1 + (d - 1) * 0.22;
    this.diff = d;
  }

  update(dt, game) {
    this.t += dt;
    this.angle += this.spin * dt;
    if (this.kind === 'alien') {
      this.swing += dt * 1.5;
      this.x += (this.vx + Math.sin(this.swing) * 60) * dt;
      this.y += this.vy * dt;
      this.fireCd -= dt;
      if (this.fireCd <= 0 && this.y < game.H * 0.7 && game.player && !game.over) {
        this.fireCd = rand(1.4, 2.6);
        const p = game.player;
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        const sp = 260;
        game.enemyBullets.push(new Bullet(this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp, 12, false));
      }
    } else if (this.kind === 'comet') {
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 10) this.trail.shift();
    } else {
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.x < this.r || this.x > game.W - this.r) this.vx *= -1;
    }
    if (this.y > game.H + this.r + 30) this.dead = true;
  }

  damage(amount, game) {
    this.hp -= amount;
    game.spawnHit(this.x, this.y);
    if (this.hp <= 0) this.onDeath(game);
  }

  onDeath(game) {
    this.dead = true;
    game.addScore(this.score);
    // 💎スターダストを落とす(集める快感 + 永続強化の通貨)
    const sd = this.kind === 'planet' ? 6 : this.kind === 'alien' ? 4 : this.kind === 'comet' ? 2 : 1;
    game.dropStardust(this.x, this.y, sd);
    game.float(this.x, this.y - this.r, '+' + Math.round(this.score * game.combo), '#cfe2ff', 13);
    const col = this.kind === 'comet' ? '#9fe0ff' : this.kind === 'planet' ? this.col[0] : this.kind === 'alien' ? '#a6ff9f' : '#d8b48a';
    game.spawnExplosion(this.x, this.y, col, this.kind === 'planet' ? 26 : 16, this.r / 18);
    Sfx.explode();
    // 小惑星は分裂
    if (this.kind === 'asteroid' && this.r > 20) {
      for (let i = 0; i < 2; i++) {
        const e = new Enemy('asteroid', this.x, this.y, { r: this.r * 0.55, diff: this.diff });
        e.vx = rand(-90, 90); e.vy = rand(60, 120);
        game.enemies.push(e);
      }
    }
    // ドロップ判定
    const dropP = this.kind === 'planet' ? 0.7 : this.kind === 'alien' ? 0.4 : 0.12;
    if (chance(dropP)) game.dropPowerUp(this.x, this.y);
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.kind === 'comet') {
      // 尾
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        const a = i / this.trail.length;
        ctx.beginPath(); ctx.arc(p.x - this.x, p.y - this.y, this.r * a * 0.8, 0, TAU);
        ctx.fillStyle = `rgba(159,224,255,${a * 0.4})`; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU);
      ctx.fillStyle = '#e8f7ff'; ctx.shadowColor = '#7fd0ff'; ctx.shadowBlur = 18; ctx.fill();
    } else if (this.kind === 'planet') {
      ctx.rotate(this.angle * 0.2);
      const g = ctx.createRadialGradient(-this.r * 0.3, -this.r * 0.3, this.r * 0.2, 0, 0, this.r);
      g.addColorStop(0, this.col[0]); g.addColorStop(1, this.col[1]);
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU);
      ctx.fillStyle = g; ctx.shadowColor = this.col[0]; ctx.shadowBlur = 16; ctx.fill();
      // 縞
      ctx.save(); ctx.clip(); ctx.globalAlpha = 0.25;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(0, i * this.r * 0.3, this.r, this.r * 0.12, 0, 0, TAU); ctx.fillStyle = '#000'; ctx.fill(); }
      ctx.restore();
      if (this.ring) {
        ctx.beginPath(); ctx.ellipse(0, 0, this.r * 1.6, this.r * 0.5, 0.4, 0, TAU);
        ctx.strokeStyle = 'rgba(230,220,180,0.6)'; ctx.lineWidth = 3; ctx.stroke();
      }
    } else if (this.kind === 'alien') {
      ctx.shadowColor = '#a6ff9f'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.ellipse(0, 2, this.r, this.r * 0.45, 0, 0, TAU);
      ctx.fillStyle = '#6fae6a'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, -3, this.r * 0.5, Math.PI, 0);
      ctx.fillStyle = '#cffac9'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, -4, 3, 0, TAU); ctx.fillStyle = '#1a3a18'; ctx.fill();
    } else { // asteroid
      ctx.rotate(this.angle);
      ctx.beginPath();
      for (let i = 0; i < this.verts.length; i++) {
        const a = (i / this.verts.length) * TAU;
        const rr = this.r * this.verts[i];
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#9a7a58'; ctx.shadowColor = '#3a2a18'; ctx.shadowBlur = 8; ctx.fill();
      ctx.strokeStyle = '#6a4f38'; ctx.lineWidth = 2; ctx.stroke();
    }
    // HP バー(複数HPの敵のみ)
    if (this.maxHp > 2 && this.hp < this.maxHp) {
      ctx.rotate(-this.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-this.r, -this.r - 9, this.r * 2, 4);
      ctx.fillStyle = '#ff6a6a'; ctx.fillRect(-this.r, -this.r - 9, this.r * 2 * (this.hp / this.maxHp), 4);
    }
    ctx.restore();
  }
}

// ---------------- パワーアップ ----------------
const POWER_ICONS = { double: '🔫', shield: '🛡️', heal: '💚', bomb: '💣', speed: '⚡' };
const POWER_COLORS = { double: '#ffd27f', shield: '#7fd0ff', heal: '#8fffa6', bomb: '#ff9b6a', speed: '#fff07f' };

export class PowerUp {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type; this.r = 14;
    this.vy = 90; this.t = 0; this.dead = false;
  }
  update(dt, game) {
    this.t += dt;
    this.x += Math.sin(this.t * 2) * 30 * dt;
    this.y += this.vy * dt;
    if (this.y > game.H + 30) this.dead = true;
  }
  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const c = POWER_COLORS[this.type];
    ctx.beginPath(); ctx.arc(0, 0, this.r + 2 + Math.sin(this.t * 4) * 2, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU);
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 16; ctx.fill();
    ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0; ctx.fillText(POWER_ICONS[this.type], 0, 1);
    ctx.restore();
  }
}

// ---------------- ボス(もしもシナリオ系) ----------------
// 5の倍数ウェーブで出現。3種をローテーション。
const BOSS_DEFS = [
  { id: 'asteroid', name: '☄️ 巨大小惑星 セレス', color: '#c9a06a', desc: 'もしも小惑星帯が崩れたら' },
  { id: 'jupiter', name: '⭐ 恒星化した木星', color: '#ff9a4a', desc: 'もしも木星が恒星になったら' },
  { id: 'blackhole', name: '🕳️ 暴走ブラックホール', color: '#b08fff', desc: 'もしも特異点が生まれたら' },
];

export class Boss {
  constructor(W, H, index, diff = 1) {
    this.def = BOSS_DEFS[index % BOSS_DEFS.length];
    this.tier = Math.floor(index / BOSS_DEFS.length); // 周回ごとに強化
    this.x = W / 2; this.y = -120;
    this.targetY = 130;
    this.r = 70;
    const base = (this.def.id === 'blackhole' ? 260 : 320) * (1 + this.tier * 0.6);
    this.maxHp = this.hp = Math.round(base * (1 + (diff - 1) * 0.35)); // ウェーブが進むほど硬い
    this.t = 0;
    this.fireCd = 2;
    this.phase = 0;
    this.dead = false;
    this.entering = true;
    this.dir = 1;
    this.kind = 'boss';
  }

  update(dt, game) {
    this.t += dt;
    if (this.entering) {
      this.y += (this.targetY - this.y) * Math.min(1, dt * 1.5);
      if (Math.abs(this.y - this.targetY) < 4) this.entering = false;
      return;
    }
    // 横移動
    this.x += this.dir * (70 + this.tier * 20) * dt;
    if (this.x < this.r) { this.x = this.r; this.dir = 1; }
    if (this.x > game.W - this.r) { this.x = game.W - this.r; this.dir = -1; }

    // ブラックホールはプレイヤーを引き寄せる
    if (this.def.id === 'blackhole' && game.player) {
      const p = game.player;
      const a = Math.atan2(this.y - p.y, this.x - p.x);
      const d = Math.hypot(this.x - p.x, this.y - p.y);
      const pull = clamp(9000 / (d + 60), 0, 120);
      p.tx += Math.cos(a) * pull * dt * 6;
      p.ty += Math.sin(a) * pull * dt * 6;
    }

    this.fireCd -= dt;
    if (this.fireCd <= 0 && game.player && !game.over) {
      this.attack(game);
    }
  }

  attack(game) {
    const p = game.player;
    const hpFrac = this.hp / this.maxHp;
    const rate = hpFrac < 0.4 ? 0.9 : 1.5;
    this.fireCd = rate;
    const shoot = (a, sp = 240, dmg = 14) =>
      game.enemyBullets.push(new Bullet(this.x, this.y + 30, Math.cos(a) * sp, Math.sin(a) * sp, dmg, false));

    if (this.def.id === 'asteroid') {
      // 自機狙い + 小惑星射出
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      for (let i = -1; i <= 1; i++) shoot(base + i * 0.18);
      if (chance(0.5)) { const e = new Enemy('asteroid', this.x, this.y + 40, { r: 18 }); e.vy = rand(120, 180); game.enemies.push(e); }
    } else if (this.def.id === 'jupiter') {
      // 放射状の弾幕
      const n = 14;
      const off = this.t;
      for (let i = 0; i < n; i++) shoot((i / n) * TAU + off, 200, 12);
    } else {
      // ブラックホール: 渦巻き弾
      const arms = 3;
      for (let i = 0; i < arms; i++) shoot(this.t * 2 + (i / arms) * TAU, 180, 12);
    }
  }

  damage(amount, game) {
    if (this.entering) return;
    this.hp -= amount;
    game.spawnHit(this.x + rand(-this.r, this.r), this.y + rand(-this.r, this.r));
    if (this.hp <= 0) this.onDeath(game);
  }

  onDeath(game) {
    this.dead = true;
    game.addScore(2000 * (1 + this.tier));
    game.dropStardust(this.x, this.y, 40 + this.tier * 20); // ボス撃破は💎大量
    game.float(this.x, this.y, 'BOSS DOWN!', '#ffd23a', 22);
    for (let i = 0; i < 6; i++) {
      setTimeout(() => game.spawnExplosion(this.x + rand(-this.r, this.r), this.y + rand(-this.r, this.r), this.def.color, 30, 3), i * 90);
    }
    Sfx.explodeBig();
    game.onBossDefeated();
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const c = this.def.color;
    if (this.def.id === 'blackhole') {
      // 降着円盤
      for (let i = 3; i >= 1; i--) {
        ctx.beginPath(); ctx.ellipse(0, 0, this.r * (0.7 + i * 0.4), this.r * (0.25 + i * 0.12), this.t, 0, TAU);
        ctx.strokeStyle = `rgba(176,143,255,${0.18 * i})`; ctx.lineWidth = 6; ctx.shadowColor = c; ctx.shadowBlur = 20; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, this.r * 0.6, 0, TAU);
      ctx.fillStyle = '#05030f'; ctx.shadowColor = '#7a4fff'; ctx.shadowBlur = 30; ctx.fill();
    } else if (this.def.id === 'jupiter') {
      const g = ctx.createRadialGradient(0, 0, 10, 0, 0, this.r);
      g.addColorStop(0, '#fff1c2'); g.addColorStop(0.6, '#ff9a4a'); g.addColorStop(1, '#b83a1a');
      ctx.beginPath(); ctx.arc(0, 0, this.r + Math.sin(this.t * 4) * 3, 0, TAU);
      ctx.fillStyle = g; ctx.shadowColor = '#ff8a3a'; ctx.shadowBlur = 40; ctx.fill();
    } else {
      ctx.rotate(this.t * 0.2);
      const g = ctx.createRadialGradient(-20, -20, 10, 0, 0, this.r);
      g.addColorStop(0, '#e8d0a8'); g.addColorStop(1, '#7a5a32');
      ctx.beginPath();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const rr = this.r * (0.85 + (i % 2) * 0.2); i === 0 ? ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = g; ctx.shadowColor = c; ctx.shadowBlur = 20; ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------- スターダスト(💎 通貨) ----------------
// 敵が落とす。プレイヤーに近づくと吸い寄せられ(マグネット強化で範囲拡大)、
// 触れると回収。集める手応えが「もう1回」を生む。
export class Crystal {
  constructor(x, y, value) {
    this.x = x; this.y = y; this.value = value;
    this.r = 6 + Math.min(6, value * 0.3);
    this.vx = rand(-50, 50); this.vy = rand(-40, 30);
    this.t = rand(TAU); this.dead = false; this.life = 12;
  }
  update(dt, game) {
    this.t += dt * 6;
    this.life -= dt;
    const p = game.player;
    if (p && !p.dead) {
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const range = 60 + (game.magnetRange || 0);
      if (d < range) {
        // 吸引
        const pull = 600 * (1 - d / range);
        this.vx += (dx / d) * pull * dt;
        this.vy += (dy / d) * pull * dt;
      }
      if (d < p.r + this.r + 4) { this.collect(game); return; }
    }
    this.vy += 120 * dt;        // ゆるい重力で落ちる
    this.vx *= 0.98;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.y > game.H + 30 || this.life <= 0) this.dead = true;
  }
  collect(game) {
    this.dead = true;
    game.collectStardust(this.value);
  }
  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.t * 0.3);
    const s = this.r + Math.sin(this.t) * 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, 0);
    ctx.closePath();
    ctx.fillStyle = '#9fe7ff'; ctx.shadowColor = '#5fd0ff'; ctx.shadowBlur = 14; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.fillStyle = '#eafaff'; ctx.fill();
    ctx.restore();
  }
}

export { BOSS_DEFS };
