// 60452 祖母的护符（Grand-Mère's Charm，Marie Lambeau 专属）
// 卡面：玛丽·朗博牌库专用。
//       [fast] 受到 1 点直接伤害并横置祖母的护符：补充你所在地点一个支援的 1 点充能。
import { ownSeat } from '../../engine/matcher.js'

const chargedAssetsAt = (state, inv) => (state.investigators || [])
  .filter(owner => owner.location === inv.location && !owner.defeated)
  .flatMap(owner => (owner.assets || []).filter(asset => asset.usesType === 'charges'))

export default {
  code: '60452',
  abilities: [{
    kind: 'free',
    label: '受到 1 点直接伤害并横置：补充同地点支援 1 充能',
    cost: { exhaust: true },
    criteria: [ownSeat(), ({ state, inv }) => chargedAssetsAt(state, inv).length > 0],
    resolve: ({ state, inv, api }) => {
      api.directDamage(inv.seat, 1)
      const charged = chargedAssetsAt(state, inv)
      if (!charged.length) return
      const chosen = charged.length === 1 ? charged[0].id : api.choice({
        kind: 'card', source: '60452', seat: inv.seat,
        prompt: '选择要补充充能的支援。',
        options: charged.map(asset => ({ id: asset.id, cardCode: asset.code, label: api.cardName(asset.code) })),
      })
      const asset = charged.find(item => item.id === chosen) || charged[0]
      api.addUses(asset, 1)
    },
  }],
}
