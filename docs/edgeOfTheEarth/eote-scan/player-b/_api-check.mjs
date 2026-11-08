// Static read-point checker for player-auditor-b entries (08079-08133)
import fs from 'node:fs'
import path from 'node:path'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const codes = JSON.parse(fs.readFileSync(path.join(SCAN, 'scope/shards.json'), 'utf8'))['player-auditor-b'].codes

// gather engine source text
const engineFiles = []
const walk = (dir) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p)
    else if (ent.name.endsWith('.js')) engineFiles.push(p)
  }
}
walk(path.join(MOD, 'src/engine'))
const engineText = engineFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n')

// defined names: match `name: (` / `name: arg =>` / `name:(` / `name: function` at any indent
const definedApi = new Set()
const definedTools = new Set()
for (const f of engineFiles) {
  const s = fs.readFileSync(f, 'utf8')
  for (const m of s.matchAll(/^\s{2,6}([A-Za-z_$][\w$]*)\s*:\s*(?:\(|async\s*\(|[A-Za-z_$][\w$]*\s*=>|function)/gm)) {
    definedApi.add(m[1])
  }
  // playerTools object block
  const pt = s.match(/playerTools\s*:\s*\{([\s\S]*?)\n\s{2,6}\},/)
  if (pt) for (const m of pt[1].matchAll(/^\s+([A-Za-z_$][\w$]*)\s*:/gm)) definedTools.add(m[1])
}

const report = {}
for (const code of codes) {
  const rel = `src/cards/entries/${code}.js`
  const abs = path.join(MOD, rel)
  if (!fs.existsSync(abs)) continue
  const src = fs.readFileSync(abs, 'utf8')
  const names = new Set()
  for (const m of src.matchAll(/\bapi\.([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  const toolNames = new Set()
  for (const m of src.matchAll(/\bapi\.playerTools\.([A-Za-z_$][\w$]*)/g)) toolNames.add(m[1])
  const missing = [...names].filter(n => !definedApi.has(n))
  const missingTools = [...toolNames].filter(n => !definedTools.has(n))
  report[code] = {
    api: [...names].sort(),
    missingApi: missing,
    playerTools: [...toolNames].sort(),
    missingTools,
  }
}
fs.writeFileSync(path.join(SCAN, 'player-b/_api-check.json'), JSON.stringify(report, null, 1))
const allMissing = new Set()
for (const [c, r] of Object.entries(report)) {
  if (r.missingApi.length || r.missingTools.length) console.log(c, 'missingApi=', r.missingApi, 'missingTools=', r.missingTools)
  r.missingApi.forEach(n => allMissing.add(n))
  r.missingTools.forEach(n => allMissing.add('playerTools.' + n))
}
console.log('unique unresolved:', [...allMissing])
console.log('definedApi size', definedApi.size, 'definedTools size', definedTools.size)
