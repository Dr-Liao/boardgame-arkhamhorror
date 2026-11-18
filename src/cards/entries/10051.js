// 10051 资金充裕（Well-Funded）· 探求者技能 · 0 经验 · 命运。
//
// 卡面：你控制[[科学]]或[[工具]]支援时，资金充裕获得[wild]（你控制至少 3 个[[科学]]和/或[[工具]]支援时，
//       资金充裕改为获得[wild][wild]）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点：动态图标 → commit 描述子的 `skill.iconBonus`（stats.js#conditionalCommitIcons 的唯一读点，
// 与 08077「人多力量大」同一形状）。印刷图标 1 个[wild] 来自 cards-data，iconBonus 只叠加条件图标：
//   0 个[[科学]]/[[工具]]支援 → +0；
//   1–2 个 → +1[wild]；
//   3 个以上 → +2[wild]（卡面的「instead」= 改为 2 个，而不是在 1 个之上再加）。
// 特性一律从 cards-data 读（特性名大小写不敏感，与引擎 effectiveTraits 同口径）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10051'

const hasTrait = (code, wanted) => (ALL_CARDS[code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === wanted)

const scienceOrToolCount = inv => (inv?.assets || [])
  .filter(asset => hasTrait(asset.code, 'science') || hasTrait(asset.code, 'tool')).length

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '资金充裕：控制[[科学]]或[[工具]]支援时获得[wild]（3 个以上改为[wild][wild]）',
      skill: {
        iconBonus: ({ inv }) => {
          const count = scienceOrToolCount(inv)
          if (count >= 3) return 2
          return count >= 1 ? 1 : 0
        },
      },
    },
  ],
  modifiers: [],
}
