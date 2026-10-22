// 03337 阴郁诅咒
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：显现 - 检定[willpower](3)。如果你没有剩余神智值，本次检定得到+2难度。如果你检定失败，受到2点伤害(如果你身上的恐惧数量大于你神智值的两倍，改为4点伤害)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03337', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const sanity = Math.max(0, (inv.maxSanity || 0)
      + inv.assets.reduce((sum, asset) => sum + (asset.sanityModifier || 0), 0))
    api.test(inv.seat, 'willpower', Math.max(0, sanity - inv.horror) === 0 ? 5 : 3, result => {
      if (!result.success) api.damage(inv.seat, inv.horror > 2 * sanity ? 4 : 2)
    })
    return false
  },
}
