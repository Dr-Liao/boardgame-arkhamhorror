// 提取每张卡条目/行为文件中的锚点行号，供 findings.json 引用
import fs from 'node:fs'
import path from 'node:path'
const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const codes = JSON.parse(fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scope/shards.json', 'utf8'))['campaign-auditor-d'].codes
const set = new Set(codes)
const root = path.join(MOD, 'src/cards/encounter-entries/edgeOfTheEarth')
const files = []
function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js') && set.has(path.basename(e.name, '.js'))) files.push(p) } }
walk(root)
files.sort()
const ANCHORS = ['abilities:', 'encounterResolve', 'agendaRule', 'actRule', 'locationRule', 'enemyScript', 'enemySpawnRule',
  'modifiers:', 'uses:', 'usesType', 'flags:', 'partnerRules', 'scenarioRule', 'weakness', 'resolve', 'note:']
const out = {}
for (const f of files) {
  const code = path.basename(f, '.js')
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  const anchors = {}
  for (let i = 0; i < lines.length; i++) {
    for (const a of ANCHORS) {
      if (!lines[i].includes(a)) continue
      if (!anchors[a]) anchors[a] = i + 1
    }
  }
  out[code] = { file: 'src/cards/encounter-entries/edgeOfTheEarth' + f.replace(root, '').replace(/\\/g, '/'), lines: lines.length, anchors }
}
// 行为文件锚点
const behaviorAnchors = {}
for (const chapter of ['theHeartOfMadnessPart1', 'theHeartOfMadnessPart2']) {
  const f = path.join(MOD, 'content/campaigns/edgeOfTheEarth/scenarios', chapter, 'behavior.js')
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  const anchors = {}
  const marks = ['preScenarioSetup', 'setupLocations', 'locationRevealed', 'performAction', 'resolveEncounter', 'checkObjectives',
    'agendaForced', 'agendaLeftPlay', 'actLeftPlay', 'afterTest', 'resolveChaosToken', 'applyTokenEffect', 'enemyPhaseEnd',
    'resolution(', 'applyRampSequence', 'prepareSeals', 'randomizeFacilityFaces', 'locationPlaced', 'locationLeaveTest', 'actions(', 'fastActions(']
  for (let i = 0; i < lines.length; i++) for (const m of marks) if (!anchors[m] && lines[i].includes(m)) anchors[m] = i + 1
  behaviorAnchors[chapter] = { file: `content/campaigns/edgeOfTheEarth/scenarios/${chapter}/behavior.js`, anchors }
}
fs.writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/d/_work/anchors.json', JSON.stringify({ entries: out, behaviors: behaviorAnchors }, null, 1), 'utf8')
console.log('entries', Object.keys(out).length)
console.log(JSON.stringify(behaviorAnchors, null, 1))
