# SillyTavern Cloud Export App

这是一个未注册的 st-stage 内部 App，当前只放在独立目录，便于复制到其他扩展项目。

## 集成

```ts
import { cloudExportApp } from './cloud-export/export-app'

// 在你的 App 装配清单中加入 cloudExportApp()
```

当前导出范围：PNG 角色卡、角色聊天、世界书、OpenAI Settings 预设和全局正则。压缩包根目录按 SillyTavern `data/default-user/` 内容组织，并生成脱敏的最小 `settings.json`；不会包含 `secrets.json` 或 API Key。

界面支持按类型切换、名称搜索、当前筛选列表全选、角色下展开聊天并单独勾选。群组/群聊、Persona、图片附件、其他模型后端预设、主题、快捷回复和向量索引不在 v1 导出范围内；页面会保留这些内容未导出的说明，不把本包宣称为完整备份。

`bridge.ts` 集中了 ST HTTP 端点。若目标 ST 版本的端点返回结构不同，只需要调整该文件，不要改 UI 和 zip 打包层。

当前桥接按 SillyTavern release 端点实现：角色 `/api/characters/all`、聊天列表 `/api/characters/chats`、聊天正文 `/api/chats/get`、世界书 `/api/worldinfo/list` + `/api/worldinfo/get`、预设和全局设置 `/api/settings/get`、角色 PNG `/api/characters/export`。这是“导出一个新数据包”，不会把包写回 ST，也不维护增量或删除语义。
