// 08077 人多力量大（Strength in Numbers）· 幸存者（Survivor）技能 · 1 经验。
//
// 卡面：你控制的卡牌中每有一个不同的职阶，人多力量大获得一个 [wild] 图标。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：commit 档案的 iconBonus（动态图标）；职阶从 cards-data 的卡面数据读取（与 05279 同口径）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const distinctClassCount = inv => {
  const classes = new Set()
  for (const asset of inv?.assets || []) {
    const klass = ALL_CARDS[asset.code]?.klass
    if (klass) classes.add(String(klass).toLowerCase())
  }
  return classes.size
}

export default {
  code: '08077',
  abilities: [
    {
      kind: 'commit',
      label: '人多力量大：你控制的卡牌每有一种不同职阶，获得 1 个万能图标',
      skill: {
        iconBonus: ({ inv }) => distinctClassCount(inv),
      },
    },
  ],
  modifiers: [],
}
