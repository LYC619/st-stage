# 键盘操作与无障碍支持

## 已实现

- 用 Tab 定位手机图标，Enter 或空格打开；焦点进入 App 栅格。App 图标、返回、收起和共用按钮支持 Enter/空格。
- 打开 App 后焦点进入有名称的内容区，再按 Tab 到第一个控件。App 内 Esc 返回主屏并定位原 App 图标；主屏 Esc 收起到手机图标。
- 设置触发同一 App 重挂载时，尽量恢复同位置、同类型控件的焦点及文本选区；结构不再匹配时回到 App 内容区。
- `ctx.openModal` 共用弹窗带有 dialog/aria-modal 语义，Tab/Shift+Tab 在可用控件间循环。隐藏、禁用和折叠内容不进入顺序；原生 radio 分组和 contenteditable 支持独立浏览器回归。
- 嵌套共用弹窗只让最上层处理 Esc。关闭后恢复原控件；若 App 已重新挂载，则保留平台返回时设置的内容区焦点。
- 共用文本框有程序关联的标签；滑块有可读数值；帮助按钮有展开状态、关联说明和键盘操作。图库 App 缺少 API key 的反馈通过状态区域保留。
- 图库管理、标签管理、上传预览、图片预览和存储迁移弹窗使用同一套焦点生命周期；嵌套时最上层接收键盘，显示层级随之上移。图片预览的左右键不会穿透到下层。
- 图包与立绘卡支持方向键、Home/End 导航和 Enter/空格打开；卡内排序按钮独立响应。启用列表保存后按图包 ID 恢复焦点，同名图包不会混淆；返回列表时定位原图包。
- 下拉面板关联触发按钮的展开状态；Esc 先关面板并返回触发按钮。预览操作保留名称与焦点，说明用状态区域播报。旧浏览器的复制降级路径在当前弹窗内完成选区操作，再恢复焦点。

手机作为具名 region，不强制启用读屏软件的 application 模式。Tab 可以离开非模态手机区域；模态弹窗限制焦点。

## 尚未完成

导出、MVU、新变量与其他工具仍需补全标签、翻译或键盘支持。后续维护记录会逐项更新覆盖范围。

这不是 WCAG AA 合规声明。尚未完成实体手机、操作系统输入法、真实读屏软件和全界面对比度验收。浏览器模拟与 DOM/ARIA 断言不能代替这些检查。

## 开发与回归

`core/dialog-focus.ts` 管理最上层焦点。调用方在 DOM 插入后创建管理器，内容构建后调用 `focusInitial()`；关闭时先 `dispose()`，移除 DOM、恢复来源 App，再 `restoreFocus()`。生命周期函数必须保持幂等，不能在销毁后继续触发界面回调。

如果外层 backdrop 建立定位层级，传入 `layer: backdrop`，确保新弹窗出现在旧弹窗之上；销毁时恢复原内联层级。来源控件可能被打开钩子移除时，应提前捕获并传入 `opener`。不要把用于复制的临时文本框放在活动模态框之外。

```powershell
node scripts/verify-dialog-browser.mjs
node scripts/verify-maintenance-browser.mjs
# 仅允许使用隔离数据的回环 ST 实例
node scripts/verify-i18n-browser.mjs --url http://127.0.0.1:18769 --isolated-data
node scripts/verify-gallery-browser.mjs --url http://127.0.0.1:18769 --isolated-data
```

前两项使用合成数据与生产模块；后两项运行真实 ST 宿主和构建产物。图库脚本会替换隔离测试用户的图包，覆盖新建、JSON 导入、筛选、标签、上传预览取消、存储窗口和键盘操作，不用于日常 ST 数据。证据保存在忽略的 `test-results/`，本次提交的通过项目和限制由 `docs/maintenance/CURRENT.md` 记录。
