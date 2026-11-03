import { ALL_CARDS } from '../cards/cards-data.js'
import { gridPosition, gridLocations } from './grid-map.js'
import { mechanicState } from './mechanic-state.js'

export function locationLookCandidates(state, { rowOf, aheadOf, includeRevealed = false, unrevealedNames = [] } = {}) {
  const position = rowOf == null ? null : gridPosition(state, rowOf)
  if (rowOf != null && (!position || position.isolated)) return []
  const locations = position ? gridLocations(state, { row: position.y }) : state.locations || []
  const columns = mechanicState(state)?.road?.columns || {}, current = columns[aheadOf]
  if (aheadOf != null && !Number.isSafeInteger(current)) return []
  return locations.filter(loc => (includeRevealed || !loc.revealed) && (aheadOf == null || columns[loc.id] > current) && (!unrevealedNames.length
    || unrevealedNames.includes(ALL_CARDS[loc.originalCode || loc.code]?.backName)))
}
