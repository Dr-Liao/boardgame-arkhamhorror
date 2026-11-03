// 06156 “吃一堑……”：结算后的诡计附属在本卡下；下次同名显现可弃本卡取消。
import { ALL_CARDS } from '../../cards/cards-data.js'

const printedName = (state, code) => ALL_CARDS[code]?.name
  || ALL_CARDS[state.scenario?.treacheries?.[code]?.originalCode]?.name
  || state.scenario?.treacheries?.[code]?.name || code

export default {
  code: '06156',
  keepOnPlay: true,
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'treacheryWouldDiscard',
      criteria: { selfOnly: true },
      label: '把已结算的诡计附属到“吃一堑……”',
      resolve: ({ inv, api }) => {
        const asset = api.putSelfIntoPlay(inv.seat, '06156')
        if (!asset || !api.attachResolvingEncounter(asset)) return
        api.info('「吃一堑……」放置入场，并附属已结算的诡计。')
      },
    },
    {
      kind: 'reaction', trigger: 'encounterDrawn',
      label: '弃掉“吃一堑……”：取消同名诡计的显现',
      criteria: [({ state, source, context }) => Boolean(context?.cardCode)
        && (source?.attachments || []).some(card => card.encounterAttached
          && printedName(state, card.code) === printedName(state, context.cardCode))],
      cost: { discardSelf: true },
      resolve: ({ inv, api }) => { api.cancelEncounterDraw(inv.seat) },
    },
  ],
  modifiers: [],
}
