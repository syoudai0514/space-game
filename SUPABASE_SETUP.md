# 全世界ランキングのセットアップ（Supabase）

このゲームの「🏆 世界ランキング」を有効にする手順です。**約5分**で完了します。
未設定でもゲームは普通に動き、ランキングは「この端末内の記録」で表示されます。
設定を入れた瞬間から、全世界のプレイヤーとスコアを競えるようになります。

---

## 1. Supabase プロジェクトを作る（無料）

1. https://supabase.com にアクセスして「Start your project」からサインアップ（GitHubアカウントでOK）
2. 「New project」を作成
   - Name: 任意（例: `moshimo-space-shooter`）
   - Database Password: 自動生成でOK（使いません）
   - Region: `Northeast Asia (Tokyo)` を選ぶと日本から速い
3. 作成完了まで1〜2分待つ

---

## 2. テーブルとセキュリティを作る（SQLを1回実行するだけ）

左メニューの **SQL Editor** を開き、下のSQLを丸ごと貼り付けて **Run** を押します。

```sql
-- ランキング用テーブル
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text        not null,
  score      integer     not null,
  wave       integer     not null default 0,
  created_at timestamptz not null default now(),
  -- 明らかに不正な値をDB側で弾く簡易ガード
  constraint score_range check (score >= 0 and score <= 100000000),
  constraint wave_range  check (wave  >= 0 and wave  <= 100000),
  constraint name_len    check (char_length(name) between 1 and 12)
);

-- 並び替えを速くするインデックス
create index if not exists scores_score_idx      on public.scores (score desc);
create index if not exists scores_created_at_idx on public.scores (created_at desc);

-- 行レベルセキュリティを有効化（デフォルトで全操作を拒否にする）
alter table public.scores enable row level security;

-- 誰でも「読み取り」できる
create policy "anyone can read scores"
  on public.scores for select
  to anon
  using (true);

-- 誰でも「追記（insert）」だけできる。更新・削除は許可しない＝改ざん不可。
create policy "anyone can insert scores"
  on public.scores for insert
  to anon
  with check (
    score >= 0 and score <= 100000000
    and wave >= 0 and wave <= 100000
    and char_length(name) between 1 and 12
  );
```

> 🔒 **なぜ anon キーを公開してよいのか**
> このSQLで「読み取り」と「追記」だけを許可し、更新・削除は一切できない設定にしています。
> anon キーが漏れても、他人のスコアを書き換えたり消したりはできません。だからキーを
> フロントエンド（`js/config.js`）に書いてリポジトリに公開しても安全です。

---

## 3. URL と anon キーを取得して貼る

1. 左メニュー **Project Settings（⚙）→ API** を開く
2. 次の2つをコピー:
   - **Project URL**（例: `https://abcdefgh.supabase.co`）
   - **Project API keys** の **`anon` `public`**（`eyJ...` で始まる長い文字列）
3. `js/config.js` を開いて貼り付ける:

```js
export const SUPABASE_URL = 'https://abcdefgh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJI...ここに長いキー...';
```

4. 保存して、変更をコミット＆プッシュ（GitHub Pages / アプリに反映）

これで完了です。タイトル画面の「🏆 世界ランキング」を開くと全世界のスコアが表示され、
ゲームオーバー画面から自分のスコアを登録できます。

---

## 動作の仕組み（開発メモ）

- 送信/取得は `js/leaderboard.js` が Supabase の REST API に `fetch` で直接アクセス（ビルド不要）。
- `js/config.js` が未設定なら自動で「オフライン（端末内）ランキング」にフォールバック。
- 表示は「全期間」と「24時間」の2タブ。自分の記録は色付きでハイライト。
- 全ての通信はタイムアウト付き（8秒）で、失敗してもゲームは固まりません。

## もっと厳密な不正対策をしたい場合（任意・上級）

クライアントから直接送るため、本気の改ざん（偽のスコアをPOST）までは防げません。
casual なゲームでは上記の追記のみRLSで十分ですが、さらに固めたい場合は:

- **Supabase Edge Function** を1枚挟み、サーバー側で「1回のプレイで到達可能な上限」などを
  検証してから insert する（フロントからはテーブルへ直接insertさせない）。
- レート制限（同一IP/短時間の大量送信を弾く）を Edge Function 側で実装。
- 送信時に簡易な署名トークンを載せ、ボット的な直接POSTを弾く。

必要になったら実装できるので、その時に声をかけてください。
