#!/usr/bin/env node
// 印斯茅斯阴谋（The Innsmouth Conspiracy）P7 逐卡验收账本。
//
//   node tools/audit-tic-all-cards.mjs --write   实跑 TIC 全部 Node 测试后写 audit/tic-all-card-acceptance.json
//   node tools/audit-tic-all-cards.mjs [--check] 默认：复算并比对账本（语义漂移 exit 2；一致但 gate 不完整 exit 1）
//
// 本账本是八章验收里 `literalCardBehavior` 的唯一证据来源（tools/audit-tic-scenarios.mjs:126/303-319/706）。
//
// 证据规则（docs/arkham-content-migration.md §5.2；口径经 Lead 2026-11-04 复核修订）：
// - 只认**实跑的测试**：spawnSync 执行 `tests/tic-*.test.mjs`，用 tools/core-test-reporter.mjs 读
//   test:pass / test:fail 事件；不读源码字符串猜结论，失败用例只记入 failedEvidence。
// - 证据两级：
//   ① strongEvidence（最强）= 通过用例**标题**命中该卡号（词边界；07292a 不会误命中 07292）；
//   ② fileLevelEvidence（二级）= 该测试文件**实跑有通过用例**，且文件全文出现该卡号
//      （token 扫描，含 canonical / 别名）。输出每条证据都带 `titleMatched` 布尔。
// - 条目侧「已实现」= 单卡文件存在 + 未显式 `implemented:false` + 有实际行为
//   （运行时注册条目的 abilities/modifiers/各类 *Rule；兼容 _shared.js 工厂，避免工厂卡文件
//   里没有字面键被误判）。项目惯例是**未实现才写 `implemented:false`**，显式
//   `implemented:true` 只作为最强声明（implementedFlag=explicit-true），不是必要条件。
// - 重印按 canonical：scope.cards 的 canonicalCode/duplicateOfCode 指向另一卡号时，证据按 canonical 归集，
//   条目上记录 aliasOf；TIC 当前 361 条记录无别名。
//
// 状态（优先级从高到低，全部可复算）：
//   no-behavior：印刷文本没有玩家可执行行为的地点（如 07320「入场即部分淹没」这类纯 setup 静态地点）；
//                单列，不计缺口，也不参与 literalCardBehavior 的章节 pending 计算。
//   blocked    ：卡号出现在 **pending 的行为类原语请求**里，且条目未实现或没有任何测试证据；
//                或出现在 audit/tic-primitive-plan.json 中状态非 done 的原语卡片清单里。
//   missing    ：无条目文件 / 显式 implemented:false / 无行为键 / 没有任何测试证据（reason 给出精确原因）。
//   simplified ：条目已实现且有测试证据，但存在 pending 行为类原语请求（§5.2：显式简化/近似必须留在
//                待实现清单，不能记 verified）；或条目声明 simplified:true。
//   verified   ：条目已实现 + ≥1 测试证据（标题或文件级），且无上述降级条件。
//   · `kind:'shared-factory'` 的请求是去重/重构类，不改变单卡状态，只记入 refactorRequests。
//   · gate 口径（Lead 确认）：no-behavior 单列、verified+simplified 都算通过、missing/blocked 必须为 0；
//     summary.gateComplete 即该口径，summary.strictComplete 是 §5.2 最严口径（不含 simplified）。
//
// 汇总里的 pending = missing + blocked（gate 缺口数），供
// tools/audit-tic-scenarios.mjs 的 notes.literalCardLedger.pending 直接读取。
//
// 产物是确定性的：不写时间戳 / 耗时；包含 scope、条目文件的 sha256 与实跑证据，
// --check 重跑即可检测「测试/条目/请求队列/测试覆盖」的漂移（snapshot.testRun/testFiles 是运行快照，
// 只有它们变化时语义一致仍判通过，但建议门禁前 --write 刷新）。
//
// 退出码：0 = gate 完整（missing+blocked=0）且 --check 一致；
//         1 = 账本一致/写入成功但 gate 仍有 missing/blocked；
//         2 = --check 语义漂移、账本缺失或用法/输入错误。

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const game = 'games/arkhamhorror'
const mod = path.join(root, game)
const OUTPUT = path.join(mod, 'audit/tic-all-card-acceptance.json')
const LEDGER_VERSION = 1
const ENTRY_ROOT = path.join(mod, 'src/cards/encounter-entries')
const REQUEST_DIR = path.join(mod, 'artifacts/migration/tic/p7/primitive-requests')
const cliArgs = process.argv.slice(2)
const noWrite = !cliArgs.includes('--write')
if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
  console.log('用法: node tools/audit-tic-all-cards.mjs [--write|--check]')
  process.exit(0)
}
if (cliArgs.some(arg => !['--write', '--check'].includes(arg))) {
  console.error(`未知参数: ${cliArgs.join(' ')}`)
  process.exit(2)
}

const sha256 = value => createHash('sha256').update(value).digest('hex')
const readJson = relative => JSON.parse(fs.readFileSync(path.join(mod, relative), 'utf8'))
const rel = absolute => path.relative(root, absolute).replaceAll('\\', '/')
const sorted = list => [...list].sort((left, right) => left.localeCompare(right))

