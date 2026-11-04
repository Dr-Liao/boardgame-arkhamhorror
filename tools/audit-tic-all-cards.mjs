#!/usr/bin/env node
// 印斯茅斯阴谋（The Innsmouth Conspiracy）P7 逐卡验收账本。
//
//   node tools/audit-tic-all-cards.mjs --write   实跑 TIC 全部 Node 测试后写 audit/tic-all-card-acceptance.json
//   node tools/audit-tic-all-cards.mjs [--check] 默认：复算并逐字节比对账本（漂移 exit 2；一致但不完整 exit 1）
//
// 本账本是八章验收里 `literalCardBehavior` 的唯一证据来源（tools/audit-tic-scenarios.mjs:126/303-319/706）。
//
// 证据规则（docs/arkham-content-migration.md §5.2）：
// - 只认**实跑的测试**：spawnSync 执行 `tests/tic-*.test.mjs`，用 tools/core-test-reporter.mjs 读
//   test:pass / test:fail 事件；不读源码字符串猜结论，也不把「卡号出现在源码/测试标题里」当通过。
// - 逐卡证据 = 至少一个**通过**的用例名命中该卡号（按词边界匹配，07292a 不会误命中 07292）；
//   失败用例只记入 failedEvidence（诊断用，不计证据）。
// - 条目侧证据 = 单卡文件存在（`src/cards/encounter-entries/**/<code>.js`）且文件里显式
//   `implemented: true`（与 src/cards/card-rules.js#implementedFor 的运行时口径一致，只认显式声明）。
// - 重印按 canonical：scope.cards 的 canonicalCode/duplicateOfCode 指向另一卡号时，证据按 canonical 归集，
//   条目上记录 aliasOf；TIC 当前 361 条记录无别名。
//
// 状态（优先级从高到低，全部可复算）：
//   no-behavior：印刷文本没有玩家可执行行为的地点（如 07320「入场即部分淹没」这类纯 setup 静态地点）；
//                单列，不计缺口，不影响 literalCardBehavior 的章节覆盖。
//   blocked    ：卡号出现在 **pending 的行为类原语请求**里，且条目未声明 implemented 或没有通过测试；
//                或出现在 audit/tic-primitive-plan.json 中状态非 done 的原语卡片清单里。
//   simplified ：卡号出现在 pending 的行为类原语请求里，但条目已 implemented 且有通过测试
//                （§5.2：显式简化/近似必须留在待实现清单，不能记 verified）；或条目声明 simplified:true。
//   verified   ：条目文件存在 + implemented:true + ≥1 通过用例命中卡号，且无上述降级条件。
//   missing    ：其余（无条目文件 / 未声明 implemented / 无通过测试覆盖），reason 字段给出精确原因。
//   · `kind:'shared-factory'` 的请求是去重/重构类，不改变单卡状态，只记入 refactorRequests。
//
// 汇总里的 pending = total - verified - noBehavior（即尚未逐卡验收的记录数），供
// tools/audit-tic-scenarios.mjs 的 notes.literalCardLedger.pending 直接读取。
//
// 产物是确定性的：不写时间戳 / 耗时；包含 scope、测试文件、条目文件的 sha256 与实跑通过用例名，
// 因此 --check 重跑即可检测「测试/条目/请求队列/测试覆盖」的漂移。
//
// 退出码：0 = 完整（全部 campaign 记录 verified 或 no-behavior）且 --check 一致；
//         1 = 账本一致/写入成功但仍有缺口；
//         2 = --check 漂移、账本缺失或用法/输入错误。

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

