/**
 * ST 扩展打包脚本：esbuild 把 src/index.ts（含 core 依赖）打成单文件 IIFE。
 *
 * 产物直接输出到仓库根目录，使整个仓库本身就是一个标准 ST 扩展：
 * - /index.js    （打包后的扩展脚本，manifest.json 引用）
 * - /style.css   （st-extension/style.css + core/phone-shell.css 拼接）
 *
 * 这样 SillyTavern 可以直接通过 GitHub 链接安装：
 *   https://github.com/LYC619/st-stage
 *
 * 用法：node st-extension/build.mjs
 * 注意：产物需要提交到 git，ST 安装时才能拿到。
 */

import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(dir, '..')

await build({
  entryPoints: [path.join(dir, 'src/index.ts')],
  outfile: path.join(root, 'index.js'),
  bundle: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  minify: false,
  charset: 'utf8',
  logLevel: 'info',
})

// style.css = 扩展基础样式 + 双端共用的手机框架样式
const baseCss = readFileSync(path.join(dir, 'style.css'), 'utf8')
const phoneCss = readFileSync(path.join(root, 'core/phone-shell.css'), 'utf8')
writeFileSync(path.join(root, 'style.css'), `${baseCss}\n${phoneCss}`)

console.log('[build] 根目录 index.js / style.css 已生成（记得提交到 git）')
