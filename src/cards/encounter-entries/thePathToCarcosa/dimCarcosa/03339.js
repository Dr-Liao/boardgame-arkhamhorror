// 03339 最后一幕
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：涌动。
// 卡面：显现 - 如果你没有剩余神智值，在当前密谋上放置2个毁灭标记。本效果能导致当前密谋推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03339', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const sanity = Math.max(0, (inv.maxSanity || 0)
      + inv.assets.reduce((sum, asset) => sum + (asset.sanityModifier || 0), 0))
    if (inv.horror >= sanity) api.addDoom(2)
    return false
  },
}
