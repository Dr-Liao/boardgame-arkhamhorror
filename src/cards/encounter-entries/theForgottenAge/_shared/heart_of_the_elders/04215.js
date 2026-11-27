// 04215 落入陷阱
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：heart_of_the_elders
// 卡面：险境。
// 卡面：显现 - 你必须(选择以下一项)：
// 卡面：- 检定[agility](3)来尝试跳过这条裂隙。你检定失败且每低于难度1点，受到1点伤害。
// 卡面：- 将落入陷阱洗入探索牌库。落入陷阱如果是从探索牌库抽出的，你不能选择这个选项。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04215', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api, { encounteredFrom } = {}) {
    if (encounteredFrom !== 'exploration' && api.choose({
      kind: 'harm', source: '04215', seat: inv.seat, peril: true,
      prompt: '落入陷阱：检定敏捷(3)跳过裂隙，或把本卡洗入探索牌库。',
      options: [
        { id: 'test', label: '检定敏捷(3)：每失败 1 点受到 1 点伤害' },
        { id: 'shuffle', label: '把落入陷阱洗入探索牌库' },
      ],
    }) === 'shuffle') {
      api.addToExplorationDeck(['04215'])
      api.info?.('落入陷阱被洗回探索牌库。')
      return { placed: true }
    }
    api.test(inv.seat, 'agility', 3, result => {
      if (result.success) return
      const failedBy = Math.max(0, 3 - (result.value ?? 0))
      for (let index = 0; index < failedBy; index++) api.damage(inv.seat, 1)
    })
    return false
  },
}
