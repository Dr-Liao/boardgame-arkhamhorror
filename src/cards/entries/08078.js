// 08078 无畏精神（Dauntless Spirit）· 幸存者（Survivor）技能 · 1 经验。
//
// 卡面：无畏精神在你手中或投入到技能检定中时，其获得等于你 [combat] 的 [willpower] 图标，
//       以及等于你 [willpower] 的 [combat] 图标。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：commit 档案的 iconBonus（动态图标）。ctx 没有 getStat/api，读 cards-data 的印刷属性
// （近似；primitive request 已登记，主进程把修正值读点接进 iconBonus 后改一行即可）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const printed = (inv, name) => Number(ALL_CARDS[inv?.code]?.[name] ?? 0)

export default {
  code: '08078',
  abilities: [
    {
      kind: 'commit',
      label: '无畏精神：获得等于你[战斗]的[意志]图标与等于你[意志]的[战斗]图标',
      skill: {
        iconBonus: ({ inv, skill }) => {
          const tested = new Set((Array.isArray(skill) ? skill : [skill]).filter(Boolean))
          let icons = 0
          if (tested.has('willpower')) icons += printed(inv, 'combat')
          if (tested.has('combat')) icons += printed(inv, 'willpower')
          return icons
        },
      },
    },
  ],
  modifiers: [],
}
