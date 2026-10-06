# i18n 使用指南

## 基本用法

```typescript
import { t } from '../core/i18n'

// 简单翻译
const confirmText = t('common.confirm')  // "确认" 或 "Confirm"

// 带参数的翻译
const greeting = t('welcome.message', '你好，{{name}}', { name: 'Alice' })

// 嵌套路径
const title = t('sprite.manager.title', '立绘包管理')
```

## 添加新的翻译

1. 编辑 `st-extension/locales/zh-CN.json`：
```json
{
  "myFeature": {
    "title": "我的功能",
    "description": "这是描述"
  }
}
```

2. 编辑 `st-extension/locales/en-US.json`：
```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This is a description"
  }
}
```

3. 在代码中使用：
```typescript
const title = t('myFeature.title', '我的功能')
```

## 切换语言

用户在 SillyTavern 的语言设置里切换，刷新后生效。百工读取宿主保存在浏览器 `localStorage.language` 中的选择；未设置时使用浏览器语言。英文系列使用 `en-US`，其余语言暂时使用 `zh-CN`。扩展不会修改这项偏好。

以下接口供代码使用：它影响后续的 `t()` 调用，不会自动重绘已经挂载的 DOM。

```typescript
import { setLocale, getLocale } from '../core/i18n'

// 获取当前语言
const current = getLocale()  // 'zh-CN' 或 'en-US'

// 切换语言
setLocale('en-US')
```

## 注意事项

- 所有翻译键使用点分隔的路径（如 `common.confirm`）
- 用户可见文案始终保留原中文 fallback。缺失键优先查中文词典，然后使用 fallback；两者都没有时返回键本身。
- `{{name}}` 参数接受字符串或数字，未提供的参数保留占位符。返回值通过 `textContent` 或属性写入，不能作为用户输入的 HTML 使用。
- 运行 `pnpm build:all` 用同一构建时间生成根目录与 `st-distribution/`，同时复制两份语言文件。单独调试仍可使用 `build:ext` 或 `build:st`。
- 发布清单是原有六个根文件，加上 `locales/zh-CN.json` 和 `locales/en-US.json`；不要漏拷贝语言目录。
- 语言文件相对于运行中的 `bundle.js` 加载，支持安装目录改名与代理路径前缀。请求和响应体共用 3 秒时限；加载失败或格式错误不阻止扩展启动。
- locale 文件使用 UTF-8 编码，支持所有 Unicode 字符

## 当前覆盖范围

手机壳导航、立绘悬浮窗按钮与占位提示、扩展设置、图库管理头部及新建/导入入口已接入。立绘 App 与图库 App 的名称、设置、状态、确认和提示，以及共用 App 弹窗也支持中英文。图库管理详情、导出、MVU、新变量与其他工具仍待逐批翻译；这些工作不等于整个 Phase 2 已完成。

用户创建的名称、提示词内容、持久化选项值和协议文字（如 `[立绘:xxx]`、`{清单}`）保持原样。只翻译它们周围的界面说明。

## 验证

```powershell
node scripts/verify-i18n-completeness.mjs
node scripts/verify-runtime-parity.mjs --root . --distribution st-distribution
# 独立发布时增加 --release <发布仓库目录>，检查 README 与两份语言文件。
```

CI 检查双语键与 `{{参数}}` 一致性、非空词条、源代码静态键、中文 fallback 和直接传入的参数对象。无法静态核对的 fallback、变量参数对象或展开属性会报错；参数值本身可以是变量或表达式。参数使用单层 `{{name}}`；保留给 Prompt 的单花括号不参与替换。检查器跟踪从 i18n 模块导入的 `t`（含别名），不把其他同名函数或测试用例当成产品引用。

CI 在构建前检查必需产物都受 Git 跟踪，构建后检查字节一致性和已提交产物差异。真实 ST 浏览器验收使用独立测试实例与新建浏览器上下文，不能指向日常数据目录。键盘操作与验证范围见 [ACCESSIBILITY.md](ACCESSIBILITY.md)。
