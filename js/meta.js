// 永続メタデータ(localStorage)。スターダスト通貨と機体の永続アップグレードを管理。
// 「何度も遊ぶ理由」= 死んでも💎が貯まり、機体が恒久的に強くなる中毒ループの中核。

const KEY = 'mss-meta';

const DEFAULT = {
  stardust: 0,        // 所持スターダスト(通貨)
  bestWave: 0,        // 自己ベスト到達ウェーブ
  bestScore: 0,
  runs: 0,            // 総プレイ回数
  upg: {},            // アップグレード Lv
};

// アップグレード定義。cost[i] = Lv i→i+1 の費用。
export const UPGRADES = [
  { id: 'health', icon: '🛡️', name: '装甲', desc: '最大装甲 +20', cost: [50, 120, 250, 450, 700] },
  { id: 'fireRate', icon: '🔥', name: '連射', desc: '連射速度 +8%', cost: [60, 150, 300, 520, 820] },
  { id: 'weapon', icon: '🔫', name: '初期武装', desc: 'スタート時のショットLv +1', cost: [120, 300, 600, 1000] },
  { id: 'bomb', icon: '💣', name: '初期ボム', desc: 'スタート時のボム +1', cost: [80, 200, 380, 650] },
  { id: 'magnet', icon: '🧲', name: '回収', desc: '💎の回収範囲を拡大', cost: [40, 100, 200, 350, 550] },
  { id: 'revive', icon: '❤️‍🔥', name: 'リバイブ', desc: '1ラン中の無料復活 +1', cost: [350, 900] },
];
const MAXLV = Object.fromEntries(UPGRADES.map((u) => [u.id, u.cost.length]));

let data = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULT, ...raw, upg: { ...raw.upg } };
  } catch { return { ...DEFAULT, upg: {} }; }
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ } }

export const get = () => data;
export const stardust = () => data.stardust;
export const level = (id) => data.upg[id] || 0;
export const maxLevel = (id) => MAXLV[id];
export const isMax = (id) => level(id) >= MAXLV[id];
export const cost = (id) => (isMax(id) ? Infinity : UPGRADES.find((u) => u.id === id).cost[level(id)]);
export const canBuy = (id) => !isMax(id) && data.stardust >= cost(id);

export function buy(id) {
  if (!canBuy(id)) return false;
  data.stardust -= cost(id);
  data.upg[id] = level(id) + 1;
  save();
  return true;
}

export function addStardust(n) { data.stardust += Math.max(0, Math.round(n)); save(); }
export function recordRun(wave, score) {
  data.runs++;
  data.bestWave = Math.max(data.bestWave, wave);
  data.bestScore = Math.max(data.bestScore, score);
  save();
}

// ラン開始時にプレイヤーへ与えるボーナス
export function bonuses() {
  return {
    maxHealth: 100 + level('health') * 20,
    fireRateMul: Math.pow(0.92, level('fireRate')),
    startWeapon: Math.min(5, 1 + level('weapon')),
    startBombs: 1 + level('bomb'),
    magnetRange: level('magnet') * 34,
    freeRevives: level('revive'),
  };
}
