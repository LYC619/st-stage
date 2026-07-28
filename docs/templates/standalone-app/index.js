/* st-stage 独立 App 模板（骰子示例）。
 * 整个扩展只做一件事：把 App 对象 push 进 st-stage 的注册队列。
 * 加载顺序无关：st-stage 晚于本扩展就绪也能收到（就绪时统一注册积压）。
 * App 契约与 ctx 能力层（事件/注入/toast/弹窗，自动回收）见 st-stage 仓库 docs/APP-SPEC.md。 */
;(window.stStageQueue ||= []).push({
  id: 'dice-roller', // 全局唯一：小写字母开头，字母/数字/连字符，2–32 字符 → 改成你的
  name: '骰子', // Home 屏名称，建议 ≤ 4 个汉字
  icon: '🎲', // 单个 emoji
  order: 50, // Home 屏排序，小的在前（内置 App 占 1–20）

  // 常驻层（可选，st-stage ≥ 0.9）：注册后调用一次，手机没打开也在工作。
  // host 上的订阅由平台自动回收——不用手工退订，也不用写 dispose。
  setup(host) {
    if (typeof host.onMessageReceived !== 'function') return // 老版 st-stage：无能力层，静默降级
    host.injectPrompt('（骰子扩展在场：剧情需要检定时，你可以让角色提议掷一次 d20。）')
    host.onMessageReceived((text) => {
      if (text.includes('骰') || text.toLowerCase().includes('d20')) {
        host.toast('info', 'AI 提到了骰子——打开「骰子」App 掷一把')
      }
    })
  },

  // UI 层：打开 App 时调用；经 ctx 建立的订阅/定时器在离开时自动回收
  mount(container, ctx) {
    const btn = document.createElement('div')
    btn.className = 'menu_button so-app-btn'
    const last = ctx.getAppData()?.last
    btn.textContent = last ? `d20 → ${last}` : '掷 d20'
    btn.addEventListener('click', () => {
      const result = 1 + Math.floor(Math.random() * 20)
      ctx.setAppData({ last: result }) // 私有存储：持久化但不触发立绘刷新
      btn.textContent = `d20 → ${result}`
    })
    container.append(btn)
  },
  // 只挂 DOM、订阅全走 ctx 的 App 不需要 unmount
})
