// 04093 先祖恐惧
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：ruins
// 卡面：险境。涌动。
// 卡面：显现 - 你必须 (选择以下一项)：
// 卡面：- 在你所在地点放置1个毁灭标记并弃掉先祖恐惧 (而不是将它放到胜利区)。
// 卡面：- 将先祖恐惧放到胜利区。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04093', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api, { location }) {
    const answer = api.choose({
      kind: 'harm', source: '04093', seat: inv.seat, peril: true,
      prompt: '先祖恐惧：在你所在地点放置 1 点毁灭并弃掉本卡，或把本卡放进胜利区。',
      options: [{ id: 'doom', label: '在所在地点放置 1 点毁灭' }, { id: 'victory', label: '放进胜利区' }],
    })
    if (answer === 'victory') {
      state.victoryDisplay.push({ id: `ancestral-fear:${state.round}:${inv.seat}`,
        code: '04093', originalCode: '04093', victory: 0, vengeance: 1 })
      return false
    }
    if (location) location.doom = (location.doom || 0) + 1
    else state.doom = (state.doom || 0) + 1
    return false
  },
}
