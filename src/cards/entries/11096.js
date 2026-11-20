import { ALL_CARDS } from '../cards-data.js'

const code = '11096'
const isAlly = asset => (ALL_CARDS[asset.code]?.traits || []).some(trait => trait.toLowerCase() === 'ally')

function healTargets(state, inv) {
  return state.investigators.filter(owner => !owner.defeated && !owner.resigned && owner.location === inv.location)
    .flatMap(owner => [
      ...(owner.damage > 0 || owner.horror > 0 ? [{ id: `seat:${owner.seat}`, owner, label: owner.name }] : []),
      ...(owner.assets || []).filter(asset => isAlly(asset) && (asset.damage > 0 || asset.horror > 0))
        .map(asset => ({ id: asset.id, owner, asset, label: ALL_CARDS[asset.code]?.nameZh || ALL_CARDS[asset.code]?.name })),
    ])
}

export default {
  code,
  playCondition: [({ state, inv }) => healTargets(state, inv).length > 0],
  abilities: [
    {
      kind: 'played', label: '治愈同地点一名调查员或盟友支援的 1 点伤害或恐惧',
      resolve: ({ state, inv, api }) => {
        const targets = healTargets(state, inv)
        if (!targets.length) return
        const id = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: code, seat: inv.seat, prompt: '选择治疗目标。',
          options: targets.map(({ id, label }) => ({ id, label })),
        })
        const target = targets.find(item => item.id === id)
        if (!target) return
        const injured = target.asset || target.owner
        const options = [
          ...(injured.damage > 0 ? [{ id: 'damage', label: '治愈 1 点伤害' }] : []),
          ...(injured.horror > 0 ? [{ id: 'horror', label: '治愈 1 点恐惧' }] : []),
        ]
        if (!options.length) return
        const kind = options.length === 1 ? options[0].id : api.choice({
          kind: 'heal', source: code, seat: inv.seat, prompt: '选择治疗类型。', options,
        })
        if (!options.some(item => item.id === kind)) return
        if (target.asset) api.healAsset(target.asset, { owner: target.owner, [kind]: 1 })
        else if (kind === 'damage') api.healDamage(target.owner.seat, 1)
        else api.healHorror(target.owner.seat, 1)
      },
    },
    {
      kind: 'reaction', trigger: 'eventPlayed', fromHand: true, noPlayCost: true,
      label: '同地点有调查员打出小憩后：支付费用，再打出一张小憩',
      criteria: ({ state, inv, context, helpers }) => context.cardCode === code && inv.location === context.location
        && healTargets(state, inv).length > 0
        && helpers.availablePlayResources(helpers.cardDef(code)) >= helpers.playCost(code),
      resolve: ({ inv, fromHandIndex, api }) => api.playAsEffect(inv.seat, code, {
        grantedEvent: true, handIndex: fromHandIndex,
      }),
    },
  ],
}
