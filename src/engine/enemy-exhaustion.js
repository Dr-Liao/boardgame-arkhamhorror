import { hasWindowListener } from './window-listeners.js'

export function exhaustEnemy(state, enemy, seat, events, reactionWindow) {
  if (enemy.exhausted) return false
  enemy.exhausted = true
  if (hasWindowListener(state, 'enemyExhausted')) {
    reactionWindow(state, 'enemyExhausted', {
      when: 'enemyExhausted', enemy, seat, location: enemy.location,
    }, events, { allowNested: true })
  }
  return true
}
