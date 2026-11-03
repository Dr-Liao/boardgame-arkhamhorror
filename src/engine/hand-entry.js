import { contentRegistry } from '../../content/registered.js'
// This records a real hand-zone transition; temporary as-if-hand transport skips it.
export function putInHand(state, investigator, code) {
  investigator.hand.push(code)
  const id=state.scenario?.id
  if(id&&contentRegistry.listScenarios().some(scenario=>scenario.id===id)) {
    contentRegistry.getBehavior(id).cardAddedToHand?.(state,investigator,code)
  }
  return code
}
