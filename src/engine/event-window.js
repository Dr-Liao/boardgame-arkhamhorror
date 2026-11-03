import { nextInstanceId } from './rules-state.js'
// Occurrence IDs are opt-in for authored scenarios, preserving legacy replay shapes.
// Call once at the authoritative event, then reuse this context in all its windows.
export function eventWindowContext(state, context) {
  return state.scenario?.eventWindowInstances === true
    ? { ...context, windowInstance: nextInstanceId(state, 'w') } : context
}
