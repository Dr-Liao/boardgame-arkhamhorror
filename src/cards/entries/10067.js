// 10067 狐面具（Fox Mask · 骗术精湛 The Wise Trickster）· 潜袭者资产 · 1 资源 · 道具/守护/面具
// 卡面：
//   每位调查员仅限 1 张[[面具]]。
//   使用(2 贡品)。你移动离开有敌人的地点后，补满其中的 1 个贡品。
//   [fast] 花费 1 贡品：你本次技能检定得到 +2[智力]或 +2[敏捷]。（每次检定仅限一次。）
//
// 读点（卡面 → 引擎）：
//   · 「每位调查员仅限 1 张[[面具]]」= assetRule.controlledTraitLimit（assets.js#exceedsControlledTraitLimit
//     是唯一读点，注册期校验形状；canEquip / 打出候选共用）。
//   · 使用(2 贡品) = 条目 uses / usesType 'offering'；花费 = 描述子 cost.uses。
//   · 「移动离开有敌人的地点后补满 1 个贡品」= kind 'forced' + trigger 'move'
//     （movement.js 在移动结算后开窗，context = { when, seat, location: 目的地, from: 原地点 }）；
//     条件：本人移动、原地点有敌人、贡品未满 2；效果 api.addUses(source, 1)。
//   · 「[fast] 花费 1 贡品：本次检定 +2[智力]或 +2[敏捷]」= kind 'free' +
//     trigger ['test.beforeCommit','test.afterCommit'] + duringOwnSkillTest（本人的检定）+
//     limit { scope:'perTest', owner:'instance' }；加成 = api.addPendingTestBonus(2)
//     （技能检定的临时加值，performTest 在投入后读取 pendingBonus）。
//     条件锁定「本次检定使用智力或敏捷」（多技能检定时可选择其中一项）。
const CODE = '10067'
const OFFERING = 'offering'
const MASK_LIMIT = 2
const FAST_SKILLS = ['intellect', 'agility']

const testSkills = state => {
  const skill = state.skillTest?.skill
  return Array.isArray(skill) ? skill : (skill ? [skill] : [])
}

export default {
  code: CODE,
  name: 'Fox Mask (The Wise Trickster)',
  uses: 2,
  usesType: OFFERING,
  assetRule: { controlledTraitLimit: { trait: 'Mask', amount: 1 } },
  abilities: [
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      limit: { scope: 'perTest', owner: 'instance' },
      cost: { action: false, uses: 1 },
      label: '花费 1 贡品：本次[智力]或[敏捷]检定 +2 技能值（每次检定一次）',
      criteria: [({ state }) => testSkills(state).some(skill => FAST_SKILLS.includes(skill))],
      resolve: ({ state, inv, api }) => {
        const usable = FAST_SKILLS.filter(skill => testSkills(state).includes(skill))
        if (!usable.length) return
        let skill = usable[0]
        if (usable.length > 1) {
          const answer = api.choice({
            kind: 'effect', source: CODE, seat: inv.seat,
            prompt: '狐面具：本次检定得到 +2[智力]或 +2[敏捷]？',
            options: usable.map(id => ({ id, label: id === 'intellect' ? '+2[智力]' : '+2[敏捷]' })),
          })
          if (usable.includes(answer)) skill = answer
        }
        api.addPendingTestBonus(2)
        api.info(`🦊 狐面具：花费 1 贡品，本次检定 +2${skill === 'intellect' ? '[智力]' : '[敏捷]'}。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'move',
      silent: true,
      label: '你移动离开有敌人的地点后：补满 1 个贡品',
      criteria: [({ state, inv, source, context }) => context?.seat === inv.seat
        && (Number(source?.uses) || 0) < MASK_LIMIT
        && context?.from != null
        && (state.enemies || []).some(enemy => enemy.location === context.from)],
      resolve: ({ source, api }) => {
        api.addUses(source, 1)
        api.info(`🦊 狐面具：移动离开有敌人的地点，补满 1 个贡品（当前 ${source.uses}）。`)
      },
    },
  ],
  modifiers: [],
}
