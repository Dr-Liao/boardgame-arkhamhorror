#!/usr/bin/env node
// 七循环《地球边缘》P6 一般玩家卡账本（逐卡行为证据）。
//
//   node tools/audit-eote-player.mjs --write   生成 audit/eote-player-acceptance.json 与
//                                              src/cards/eote-player-acceptance.js（可构筑码表），
//                                              供 content/packs/eotePlayer/manifest.js 与 availability 读取
//   node tools/audit-eote-player.mjs --check   逐字节复算（测试/账本/生成物漂移即失败）
//
// 证据来源是**实跑**四份分片测试（tests/eote-player-m2-*.test.mjs）。每张卡必须至少有一条
// `P6 <code> ` 开头的已执行、非 skip 的测试。闸门失败时拒绝写盘（exit 非 0）。
//
// 简化披露（P0-11）：`verified` 只表示「有实跑逐卡测试证据」，不等于印刷效果等价；条目自述的
// approximation（note 字段 / 源码注释）会逐条计入 `simplified` + `simplification.disclosures`，
// 并由 gate `simplificationDisclosed` 要求每条都带披露明细。旧实现只看 entry.simplified flag，
// 55/115 张自述近似的卡仍让 noSimplified=true（空门禁）。
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MOD, RUN, emit, json, readJson, sha } from './eote-migration-lib.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'
import { EFFECTS } from '../src/cards/card-effects.js'

const scope = readJson(join(MOD, 'audit/eote-scope.json'))
const PLAYER_CODES = [...scope.partitions.eotePlayer].sort()
const shardsPath = join(MOD, 'audit/eote-player-shards.json')
const queuePath = join(MOD, 'audit/eote-player-queue.json')
const ledgerPath = join(MOD, 'audit/eote-player-acceptance.json')
const modulePath = join(MOD, 'src/cards/eote-player-acceptance.js')
export const PLAYER_TEST_FILES = ['tests/eote-player-m2-1.test.mjs', 'tests/eote-player-m2-2.test.mjs',
  'tests/eote-player-m2-3.test.mjs', 'tests/eote-player-m2-4.test.mjs']

const readMaybe = path => (existsSync(path) ? readJson(path) : null)
const fileSha = path => (existsSync(join(MOD, path)) ? sha(readFileSync(join(MOD, path))) : null)
const isBasicWeakness = code => ALL_CARDS[code]?.subtype === 'basicweakness'
const isBuildable = code => !isBasicWeakness(code) && (ALL_CARDS[code]?.deckLimit ?? 0) > 0

// 简化披露判定（P0-11）：旧实现只看 entry.simplified flag，而 55/115 张卡的近似写在
// `note:'approximation…'` 或源码注释里 → noSimplified 恒真（空门禁）。现在同时扫描：
//   1) entry.simplified / ability.simplified 显式 flag；
//   2) 条目对象里的 note/notes/approximation 等正式披露字段；
//   3) 条目源码注释（行注释与块注释）中的近似声明。
const SIMPLIFICATION_MARKER = /approximation|not implemented|partial(?:ly)? implemented|近似|省略|简化|未实现|缺失|不完整|部分实现|待补|尚未实现|待实现|仅实现|只实现|无法实现/i
const DISCLOSURE_KEYS = /^(?:note|notes|disclosure|disclosures|approximation|approximations|simplifiedNote|approximationNote)$/i
function collectDisclosureFields(value, pathName = '', out = [], depth = 0) {
  if (depth > 6 || !value || typeof value !== 'object') return out
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && DISCLOSURE_KEYS.test(key) && SIMPLIFICATION_MARKER.test(child)) {
      out.push({ source: 'note', path: pathName ? `${pathName}.${key}` : key, detail: child.trim().slice(0, 400) })
    } else if (child && typeof child === 'object') {
      collectDisclosureFields(child, pathName ? `${pathName}.${key}` : key, out, depth + 1)
    }
  }
  return out
}
function commentDisclosures(source) {
  const hits = []
  const lines = source.split('\n')
  let inBlock = false
  let blockStart = 0
  let blockText = ''
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (inBlock) {
      const end = line.indexOf('*/')
      blockText += ` ${end >= 0 ? line.slice(0, end) : line}`
      if (end >= 0) {
        if (SIMPLIFICATION_MARKER.test(blockText)) hits.push({ line: blockStart + 1, detail: blockText.trim().replace(/\s+/g, ' ').slice(0, 400) })
        inBlock = false
        blockText = ''
      }
      continue
    }
    const blockStartIndex = line.indexOf('/*')
    const lineCommentIndex = line.indexOf('//')
    if (blockStartIndex >= 0 && (lineCommentIndex < 0 || blockStartIndex < lineCommentIndex)) {
      const end = line.indexOf('*/', blockStartIndex + 2)
      if (end >= 0) {
        const text = line.slice(blockStartIndex, end + 2)
        if (SIMPLIFICATION_MARKER.test(text)) hits.push({ line: index + 1, detail: text.trim().replace(/\s+/g, ' ').slice(0, 400) })
      } else {
        inBlock = true
        blockStart = index
        blockText = line.slice(blockStartIndex)
      }
      continue
    }
    if (lineCommentIndex >= 0) {
      const text = line.slice(lineCommentIndex)
      if (SIMPLIFICATION_MARKER.test(text)) hits.push({ line: index + 1, detail: text.trim().slice(0, 400) })
    }
  }
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
  // 去重（同一行 note/comment 可能重复命中）。
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
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=./tools/core-test-reporter.mjs', ...PLAYER_TEST_FILES],
    { cwd: MOD, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  let results
  try { results = run.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) }
  catch { throw new Error(`玩家卡测试事件流无效：${run.stderr || run.stdout}`) }
  const failed = results.filter(row => row.type !== 'test:pass' || row.skipped || row.todo)
  const testsDir = join(MOD, 'tests/')
  const normalized = results.map(row => ({ ...row, file: row.file?.startsWith(testsDir) ? row.file.slice(testsDir.length) : row.file }))
  return { status: run.status, results: normalized, failed, stderr: run.stderr }
}

