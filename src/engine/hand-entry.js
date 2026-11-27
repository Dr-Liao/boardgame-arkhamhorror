import { contentRegistry } from '../../content/registered.js'
import { addHandCardIcons } from './hand-icons.js'
// This records a real hand-zone transition; temporary as-if-hand transport skips it.
export function putInHand(state, investigator, code, { skillIcons } = {}) {
  const index = investigator.hand.push(code) - 1
  if (skillIcons) addHandCardIcons(state, investigator, index, skillIcons)
  const id=state.scenario?.id
  if(id&&contentRegistry.listScenarios().some(scenario=>scenario.id===id)) {
    contentRegistry.getBehavior(id).cardAddedToHand?.(state,investigator,code)
  }
  return code
}
