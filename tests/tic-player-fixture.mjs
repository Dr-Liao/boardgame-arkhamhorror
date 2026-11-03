// Test-only seeds; all subsequent commands use the real HTTP engine and card entries.
import { fixture, asset, enemy } from './core-fixture.mjs'
import { legalMoves } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
export function playerFixture(kind) {
  const state = fixture('01001', kind === 'grimoire' ? 2 : 1), inv = state.investigators[0]
  state.humanSeats = state.investigators.map(inv => inv.seat)
  if (kind === 'grimoire') {
    asset(state, '07191', { uses: 2 })
    Object.assign(inv, { hand: ['02105'], resources: 1, actionsLeft: 0, damage: 2 })
    enemy(state, { damage: 1 })
  } else if (kind === 'ancestral') {
    const host = asset(state, '07303')
    inv.hand = ['01089', '01090']
    const api = createMechanicsApi(state)
    for (const code of [...inv.hand]) api.commitOrigins.store(0, host.id, code)
  } else throw new Error('Unknown player fixture')
  state.legalMoves = legalMoves(state, 0)
  return state
}
