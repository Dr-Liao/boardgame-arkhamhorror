// 04005 加尔文·怀特
// 卡面：你身上每有一点恐惧，你得到+1[willpower]和+1[intellect]。
// 卡面：你身上每有一点伤害，你得到+1[combat]和+1[agility]。
// 卡面：[elder_sign]效果：+0。你可以治愈1点伤害或恐惧，或受到1点直接伤害或直接恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 加尔文·怀特：旧印 +0；治疗或承受 1 点伤害/恐惧。

import { INVESTIGATOR_ABILITIES } from '../card-effects.js'

const factory = () => ({ inv, api }) => {
    const options = [
      { id: 'skip', label: '不结算' },
      { id: 'healDamage', label: '治疗 1 点伤害' },
      { id: 'healHorror', label: '治疗 1 点恐惧' },
      { id: 'takeDamage', label: '受到 1 点直接伤害' },
      { id: 'takeHorror', label: '受到 1 点直接恐惧' },
    ]
    const choice = api.choice({ kind: 'reaction', source: 'calvinElderSign', seat: inv.seat, canSkip: true,
      prompt: '旧印：选择治疗或承受伤害/恐惧。', options })
    if (choice === 'healDamage' && inv.damage > 0) inv.damage -= 1
    else if (choice === 'healHorror' && inv.horror > 0) inv.horror -= 1
    else if (choice === 'takeDamage') api.directDamage(inv.seat, 1)
    else if (choice === 'takeHorror') api.directHorror(inv.seat, 1)
    return { delta: 0 }
  }

export default {
  code: '04005',
  kind: 'investigator',
  elderSign: { id: '04005-eldersign', resolve: factory() },
  abilities: [

  ],
  modifiers: ['willpower', 'intellect', 'combat', 'agility'].map(skill => ({
    target: `skill:${skill}`,
    amount: ({ controller }) => {
      const per = INVESTIGATOR_ABILITIES['04005']?.statsPerHarm || {}
      return (controller?.horror || 0) * (per.horror?.[skill] || 0)
        + (controller?.damage || 0) * (per.damage?.[skill] || 0)
    },
  })),
}