// 原语计划：new/reuse 的 status 不是 done 时，其 cards 记 blocked（当前全部 done）。
const planPendingByCode = new Map()
for (const entry of [...(primitivePlan.new || []), ...(primitivePlan.reuse || [])]) {
  if (entry.status === 'done') continue
  for (const code of entry.cards || []) {
    if (!campaignSet.has(code)) continue
    planPendingByCode.set(code, [...(planPendingByCode.get(code) || []), entry.id])
  }
}
const planSummary = {
  newTotal: (primitivePlan.new || []).length,
  newDone: (primitivePlan.new || []).filter(entry => entry.status === 'done').length,
  reuseTotal: (primitivePlan.reuse || []).length,
  reuseDone: (primitivePlan.reuse || []).filter(entry => entry.status === 'done').length,
  pendingNew: (primitivePlan.new || []).filter(entry => entry.status !== 'done').map(entry => entry.id),
  gates: primitivePlan.gates || null,
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
// 条目文件索引与声明（只读源码；与 implementedFor 的运行时语义一致：显式 implemented:true）
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
const entryMeta = new Map()
for (const code of campaignCodes) {
  const file = entryFileByCode.get(code) || null
  if (!file) { entryMeta.set(code, { file: null, sha256: null, implemented: false, simplified: false, scope: null }); continue }
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  const scopeMatch = /scope:\s*'([a-z]+)'/.exec(text) || /scope:\s*"([a-z]+)"/.exec(text)
  entryMeta.set(code, {
    file,
    sha256: sha256(text),
    implemented: /\bimplemented\s*:\s*true\b/.test(text),
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

const codePattern = code => new RegExp(`(?:^|[^0-9A-Za-z])${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9A-Za-z])`)
const evidenceByCode = new Map()
const failedEvidenceByCode = new Map()
for (const event of passingTests) {
  const title = event.name || ''
  if (!title) continue
  for (const code of campaignCodes) {
    if (!codePattern(code).test(title)) continue
    evidenceByCode.set(code, [...(evidenceByCode.get(code) || []),
      { file: eventFile(event), line: Number.isInteger(event.line) ? event.line : null, test: title }])
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
const dedupeSorted = list => [...new Map((list || []).map(item => [`${item.file}\u0000${item.test}`, item])).values()]
  .sort((left, right) => `${left.file}\u0000${left.test}`.localeCompare(`${right.file}\u0000${right.test}`))

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
  const canonicalCode = scopeCard?.canonicalCode || scopeCard?.duplicateOfCode || code
  const meta = entryMeta.get(canonicalCode === code ? code : canonicalCode)
    || entryMeta.get(code)
    || { file: null, sha256: null, implemented: false, simplified: false, scope: null }
  const evidence = dedupeSorted(evidenceByCode.get(canonicalCode) || evidenceByCode.get(code) || [])
  const failedEvidence = dedupeSorted(failedEvidenceByCode.get(code) || [])
  const behaviorRequests = (behaviorRequestsByCode.get(code) || []).map(request => ({ file: request.file, id: request.id, kind: request.kind, title: request.title }))
  const refactorRequests = (refactorRequestsByCode.get(code) || []).map(request => ({ file: request.file, id: request.id, kind: request.kind }))
  const planPending = planPendingByCode.get(code) || []
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
    printedBehavior: !noBehavior,
    chapters: chaptersByCode.get(code) || [],
  }
  let status
  let reason
  if (noBehavior) {
    status = 'no-behavior'
    reason = noBehavior
  } else if ((behaviorRequests.length || planPending.length) && (!meta.implemented || !evidence.length)) {
    status = 'blocked'
    reason = !meta.file ? 'no-entry-file' : !meta.implemented ? 'entry-not-implemented' : 'no-passing-test'
  } else if (!meta.file) {
    status = 'missing'
    reason = 'no-entry-file'
  } else if (!meta.implemented) {
    status = 'missing'
    reason = 'entry-not-implemented'
  } else if (!evidence.length) {
    status = 'missing'
    reason = 'no-passing-test'
  } else if (behaviorRequests.length || planPending.length || meta.simplified) {
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
    ...(failedEvidence.length ? { failedEvidence } : {}),
    ...(behaviorRequests.length ? { pendingBehaviorRequests: behaviorRequests } : {}),
    ...(refactorRequests.length ? { refactorRequests } : {}),
    ...(planPending.length ? { pendingPrimitivePlan: planPending } : {}),
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
const pending = [...missing, ...blocked, ...simplified]
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
    pending: list.filter(entry => ['missing', 'blocked', 'simplified'].includes(entry.status)).length,
    pendingCodes: list.filter(entry => ['missing', 'blocked', 'simplified'].includes(entry.status)).map(entry => entry.code),
  }
})
const chapterAssigned = new Set(entries.filter(entry => entry.chapters.length > 0).map(entry => entry.code))
const reasonBuckets = {
  entryNotImplemented: entries.filter(entry => entry.reason === 'entry-not-implemented').map(entry => entry.code),
  noPassingTest: entries.filter(entry => entry.reason === 'no-passing-test').map(entry => entry.code),
  noEntryFile: entries.filter(entry => entry.reason === 'no-entry-file').map(entry => entry.code),
  testedButNoImplementedFlag: entries.filter(entry => entry.evidence.length > 0 && !entry.implemented).map(entry => entry.code),
  implementedButNoPassingTest: entries.filter(entry => entry.implemented && entry.evidence.length === 0).map(entry => entry.code),
}

const summary = {
  total: entries.length,
  verified: verified.length,
  simplified: simplified.length,
  missing: missing.length,
  blocked: blocked.length,
  noBehavior: noBehavior.length,
  pending: pending.length,
  // 分区信息（campaign = TIC 全部非玩家卡；玩家/调查员另有账本）
  campaignPartition: campaignCodes.length,
  allRecords: scope.cards.length,
  partitions: Object.fromEntries(Object.entries(scope.partitions).map(([key, list]) => [key, list.length])),
  chapters: chapterMeta.length,
  unassignedChapterCards: unassigned.length,
  chapterCoverageConserved: chapterAssigned.size + unassigned.length === campaignCodes.length,
  testFiles: testFiles.length,
  testFilesWithoutEvents: testFilesWithoutEvents.length,
  testsPassed: passingTests.length,
  testsFailed: failingTests.length,
  pendingPrimitiveRequests: pendingRequests.length,
  behaviorPrimitiveRequests: pendingRequests.filter(request => !request.refactorOnly).length,
  refactorPrimitiveRequests: pendingRequests.filter(request => request.refactorOnly).length,
  recordsWithEntryFile: entries.filter(entry => entry.entryFile).length,
  recordsImplemented: entries.filter(entry => entry.implemented).length,
  recordsWithPassingTest: entries.filter(entry => entry.evidence.length > 0).length,
  reasonBuckets,
}

const profile = {
  id: 'tic-all-cards-2026-11',
  scope: `TIC 全部非玩家印刷记录 ${campaignCodes.length} 张（audit/tic-scope.json 的 ticCampaign 分区；全循环共 ${scope.cards.length} 条记录 = campaign ${campaignCodes.length} + investigators + player，玩家/调查员另有 audit/tic-player-acceptance.json / audit/tic-investigators.json）。`,
  basis: `实跑 ${testFiles.length} 个 tests/tic-*.test.mjs（${passingTests.length} 通过 / ${failingTests.length} 失败用例，${testFilesWithoutEvents.length} 个文件无事件）；通过用例名按词边界命中卡号归集证据；条目证据 = 单卡文件存在 + 显式 implemented:true（与 src/cards/card-rules.js#implementedFor 同口径）。`,
  evidencePolicy: '卡号出现在 definition/behavior/测试源码里不构成证据（§5.2 事故备忘）；只认测试进程实际产出的 test:pass 事件与用例标题命中，失败用例只记 failedEvidence。',
  statusPolicy: '优先级 no-behavior > blocked > 缺失（missing）> simplified > verified：前四类的判定不互相叠加；simplified 只在「已实现且有通过测试，但存在 pending 行为类原语请求」或条目显式 simplified:true 时成立，不会计入 verified。',
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
      filesWithoutEvents: testFilesWithoutEvents },
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
    ...testFilesWithoutEvents.map(file => `测试文件没有产出用例：${file}`),
    ...failingTests.filter(event => campaignCodes.some(code => codePattern(code).test(event.name || '')))
      .slice(0, 20).map(event => `失败用例：${event.file || ''} ${event.name}`),
  ],
}
const json = `${JSON.stringify(ledger, null, 2)}\n`
const complete = summary.total === summary.verified + summary.noBehavior

const printSummary = () => {
  console.log(JSON.stringify(summary))
  console.log(`\n缺口：missing ${summary.missing} / blocked ${summary.blocked} / simplified ${summary.simplified} / no-behavior ${summary.noBehavior}`)
  console.log(`测试：${summary.testFiles} 文件 / ${summary.testsPassed} 通过 / ${summary.testsFailed} 失败 / ${summary.testFilesWithoutEvents} 文件无事件`)
  if (summary.missing) console.log(`\nmissing（前 20）：${missing.slice(0, 20).map(entry => `${entry.code}:${entry.reason}`).join(', ')}`)
  if (summary.blocked) console.log(`blocked：${blocked.map(entry => entry.code).join(', ')}`)
  if (summary.simplified) console.log(`simplified：${simplified.map(entry => entry.code).join(', ')}`)
  console.log(`\n${complete ? '✅ literalCardBehavior 逐卡账本完整' : '⏳ 逐卡账本仍有缺口（literalCardBehavior 保持 false）'}`)
}

if (noWrite) {
  if (!fs.existsSync(OUTPUT)) {
    console.error(`逐卡账本缺失：${rel(OUTPUT)}（先跑 --write）`)
    process.exit(2)
  }
  const current = fs.readFileSync(OUTPUT, 'utf8')
  if (current !== json) {
    const currentLedger = (() => { try { return JSON.parse(current) } catch { return null } })()
    console.error('❌ 逐卡账本漂移：重新计算的结果与磁盘不一致（测试/条目/请求队列/覆盖发生变化）。')
    if (currentLedger?.summary) {
      console.error(`磁盘 summary: ${JSON.stringify(currentLedger.summary).slice(0, 400)}`)
      console.error(`重算 summary: ${JSON.stringify(summary).slice(0, 400)}`)
    }
    console.error('请确认变更后重跑：node tools/audit-tic-all-cards.mjs --write')
    process.exit(2)
  }
  printSummary()
  process.exit(complete ? 0 : 1)
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.writeFileSync(OUTPUT, json)
console.log(`已写入 ${rel(OUTPUT)}（实跑 ${testFiles.length} 个测试文件，${elapsedSeconds}s）`)
printSummary()
process.exit(0)
