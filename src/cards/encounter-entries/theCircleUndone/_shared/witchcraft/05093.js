// 05093 崩毁离析
// 归属：战役共用 · theCircleUndone；遭遇组：witchcraft
// 卡面：显现 - 将崩毁离析放置入场，放到你的威胁区域。
// 卡面：每轮你执行的第一次技能检定期间，你得到每项技能值 -1。
// 卡面：[action]：检定[willpower](3)。如果你检定成功，弃掉崩毁离析。
//   如果你所在地点有处于横置状态的[[女巫]]敌人，本次检定自动成功。
//
// 「每轮第一次技能检定 -1」由 encounter-rules.js 的 statModifier 共享钩子按
// treacheryRule.firstTestStatModifier 执行；威胁行动由 encounterActions/performEncounterAction
// 按 threatAction 数据执行（autoSuccessWhen 是共享钩子里的通用条件 id）。

export default {
  code: '05093',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true, firstTestStatModifier: -1 },
  threatAction: {
    rule: 'discardWracked',
    label: '检定意志(3)摆脱崩毁离析',
    skills: ['willpower'],
    difficulty: 3,
    target: 'threat',
    autoSuccessWhen: 'exhaustedWitchHere',
  },
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, '05093')
    api.info?.('「崩毁离析」进入你的威胁区域。')
    return true
  },
}
