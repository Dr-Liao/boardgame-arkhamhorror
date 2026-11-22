// 12035 机锋巧辩（Sharp Rhetoric）· 资产 · 探求者 0 经验
// 卡面：[fast]花费1资源：你本次技能检定得到+1[willpower]（如果是调查或谈判，改为+2[willpower]）。
//       [fast]花费1资源：你本次技能检定得到+1[intellect]（如果是调查或谈判，改为+2[intellect]）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 参考实现：Asset/Assets/SharpRhetoric.hs（withSkillTest → maction == Just #investigate || isParley → 2，否则 1）。
// 读点：技能检定期间的玩家窗口（test.beforeCommit / test.afterCommit）→ free 描述子 + addPendingTestBonus；
//   「调查或谈判」读 state.skillTest.actionKind（engine/tests.js 写入的运行时元数据）。
const isInvestigateOrParley = state => ['investigate', 'parley'].includes(String(state.skillTest?.actionKind || ''))

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
    const amount = isInvestigateOrParley(state) ? 2 : 1
    api.addPendingTestBonus(amount)
    api.info(`${inv.name} 花费 1 资源：本次检定 +${amount}（${skill}）。`)
  },
})

export default {
  code: '12035',
  abilities: [
    skillBoost('willpower', '花 1 资源：本次检定 +1[意志]（调查或谈判时改为 +2）'),
    skillBoost('intellect', '花 1 资源：本次检定 +1[智识]（调查或谈判时改为 +2）'),
  ],
  modifiers: [],
}
