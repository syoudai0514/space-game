// Capacitor 用の配布フォルダ www/ を組み立てる。
//
// このゲームはビルド工程のない素の Web アプリ(GitHub Pages はリポジトリ直下を配信)。
// Android パッケージだけは webDir として www/ を必要とするため、ここで
//   1. 静的アセット(index.html / css / js)を www/ にコピーし、
//   2. ネイティブ専用の起動スクリプト(将来の AdMob 初期化など)を esbuild で
//      バンドルして www/index.html にだけ差し込む。
// これにより Web 版(Pages)は一切変更せず、Android 版にだけネイティブ機能を足せる。

import { build } from 'esbuild';
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const www = resolve(root, 'www');

async function main() {
  await rm(www, { recursive: true, force: true });
  await mkdir(www, { recursive: true });

  // 静的アセットをそのままコピー
  for (const dir of ['css', 'js']) {
    await cp(resolve(root, dir), resolve(www, dir), { recursive: true });
  }

  // ネイティブ起動スクリプトをバンドル
  await build({
    entryPoints: [resolve(root, 'src/native/main.js')],
    bundle: true,
    format: 'iife',
    target: 'es2019',
    outfile: resolve(www, 'native.bundle.js'),
    logLevel: 'info',
  });

  // index.html にネイティブスクリプトを差し込んだものを www/ に出力
  let html = await readFile(resolve(root, 'index.html'), 'utf8');
  const tag = '  <script src="native.bundle.js"></script>\n';
  if (!html.includes('native.bundle.js')) {
    html = html.replace('</body>', tag + '</body>');
  }
  await writeFile(resolve(www, 'index.html'), html);

  console.log('✅ www/ を生成しました');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
