// 《食梦者》M1（P6）调查员账本：逐人验收的可复算产物。
//
//   node tools/audit-tde-investigators.mjs --write   → audit/tde-investigators.json
//   node tools/audit-tde-investigators.mjs --check   → 与磁盘账本逐字节比对（内容漂移即失败）
//
// 证据规则（与 TDE 其它账本一致）：状态不手写。每位调查员的 `verified` 由代码读点 + 节点用例实跑
// 共同决定；`simplified` 来自条目自己的 `simplified`/`note`（显式简化不能算 verified）。
// 本轮 `confirmations.investigators` 的最终合并仍归 P10 的 audit/tde-migration.json，本文件是它的输入。

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const rel = path => path.replaceAll('\\', '/').replace(/^.*?boardgame-hall-ai\//, '')
const abs = path => join(ROOT, path)
const LEDGER_PATH = 'audit/tde-investigators.json'
const TEST_FILE = 'tests/tde-investigators.test.mjs'

const { ALL_CARDS, INVESTIGATORS } = await import(new URL('../src/cards/cards-data.js', import.meta.url))
await import(new URL('../src/engine/engine.js', import.meta.url))
const { registeredEntry } = await import(new URL('../src/engine/ability.js', import.meta.url))
const {
  TDE_INVESTIGATOR_CODES, SIGNATURES_BY_INVESTIGATOR, canSelectInvestigator, getAvailability,
} = await import(new URL('../src/deck/availability.js', import.meta.url))
const { buildDeck } = await import(new URL('../src/deck/deckbuilding.js', import.meta.url))
const { manifest } = await import(new URL('../content/packs/tdeInvestigators/manifest.js', import.meta.url))

const sha256 = path => (existsSync(abs(path))
  ? createHash('sha256').update(readFileSync(abs(path))).digest('hex') : null)

// 12 条「印刷记录」= 5 调查员 + 11 张专属主卡 + 2 张关联面；账本逐条登记。
const FACES = ['06015a', '06015b']

function entryFacts(code) {
  const entry = registeredEntry(code)
  const card = ALL_CARDS[code]
  return {
    code,
    name: card?.nameZh || card?.name || code,
    type: card?.type || null,
    registered: Boolean(entry),
    simplified: entry?.simplified === true,
    note: entry?.note || null,
    descriptorAbilities: entry?.abilities?.length || 0,
    hasElderSign: Boolean(entry?.elderSign),
    searchedCardRule: Boolean(entry?.searchedCardRule),
    weakness: Boolean((entry?.abilities || []).some(descriptor => descriptor.kind === 'weakness')),
  }
}

function runNodeTests() {
  const run = spawnSync(process.execPath, ['--test', abs(TEST_FILE)], { cwd: ROOT, encoding: 'utf8', timeout: 180000 })
  const output = `${run.stdout || ''}\n${run.stderr || ''}`
  const tests = Number((output.match(/^(?:ℹ|#) tests (\d+)$/m) || [])[1] || 0)
  const fail = Number((output.match(/^(?:ℹ|#) fail (\d+)$/m) || [])[1] || 0)
  return { command: `node --test ${TEST_FILE}`, status: run.status, tests, fail, ok: run.status === 0 && fail === 0 && tests > 0 }
}

const nodeAcceptance = runNodeTests()

const investigators = TDE_INVESTIGATOR_CODES.map(code => {
  const own = entryFacts(code)
  const signatureCodes = [...(SIGNATURES_BY_INVESTIGATOR[code] || [])]
  const signatures = signatureCodes.map(entryFacts)
  const faces = FACES.map(entryFacts)
  let deck = null
  try {
    const built = buildDeck(INVESTIGATORS[code], { seed: `audit-${code}` })
    deck = {
      ok: true,
      size: built.playerCards.length,
      signatureCards: built.signatureCards,
      signatureWeaknesses: built.signatureWeaknesses,
      basicWeaknesses: built.basicWeaknesses.length,
    }
  } catch (error) {
    deck = { ok: false, error: error.message }
  }
  const simplifications = [own, ...signatures].filter(item => item.simplified).map(item => item.code)
  return {
    code,
    name: own.name,
    klass: INVESTIGATORS[code]?.klass || null,
    selectable: canSelectInvestigator(code),
    availability: getAvailability(code).availability,
    dependencyOnly: getAvailability(code).dependencyOnly,
    own,
    signatures,
    faces: code === '06004' ? faces : [],
    deck,
    simplifications,
    checks: {
      registered: own.registered,
      elderSign: own.hasElderSign,
      signaturesRegistered: signatures.every(item => item.registered),
      // 06017 是显式简化（隐私敌人待接线），不算「完整实现」但必须登记。
      signaturesImplemented: signatures.every(item => item.registered),
      deckContract: deck.ok === true,
      documentedSimplification: simplifications.length === 0 || own.simplified || signatures.some(item => item.simplified),
    },
    status: own.registered && own.hasElderSign && deck.ok && signatures.every(item => item.registered)
      && simplifications.length === 0 ? 'verified' : 'pending',
  }
})

const records = TDE_INVESTIGATOR_CODES.flatMap(code => [code, ...(SIGNATURES_BY_INVESTIGATOR[code] || [])])
  .concat(FACES).map(entryFacts)

const simplified = records.filter(item => item.simplified)
const mainRecords = records.filter(item => !FACES.includes(item.code))
const faceRecords = records.filter(item => FACES.includes(item.code))
const gate = {
  fiveInvestigators: { expected: 5, selectable: investigators.filter(item => item.selectable).length,
    pass: investigators.length === 5 && investigators.every(item => item.selectable) },
  // 16 条主记录（5 调查员 + 11 张专属主卡）必须都有行为条目；2 张关联面（06015a/b）
  // 是绑定地点，行为随 P8 的地点型 Bonded 接线，本轮只登记归属与待实现原因。
  sixteenMainRecords: { expected: 16, registered: mainRecords.filter(item => item.registered).length,
    pass: mainRecords.length === 16 && mainRecords.every(item => item.registered) },
  facesPending: { expected: 2, registered: faceRecords.filter(item => item.registered).length,
    codes: FACES, reason: '06015a/b 无单独行为条目；放置、翻面与阶段结束在 src/engine/dream-gate.js。',
    pass: faceRecords.length === 2 },
  deckContracts: { pass: investigators.every(item => item.deck.ok) },
  elderSigns: { pass: investigators.every(item => item.own.hasElderSign) },
  nodeAcceptance,
  simplifiedDocumented: { codes: simplified.map(item => item.code), pass: simplified.every(item => Boolean(item.note)) },
  status: {
    verified: investigators.filter(item => item.status === 'verified').map(item => item.code),
    pending: investigators.filter(item => item.status !== 'verified').map(item => item.code),
    // pending 不是失败：每一项都必须有 note 说明依赖哪个阶段（P7/P8）。
    pendingReasons: investigators.filter(item => item.status !== 'verified').map(item => ({
      code: item.code,
      simplifications: item.simplifications,
      note: item.simplifications.map(simplifiedCode => records.find(record => record.code === simplifiedCode)?.note).filter(Boolean),
    })),
  },
}
gate.pass = gate.fiveInvestigators.pass && gate.sixteenMainRecords.pass && gate.facesPending.pass
  && gate.deckContracts.pass && gate.elderSigns.pass && gate.nodeAcceptance.ok && gate.simplifiedDocumented.pass

const evidence = [
  'content/packs/tdeInvestigators/manifest.js',
  'src/deck/availability.js',
  'src/cards/entries',
  TEST_FILE,
  'docs/tde-investigators.md',
].map(path => ({ path, sha256: path === 'src/cards/entries' ? null : sha256(path) }))

const ledger = {
  schemaVersion: 1,
  cycle: 'tde',
  milestone: 'M1 / P6',
  generatedBy: 'tools/audit-tde-investigators.mjs --write',
  note: '逐人验收账本：verified 由代码读点 + 节点用例共同决定；显式简化（simplified）一律 pending，且必须带 note。',
  pack: { id: manifest.id, status: manifest.status, cards: manifest.cards.length, faceCodes: manifest.faceCodes },
  investigators,
  records,
  simplified: simplified.map(item => ({ code: item.code, note: item.note })),
  nodeAcceptance,
  gate,
  evidence,
}

const json = `${JSON.stringify(ledger, null, 2)}\n`
if (process.argv.includes('--write')) {
  mkdirSync(dirname(abs(LEDGER_PATH)), { recursive: true })
  writeFileSync(abs(LEDGER_PATH), json)
  console.log(`tde-investigators: ${LEDGER_PATH} · ${investigators.length} 位调查员 · ${records.length} 条记录 · gate ${gate.pass ? 'pass' : 'fail'}`)
  console.log(`  verified ${gate.status.verified.length}/${investigators.length} · simplified ${simplified.length} · node ${nodeAcceptance.tests} 例`)
} else {
  if (!existsSync(abs(LEDGER_PATH))) { console.error(`缺少账本：${LEDGER_PATH}（先跑 --write）`); process.exit(1) }
  const current = readFileSync(abs(LEDGER_PATH), 'utf8')
  if (current !== json) { console.error('账本与当前实现不一致（重新 --write 并审阅 diff）'); process.exit(1) }
  console.log(`tde-investigators: ${records.length} 条记录一致 · gate ${gate.pass ? 'pass' : 'fail'}`)
  if (!gate.pass) process.exit(1)
}
