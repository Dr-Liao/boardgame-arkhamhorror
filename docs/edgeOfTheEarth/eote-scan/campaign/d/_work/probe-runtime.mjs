// D 审计运行时探针：合并后的 ALL_ENEMIES 关键字 + Part2 议程阈值
import 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/engine.js'
import { ALL_ENEMIES } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/card-lookup.js'
import { registerCampaignScenarios, scenarioRuntime } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/engine.js'
import { registerContentBundle, contentRegistry } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/registered.js'
import { manifest as campaign } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/manifest.js'
import * as p1 from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/index.js'
import * as p2 from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/index.js'
import { registerCardAbilities } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/engine/ability.js'
import { fixture } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/tests/core-fixture.mjs'

const codes = ['08669', '08679', '08680', '08687', '08689', '08690', '08695', '08696', '08700', '08701', '08708', '08710', '08711']
console.log('=== ALL_ENEMIES merged keyword snapshot ===')
for (const code of codes) {
  const def = ALL_ENEMIES[code]
  if (!def) { console.log(code, 'MISSING from ALL_ENEMIES'); continue }
  console.log(code, JSON.stringify({ hunter: def.hunter, retaliate: def.retaliate, alert: def.alert, massive: def.massive, aloof: def.aloof, elite: def.elite, prey: def.prey, victory: def.victory }))
}
console.log('=== Part2 agenda thresholds ===')
for (const a of p2.scenario.agendas) console.log(a.originalCode, a.name, 'doomThreshold=', a.doomThreshold, 'objective=', JSON.stringify(a.objective || null))
for (const a of p1.scenario.agendas) console.log('P1', a.originalCode, a.name, 'doomThreshold=', a.doomThreshold)
console.log('=== Part2 acts objective ===')
for (const a of p2.scenario.acts) console.log(a.originalCode, 'objective=', JSON.stringify(a.objective || null), 'backEffect=', a.backEffect)
console.log('=== Tekeli deck presence after Part1 setup ===')
const state = fixture('01001', 2)
state.campaign.id = 'edgeOfTheEarth'
state.campaign.records = {}
state.campaign.eote = {}
state.scenario = JSON.parse(JSON.stringify(p1.scenario))
state.acts = JSON.parse(JSON.stringify(state.scenario.acts))
state.agendas = JSON.parse(JSON.stringify(state.scenario.agendas))
state.actIndex = 0; state.agendaIndex = 0
state.scenarioFlags = {}
state.locations = []; state.enemies = []; state.storyAssets = []; state.victoryDisplay = []
state.encounterDeck = [...state.scenario.encounterDeck]
state.difficulty = 'standard'; state.numInvestigators = 2; state.status = 'playing'
for (const inv of state.investigators) inv.location = 'theGateOfYquaa'
const events = []
const api = scenarioRuntime(state, events)
p1.behavior.preScenarioSetup(state, events, api)
console.log('tekeli meta:', JSON.stringify(state.scenarioFlags?.mechanics?.eote?.tekeli || null), '| scenarioDecks.tekeli:', state.scenarioFlags?.mechanics?.scenarioDecks?.tekeli ? 'present' : 'absent')
const t = state.scenario.treacheries['08670']
console.log('=== 08670 treachery def ===', JSON.stringify(t && { code: t.code, entryRevelation: t.entryRevelation, surge: t.surge, effect: t.effect }))
const t57 = state.scenario.treacheries['08657']
console.log('=== 08657 treachery def ===', JSON.stringify(t57 && { code: t57.code, entryRevelation: t57.entryRevelation, surge: t57.surge, effect: t57.effect }))
console.log('=== Part1 encounter deck incl 08670? ===', (state.encounterDeck || []).filter(c => c === '08670').length)
