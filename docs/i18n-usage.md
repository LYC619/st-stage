# i18n 使用指南

## 基本用法

```typescript
import { t } from '../core/i18n'

// 简单翻译
const confirmText = t('common.confirm')  // "确认" 或 "Confirm"

// 带参数的翻译
const greeting = t('welcome.message', { name: 'Alice' })

// 嵌套路径
const title = t('sprite.manager.title')  // "立绘图库管理"
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
const title = t('myFeature.title')
```

## 切换语言

```typescript
import { setLocale, getLocale } from '../core/i18n'

// 获取当前语言
const current = getLocale()  // 'zh-CN' 或 'en-US'

// 切换语言
setLocale('en-US')
```

## 注意事项

- 所有翻译键使用点分隔的路径（如 `common.confirm`）
- 缺失的键会返回键本身，便于开发时识别
- 运行 `pnpm build:ext` 或 `pnpm build:st` 会自动复制 locale 文件到产物目录
- locale 文件使用 UTF-8 编码，支持所有 Unicode 字符