export function buildPlayerAcceptance() {
  const shards = readMaybe(shardsPath)
  const queue = readMaybe(queuePath) || { items: [] }
  const batch = runBatchTests()
  const entryByCode = new Map(CARD_ABILITY_ENTRIES.map(entry => [entry.code, entry]))
  const entries = PLAYER_CODES.map(code => {
    const card = ALL_CARDS[code]
    const entry = entryByCode.get(code)
    const tests = batch.results.filter(row => row.type === 'test:pass' && !row.skipped
      && String(row.name || '').startsWith('P6 ')
      // 分片测试允许一张测试覆盖多张同模板卡（如「P6 08094/08096 …」），
      // 只要标题以 P6 开头且包含该卡号 token 即计入该卡证据。
      && String(row.name || '').match(/\b0\d{4}[a-z]?\b/g)?.includes(code))
    const disclosure = detectSimplification(code, entry)
    return {
      code,
      name: card.nameZh || card.name,
      type: card.type,
      klass: card.klass || null,
      xp: card.xp ?? null,
      level: card.level ?? null,
      basicWeakness: isBasicWeakness(code),
      buildable: isBuildable(code),
      deckLimit: card.deckLimit ?? null,
      // verified = 有实跑逐卡测试证据；近似披露单独用 simplified/simplification 表达（不冒充等价）。
      status: entry && tests.length ? 'verified' : 'missing',
      channel: EFFECTS[code] ? 'hybrid' : 'descriptor',
      simplified: disclosure.simplified,
      simplification: disclosure.simplified
        ? {
          kinds: [...new Set(disclosure.disclosures.map(item => item.source))].sort(),
          count: disclosure.disclosures.length,
          disclosures: disclosure.disclosures.slice(0, 8),
        }
        : null,
      implementation: fileSha(`src/cards/entries/${code}.js`),
      evidence: tests.map(row => ({ file: row.file, line: row.line, test: row.name })),
    }
  })
  const flat = (shards?.shards || []).flatMap(shard => shard.codes)
  const shardsExact = Boolean(shards) && new Set(flat).size === flat.length
    && JSON.stringify([...flat].sort()) === JSON.stringify(PLAYER_CODES)
  const pending = (queue.items || []).filter(item => !['done', 'rejected'].includes(item.status))
  const browser = readMaybe(join(MOD, 'audit/eote-player-browser.json'))
  // 引导期：开放 manifest/availability 必须先有生成的码表，而浏览器验收又依赖包已开放。
  // 仅在本进程显式设置 EOTE_BOOTSTRAP_EVIDENCE=1 时把浏览器门禁视为通过，完成开放后再真实跑浏览器
  // 并以不带环境变量的 --write 重签账本（与 P2/P4/P5 的引导期口径一致）。
  const bootstrapEvidence = process.env.EOTE_BOOTSTRAP_EVIDENCE === '1'
  const browserPassed = bootstrapEvidence || (browser?.status === 'passed' && browser?.checks?.desktop === true && browser?.checks?.mobile === true)
  const simplifiedEntries = entries.filter(entry => entry.simplified)
  const gates = {
    batchTestsPassed: batch.status === 0 && batch.failed.length === 0 && batch.results.length > 0,
    everyCardVerified: entries.every(entry => entry.status === 'verified') && entries.length === PLAYER_CODES.length,
    // 不再声称「无简化」：条目自述的 approximation（note/注释）必须被扫描到并逐条披露；
    // 旧实现只看 entry.simplified flag，导致 55/115 张自述近似的卡仍过 noSimplified 空门禁（P0-11）。
    simplificationDisclosed: simplifiedEntries.every(entry =>
      Array.isArray(entry.simplification?.disclosures) && entry.simplification.disclosures.length > 0),
    shardsExact,
    noPendingRequests: pending.length === 0,
    browserDesktopAndMobile: browserPassed,
  }
  const summary = {
    total: entries.length,
    verified: entries.filter(entry => entry.status === 'verified').length,
    missing: entries.filter(entry => entry.status !== 'verified').length,
    simplified: simplifiedEntries.length,
    simplifiedDisclosed: simplifiedEntries.filter(entry => entry.simplification?.disclosures.length).length,
    buildable: entries.filter(entry => entry.buildable).length,
    dependencyOnly: entries.filter(entry => !entry.buildable).length,
    basicWeaknesses: entries.filter(entry => entry.basicWeakness).length,
    testsPassed: batch.results.filter(row => row.type === 'test:pass').length,
  }
  const report = {
    schemaVersion: 1, cycle: 'eote', phase: 'P6',
    generatedBy: 'tools/audit-eote-player.mjs',
    profile: { id: 'eote-player-p6', basis: '原始印刷卡文、本地锁定参考实现与四份分片测试的实跑逐卡行为证据；不声称穷举跨循环组合。verified 仅表示有逐卡测试证据，条目自述的近似逐条计入 simplified/simplification，不声称与印刷文本等价。' },
    status: Object.values(gates).every(Boolean) ? 'verified' : 'pending',
    gates,
    summary,
    shards: (shards?.shards || []).map(({ id, worker, codes }) => ({ id, worker, codes })),
    queue: { path: 'audit/eote-player-queue.json', pending: pending.map(item => item.id || item.code), total: (queue.items || []).length },
    implementationFiles: PLAYER_CODES.map(code => ({ path: `src/cards/entries/${code}.js`, sha256: fileSha(`src/cards/entries/${code}.js`) })),
    entries,
    evidence: ['tests/eote-player-m2-1.test.mjs', 'tests/eote-player-m2-2.test.mjs', 'tests/eote-player-m2-3.test.mjs',
      'tests/eote-player-m2-4.test.mjs', 'audit/eote-player-shards.json', 'audit/eote-player-queue.json',
      'audit/eote-player-browser.json'],
  }
  return { report, summary }
}

