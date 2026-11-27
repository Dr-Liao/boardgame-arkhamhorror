import { ALL_CARDS } from '../../../_shared.js'

export function partnerHealingAbility(kind, harm, supplyLabel) {
  const harmLabel = harm === 'damage' ? '伤害' : '恐惧'
  return {
    kind, actionKind: 'activate',
    label: `花费 1 ${supplyLabel}并横置：治愈同地点调查员或另一个盟友支援 2 点${harmLabel}`,
    cost: { ...(kind === 'action' ? { action: 1 } : {}), exhaust: true, uses: 1 },
    resolve: ({ state, inv, source, api }) => {
      const investigators = state.investigators.filter(other =>
        !other.defeated && !other.resigned && other.location === inv.location)
      const allies = investigators.flatMap(owner => (owner.assets || [])
        .filter(asset => asset !== source && (ALL_CARDS[asset.code]?.traits || []).some(trait => trait.toLowerCase() === 'ally'))
        .map(asset => ({ asset, owner })))
      const options = [
        ...investigators.map(other => ({ id: `inv:${other.seat}`, label: other.name })),
        ...allies.map(({ asset }) => ({ id: `asset:${asset.id}`, label: api.cardName(asset.code) })),
      ]
      if (!options.length) return
      const picked = options.length === 1 ? options[0].id : api.choice({
        kind: 'effect', source: source.code, seat: inv.seat,
        prompt: `选择治愈 2 点${harmLabel}的同地点调查员或盟友支援。`, options,
      })
      if (!picked) return
      if (picked.startsWith('inv:')) {
        const seat = Number(picked.slice(4))
        return harm === 'damage' ? api.healDamage(seat, 2) : api.healHorror(seat, 2)
      }
      const target = allies.find(({ asset }) => `asset:${asset.id}` === picked)
      if (target) api.healAsset(target.asset, { [harm]: 2, ownerSeat: target.owner.seat })
    },
  }
}
