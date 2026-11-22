// 50031 假面惊骇（Masked Horrors）· 诡计 · return_to_the_midnight_masks · ×2
// 卡面：显现 - 每位拥有 2 个或更多线索的调查员受到 2 点恐惧。
//   如果未能造成任何恐惧，在当前密谋上放置 1 个毁灭标记。本效果可以导致当前密谋推进。
// 读点：treachery-tokens.js#resolveTreachery → 场景数据 entryRevelation + 条目 encounterResolve。
export default {
  code: '50031',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    void card
    void inv
    let horrorDealt = 0
    for (const other of state.investigators || []) {
      if (other.defeated || other.resigned) continue
      if ((Number(other.clues) || 0) < 2) continue
      api.horror(other.seat, 2)
      horrorDealt += 1
    }
    if (!horrorDealt) {
      api.addDoom(1)
      api.info('假面惊骇：未能造成任何恐惧，在当前密谋上放置 1 个毁灭标记。')
    } else {
      api.info(`假面惊骇：${horrorDealt} 位调查员各受到 2 点恐惧。`)
    }
    return true
  },
}
