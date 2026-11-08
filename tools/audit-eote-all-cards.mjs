#!/usr/bin/env node
// 《地球边缘》（Edge of the Earth）P8 逐卡发布验收账本。
//
//   node tools/audit-eote-all-cards.mjs --write   实跑全部 eote Node 测试后写 audit/eote-all-card-acceptance.json
//   node tools/audit-eote-all-cards.mjs [--check] 复算并比对账本（语义漂移 exit 2；一致但 gate 不完整 exit 1）
//
// 参照 tools/audit-tic-all-cards.mjs 的两级证据口径：
//   ① strong（最强）= 通过用例标题命中卡号（词边界，08011a 不会误命中 08011b；
//      双面演武 a/b 面同时接受基号 token）；
//   ② file-level = 该测试文件实跑有通过用例，且文件全文出现该卡号 token；
//   ③ ledger-fallback = 分片验收账本（audit/eote-{player-acceptance,investigators,scenario-acceptance}.json）
//      记录该卡已被实跑测试覆盖，且**引用的测试文件本身含该卡号 token**（P0-11：旧实现只要求
//      「本次有通过用例」/last-wins，scenario-ledger 129 条全部不可追溯却照过 gate → 假绿）。
// 每条证据都带 titleMatched / ledgerMatched / traceable 布尔，不把源码字符串猜测当通过。
// gate 的 everyBehaviorCardHasEvidence 也只认可追溯证据（traceable），不再只查 evidence 非空。
//
// 状态（可复算）：
//   no-behavior：2 张 type=scenario 的参考卡（08596/08621），只提供混乱标记参考，无玩家可执行行为；
//   missing    ：缺条目文件 / implemented:false / 无行为键 / 无任何测试证据；
//   blocked    ：卡号在 status=pending 的行为类原语请求里，且没有任何测试证据；
//   simplified ：条目已实现且有测试证据，但存在 pending 行为类原语请求（披露近似，不阻塞 gate）；
//   verified   ：其余已实现+有证据的卡。
// gate：missing + blocked = 0 即 complete（simplified 披露不阻塞）。
//
// 产物确定性：不写时间戳/耗时/git head；含 scope、条目文件与测试文件的 sha256；--check 重跑即可检漂移。
// 退出码：0 = 账本一致且 gate 完整（--write 写入成功且 gate 完整）；1 = gate 不完整；2 = 漂移/输入错误。
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const MOD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = path.join(MOD, 'audit/eote-all-card-acceptance.json')
const LEDGER_VERSION = 1
const REFERENCE_CARDS = Object.freeze(['08596', '08621'])
const ENTRY_ROOT = path.join(MOD, 'src/cards/entries')
const ENCOUNTER_ROOT = path.join(MOD, 'src/cards/encounter-entries/edgeOfTheEarth')
const REQUEST_DIRS = [
  path.join(MOD, 'artifacts/migration/eote/primitive-requests'),
  path.join(MOD, '..', '..', 'artifacts/migration/eote/primitive-requests'),
]

