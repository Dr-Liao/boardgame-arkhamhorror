export function gloriaEntry(code) {
  return {
    code,
    investigator: { chooseMythosOrder: true, encounterLook: true, elderSign: { bonus: 1 } },
    elderSign: { id: code + '-sign', resolve: ({ inv, api }) => {
      api.lookAt(inv.seat, { zone: 'encounterDeck', count: 1, choose: 0, showCards: true, returnStrategy: 'top', source: inv.code })
      return { delta: 1 }
    } },
    abilities: [{
      kind: 'reaction', trigger: 'encounterCardsLookedAt', label: '多看 1 张，处理其中 1 张非精英牌',
      criteria: ({ inv, context }) => inv.seat === context.seat && !context.extraLookUsed,
      resolve: ({ inv, context, api }) => api.sortEncounterLook(inv.seat, context),
    }],
  }
}
export default gloriaEntry('11014')
