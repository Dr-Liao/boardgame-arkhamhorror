// 03085 深陷疯狂
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：delusions
// 卡面：涌动。
// 卡面：显现 - 如果你身上有至少3点恐惧，失去1个行动。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03085', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    if (inv.horror >= 3) inv.actionsLeft = Math.max(0, inv.actionsLeft - 1)
    return false
  },
}
