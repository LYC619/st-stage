# 角色立绘悬浮窗（st-stage）

为任意纯文字角色卡添加视觉小说式立绘悬浮窗的 SillyTavern 扩展：向 AI 注入表情标签指令，从回复中提取 `[立绘:xxx]` 标签，实时切换悬浮窗中的角色立绘。

本仓库同时是：

1. **一个可直接安装的 SillyTavern 扩展**（根目录的 `manifest.json` / `index.js` / `style.css`）
2. **一个 Next.js 本地开发测试环境**（模拟 ST 聊天，全链路验证插件行为）

## 在 SillyTavern 中安装

打开 SillyTavern → 扩展（Extensions）→ 安装扩展（Install extension）→ 粘贴本仓库链接：

```
https://github.com/LYC619/st-stage
```

安装后在扩展面板中找到「角色立绘悬浮窗」即可配置。内置「银发萝莉」「黑长直御姐」两套预设立绘包（各 8 个表情），也可上传自己的图片或通过 `.sprite-pack.json` 导入分享的立绘包。

## 功能

- **Prompt 注入**：通过官方 `setExtensionPrompt` API 指示 AI 在每条回复末尾附加 `[立绘:表情]` 标签
- **标签提取**：监听 `MESSAGE_RECEIVED` 事件，从 AI 回复中提取表情标签并隐藏显示
- **悬浮窗**：可拖拽、可缩放的立绘悬浮窗，位置大小自动记忆
- **立绘包管理**：按角色绑定立绘包，支持上传图片 / 图床 URL / 导入导出

## 本地开发

网页版是仿 ST 的聊天模拟器，用于本地开发和测试核心链路（注入 → 模拟 AI 回复 → 提取标签 → 切换立绘）：

```bash
pnpm install
pnpm dev        # 启动网页测试环境 http://localhost:3000
pnpm build:ext  # 重新打包 ST 扩展（产物输出到根目录 index.js / style.css，需提交）
```

### 目录结构

| 路径 | 说明 |
| --- | --- |
| `manifest.json` / `index.js` / `style.css` | ST 扩展产物（根目录，供 GitHub 链接安装） |
| `core/` | 平台无关核心逻辑（标签解析、prompt 构建、立绘包管理、导入导出） |
| `st-extension/src/` | ST 扩展源码（适配器 + 原生 DOM UI），经 esbuild 打包为根目录 `index.js` |
| `app/` `components/` `lib/` | Next.js 网页测试环境 |
| `public/presets/` | 内置预设立绘图片（随扩展安装一起分发） |

> 注意：修改 `core/` 或 `st-extension/src/` 后必须运行 `pnpm build:ext` 并提交根目录产物，GitHub 安装的用户才能拿到更新。

## Built with v0

This repository is linked to a [v0](https://v0.app) project.

[Continue working on v0 →](https://v0.app/chat/projects/prj_D1rjqBadx2EAZHnDXoNJs9UVMFlP)
