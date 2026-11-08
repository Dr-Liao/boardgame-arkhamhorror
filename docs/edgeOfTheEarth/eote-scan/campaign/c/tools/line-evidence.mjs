// 生成 file:line 证据表（本分片 52 卡 + 两章 definition/behavior/chaos + 共享装配）。
import fs from 'node:fs'
const ROOT = 'G:/boardgame-hall-ai/games/arkhamhorror'
const targets = []
const entryDirs = {
  peaks: 'src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks',
  city: 'src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings',
}
for (const dir of Object.values(entryDirs)) {
  for (const file of fs.readdirSync(`${ROOT}/${dir}`).filter(f => f.endsWith('.js')).sort()) {
    targets.push({ path: `${dir}/${file}`, patterns: ['code:', 'implemented:', 'actRule:', 'agendaRule:', 'locationRule:', 'enemyRule:', 'treacheryRule:', 'flags:', 'uses:', 'usesType:', 'objective:', 'onReveal:', 'actions:', 'keyActions:', 'actTwoActions:', 'forcedOnEnemyEnter:', 'blocksUntilBelowClear', 'enterFromBelow', 'blocksKeysWhileReady', 'takesKeyOnEngage', 'frostForced', 'doubleKeyTokenModifier', 'moveDownToBelow', 'blocksAscendWhileEngaged', 'blocksClueDiscovery', 'onDefeatDoom', 'spawn:'] })
  }
}
const chapters = {
  peaks: 'content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks',
  city: 'content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings',
}
const chapterPatterns = {
  definition: ['export const RAW_CODES', 'MOUNTAINSIDE_IN_PLAY', 'MOUNTAINSIDE_SET_ASIDE', 'EXPEDITION_ASSETS', 'const chain', 'export const LOCATIONS', 'SET_ASIDE_CODES', 'GATHER_GROUPS', 'SHARED_GROUPS', 'RECORD_READS', 'RECORD_WRITES', 'CITY_LAYOUTS', 'CITY_KEY_VALUES', 'SET_ASIDE_BY_VERSION', 'REMOVED_BY_VERSION', 'actsForVersion', 'export const acts', 'export const agendas', 'START_LOCATION_BY_VERSION', 'CITY_LOCATION_SLOTS'],
  behavior: ['preScenarioSetup', 'setupLocations', 'scenarioApproximations', 'actReveal', 'agendaReveal', 'checkObjectives', 'moveError', 'locationEntered', 'locationRevealed', 'afterMove', 'ascend(', 'descend(', 'resolveEncounter', 'resolveChaosToken', 'afterTest', 'enemyStatModifier', 'roundEnded', 'actions(', 'performAction(', 'resolution(', 'finalResolution', 'TREACHERY_HANDLERS', 'ACT_REVEAL_HANDLERS', 'LOCATION_ACTION_HANDLERS', 'setupCityMap', 'claimKey', 'giveKeys', 'spawnTerrorOfTheStars', 'addFrostToken', 'testAutoFail', 'isExpeditionAsset', 'dropExpeditionAssetsOf', 'applyEnterFromBelow', 'moveBelow', 'recordMove'],
  chaos: ['TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS', 'CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS', 'export function', 'export const'],
  index: ['status:', 'requiredEncounterGroupIds', 'setAsideLocations'],
}
for (const [key, dir] of Object.entries(chapters)) {
  for (const [name, patterns] of Object.entries(chapterPatterns)) {
    targets.push({ path: `${dir}/${name}.js`, patterns })
  }
}
const shared = [
  'content/campaigns/edgeOfTheEarth/shared-encounters.js',
  'content/campaigns/edgeOfTheEarth/shared.js',
  'content/campaigns/edgeOfTheEarth/records.js',
  'content/campaigns/edgeOfTheEarth/flow.js',
  'content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/layout.js',
  'content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/layout.js',
  'content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/texts.js',
  'content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/texts.js',
]
const sharedPatterns = ['CHAPTER_GATHER_SETS', 'toTheForbiddenPeaks:', 'cityOfTheElderThings:', 'versions:', 'v1:', 'v2:', 'v3:', 'setAside', 'gather:', 'chaosBags', 'CHAOS_BAGS', 'startLocation', 'START_LOCATION', 'cells', 'CITY_LAYOUTS']
for (const path of shared) targets.push({ path, patterns: sharedPatterns })
// engine / rules
targets.push({ path: 'src/cards/card-rules.js', patterns: ['export function enemyRuleFor', 'export function locationRuleFor', 'export function actRuleFor', 'export function agendaRuleFor', 'export function entryFlags'] })
targets.push({ path: 'src/engine/eote-climb.js', patterns: ['export function climbDestinationError', 'export function ascend', 'export function descend', 'export function dropExpeditionAssets', 'export function cluesLostOnMove'] })
targets.push({ path: 'src/engine/vertical-chain.js', patterns: ['export function locationLevel', 'export function setLocationLevel'] })
targets.push({ path: 'src/engine/setup.js', patterns: ['state.locations = []', 'function setupScenarioLocations', 'scenarioBehavior(state).setupLocations'] })
targets.push({ path: 'src/engine/act-agenda.js', patterns: ['function advanceAct', 'function advanceAgenda', 'runAgendaReveal(state,cur,events)', 'checkOutcome(state, events)', 'function checkLinearAct'] })
targets.push({ path: 'src/engine/phases.js', patterns: ['scenarioBehavior(state).roundEnded', 'function runAgendaReveal'] })
targets.push({ path: 'src/engine/locations.js', patterns: ['function placeLocation', 'function revealLocation', 'scenarioBehavior(state).locationRevealed', 'scenarioBehavior(state).locationEntered'] })
targets.push({ path: 'src/engine/movement.js', patterns: ['scenarioBehavior(state).locationEntered'] })
targets.push({ path: 'src/engine/reveal.js', patterns: ['function runActReveal', 'scenarioBehavior(state).actReveal'] })
targets.push({ path: 'src/engine/harm-threat.js', patterns: ['function checkOutcome'] })
targets.push({ path: 'src/engine/encounter.js', patterns: ['spawnAnyEmpty'] })
targets.push({ path: 'src/engine/engine.js', patterns: ['scenarioBehavior(state).moveError'] })

const out = {}
for (const { path, patterns } of targets) {
  const full = `${ROOT}/${path}`
  if (!fs.existsSync(full)) { out[path] = { error: 'missing' }; continue }
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/)
  const hits = {}
  for (const pattern of patterns) {
    const found = []
    lines.forEach((line, index) => { if (line.includes(pattern)) found.push(index + 1) })
    hits[pattern] = found
  }
  out[path] = { lineCount: lines.length, hits }
}
fs.writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/c/_line-evidence.json', JSON.stringify(out, null, 1), 'utf8')
console.log('written', Object.keys(out).length, 'files')