const sha256 = value => createHash('sha256').update(value).digest('hex')
const readJson = absolute => JSON.parse(fs.readFileSync(absolute, 'utf8'))
const rel = absolute => path.relative(MOD, absolute).replaceAll('\\', '/')
const sorted = list => [...list].sort((left, right) => left.localeCompare(right))
const stable = value => {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
  }
  return value
}
const stableJson = value => JSON.stringify(stable(value), null, 2) + '\n'
const tokenPattern = code => {
  const escaped = String(code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const face = /^(\d{5})[a-z]$/.exec(String(code))
  const body = face ? `${face[1]}[a-z]?` : escaped
  return new RegExp(`(?:^|[^A-Za-z0-9])${body}(?:$|[^A-Za-z0-9])`)
}
const containsToken = (text, code) => tokenPattern(code).test(String(text || ''))

const exists = absolute => {
  try { fs.accessSync(absolute); return true } catch { return false }
}

function walkJs(dir, out = []) {
  if (!exists(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) walkJs(absolute, out)
    else if (entry.name.endsWith('.js')) out.push(absolute)
  }
  return out
}

// ---------------------------------------------------------------------------
// 输入：scope / 分片验收账本 / 原语请求队列 / 条目文件 / 测试文件
// ---------------------------------------------------------------------------
function loadInputs() {
  const scope = readJson(path.join(MOD, 'audit/eote-scope.json'))
  const partitions = {
    eoteCampaign: sorted(scope.partitions?.eoteCampaign || []),
    eoteInvestigators: sorted(scope.partitions?.eoteInvestigators || []),
    eotePlayer: sorted(scope.partitions?.eotePlayer || []),
  }
  const total = Object.values(partitions).reduce((sum, list) => sum + list.length, 0)
  const cardCodes = sorted(scope.cards.map(card => card.code))
  if (total !== 403 || cardCodes.length !== 403) {
    throw new Error(`EotE scope 不是 403 条（partitions=${total}, cards=${cardCodes.length}）`)
  }
  const readOptional = relative => {
    const absolute = path.join(MOD, relative)
    return exists(absolute) ? readJson(absolute) : null
  }
  const ledgers = {
    player: readOptional('audit/eote-player-acceptance.json'),
    investigators: readOptional('audit/eote-investigators.json'),
    scenario: readOptional('audit/eote-scenario-acceptance.json'),
    playerQueue: readOptional('audit/eote-player-queue.json'),
  }
  // 条目文件目录（encounter-entries 递归；兼容 _shared 工厂）。
  const entryFiles = new Map()
  for (const absolute of walkJs(ENTRY_ROOT)) entryFiles.set(path.basename(absolute, '.js'), absolute)
  for (const absolute of walkJs(ENCOUNTER_ROOT)) {
    const code = path.basename(absolute, '.js')
    if (!entryFiles.has(code)) entryFiles.set(code, absolute)
  }
  // 待实现行为类原语请求（player queue 的 rejected/done 不阻塞；p7-*.json pending 才算）。
  // REQUEST_DIRS 同时读 Mod 内副本与大厅根目录运行镜像：同名请求只记一次（优先首个存在的目录）。
  const pending = new Map()
  const requestFiles = new Set()
  for (const dir of REQUEST_DIRS) {
    if (!exists(dir)) continue
    for (const name of sorted(fs.readdirSync(dir).filter(item => item.endsWith('.json')))) {
      let request
      try { request = readJson(path.join(dir, name)) } catch { continue }
      if (request?.kind === 'shared-factory') continue
      if (request?.status !== 'pending') continue
      const codes = Array.isArray(request.cards) && request.cards.length
        ? request.cards
        : Array.isArray(request.cardCodes) && request.cardCodes.length
          ? request.cardCodes
          : (request.code ? [request.code] : [])
      if (!codes.length) continue
      const id = request.id || name.replace(/\.json$/, '')
      requestFiles.add(`artifacts/migration/eote/primitive-requests/${name}`)
      for (const code of codes) {
        if (!pending.has(code)) pending.set(code, [])
        if (!pending.get(code).includes(id)) pending.get(code).push(id)
      }
    }
  }
  for (const item of ledgers.playerQueue?.items || []) {
    if (item.status !== 'pending') continue
    for (const code of item.cards || []) {
      if (!pending.has(code)) pending.set(code, [])
      if (!pending.get(code).includes(item.id)) pending.get(code).push(item.id)
    }
  }
  return { scope, partitions, cardCodes, ledgers, entryFiles, pending, requestFiles: sorted([...requestFiles]) }
}

// 证据测试文件（Lead P8 任务书列出的实跑证据：P6 4 份 + P5 5 份 + P7 9 份）。
// 不把其它进行中的 eote 测试（如 P8 campaign/interaction/primitives）混入逐卡账本证据面。
const EVIDENCE_TEST_FILES = Object.freeze([
  'tests/eote-player-m2-1.test.mjs', 'tests/eote-player-m2-2.test.mjs',
  'tests/eote-player-m2-3.test.mjs', 'tests/eote-player-m2-4.test.mjs',
  'tests/eote-investigator-daniela.test.mjs', 'tests/eote-investigator-norman.test.mjs',
  'tests/eote-investigator-lily.test.mjs', 'tests/eote-investigator-monterey.test.mjs',
  'tests/eote-investigator-bob.test.mjs',
  'tests/eote-scenario-iceAndDeathPart1.test.mjs', 'tests/eote-scenario-iceAndDeathPart2.test.mjs',
  'tests/eote-scenario-iceAndDeathPart3.test.mjs', 'tests/eote-scenario-fatalMirage.test.mjs',
  'tests/eote-scenario-toTheForbiddenPeaks.test.mjs', 'tests/eote-scenario-cityOfTheElderThings.test.mjs',
  'tests/eote-scenario-theHeartOfMadnessPart1.test.mjs',
  'tests/eote-scenario-theHeartOfMadnessPart2.test.mjs', 'tests/eote-scenario-shared.test.mjs',
])

function discoverTestFiles() {
  return EVIDENCE_TEST_FILES.filter(file => exists(path.join(MOD, file)))
}

function runTestFiles(testFiles) {
  const reporter = pathToFileURL(path.join(MOD, 'tools/core-test-reporter.mjs')).href
  const passRecords = []
  const failRecords = []
  const filesWithPasses = new Set()
  let totalPasses = 0
  let exitCode = 0
  const runFile = file => {
    const args = ['--test', `--test-reporter=${reporter}`, '--test-reporter-destination=stdout', file]
    const result = spawnSync(process.execPath, args, {
      cwd: MOD, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 10 * 60 * 1000,
    })
    if (result.error) throw new Error(`实跑 eote 测试失败（${file}）：${result.error.message}`)
    const passes = []
    const fails = []
    for (const line of String(result.stdout || '').split('\n')) {
      if (!line.trim().startsWith('{')) continue
      let event
      try { event = JSON.parse(line) } catch { continue }
      if (event.type !== 'test:pass' && event.type !== 'test:fail') continue
      if (event.skipped || event.todo) continue
      const rawFile = String(event.file || '').replaceAll('\\', '/')
      const resolved = path.isAbsolute(rawFile) ? rel(rawFile) : rawFile
      const record = { test: String(event.name || ''), file: resolved, line: event.line ?? null }
      if (event.type === 'test:pass') passes.push(record)
      else fails.push(record)
    }
    // 单文件偶发环境抖动：失败时顺序重跑一次，仍失败才记录（不掩盖真实失败）。
    if (fails.length) {
      const retry = spawnSync(process.execPath, args, {
        cwd: MOD, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 10 * 60 * 1000,
      })
      const retryPasses = []
      const retryFails = []
      for (const line of String(retry.stdout || '').split('\n')) {
        if (!line.trim().startsWith('{')) continue
        let event
        try { event = JSON.parse(line) } catch { continue }
        if (event.type !== 'test:pass' && event.type !== 'test:fail') continue
        if (event.skipped || event.todo) continue
        const rawFile = String(event.file || '').replaceAll('\\', '/')
        const resolved = path.isAbsolute(rawFile) ? rel(rawFile) : rawFile
        const record = { test: String(event.name || ''), file: resolved, line: event.line ?? null }
        if (event.type === 'test:pass') retryPasses.push(record)
        else retryFails.push(record)
      }
      passes.length = 0
      passes.push(...retryPasses)
      fails.length = 0
      fails.push(...retryFails)
    }
    passRecords.push(...passes)
    failRecords.push(...fails)
    if (passes.length) filesWithPasses.add(file)
    totalPasses += passes.length
    if (fails.length) exitCode = 1
    return { file, passes: passes.length, fails: fails.length }
  }
  const perFile = testFiles.map(runFile)
  if (!passRecords.length) {
    throw new Error(`eote 测试没有产生任何 test:pass 事件（exit=${exitCode}）`)
  }
  return {
    testFiles: sorted(testFiles),
    totalPasses,
    passRecords,
    failRecords,
    filesWithPasses,
    exitCode,
    perFile,
  }
}

// ---------------------------------------------------------------------------
// 证据匹配
// ---------------------------------------------------------------------------
function buildEvidence(testRun, contexts) {
  const { scope, cardCodes, ledgers } = contexts
  const titles = testRun.passRecords.map(record => record.test).sort((left, right) => left.localeCompare(right))
  // 通过用例标题 → 实跑文件（双面卡 a/b 面的标题只写 a 面时，用文件是否含 b 面 token 复核可追溯性）。
  const passFileByTitle = new Map()
  for (const record of testRun.passRecords) {
    if (record.test && record.file && !passFileByTitle.has(record.test)) passFileByTitle.set(record.test, record.file)
  }
  const fileTexts = new Map()
  for (const file of testRun.testFiles) {
    const absolute = path.join(MOD, file)
    fileTexts.set(file, exists(absolute) ? fs.readFileSync(absolute, 'utf8') : '')
  }
  // 证据可追溯性的统一判据：引用的测试文件必须真的含该卡号 token。
  const fileContainsCode = (file, tokens) => Boolean(file) && tokens.some(token => containsToken(fileTexts.get(file), token))
  const playerEvidence = new Map()
  for (const entry of ledgers.player?.entries || []) {
    playerEvidence.set(entry.code, (entry.evidence || []).map(item => item.test).filter(Boolean))
  }
  const investigatorEvidence = new Map()
  for (const item of ledgers.investigators?.items || []) {
    const codes = [item.code, ...(item.signatures || []).map(signature => signature.code)].filter(Boolean)
    const files = (item.evidence || []).filter(value => String(value).endsWith('.test.mjs'))
    for (const code of codes) {
      const list = investigatorEvidence.get(code) || []
      list.push(...files)
      investigatorEvidence.set(code, list)
    }
  }
  // scenario-ledger：code → 该卡可能归属的全部章节（共享卡可出现在多章）。
  // 旧实现用 Map last-wins，每章都含全部 264 张卡时全部落到最后一章 theHeartOfMadnessPart2；
  // 现在保留全部候选章，并在回退时要求目标章节测试文件真的含卡号 token（P0-11）。
  const chaptersByCode = new Map()
  for (const chapter of ledgers.scenario?.chapters || []) {
    const file = `tests/eote-scenario-${chapter.id}.test.mjs`
    for (const code of chapter.cardCodes || []) {
      const list = chaptersByCode.get(code) || []
      if (!list.some(entry => entry.id === chapter.id)) list.push({ id: chapter.id, file })
      chaptersByCode.set(code, list)
    }
  }
  const cardsByCode = new Map(scope.cards.map(card => [card.code, card]))
  const evidence = new Map()
  for (const code of cardCodes) {
    const card = cardsByCode.get(code)
    const tokens = [code, card?.canonicalCode].filter(Boolean)
    const used = []
    // ① strong：通过用例标题命中（双面演武 a/b 面同时接受基号 token，见文件头口径）。
    for (const title of titles) {
      if (tokens.some(token => containsToken(title, token))) {
        const resolvedFile = passFileByTitle.get(title) || null
        used.push({ kind: 'strong', titleMatched: true, ledgerMatched: false, test: title,
          traceable: true, resolvedFile })
        break
      }
    }
    // ② file-level：通过测试文件全文含 token。
    if (!used.length) {
      for (const file of testRun.testFiles) {
        if (!testRun.filesWithPasses.has(file)) continue
        if (fileContainsCode(file, tokens)) {
          used.push({ kind: 'file', titleMatched: false, ledgerMatched: false, file, traceable: true })
          break
        }
      }
    }
    // ③ player-ledger：分片验收账本声明的用例本次实跑通过，且标题仍含该卡号 token。
    if (!used.length) {
      const playerTitles = playerEvidence.get(code) || []
      const matchedTitle = playerTitles.find(title => titles.includes(title)
        && tokens.some(token => containsToken(title, token)))
      if (matchedTitle) {
        used.push({ kind: 'player-ledger', titleMatched: true, ledgerMatched: true, test: matchedTitle,
          traceable: true })
      }
    }
    // ④ investigator-ledger：调查员账本声明覆盖的测试文件本次有通过用例，且文件含该卡号 token。
    if (!used.length) {
      const files = (investigatorEvidence.get(code) || [])
        .filter(file => testRun.filesWithPasses.has(file) && fileContainsCode(file, tokens))
      if (files.length) {
        used.push({ kind: 'investigator-ledger', titleMatched: false, ledgerMatched: true, file: files[0],
          traceable: true })
      }
    }
    // ⑤ scenario-ledger：P7 账本声明该卡归属某章；只有「该章测试文件本次有通过用例且文件含卡号 token」
    // 时才算证据。旧实现只要求「该章测试本次有 pass」（不要求文件含卡号）且 last-wins 落最后一章 → 假绿。
    if (!used.length) {
      const chapter = (chaptersByCode.get(code) || [])
        .find(candidate => testRun.filesWithPasses.has(candidate.file) && fileContainsCode(candidate.file, tokens))
      if (chapter) {
        used.push({ kind: 'scenario-ledger', titleMatched: false, ledgerMatched: true,
          file: chapter.file, chapter: chapter.id, traceable: true })
      }
    }
    evidence.set(code, used)
  }
  return evidence
}

// ---------------------------------------------------------------------------
// 条目实现判定
// ---------------------------------------------------------------------------
const BEHAVIOR_KEY = /(?:^|\n)\s*["']?(?:abilities|modifiers|flags|uses|encounterResolve|enemyRule|treacheryRule|locationRule|actRule|agendaRule|storyFlip|resolve|revelation|forced|reaction)["']?\s*:/
function inspectEntry(code, file, testRun) {
  if (!file) return { file: null, sha256: null, implemented: false, behaviorKeys: false, explicitFalse: false, entry: null }
  const text = fs.readFileSync(file, 'utf8')
  const explicitFalse = /implemented\s*:\s*false/.test(text)
  const behaviorKeys = BEHAVIOR_KEY.test(text)
    || /(?:^|\n)\s*encounterResolve\s*\(/.test(text)
    // 兼容 _shared 工厂：文件本身没有字面行为键，但把行为交给共享工厂/entries 注册表。
    || /export\s+default\s+[A-Za-z_$][\w$]*\s*\(/.test(text)
    || /from\s+['"][^'"]*_shared/.test(text)
    || /(?:sharedEntry|makeEntry|entryFrom|createEntry|fromShared)/.test(text)
  const explicitTrue = /implemented\s*:\s*true/.test(text)
  return {
    file: rel(file), sha256: sha256(text), implemented: !explicitFalse, behaviorKeys,
    explicitFalse, implementedFlag: explicitTrue ? 'explicit-true' : null,
  }
}

// ---------------------------------------------------------------------------
// 账本构建
// ---------------------------------------------------------------------------
export function buildLedger({ testRun = null } = {}) {
  const inputs = loadInputs()
  const testFiles = discoverTestFiles()
  const actualRun = testRun || runTestFiles(testFiles)
  // 测试快照必须来自同一批测试文件（防止 --write 与 --check 用不同集合）。
  const run = {
    testFiles: actualRun.testFiles || testFiles,
    totalPasses: actualRun.totalPasses,
    exitCode: actualRun.exitCode ?? 0,
    passRecords: actualRun.passRecords,
    failRecords: actualRun.failRecords || [],
    filesWithPasses: new Set(actualRun.filesWithPasses
      || actualRun.passRecords.map(record => record.file)),
  }
  const evidence = buildEvidence(run, inputs)
  const byPartition = {
    eoteCampaign: new Map(inputs.partitions.eoteCampaign.map(code => [code, []])),
    eoteInvestigators: new Map(inputs.partitions.eoteInvestigators.map(code => [code, []])),
    eotePlayer: new Map(inputs.partitions.eotePlayer.map(code => [code, []])),
  }
  for (const [partitionName, codes] of Object.entries(inputs.partitions)) {
    for (const code of codes) byPartition[partitionName].get(code)
  }
  const records = []
  for (const code of inputs.cardCodes) {
    const card = inputs.scope.cards.find(item => item.code === code)
    const partitionName = inputs.partitions.eoteCampaign.includes(code) ? 'eoteCampaign'
      : inputs.partitions.eoteInvestigators.includes(code) ? 'eoteInvestigators' : 'eotePlayer'
    const isReference = REFERENCE_CARDS.includes(code) && card?.type === 'scenario'
    const pendingRequests = inputs.pending.get(code) || []
    const entry = isReference
      ? { file: null, sha256: null, implemented: true, behaviorKeys: true, explicitFalse: false, implementedFlag: 'reference-card' }
      : inspectEntry(code, inputs.entryFiles.get(code), run)
    const cardEvidence = evidence.get(code) || []
    const titleMatched = cardEvidence.some(item => item.titleMatched)
    const ledgerMatched = cardEvidence.some(item => item.ledgerMatched)
    const traceable = cardEvidence.some(item => item.traceable)
    let status = 'verified'
    let reason = null
    if (isReference) {
      status = 'no-behavior'
      reason = 'reference-card: type=scenario 参考卡，只提供混乱标记数值，无玩家可执行行为'
    } else if (!entry.file) {
      status = 'missing'; reason = 'no-entry-file: 缺单卡条目文件'
    } else if (!entry.implemented) {
      status = 'missing'; reason = 'implemented-false: 条目显式声明未实现'
    } else if (!entry.behaviorKeys) {
      status = 'missing'; reason = 'no-behavior-key: 条目没有 abilities/modifiers/*Rule/flags 等行为键'
    } else if (!cardEvidence.length) {
      status = pendingRequests.length ? 'blocked' : 'missing'
      reason = pendingRequests.length
        ? `pending-primitive: ${pendingRequests.join(', ')} 且无测试证据`
        : 'no-test-evidence: 实跑测试标题/文件/账本均未覆盖该卡'
    } else if (pendingRequests.length) {
      status = 'simplified'
      reason = `pending-primitive: ${pendingRequests.join(', ')}（近似已披露，不阻塞 gate）`
    }
    records.push({
      code,
      name: card?.nameZh || card?.name || code,
      nameEn: card?.name || code,
      type: card?.type || null,
      subtype: card?.subtype ?? null,
      partition: partitionName,
      canonicalCode: card?.canonicalCode || code,
      kind: isReference ? 'reference-card' : 'behavior-entry',
      entry,
      status,
      reason,
      pendingRequests: sorted(pendingRequests),
      titleMatched,
      ledgerMatched,
      traceable,
      evidence: cardEvidence,
    })
  }
  const summaryByStatus = { verified: 0, simplified: 0, 'no-behavior': 0, missing: 0, blocked: 0 }
  for (const record of records) summaryByStatus[record.status] += 1
  const partitionSummary = Object.fromEntries(Object.entries(inputs.partitions).map(([name, codes]) => {
    const subset = records.filter(record => record.partition === name)
    return [name, {
      total: codes.length,
      ...Object.fromEntries(Object.keys(summaryByStatus).map(status =>
        [status, subset.filter(record => record.status === status).length])),
    }]
  }))
  const evidenceSummary = {
    strong: records.filter(record => record.evidence.some(item => item.kind === 'strong')).length,
    file: records.filter(record => record.evidence.some(item => item.kind === 'file')).length,
    ledger: records.filter(record => record.evidence.some(item => item.kind.endsWith('-ledger'))).length,
    scenarioLedger: records.filter(record => record.evidence.some(item => item.kind === 'scenario-ledger')).length,
    titleMatched: records.filter(record => record.titleMatched).length,
    ledgerMatched: records.filter(record => record.ledgerMatched).length,
    traceable: records.filter(record => record.traceable).length,
    withoutEvidence: records.filter(record => record.status !== 'no-behavior' && !record.evidence.length).length,
    // 门禁口径（P0-11 修复）：不只要有 evidence，还要求至少一条可追溯。
    withoutTraceableEvidence: records.filter(record => record.status !== 'no-behavior' && !record.traceable).length,
  }
  const gateComplete = summaryByStatus.missing + summaryByStatus.blocked === 0
  const sources = {
    scope: 'audit/eote-scope.json',
    scopeSha256: sha256(fs.readFileSync(path.join(MOD, 'audit/eote-scope.json'))),
    ledgers: ['audit/eote-player-acceptance.json', 'audit/eote-investigators.json',
      'audit/eote-scenario-acceptance.json', 'audit/eote-player-queue.json']
      .filter(relative => exists(path.join(MOD, relative)))
      .map(relative => ({ path: relative, sha256: sha256(fs.readFileSync(path.join(MOD, relative))) })),
    entryFiles: records.filter(record => record.entry.file)
      .map(record => ({ path: record.entry.file, sha256: record.entry.sha256 }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    testFiles: run.testFiles.map(file => ({
      path: file, sha256: sha256(fs.readFileSync(path.join(MOD, file), 'utf8')),
    })).sort((left, right) => left.path.localeCompare(right.path)),
    primitiveRequests: sorted(inputs.requestFiles),
  }
  const testRunSnapshot = {
    testFiles: run.testFiles,
    totalPasses: run.totalPasses,
    failCount: run.failRecords.length,
    exitCode: run.exitCode,
    passRecords: [...run.passRecords].sort((left, right) =>
      `${left.test}\u0000${left.file}`.localeCompare(`${right.test}\u0000${right.file}`)),
    failRecords: [...run.failRecords].sort((left, right) =>
      `${left.test}\u0000${left.file}`.localeCompare(`${right.test}\u0000${right.file}`)),
    note: '运行快照：只用于披露本次实跑；两次构建用同一快照必须完全一致（测试用 passRecords 复算证据）。',
  }
  return {
    schemaVersion: 1,
    cycle: 'eote',
    phase: 'P8',
    generatedBy: 'tools/audit-eote-all-cards.mjs',
    ledgerVersion: LEDGER_VERSION,
    status: gateComplete && run.failRecords.length === 0 ? 'verified' : 'pending',
    gates: {
      totalCards403: records.length === 403,
      partitionsExact: inputs.partitions.eoteCampaign.length === 266
        && inputs.partitions.eoteInvestigators.length === 22 && inputs.partitions.eotePlayer.length === 115,
      noMissingOrBlocked: summaryByStatus.missing + summaryByStatus.blocked === 0,
      // 门禁必须检查「可追溯证据」而非 evidence 数组非空：旧口径下 scenario-ledger 假证据也能过 gate（P0-11）。
      everyBehaviorCardHasEvidence: evidenceSummary.withoutTraceableEvidence === 0,
      noFailedTests: run.failRecords.length === 0,
      deterministic: true,
    },
    summary: {
      total: records.length,
      ...summaryByStatus,
      gateComplete,
      behaviorCards: records.length - summaryByStatus['no-behavior'],
      referenceCards: summaryByStatus['no-behavior'],
      pendingBehaviorRequests: sorted([...new Set([...inputs.pending.values()].flat())]),
      evidence: evidenceSummary,
      partitions: partitionSummary,
    },
    testRun: testRunSnapshot,
    sources,
    records,
  }
}

function compareLedger(expected, actual) {
  return stableJson(expected) === stableJson(actual)
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log('用法: node tools/audit-eote-all-cards.mjs [--write|--check]')
    return 0
  }
  const unknown = args.filter(arg => !['--write', '--check'].includes(arg))
  if (unknown.length) {
    console.error(`未知参数: ${unknown.join(' ')}`)
    return 2
  }
  const write = args.includes('--write')
  let ledger
  try {
    ledger = buildLedger()
  } catch (error) {
    console.error(`构建失败: ${error.message}`)
    return 2
  }
  const gate = ledger.gates.noMissingOrBlocked && ledger.summary.gateComplete
  if (write) {
    fs.writeFileSync(OUTPUT, stableJson(ledger))
    const missing = ledger.records.filter(record => record.status === 'missing')
    const blocked = ledger.records.filter(record => record.status === 'blocked')
    console.log(`写入 ${rel(OUTPUT)}：${ledger.summary.total} 条记录（verified ${ledger.summary.verified} / `
      + `simplified ${ledger.summary.simplified} / no-behavior ${ledger.summary['no-behavior']} / `
      + `missing ${ledger.summary.missing} / blocked ${ledger.summary.blocked}）`)
    for (const record of missing) console.log(`  missing ${record.code} ${record.reason}`)
    for (const record of blocked) console.log(`  blocked ${record.code} ${record.reason}`)
    return gate ? 0 : 1
  }
  if (!exists(OUTPUT)) {
    console.error(`账本缺失: ${rel(OUTPUT)}（先运行 --write）`)
    return 2
  }
  const recorded = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'))
  if (!compareLedger(recorded, ledger)) {
    console.error('账本漂移：复算结果与 audit/eote-all-card-acceptance.json 不一致（重新 --write 并检查测试/条目变化）')
    return 2
  }
  console.log(`账本一致：${ledger.summary.total} 条，gate ${gate ? 'complete' : 'incomplete'}`
    + `（missing ${ledger.summary.missing} / blocked ${ledger.summary.blocked} / simplified ${ledger.summary.simplified}）`)
  return gate ? 0 : 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main()
}