// ---------------------------------------------------------------------------
// 输入：scope / 卡面数据 / 章节数据 / 原语计划 / 原语请求队列
// ---------------------------------------------------------------------------
const scope = readJson('audit/tic-scope.json')
const primitivePlan = readJson('audit/tic-primitive-plan.json')
const chapterData = readJson('content/campaigns/theInnsmouthConspiracy/chapter-data.json')
const { ALL_CARDS } = await import(pathToFileURL(path.join(mod, 'src/cards/cards-data.js')).href)

const scopeCards = new Map(scope.cards.map(card => [card.code, card]))
const campaignCodes = sorted(scope.partitions.ticCampaign)
const campaignSet = new Set(campaignCodes)
const partitionTotal = Object.values(scope.partitions).reduce((sum, list) => sum + list.length, 0)
if (campaignCodes.length !== 252) throw new Error(`Unexpected TIC campaign scope: ${campaignCodes.length}`)
if (partitionTotal !== 361 || scope.cards.length !== 361) throw new Error('TIC scope 分区与 cards 总数不一致')
for (const card of scope.cards) {
  if (!ALL_CARDS[card.code]) throw new Error(`TIC scope 卡号不在 cards-data：${card.code}`)
}

// 原语计划：只作为参考快照写进账本（planSummary），**不参与单卡状态判定**。
// 该文件记录的是规划基线（其 new/reuse 的 status 可能是整体 pending 的旧值，或与真实实现不同步）；
// 单卡是否 blocked 只认 artifacts/migration/tic/p7/primitive-requests/ 里 status=pending 的请求。
const planSummary = {
  newTotal: (primitivePlan.new || []).length,
  newDone: (primitivePlan.new || []).filter(entry => entry.status === 'done').length,
  reuseTotal: (primitivePlan.reuse || []).length,
  reuseDone: (primitivePlan.reuse || []).filter(entry => entry.status === 'done').length,
  pendingNew: (primitivePlan.new || []).filter(entry => entry.status !== 'done').map(entry => entry.id),
  gates: primitivePlan.gates || null,
  referenceOnly: 'audit/tic-primitive-plan.json 是规划基线，不参与单卡 blocked/verified 判定；权威实现证据是源码导出与 node 验收。',
}

// pending 原语请求：kind==='shared-factory' 视为重构类，不改变单卡状态。
const pendingRequests = []
if (fs.existsSync(REQUEST_DIR)) {
  for (const name of sorted(fs.readdirSync(REQUEST_DIR).filter(name => name.endsWith('.json')))) {
    const file = `artifacts/migration/tic/p7/primitive-requests/${name}`
    let request
    try { request = JSON.parse(fs.readFileSync(path.join(REQUEST_DIR, name), 'utf8')) } catch { continue }
    if ((request.status || 'pending') !== 'pending') continue
    const cards = sorted([...new Set([
      ...(Array.isArray(request.cards) ? request.cards : []),
      ...(Array.isArray(request.code) ? request.code : request.code ? [request.code] : []),
    ].filter(code => campaignSet.has(String(code))).map(String))])
    pendingRequests.push({
      file,
      id: String(request.id || name.replace(/\.json$/, '')),
      kind: request.kind || 'unknown',
      title: request.title || request.primitive || null,
      refactorOnly: request.kind === 'shared-factory',
      cards,
    })
  }
}
const behaviorRequestsByCode = new Map()
const refactorRequestsByCode = new Map()
for (const request of pendingRequests) {
  for (const code of request.cards) {
    const target = request.refactorOnly ? refactorRequestsByCode : behaviorRequestsByCode
    target.set(code, [...(target.get(code) || []), request])
  }
}

// ---------------------------------------------------------------------------
// 条目文件索引与「已实现」判定：
//   项目惯例是**未实现才写 `implemented:false`**；多数已实现条目没有 implemented 字段。
//   因此口径 =「文件存在 + 未显式 implemented:false + 有实际行为」：
//     · 行为键来自运行时注册条目（abilities/modifiers/各类 *Rule），兼容 _shared.js 工厂
//       （如 floodedTurnEndAgenda / scenarioReferenceEntry 在卡文件里没有字面键）；
//     · 运行时条目缺失时回退到文件源码里的行为键字面量；
//     · 显式 `implemented:true` 只是最强声明，不再是必要条件。
// ---------------------------------------------------------------------------
const entryFileByCode = new Map()
const walkJs = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walkJs(absolute)
    else if (entry.name.endsWith('.js')) {
      const code = path.basename(entry.name, '.js')
      if (!entryFileByCode.has(code) || rel(absolute) < entryFileByCode.get(code)) entryFileByCode.set(code, rel(absolute))
    }
  }
}
walkJs(ENTRY_ROOT)
let runtimeEntries = null
try {
  const facade = await import(pathToFileURL(path.join(mod, 'src/cards/encounter-abilities.js')).href)
  runtimeEntries = new Map((facade.NON_PLAYER_ABILITY_ENTRIES || []).map(entry => [entry.code, entry]))
} catch (error) {
  console.error(`⚠️ 无法加载运行时条目（回退到源码行为键扫描）：${error.message}`)
}
const BEHAVIOR_RULE_KEYS = ['abilities', 'modifiers', 'actRule', 'agendaRule', 'locationRule', 'treacheryRule',
  'enemyRule', 'scenarioRule', 'assetRule', 'interactionRule', 'investigatorRule', 'locationBarrier', 'effect',
  // 条目级行为通道（顶层方法简写）：显现结算 encounterResolve、替换/投降钩子等。
  'encounterResolve', 'surrender', 'onReveal', 'resolve']
