// campaign-auditor-b 数据收集：把 75 条战役卡的卡面/条目/屏幕线索汇总成一份 data.json。
// 只读 mod；输出落 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/。
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b'
const ENTRIES = path.join(MOD, 'src/cards/encounter-entries/edgeOfTheEarth/fatalMirage')

const { ALL_CARDS } = await import(pathToFileURL(path.join(MOD, 'src/cards/cards-data.js')).href)
const shards = JSON.parse(fs.readFileSync(path.join(SCAN, 'scope/shards.json'), 'utf8'))
const codes = shards['campaign-auditor-b'].codes

const readJson = name => JSON.parse(fs.readFileSync(path.join(SCAN, 'screen', name), 'utf8'))

function cardSubset(card) {
  if (!card) return null
  const keep = ['code', 'name', 'nameZh', 'type', 'subType', 'text', 'textZh', 'backText', 'backTextZh',
    'doubleSided', 'encounterCode', 'traits', 'flavor', 'flavorZh', 'health', 'fight', 'evade', 'damage',
    'horror', 'clues', 'shroud', 'cluesPerInvestigator', 'uses', 'usesType', 'stage', 'doomThreshold',
    'victory', 'vengeance', 'quantity', 'pack', 'klass', 'xp', 'targets', 'category', 'isWeakness']
  const out = {}
  for (const key of keep) if (card[key] !== undefined) out[key] = card[key]
  return out
}

const cards = []
for (const code of codes) {
  const card = ALL_CARDS[code]
  const entryPath = path.join(ENTRIES, code + '.js')
  const exists = fs.existsSync(entryPath)
  cards.push({
    code,
    ledgerStatus: null, // 后面从 tests-coverage / 账本补
    card: cardSubset(card),
    entryPath: 'src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/' + code + '.js',
    entryExists: exists,
    entrySource: exists ? fs.readFileSync(entryPath, 'utf8') : null,
  })
}

// 卡面额外原文取自 bundles（含 backText 等；cards-data 已给，不必重复）

// flags-readpoints：本分片条目（all 为数组）
const readpoints = readJson('flags-readpoints.json')
const rpAll = (readpoints.all || []).filter(entry => codes.includes(entry.code))
const unread = (readpoints.unread || []).filter(entry => codes.includes(entry.code))

const known = readJson('known-deviations.json')
const filterByCodes = list => (list || []).filter(entry => codes.includes(entry.code || entry.card))
const deviations = {
  summary: known.summary,
  simplified: filterByCodes(known.simplified),
  deferred: (known.deferred || []).filter(entry => codes.some(code => JSON.stringify(entry).includes(code))),
  primitiveRequests: (known.primitiveRequests || []).filter(entry => codes.some(code => JSON.stringify(entry).includes(code))),
  entryMarkers: filterByCodes(known.entryMarkers),
  suspiciousTestTitles: known.suspiciousTestTitles,
}

const integrity = readJson('integrity.json')
const keyword = readJson('keyword-coverage.json')
const tests = readJson('tests-coverage.json')
const duplication = readJson('duplication.json')
const compliance = readJson('primitive-compliance.json')
const perceivability = readJson('perceivability.json')
const scenarioIntegrity = readJson('scenario-integrity.json')

const pickCode = list => (list || []).filter(entry => codes.includes(entry.code))
const mentionsCode = entry => codes.some(code => JSON.stringify(entry).includes(code))

const out = {
  generatedAt: '2026-11-08',
  scope: { codes, count: codes.length },
  cards,
  screen: {
    integrity: { summary: integrity.summary, cards: pickCode(integrity.cards) },
    keywordCoverage: { note: keyword.note, summary: keyword.summary, cards: pickCode(keyword.cards) },
    tests: { summary: tests.summary, cards: pickCode(tests.cards), suspiciousTitles: tests.suspiciousTitles },
    readpoints: { summary: readpoints.summary, ourEntries: rpAll, ourUnread: unread },
    duplication: {
      summary: duplication.summary,
      textDuplicateGroups: (duplication.textDuplicateGroups || []).filter(mentionsCode),
      clonePairs: (duplication.clonePairs || []).filter(mentionsCode),
      reprint: (duplication.reprint || []).filter(mentionsCode),
      crossCycleSameText: (duplication.crossCycleSameText || []).filter(mentionsCode),
    },
    primitiveCompliance: {
      summary: compliance.summary,
      engineLiterals: (compliance.engineLiterals || []).filter(mentionsCode),
      contentLiterals: (compliance.contentLiterals || []).filter(mentionsCode),
      escapeCards: (compliance.escapeCards || []).filter(mentionsCode),
      directWrites: compliance.directWrites,
      forbiddenImports: compliance.forbiddenImports,
    },
    perceivability: { note: perceivability.note, summary: perceivability.summary, cards: pickCode(perceivability.cards) },
    scenarioIntegrity: {
      summary: scenarioIntegrity.summary,
      fatalMirage: (scenarioIntegrity.chapters || []).find(chapter => chapter.id === 'fatalMirage') || null,
      flow: scenarioIntegrity.flow,
      guide: scenarioIntegrity.guide,
    },
  },
  deviations,
}

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'data.json'), JSON.stringify(out, null, 1))
console.log('wrote data.json', JSON.stringify({ cards: cards.length, readpointEntries: rpAll.length, unread: unread.length, simplified: deviations.simplified.length, deferred: deviations.deferred.length, primitiveRequests: deviations.primitiveRequests.length }).toString())
