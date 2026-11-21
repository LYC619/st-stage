/* st-stage 加载器（构建产物，勿手改；源头 st-extension/build.mjs）
 * 字节跨版本稳定：被浏览器缓存无害。真实代码在 bundle.js，
 * 通过 version.json（no-store）拿版本号拼 ?v= 破缓存。 */
;(function () {
  function stripQuery(url) {
    return String(url || '').split(/[?#]/)[0]
  }
  function dirOf(url, suffix) {
    var clean = stripQuery(url)
    if (clean.length > suffix.length && clean.slice(-suffix.length) === suffix) {
      return clean.slice(0, -suffix.length)
    }
    return ''
  }
  function pickExtensionDir(candidates, allowLatest) {
    var ext = []
    for (var i = 0; i < candidates.length; i++) {
      var item = candidates[i]
      if (item && /\/extensions\/(?:third-party\/)?[^/]+$/i.test(item)) ext.push(item)
    }
    if (ext.length === 1) return ext[0]
    for (var j = ext.length - 1; j >= 0; j--) {
      if (/\/st-stage-ext$/i.test(ext[j])) return ext[j]
    }
    for (var k = ext.length - 1; k >= 0; k--) {
      if (/\/st-stage$/i.test(ext[k])) return ext[k]
    }
    if (allowLatest && ext.length > 0) return ext[ext.length - 1]
    return candidates.length === 1 ? candidates[0] : ''
  }
  function baseUrl() {
    try {
      var current = typeof document !== 'undefined' && document.currentScript && document.currentScript.src
      var fromCurrent = dirOf(current, '/index.js')
      if (fromCurrent) return fromCurrent
    } catch (e) { /* 忽略 currentScript 异常 */ }
    try {
      var stack = String(new Error().stack || '')
      var m = stack.match(/((?:https?:\/\/|file:\/\/|\/)[^\s)'"]+?)\/index\.js(?:[?#:)\s]|$)/)
      if (m) return m[1]
    } catch (e) { /* 老内核 stack 格式异常时继续尝试其他来源 */ }
    try {
      if (typeof document !== 'undefined' && document.querySelectorAll) {
        var scripts = []
        document.querySelectorAll('script[src]').forEach(function (node) {
          var dir = dirOf(node.getAttribute('src') || node.src, '/index.js')
          if (dir) scripts.push(dir)
        })
        var fromScript = pickExtensionDir(scripts, false)
        if (fromScript) return fromScript
        var links = []
        document.querySelectorAll('link[rel="stylesheet"][href]:not([data-st-stage-style])').forEach(function (node) {
          var dir = dirOf(node.getAttribute('href') || node.href, '/style.css')
          if (dir) links.push(dir)
        })
        var fromLink = pickExtensionDir(links, false)
        if (fromLink) return fromLink
      }
    } catch (e) { /* 忽略 DOM 扫描异常 */ }
    try {
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        var entries = performance.getEntriesByType('resource') || []
        var resources = []
        for (var i = 0; i < entries.length; i++) {
          var dir = dirOf(entries[i] && entries[i].name, '/index.js')
          if (dir) resources.push(dir)
        }
        var fromPerf = pickExtensionDir(resources, true)
        if (fromPerf) return fromPerf
      }
    } catch (e) { /* 忽略 Resource Timing 异常 */ }
    return ''
  }
  var base = baseUrl()
  if (!base) {
    console.error('[st-stage] 无法解析扩展加载路径，已中止加载')
    return
  }
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
