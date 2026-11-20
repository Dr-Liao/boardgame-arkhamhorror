import {
  ABYSS_LOCATION_ID, CAVE_LOCATION_CODES, CAVE_LOCATION_CODE_BY_ID, CAVE_LOCATION_IDS,
  LOCATIONS, LOCATION_CONNECTIONS, MIRROR_NEST_POSITIONS,
} from './definition.js'

const codeOf = location => String(location?.originalCode || location?.code || '')

export const mirrorNestInPlay = state => (state.locations || [])
  .filter(location => MIRROR_NEST_POSITIONS.includes(location.id))

/** 在场地点的连接：镜巢环 + 深渊揭示后与每个镜巢相连。 */
export function syncConnections(state) {
  const inPlay = new Map((state.locations || []).map(location => [location.id, location]))
  const abyss = inPlay.get(ABYSS_LOCATION_ID) || null
  for (const position of MIRROR_NEST_POSITIONS) {
    const location = inPlay.get(position)
    if (!location) continue
    const ring = [...(LOCATION_CONNECTIONS[position] || [])].filter(id => inPlay.has(id))
    const caves = (location.connections || []).filter(id => isCaveLocation(inPlay.get(id)))
    location.connections = [...new Set([...ring, ...caves, ...(abyss ? [ABYSS_LOCATION_ID] : [])])]
  }
  if (abyss) abyss.connections = MIRROR_NEST_POSITIONS.filter(id => inPlay.has(id))
  return state.locations || []
}

/** 「地点：放置入场，未揭示，与最近的镜巢相邻（如可能，未连接 [[洞穴]] 的镜巢）。二者相连。」 */
export function isCaveLocation(location) {
  return Boolean(location && (CAVE_LOCATION_IDS.includes(location.id) || CAVE_LOCATION_CODES.includes(codeOf(location))))
}

export function placeAbyssLocation(state, code, seat, api = {}) {
  const id = CAVE_LOCATION_IDS.find(candidate => CAVE_LOCATION_CODE_BY_ID[candidate] === String(code))
  if (!id) return null
  const existing = (state.locations || []).find(item => codeOf(item) === String(code))
  if (existing) return existing.id
  const inv = state.investigators?.[seat]
  const nests = mirrorNestInPlay(state)
  const here = nests.find(nest => nest.id === inv?.location)
  const ordered = here ? [here, ...nests.filter(nest => nest !== here)] : nests
  const nest = ordered.find(item => !(item.connections || []).some(link =>
    isCaveLocation((state.locations || []).find(location => location.id === link)))) || ordered[0]

  api.place?.(id, seat)
  let location = (state.locations || []).find(item => item.id === id)
  if (!location) {
    const def = state.scenario?.locations?.[id] || LOCATIONS[id]
    const count = Number(state.numInvestigators) || state.investigators?.length || 1
    const maxClues = def.cluesFixed ?? Number(def.cluesPerInvestigator || 0) * count
    location = { ...structuredClone(def), id, revealed: false, clues: 0, maxClues }
    ;(state.locations ||= []).push(location)
  }
  location.connections = nest ? [nest.id] : []
  if (nest) nest.connections = [...new Set([...(nest.connections || []), id])]
  const zones = state.scenarioZones ||= {}
  zones.setAsideLocations = (zones.setAsideLocations || []).filter(item => item !== id)
  api.info?.(`深渊揭示的地点 ${code} 入场（未揭示），与「${nest?.id || '镜巢'}」相连。`)
  return id
}

export function placeNightLocation(state, id, count) {
  const def = state.scenario?.locations?.[id] || LOCATIONS[id]
  if (!def) return null
  const existing = (state.locations || []).find(location => location.id === id)
  if (existing) { existing.revealed = true; return existing }
  const clues = (def.cluesPerInvestigator ?? 0) * count
  const location = { ...structuredClone(def), id, revealed: true, clues, maxClues: clues }
  state.locations ||= []
  state.locations.push(location)
  return location
}
