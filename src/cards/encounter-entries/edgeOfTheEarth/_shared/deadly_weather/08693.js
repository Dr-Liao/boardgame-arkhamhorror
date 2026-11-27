// 08693 雪盲危机 · 显现时附属到你所在地点。轮末弃置。
const CODE = '08693'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  treacheryRule: { discardAtRoundEnd: true, investigatorSkillModifier: -1 },
  encounterResolve(state, inv, card, api) {
    return !!api.attachEncounterToLocation(CODE, inv.location)
  },
}
