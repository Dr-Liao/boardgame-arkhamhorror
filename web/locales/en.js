// 诡镇奇谈界面语言包入口（docs/localization.md §8.2）。
// 拆成 core + 按模块拆分的区域片段，方便多人并行维护；聚合后仍是 default export 的扁平对象。
// 缺失 key 的回退顺序由 web/i18n.js 负责：resolved → zh-CN → key。
import core from './en.core.js'
import hub from './en.hub.js'
import gameui from './en.gameui.js'
import table from './en.table.js'
import panels from './en.panels.js'
import lore from './en.lore.js'
import misc from './en.misc.js'

export default {
  ...core,
  ...hub,
  ...gameui,
  ...table,
  ...panels,
  ...lore,
  ...misc,
}
