import { registeredEntry } from './ability.js'

export function locationGroupClueCost(state, location) {
  const cost = registeredEntry(location?.originalCode || location?.code)?.locationRule?.entryCost
  if (cost?.kind !== 'groupClues' || (cost.onlyUnrevealed && location.revealed)) return null
  return {
    count: cost.perInvestigator * state.numInvestigators,
    scope: cost.scope === 'connected' ? location.connections || [] : 'here',
  }
}

export function groupCluePayers(state, inv, canSpend = () => true, scope = 'here') {
  return state.investigators.filter(other => !other.defeated && !other.resigned && (scope === 'anywhere'
    || (Array.isArray(scope) ? scope.includes(other.location) : other.location === inv.location)) && canSpend(other))
}
export function groupClueTotal(state, inv, canSpend, scope) {
  return groupCluePayers(state, inv, canSpend, scope).reduce((sum, other) => sum + (other.clues || 0), 0)
}
export function payGroupClueCost(state, inv, count, choose, canSpend, scope = 'here') {
  if (groupClueTotal(state, inv, canSpend, scope) < count) return false
  for (let i = 0; i < count; i++) {
    const payers = groupCluePayers(state, inv, canSpend, scope).filter(other => other.clues > 0)
    const payer = payers.length === 1 ? payers[0] : state.investigators[Number(choose({ kind: 'effect', source: 'groupClues', seat: inv.seat,
      prompt: scope === 'here' ? '选择本地点支付线索的调查员。' : '选择支付线索的调查员。', options: payers.map(other => ({ id: String(other.seat), label: other.name })) }))]
    if (!payers.includes(payer)) throw new Error('Group clue payer is no longer eligible')
    payer.clues--
  }
  return true
}
