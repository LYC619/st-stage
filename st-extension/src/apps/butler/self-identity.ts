/**
 * 运行时自我识别：算出本扩展自己的安装目录名。
 *
 * 为什么不能写死 'st-stage'：SillyTavern 的扩展目录名等于仓库名，而目录名是可变的
 * ——用户手动改名、或者我们把分发仓库换个名字发布，目录名就不再是 'st-stage'。
 * 一旦对不上，管家就认不出自己，"不能把自己列为可关闭对象"这条保护会静默失效，
 * 用户能通过管家把管家自己关掉。
 *
 * 怎么算：bundle.js 是 ESM，`import.meta.url` 就是它自己的完整 URL，形如
 * `https://host/scripts/extensions/third-party/<目录名>/bundle.js?v=...`。
 * 倒数第二段就是安装目录名。这个值天然跟着实际安装位置走，不需要任何配置。
 */

/** 兜底目录名。只在 URL 推导失败时使用（测试环境、非常规布局）。 */
export const FALLBACK_DIRECTORY_NAME = 'st-stage'

/** ST 扩展名里的固定前缀，不可能是安装目录名本身。 */
const RESERVED_SEGMENTS = new Set(['extensions', 'third-party', 'scripts', ''])

/**
 * 安装目录的上一级必须是这两者之一。
 *
 * 只要求"倒数第二段"是不够的：任何 URL 都能凑出一个倒数第二段。跑单测时
 * `import.meta.url` 指向源码路径，那样会把 `butler` 当成安装目录名——比退回兜底值
 * 更糟，因为它是个看起来合理的错值。锚定 ST 的真实布局才能把这种情况挡掉。
 */
const PARENT_SEGMENTS = new Set(['third-party', 'extensions'])

/**
 * 从一个模块 URL 里取出安装目录名。
 *
 * 纯函数，便于直接喂各种 URL 做测试。推不出来时返回兜底值而不是抛错：
 * 认错自己的后果是保护失效，宁可退回旧字面量也不要炸掉整个管家。
 */
export function installDirectoryName(moduleUrl: string): string {
  if (typeof moduleUrl !== 'string' || !moduleUrl) return FALLBACK_DIRECTORY_NAME
  // 先切掉 ?v= 之类的查询串和 #fragment，否则会混进目录名
  const withoutQuery = moduleUrl.split(/[?#]/)[0]
  const segments = withoutQuery.split('/').filter(Boolean)
  // 末段是文件名（bundle.js），它前面那段才是目录
  const directory = segments[segments.length - 2]
  const parent = segments[segments.length - 3]
  if (!directory || RESERVED_SEGMENTS.has(directory.toLowerCase())) return FALLBACK_DIRECTORY_NAME
  // 不在 ST 扩展布局里就别猜：宁可退回兜底值，也不要交出一个像样的错值
  if (!parent || !PARENT_SEGMENTS.has(parent.toLowerCase())) return FALLBACK_DIRECTORY_NAME
  return directory
}

/**
 * 本扩展在 ST 扩展清单里可能出现的两种名字。
 *
 * ST 有的地方用裸目录名，有的地方用 `third-party/<目录名>`，两种都要认。
 */
export function selfExtensionNames(directory: string): string[] {
  const name = directory.trim()
  if (!name) return []
  return name.includes('/') ? [name] : [name, `third-party/${name}`]
}

/**
 * 判断某个扩展名是不是本扩展自己。
 *
 * 大小写不敏感：Windows 目录名不区分大小写，而 ST 的禁用清单存的是字面字符串，
 * 两边可能大小写不一致。认错方向上宁可多保护，也不要漏保护。
 */
export function matchesSelf(name: string, directory: string): boolean {
  const target = name?.trim().toLowerCase()
  if (!target) return false
  return selfExtensionNames(directory).some((candidate) => candidate.toLowerCase() === target)
}

/** 当前运行实例的安装目录名（模块加载时算一次）。 */
export const SELF_DIRECTORY_NAME = installDirectoryName(
  typeof import.meta === 'undefined' ? '' : import.meta.url,
)

/** 供两处调用点共用：这个扩展名是不是本扩展自己。 */
export function isSelfExtensionName(name: string): boolean {
  return matchesSelf(name, SELF_DIRECTORY_NAME)
}
