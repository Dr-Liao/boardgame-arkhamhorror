// player-auditor-b digest builder: scope 08079-08133
import fs from 'node:fs'
import path from 'node:path'

const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const OUT = path.join(SCAN, 'player-b')
fs.mkdirSync(OUT, { recursive: true })

const shards = JSON.parse(fs.readFileSync(path.join(SCAN, 'scope/shards.json'), 'utf8'))
const codes = shards['player-auditor-b'].codes

// ---- cards-data (import real module) ----
const cardsMod = await import('file:///G:/boardgame-hall-ai/games/arkhamhorror/src/cards/cards-data.js')
const ALL = cardsMod.ALL_CARDS || cardsMod.default?.ALL_CARDS
if (!ALL) { console.error('no ALL_CARDS; keys=', Object.keys(cardsMod)); process.exit(1) }

const srcCache = new Map()
const readSrc = (rel) => {
  if (!srcCache.has(rel)) {
    const abs = path.join(MOD, rel)
    if (!fs.existsSync(abs)) srcCache.set(rel, null)
    else srcCache.set(rel, fs.readFileSync(abs, 'utf8'))
  }
  return srcCache.get(rel)
}

// numbered source excerpt
const numSrc = (rel) => {
  const s = readSrc(rel)
  if (s == null) return '(MISSING FILE)'
  return s.split(/\r?\n/).map((l, i) => `${String(i + 1).padStart(4)}| ${l}`).join('\n')
}

// resolve entry file paths
const entryCandidates = (code) => [
  `src/cards/entries/${code}.js`,
  `src/encounter-entries/${code}.js`,
]

const out = []
for (const code of codes) {
  const c = ALL[code]
  if (!c) { out.push({ code, missingCardData: true }); continue }
  const entryRel = entryCandidates(code).find(rel => fs.existsSync(path.join(MOD, rel))) || null
  out.push({
    code,
    name: c.name, nameZh: c.nameZh,
    type: c.type, klass: c.klass, subtype: c.subtype,
    traits: c.traits, traitsZh: c.traitsZh,
    xp: c.xp, cost: c.cost, slot: c.slot,
    quantity: c.quantity,
    text: c.text, textZh: c.textZh,
    backText: c.backText, backTextZh: c.backTextZh,
    pack: c.packCode || c.pack, illustrator: c.illustrator,
    entryRel,
  })
}
fs.writeFileSync(path.join(OUT, '_cards.json'), JSON.stringify(out, null, 1))

// ---- digest.md (human reading) ----
let md = '# Player-auditor-b digest (08079-08133)\n\n'
for (const e of out) {
  md += `\n\n## ${e.code} ${e.name} / ${e.nameZh}\n`
  md += `type=${e.type} klass=${e.klass} subtype=${e.subtype || '-'} xp=${e.xp} cost=${e.cost} slot=${e.slot || '-'} traits=${e.traits}\n`
  md += `entry: ${e.entryRel || 'NONE'}\n`
  md += '```text\ntext: ' + String(e.text || '').replace(/<[^>]+>/g, '') + '\n```\n'
  md += '```text\ntextZh: ' + String(e.textZh || '').replace(/<[^>]+>/g, '') + '\n```\n'
  if (e.backText) md += '```text\nbackText: ' + e.backText + '\n```\n'
  if (e.entryRel) {
    md += '```js\n' + numSrc(e.entryRel) + '\n```\n'
  } else {
    md += '>>> NO ENTRY FILE <<<\n'
  }
}
fs.writeFileSync(path.join(OUT, '_digest.md'), md)

// ---- screen filters ----
const loadScreen = (f) => {
  const p = path.join(SCAN, 'screen', f)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null
}
const codeSet = new Set(codes)
const filterObj = (obj) => {
  if (Array.isArray(obj)) return obj.filter(it => codes.some(c => JSON.stringify(it).includes(c)))
  return obj
}
const screens = {}
for (const f of ['integrity.json', 'keyword-coverage.json', 'perceivability.json', 'tests-coverage.json', 'duplication.json', 'primitive-compliance.json', 'known-deviations.json']) {
  const j = loadScreen(f)
  if (!j) continue
  const hits = {}
  const walk = (obj, keyPath) => {
    if (Array.isArray(obj)) {
      const arr = obj.filter(it => {
        const s = JSON.stringify(it)
        return codes.some(c => s.includes(c))
      })
      if (arr.length) hits[keyPath] = arr
    } else if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        if (codeSet.has(k)) hits[keyPath + '.' + k] = v
        else walk(v, keyPath ? keyPath + '.' + k : k)
      }
    }
  }
  walk(j, '')
  screens[f] = hits
}
fs.writeFileSync(path.join(OUT, '_screen-filtered.json'), JSON.stringify(screens, null, 1))

// ---- flags-readpoints filtered ----
const flags = loadScreen('flags-readpoints.json')
if (flags) {
  const all = JSON.stringify(flags)
  const fhits = {}
  const walk = (obj, kp) => {
    if (Array.isArray(obj)) {
      const arr = obj.filter(it => codes.some(c => JSON.stringify(it).includes(c)))
      if (arr.length) fhits[kp] = arr
    } else if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) walk(v, kp ? kp + '.' + k : k)
    }
  }
  walk(flags, '')
  fs.writeFileSync(path.join(OUT, '_flags-filtered.json'), JSON.stringify(fhits, null, 1))
}

// ---- tests index filtered ----
const ti = JSON.parse(fs.readFileSync(path.join(SCAN, 'scope/tests-index.json'), 'utf8'))
const tiStr = JSON.stringify(ti)
fs.writeFileSync(path.join(OUT, '_tests-index-sample.json'), JSON.stringify(ti).slice(0, 1200))

// grep tests for codes
const testFiles = fs.readdirSync(path.join(MOD, 'tests')).filter(f => f.endsWith('.mjs') && /eote/.test(f))
const testHits = {}
for (const f of testFiles) {
  const s = fs.readFileSync(path.join(MOD, 'tests', f), 'utf8')
  const lines = s.split(/\r?\n/)
  lines.forEach((l, i) => {
    for (const c of codes) {
      if (l.includes(c)) {
        ;(testHits[c] ||= []).push(`tests/${f}:${i + 1}: ${l.trim().slice(0, 240)}`)
      }
    }
  })
}
fs.writeFileSync(path.join(OUT, '_tests-grep.json'), JSON.stringify(testHits, null, 1))

console.log('cards', out.length, 'withEntry', out.filter(x => x.entryRel).length, 'noEntry', out.filter(x => !x.entryRel && !x.missingCardData).map(x => x.code))
console.log('test files scanned', testFiles.length, 'codes with test hits', Object.keys(testHits).length)
console.log('screen keys:', Object.keys(screens))
