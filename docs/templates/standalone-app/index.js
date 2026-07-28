/* st-stage 独立 App 模板（骰子示例）。
 * 整个扩展只做一件事：把 App 对象 push 进 st-stage 的注册队列。
 * 加载顺序无关：st-stage 晚于本扩展就绪也能收到（就绪时统一注册积压）。
 * App 契约（mount/unmount/ctx/样式类/安全红线）见 st-stage 仓库 docs/APP-SPEC.md。 */
;(window.stStageQueue ||= []).push({
  id: 'dice-roller', // 全局唯一：小写字母开头，字母/数字/连字符，2–32 字符 → 改成你的
  name: '骰子', // Home 屏名称，建议 ≤ 4 个汉字
  icon: '🎲', // 单个 emoji
  order: 50, // Home 屏排序，小的在前（内置 App 占 1–20）
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
  unmount() {
    // 在这里清掉你起的定时器 / window 级监听；只挂 DOM 的 App 可整个删掉本方法
  },
})
