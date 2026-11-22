// 12076 镇静自若（Levelheaded）
// 卡面：[fast]花费 1 资源：你本次技能检定得到 +1[willpower]（如果是冒险卡牌上的检定，改为 +2[willpower]）。
//       [fast]花费 1 资源：你本次技能检定得到 +1[agility]（如果是冒险卡牌上的检定，改为 +2[agility]）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · [fast] 检定期间的支援能力 = kind:'free' + duringOwnSkillTest + cost { action:false, resources:1 }
//     （与 04154/04156 同一枚举与扣费读点）；
//   · 「+1/+2」= api.addPendingTestBonus（本检定的待结算加值，tests.js 统一并入）；
//   · 「冒险卡牌上的检定」= skillTest.source 的 scenarioAbility/ability/type==='scenario'
//     （treachery-tokens.js 的遭遇检定与 scenarioRuntime.test 的剧本检定同一来源标记）。

const CODE = '12076'

const skillOfTest = state => {
  const skill = state.skillTest?.skill
  return Array.isArray(skill) ? skill : [skill]
}

const isScenarioTest = state => {
  const source = state.skillTest?.source || {}
  return source.scenarioAbility === true || source.ability === true || source.type === 'scenario'
}

const skillTrigger = (skill, label) => ({
  kind: 'free',
  label,
  cost: { action: false, resources: 1 },
  duringOwnSkillTest: true,
  criteria: [({ state }) => skillOfTest(state).includes(skill)],
  resolve: ({ state, api }) => {
    const amount = isScenarioTest(state) ? 2 : 1
    api.addPendingTestBonus(amount)
    api.info(`🧘 「镇静自若」：本次${skill}检定 +${amount}。`)
  },
})

export default {
  code: CODE,
  abilities: [
    skillTrigger('willpower', '花 1 资源：本次检定 +1[意志]（冒险卡牌上的检定改为 +2）'),
    skillTrigger('agility', '花 1 资源：本次检定 +1[敏捷]（冒险卡牌上的检定改为 +2）'),
  ],
  modifiers: [],
}
