# 百工（st-stage-ext）— SillyTavern 扩展安装包

> 酒馆里的事，百工都做。

这里是「百工」的**扩展仓库**：只放构建好的成品文件（约 1 MB），装完聊天界面会出现一个可拖动的 **📱 图标**，里面是立绘、图库、管家、MVU、新变量、API 等 App。

## 安装

1. SillyTavern → **扩展**（积木图标）→ **安装扩展**
2. 粘贴本仓库地址：

```
https://github.com/LYC619/st-stage-ext
```

装好后会自动跟随本仓库更新（`manifest.json` 里 `auto_update: true`），ST 每次启动检查一次。更新后界面没变化时，先看 ST 扩展设置面板底部的版本号；版本号变了就说明已加载新版。

## 源码与文档

功能说明、开发环境、测试和 issue 都在源码仓库：**https://github.com/LYC619/st-stage**

本仓库的文件由源码仓库 `pnpm build:st` 生成，请不要直接在这里改代码——下次发布会被覆盖。

| 文件 | 作用 |
| --- | --- |
| `manifest.json` | ST 扩展清单 |
| `index.js` | 稳定加载器，按 `version.json` 破缓存 |
| `bundle.js` | 打包后的全部功能代码 |
| `style.css` | 扩展样式 + 手机框架样式 |
| `version.json` | 当前构建版本号 |
