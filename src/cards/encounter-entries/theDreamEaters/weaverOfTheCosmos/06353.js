// 06353 陷入网中（诡计，3 张）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：Revelation - 将陷入网中放置入场，放到你的威胁区域。
//       你得到 -1[agility]，并且每轮不能进行超过一个移动行动。
//       [action]：检定[combat](3)。如果你检定成功，弃掉陷入网中。
// 接线：-1[敏捷] 用声明式修正（威胁区的 modifiers 由 modifierSourceRows 读）；
//   「每轮最多 1 次移动」写成 flags.maxMovesPerRound，由章节 behavior.moveError 读本轮移动计数；
//   摆脱行动走 threatAction（共享层 encounterActions/performEncounterAction 通用实现）。
export default {
  code: '06353',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  modifiers: [{ target: 'skill:agility', amount: -1 }],
  // weaverOfTheCosmos.behavior 用 scenarioFlags.moveCounts 计数并在 moveError 返回封锁。
  flags: { maxMovesPerRound: 1 },
  threatAction: {
    rule: 'discardCaughtInAWeb',
    label: '🕸️ 检定战斗(3)：成功弃掉「陷入网中」',
    skills: ['combat'],
    difficulty: 3,
    target: 'threat',
  },
  encounterResolve(state, inv, card, api) {
    api.threat?.(inv.seat, '06353')
    api.info?.(`🕸️ ${inv.name} 被「陷入网中」缠住（-1 敏捷，每轮最多 1 次移动）。`)
    return true
  },
}
