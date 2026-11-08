// D 审计运行时探针 2：Part2 议程阈值 / 08716 崩溃 / 08679 方向 / 高塔攻击难度
import fs from 'node:fs'
import 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/engine.js'
import { registerCampaignScenarios, scenarioRuntime } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/engine.js'
import { registerContentBundle, contentRegistry } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/registered.js'
import { manifest as campaign } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/manifest.js'
import * as p2 from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/index.js'
import { registerCardAbilities, registeredEntry } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/ability.js'
import { fixture } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/tests/core-fixture.mjs'
import { activateSeal, placeDormantSeal, recoverSeal, sealsOf } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/campaign/eote-seals.js'
import { towerHealth, towerState } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/eote-facilities.js'
import entry08716 from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08716.js'
import entry08679 from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08679.js'

const chapter = p2
const testCampaign = {
  ...campaign, status: 'playable', scenarioIds: [chapter.manifest.id], unlock: { [chapter.manifest.id]: [] },
  recordSchema: { drKenslerHasAPlan: 'boolean', theTruthOfTheMirageEludesYou: 'boolean', theNamelessMadnessIsContainedSafelyWithinItsHostForNow: 'boolean', theFacilityWasDestroyed: 'boolean', theTeamEscapedTheFacility: 'boolean', theSurvivorsOfTheExpeditionWere: 'string[]' },
}
try { if (!contentRegistry.getCampaign('edgeOfTheEarth')) registerContentBundle({ campaigns: [testCampaign], scenarios: [chapter] }) } catch (e) { console.log('register err', e.message) }
try { registerCampaignScenarios('edgeOfTheEarth') } catch (e) { console.log('registerCampaign err', e.message) }
for (const entry of chapter.implementedEncounterCodes.map(c => registeredEntry(c))) { /* already registered */ }

const json = v => JSON.parse(JSON.stringify(v))
function buildState(count = 2) {
  const state = fixture('01001', count)
  state.campaign.id = 'edgeOfTheEarth'; state.campaign.records = {}; state.campaign.eote = {}
  state.scenario = json(chapter.scenario); state.acts = json(state.scenario.acts); state.agendas = json(state.scenario.agendas)
  state.actIndex = 0; state.agendaIndex = 0; state.scenarioFlags = {}; state.scenarioZones = {}
  state.locations = []; state.enemies = []; state.storyAssets = []; state.victoryDisplay = []
  state.tokenBags = {}; state.infestedLocations = []; state.encounterDeck = [...state.scenario.encounterDeck]
  state.difficulty = 'standard'; state.numInvestigators = count; state.status = 'playing'; state.phase = 'investigation'
  return state
}
function setup(state) {
  const events = []; const api = scenarioRuntime(state, events)
  chapter.behavior.preScenarioSetup(state, events, api)
  const ids = chapter.behavior.setupLocations(state, events, { info: () => {} })
  for (const id of ids) api.place(id)
  return api
}

console.log('=== A. Part2 agenda 08672 auto-advance probe ===')
{
  const state = buildState(); const events = []; setup(state)
  state.agendaIndex = 1 // 08672 无名存在
  state.doom = 0
  console.log('before: agendaIndex=', state.agendaIndex, 'doomThreshold=', state.agendas[1].doomThreshold, 'objective=', JSON.stringify(state.agendas[1].objective || null))
  try {
    const engineTurn = { checkAgenda: null }
    const mod = await import('file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/engine.js')
    mod.checkAgenda(state, events)
    console.log('after checkAgenda: agendaIndex=', state.agendaIndex, 'status=', state.status, 'locations=', state.locations.map(l => l.id).join(','))
  } catch (e) { console.log('checkAgenda threw:', e.constructor?.name, e.message) }
}

console.log('=== B. 08716 evade success crash probe ===')
{
  const state = buildState(); state.enemies.push({ id: 'e1', code: '99999', name: 'test enemy', location: state.investigators[0].location, evade: 2, exhausted: false })
  const inv = state.investigators[0]
  const calls = []
  const api = {
    test: (seat, skill, difficulty, opts) => { calls.push({ seat, skill, difficulty, baseValue: opts?.baseValue }); opts.resolve({ success: true, value: 9 }) },
    autoEvade: () => calls.push('autoEvade'), choice: () => 'skip', moveInvestigator: () => calls.push('move'), info: () => {},
  }
  try {
    entry08716.abilities[0].resolve({ state, inv, source: { ...entry08716, id: 'asset08716' }, api })
    console.log('08716 resolved ok; calls=', JSON.stringify(calls))
  } catch (e) { console.log('08716 resolve CRASH:', e.constructor?.name, '|', e.message, '| calls=', JSON.stringify(calls)) }
}

console.log('=== C. 08679 exhaust-nearest direction probe ===')
{
  const state = buildState(); setup(state)
  const exhaustedOne = { id: 'n1', code: '08679', name: '无名的疯狂', location: state.investigators[0].location, exhausted: true, traits: [] }
  const readyOne = { id: 'n2', code: '08679', name: '无名的疯狂', location: state.investigators[0].location, exhausted: false, traits: [] }
  state.enemies.push(exhaustedOne, readyOne)
  state.skillTest = { testTarget: { enemy: readyOne } }
  chapter.behavior.afterTest(state, state.investigators[0], { success: true, failedBy: 0 }, { info: () => {} })
  console.log('after 08679 afterTest success: exhausted copy exhausted=', exhaustedOne.exhausted, '(card: should exhaust a READY copy, i.e. ready copy -> true; here ready=', readyOne.exhausted, ')')
}

console.log('=== D. 08673 pylon attack difficulty probe ===')
{
  const state = buildState(); setup(state)
  const slot = (state.scenario.facilitySlots || []).find(s => { const loc = state.locations.find(l => l.id === s); return loc && ['08674','08675','08676','08677','08678'].includes(loc.originalCode) })
  const loc = state.locations.find(l => l.id === slot)
  const inv = state.investigators[0]; inv.location = slot
  const captured = {}
  const api = { ...scenarioRuntime(state, []), test: (seat, skill, difficulty, resolve) => { captured.difficulty = difficulty; captured.shroud = loc.shroud; captured.health = towerHealth(state, slot); resolve({ success: true }) } }
  const attack = chapter.behavior.actions(state, inv).find(m => m.rule === `heartOfMadnessAttackPylon:${slot}`)
  chapter.behavior.performAction(state, inv, attack, api)
  console.log('pylon', loc.originalCode, 'attack difficulty used=', captured.difficulty, '| printed fight(shroud)=', captured.shroud, '| tower health(clue value)=', captured.health)
}

console.log('=== E. 08674-78 unleash precondition probe ===')
{
  const state = buildState(); setup(state)
  const slot = (state.scenario.facilitySlots || []).find(s => { const loc = state.locations.find(l => l.id === s); return loc && ['08674','08675','08676','08677','08678'].includes(loc.originalCode) })
  const inv = state.investigators[0]; inv.location = slot
  const api = scenarioRuntime(state, [])
  const fast = chapter.behavior.fastActions(state, inv)
  console.log('fastActions at pylon without any seal control:', fast.map(m => m.rule).join(','))
  const move = fast.find(m => m.rule.startsWith('heartOfMadnessUnleash'))
  const handled = chapter.behavior.performAction(state, inv, move, api)
  console.log('performAction unleash without controlled/activated seal returned:', handled, '| pylonPowers=', JSON.stringify(state.scenarioFlags?.pylonPowers || null), '| seals=', JSON.stringify(sealsOf(state).map(s => ({ k: s.kind, active: s.active, by: s.placedBySeat }))))
}
