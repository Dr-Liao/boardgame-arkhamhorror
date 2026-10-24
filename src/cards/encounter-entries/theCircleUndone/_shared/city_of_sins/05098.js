// 05098 邪恶往昔
// 归属：战役共用 · theCircleUndone；遭遇组：city_of_sins
// 卡面：显现 - 如果你的威胁区域里没有邪恶往昔，将邪恶往昔放置入场，位于你的威胁区域
//   （如果已有邪恶往昔，改为将本卡牌弃掉并获得涌动）。
// 卡面：强制 - 在遭遇牌库的卡牌耗尽时：受到 2 点恐惧并检定[willpower](3)。如果你检定成功，弃掉邪恶往昔。
// 卡面：[action]：检定[willpower](3)。如果你检定成功，弃掉邪恶往昔。
//
// 威胁区规则：treacheryRule 的数据字段由 encounter-rules.js 的共享钩子半通用执行
// （encounterDrawn → encounterDeckEmptyForced；encounterActions/performEncounterAction → threatAction）。

export default {
  code: '05098',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    threatArea: true,
    encounterDeckEmptyForced: { horror: 2, test: { skill: 'willpower', difficulty: 3, discardOnSuccess: true } },
  },
  threatAction: {
    rule: 'discardEvilPast',
    label: '检定意志(3)摆脱邪恶往昔',
    skills: ['willpower'],
    difficulty: 3,
    target: 'threat',
  },
  encounterResolve(state, inv, card, api) {
    const hasCopy = (inv.threat || []).some(item => (item.originalCode || item.code) === '05098')
    if (!hasCopy) {
      api.threat(inv.seat, '05098')
      api.info?.('「邪恶往昔」进入你的威胁区域。')
      return true
    }
    api.info?.('你的威胁区域里已有「邪恶往昔」：本卡被弃掉并获得涌动。')
    api.drawEncounter?.(inv.seat)
    return false
  },
}
