// 04080 毒蛇噬咬
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：serpents
// 卡面：显现 - 检定[agility](3)。如果你检定失败，你必须 (选择一项)：
// 卡面：- 对你控制的一个[[盟友]]支援造成5点伤害。
// 卡面：- 受到1点直接伤害。如果你未中毒，将放在一边的一张中毒弱点卡牌放置入场，放到你的威胁区域。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { hasTrait, ALL_CARDS, originalOf } from '../../../_shared.js'

export default {
  code: '04080', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'agility', 3, result => {
      if (result.success) return
      const allies = inv.assets.filter(asset => hasTrait(asset, 'Ally'))
      const options = [{ id: 'damage', label: '受到 1 点直接伤害（若未中毒则中毒）' }]
      if (allies.length) options.unshift({ id: 'ally', label: '对一个盟友支援造成 5 点伤害' })
      const answer = api.choose({
        kind: 'harm', source: '04080', seat: inv.seat,
        prompt: '毒蛇噬咬：选择承受 5 点盟友伤害，或 1 点直接伤害（并可能中毒）。',
        options,
      })
      if (answer === 'ally' && allies.length) {
        const allyId = api.choose({
          kind: 'asset', source: '04080', seat: inv.seat,
          prompt: '选择受到 5 点伤害的盟友支援。',
          options: allies.map(asset => ({ id: asset.id, label: ALL_CARDS[originalOf(asset)]?.nameZh || asset.name || asset.code })),
        })
        const target = allies.find(asset => asset.id === allyId) || allies[0]
        api.damageAsset(inv.seat, target.id, 5)
        return
      }
      api.directDamage(inv.seat, 1)
      const poisoned = (inv.threat || []).some(item => originalOf(item) === '04102') || inv.poisoned === true
      if (!poisoned) api.poison(inv.seat)
    })
    return false
  },
}
