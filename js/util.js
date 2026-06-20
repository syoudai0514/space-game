// 汎用ヘルパー(乱数・ベクトル・補間など)。依存なし。

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const chance = (p) => Math.random() < p;

export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// 円どうしの当たり判定
export const hitCircle = (ax, ay, ar, bx, by, br) => dist2(ax, ay, bx, by) <= (ar + br) * (ar + br);

// 角度を保ったまま値を近づける(イージング)
export const approach = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// 数値をカンマ区切りに
export const fmt = (n) => Math.floor(n).toLocaleString('en-US');

// 簡易シェイク用の擬似ノイズ
export const shake = (mag) => (Math.random() * 2 - 1) * mag;
