#!/usr/bin/env node
// 九循环《铁杉谷盛宴》（FHV）P6 一般玩家卡逐卡验收账本。
//
//   node tools/audit-fhv-player.mjs --write   生成 audit/fhv-player-acceptance.json 与
//                                             src/cards/fhv-player-acceptance.js（可构筑码表）
//   node tools/audit-fhv-player.mjs --check   逐字节复算（账本/生成物/测试任一漂移即失败）
//   node tools/audit-fhv-player.mjs           打印账本 JSON（不写盘）
//
// 事实源：audit/fhv-player-shards.json（8 片 × 15 张）、audit/fhv-player-queue.json、
// 八份分片测试的实跑事件流（tools/core-test-reporter.mjs）、audit/fhv-player-browser.json、
// audit/fhv-regression.json；原语请求在 artifacts/migration/fhv/primitive-requests/。
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'
import { partitions } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import { manifest as playerPack } from '../content/packs/fhvPlayer/manifest.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const HALL = join(MOD, '../..')
const RUN = join(HALL, 'artifacts/migration/fhv')
const REQUESTS_DIR = join(RUN, 'primitive-requests')
const SHARDS_PATH = join(MOD, 'audit/fhv-player-shards.json')
const QUEUE_PATH = join(MOD, 'audit/fhv-player-queue.json')
const LEDGER_PATH = join(MOD, 'audit/fhv-player-acceptance.json')
const MODULE_PATH = join(MOD, 'src/cards/fhv-player-acceptance.js')
const DISCLOSURES_PATH = join(MOD, 'audit/fhv-player-request-disclosures.json')
const TEST_FILES = Object.freeze(Array.from({ length: 12 }, (_, index) => `tests/fhv-player-m2-${index + 1}.test.mjs`))
const REQUIRED_TEST_FILES = Object.freeze([...TEST_FILES])
const json = value => JSON.stringify(value, null, 2) + '\n'
const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const readMaybe = path => (existsSync(path) ? readJson(path) : null)
const readMaybeText = path => (existsSync(path) ? readFileSync(path, 'utf8') : null)
const sha256Text = text => createHash('sha256').update(text).digest('hex')
const fileSha = path => (existsSync(join(MOD, path)) ? sha256Text(readFileSync(join(MOD, path))) : null)
const PLAYER_CODES = Object.freeze([...partitions.fhvPlayer].sort())
const isBasicWeakness = code => ALL_CARDS[code]?.subtype === 'basicweakness'
const isDependency = code => (ALL_CARDS[code]?.deckLimit ?? 2) === 0 && !isBasicWeakness(code)
const isResearched = code => /^Researched\./m.test(String(ALL_CARDS[code]?.text || ''))
const isBuildable = code => !isBasicWeakness(code) && !isDependency(code) && !isResearched(code)

function collectDisclosureFields(value, pathName = '', out = [], depth = 0) {
  if (!value || typeof value !== 'object' || depth > 4) return out
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectDisclosureFields(item, `${pathName}[${index}]`, out, depth + 1))
    return out
  }
  for (const [key, item] of Object.entries(value)) {
    const path = pathName ? `${pathName}.${key}` : key
    if (/simplif|approximat|note$/i.test(key) && typeof item === 'string' && item.trim()) {
      out.push({ source: 'field', path, detail: item.trim().slice(0, 200) })
    } else if (key === 'simplified' && item === true) {
      out.push({ source: 'flag', path, detail: `${path}=true` })
    } else if (typeof item === 'object') {
      collectDisclosureFields(item, path, out, depth + 1)
    }
  }
  return out
}

function commentDisclosures(source) {
  const hits = []
  source.split(/\r?\n/).forEach((line, index) => {
    const match = /(?:\/\/|note:)\s*(simplified|approximation|近似|简化|primitive-request|缺口)[:：]?\s*(.*)$/i.exec(line)
    if (match) hits.push({ line: index + 1, detail: `${match[1]} ${match[2]}`.trim().slice(0, 200) })
  })
  return hits
}

