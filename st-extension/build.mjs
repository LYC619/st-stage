/**
 * ST 扩展打包脚本（十一期·热更新三段式）：
 *
 * 产物（全部在仓库根目录，必须提交 git，ST 通过 GitHub 链接安装/auto_update 分发）：
 * - /index.js     加载器 stub —— 字节跨版本稳定（被浏览器缓存无害），manifest 锁定的入口
 * - /bundle.js    真实扩展代码（esbuild 单文件 ESM，含 core 依赖）
 * - /version.json 版本探针 { v: "版本+构建时间" }，stub 用 cache:no-store 读取
 * - /style.css    st-extension/style.css + core/phone-shell.css 拼接
 *
 * 热更新原理：stub 每次加载时以 no-store 拉 version.json，再 import(bundle.js?v=版本)
 * —— git pull 更新 version.json 后，旧浏览器缓存的 bundle 因 URL 变化自动失效。
 * CSS 同理：stub 追加一条带 ?v= 的 <link>，后加载者覆盖 manifest 那条缓存副本。
 *
 * bundle 用 ESM 格式：无顶层 export 的副作用模块，import() 直接执行；
 * 将来按 App 做代码分割（esbuild splitting 仅支持 esm）无需再改加载链路。
 *
 * 用法：node st-extension/build.mjs
 */

import { build } from 'esbuild'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { buildVersion, resolveBuildTime } from './build-time.mjs'

const moduleFile = fileURLToPath(import.meta.url)
const defaultExtensionDir = path.dirname(moduleFile)
const defaultSourceRoot = path.join(defaultExtensionDir, '..')

export async function buildExtension({
  sourceRoot = defaultSourceRoot,
  outputRoot = sourceRoot,
  env = process.env,
  now = new Date(),
  logLevel = 'info',
  log = console.log,
} = {}) {
  const buildTime = resolveBuildTime(env, now)
  mkdirSync(outputRoot, { recursive: true })
  const extensionDir = path.join(sourceRoot, 'st-extension')
  // 版本与构建时间注入：让「加载的是哪一版」在设置面板/控制台一眼可见，
  // 排查"改了没生效"时可 5 秒区分 没构建/没提交/真缓存
  const manifest = JSON.parse(readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8'))
  const version = buildVersion(manifest.version ?? '0.0.0', buildTime)

  await build({
    entryPoints: [path.join(extensionDir, 'src/index.ts')],
    outfile: path.join(outputRoot, 'bundle.js'),
    bundle: true,
    format: 'esm',
    target: 'es2020',
    platform: 'browser',
    minify: false,
    charset: 'utf8',
    logLevel,
    define: {
      __EXT_VERSION__: JSON.stringify(manifest.version ?? '0.0.0'),
      __BUILD_TIME__: JSON.stringify(buildTime),
    },
  })

  // 版本探针：stub 以 cache:no-store 读取，作为 bundle/css 的缓存破坏参数
  writeFileSync(path.join(outputRoot, 'version.json'), `${JSON.stringify({ v: version })}\n`)

  // 加载器 stub：内容与版本无关，字节稳定 —— 千万不要往这里写版本号/时间戳，
  // 否则 stub 自身又会遇到"被缓存的旧 stub"问题，热更新失效
  const stub = `/* st-stage 加载器（构建产物，勿手改；源头 st-extension/build.mjs）
 * 字节跨版本稳定：被浏览器缓存无害。真实代码在 bundle.js，
 * 通过 version.json（no-store）拿版本号拼 ?v= 破缓存。 */
;(function () {
  function baseUrl() {
    try {
      var m = (new Error().stack || '').match(/(https?:\\/\\/[^\\s)]+?)\\/index\\.js/)
      if (m) return m[1]
    } catch (e) { /* 老内核 stack 格式异常时走回退 */ }
    return '/scripts/extensions/third-party/st-stage'
  }
  var base = baseUrl()
  fetch(base + '/version.json', { cache: 'no-store' })
    .then(function (r) { return r.json() })
    .then(function (j) { return j && j.v ? String(j.v) : '' })
    .catch(function () { return '' })
    .then(function (v) {
      try {
        document.querySelectorAll('link[data-st-stage-style]').forEach(function (node) { node.remove() })
        var link = document.createElement('link')
        link.rel = 'stylesheet'
        link.setAttribute('data-st-stage-style', '')
        link.href = base + '/style.css?v=' + encodeURIComponent(v || Date.now())
        document.head.appendChild(link)
      } catch (e) { /* css 破缓存失败不阻塞脚本加载 */ }
      var url = base + '/bundle.js' + (v ? '?v=' + encodeURIComponent(v) : '')
      return import(url).catch(function (err) {
        console.error('[st-stage] 带版本参数加载失败，回退直接加载 bundle.js', err)
        return import(base + '/bundle.js')
      })
    })
    .catch(function (err) {
      console.error('[st-stage] 扩展加载失败', err)
    })
})()
`
  writeFileSync(path.join(outputRoot, 'index.js'), stub)

  // style.css = 扩展基础样式 + 双端共用的手机框架样式
  const baseCss = readFileSync(path.join(extensionDir, 'style.css'), 'utf8')
  const phoneCss = readFileSync(path.join(sourceRoot, 'core/phone-shell.css'), 'utf8')
  writeFileSync(path.join(outputRoot, 'style.css'), `${baseCss}\n${phoneCss}`)

  if (path.resolve(outputRoot) !== path.resolve(sourceRoot)) {
    copyFileSync(path.join(sourceRoot, 'manifest.json'), path.join(outputRoot, 'manifest.json'))
    copyFileSync(
      path.join(extensionDir, 'distribution-readme.md'),
      path.join(outputRoot, 'README.md'),
    )
  }

  log(`[build] ${version} → index.js(stub) / bundle.js / version.json / style.css（全部需提交 git）`)
  return { buildTime, version }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(moduleFile)) {
  const outputFlag = process.argv.indexOf('--output-root')
  if (outputFlag >= 0 && !process.argv[outputFlag + 1]) {
    throw new Error('用法：node st-extension/build.mjs [--output-root <directory>]')
  }
  const outputRoot = outputFlag >= 0
    ? path.resolve(process.cwd(), process.argv[outputFlag + 1])
    : defaultSourceRoot
  await buildExtension({ outputRoot })
}
