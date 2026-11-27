// 08707 朦胧瘴气 · 显现时附属到你所在地点。回合末直接恐惧，轮末弃置。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08707'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  treacheryRule: { discardAtRoundEnd: true },
  abilities: [{
    kind: 'forced', trigger: 'turnEnded',
    label: '在所附地点结束回合：每张由你控制并有神智值的牌受到 1 点直接恐惧',
    criteria: ({ state, source, context }) => state.locations.some(location => location.id === context.location
      && location.attachments?.some(attachment => attachment.id === source.id)),
    resolve: ({ state, context, api }) => {
      const owner = state.investigators[context.seat]
      const property = 'sanity'
      for (const asset of owner.assets.slice()) {
        if ((asset[property] ?? ALL_CARDS[asset.originalCode || asset.code]?.[property]) > 0) {
          api.scenario.horrorAsset(owner.seat, asset.id, 1, { direct: true })
        }
      }
      api.directHorror(owner.seat, 1)
    },
  }],
  encounterResolve(state, inv, card, api) {
    return !!api.attachEncounterToLocation(CODE, inv.location)
  },
}
