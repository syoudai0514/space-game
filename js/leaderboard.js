// 全世界ランキング。Supabase の REST API に直接 fetch でアクセスする(ビルド不要)。
//
// 設計:
//  - config.js が未設定なら「オフライン(この端末内)ランキング」に自動フォールバック。
//    → 遊ぶ人は Supabase を用意しなくてもランキングUIを体験でき、設定すれば即・全世界に繋がる。
//  - プレイヤー名は localStorage に保存し、次回以降そのまま使う。
//  - 送信・取得はすべてタイムアウト付き。通信が詰まってもゲームが固まらないようにする。

import { SUPABASE_URL, SUPABASE_ANON_KEY, hasSupabase } from './config.js';

const NAME_KEY = 'mss-name';
const LOCAL_KEY = 'mss-lb-local';   // オフライン時 / 自分の記録キャッシュ
const TABLE = 'scores';
const TIMEOUT = 8000;

export const isOnline = () => hasSupabase();

// ---------- プレイヤー名 ----------
export function getName() {
  try {
    const n = (localStorage.getItem(NAME_KEY) || '').trim();
    return n || defaultName();
  } catch { return defaultName(); }
}
export function setName(name) {
  const clean = sanitizeName(name);
  try { localStorage.setItem(NAME_KEY, clean); } catch { /* ignore */ }
  return clean;
}
export function sanitizeName(name) {
  let s = (name || '').replace(/[\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim();
  // 絵文字も1文字ずつ数えて最大12文字
  const arr = Array.from(s);
  if (arr.length > 12) s = arr.slice(0, 12).join('');
  return s || defaultName();
}
function defaultName() {
  return 'パイロット' + Math.floor(1000 + Math.random() * 9000);
}

// ---------- オフライン/自分の記録キャッシュ ----------
function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}
function saveLocal(list) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 50))); } catch { /* ignore */ }
}

function pushLocal(entry) {
  const list = loadLocal();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  saveLocal(list);
}

// ---------- fetch ヘルパー(タイムアウト付き) ----------
async function sbFetch(path, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- スコア送信 ----------
// 戻り値: { ok, online, rank(全期間の順位/取れれば), error }
export async function submitScore({ name, score, wave }) {
  const clean = sanitizeName(name);
  setName(clean);
  const entry = { name: clean, score: Math.max(0, Math.round(score)), wave: Math.max(0, Math.round(wave)), ts: Date.now(), mine: true };

  // 端末内キャッシュには常に残す(オフライン一覧 & 自分ハイライト用)
  pushLocal(entry);

  if (!isOnline()) return { ok: true, online: false };

  try {
    const res = await sbFetch(TABLE, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ name: entry.name, score: entry.score, wave: entry.wave }),
    });
    if (!res.ok) {
      return { ok: false, online: true, error: 'HTTP ' + res.status };
    }
    let rank = null;
    try { rank = await getRank(entry.score); } catch { /* 順位は取れなくても致命的ではない */ }
    return { ok: true, online: true, rank };
  } catch (e) {
    return { ok: false, online: true, error: e.name === 'AbortError' ? 'timeout' : 'network' };
  }
}

// 自分より高いスコアの件数 + 1 = 全世界順位
async function getRank(score) {
  const res = await sbFetch(`${TABLE}?select=id&score=gt.${score}`, {
    method: 'GET',
    headers: { Prefer: 'count=exact', Range: '0-0' },
  });
  const cr = res.headers.get('content-range') || '';       // 例: "0-0/1234"
  const total = parseInt(cr.split('/')[1], 10);
  return Number.isFinite(total) ? total + 1 : null;
}

// ---------- ランキング取得 ----------
// period: 'all' | 'daily'。戻り値: { online, rows: [{name,score,wave,mine}], error }
export async function fetchTop(period = 'all', limit = 100) {
  if (!isOnline()) {
    const rows = loadLocal()
      .filter((e) => period === 'all' || e.ts >= Date.now() - 86400000)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((e) => ({ name: e.name, score: e.score, wave: e.wave, mine: true }));
    return { online: false, rows };
  }

  try {
    let path = `${TABLE}?select=name,score,wave,created_at&order=score.desc&limit=${limit}`;
    if (period === 'daily') {
      const since = new Date(Date.now() - 86400000).toISOString();
      path += `&created_at=gte.${since}`;
    }
    const res = await sbFetch(path, { method: 'GET' });
    if (!res.ok) return { online: true, rows: [], error: 'HTTP ' + res.status };
    const data = await res.json();
    const mine = mineSet();
    const rows = data.map((r) => ({
      name: r.name, score: r.score, wave: r.wave,
      mine: mine.has(r.name + '|' + r.score),
    }));
    return { online: true, rows };
  } catch (e) {
    return { online: true, rows: [], error: e.name === 'AbortError' ? 'timeout' : 'network' };
  }
}

// 自分が送ったスコアを (名前|スコア) の集合にして、一覧内の自分の行をハイライトするのに使う
function mineSet() {
  const s = new Set();
  for (const e of loadLocal()) s.add(e.name + '|' + e.score);
  return s;
}
