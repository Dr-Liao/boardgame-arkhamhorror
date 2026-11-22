// 12047 三寸之舌（Silver Tongue）· 资产 · 游荡者 0 经验
// 卡面：[fast]花费1资源：你本次技能检定得到+1[intellect]（如果是躲避或谈判，改为+2[intellect]）。
//       [fast]花费1资源：你本次技能检定得到+1[agility]（如果是躲避或谈判，改为+2[agility]）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 参考实现：Asset/Assets/SilverTongue.hs（withSkillTest → maction == Just #evade || isParley → 2，否则 1）。
// 读点：同 12035（free 描述子 + 技能检定玩家窗口 + addPendingTestBonus）；
//   「躲避或谈判」读 state.skillTest.actionKind（'evade' / 'parley'）。
const isEvadeOrParley = state => ['evade', 'parley'].includes(String(state.skillTest?.actionKind || ''))

const skillBoost = (skill, label) => ({
  kind: 'free',
  trigger: ['test.beforeCommit', 'test.afterCommit'],
  duringOwnSkillTest: true,
  label,
  cost: { action: false, resources: 1 },
  criteria: [({ state }) => {
    const current = state.skillTest?.skill
    return Array.isArray(current) ? current.includes(skill) : current === skill
  }],
  resolve: ({ state, inv, api }) => {
    const amount = isEvadeOrParley(state) ? 2 : 1
    api.addPendingTestBonus(amount)
    api.info(`${inv.name} 花费 1 资源：本次检定 +${amount}（${skill}）。`)
  },
})

export default {
  code: '12047',
  abilities: [
    skillBoost('intellect', '花 1 资源：本次检定 +1[智识]（躲避或谈判时改为 +2）'),
    skillBoost('agility', '花 1 资源：本次检定 +1[敏捷]（躲避或谈判时改为 +2）'),
  ],
  modifiers: [],
}
