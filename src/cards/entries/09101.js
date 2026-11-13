// 09101 饱经风霜（Grizzled）· 幸存者技能 · 0 经验 · 定制。
// 卡面：定制。购买时选择并记录两个[[特性]]。
//       如果是对遭遇卡牌进行的技能检定（包含攻击、躲避和谈判），该遭遇卡牌上每有一个所选特性，
//       饱经风霜获得 [wild][wild]。
//
// 读点：commit 档案的 iconBonus（stats.js#commitIcons）；真实攻击/躲避的目标来自
//       state.skillTest.source.enemyId，诡计来自 state._treacheryResolving。
//
// approximation（已写 primitive-request/09101.json）：
//   · 「购买时记录两个特性」没有构筑期选择读点。这里用占位的所选特性
//     ['Monster','Humanoid']（TSK 最常见敌人特性），并以此计算双百搭图标。
//   · Nemesis / Mythos-Hardened / Always Prepared 三个勾选项需要「成功后附属敌人」
//     「与诡计一起加入胜利区」「弃牌堆回手」的条目级读点，未实现（逐项 note）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CUSTOM_CHECKS = Object.freeze([
  { name: 'Specialist', checks: 1, text: 'Choose another trait: _____' },
  { name: 'Specialist', checks: 2, text: 'Choose another trait: _____' },
  { name: 'Nemesis', checks: 3, text: 'If this is a skill test on or against an enemy with a chosen trait and the test is successful, you may attach Grizzled to that enemy. Reduce the difficulty of tests on or against the attached enemy by 1.' },
  { name: 'Mythos-Hardened', checks: 4, text: 'If this skill test is on a treachery with a chosen trait and the test is successful, you may add both Grizzled and that treachery to the victory display.' },
  { name: 'Always Prepared', checks: 5, text: 'After you draw an encounter card with a chosen trait, return one copy of Grizzled from your discard pile to your hand. (Max once per round.)' },
])

// 占位的购买时所选特性（见文件头 approximation）。
const CHOSEN_TRAITS = Object.freeze(['monster', 'humanoid'])

const encounterTraits = (state) => {
  const test = state?.skillTest
  const enemyId = test?.source?.enemyId ?? null
  const enemy = enemyId ? (state.enemies || []).find(item => item.id === enemyId) : null
  if (enemy) {
    return [...new Set([...(enemy.traits || []), ...(ALL_CARDS[enemy.originalCode || enemy.code]?.traits || [])])]
      .map(trait => String(trait).toLowerCase())
  }
  const code = state?._treacheryResolving
  return code ? (ALL_CARDS[code]?.traits || []).map(trait => String(trait).toLowerCase()) : []
}

export default {
  code: '09101',
  simplified: true,
  note: 'approximation: 见 primitive-request/09101.json（购买时所选特性用占位 Monster/Humanoid；Nemesis/Mythos-Hardened/Always Prepared 未实现）',
  customizationOptions: CUSTOM_CHECKS,
  abilities: [
    {
      kind: 'commit',
      label: '对遭遇卡的检定：每个匹配的所选特性获得双百搭图标',
      skill: {
        iconBonus: ({ state }) => {
          const traits = encounterTraits(state)
          if (!traits.length) return 0
          const matched = CHOSEN_TRAITS.filter(trait => traits.includes(trait)).length
          return matched * 2
        },
      },
    },
  ],
  modifiers: [],
}
