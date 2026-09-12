# 2026-09-12 国际化与无障碍基础设施实施计划

## 执行摘要

**目标**：建立 i18n 和 a11y 基础设施，使「百工」扩展支持多语言和无障碍访问。

**范围**：
- Phase 1：i18n 基础架构（运行时翻译、locale 文件、字符串提取）
- Phase 2：中文/英文双语支持（核心 UI 和五个主要 App）
- Phase 3：a11y 增强（键盘导航、ARIA 属性、焦点管理）
- Phase 4：CI 集成和文档

**非范围**：
- 日语/韩语等其他语言翻译（留给社区贡献）
- 完整 WCAG 2.2 AAA 合规（目标 AA）
- 自动化 a11y 测试（手动验证优先）

**工作量估算**：3-4 天（单代理串行执行）

**风险评估**：
- 低风险：i18n 包装器不改变现有功能逻辑
- 中风险：大量字符串提取可能引入遗漏或错别字
- 缓解：分批提交，每批通过测试和人工检查后再继续

---

## 架构设计

### i18n 方案

**不采用**第三方库（react-i18next、i18next），原因：
- 扩展运行在 ST 宿主环境，不适合引入大型依赖
- 现有代码大量使用原生 DOM，React 生态库不匹配
- SillyTavern 自身 i18n 系统基于简单 JSON + 运行时函数

**采用**轻量自研方案：
```typescript
// core/i18n.ts
type Locale = 'zh-CN' | 'en-US'
type I18nDict = Record<string, string | Record<string, string>>

let currentLocale: Locale = 'zh-CN'
let translations: Record<Locale, I18nDict> = {}

export function t(key: string, fallback?: string): string {
  const keys = key.split('.')
  let value: any = translations[currentLocale]
  for (const k of keys) {
    value = value?.[k]
    if (value === undefined) break
  }
  return typeof value === 'string' ? value : (fallback ?? key)
}

export function setLocale(locale: Locale): void {
  if (translations[locale]) currentLocale = locale
}

export function loadTranslations(locale: Locale, dict: I18nDict): void {
  translations[locale] = dict
}
```

**Locale 文件结构**：
```
st-extension/locales/
  zh-CN.json  # 简体中文（主要）
  en-US.json  # 美国英语
```

示例内容：
```json
{
  "common": {
    "confirm": "确认",
    "cancel": "取消",
    "close": "关闭",
    "save": "保存",
    "delete": "删除"
  },
  "phone": {
    "home": "主屏",
    "back": "返回"
  },
  "spriteApp": {
    "title": "立绘",
    "enableOverlay": "启用立绘功能",
    "floatingWindow": "悬浮窗"
  }
}
```

### a11y 增强策略

**关键原则**：
- 所有交互元素可键盘访问（Tab、Enter、Space、Esc、方向键）
- 动态内容使用 ARIA live regions
- 对话框/模态框实现 focus trap
- 颜色对比度 WCAG AA 4.5:1（工具验证，不在代码中硬编码检查）

**Focus trap 示例**：
```typescript
function trapFocus(container: HTMLElement): () => void {
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  
  function handleTab(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
  }
  
  container.addEventListener('keydown', handleTab)
  first?.focus()
  
  return () => container.removeEventListener('keydown', handleTab)
}
```

---

## 实施批次

### Batch A: i18n 基础设施（0.5 天）

**任务**：
1. 创建 `core/i18n.ts` 和 `core/i18n.test.ts`
2. 创建空 `st-extension/locales/zh-CN.json` 和 `en-US.json`
3. 修改 `st-extension/build.mjs` 复制 locale 文件到产物
4. 在 `st-adapter.ts` 初始化时加载翻译

**验证**：
- 单元测试覆盖 `t()`、`setLocale()`、嵌套键、缺失键回退
- 手动验证：切换语言后 `t('common.confirm')` 返回正确值

**文件清单**：
- `core/i18n.ts` (新建)
- `core/i18n.test.ts` (新建)
- `st-extension/locales/zh-CN.json` (新建)
- `st-extension/locales/en-US.json` (新建)
- `st-extension/build.mjs` (修改)
- `st-adapter.ts` (修改，加载 locale)

### Batch B: 通用字符串和手机壳（1 天）

**范围**：
- 通用按钮/标签（确认/取消/保存/删除/关闭）
- 手机壳 UI（返回/收起/主屏/设置）
- Toast 通知
- 扩展设置面板

**提取策略**：
- 硬编码字符串 → `t('key', '原字符串')` 包装
- 原字符串作为 fallback 保证向后兼容
- 同步填充 `zh-CN.json`（原值）和 `en-US.json`（英文翻译）

