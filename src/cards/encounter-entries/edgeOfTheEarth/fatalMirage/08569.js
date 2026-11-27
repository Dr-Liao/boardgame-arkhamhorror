// 08569 戴尔的教室
import { partnerShroud } from './_shared.js'
import { ALL_CARDS } from '../../_shared.js'
import { tekeliDeckSize } from '../../_shared.js'

function targets(state, inv) {
  const locals = state.investigators.filter(owner => !owner.defeated && !owner.resigned && owner.location === inv.location)
  return locals.flatMap(owner => [
    ...(owner.horror > 0 ? [{ id: 'inv:' + owner.seat, label: owner.name, owner }] : []),
    ...owner.assets.filter(asset => asset.horror > 0 && ALL_CARDS[asset.code]?.traits?.includes('Ally'))
      .map(asset => ({ id: asset.id, label: ALL_CARDS[asset.code].nameZh || ALL_CARDS[asset.code].name, cardCode: asset.code, owner, asset })),
  ])
}

export default {
  code: '08569', scope: 'location', implemented: true,
  flags: { mirageId: 'dyersClassroom', tier: 2 },
  locationRule: { shroudModifier: partnerShroud('08587', '08714') },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '洗入 1 张忒咳哩-哩：治愈同地点调查员或盟友 1 恐惧',
    criteria: ({ state, inv }) => tekeliDeckSize(state) >= 1 && targets(state, inv).length > 0,
    resolve: ({ state, inv, source, api }) => {
      const choices = targets(state, inv)
      const option = choices.length === 1 ? choices[0].id
        : api.choice({ kind: 'card', source: source.id, seat: inv.seat, prompt: '选择治愈恐惧的目标。', options: choices })
      const chosen = choices.find(choice => choice.id === option)
      if (!chosen || !api.mechanics.tekeli.shuffleIn(inv.seat, 1)?.length) return
      if (chosen.asset) api.healAsset(chosen.asset, { owner: chosen.owner, horror: 1 })
      else api.healHorror(chosen.owner.seat, 1)
    },
  }],
}
