# SillyTavern Cloud Export App

这是 st-stage 内置的 SillyTavern 数据导出 App，位于独立目录中，便于维护和测试。

## 集成

App 已由 `st-extension/src/apps/index.ts` 注册到内置 App 列表，构建后会随 st-stage 一起加载。

当前导出范围：PNG 角色卡、角色聊天、世界书、OpenAI Settings 预设和全局正则。压缩包根目录按 SillyTavern `data/default-user/` 内容组织，并生成脱敏的最小 `settings.json`；不会包含 `secrets.json` 或 API Key。

界面支持按类型切换、名称搜索、当前筛选结果全选/反选/清空、角色下按需展开聊天，以及“选择角色及全部聊天”“全选角色及聊天”批量操作。点击一次“导出所选备份”只下载一个 `default-user-YYYYMMDD-HHmmss.zip`；压缩包使用 `default-user` 的标准路径，方便其他应用直接扫描。

App 打开时只读取角色清单。聊天清单在展开角色或执行批量选择时读取，世界书正文和角色卡/聊天正文在真正导出时读取；选中的多个资产使用最多 4 个并发请求。这样不会因为账户中角色、聊天或世界书较多而阻塞首屏。

当前 ZIP 路径为 `settings.json`、`characters/`、`chats/`、`worlds/` 和 `OpenAI Settings/`。群组/群聊、Persona、图片附件、其他模型后端预设、主题、快捷回复和向量索引不在 v1 导出范围内；页面不会把本包宣称为完整账户备份。

`bridge.ts` 集中了 ST HTTP 端点。若目标 ST 版本的端点返回结构不同，只需要调整该文件，不要改 UI 和 zip 打包层。

当前桥接按 SillyTavern release 端点实现：角色 `/api/characters/all`、聊天列表 `/api/characters/chats`、聊天正文 `/api/chats/get`、世界书 `/api/worldinfo/list` + `/api/worldinfo/get`、预设和全局设置 `/api/settings/get`、角色 PNG `/api/characters/export`。全局正则使用 ST 的 `extension_settings.regex` 字段。这是“导出一个新数据包”，不会把包写回 ST，也不维护增量或删除语义。导出失败时不会下载半成品 ZIP。
