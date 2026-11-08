// 调查员选择界面的扩展包署名。
//
// 核心包沿用档案口径（hub.pack.core），其余循环复用卡牌筛选的系列表（filter.series.*），
// 所以新增循环（失落的时代、万象无终……）不必在两张表里各写一遍中文名。
// 调查员包与战役包分开编号时（eoep/eoec、tskp/tskc……），卡牌数据里只有英文产品名；
// 署名按系列显示（与其余循环的分组标题一致），中文界面不会出现英文扩展包名。
// 表里只存 key，调用期再 t()（模块顶层不调用 t()，否则导入时就把语言固化了）。
import { t } from './i18n.js'
import { cardSource } from './card-filters.js'

const PACK_KEYS = { core: 'hub.pack.core' }

export function packLabel(pack, englishName = '') {
  if (!pack) return t('hub.investigator.fallbackName')
  if (PACK_KEYS[pack]) return t(PACK_KEYS[pack])
  const source = cardSource({ pack, packName: englishName })
  return source.name && source.name !== pack ? source.name : englishName || pack
}
