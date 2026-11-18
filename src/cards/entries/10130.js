// 10130 盛装出席（Well-Dressed）· 中立技能 · 0 级 · [[熟练]]/[[命运]]
// 卡面：盛装出席在谈判行动期间投入到技能检定时，它获得[wild][wild][wild]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 动态技能图标 = commit 描述子的 `skill.iconBonus`
//     （stats.js#conditionalCommitIcons 是唯一读点，与 10051「资金充裕」、08077「人多力量大」
//      同一形状）。印刷的 1 个[wild] 图标来自 cards-data，iconBonus 只叠加条件图标；
//      卡面写「gains [wild][wild][wild]」= 追加 3 个[wild]（不是改为 3 个）。
//   · 「在谈判行动期间」的判据：state.skillTest.actionKind（tests.js 从
//     options.source.actionKind 写入）优先，其次检定来源的 actionKind / label
//     （parley.js 与各谈判能力把 label 写成「谈判」）。两处都读不到时按非谈判处理。
const CODE = '10130'
const PARLEY = 'parley'

function isParleyTest(test) {
  if (!test) return false
  if (test.actionKind === PARLEY || test.source?.actionKind === PARLEY) return true
  return /谈判|parley/i.test(String(test.source?.label || ''))
}

export default {
  code: CODE,
  name: 'Well-Dressed',
  abilities: [
    {
      kind: 'commit',
      label: '投入谈判行动的技能检定时获得[wild][wild][wild]',
      skill: {
        iconBonus: ({ state }) => (isParleyTest(state?.skillTest) ? 3 : 0),
      },
    },
  ],
  modifiers: [],
}
