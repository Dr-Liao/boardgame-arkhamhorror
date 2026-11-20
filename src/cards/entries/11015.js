import { ALL_CARDS } from '../cards-data.js'

const matching = (state, inv, code) => (state.scenarioFlags?.mechanics?.beneath?.[inv.seat]?.[inv.code] || [])
  .find(item => item === code || (ALL_CARDS[item]?.name && ALL_CARDS[item].name === ALL_CARDS[code]?.name))

export default {
  code: '11015',
  abilities: [{
    kind: 'played', fast: true, trigger: 'encounterDrawn', range: 'anywhere', label: '弃掉两张同名遭遇卡并抽 1 张牌',
    criteria: ({ state, inv, context }) => !context.cannotCancel && !!matching(state, inv, context.cardCode),
    resolve: ({ state, inv, api, context }) => {
      const code = matching(state, inv, context.cardCode)
      if (code && api.cancelEncounterDraw(inv.seat)) {
        api.discardStashedEncounter(inv.seat, code)
        api.drawCards(inv.seat, 1)
      }
    },
  }],
}
