// 08065 密教理论（Occult Theory）· 秘术师（Mystic）技能 · 1 经验。
//
// 卡面：密教理论在你手中或投入到技能检定中时，其获得等于你 [intellect] 的 [willpower] 图标，
//       以及等于你 [willpower] 的 [intellect] 图标。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：commit 档案的 iconBonus（动态图标）。ctx 没有 getStat/api，因此读 cards-data 的印刷
// 属性（近似；已写 primitive request，待主进程把修正值读点接进 iconBonus 后改一行即可）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const printed = (inv, name) => Number(ALL_CARDS[inv?.code]?.[name] ?? 0)

export default {
  code: '08065',
  abilities: [
    {
      kind: 'commit',
      label: '密教理论：获得等于你[智慧]的[意志]图标与等于你[意志]的[智慧]图标',
      skill: {
        iconBonus: ({ inv, skill }) => {
          const tested = new Set((Array.isArray(skill) ? skill : [skill]).filter(Boolean))
          let icons = 0
          if (tested.has('willpower')) icons += printed(inv, 'intellect')
          if (tested.has('intellect')) icons += printed(inv, 'willpower')
          return icons
        },
      },
    },
  ],
  modifiers: [],
}