**文件清单**（预估 15-20 个文件）：
- `st-extension/src/phone-shell.ts`
- `st-extension/src/toast.ts`
- `st-extension/src/settings-panel.ts`
- `core/types.ts` 中的枚举文本

**验证**：
- 切换语言后手动检查手机壳所有按钮
- 测试 toast 通知多语言
- 原有 1172 项测试仍全部通过

### Batch C: 五大核心 App（1.5 天）

**App 优先级**（按用户使用频率）：
1. 🎭 立绘 App (`sprite-overlay.ts`)
2. 🗂 图库 App (`sprite-manager.ts`)
3. 📦 导出 App (`cloud-export/`)
4. 🔢 MVU (`mvu-app.ts`)
5. 🧮 新变量 (`new-variable-app.ts`)

**每个 App 子任务**：
- 提取所有 UI 文本（标题/按钮/提示/错误消息）
- 更新对应 locale 文件区块
- 手动测试该 App 全流程

**文件清单**（预估 30-40 个文件）：
- `st-extension/src/sprite-overlay.ts`
- `st-extension/src/sprite-manager.ts`
- `st-extension/src/apps/cloud-export/*.ts` (6 个文件)
- `st-extension/src/apps/mvu/*.ts`
- `st-extension/src/apps/new-variable/*.ts`
- `core/sprite-store.ts`（图库核心逻辑的提示文本）
- `core/pack-io.ts`（导入导出错误消息）

**验证**：
- 英文环境下完整走通五个 App 的核心流程
- 截图对比中文/英文 UI 布局无错位
- 长文本按钮测试（英文通常比中文长 20-40%）

### Batch D: a11y 键盘导航和 ARIA（1 天）

**范围**：
- 所有对话框/模态框实现 focus trap 和 Esc 关闭
- 手机壳添加 `role="application"` 和键盘快捷键
- 图库卡片墙支持方向键导航
- 立绘悬浮窗齿轮按钮添加 `aria-label`
- 下拉菜单/弹出层添加 `aria-expanded`、`aria-haspopup`

**关键修改点**：
- `sprite-manager.ts` 对话框加 focus trap
- `cloud-export-app.ts` 对话框加 focus trap
- `variable-hud.ts` 已有 `aria-label`，补充键盘事件
- `phone-shell.ts` 补充 `role` 和快捷键文档

**ARIA 审计清单**：
```typescript
// 生成审计报告，人工检查
function auditAria(): void {
  const buttons = document.querySelectorAll('button:not([aria-label])')
  const interactives = document.querySelectorAll('[role="button"]:not([tabindex])')
  const modals = document.querySelectorAll('.so-manager, .so-app-backdrop')
  console.log({ buttons, interactives, modals })
}
```

**验证**：
- 手动用 Tab 键遍历所有 App，无法到达的元素需修复
- 对话框打开后 Tab 不能跳出
- Esc 键关闭所有层级正确（lightbox → dialog → phone shell）
- 使用 WAVE Chrome 扩展检查主要页面

### Batch E: CI、文档和发布（0.5 天）

**CI 增强**（`.github/workflows/ci.yml`）：
```yaml
- name: Verify i18n keys
  run: node scripts/verify-i18n-completeness.mjs

- name: Check bundle size
  run: |
    SIZE=$(stat -f%z bundle.js 2>/dev/null || stat -c%s bundle.js)
    if [ $SIZE -gt 1000000 ]; then
      echo "::warning::bundle.js exceeds 1MB ($SIZE bytes)"
    fi
```

**新增脚本**：
- `scripts/verify-i18n-completeness.mjs`：检查 `zh-CN.json` 和 `en-US.json` 键完全一致

**文档更新**：
- `README.md` 增加 "Language / 语言" 切换说明
- `docs/I18N.md` 新建，说明翻译文件结构和贡献流程
- `docs/ACCESSIBILITY.md` 新建，说明键盘导航和屏幕阅读器支持

**LICENSE 和徽章**：
- 根目录添加 `LICENSE`（建议 MIT 或 AGPLv3）
- README 顶部添加：
  ```markdown
  ![CI](https://github.com/LYC619/st-stage/workflows/CI/badge.svg)
  ![Version](https://img.shields.io/badge/version-0.9.0-blue)
  ![License](https://img.shields.io/badge/license-MIT-green)
  ```

**验证**：
- CI 通过所有检查
- i18n completeness 检查能捕获缺失键
- 文档链接无死链

---

## 执行协议

### 自主推进规则