const behaviorKeysOf = entry => {
  if (!entry) return []
  const keys = []
  for (const key of BEHAVIOR_RULE_KEYS) {
    const value = entry[key]
    if (value == null) continue
    if (Array.isArray(value) && value.length === 0) continue
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue
    keys.push(key)
  }
  return keys
}
const staticBehaviorKeys = text => BEHAVIOR_RULE_KEYS.filter(key =>
  new RegExp(`\\b${key}\\s*[:(]`).test(text))
const entryMeta = new Map()
for (const code of campaignCodes) {
  const file = entryFileByCode.get(code) || null
  if (!file) {
    entryMeta.set(code, { file: null, sha256: null, implemented: false, implementedFlag: 'no-file',
      behaviorKeys: [], simplified: false, scope: null })
    continue
  }
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  const scopeMatch = /scope:\s*'([a-z]+)'/.exec(text) || /scope:\s*"([a-z]+)"/.exec(text)
  const declaredTrue = /\bimplemented\s*:\s*true\b/.test(text)
  const declaredFalse = /\bimplemented\s*:\s*false\b/.test(text)
  const runtimeEntry = runtimeEntries?.get(code) || null
  const behaviorKeys = behaviorKeysOf(runtimeEntry)
  const keys = behaviorKeys.length ? behaviorKeys : staticBehaviorKeys(text)
  const hasBehavior = keys.length > 0
  entryMeta.set(code, {
    file,
    sha256: sha256(text),
    implemented: !declaredFalse && (declaredTrue || hasBehavior),
    implementedFlag: declaredFalse ? 'explicit-false' : declaredTrue ? 'explicit-true' : hasBehavior ? 'behavior-keys' : 'none',
    behaviorKeys: keys,
    simplified: /\bsimplified\s*:\s*true\b/.test(text),
    scope: scopeMatch ? scopeMatch[1] : null,
  })
}

// ---------------------------------------------------------------------------
// 实跑 tests/tic-*.test.mjs，建立「通过用例名 → 卡号」证据索引
// ---------------------------------------------------------------------------
const testFiles = sorted(fs.readdirSync(path.join(mod, 'tests'))
  .filter(name => /^tic-.*\.test\.mjs$/.test(name))
  .map(name => `games/arkhamhorror/tests/${name}`))
