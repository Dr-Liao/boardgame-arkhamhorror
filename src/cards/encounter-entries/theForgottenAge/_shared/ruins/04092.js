// 04092 不祥之兆
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：ruins
// 卡面：险境。
// 卡面：显现 - 选择一个至少有1位调查员的地点。在该地点上放置1个毁灭标记。所选地点的每位调查员受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04092', scope: 'treachery', implemented: true,
  // 第 120 轮：显现结算只保留这一份实现（章节在 effect 前选择的选项 id/顺序与旧分支一致）。
  encounterResolve(state, inv, card, api) {
    const alive = state.investigators.filter(item => !item.defeated && !item.resigned)
    const candidates = state.locations.filter(entry => alive.some(target => target.location === entry.id))
    if (!candidates.length) {
      state.doom = (state.doom || 0) + 1
      return false
    }
    const picked = candidates.length === 1 ? candidates[0] : (() => {
      const id = api.choose({
        kind: 'location', source: '04092', seat: inv.seat, peril: true,
        prompt: '不祥之兆：选择放置 1 点毁灭的地点。',
        options: candidates.map(entry => ({ id: String(entry.id), label: entry.name || entry.id })),
      })
      return candidates.find(entry => String(entry.id) === String(id)) || null
    })()
    if (picked) {
      picked.doom = (picked.doom || 0) + 1
      for (const target of alive.filter(entry => entry.location === picked.id)) api.horror(target.seat, 1)
    }
    return false
  },
}
