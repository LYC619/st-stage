/**
 * ST 扩展打包脚本：esbuild 把 src/index.ts（含 core 依赖）打成单文件 IIFE。
 * 用法：node st-extension/build.mjs
 * 产物：st-extension/dist/index.js
 */

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))

await build({
  entryPoints: [path.join(dir, 'src/index.ts')],
  outfile: path.join(dir, 'dist/index.js'),
  bundle: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  minify: false,
  charset: 'utf8',
  logLevel: 'info',
})

console.log('[build] st-extension/dist/index.js 已生成')
