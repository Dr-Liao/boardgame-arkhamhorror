// 06098 黑夜恐怖（Night Terrors，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：merging_realities（WN / ATSOH）。
// 卡面：Revelation - 将黑夜恐怖放置入场，放到你的威胁区域。
//       强制 - 你技能检定失败后：揭示你牌库顶的 3 张卡牌。抽取以此揭示的每张弱点卡牌，
//       将其他卡牌从游戏中移除。
//       [action] 若黑夜恐怖在你的威胁区域：检定[willpower](4)。本次检定结束后弃掉黑夜恐怖（即便失败）。
// 实现：威胁区 + 摆脱行动走 threatAction（共享层通用实现）；「检定失败后看牌库顶 3 张」需要
//   共享层 afterTest 数据分派（盲查牌库顶/弱点抽取/移出游戏原语）→ 已登记 coordinator request。
export default {
  code: '06098',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  threatAction: {
    rule: 'discardNightTerrors',
    label: '👁️ 检定意志(4)：本次检定后弃掉「黑夜恐怖」',
    skills: ['willpower'],
    difficulty: 4,
    target: 'threat',
  },
  encounterResolve(state, inv, card, api) {
    api.threat?.(inv.seat, '06098')
    api.info?.(`👁️ ${inv.name} 被「黑夜恐怖」缠上。`)
    return true
  },
  // 共享 encounterRules.afterTest 读 entryFlags.afterFailTest（弱点进手牌、其余移出游戏、同 result 幂等）。
  flags: { afterFailTest: { revealTop: 3, drawWeaknesses: true, removeRest: true } },
}