1. **串行执行**：Batch A → B → C → D → E，前一批完成并验证通过后才开始下一批
2. **提交粒度**：每个 Batch 一个提交（Batch C 可按 App 拆成 5 个提交）
3. **测试门禁**：每次提交前运行 `pnpm test && pnpm typecheck && pnpm lint`
4. **人工检查点**：
   - Batch A 完成后报告：基础设施测试结果
   - Batch C 完成后报告：英文截图 + 长文本布局问题
   - Batch D 完成后报告：ARIA 审计结果和 WAVE 扫描截图
   - Batch E 完成后报告：CI 新增检查通过情况

5. **错误处理**：
   - 测试失败：修复后重新验证，失败 3 次停止并报告
   - 翻译遗漏：第一次发现时立即补充，批次内累计超过 10 处停止审查
   - 布局破坏：立即回退该文件，标记为需人工处理

### 提交消息模板

```
feat(i18n): add i18n infrastructure and locale loader

- Create core/i18n.ts with t() and setLocale()
- Add zh-CN.json and en-US.json locale files
- Update build.mjs to copy locale files to dist
- Load translations in st-adapter.ts initialization

Tests: unit tests for i18n core functions pass
Verification: manual language switch works

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

### 非阻塞问题记录

遇到以下情况不阻塞主流程，记录到 `docs/maintenance/DEFERRED.md`：
- 第三方库文本（jszip 错误消息等）
- 动态生成的复杂格式化文本（暂时保持英文或中文）
- 低频边界情况错误消息（可后续补充）

---

## 成功标准

### Phase 1-2 (i18n) 完成标志

- [ ] `t()` 函数覆盖所有用户可见文本（手机壳 + 五大 App）
- [ ] 英文环境下完整流程无中文残留（除第三方库）
- [ ] 长文本布局不破坏（英文按钮宽度适配）
- [ ] `zh-CN.json` 和 `en-US.json` 键完全对应
- [ ] CI 新增 i18n completeness 检查通过

### Phase 3 (a11y) 完成标志

- [ ] 所有对话框支持 Esc 关闭和 focus trap
- [ ] Tab 键遍历顺序合理，无跳出或死循环
- [ ] WAVE 扫描无严重错误（0 errors，warnings 可接受）
- [ ] 关键交互元素有 `aria-label` 或可识别文本
- [ ] 图库卡片墙支持方向键导航

### Phase 4 (CI & Docs) 完成标志

- [ ] CI 增加 i18n 和 bundle size 检查
- [ ] `docs/I18N.md` 和 `docs/ACCESSIBILITY.md` 完成
- [ ] README 增加语言切换说明和徽章
- [ ] LICENSE 文件添加
- [ ] 全部提交推送到 `main` 分支

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|
| 翻译遗漏导致英文界面显示键名 | 中 | 中 | fallback 使用原字符串，不显示 `key.name` |
| 长英文文本破坏布局 | 中 | 低 | 每个 App 完成后截图检查，CSS 加 `min-width` |
| a11y 修改引入键盘事件冲突 | 低 | 中 | 每次只改一个模块，立即手动测试 |
| CI 检查脚本误报 | 低 | 低 | 白名单机制允许例外情况 |
| bundle.js 体积增加 | 低 | 低 | locale JSON 约 20KB，压缩后 <10KB |

---

## 时间线（单代理估算）

| 批次 | 预计耗时 | 累计 | 检查点 |
|---|---|---|---|
| A: i18n 基础 | 4 小时 | 4h | 运行时切换语言生效 |
| B: 通用 UI | 8 小时 | 12h | 手机壳英文完整 |
| C: 五大 App | 12 小时 | 24h | 立绘+图库英文流程通 |
| D: a11y 增强 | 8 小时 | 32h | WAVE 扫描通过 |
| E: CI & Docs | 4 小时 | 36h | CI 新检查绿 |

**总计**：36 小时 ≈ 4.5 个工作日（按每日 8 小时）

---

## 参考资料

- [SillyTavern i18n 官方文档](https://docs.sillytavern.app/for-contributors/i18n/)
- [WCAG 2.2 快速参考](https://www.w3.org/WAI/WCAG22/quickref/)
- [WAVE 浏览器扩展](https://wave.webaim.org/extension/)
- [Chrome 扩展无障碍指南](https://developer.chrome.com/docs/extensions/mv2/a11y/)

---

## 授权确认

本计划已获用户明确授权："可以，制定个规划然后自主推进实施吧"

执行权限：
- ✅ 创建新文件（i18n.ts、locale JSON、文档）
- ✅ 修改现有源码（包装 `t()` 函数）
- ✅ 修改构建脚本（复制 locale 文件）
- ✅ 更新 CI 配置（新增检查）
- ✅ 提交和推送到 `main` 分支
- ❌ 操作发布仓库 `st-stage-ext`（需独立授权）
- ❌ 修改 `manifest.json` 版本号（保持 0.9.0）

开始执行 Batch A。