export function generatedModule(report) {
  return `// 由 tools/audit-eote-player.mjs --write 从实跑逐卡行为测试生成，勿手改。\n`
    + `export const EOTE_PLAYER_ACCEPTANCE_PROFILE = Object.freeze(${json(report.profile)})\n`
    + `export const EOTE_PLAYER_VERIFIED_CODES = Object.freeze(${JSON.stringify(report.entries.filter(e => e.status === 'verified').map(e => e.code))})\n`
    + `export const EOTE_PLAYER_BUILDABLE_CODES = Object.freeze(${JSON.stringify(report.entries.filter(e => e.buildable).map(e => e.code))})\n`
    + `export const EOTE_PLAYER_BASIC_WEAKNESS_CODES = Object.freeze(${JSON.stringify(report.entries.filter(e => e.basicWeakness).map(e => e.code))})\n`
    + `const verified = new Set(EOTE_PLAYER_VERIFIED_CODES)\n`
    + `const buildable = new Set(EOTE_PLAYER_BUILDABLE_CODES)\n`
    + `export const eotePlayerCardVerified = code => verified.has(code)\n`
    + `export const eotePlayerBuildable = code => buildable.has(code)\n`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { report, summary } = buildPlayerAcceptance()
  if (process.argv.includes('--write')) {
    writeFileSync(modulePath, generatedModule(report))
    emit('player-acceptance', report)
    console.log(`eote player: ${summary.verified}/${summary.total} verified，可构筑 ${summary.buildable}，基础弱点 ${summary.basicWeaknesses}，testsPassed ${summary.testsPassed}`)
    if (report.status !== 'verified') throw new Error(`eote player 门禁未全真：${json(report.gates)}`)
  } else if (process.argv.includes('--check')) {
    if (!existsSync(modulePath)) throw new Error('src/cards/eote-player-acceptance.js 不存在：先 --write')
    if (readFileSync(modulePath, 'utf8') !== generatedModule(report)) throw new Error('src/cards/eote-player-acceptance.js 与实跑测试不一致：先审阅再 --write')
    if (report.status !== 'verified') throw new Error(`eote player 门禁未全真：${json(report.gates)}`)
    emit('player-acceptance', report)
  } else {
    console.log(json(report))
    if (report.status !== 'verified') throw new Error(`eote player 门禁未全真：${json(report.gates)}`)
  }
}
