import { createGameState } from '../src/engine/engine.js'
import { move, settle } from './core-fixture.mjs'

export function openAbandonedWarehouse(count = 1) {
  const seats = Array.from({ length: count }, (_, seat) => ({ seat }))
  const state = createGameState({
    campaignId: 'theLabyrinthsOfLunacy', seed: 'lol-A', playerInvestigator: '01002',
  }, seats)
  settle(state, choice => choice.options.find(option => option.id === 'A')?.id)
  state.investigators[0].clues = 2 * count
  move(state, { action: 'scenarioAction', rule: 'useKeyOfMysteries' })
  settle(state)
  // 提供幕 2 的触发条件，地点仍由真实幕推进入场并翻面。
  state.doom = 11
  move(state, { action: 'resource' })
  settle(state)
  state.chaosBag = ['+1']
  return state
}
