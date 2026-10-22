// 兼容旧进程的转发模块（第 128 轮把卡号表移到 web/ui-cards.js）。
//
// 背景：大厅在启动时把 Mod 的 `src/integration/web-api.js` 载入内存，其中的
// VERSIONED_FILES 会列出用来计算资源版本的文件。若大厅进程在 `presentation/ui-cards.js`
// 被移走**之前**启动，它仍会按旧路径 readFile 计算资源版本 → ENOENT，导致
// `/api/mods/arkhamhorror/*` 全部 500（卡面描述符取不到）且存档快照写不进去
// （界面提示「自动保存失败：ENOENT … presentation/ui-cards.js」）。
//
// 本文件只做转发，不复制任何数据；新代码不再引用它。
// 大厅重启后（载入修正后的 web-api.js）即可安全删除。
export * from '../web/ui-cards.js'
