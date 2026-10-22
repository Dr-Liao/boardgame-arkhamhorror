// 04091 困于时间
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：flux
// 卡面：显现 - 将一张你控制的非剧情的支援卡牌洗回你的牌库，将该支援卡牌上的所有伤害和恐惧移动到你的调查员上。如果没有支援卡牌通过本效果洗入牌库，则选择并弃掉你3张手牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04091', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const candidates = inv.assets.filter(asset => !asset.isStoryAsset)
    if (candidates.length) {
      const picked = candidates.length === 1 ? candidates[0] : (candidates.find(asset =>
        asset.id === api.choose({
          kind: 'asset', source: '04091', seat: inv.seat,
          prompt: '困于时间：选择一张非剧情支援洗回牌库。',
          options: candidates.map(asset => ({ id: asset.id, label: asset.name || asset.id })),
        })) || candidates[0])
      const damage = picked.damage || 0
      const horror = picked.horror || 0
      api.shuffleAssetIntoDeck(inv.seat, picked.id)
      if (damage) api.damage(inv.seat, damage)
      if (horror) api.horror(inv.seat, horror)
      return false
    }
    api.discardChosen(inv.seat, 3, '04091')
    return false
  },
}
