# 暂缓与遗留事项

只列仍未解决的事。解决后直接删除，历史看 Git。

## 功能暂缓

- 图库瀑布流：`st-extension/src/apps/gallery-app.ts`。
- 微信输入时 @ 内联推荐：`st-extension/src/apps/wechat/`。
- 手机拖拽调宽：`core/phone-shell.ts`。
- Renderer 预生成分支：`st-extension/src/apps/renderer/modes/cards.ts`，目前选项填入草稿后由用户发送。
- 立绘透明素材清理、目录扩充与图床长期托管：`assets/`，需确定素材和托管来源。
- 原生整包 ZIP 导入与完整账户恢复：`st-extension/src/apps/cloud-export/`，目前按类型恢复。

## 已知小问题（不影响使用）

- 加载器在堆栈解析失败时仍回退到 `st-stage` 目录：`st-extension/build.mjs`。

## 待真实环境验证

见[外部环境验收记录](EXTERNAL-ACCEPTANCE.md)。

## 需要维护者决定

- 语义版本仍为 `0.9.0`：`manifest.json`。
- 项目许可证与许可证/CI 徽章：`README.md`。
