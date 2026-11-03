import { registeredEntry } from './ability.js'

// Player attachments may grant connections used by investigators without
// altering the printed graph (which hunters and other rules also inspect).
export function investigatorConnections(state, locationId) {
  const location = state.locations?.find(item => item.id === locationId)
  if (!location) return []
  const connections = new Set(location.connections || [])
  const attachments = state.playerLocationAttachments || []
  for (const source of attachments) {
    if (source.location !== locationId || !registeredEntry(source.code)?.connectsAttachedLocations) continue
    for (const destination of attachments) {
      if (destination === source || destination.code !== source.code || destination.location === locationId) continue
      if (state.locations.some(item => item.id === destination.location)) connections.add(destination.location)
    }
  }
  return [...connections]
}
