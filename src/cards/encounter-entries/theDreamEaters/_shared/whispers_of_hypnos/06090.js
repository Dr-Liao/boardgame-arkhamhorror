// 06090 修普诺斯的低语（Whispers of Hypnos，诡计，3 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：whispers_of_hypnos（WN / TSK / PONR / WTGD）。
// 卡面：险境。Revelation - 选择一项技能（[willpower]/[intellect]/[combat]/[agility]）。
//       直到本轮结束，每位调查员所选技能 -2。你不能选择本轮已被相同卡牌效果选择过的技能。
// 实现：Peril 由 definition 解析（无法投入/取消）。
//   技能 -2 需要全局 statModifier 数据分派（TDE 共享层没有 statModifier 钩子）；
//   「本轮已选技能」记录在 flags 结构里，由共享层读 scenarioFlags 结算 → coordinator request。
export default {
  code: '06090',
  scope: 'treachery',
  implemented: true,
  note: '共享 encounterRules.statModifier 读 scenarioFlags.whispersOfHypnos（本轮所选技能 -2）。',
  encounterResolve(state, inv, card, api) {
    const record = state.scenarioFlags?.whispersOfHypnos
    const used = record && record.round === state.round ? (record.skills || []) : []
    const skills = ['willpower', 'intellect', 'combat', 'agility'].filter(skill => !used.includes(skill))
    if (!skills.length) return false
    const answer = skills.length === 1 || typeof api.choose !== 'function' ? skills[0] : api.choose({
      kind: 'skill', source: '06090', seat: inv.seat,
      prompt: '选择本轮所有调查员 -2 的技能。',
      options: skills.map(skill => ({ id: skill, label: skill })),
    })
    const skill = skills.includes(String(answer)) ? String(answer) : skills[0]
    api.setScenarioFlag?.('whispersOfHypnos', { round: state.round, skills: [...used, skill] })
    api.info?.(`💤 「修普诺斯的低语」：本轮每位调查员的 ${skill} -2。`)
    return false
  },
}
