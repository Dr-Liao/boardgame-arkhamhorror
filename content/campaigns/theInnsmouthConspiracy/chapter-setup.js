import { SUSPECTS, HIDEOUTS, printedRole } from './role-data.js'
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { chapterData, physicalLocationId } from './chapter-definition.js'
import { KEY_COLORS } from '../../../src/engine/scenario-keys.js'

// Chapter setup may arrange physical cards and chapter-private information.
// Individual card instructions remain in their registered entry files.
export const locationId = (state, physicalId) => state.scenarioFlags.innsmouthLocations?.[physicalId] || physicalLocationId(physicalId)
export const shuffled = (state, cards, deps) => deps.shuffle([...cards], () => deps.randomValue(state))
export function concealPhysicalLocations(state, ids, deps) {
  const templates = shuffled(state, ids, deps)
  const backs = new Map()
  for (const loc of Object.values(state.scenario.locations).sort((a, b) => a.originalCode.localeCompare(b.originalCode))) {
    if (!backs.has(loc.unrevealedNameEn)) backs.set(loc.unrevealedNameEn, loc.originalCode)
  }
  const mapping = state.scenarioFlags.innsmouthLocations ||= {}
  for (const [index, physical] of templates.entries()) {
    const old = physicalLocationId(physical), opaque = `innsmouthLocation${Object.keys(mapping).length + 1}`
    const original = state.scenario.locations[old]
    if (!original) throw new Error(`Missing physical location ${physical}`)
    mapping[physical] = opaque
    const artCode = backs.get(original.unrevealedNameEn)
    state.scenario.locations[opaque] = { ...original, id: opaque, hiddenIdentity: true, artCode,
      name: original.unrevealedName, nameEn: original.unrevealedNameEn,
      unrevealedActualName: original.name, unrevealedActualNameEn: original.nameEn }
    delete state.scenario.locations[old]
  }
  return ids.map(id => mapping[id])
}
function revealSetup(state, ids, api) {
  for (const id of ids) api.reveal(id)
}
export function initKeys(api, faceup = [], removed = []) {
  api.mechanics.keys.initialize(KEY_COLORS.map(color => ({ color, revealed: faceup.includes(color), holder: removed.includes(color) ? 'removed' : 'setAside' })))
}

export function earlySetupLocations(state, events, deps) {
  const id = state.scenario.id, spec = chapterData[id]
  if (id === 'thePitOfDespair') {
    const physical = spec.setup.randomTunnelPhysicalPool
    const pool = shuffled(state, concealPhysicalLocations(state, physical, deps), deps)
    state.scenarioFlags.initialTunnelPositions = pool.slice(0, 3).map((id, index) => ({ id, point: spec.setup.adjacentInitialPositions[index] }))
    state.scenarioFlags.pitTunnelReserve = pool.slice(3)
    return [state.scenario.startLocation, ...pool.slice(0, 3)]
  }
  if (id === 'theVanishingOfElinaHarper') return spec.setup.initialLocations.map(physicalLocationId)
  if (id === 'inTooDeep') return Object.keys(spec.grid).map(physicalLocationId)
  throw new Error(`No early setup for ${id}`)
}

export function earlyAfterDeckSetup(state, events, { api, ...deps }) {
  const id = state.scenario.id, spec = chapterData[id], map = api.mechanics.map
  state.scenarioZones.setAside = spec.reservedEncounter.filter(code => ALL_CARDS[code]?.type !== 'location')
  if (id === 'thePitOfDespair') {
    initKeys(api, ['blue', 'green'], ['black', 'white'])
    map.place(state.scenario.startLocation, 0, 0)
    for (const { id, point } of state.scenarioFlags.initialTunnelPositions) map.place(id, ...point)
    revealSetup(state, [state.scenario.startLocation], api)
  } else if (id === 'theVanishingOfElinaHarper') {
    const suspect = shuffled(state, spec.setup.suspects, deps)[0], hideout = shuffled(state, spec.setup.hideouts, deps)[0]
    api.mechanics.scenarioDecks.initialize('harperAnswers', [suspect, hideout], { shuffle: false })
    api.mechanics.scenarioDecks.initialize('leads', [...spec.setup.suspects, ...spec.setup.hideouts].filter(code => code !== suspect && code !== hideout))
    state.scenarioZones.setAside.push(...['07082','07083'].filter(code=>!state.scenarioZones.setAside.includes(code)))
    api.storyAsset('07062a', null)
    state.scenarioFlags.crossedOff = []
    revealSetup(state, [state.scenario.startLocation], api)
  } else if (id === 'inTooDeep') {
    state.scenarioZones.setAside.push('07150','07151','07062b')
    for (const [physical, point] of Object.entries(spec.grid)) map.place(physicalLocationId(physical), ...point)
    for (const [a, b, count] of spec.initialBarriers) api.mechanics.barriers.set(physicalLocationId(a), physicalLocationId(b), count, { setup: true })
    initKeys(api, [], ['black'])
    for (const code of ['07132', '07138', '07143']) api.mechanics.water.set(physicalLocationId(code), 1)
    const hideout = printedRole(HIDEOUTS, state.campaign.records.harperHideout || state.campaign.records.circledHideout)
    if (spec.blackKeyMap[hideout]) api.mechanics.keys.transfer('black', 'removed', `location:${physicalLocationId(spec.blackKeyMap[hideout])}`, { reveal: true })
    for (const suspect of state.campaign.records.outForBlood || []) {
      const code = printedRole(SUSPECTS, suspect)
      const home = spec.suspectHomeMap[code]
      if (home) api.spawn(code, physicalLocationId(home))
    }
    revealSetup(state, [state.scenario.startLocation], api)
  }
  state.scenario.setAsideLocations = Object.keys(state.scenario.locations).filter(id => !state.locations.some(loc => loc.id === id))
}
