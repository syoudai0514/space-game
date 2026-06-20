// 視差スクロールする星空 + ぼんやり光る星雲。ゲームの背景レイヤー。
import { TAU, rand, pick } from './util.js';

export class Starfield {
  constructor(W, H) {
    this.resize(W, H);
  }
  resize(W, H) {
    this.W = W; this.H = H;
    const count = Math.round((W * H) / 4500);
    this.stars = Array.from({ length: count }, () => ({
      x: rand(W), y: rand(H),
      z: rand(0.3, 1),        // 奥行き(速度・サイズ)
      tw: rand(TAU),          // またたき位相
    }));
    this.nebulae = Array.from({ length: 4 }, () => ({
      x: rand(W), y: rand(H), r: rand(120, 280),
      c: pick(['rgba(60,90,180,0.10)', 'rgba(120,60,160,0.10)', 'rgba(40,120,150,0.08)']),
      vy: rand(6, 16),
    }));
  }
  update(dt, speed = 1) {
    for (const s of this.stars) {
      s.y += s.z * 40 * speed * dt;
      s.tw += dt * 3;
      if (s.y > this.H) { s.y = -2; s.x = rand(this.W); }
    }
    for (const n of this.nebulae) {
      n.y += n.vy * dt;
      if (n.y - n.r > this.H) { n.y = -n.r; n.x = rand(this.W); }
    }
  }
  render(ctx) {
    // 星雲
    for (const n of this.nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, n.c); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    // 星
    for (const s of this.stars) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(s.tw)) * s.z;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#dfe9ff';
      const sz = s.z * 1.8;
      ctx.fillRect(s.x, s.y, sz, sz);
    }
    ctx.globalAlpha = 1;
  }
}
