import { contentRegistry } from '../../content/registered.js'

export const CARD_VIEW_EXPIRED = 'cardViewExpired'

export function timedCardViewRule(state, seat, enemyId) {
  if (!Number.isInteger(seat) || state.status !== 'playing' || state.uiState !== 'inScenario') return null
  const investigator = state.investigators[seat]
  if (!investigator || investigator.defeated || investigator.resigned) return null
  const ruleFor = state.scenario && contentRegistry.getBehavior(state.scenario.id)?.timedEnemyView
  if (!ruleFor) return null
  const enemy = state.enemies.find(item => item.id === enemyId)
  return enemy ? ruleFor(state, enemy) : null
}
