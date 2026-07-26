// ===== 全世界ランキング(Supabase)設定 =====
//
// ここに Supabase プロジェクトの「Project URL」と「anon public キー」を貼るだけで
// 全世界ランキングが有効になります(未設定の間は自動的にこの端末内ランキングで動作)。
//
// 取得手順は SUPABASE_SETUP.md を参照。
//   1. https://supabase.com で無料プロジェクトを作成
//   2. SUPABASE_SETUP.md の SQL を実行(テーブルとセキュリティ設定)
//   3. Settings → API から URL と anon key をコピーして下に貼る
//
// ⚠ anon key は「公開してよい」キーです(RLSで書き込みは追記のみに制限)。
//    リポジトリに置いても安全に設計されています。
//
export const SUPABASE_URL = '';       // 例: 'https://abcdefgh.supabase.co'
export const SUPABASE_ANON_KEY = '';  // 例: 'eyJhbGciOiJI...'(長い文字列)

// 設定済みかどうか(両方が埋まっていればオンライン)
export const hasSupabase = () =>
  /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;
