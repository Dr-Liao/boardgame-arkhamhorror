import { suspectCode } from './role-data.js'
import { chapterData, physicalLocationId } from './chapter-definition.js'
import { concealPhysicalLocations, locationId, shuffled, initKeys } from './chapter-setup.js'
import { KEY_COLORS } from '../../../src/engine/scenario-keys.js'

const hasMemory = (state, memory) => (state.campaign.records.memoriesRecovered || []).includes(memory)
const expand = cards => (cards || []).flatMap(c => Array(c.count ?? c.quantity).fill(c.printedCode))
const codeOf = code => physicalLocationId(code)
const initialPosition = (state, id, x, y) => (state.scenarioFlags.initialPositions ||= []).push({ id, x, y })

export function lateSetupLocations(state, events, deps) {
  const id = state.scenario.id, facts = chapterData[id].setup
  state.scenarioFlags.initialPositions = []
  if (id === 'aLightInTheFog') {
    for (const loc of facts.initialLocations) initialPosition(state, codeOf(loc.physicalId), loc.position.column, loc.position.row)
    return facts.initialLocations.map(loc => codeOf(loc.physicalId))
  }
  if (id === 'theLairOfDagon') {
    const selected = facts.agendaDeck.map(a => a.code || (hasMemory(state, a.ifMemory) ? a.then : a.else))
    state.agendas.splice(0, state.agendas.length, ...selected.map(code => structuredClone(state.scenario.stageCards[code])))
    const positions = { grandEntryway: [1, 2], foulCorridors: [1, 1], thirdFloorHall: [1, 0],
      firstFloorHall1: [0, 2], firstFloorHall2: [2, 2], secondFloorHall1: [0, 1], secondFloorHall2: [2, 1] }
    const placed = facts.initialLocations.map(loc => { const id = codeOf(loc.code); initialPosition(state, id, ...positions[loc.slot]); return id })
    for (const group of facts.randomInitialSlots) {
      const pool = shuffled(state, expand(group.pool), deps)
      concealPhysicalLocations(state, pool, deps)
      for (const [index, physical] of pool.entries()) {
        const id = locationId(state, physical)
        placed.push(id); initialPosition(state, id, ...positions[group.slots[index]])
      }
    }
    return placed
  }
  if (id === 'intoTheMaelstrom') {
    const all = chapterData[id].locations.filter(loc => loc.code !== facts.start).map(loc => loc.id)
    concealPhysicalLocations(state, all, deps)
    const physicalPool = chapterData[id].locations.filter(loc => ['07319', '07102', '07103', '07104'].includes(loc.code)).map(loc => loc.id)
    const pool = shuffled(state, physicalPool, deps)
    initialPosition(state, state.scenario.startLocation, 0, 0)
    for (const [index, physical] of pool.entries()) initialPosition(state, locationId(state, physical), ...facts.initialRandomLocations.slots[index])
    return state.scenarioFlags.initialPositions.map(loc => loc.id)
  }
  throw new Error(`No late setup for ${id}`)
}

export function lateAfterDeckSetup(state, events, { api, ...deps }) {
  const id = state.scenario.id, spec = chapterData[id], facts = spec.setup
  const map = api.mechanics.map
  map.configure({ adjacency: id === 'aLightInTheFog' ? 'row' : id === 'theLairOfDagon' ? 'none' : 'orthogonal' })
  for (const loc of state.scenarioFlags.initialPositions) map.place(loc.id, loc.x, loc.y)
  state.scenarioZones.setAside = [...spec.reservedEncounter]
  if (id === 'aLightInTheFog') {
    initKeys(api, facts.keys.faceupAside)
    api.storyAsset('07252', null)
    for (const item of facts.conditionalSetAsideAssets) if (state.campaign.records[item.record]) state.scenarioZones.setAside.push(item.code)
    const doom = facts.initialDoom.sum.reduce((sum, rule) => sum + (state.campaign.records[rule.ifRecord] ? rule.amount : 0), 0)
    if (doom) api.addDoom(doom)
  } else if (id === 'theLairOfDagon') {
    initKeys(api, facts.keys.faceupAside)
    state.scenarioZones.setAside.push('07292a', '07300')
    if (hasMemory(state, 'AJailbreak') && suspectCode(state.campaign.records.harperSuspect)) state.scenarioZones.setAside.push(suspectCode(state.campaign.records.harperSuspect))
    if (!hasMemory(state, 'ADecisionToStickTogether')) state.scenarioZones.setAside.push('07082')
  } else if (id === 'intoTheMaelstrom') {
    const held = facts.keyRecordRecipients.filter(item => state.campaign.records[item.record]).map(item => item.key)
    const hidden = [...facts.keyRecordRecipients.map(item => item.key).filter(color => !held.includes(color)), ...shuffled(state, ['purple', 'white', 'black'], deps)].slice(0, 4)
    const recipients = {}
    for (const color of held) recipients[color] = state.investigators.length === 1 ? 0 : Number(api.choose({ kind: 'investigator', source: 'maelstromKeys',
      seat: state.campaign.leadSeat, prompt: `选择由谁持有${color}钥匙。`, options: state.investigators.map(inv => ({ id: String(inv.seat), label: inv.name })) }))
    api.mechanics.keys.initialize(KEY_COLORS.map(color => ({ color, revealed: held.includes(color),
      holder: held.includes(color) ? `investigator:${recipients[color]}` : hidden.includes(color) ? 'setAside' : 'removed' })))
    state.scenarioZones.setAside.push(...facts.setAsidePhysical.map(physical => physical.face || physical.faceIfRecord?.else))
    for (const inv of state.investigators) if (state.campaign.investigators[inv.seat]?.records?.PossessesADivingSuit
      || state.campaign.investigators[inv.seat]?.PossessesADivingSuit) api.giveAsset(inv.seat, facts.divingSuits.code)
    api.mechanics.water.set(state.scenario.startLocation, 1)
  }
  api.reveal(state.scenario.startLocation)
  state.scenario.setAsideLocations = Object.keys(state.scenario.locations).filter(id => !state.locations.some(loc => loc.id === id))
}

export function lateAfterChaosBagSetup(state, events, api) {
  if (state.scenario.id !== 'theLairOfDagon') return
  const count = (state.campaign.records.memoriesRecovered || []).length
  api.mechanics.chaosTokens.add(count <= 4 ? 'bless' : 'curse', count <= 4 || count >= 8 ? 5 : 2)
  if (hasMemory(state, 'ADecisionToStickTogether')) {
    const inv = state.investigators.length === 1 ? state.investigators[0] : state.investigators[Number(api.choose({ kind: 'investigator',
      source: '07082', seat: state.campaign.leadSeat, prompt: '选择控制托马斯·道森的调查员。',
      options: state.investigators.map(inv => ({ id: String(inv.seat), label: inv.name })) }))]
    api.giveAsset(inv.seat, '07082')
  }
}