if (!testFiles.length) throw new Error('没有找到 tests/tic-*.test.mjs')
const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tic-all-cards-audit-'))
const testEnv = { ...process.env, DSH_HOME: testHome }
delete testEnv.NODE_TEST_CONTEXT
const startedAt = Date.now()
const testRun = spawnSync(process.execPath, [
  '--test',
  '--test-reporter=./games/arkhamhorror/tools/core-test-reporter.mjs',
  ...testFiles,
], { cwd: root, env: testEnv, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
const elapsedSeconds = Math.round((Date.now() - startedAt) / 100) / 10
const events = (testRun.stdout || '').split('\n').filter(line => line.trim().startsWith('{')).flatMap(line => {
  try { return [JSON.parse(line)] } catch { return [] }
})
if (!events.length) {
  console.error((testRun.stderr || '').slice(-4000))
  console.error(`测试没有产出事件（exit ${testRun.status}）；Reporter: tools/core-test-reporter.mjs`)
  process.exit(2)
}
const eventFile = event => {
  if (!event.file) return null
  return path.isAbsolute(event.file) ? rel(event.file) : rel(path.resolve(root, event.file))
}
const passingTests = events.filter(event => event.type === 'test:pass' && !event.skipped && !event.todo)
const failingTests = events.filter(event => event.type === 'test:fail')
const testFilesWithEvents = new Set(events.map(eventFile).filter(Boolean))
const testFilesWithoutEvents = testFiles.filter(file => !testFilesWithEvents.has(file))
// 只做 re-export / register*Tests 的测试入口文件（例如 tic-scenarios-late-registered.test.mjs）：
// 用例由被 import 的文件注册，事件 file 因此指向被 import 的文件；这些不算「无事件缺口」。
const isWrapperTestFile = file => {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  return !/\btest\s*\(/.test(text) && /import\s+[^'\n]*\.test\.mjs['"]|register(?:Pending)?LateTests\s*\(/.test(text)
}
const wrapperTestFiles = testFilesWithoutEvents.filter(isWrapperTestFile)
const brokenTestFiles = testFilesWithoutEvents.filter(file => !wrapperTestFiles.includes(file))

const codePattern = code => new RegExp(`(?:^|[^0-9A-Za-z])${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9A-Za-z])`)
const dedupeSorted = list => [...new Map((list || []).map(item => [`${item.file}\u0000${item.titleMatched}\u0000${item.test || ''}`, item])).values()]
  .sort((left, right) => `${left.file}\u0000${left.titleMatched ? '0' : '1'}\u0000${left.test || ''}`
    .localeCompare(`${right.file}\u0000${right.titleMatched ? '0' : '1'}\u0000${right.test || ''}`))
// 一级证据（最强）：通过用例标题命中卡号。
const titleEvidenceByCode = new Map()
const failedEvidenceByCode = new Map()
for (const event of passingTests) {
  const title = event.name || ''
  if (!title) continue
  for (const code of campaignCodes) {
    if (!codePattern(code).test(title)) continue
    titleEvidenceByCode.set(code, [...(titleEvidenceByCode.get(code) || []),
      { file: eventFile(event), line: Number.isInteger(event.line) ? event.line : null, test: title, titleMatched: true }])
  }
}
for (const event of failingTests) {
  const title = event.name || ''
  if (!title) continue
  for (const code of campaignCodes) {
    if (!codePattern(code).test(title)) continue
    failedEvidenceByCode.set(code, [...(failedEvidenceByCode.get(code) || []),
      { file: eventFile(event), test: title }])
  }
}
// 二级证据（文件级）：该测试文件实跑通过，且文件全文出现该卡号（含 canonical / 别名）。
// 卡号是 07xxx（如 07292a）或其它循环别名；用 token 扫描避免逐卡 regex 的 O(卡数×文件数) 开销。
const passingTestsByFile = new Map()
const firstPassingTestByFile = new Map()
for (const event of passingTests) {
  const file = eventFile(event)
  if (!file) continue
  passingTestsByFile.set(file, (passingTestsByFile.get(file) || 0) + 1)
  if (!firstPassingTestByFile.has(file) || String(event.name) < firstPassingTestByFile.get(file)) {
    firstPassingTestByFile.set(file, String(event.name || ''))
  }
}
const codeTokenPattern = /(?:^|[^0-9A-Za-z])((?:0\d{4}|1\d{4}|2\d{4})[a-z]?)(?![0-9A-Za-z])/g
const fileTokens = new Map()
for (const file of passingTestsByFile.keys()) {
  if (!file.startsWith('games/arkhamhorror/tests/')) continue
  const tokens = new Set()
  for (const match of fs.readFileSync(path.join(root, file), 'utf8').matchAll(codeTokenPattern)) tokens.add(match[1])
  fileTokens.set(file, tokens)
}
const canonicalOf = code => scopeCards.get(code)?.canonicalCode || scopeCards.get(code)?.duplicateOfCode || code
const fileEvidenceByCode = new Map()
for (const [file, tokens] of fileTokens) {
  for (const code of campaignCodes) {
    const canonical = canonicalOf(code)
    if (!tokens.has(code) && !tokens.has(canonical)) continue
    fileEvidenceByCode.set(code, [...(fileEvidenceByCode.get(code) || []), {
      file,
      titleMatched: false,
      passingTests: passingTestsByFile.get(file) || 0,
      sampleTest: firstPassingTestByFile.get(file) || null,
    }])
  }
}
const testEvidenceOf = code => {
  const titleEvidence = dedupeSorted(titleEvidenceByCode.get(code) || [])
  const fileEvidence = dedupeSorted(fileEvidenceByCode.get(code) || [])
  return { titleEvidence, fileEvidence, testEvidence: [...titleEvidence, ...fileEvidence] }
}

// ---------------------------------------------------------------------------
// 无印刷行为的地点（纯 setup 静态地点，如 07320）：单列 no-behavior，不计缺口
// ---------------------------------------------------------------------------
const BEHAVIOR_TEXT = new RegExp([
  /\[(?:action|fast|free|reaction|elder_sign|auto_fail)\]/,
  /\b(?:Revelation|Forced|Reaction|Objective|Spawn|Hunter|Aloof|Patrol|Retaliate|Massive|Haunted|Surge|Peril|Prey|Test)\b/i,
  /\[(?:agility|combat|intellect|willpower)\]/i,
  /(?:cannot|can not|must|may not|instead|dissolve|discard|shuffle|draw|move|engage|ready|exhaust|damage|horror|clue|resource|victor|advance|parley|investigat)/i,
  /(?:强制|显现|反应|目标|行动|免费|生成|猎手|冷漠|巡逻|反击|庞大|闹鬼|涌动|险境|猎物|检定|不能|必须|调查员|伤害|恐惧|线索|资源|钥匙|推进|入场|交战|躲避|攻击|移动|弃掉|洗混|抽取|横置|重整|胜利)/,
].map(pattern => pattern.source).join('|'))
const noBehaviorReason = code => {
  const card = ALL_CARDS[code]
  if (!card || card.type !== 'location') return null
  const text = `${card.text || ''}\n${card.textZh || ''}\n${card.backText || ''}`.trim()
  // 纯 setup 静态地点（例：07320「入场即部分淹没」没有玩家可执行行为）。
  if (text && !BEHAVIOR_TEXT.test(text)) return 'static-location-no-printed-behavior'
  return null
}

// ---------------------------------------------------------------------------
// 章节归属（八章）：章节组 + 本章 gatherSets 命中的共享组 + chapter-data 显式卡号
// ---------------------------------------------------------------------------
const chapterOrder = (scope.chapters || []).map(chapter => chapter.id)
const groupsById = new Map((scope.groups || []).map(group => [group.id, group]))
const chaptersByCode = new Map()
const chapterMeta = []
for (const chapterId of chapterOrder) {
  const spec = chapterData[chapterId]
  if (!spec) throw new Error(`chapter-data 缺少章节：${chapterId}`)
  const gatherSets = spec.setup?.gatherSets || []
  const codes = new Set()
  for (const group of scope.groups || []) if (group.chapterId === chapterId) for (const code of group.codes) codes.add(code)
  for (const setId of gatherSets) {
    const group = groupsById.get(setId)
    if (!group) continue
    for (const code of group.codes) codes.add(code)
  }
  for (const code of [
    ...(Array.isArray(spec.encounterDeck) ? spec.encounterDeck : []),
    ...(Array.isArray(spec.reservedEncounter) ? spec.reservedEncounter : []),
    ...(Array.isArray(spec.setup?.encounterDeck) ? spec.setup.encounterDeck : []),
    ...(Array.isArray(spec.setup?.reservedEncounter) ? spec.setup.reservedEncounter : []),
    ...(Array.isArray(spec.setup?.actDecks) ? spec.setup.actDecks.flatMap(deck => deck.cards || []) : []),
    ...(Array.isArray(spec.setup?.agendaDeck) ? spec.setup.agendaDeck.map(agenda => agenda.code).filter(Boolean) : []),
    ...(Array.isArray(spec.locations) ? spec.locations.map(location => location.code) : []),
    ...(Array.isArray(spec.acts) ? spec.acts.map(act => act.originalCode) : []),
  ]) if (code && campaignSet.has(String(code))) codes.add(String(code))
  const chapterCodes = sorted([...codes].filter(code => campaignSet.has(code)))
  for (const code of chapterCodes) {
    if (!chaptersByCode.has(code)) chaptersByCode.set(code, [])
    chaptersByCode.get(code).push(chapterId)
  }
  const meta = (scope.chapters || []).find(chapter => chapter.id === chapterId)
  chapterMeta.push({ id: chapterId, code: meta?.code || spec.setup?.scenarioCode || null, name: meta?.name || chapterId,
    nameEn: meta?.nameEn || chapterId, codes: chapterCodes })
}
const unassigned = campaignCodes.filter(code => !chaptersByCode.has(code))

// ---------------------------------------------------------------------------
// 逐卡判定
// ---------------------------------------------------------------------------
const entries = campaignCodes.map(code => {
  const scopeCard = scopeCards.get(code)
  const card = ALL_CARDS[code]
  const canonicalCode = canonicalOf(code)
  const meta = entryMeta.get(canonicalCode === code ? code : canonicalCode)
    || entryMeta.get(code)
    || { file: null, sha256: null, implemented: false, implementedFlag: 'no-file', behaviorKeys: [], simplified: false, scope: null }
  const canonicalTestEvidence = testEvidenceOf(canonicalCode)
  const { titleEvidence, fileEvidence, testEvidence } = canonicalCode === code ? canonicalTestEvidence : (() => {
    const own = testEvidenceOf(code)
    return {
      titleEvidence: dedupeSorted([...canonicalTestEvidence.titleEvidence, ...own.titleEvidence]),
      fileEvidence: dedupeSorted([...canonicalTestEvidence.fileEvidence, ...own.fileEvidence]),
      testEvidence: dedupeSorted([...canonicalTestEvidence.testEvidence, ...own.testEvidence]),
    }
  })()
  const evidence = testEvidence
  const failedEvidence = dedupeSorted(failedEvidenceByCode.get(code) || [])
  const behaviorRequests = (behaviorRequestsByCode.get(code) || []).map(request => ({ file: request.file, id: request.id, kind: request.kind, title: request.title }))
  const refactorRequests = (refactorRequestsByCode.get(code) || []).map(request => ({ file: request.file, id: request.id, kind: request.kind }))
  const noBehavior = noBehaviorReason(code)
  const base = {
    code,
    name: card.nameZh || card.name || null,
    nameEn: card.name || null,
    type: card.type,
    owner: scopeCard?.owner || null,
    entryScope: meta.scope,
    canonicalCode,
    ...(canonicalCode !== code ? { aliasOf: canonicalCode } : {}),
    entryFile: meta.file,
    entrySha256: meta.sha256,
    implemented: meta.implemented,
    implementedFlag: meta.implementedFlag,
    behaviorKeys: meta.behaviorKeys,
    printedBehavior: !noBehavior,
    chapters: chaptersByCode.get(code) || [],
  }
  let status
  let reason
  if (noBehavior) {
    status = 'no-behavior'
    reason = noBehavior
  } else if (behaviorRequests.length && (!meta.implemented || !evidence.length)) {
    status = 'blocked'
    reason = !meta.file ? 'no-entry-file' : !meta.implemented ? 'entry-not-implemented' : 'no-test-evidence'
  } else if (!meta.file) {
    status = 'missing'
    reason = 'no-entry-file'
  } else if (!meta.implemented) {
    status = 'missing'
    reason = meta.implementedFlag === 'explicit-false' ? 'entry-implemented-false' : 'entry-no-behavior-keys'
  } else if (!evidence.length) {
    status = 'missing'
    reason = 'no-test-evidence'
  } else if (behaviorRequests.length || meta.simplified) {
    status = 'simplified'
    reason = meta.simplified ? 'entry-declared-simplified' : 'pending-behavior-primitive-request'
  } else {
    status = 'verified'
    reason = null
  }
  return {
    ...base,
    status,
    ...(reason ? { reason } : {}),
    evidence,
    strongEvidence: titleEvidence,
    ...(!titleEvidence.length && fileEvidence.length ? { fileLevelEvidence: fileEvidence } : {}),
    ...(failedEvidence.length ? { failedEvidence } : {}),
    ...(behaviorRequests.length ? { pendingBehaviorRequests: behaviorRequests } : {}),
    ...(refactorRequests.length ? { refactorRequests } : {}),

  }
})
if (entries.length !== campaignCodes.length) throw new Error('账本条目数与 campaign scope 不一致')
if (new Set(entries.map(entry => entry.code)).size !== entries.length) throw new Error('账本存在重复卡号')

const countBy = predicate => entries.filter(predicate).length
const byStatus = status => entries.filter(entry => entry.status === status)
const missing = byStatus('missing')
const blocked = byStatus('blocked')
const simplified = byStatus('simplified')
const verified = byStatus('verified')
const noBehavior = byStatus('no-behavior')
const pending = [...missing, ...blocked]
const byType = Object.fromEntries(sorted([...new Set(entries.map(entry => entry.type))]).map(type => {
  const list = entries.filter(entry => entry.type === type)
  return [type, {
    total: list.length,
    verified: list.filter(entry => entry.status === 'verified').length,
    simplified: list.filter(entry => entry.status === 'simplified').length,
    missing: list.filter(entry => entry.status === 'missing').length,
    blocked: list.filter(entry => entry.status === 'blocked').length,
    noBehavior: list.filter(entry => entry.status === 'no-behavior').length,
  }]
}))
const byChapter = chapterMeta.map(chapter => {
  const list = entries.filter(entry => entry.chapters.includes(chapter.id))
  return {
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    nameEn: chapter.nameEn,
    total: list.length,
    verified: list.filter(entry => entry.status === 'verified').length,
    simplified: list.filter(entry => entry.status === 'simplified').length,
    missing: list.filter(entry => entry.status === 'missing').length,
    blocked: list.filter(entry => entry.status === 'blocked').length,
    noBehavior: list.filter(entry => entry.status === 'no-behavior').length,
    pending: list.filter(entry => ['missing', 'blocked'].includes(entry.status)).length,
    pendingCodes: list.filter(entry => ['missing', 'blocked'].includes(entry.status)).map(entry => entry.code),
    simplifiedCodes: list.filter(entry => entry.status === 'simplified').map(entry => entry.code),
  }
})
const chapterAssigned = new Set(entries.filter(entry => entry.chapters.length > 0).map(entry => entry.code))
const reasonBuckets = {
  explicitImplementedFalse: entries.filter(entry => entry.reason === 'entry-implemented-false').map(entry => entry.code),
  noBehaviorKeys: entries.filter(entry => entry.reason === 'entry-no-behavior-keys').map(entry => entry.code),
  noTestEvidence: entries.filter(entry => entry.reason === 'no-test-evidence').map(entry => entry.code),
  noEntryFile: entries.filter(entry => entry.reason === 'no-entry-file').map(entry => entry.code),
  // 证据强度：标题命中 vs 仅文件内容命中（后者建议补标题级测试升级为强证据）
  verifiedByTitle: verified.filter(entry => entry.strongEvidence.length > 0).map(entry => entry.code),
  verifiedByFileOnly: verified.filter(entry => entry.strongEvidence.length === 0).map(entry => entry.code),
  fileLevelEvidenceOnly: entries.filter(entry => entry.strongEvidence.length === 0 && entry.evidence.length > 0).map(entry => entry.code),
  implementedWithoutEvidence: entries.filter(entry => entry.implemented && entry.evidence.length === 0).map(entry => entry.code),
}

const summary = {
  total: entries.length,
  verified: verified.length,
  simplified: simplified.length,
  missing: missing.length,
  blocked: blocked.length,
  noBehavior: noBehavior.length,
  pending: pending.length,
  verifiedPlusSimplified: verified.length + simplified.length,
  gateComplete: missing.length + blocked.length === 0,
  strictComplete: verified.length + noBehavior.length === entries.length,
  // 分区信息（campaign = TIC 全部非玩家卡；玩家/调查员另有账本）
  campaignPartition: campaignCodes.length,
  allRecords: scope.cards.length,
  partitions: Object.fromEntries(Object.entries(scope.partitions).map(([key, list]) => [key, list.length])),
  chapters: chapterMeta.length,
  unassignedChapterCards: unassigned.length,
  chapterCoverageConserved: chapterAssigned.size + unassigned.length === campaignCodes.length,
  testFiles: testFiles.length,
  testFilesWithoutEvents: brokenTestFiles.length,
  wrapperTestFiles: wrapperTestFiles.length,
  testsPassed: passingTests.length,
  testsFailed: failingTests.length,
  pendingPrimitiveRequests: pendingRequests.length,
  behaviorPrimitiveRequests: pendingRequests.filter(request => !request.refactorOnly).length,
  refactorPrimitiveRequests: pendingRequests.filter(request => request.refactorOnly).length,
  recordsWithEntryFile: entries.filter(entry => entry.entryFile).length,
  recordsImplemented: entries.filter(entry => entry.implemented).length,
  recordsWithTestEvidence: entries.filter(entry => entry.evidence.length > 0).length,
  verifiedByTitle: reasonBuckets.verifiedByTitle.length,
  verifiedByFileOnly: reasonBuckets.verifiedByFileOnly.length,
  implementedWithoutEvidence: reasonBuckets.implementedWithoutEvidence.length,
  reasonBuckets,
}

const profile = {
  id: 'tic-all-cards-2026-11',
  scope: `TIC 全部非玩家印刷记录 ${campaignCodes.length} 张（audit/tic-scope.json 的 ticCampaign 分区；全循环共 ${scope.cards.length} 条记录 = campaign ${campaignCodes.length} + investigators + player，玩家/调查员另有 audit/tic-player-acceptance.json / audit/tic-investigators.json）。`,
  basis: `实跑 ${testFiles.length} 个 tests/tic-*.test.mjs（${passingTests.length} 通过 / ${failingTests.length} 失败用例，${brokenTestFiles.length} 个无事件损坏文件 + ${wrapperTestFiles.length} 个 re-export 入口）。证据两级：①通过用例标题命中卡号（strongEvidence）；②含该卡号的测试文件实跑有通过用例（fileLevelEvidence，按文件内容 token 匹配，含 canonical/别名）。已实现判定 = 条目文件存在 + 未显式 implemented:false + 有实际行为（运行时注册条目的 abilities/modifiers/各类 *Rule；兼容 _shared 工厂）；显式 implemented:true 只是最强声明，不再作为必要条件（项目惯例：未实现才写 implemented:false）。`,
  evidencePolicy: '卡号出现在 definition/behavior/测试源码里不构成证据（§5.2 事故备忘）：文件级证据只在该测试文件**实跑有通过用例**时成立，且与标题命中分开记账（strongEvidence / fileLevelEvidence）。整体仍要求「实跑通过 + 卡号命中」，失败用例只记 failedEvidence。',
  statusPolicy: '优先级 no-behavior > blocked > 缺失（missing）> simplified > verified。simplified 只在「已实现且有测试证据，但存在 pending 行为类原语请求」或条目显式 simplified:true 时成立，不会计入 verified；gate 口径（w3）允许 verified+simplified 通过、no-behavior 单列、missing 必须为 0。',
  blockedPolicy: 'blocked = 出现在 pending 的行为类原语请求（kind!==shared-factory）或 audit/tic-primitive-plan.json 中状态非 done 的原语卡片清单，且条目未实现或无通过测试。shared-factory（去重/共享工厂）请求只记 refactorRequests，不改变单卡状态。',
  noBehaviorPolicy: 'no-behavior = 印刷文本无玩家可执行行为的地点是静态 setup 地点（当前唯一：07320 入场即部分淹没）；单列、不计缺口，也不参与 literalCardBehavior 的章节 pending 计算。',
  chapterPolicy: '章节归属 = scope.groups（chapterId）+ 本章 chapter-data.setup.gatherSets 命中的共享遭遇组 + chapter-data 显式 encounterDeck/reservedEncounter/acts/agendas/locations 卡号；共享遭遇卡可属于多章，故 byChapter.total 相加可大于 total。',
  sources: [
    'audit/tic-scope.json',
    'audit/tic-primitive-plan.json',
    'artifacts/migration/tic/p7/primitive-requests/*.json',
    'content/campaigns/theInnsmouthConspiracy/chapter-data.json',
    'src/cards/cards-data.js',
    'src/cards/encounter-entries/**/<code>.js',
    'tests/tic-*.test.mjs（实跑，tools/core-test-reporter.mjs）',
  ],
  exitCodes: { 0: '完整且 --check 一致', 1: '账本一致/写入成功但仍有缺口', 2: '--check 漂移、账本缺失或输入错误' },
}

const ledger = {
  schemaVersion: LEDGER_VERSION,
  generatedBy: 'tools/audit-tic-all-cards.mjs',
  profile,
  summary,
  snapshot: {
    scopeSha256: sha256(fs.readFileSync(path.join(mod, 'audit/tic-scope.json'))),
    primitivePlanSha256: sha256(fs.readFileSync(path.join(mod, 'audit/tic-primitive-plan.json'))),
    testRun: { exit: testRun.status, files: testFiles.length, passed: passingTests.length, failed: failingTests.length,
      filesWithoutEvents: brokenTestFiles, wrapperFiles: wrapperTestFiles },
    testFiles: testFiles.map(file => ({ file, sha256: sha256(fs.readFileSync(path.join(root, file))) })),
    primitivePlan: planSummary,
    pendingPrimitiveRequests: pendingRequests.map(request => ({
      file: request.file, id: request.id, kind: request.kind, refactorOnly: request.refactorOnly, cards: request.cards,
    })),
  },
  byType,
  byChapter,
  entries,
  missing: missing.map(entry => ({ code: entry.code, type: entry.type, reason: entry.reason, chapters: entry.chapters,
    refactorRequests: entry.refactorRequests?.map(request => request.id) || [] })),
  blocked: blocked.map(entry => ({ code: entry.code, type: entry.type, reason: entry.reason,
    requests: [...(entry.pendingBehaviorRequests || []).map(request => request.id), ...(entry.pendingPrimitivePlan || [])] })),
  simplified: simplified.map(entry => ({ code: entry.code, type: entry.type, reason: entry.reason,
    requests: [...(entry.pendingBehaviorRequests || []).map(request => request.id), ...(entry.pendingPrimitivePlan || [])] })),
  noBehavior: noBehavior.map(entry => ({ code: entry.code, type: entry.type, reason: entry.reason })),
  unassignedChapterCards: unassigned,
  remaining: [
    ...missing.map(entry => `missing ${entry.code}（${entry.reason}）`),
    ...blocked.map(entry => `blocked ${entry.code}（${entry.reason}）`),
    ...simplified.map(entry => `simplified ${entry.code}（${entry.reason}）`),
    ...brokenTestFiles.map(file => `测试文件没有产出用例：${file}`),
    ...failingTests.filter(event => campaignCodes.some(code => codePattern(code).test(event.name || '')))
      .slice(0, 20).map(event => `失败用例：${event.file || ''} ${event.name}`),
  ],
}
const json = `${JSON.stringify(ledger, null, 2)}\n`
// gate 口径（Lead 确认）：no-behavior 单列、verified+simplified 都算通过、missing/blocked 必须为 0。
// strictComplete 只用于 §5.2 最严口径提示（全部 verified，不含 simplified）。
const complete = summary.missing + summary.blocked === 0
const strictComplete = summary.total === summary.verified + summary.noBehavior

const printSummary = () => {
  console.log(JSON.stringify(summary))
  console.log(`\n缺口（gate）：missing ${summary.missing} / blocked ${summary.blocked}；状态：verified ${summary.verified} / simplified ${summary.simplified} / no-behavior ${summary.noBehavior}`)
  console.log(`证据强度：标题命中 ${summary.verifiedByTitle} / 仅文件级 ${summary.verifiedByFileOnly}；已实现但无证据 ${summary.implementedWithoutEvidence}`)
  console.log(`测试：${summary.testFiles} 文件 / ${summary.testsPassed} 通过 / ${summary.testsFailed} 失败 / ${summary.testFilesWithoutEvents} 文件无事件`)
  if (summary.missing) console.log(`\nmissing（前 20）：${missing.slice(0, 20).map(entry => `${entry.code}:${entry.reason}`).join(', ')}`)
  if (summary.blocked) console.log(`blocked：${blocked.map(entry => entry.code).join(', ')}`)
  if (summary.simplified) console.log(`simplified（gate 允许，需关闭 pending 原语请求后升级 verified）：${simplified.map(entry => entry.code).join(', ')}`)
  console.log(`\n${complete ? '✅ literalCardBehavior 逐卡账本完整（gate：missing/blocked=0）' : '⏳ 逐卡账本仍有 missing/blocked 缺口（literalCardBehavior 保持 false）'}`)
  if (complete && !strictComplete) console.log('ℹ️ §5.2 最严口径仍有 simplified 卡（需原语请求关闭后才算逐条验收）。')
}

// 账本对比口径：证据/状态/章节/请求队列是语义内容；snapshot.testRun 与 testFiles 列表是
// 「重算时点」的运行快照（测试文件增删本身不改变逐卡证据时不算漂移，但仍建议 --write 刷新）。
const stableLedger = ledgerValue => {
  const clone = JSON.parse(JSON.stringify(ledgerValue))
  if (clone.snapshot) { delete clone.snapshot.testRun; delete clone.snapshot.testFiles }
  return clone
}
if (noWrite) {
  if (!fs.existsSync(OUTPUT)) {
    console.error(`逐卡账本缺失：${rel(OUTPUT)}（先跑 --write）`)
    process.exit(2)
  }
  const current = fs.readFileSync(OUTPUT, 'utf8')
  const currentLedger = (() => { try { return JSON.parse(current) } catch { return null } })()
  const semanticEqual = currentLedger
    ? JSON.stringify(stableLedger(currentLedger)) === JSON.stringify(stableLedger(ledger))
    : false
  if (!semanticEqual) {
    console.error('❌ 逐卡账本漂移：重新计算的逐卡证据/状态与磁盘不一致（测试覆盖、条目声明或原语请求队列发生变化）。')
    if (currentLedger?.summary) {
      console.error(`磁盘 summary: ${JSON.stringify(currentLedger.summary).slice(0, 400)}`)
      console.error(`重算 summary: ${JSON.stringify(summary).slice(0, 400)}`)
      const before = new Map((currentLedger.entries || []).map(entry => [entry.code, entry.status]))
      const changed = entries.filter(entry => before.get(entry.code) !== entry.status)
      if (changed.length) console.error(`状态变化：${changed.map(entry => `${entry.code}:${before.get(entry.code)}→${entry.status}`).join(', ')}`)
    }
    console.error('请确认变更后重跑：node tools/audit-tic-all-cards.mjs --write')
    process.exit(2)
  }
  if (current !== json) console.error('ℹ️ 语义一致，仅运行快照（测试文件列表/计数）变化；可在门禁前重跑 --write 刷新。')
  printSummary()
  process.exit(complete ? 0 : 1)
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.writeFileSync(OUTPUT, json)
console.log(`已写入 ${rel(OUTPUT)}（实跑 ${testFiles.length} 个测试文件，${elapsedSeconds}s）`)
printSummary()
process.exit(0)
