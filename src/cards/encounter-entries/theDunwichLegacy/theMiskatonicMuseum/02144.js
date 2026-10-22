// 02144 通往异界的道路
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：显现 - 检定[willpower](3)。如果追猎恐魔位于你所在地点，本次检定+2难度。如果你检定失败，你必须(选择一项)：弃掉你牌库顶5张卡牌，或受到1点直接伤害并对你每个[[盟友]]支援造成1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '02144', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const horror = state.enemies.find(enemy => enemy.code === '02141')
    api.test(inv.seat, 'willpower', 3 + (horror?.location === inv.location ? 2 : 0), result => {
      if (result.success) return
      const choice = api.choose({ kind: 'encounter', source: code, seat: inv.seat,
        prompt: '通往异界的道路：弃掉牌库顶 5 张，或受到 1 点直接伤害并使每位盟友受到 1 点伤害。',
        options: [{ id: 'mill', label: '弃掉牌库顶 5 张' }, { id: 'damage', label: '承受直接伤害并伤害盟友' }] })
      if (choice === 'mill') api.discardTop(inv.seat, 5)
      else {
        api.directDamage(inv.seat, 1)
        for (const ally of [...inv.assets].filter(asset => (ALL_CARDS[asset.code]?.traits || [])
          .some(trait => String(trait).toLowerCase() === 'ally'))) {
          api.damageAsset(inv.seat, ally.id, 1)
        }
      }
    })
    return false
  },
}