function detectSimplification(code, entry) {
  const disclosures = []
  if (entry?.simplified === true) disclosures.push({ source: 'flag', path: 'entry.simplified', detail: 'entry.simplified=true' })
  for (const [index, ability] of (entry?.abilities || []).entries()) {
    if (ability?.simplified === true) disclosures.push({ source: 'flag', path: `entry.abilities[${index}].simplified`, detail: 'ability.simplified=true' })
  }
  disclosures.push(...collectDisclosureFields(entry))
  const filePath = `src/cards/entries/${code}.js`
  if (existsSync(join(MOD, filePath))) {
    for (const hit of commentDisclosures(readFileSync(join(MOD, filePath), 'utf8'))) {
      disclosures.push({ source: 'comment', line: hit.line, detail: hit.detail })
    }
  }
  const seen = new Set()
  const unique = disclosures.filter(item => {
    const key = `${item.source}:${item.line ?? ''}:${item.path ?? ''}:${item.detail}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { simplified: unique.length > 0, disclosures: unique }
}

function runBatchTests() {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const files = REQUIRED_TEST_FILES.filter(file => existsSync(join(MOD, file)))
  if (!files.length) return { status: 1, results: [], failed: [{ name: 'missing test files' }], missing: [...REQUIRED_TEST_FILES] }
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=./tools/core-test-reporter.mjs', ...files],
    { cwd: MOD, env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
  let results
  try {
    results = run.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  } catch {
    throw new Error(`玩家卡测试事件流无效：${String(run.stderr || run.stdout).slice(0, 1200)}`)
  }
  const failed = results.filter(row => row.type !== 'test:pass' || row.skipped || row.todo)
  const testsDir = join(MOD, 'tests/')
  const normalized = results.map(row => ({ ...row, file: row.file?.startsWith(testsDir) ? row.file.slice(testsDir.length) : row.file }))
  return { status: run.status, results: normalized, failed, missing: REQUIRED_TEST_FILES.filter(file => !files.includes(file)) }
}

function primitiveRequests() {
  if (!existsSync(REQUESTS_DIR)) return { files: [], pending: [], blocked: [] }
  const files = readdirSync(REQUESTS_DIR).filter(name => name.endsWith('.json')).sort()
    .map(name => ({ name, ...readJson(join(REQUESTS_DIR, name)) }))
  const requestCode = item => String(item.code || item.name.replace(/\.json$/, ''))
  return { files, pending: files.filter(item => (item.status || 'pending') === 'pending'), blocked: files.filter(item => item.status === 'blocked') }
}

export function buildPlayerAcceptance() {
  const shards = readMaybe(SHARDS_PATH)
  const queue = readMaybe(QUEUE_PATH) || { items: [] }
  const disclosures = readMaybe(DISCLOSURES_PATH) || { deferredCodes: [], blockedCodes: [], notes: [] }
  const requests = primitiveRequests()
  const batch = runBatchTests()
  const entryByCode = new Map(CARD_ABILITY_ENTRIES.map(entry => [entry.code, entry]))
  const entries = PLAYER_CODES.map(code => {
    const card = ALL_CARDS[code]
    const entry = entryByCode.get(code)
    const tests = batch.results.filter(row => row.type === 'test:pass' && !row.skipped
      && String(row.name || '').startsWith('P6 ')
      && (String(row.name || '').match(/\b10\d{3}[a-z]?\b/g)?.includes(code) || String(row.name || '').startsWith(`P6 ${code} `)))
    const disclosure = detectSimplification(code, entry)
    const legacy = Boolean(EFFECTS[code])
    const channel = entry && legacy ? 'hybrid' : entry ? 'descriptor' : legacy ? 'legacy' : 'missing'
    return {
      code,
      name: card.nameZh || card.name,
      type: card.type,
      klass: card.klass || null,
      xp: card.xp ?? null,
      level: card.xp ?? null,
      basicWeakness: isBasicWeakness(code),
      dependencyOnly: isDependency(code),
      researched: isResearched(code),
      buildable: isBuildable(code),
      deckLimit: card.deckLimit ?? null,
      status: entry && tests.length ? 'verified' : 'missing',
      channel,
      simplified: disclosure.simplified,
      simplification: disclosure.simplified ? {
        kinds: [...new Set(disclosure.disclosures.map(item => item.source))].sort(),
        count: disclosure.disclosures.length,
        disclosures: disclosure.disclosures.slice(0, 10),
      } : null,
      implementation: fileSha(`src/cards/entries/${code}.js`),
      evidence: tests.map(row => ({ file: row.file, line: row.line, test: row.name })),
    }
  })
  const flat = (shards?.shards || []).flatMap(shard => shard.codes)
  const shardsExact = Boolean(shards) && new Set(flat).size === flat.length
    && JSON.stringify([...flat].sort()) === JSON.stringify(PLAYER_CODES)
  const browser = readMaybe(join(MOD, 'audit/fhv-player-browser.json'))
  const bootstrapEvidence = process.env.FHV_BOOTSTRAP_EVIDENCE === '1'
  const browserPassed = bootstrapEvidence || (browser?.status === 'passed' && browser?.checks?.desktop === true && browser?.checks?.mobile === true)
  const simplifiedEntries = entries.filter(entry => entry.simplified)
  const verifiedEntries = entries.filter(entry => entry.status === 'verified')
  const regression = readMaybe('audit/fhv-regression.json')
  const pendingRequests = requests.pending.filter(item => !disclosures.deferredCodes?.includes(String(item.code || item.name.replace(/\.json$/, ''))))
  const blockedRequests = requests.blocked.filter(item => !disclosures.blockedCodes?.includes(String(item.code || item.name.replace(/\.json$/, ''))))
  const gates = {
    batchTestsPassed: batch.status === 0 && batch.failed.length === 0 && batch.results.length > 0 && batch.missing.length === 0,
    everyCardVerified: verifiedEntries.length === PLAYER_CODES.length,
    // 每个 verified 条目必须有可执行条目（descriptor/hybrid）；legacy-only 也须登记披露。
    classificationComplete: entries.every(entry => entry.status !== 'verified' || entry.channel !== 'missing'),
    simplificationDisclosed: simplifiedEntries.every(entry =>
      Array.isArray(entry.simplification?.disclosures) && entry.simplification.disclosures.length > 0),
    shardsExact,
    primitiveRequestsAdjudicated: pendingRequests.length === 0 && blockedRequests.length === 0,
    browserDesktopAndMobile: browserPassed,
    // 引导期（首次 --write 生成可构筑码表、尚未跑回归/浏览器）显式设置 FHV_BOOTSTRAP_EVIDENCE=1，
    // 完成开放后不带环境变量重跑 --write 重签账本；与 P2/P4/P5、TSK P6 的引导期口径一致。
    replayZeroDrift: bootstrapEvidence || (regression?.status === 'passed' && regression?.replay?.matches === true),
    replayFastClean: bootstrapEvidence || (Array.isArray(regression?.fast?.newFailures) && regression.fast.newFailures.length === 0),
    packBoundary: playerPack.status === 'playable'
      && playerPack.cards.length === PLAYER_CODES.length
      && playerPack.cards.every(card => card.cataloged && card.rulesImplemented && (card.deckbuilding || card.dependencyOnly || card.researchGated)),
    docsPresent: existsSync(join(MOD, 'docs/campaign/theFeastOfHemlockVale/player-cards.md')),
  }
  const summary = {
    total: entries.length,
    verified: verifiedEntries.length,
    missing: entries.filter(entry => entry.status !== 'verified').length,
    simplified: simplifiedEntries.length,
    simplifiedDisclosed: simplifiedEntries.filter(entry => entry.simplification?.disclosures.length).length,
    buildable: entries.filter(entry => entry.buildable).length,
    dependencyOnly: entries.filter(entry => entry.dependencyOnly).length,
    basicWeaknesses: entries.filter(entry => entry.basicWeakness).length,
    researched: entries.filter(entry => entry.researched).length,
    testsPassed: batch.results.filter(row => row.type === 'test:pass').length,
    primitiveRequests: requests.files.length,
    deferredRequests: disclosures.deferredCodes?.length || 0,
  }
  const report = {
    schemaVersion: 1,
    cycle: 'fhv',
    phase: 'P6',
    generatedBy: 'tools/audit-fhv-player.mjs',
    profile: {
      id: 'fhv-player-p6',
      basis: '原始印刷卡文、本地锁定参考实现（参考资源 Arkham/Card 定义）与八份分片测试的实跑逐卡行为证据；不声称穷举跨循环组合。verified 仅表示有逐卡测试证据，条目自述的近似逐条计入 simplified/simplification，不声称与印刷文本等价。',
    },
    status: Object.values(gates).every(Boolean) ? 'verified' : 'pending',
    gates,
    summary,
    shards: (shards?.shards || []).map(({ id, worker, codes, testFile }) => ({ id, worker, codes, testFile })),
    queue: {
      path: 'audit/fhv-player-queue.json',
      total: (queue.items || []).length,
      verified: verifiedEntries.length,
      blockedRequests: blockedRequests.map(item => String(item.code || item.name.replace(/\.json$/, ''))),
      deferredRequests: disclosures.deferredCodes || [],
    },
    primitiveBacklog: sortCodes(disclosures.deferredCodes || []),
    implementationFiles: PLAYER_CODES.map(code => ({ path: `src/cards/entries/${code}.js`, sha256: fileSha(`src/cards/entries/${code}.js`) })),
    entries,
    sources: sortPaths([
      'audit/fhv-player-shards.json', 'audit/fhv-player-queue.json', 'audit/fhv-player-browser.json',
      'audit/fhv-regression.json', 'content/packs/fhvPlayer/manifest.js',
      ...TEST_FILES,
    ]).map(path => ({ path, sha256: fileSha(path) })),
    evidence: [...TEST_FILES, 'audit/fhv-player-shards.json', 'audit/fhv-player-queue.json', 'audit/fhv-player-browser.json', 'audit/fhv-player-request-disclosures.json'],
  }
  return { report, summary }
}

function sortCodes(codes) {
  return [...new Set(codes)].sort()
}
function sortPaths(paths) {
  return [...new Set(paths)].sort()
}

export function generatedModule(report) {
  const verified = report.entries.filter(entry => entry.status === 'verified').map(entry => entry.code)
  const buildable = report.entries.filter(entry => entry.buildable && entry.status === 'verified').map(entry => entry.code)
  const basic = report.entries.filter(entry => entry.basicWeakness).map(entry => entry.code)
  return '// 由 tools/audit-fhv-player.mjs --write 从实跑逐卡行为测试生成，勿手改。\n'
    + `export const FHV_PLAYER_ACCEPTANCE_PROFILE = Object.freeze(${json(report.profile)})\n`
    + `export const FHV_PLAYER_VERIFIED_CODES = Object.freeze(${JSON.stringify(verified)})\n`
    + `export const FHV_PLAYER_BUILDABLE_CODES = Object.freeze(${JSON.stringify(buildable)})\n`
    + `export const FHV_PLAYER_BASIC_WEAKNESS_CODES = Object.freeze(${JSON.stringify(basic)})\n`
    + `export const FHV_PLAYER_DEPENDENCY_CODES = Object.freeze(${JSON.stringify(report.entries.filter(entry => entry.dependencyOnly).map(entry => entry.code))})\n`
    + `export const FHV_PLAYER_RESEARCHED_CODES = Object.freeze(${JSON.stringify(report.entries.filter(entry => entry.researched).map(entry => entry.code))})\n`
    + 'const verified = new Set(FHV_PLAYER_VERIFIED_CODES)\n'
    + 'const buildable = new Set(FHV_PLAYER_BUILDABLE_CODES)\n'
    + 'const researched = new Set(FHV_PLAYER_RESEARCHED_CODES)\n'
    + 'export const fhvPlayerCardVerified = code => verified.has(code)\n'
    + 'export const fhvPlayerBuildable = code => buildable.has(code)\n'
    + 'export const fhvPlayerResearched = code => researched.has(code)\n'
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { report, summary } = buildPlayerAcceptance()
  if (process.argv.includes('--write')) {
    writeFileSync(LEDGER_PATH, json(report))
    writeFileSync(MODULE_PATH, generatedModule(report))
    writeFileSync(join(RUN, 'player-acceptance.json'), json(report))
    console.log(`fhv player: 已写入 ${LEDGER_PATH}（status=${report.status}，verified ${summary.verified}/${summary.total}，可构筑 ${summary.buildable}，近似披露 ${summary.simplified}/${summary.simplifiedDisclosed}，原语请求 ${summary.primitiveRequests}）`)
    console.log(json({ gates: report.gates }))
    if (report.status !== 'verified') throw new Error(`fhv player 门禁未全真：${json(report.gates)}`)
  } else if (process.argv.includes('--check')) {
    if (!existsSync(LEDGER_PATH)) throw new Error('audit/fhv-player-acceptance.json 不存在：先 --write')
    if (readFileSync(LEDGER_PATH, 'utf8') !== json(report)) throw new Error('audit/fhv-player-acceptance.json 与实跑测试/证据不一致：审阅后 --write')
    if (readFileSync(MODULE_PATH, 'utf8') !== generatedModule(report)) throw new Error('src/cards/fhv-player-acceptance.js 与账本不一致：审阅后 --write')
    if (report.status !== 'verified') throw new Error(`fhv player 门禁未全真：${json(report.gates)}`)
    console.log(`fhv player: 复算一致（verified ${summary.verified}/${summary.total}）`)
  } else {
    console.log(json(report))
    if (report.status !== 'verified') throw new Error(`fhv player 门禁未全真：${json(report.gates)}`)
  }
}
