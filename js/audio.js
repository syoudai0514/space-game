// Web Audio API による手続き生成サウンド(音源ファイル不要・著作権フリー)。
//  - SFX: 発射・爆発・被弾・パワーアップ・ボス出現など
//  - BGM: 低いドローン + 鼓動するパルスで宇宙ラボの緊張感を出す
// ブラウザの自動再生制限のため、音は最初のユーザー操作(unlock)後に鳴る。

const SFX_KEY = 'mss-sfx';
const BGM_KEY = 'mss-bgm';

let ctx = null;
let master = null;     // 全体の音量
let sfxBus = null;     // 効果音バス
let musicBus = null;   // BGM バス
let unlocked = false;
let bgmNodes = null;   // 再生中の BGM ノード群
let bgmTimer = null;

export const sfxEnabled = () => { try { return localStorage.getItem(SFX_KEY) !== 'off'; } catch { return true; } };
export const bgmEnabled = () => { try { return localStorage.getItem(BGM_KEY) !== 'off'; } catch { return true; } };
const save = (k, on) => { try { localStorage.setItem(k, on ? 'on' : 'off'); } catch { /* ignore */ } };

function ensure() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9;
  sfxBus.connect(master);

  musicBus = ctx.createGain();
  musicBus.gain.value = 0.0;
  musicBus.connect(master);
}

// 最初のユーザージェスチャー内で呼ぶ。iOS 向けに無音を1回鳴らして解禁する。
export function unlock() {
  ensure();
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch { /* ignore */ }
  if (ctx.state === 'suspended') ctx.resume();
  unlocked = true;
}

function now() { return ctx.currentTime; }

// ---- 低レベル: 音色を1つ鳴らす ----
function tone({ type = 'sine', f0, f1, t = 0.15, vol = 0.3, bus = sfxBus, attack = 0.005, curve = 'exp' }) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  const t0 = now();
  o.frequency.setValueAtTime(f0, t0);
  if (f1 != null) {
    if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + t);
    else o.frequency.linearRampToValueAtTime(f1, t0 + t);
  }
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  o.connect(g).connect(bus);
  o.start(t0);
  o.stop(t0 + t + 0.02);
}

// ノイズバースト(爆発・ヒット用)
function noise({ t = 0.3, vol = 0.4, lp = 1200, hp = 60, bus = sfxBus }) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * t);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = lp;
  const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp;
  const g = ctx.createGain();
  const t0 = now();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  src.connect(hpf).connect(lpf).connect(g).connect(bus);
  src.start(t0);
}

// ---- 効果音 ----
export const Sfx = {
  shoot() { if (!sfxEnabled()) return; tone({ type: 'square', f0: 720, f1: 240, t: 0.08, vol: 0.10 }); },
  shootBig() { if (!sfxEnabled()) return; tone({ type: 'sawtooth', f0: 420, f1: 110, t: 0.14, vol: 0.16 }); },
  hit() { if (!sfxEnabled()) return; noise({ t: 0.08, vol: 0.18, lp: 2600, hp: 400 }); },
  explode() { if (!sfxEnabled()) return; noise({ t: 0.45, vol: 0.5, lp: 900 }); tone({ type: 'sine', f0: 180, f1: 40, t: 0.4, vol: 0.25 }); },
  explodeBig() { if (!sfxEnabled()) return; noise({ t: 0.9, vol: 0.6, lp: 700 }); tone({ type: 'sine', f0: 120, f1: 28, t: 0.8, vol: 0.35 }); },
  power() { if (!sfxEnabled()) return; tone({ type: 'triangle', f0: 520, f1: 1040, t: 0.18, vol: 0.22, curve: 'lin' }); tone({ type: 'triangle', f0: 780, f1: 1560, t: 0.22, vol: 0.16, curve: 'lin' }); },
  playerHit() { if (!sfxEnabled()) return; noise({ t: 0.35, vol: 0.5, lp: 1400 }); tone({ type: 'sawtooth', f0: 300, f1: 60, t: 0.35, vol: 0.3 }); },
  shield() { if (!sfxEnabled()) return; tone({ type: 'sine', f0: 300, f1: 900, t: 0.3, vol: 0.2, curve: 'lin' }); },
  bomb() { if (!sfxEnabled()) return; noise({ t: 1.1, vol: 0.7, lp: 1600 }); tone({ type: 'sine', f0: 90, f1: 24, t: 1.0, vol: 0.4 }); },
  bossWarn() { if (!sfxEnabled()) return; tone({ type: 'sawtooth', f0: 110, f1: 110, t: 0.5, vol: 0.3 }); tone({ type: 'sawtooth', f0: 110, f1: 165, t: 0.5, vol: 0.2, curve: 'lin' }); },
  levelUp() { if (!sfxEnabled()) return; [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone({ type: 'triangle', f0: f, f1: f, t: 0.18, vol: 0.2 }), i * 90)); },
  gameOver() { if (!sfxEnabled()) return; [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone({ type: 'sawtooth', f0: f, f1: f * 0.98, t: 0.4, vol: 0.25 }), i * 220)); },
  ui() { if (!sfxEnabled()) return; tone({ type: 'square', f0: 600, f1: 600, t: 0.04, vol: 0.08 }); },
};

// ---- BGM: ドローン + 鼓動パルス ----
function startDrone() {
  if (!ctx || bgmNodes) return;
  const base = 55; // A1
  const oscs = [];
  [1, 1.5, 2, 3.01].forEach((mul, i) => {
    const o = ctx.createOscillator();
    o.type = i === 3 ? 'sine' : 'sawtooth';
    o.frequency.value = base * mul;
    const g = ctx.createGain();
    g.gain.value = i === 0 ? 0.16 : 0.06;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    o.connect(g).connect(lp).connect(musicBus);
    o.start();
    oscs.push(o);
  });
  // ゆっくり呼吸するフィルター感を LFO で
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.04;
  lfo.connect(lfoG).connect(musicBus.gain);
  lfo.start();
  oscs.push(lfo);

  // 鼓動するパルス
  bgmTimer = setInterval(() => {
    if (!bgmEnabled()) return;
    tone({ type: 'sine', f0: 110, f1: 55, t: 0.5, vol: 0.07, bus: musicBus });
  }, 1400);

  bgmNodes = oscs;
}

export function startBgm() {
  if (!ctx || !bgmEnabled()) return;
  startDrone();
  musicBus.gain.cancelScheduledValues(now());
  musicBus.gain.linearRampToValueAtTime(0.5, now() + 2);
}

export function stopBgm(fade = 1.2) {
  if (!ctx || !musicBus) return;
  musicBus.gain.cancelScheduledValues(now());
  musicBus.gain.linearRampToValueAtTime(0.0, now() + fade);
}

export function toggleSfx() { const on = !sfxEnabled(); save(SFX_KEY, on); if (on) Sfx.ui(); return on; }
export function toggleBgm() {
  const on = !bgmEnabled(); save(BGM_KEY, on);
  if (on) startBgm(); else stopBgm();
  return on;
}
export const isUnlocked = () => unlocked;
