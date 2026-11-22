// 12017 耐性
// 卡面：[fast]花费1资源：你本次技能检定得到+1[combat](如果是攻击或躲避，改为+2[combat])。
// 卡面：[fast]花费1资源：你本次技能检定得到+1[agility](如果是攻击或躲避，改为+2[agility])。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 检定期间的 [fast] 加值 = `kind: 'free'` + trigger（test.beforeCommit/test.afterCommit）
//     + duringOwnSkillTest（playerWindow 的免费能力枚举，与 08105/09099/10120 同一读点）；
//     加值写 api.addTestPendingBonus(n)（下一次并入本次检定的技能值）；
//   · 「攻击或躲避」= state.skillTest.actionKind（声明 assetRule.trackTestTarget 后 performTest
//     会把带类型的真实目标写进检定状态；读点与 08105/09099 相同）；
//   · 每条能力只在本人的对应技能检定里出现：检定技能读 state.skillTest.skill。

const CODE = '12017'
const FAST_TRIGGERS = ['test.beforeCommit', 'test.afterCommit']

const testSkills = state => {
  const skill = state.skillTest?.skill
  return Array.isArray(skill) ? skill : (skill ? [skill] : [])
}

const isAttackOrEvade = state => ['fight', 'evade'].includes(String(state.skillTest?.actionKind || ''))

function resourceBoost(skill) {
  return {
    kind: 'free',
    trigger: FAST_TRIGGERS,
    duringOwnSkillTest: true,
    label: `花费 1 资源：本次技能检定 +1${skill === 'combat' ? '[战斗]' : '[敏捷]'}（攻击或躲避改为 +2）`,
    cost: { action: false, resources: 1 },
    criteria: [({ state }) => testSkills(state).includes(skill)],
    resolve: ({ state, api }) => {
      const amount = isAttackOrEvade(state) ? 2 : 1
      api.addTestPendingBonus(amount)
      api.info(`「耐性」：花费 1 资源，本次技能检定 +${amount}${skill === 'combat' ? '[战斗]' : '[敏捷]'}。`)
    },
  }
}

export default {
  code: CODE,
  assetRule: { trackTestTarget: true },
  abilities: [resourceBoost('combat'), resourceBoost('agility')],
  modifiers: [
  ],
}
