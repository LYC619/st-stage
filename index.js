/* st-stage 加载器（构建产物，勿手改；源头 st-extension/build.mjs）
 * 字节跨版本稳定：被浏览器缓存无害。真实代码在 bundle.js，
 * 通过 version.json（no-store）拿版本号拼 ?v= 破缓存。 */
;(function () {
  function baseUrl() {
    try {
      var m = (new Error().stack || '').match(/(https?:\/\/[^\s)]+?)\/index\.js/)
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
        var link = document.createElement('link')
        link.rel = 'stylesheet'
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
