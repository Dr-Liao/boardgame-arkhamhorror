// 08736 辛哈的医药箱（Sinha 的医药箱）· 剧情资产 · memorials_of_the_lost
// 卡面：使用(3补给)。[free]横置并花费 1 补给：治愈你所在地点的一位调查员或一个[[盟友]]支援
//   1 点伤害或 1 点恐惧。
// 读点：api.healDamage / api.healHorror / api.healAsset（伤害或恐惧二选一）。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08736'
const isAlly = card => (ALL_CARDS[card?.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  uses: 3, usesType: 'supplies',
  flags: { memorial: true },
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '横置并花费 1 补给：治愈同地点调查员/盟友 1 伤害或 1 恐惧',
    cost: { exhaust: true, uses: 1 },
    resolve: ({ state, inv, source, api }) => {
      const mates = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === inv.location)
      const allies = mates.flatMap(owner => (owner.assets || []).filter(asset => asset !== source && isAlly(asset))
        .map(asset => ({ owner, asset })))
      const targets = [
        ...mates.map(other => ({ id: 'inv:' + other.seat, ownerSeat: other.seat, label: other.name || '调查员' })),
        ...allies.map(item => ({ id: 'asset:' + item.asset.id, ownerSeat: item.owner.seat, card: item.asset, label: ALL_CARDS[item.asset.code]?.nameZh || item.asset.code })),
      ]
      if (!targets.length) return
      const target = targets.length === 1 ? targets[0] : targets.find(item => item.id === api.choice({
        kind: 'effect', source: CODE, seat: inv.seat, prompt: '选择治愈目标。', options: targets.map(item => ({ id: item.id, label: item.label })),
      })) || targets[0]
      const kind = api.choice({ kind: 'effect', source: CODE, seat: inv.seat, prompt: '治愈 1 点伤害，还是 1 点恐惧？',
        options: [{ id: 'damage', label: '1 点伤害' }, { id: 'horror', label: '1 点恐惧' }] })
      if (target.card) api.healAsset(target.card, kind === 'damage' ? { damage: 1, ownerSeat: target.ownerSeat } : { horror: 1, ownerSeat: target.ownerSeat })
      else if (kind === 'damage') api.healDamage(target.ownerSeat, 1)
      else api.healHorror(target.ownerSeat, 1)
    },
  }],
}

