// 诡镇奇谈界面语言包入口（docs/localization.md §8.2）。
// 拆成 core + 按模块拆分的区域片段，方便多人并行维护；聚合后仍是 default export 的扁平对象。
// 缺失 key 的回退顺序由 web/i18n.js 负责：resolved → zh-CN → key。
import core from './zh-CN.core.js'
import hub from './zh-CN.hub.js'
import gameui from './zh-CN.gameui.js'
import table from './zh-CN.table.js'
import panels from './zh-CN.panels.js'
import lore from './zh-CN.lore.js'
import misc from './zh-CN.misc.js'

export default {
  ...core,
  ...hub,
  ...gameui,
  ...table,
  ...panels,
  ...lore,
  ...misc,
}
