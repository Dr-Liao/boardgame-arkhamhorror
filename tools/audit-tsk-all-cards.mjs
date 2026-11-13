#!/usr/bin/env node
// 绯红密钥（The Scarlet Keys）P8 全卡逐卡验收账本 —— 439 条印刷记录
// （战役 311 / 调查员及专属依赖 20 / 玩家 108）。
//
//   node tools/audit-tsk-all-cards.mjs --write    实跑证据测试后写 audit/tsk-all-card-acceptance.json（并生成报告）
//   node tools/audit-tsk-all-cards.mjs [--check]  默认：复算并逐字节比对账本（漂移/缺失 → 非零退出）
//
// 本账本是 P8「逐卡字面行为」的**唯一证据来源**：tools/audit-tsk-migration.mjs（P9 发布审计）
// 读 summary.gateComplete / summary.missing / summary.total / cards[].scenarioId 与状态词表
// ['verified','simplified','scenario-data','scenario-reference']，因此这些字段的口径是对外契约。
//
// 证据口径（与 TDE / TIC 一致，见 docs/arkham-content-migration.md §5.2）：
// - 只认**实跑的测试**：spawnSync 执行证据测试文件，用 tools/core-test-reporter.mjs 读
//   test:pass / test:fail 事件；不读源码字符串猜结论。失败用例只记 failedEvidence，不算证据。
// - 证据两级：
//   ① strongEvidence（最强）= 通过用例**标题**命中该卡号（词边界；09544a 不会误命中 09544）；
//   ② fileLevelEvidence（二级）= 该测试文件**实跑有通过用例**，且文件全文出现该卡号 token。
// - 玩家 108 与调查员 20 不重复实跑：复用 audit/tsk-player-acceptance.json 与
//   audit/tsk-investigators.json 已登记的 verified + evidence（其中玩家证据本身就是逐卡标题证据）。
//   只有在既有账本缺某卡证据时才补跑 tests/tsk-player-m2-{1..4}.test.mjs 取证。
//
// 状态词表（优先级从高到低，全部可复算）：
//   scenario-reference ：10 张剧本参考卡（type='scenario'，即十章 referenceCode）。由章 verified +
//                        guide 覆盖，不要求逐卡测试；证据 = audit/tsk-scenario-acceptance.json 章记录 +
//                        章测试文件级通过。
//   missing            ：无条目文件 / 条目未实现 / 无行为键 / 无任何测试证据（reason 精确定位）。
//   scenario-data      ：数据型条目（条目 abilities:[] 且 note 以 `approximation:` 开头并声明
//                        「P7 数据型条目」）。地点/幕/议程/剧情资产/密钥的印刷数据由章 definition 承接，
//                        证据 = 所属章账本 verified + 章测试文件级通过；逐卡字面动作/显现留 P8 说明。
//   simplified         ：有行为条目 + 有测试证据，但条目 note/simplified **公开披露近似**
//                        （`simplified:true` 或 note 以 `approximation:` / `近似：` 开头）。
//                        披露原文逐条保留在 cards[].disclosures，不因 gate 变绿改成 verified。
//   verified           ：条目 implemented + 有测试证据（标题或文件级）+ 无近似披露。
//   blocked            ：本账本恒为 0（P8 没有阻塞级原语缺口；近似走 simplified 披露）。
//
// gate 口径：summary.gateComplete = missing===0 且 total===439（verified + simplified + scenario-data +
// scenario-reference 都算通过）；summary.strictComplete = verified + scenario-reference === total，
// 即「不含任何近似/数据型兜底」的最严口径，P8 预期为 false（近似披露数见 summary.simplified）。
//
// 生成物确定性：不写时间戳 / 耗时 / 本地绝对路径；只写仓库相对路径、条目 sha256 与实跑计数，
// 因此两次构建逐字节一致，--check 可检出「测试、条目、既有账本、scope」的任何漂移。
//
// 退出码：0 = gate 完整（missing=0 且 total=439）、证据测试全绿且 --check 逐字节一致；
//         1 = 账本一致但仍有 missing（或证据测试有失败，逐条见 snapshot.failedEvidence）；
//         2 = --check 漂移、账本缺失、测试零事件或输入契约被破坏。

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const TOOL = 'tools/audit-tsk-all-cards.mjs'
const LEDGER = 'audit/tsk-all-card-acceptance.json'
const TEST_FILE = 'tests/tsk-all-cards.test.mjs'
const REPORT = 'artifacts/migration/tsk/reports/p8-all-cards-report.md'
const GAME = 'games/arkhamhorror'
const CAMPAIGN_ID = 'theScarletKeys'
const EXPECTED = { total: 439, campaign: 311, investigators: 20, player: 108,
  scenarioReference: 10, scenarioEntries: 301 }

const MOD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(MOD, '../..')
const TESTS_DIR = path.join(MOD, 'tests')

const sha256 = value => createHash('sha256').update(value).digest('hex')
const toPosix = value => String(value).replaceAll('\\', '/')
const repoRel = absolute => toPosix(path.relative(ROOT, absolute))
const readText = relative => fs.readFileSync(path.join(MOD, relative), 'utf8')
const fileSha = relative => sha256(fs.readFileSync(path.join(MOD, relative)))
const readJson = relative => JSON.parse(readText(relative))
const sorted = list => [...list].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
const escapedCode = code => code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// 卡号词边界：09544 不匹配 09544a/095440，09544a 只匹配自身。证据判定与测试共用同一构造。
const codePattern = code => new RegExp(`(?:^|[^0-9A-Za-z])${escapedCode(code)}(?![0-9A-Za-z])`)
const CODE_TOKEN = /(?:^|[^0-9A-Za-z])(\d{5}[a-z]?)(?![0-9A-Za-z])/g
const tokensOf = text => new Set([...text.matchAll(CODE_TOKEN)].map(match => match[1]))

export const ALL_CARDS_LEDGER_PATH = LEDGER
export const ALL_CARDS_REPORT_PATH = REPORT
export const ALL_CARDS_TEST_PATH = TEST_FILE
export const ALL_CARDS_TOOL_PATH = TOOL

// ---------------------------------------------------------------------------
// 条目行为键：与 TIC 同一张表，另加 TSK 实际用到的 flags / enemyScript / shiftRule
// （flags 是「声明即接线」的读点：章 behavior 读 flags 结算，属于实际行为通道）。
// ---------------------------------------------------------------------------
const BEHAVIOR_KEYS = ['abilities', 'modifiers', 'actRule', 'agendaRule', 'actRuleByScenario', 'agendaRuleByScenario',
  'locationRule', 'treacheryRule', 'enemyRule', 'scenarioRule', 'assetRule', 'interactionRule', 'investigatorRule',
  'locationBarrier', 'effect', 'encounterResolve', 'surrender', 'onReveal', 'resolve', 'enemyScript', 'shiftRule',
  'flags']
// 玩家卡 / 调查员卡另有的描述子通道（调查员旧印、构筑限制、定制面板、可打出弱点…），
// 只用于 entryFlags 的信息量，不参与战役数据型条目判定。
const PLAYER_ENTRY_KEYS = [...BEHAVIOR_KEYS, 'investigator', 'elderSign', 'playCondition', 'playableWeakness',
  'customizationOptions', 'customizationEffects', 'playCostModifier']
const behaviorKeysOf = (entry, keys = BEHAVIOR_KEYS) => {
  if (!entry || typeof entry !== 'object') return []
  return keys.filter(key => {
    const value = entry[key]
    if (value == null) return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object') return Object.keys(value).length > 0
    return true
  })
}
const abilityCountOf = entry => (Array.isArray(entry?.abilities) ? entry.abilities.length : null)
// 近似披露：显式 simplified:true，或 note 以 approximation: / 近似： 开头。二者都原文保留。
const disclosureOf = entry => {
  if (entry?.simplified === true) return 'entry-simplified-flag'
  const note = String(entry?.note || '')
  if (/^(approximation|近似)\s*[:：]/.test(note)) return 'entry-note'
  return null
}
const dataNoteOf = entry => {
  const note = String(entry?.note || '')
  return /^approximation:/.test(note) && note.includes('数据型')
}

function walkRelativeFiles(relativeDir) {
  const found = []
  const walk = dir => {
    const names = fs.readdirSync(path.join(MOD, dir), { withFileTypes: true })
      .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    for (const entry of names) {
      const child = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(child)
      else if (entry.name.endsWith('.js')) found.push(child)
    }
  }
  walk(relativeDir)
  return found
}

// 证据测试文件集：十章场景测试 + 共享遭遇组 A/B + 战役流程 + 幕间 + 调查员逐人验收。
// 玩家 4 个 M2 分片默认不跑：既有账本已有逐卡标题证据；只有缺证据时才补跑。
// tests/tsk-p8-campaign.test.mjs（另一 worker 并行编写的战役 E2E）**不进逐卡证据集**：
// 它不提供逐卡证据，且由 tools/audit-tsk-migration.mjs 的 campaignE2E 门禁单独实跑；
// 本账本只登记它是否存在（adjacentTestFiles），避免并行编写造成账本逐字节漂移。
function evidenceTestFiles(scope, playerLedger) {
  const files = []
  const pending = []
  const push = file => {
    if (fs.existsSync(path.join(MOD, file))) files.push(file)
    else pending.push({ file, present: false, note: '证据测试文件缺失；账本按 pending 记录，不据此判任何卡通过。' })
  }
  for (const chapter of scope.chapters) push(`tests/tsk-scenario-${chapter.id}.test.mjs`)
  push('tests/tsk-shared-encounters-a.test.mjs')
  push('tests/tsk-shared-encounters-b.test.mjs')
  push('tests/tsk-campaign-flow.test.mjs')
  push('tests/tsk-interludes.test.mjs')
  for (const name of sorted(fs.readdirSync(TESTS_DIR).filter(name => /^tsk-investigator-.*\.test\.mjs$/.test(name)))) {
    files.push(`tests/${name}`)
  }
  const adjacentFile = 'tests/tsk-p8-campaign.test.mjs'
  const adjacent = [{
    file: adjacentFile,
    present: fs.existsSync(path.join(MOD, adjacentFile)),
    countedAsEvidence: false,
    note: '另一 worker 的 P8 战役 E2E；不提供逐卡证据，由 tools/audit-tsk-migration.mjs 的 campaignE2E 门禁单独实跑。',
  }]
  const playerMissing = playerLedger.entries
    .filter(item => !(item.evidence || []).some(evidence => evidence?.test && codePattern(item.code).test(evidence.test)))
    .map(item => item.code)
  const shards = ['tests/tsk-player-m2-1.test.mjs', 'tests/tsk-player-m2-2.test.mjs',
    'tests/tsk-player-m2-3.test.mjs', 'tests/tsk-player-m2-4.test.mjs']
  if (playerMissing.length) files.push(...shards.filter(file => fs.existsSync(path.join(MOD, file))))
  return { files, pending, adjacent, playerMissing, shardsRun: playerMissing.length > 0, shards }
}

function runEvidenceTests(files) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tsk-all-cards-audit-'))
  const env = { ...process.env, DSH_HOME: home }
  // 从 node --test 内部再 spawn node --test 时，继承的 NODE_TEST_CONTEXT 会让子进程走测试子进程模式，
  // 不输出完整事件流；删除后所有文件在同一个普通子进程里跑，结果与直接执行一致。
  delete env.NODE_TEST_CONTEXT
  const run = spawnSync(process.execPath, [
    '--test',
    `--test-reporter=./${GAME}/tools/core-test-reporter.mjs`,
    ...files.map(file => `${GAME}/${file}`),
  ], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  fs.rmSync(home, { recursive: true, force: true })
  const events = (run.stdout || '').split('\n')
    .filter(line => line.trim().startsWith('{'))
    .flatMap(line => { try { return [JSON.parse(line)] } catch { return [] } })
  if (!events.length) {
    const tail = (run.stderr || '').slice(-2000)
    throw new Error(`证据测试没有产出 test:pass/test:fail 事件（spawnExit=${run.status}）：${tail}`)
  }
  return { events, spawnExit: run.status, stderrTail: (run.stderr || '').slice(-2000) }
}

function evidenceIndex(events, campaignCodes) {
  const eventFile = event => {
    if (!event.file) return null
    const absolute = path.isAbsolute(event.file) ? event.file : path.resolve(ROOT, event.file)
    return repoRel(absolute)
  }
  const passing = events.filter(event => event.type === 'test:pass' && !event.skipped && !event.todo)
  const failing = events.filter(event => event.type === 'test:fail')
  const perFile = new Map()
  for (const event of events) {
    const file = eventFile(event)
    if (!file) continue
    const row = perFile.get(file) || { pass: 0, fail: 0 }
    if (event.type === 'test:pass' && !event.skipped && !event.todo) row.pass += 1
    if (event.type === 'test:fail') row.fail += 1
    perFile.set(file, row)
  }
  // ① 强证据：通过用例标题命中卡号。
  const titleEvidenceByCode = new Map()
  const failedEvidenceByCode = new Map()
  for (const event of passing) {
    const title = String(event.name || '')
    if (!title) continue
    for (const code of campaignCodes) {
      if (!codePattern(code).test(title)) continue
      titleEvidenceByCode.set(code, [...(titleEvidenceByCode.get(code) || []),
        { file: eventFile(event), line: Number.isInteger(event.line) ? event.line : null, test: title, titleMatched: true }])
    }
  }
  for (const event of failing) {
    const title = String(event.name || '')
    if (!title) continue
    for (const code of campaignCodes) {
      if (!codePattern(code).test(title)) continue
      failedEvidenceByCode.set(code, [...(failedEvidenceByCode.get(code) || []),
        { file: eventFile(event), line: Number.isInteger(event.line) ? event.line : null, test: title }])
    }
  }
  // ② 文件级证据：该测试文件实跑有通过用例，且全文出现该卡号 token。
  const passingByFile = new Map()
  const sampleTestByFile = new Map()
  for (const event of passing) {
    const file = eventFile(event)
    if (!file) continue
    passingByFile.set(file, (passingByFile.get(file) || 0) + 1)
    const title = String(event.name || '')
    if (title && (!sampleTestByFile.has(file) || title < sampleTestByFile.get(file))) sampleTestByFile.set(file, title)
  }
  const tokensByFile = new Map()
  for (const file of passingByFile.keys()) {
    const absolute = path.join(ROOT, file)
    if (!fs.existsSync(absolute)) continue
    tokensByFile.set(file, tokensOf(fs.readFileSync(absolute, 'utf8')))
  }
  const fileEvidenceByCode = new Map()
  for (const [file, tokens] of tokensByFile) {
    for (const code of campaignCodes) {
      if (!tokens.has(code)) continue
      fileEvidenceByCode.set(code, [...(fileEvidenceByCode.get(code) || []), {
        file,
        titleMatched: false,
        passingTests: passingByFile.get(file) || 0,
        sampleTest: sampleTestByFile.get(file) || null,
      }])
    }
  }
  const sortEvidence = list => [...new Map(list.map(item => [
    `${item.file}\u0000${item.test || ''}\u0000${item.line ?? ''}`, item,
  ])).values()].sort((left, right) =>
    `${left.file}\u0000${left.test || ''}\u0000${left.line ?? ''}`
      .localeCompare(`${right.file}\u0000${right.test || ''}\u0000${right.line ?? ''}`))
  return {
    passing, failing, perFile, passingByFile, sampleTestByFile,
    titleEvidence: code => sortEvidence(titleEvidenceByCode.get(code) || []),
    fileEvidence: code => sortEvidence(fileEvidenceByCode.get(code) || []),
    failedEvidence: code => sortEvidence(failedEvidenceByCode.get(code) || []),
  }
}

function chapterAttribution(scope) {
  // 章内卡（含 10 张参考卡）来自 scope.sets.chapterGroups（P0 扫描时按 chapterId 落盘）。
  const chapterByCode = new Map()
  for (const group of scope.sets.chapterGroups) {
    for (const code of group.codes) chapterByCode.set(code, group.chapterId)
  }
  // 共享遭遇组：scope 不记单章归属，用各章 gatherSets 的参考 set 名反查组 id，
  // 再展开成卡号（redCoterie / globetrotting 这类战役级组不在任何章的 gatherSets 里，保持空）。
  const normalize = value => toPosix(String(value)).replace(/_([a-z])/g, (_, lower) => lower.toUpperCase()).toLowerCase()
  const groupBySetName = new Map()
  for (const dependency of scope.externalDependencies) groupBySetName.set(normalize(dependency.set), dependency.group)
  const codesByGroup = new Map()
  for (const group of scope.sets.sharedGroups) {
    codesByGroup.set(group.group, group.codes)
    if (!groupBySetName.has(normalize(group.group))) groupBySetName.set(normalize(group.group), group.group)
  }
  const sharedGroupByCode = new Map()
  for (const group of scope.sets.sharedGroups) for (const code of group.codes) sharedGroupByCode.set(code, group.group)
  const chaptersBySharedCode = new Map()
  for (const chapter of scope.chapters) {
    for (const gathered of chapter.gatherSets || []) {
      const group = groupBySetName.get(normalize(gathered.set))
      if (!group) continue
      for (const code of codesByGroup.get(group) || []) {
        const list = chaptersBySharedCode.get(code) || []
        if (!list.includes(chapter.id)) list.push(chapter.id)
        chaptersBySharedCode.set(code, list)
      }
    }
  }
  for (const list of chaptersBySharedCode.values()) list.sort()
  return { chapterByCode, sharedGroupByCode, chaptersBySharedCode }
}

// ---------------------------------------------------------------------------
// 账本构建（纯函数式：同一输入两次构建逐字节一致；测试直接调用本函数复算）
// ---------------------------------------------------------------------------
export async function buildAllCardsLedger() {
  const scope = readJson('audit/tsk-scope.json')
  const scenarioLedger = readJson('audit/tsk-scenario-acceptance.json')
  const campaignPlan = readJson('audit/tsk-campaign-plan.json')
  const playerLedger = readJson('audit/tsk-player-acceptance.json')
  const investigatorLedger = readJson('audit/tsk-investigators.json')

  const scopeCards = new Map(scope.cards.map(card => [card.code, card]))
  const partitions = {
    tskCampaign: sorted(scope.partitions.tskCampaign),
    tskInvestigators: sorted(scope.partitions.tskInvestigators),
    tskPlayer: sorted(scope.partitions.tskPlayer),
  }
  const partitionOf = new Map()
  for (const [partition, codes] of Object.entries(partitions)) for (const code of codes) {
    if (partitionOf.has(code)) throw new Error(`scope 分区重叠：${code} → ${partitionOf.get(code)} / ${partition}`)
    partitionOf.set(code, partition)
  }
  if (scope.cards.length !== EXPECTED.total) throw new Error(`scope 记录数异常：${scope.cards.length}`)
  if (partitions.tskCampaign.length !== EXPECTED.campaign) throw new Error(`战役分区异常：${partitions.tskCampaign.length}`)
  if (partitions.tskInvestigators.length !== EXPECTED.investigators) {
    throw new Error(`调查员分区异常：${partitions.tskInvestigators.length}`)
  }
  if (partitions.tskPlayer.length !== EXPECTED.player) throw new Error(`玩家分区异常：${partitions.tskPlayer.length}`)
  for (const card of scope.cards) {
    if (!partitionOf.has(card.code)) throw new Error(`scope 记录未落分区：${card.code}`)
  }
  if (scope.cards.length !== partitions.tskCampaign.length + partitions.tskInvestigators.length
    + partitions.tskPlayer.length) throw new Error('scope 分区与记录总数不守恒')

  // 章节：顺序与 scope.chapters 一致（order）。
  const chapters = [...scope.chapters].sort((left, right) => left.order - right.order)
  const scenarioRowById = new Map(scenarioLedger.chapters.map(row => [row.id, row]))
  const planNodeById = new Map(campaignPlan.nodes.filter(node => node.kind === 'chapter').map(node => [node.id, node]))
  if (scenarioLedger.chapters.length !== chapters.length) throw new Error('场景账本章节数与 scope 不一致')
  if (planNodeById.size !== chapters.length) throw new Error('战役计划章节数与 scope 不一致')

  const { chapterByCode, sharedGroupByCode, chaptersBySharedCode } = chapterAttribution(scope)

  // 条目文件索引（一卡一文件；同一卡号多文件即契约破坏）。
  const campaignEntryFiles = walkRelativeFiles('src/cards/encounter-entries/theScarletKeys')
  const campaignEntryByCode = new Map()
  for (const file of campaignEntryFiles) {
    const code = path.basename(file, '.js')
    if (campaignEntryByCode.has(code)) {
      throw new Error(`战役条目一卡多文件：${code} → ${campaignEntryByCode.get(code)} / ${file}`)
    }
    campaignEntryByCode.set(code, file)
  }
  if (campaignEntryFiles.length === 0) throw new Error('没有找到绯红密钥战役条目文件')
  for (const code of campaignEntryByCode.keys()) {
    if (partitionOf.get(code) !== 'tskCampaign') throw new Error(`战役条目越界：${code}`)
  }

  // 运行时注册表：实现判定与行为键只认引擎实际注册到的条目，不读源码字符串。
  const encounterModule = await import(pathToFileURL(path.join(MOD, 'src/cards/encounter-abilities.js')).href)
  const encounterEntries = new Map((encounterModule.NON_PLAYER_ABILITY_ENTRIES || []).map(entry => [entry.code, entry]))
  const playerModule = await import(pathToFileURL(path.join(MOD, 'src/cards/entries/index.js')).href)
  const playerEntries = playerModule.CARD_ENTRY_BY_CODE

  // 既有账本对账（玩家 108 / 调查员 6 + 14）。
  if (playerLedger.entries.length !== EXPECTED.player) throw new Error(`玩家账本条目数异常：${playerLedger.entries.length}`)
  if (playerLedger.summary?.verified !== EXPECTED.player) throw new Error('玩家账本 verified 不是 108')
  const playerByCode = new Map(playerLedger.entries.map(item => [item.code, item]))
  for (const code of partitions.tskPlayer) {
    if (!playerByCode.has(code)) throw new Error(`玩家账本缺少分区卡：${code}`)
  }
  for (const code of playerByCode.keys()) {
    if (!partitions.tskPlayer.includes(code)) throw new Error(`玩家账本越界卡号：${code}`)
  }
  const investigatorCodes = []
  const signatureOwner = new Map()
  const signatureByCode = new Map()
  for (const item of investigatorLedger.items) {
    investigatorCodes.push(item.code)
    for (const signature of item.signatures || []) {
      if (signatureByCode.has(signature.code)) throw new Error(`调查员依赖重复：${signature.code}`)
      signatureByCode.set(signature.code, signature)
      signatureOwner.set(signature.code, item.code)
      investigatorCodes.push(signature.code)
    }
  }
  if (investigatorCodes.length !== EXPECTED.investigators) {
    throw new Error(`调查员记录数异常：${investigatorCodes.length}`)
  }
  const investigatorByCode = new Map(investigatorLedger.items.map(item => [item.code, item]))
  for (const code of investigatorCodes) {
    if (!partitions.tskInvestigators.includes(code)) throw new Error(`调查员账本越界卡号：${code}`)
  }
  for (const code of partitions.tskInvestigators) {
    if (!investigatorCodes.includes(code)) throw new Error(`调查员分区缺少账本记录：${code}`)
  }

  // 剧本参考卡：必须是十章 referenceCode，且恰好 10 张 type='scenario'。
  const referenceCodes = sorted(chapters.map(chapter => chapter.referenceCode))
  if (referenceCodes.length !== EXPECTED.scenarioReference) throw new Error('剧本参考卡不是 10 张')
  for (const code of referenceCodes) {
    const card = scopeCards.get(code)
    if (!card) throw new Error(`剧本参考卡不在 scope：${code}`)
    if (card.type !== 'scenario') throw new Error(`剧本参考卡 type 异常：${code} → ${card.type}`)
    if (chapterByCode.get(code) !== chapters.find(chapter => chapter.referenceCode === code).id) {
      throw new Error(`剧本参考卡章节归属异常：${code}`)
    }
  }
  const scenarioTypeCodes = sorted(scope.cards.filter(card => card.type === 'scenario').map(card => card.code))
  if (JSON.stringify(scenarioTypeCodes) !== JSON.stringify(referenceCodes)) {
    throw new Error(`type='scenario' 记录与十章参考卡不一致：${scenarioTypeCodes.join(',')}`)
  }

  // 章节测试文件与通过计数（文件级证据 + 章账本 verified）。
  const testPlan = evidenceTestFiles(scope, playerLedger)
  const run = runEvidenceTests(testPlan.files)
  const index = evidenceIndex(run.events, partitions.tskCampaign)
  const runFileRows = testPlan.files.map(file => {
    const repoFile = `${GAME}/${file}`
    const row = index.perFile.get(repoFile) || { pass: 0, fail: 0 }
    return {
      file,
      sha256: fileSha(file),
      passed: row.pass,
      failed: row.fail,
      spawnExit: run.spawnExit,
      sampleTest: index.sampleTestByFile.get(repoFile) || null,
    }
  })
  const filesWithoutEvents = runFileRows.filter(row => row.passed + row.failed === 0).map(row => row.file)
  if (filesWithoutEvents.length) throw new Error(`证据测试文件没有产出用例：${filesWithoutEvents.join(', ')}`)
  const chapterTestRow = new Map()
  for (const chapter of chapters) {
    const file = `tests/tsk-scenario-${chapter.id}.test.mjs`
    chapterTestRow.set(chapter.id, runFileRows.find(row => row.file === file)
      || { file, sha256: null, passed: 0, failed: 0, sampleTest: null })
  }
  const investigatorTestRow = new Map()
  for (const file of testPlan.files.filter(file => /tsk-investigator-.*\.test\.mjs$/.test(file))) {
    const row = runFileRows.find(candidate => candidate.file === file)
    investigatorTestRow.set(file, row)
  }

  // 玩家证据缺口：账本缺证据的卡在本次补跑的分片里找标题证据；找不到即 missing。
  const playerShardTitle = new Map()
  if (testPlan.shardsRun) {
    for (const event of index.passing) {
      const file = event.file || ''
      if (!/tsk-player-m2-/.test(file)) continue
      for (const code of testPlan.playerMissing) {
        if (!codePattern(code).test(String(event.name || ''))) continue
        playerShardTitle.set(code, [...(playerShardTitle.get(code) || []),
          { file, line: Number.isInteger(event.line) ? event.line : null, test: event.name, titleMatched: true }])
      }
    }
  }

  // -------------------------------------------------------------------------
  // 逐卡判定
  // -------------------------------------------------------------------------
  const rows = []
  const pushRow = row => rows.push(row)

  for (const code of partitions.tskCampaign) {
    const card = scopeCards.get(code)
    const chapterId = chapterByCode.get(code) || null
    const sharedGroup = sharedGroupByCode.get(code) || null
    const chapterIds = chapterId ? [chapterId] : [...(chaptersBySharedCode.get(code) || [])]
    const entryPath = campaignEntryByCode.get(code) || null
    const entry = encounterEntries.get(code) || null
    const entrySha = entryPath ? fileSha(entryPath) : null
    const implementedFlag = entry?.implemented === true ? 'explicit-true'
      : entry?.implemented === false ? 'explicit-false' : 'implicit'
    const implemented = entry ? entry.implemented !== false : false
    const behaviorKeys = behaviorKeysOf(entry)
    const isReference = referenceCodes.includes(code)
    const noteDisclosure = disclosureOf(entry)
    const dataType = Boolean(entry) && Array.isArray(entry.abilities) && entry.abilities.length === 0 && dataNoteOf(entry)
    // 数据型条目的近似是「印刷数据由章承接」，与行为卡的「行为近似」分开记账。
    const disclosure = dataType ? 'data-approximation' : noteDisclosure
    const note = entry?.note ? String(entry.note) : null
    const titleEvidence = index.titleEvidence(code)
    const fileEvidence = index.fileEvidence(code)
    const failedEvidence = index.failedEvidence(code)
    const testEvidence = [...titleEvidence.map(item => ({ source: 'test', level: 'title', ...item })),
      ...fileEvidence.map(item => ({ source: 'test', level: 'file', ...item }))]
    const chapterEvidence = () => {
      if (!chapterId) return null
      const scenarioRow = scenarioRowById.get(chapterId)
      const testRow = chapterTestRow.get(chapterId)
      return {
        source: 'chapter',
        chapterId,
        scenarioLedger: 'audit/tsk-scenario-acceptance.json',
        scenarioStatus: scenarioRow?.status || null,
        guide: scenarioRow?.guide?.path || null,
        guideKeyCount: scenarioRow?.guide?.guideKeyCount ?? null,
        testFile: testRow.file,
        testFilePassed: (testRow.passed || 0) > 0 && (testRow.failed || 0) === 0,
        passingTests: testRow.passed || 0,
      }
    }

    let status
    let reason = null
    let evidence = testEvidence
    let literalNote = null
    if (isReference) {
      const chapter = chapters.find(candidate => candidate.referenceCode === code)
      const evidenceRow = chapterEvidence()
      const chapterReady = evidenceRow?.scenarioStatus === 'verified' && evidenceRow.testFilePassed === true
      status = chapterReady ? 'scenario-reference' : 'missing'
      reason = chapterReady ? 'chapter-reference' : 'chapter-not-verified'
      evidence = [evidenceRow, ...testEvidence].filter(Boolean)
      literalNote = `剧本参考卡：逐卡字面 = 章 ${chapter.id} 的 definition/behavior 与 guide（章账本 verified），`
        + '不要求逐卡测试；逐卡动作/显现由该章场景测试覆盖。'
    } else if (!entryPath) {
      status = 'missing'
      reason = 'no-entry-file'
    } else if (!implemented) {
      status = 'missing'
      reason = 'entry-not-implemented'
    } else if (dataType) {
      if (!chapterId) throw new Error(`数据型条目缺少章节归属：${code}`)
      const evidenceRow = chapterEvidence()
      if (!evidenceRow) throw new Error(`数据型条目无法建立章证据：${code}`)
      const chapterReady = evidenceRow.scenarioStatus === 'verified' && evidenceRow.testFilePassed === true
      status = chapterReady ? 'scenario-data' : 'missing'
      reason = chapterReady ? 'chapter-data-approximation' : 'chapter-not-verified'
      evidence = [evidenceRow, ...testEvidence]
      literalNote = `逐卡字面留 P8：印刷数据由章 ${chapterId} 的 definition 与 behavior 承接`
        + `（章账本 verified、章测试文件级通过 ${evidenceRow.passingTests} 例）；逐卡动作/显现仍待字面化。`
    } else if (!behaviorKeys.length) {
      status = 'missing'
      reason = 'entry-no-behavior'
    } else if (!testEvidence.length) {
      status = 'missing'
      reason = failedEvidence.length ? 'test-failed' : 'no-test-evidence'
    } else if (noteDisclosure) {
      status = 'simplified'
      reason = 'disclosed-approximation'
    } else {
      status = 'verified'
    }
    const evidenceLevel = titleEvidence.length ? 'strong'
      : fileEvidence.length ? 'file-level'
        : status === 'scenario-reference' || status === 'scenario-data' ? 'chapter' : 'none'
    pushRow({
      code,
      name: card.nameZh || card.name,
      nameEn: card.name,
      type: card.type,
      subtype: card.subtype ?? null,
      pack: card.pack,
      campaignId: CAMPAIGN_ID,
      scenarioId: chapterId,
      ...(chapterIds.length ? { chapters: chapterIds } : {}),
      ...(sharedGroup ? { sharedGroup } : {}),
      partition: 'tskCampaign',
      entryPath,
      entrySha256: entrySha,
      entryFlags: {
        source: isReference ? 'scenario-definition' : 'encounter-entry',
        implemented: isReference ? null : implemented,
        implementedFlag: isReference ? 'reference-card' : implementedFlag,
        simplified: entry?.simplified === true,
        disclosure,
        dataType,
        behaviorKeys,
        abilities: abilityCountOf(entry),
      },
      note,
      ...((disclosure || dataType) && note ? { disclosures: [note] } : {}),
      ...(literalNote ? { literalNote } : {}),
      evidence,
      evidenceLevel,
      status,
      reason,
      ...(failedEvidence.length ? { failedEvidence } : {}),
    })
  }

  for (const code of partitions.tskPlayer) {
    const card = scopeCards.get(code)
    const item = playerByCode.get(code)
    const entryPath = `src/cards/entries/${code}.js`
    if (!fs.existsSync(path.join(MOD, entryPath))) throw new Error(`玩家条目文件缺失：${entryPath}`)
    const entrySha = fileSha(entryPath)
    const runtimeEntry = playerEntries?.get?.(code) || null
    const ledgerEvidence = (item.evidence || []).map(evidence => ({
      source: 'player-ledger',
      evidenceFile: 'audit/tsk-player-acceptance.json',
      file: `${GAME}/tests/${evidence.file}`,
      line: evidence.line ?? null,
      test: evidence.test,
      titleMatched: codePattern(code).test(String(evidence.test || '')),
    }))
    const supplement = playerShardTitle.get(code) || []
    const evidence = [...ledgerEvidence, ...supplement.map(row => ({
      source: 'test', level: 'title', ...row,
    }))]
    const disclosures = (item.simplification?.disclosures || []).map(entry => entry.detail).filter(Boolean)
    const ok = item.status === 'verified' && evidence.some(entry => entry.titleMatched !== false)
    pushRow({
      code,
      name: card.nameZh || card.name,
      nameEn: card.name,
      type: card.type,
      subtype: card.subtype ?? null,
      pack: card.pack,
      campaignId: CAMPAIGN_ID,
      scenarioId: null,
      partition: 'tskPlayer',
      entryPath,
      entrySha256: entrySha,
      entryFlags: {
        source: 'player-entry',
        implemented: true,
        implementedFlag: 'registered',
        simplified: item.simplified === true,
        disclosure: item.simplified === true ? 'p7-ledger-disclosure' : null,
        dataType: false,
        behaviorKeys: behaviorKeysOf(runtimeEntry, PLAYER_ENTRY_KEYS),
        abilities: abilityCountOf(runtimeEntry),
      },
      note: runtimeEntry?.note ? String(runtimeEntry.note) : null,
      ...(disclosures.length ? { disclosures } : {}),
      implementation: item.implementation ?? null,
      evidence,
      evidenceLevel: 'ledger',
      status: ok ? 'verified' : 'missing',
      reason: ok ? null : 'player-ledger-pending',
      ...(item.implementation && item.implementation !== entrySha ? { staleEvidence: true } : {}),
    })
  }

  for (const code of partitions.tskInvestigators) {
    const card = scopeCards.get(code)
    const item = investigatorByCode.get(code) || null
    const signature = signatureByCode.get(code) || null
    const owner = signature ? investigatorByCode.get(signatureOwner.get(code)) : item
    const entryPath = signature ? signature.file : item.file
    if (!entryPath || !fs.existsSync(path.join(MOD, entryPath))) throw new Error(`调查员条目文件缺失：${code}`)
    const entrySha = fileSha(entryPath)
    const expectedSha = signature ? signature.sha256 : item.sha256
    const testFile = `tests/tsk-investigator-${owner.code}.test.mjs`
    const testRow = investigatorTestRow.get(testFile) || null
    const ok = Boolean(owner && owner.status === 'verified')
    pushRow({
      code,
      name: card.nameZh || card.name,
      nameEn: card.name,
      type: card.type,
      subtype: card.subtype ?? null,
      pack: card.pack,
      campaignId: CAMPAIGN_ID,
      scenarioId: null,
      partition: 'tskInvestigators',
      entryPath,
      entrySha256: entrySha,
      entryFlags: {
        source: 'investigator-entry',
        implemented: signature ? signature.implemented === true : true,
        implementedFlag: signature
          ? (signature.implemented === true ? 'signature-registered' : 'signature-unimplemented')
          : 'registered',
        simplified: false,
        disclosure: null,
        dataType: false,
        behaviorKeys: behaviorKeysOf(playerEntries?.get?.(code) || null, PLAYER_ENTRY_KEYS),
        abilities: abilityCountOf(playerEntries?.get?.(code) || null),
        dependencyOnly: Boolean(signature),
        ...(signature ? { signatureOf: owner.code } : {}),
      },
      note: null,
      evidence: [{
        source: 'investigator-ledger',
        evidenceFile: 'audit/tsk-investigators.json',
        investigatorCode: owner.code,
        file: `${GAME}/${testFile}`,
        passingTests: testRow?.passed ?? null,
        titleMatched: false,
        scope: 'M1 逐人验收（文件级证据：whole-file 实跑通过）',
        ledgerEvidence: Array.isArray(owner.evidence) ? [...owner.evidence] : [],
        checks: owner.checks || null,
      }],
      evidenceLevel: 'file-level',
      status: ok ? 'verified' : 'missing',
      reason: ok ? null : 'investigator-ledger-pending',
      ...(expectedSha && expectedSha !== entrySha ? { staleEvidence: true } : {}),
    })
  }

  // -------------------------------------------------------------------------
  // 汇总
  // -------------------------------------------------------------------------
  if (rows.length !== EXPECTED.total) throw new Error(`账本条目数异常：${rows.length}`)
  if (new Set(rows.map(row => row.code)).size !== rows.length) throw new Error('账本存在重复卡号')
  const sortedRows = [...rows].sort((left, right) => left.code.localeCompare(right.code))
  for (const chapter of chapters) {
    const chapterRows = sortedRows.filter(row => row.scenarioId === chapter.id)
    if (!chapterRows.length) throw new Error(`章节没有逐卡记录：${chapter.id}`)
  }
  const countBy = predicate => sortedRows.filter(predicate).length
  const statuses = ['verified', 'simplified', 'scenario-data', 'scenario-reference', 'missing']
  const byStatus = Object.fromEntries(statuses.map(status => [status, countBy(row => row.status === status)]))
  const campaignRows = sortedRows.filter(row => row.partition === 'tskCampaign')
  const playerRows = sortedRows.filter(row => row.partition === 'tskPlayer')
  const investigatorRows = sortedRows.filter(row => row.partition === 'tskInvestigators')
  const campaignDataRows = campaignRows.filter(row => row.entryFlags.dataType)
  const campaignBehaviorRows = campaignRows.filter(row => !row.entryFlags.dataType
    && row.status !== 'scenario-reference')
  const missingRows = sortedRows.filter(row => row.status === 'missing')
  const evidenceCount = level => countBy(row => row.evidenceLevel === level)
  const summary = {
    total: sortedRows.length,
    verified: byStatus.verified,
    simplified: byStatus.simplified,
    scenarioData: byStatus['scenario-data'],
    scenarioReference: byStatus['scenario-reference'],
    missing: byStatus.missing,
    blocked: 0,
    gateComplete: byStatus.missing === 0 && sortedRows.length === EXPECTED.total,
    strictComplete: byStatus.verified + byStatus['scenario-reference'] === sortedRows.length,
    // 分区（= scope packs，和 = total）
    campaign: campaignRows.length,
    investigators: investigatorRows.length,
    player: playerRows.length,
    partitions: { tskCampaign: campaignRows.length, tskInvestigators: investigatorRows.length, tskPlayer: playerRows.length },
    // 战役细分
    campaignVerified: campaignRows.filter(row => row.status === 'verified').length,
    campaignSimplified: campaignRows.filter(row => row.status === 'simplified').length,
    campaignScenarioData: campaignDataRows.length,
    campaignScenarioReference: campaignRows.filter(row => row.status === 'scenario-reference').length,
    campaignBehaviorCards: campaignBehaviorRows.length,
    recordsWithEntry: campaignRows.filter(row => row.entryPath).length,
    chapterBoundCards: campaignRows.filter(row => row.scenarioId).length,
    sharedGroupCards: campaignRows.filter(row => row.sharedGroup).length,
    // 玩家 / 调查员
    playerVerified: playerRows.filter(row => row.status === 'verified').length,
    playerDisclosedApproximations: playerRows.filter(row => (row.disclosures || []).length > 0).length,
    investigatorVerified: investigatorRows.filter(row => row.status === 'verified').length,
    investigatorDependencyOnly: investigatorRows.filter(row => row.entryFlags.dependencyOnly).length,
    // 证据强度
    evidenceLevels: {
      strong: evidenceCount('strong'),
      fileLevel: evidenceCount('file-level'),
      ledger: evidenceCount('ledger'),
      chapter: evidenceCount('chapter'),
      none: evidenceCount('none'),
    },
    staleEntryHashes: countBy(row => row.staleEvidence === true),
    // 实跑快照
    testFiles: runFileRows.length,
    testsPassed: index.passing.length,
    testsFailed: index.failing.length,
    spawnExit: run.spawnExit,
    pendingTestFiles: testPlan.pending.map(row => row.file),
    adjacentTestFiles: testPlan.adjacent.map(row => row.file),
    playerShardRuns: testPlan.shardsRun ? testPlan.shards.length : 0,
    // 口径
    gatePolicy: 'gateComplete = missing===0 且 total===439；verified/simplified/scenario-data/scenario-reference 均算通过（近似只披露、不改写为 verified）。',
    strictPolicy: 'strictComplete = verified + scenario-reference === total（不含任何近似披露与数据型兜底），P8 预期 false。',
  }
  if (summary.campaign + summary.investigators + summary.player !== summary.total) {
    throw new Error('包分区不守恒')
  }
  if (summary.verified + summary.simplified + summary.scenarioData + summary.scenarioReference
    + summary.missing !== summary.total) throw new Error('状态分区不守恒')
  if (summary.campaignScenarioData !== campaignDataRows.length) throw new Error('scenario-data 计数不一致')
  if (summary.scenarioData !== campaignDataRows.length) throw new Error('scenario-data 总数不一致')

  const byChapter = chapters.map(chapter => {
    const chapterRows = sortedRows.filter(row => row.scenarioId === chapter.id)
    // 共享遭遇组卡 scenarioId=null，但 chapters[] 记录了「哪几章会用到它」，这里单独计数（与 cards 不重复）。
    const sharedRows = sortedRows.filter(row => row.sharedGroup && (row.chapters || []).includes(chapter.id))
    const scenarioRow = scenarioRowById.get(chapter.id)
    const testRow = chapterTestRow.get(chapter.id)
    return {
      id: chapter.id,
      name: chapter.name,
      nameEn: chapter.nameEn,
      referenceCode: chapter.referenceCode,
      cards: chapterRows.length,
      verified: chapterRows.filter(row => row.status === 'verified').length,
      simplified: chapterRows.filter(row => row.status === 'simplified').length,
      scenarioData: chapterRows.filter(row => row.status === 'scenario-data').length,
      scenarioReference: chapterRows.filter(row => row.status === 'scenario-reference').length,
      missing: chapterRows.filter(row => row.status === 'missing').length,
      sharedChapterCards: sharedRows.length,
      scenarioLedgerStatus: scenarioRow?.status || null,
      guide: scenarioRow?.guide?.path || null,
      testFile: testRow.file,
      testFilePassingTests: testRow.passed || 0,
    }
  })

  const inputFiles = [
    'audit/tsk-scope.json',
    'audit/tsk-scenario-acceptance.json',
    'audit/tsk-player-acceptance.json',
    'audit/tsk-investigators.json',
    'audit/tsk-campaign-plan.json',
  ]
  const snapshot = {
    inputs: inputFiles.map(file => ({ file, sha256: fileSha(file) })),
    scope: {
      cards: scope.cards.length,
      partitions: { tskCampaign: partitions.tskCampaign.length, tskInvestigators: partitions.tskInvestigators.length,
        tskPlayer: partitions.tskPlayer.length },
      chapters: chapters.length,
      campaignEntryFiles: campaignEntryFiles.length,
      sharedGroups: scope.sets.sharedGroups.length,
    },
    testRun: {
      spawnExit: run.spawnExit,
      files: runFileRows.length,
      passed: index.passing.length,
      failed: index.failing.length,
      failedTitles: index.failing.map(event => ({
        file: event.file ? repoRel(path.isAbsolute(event.file) ? event.file : path.resolve(ROOT, event.file)) : null,
        test: event.name,
      })),
    },
    testFiles: runFileRows,
    pendingTestFiles: testPlan.pending,
    adjacentTestFiles: testPlan.adjacent,
    failedEvidence: [...new Map(sortedRows.flatMap(row => (row.failedEvidence || [])
      .map(evidence => [`${row.code}\u0000${evidence.file}\u0000${evidence.test}`, { code: row.code, ...evidence }])))
      .values()],
    notes: [
      '证据只来自实跑 node --test 的 test:pass 事件；卡号出现在源码/数据里不构成证据。',
      '玩家 108 与调查员 20 复用既有账本（audit/tsk-player-acceptance.json / audit/tsk-investigators.json）的 verified + evidence，不重复实跑。',
      'tests/tsk-p8-campaign.test.mjs 是另一 worker 的战役 E2E，不提供逐卡证据且并行编写未定稿，故只登记存在性（adjacentTestFiles），不计入证据集。',
      ...(testPlan.pending.length ? testPlan.pending.map(row => `${row.file}：${row.note}`) : []),
    ],
  }

  const profile = {
    id: 'scarlet-keys-all-cards-p8-2026-11',
    cycle: 'tsk',
    campaignId: CAMPAIGN_ID,
    scope: `绯红密钥全部 ${EXPECTED.total} 条印刷记录：战役 ${EXPECTED.campaign}（${EXPECTED.scenarioEntries} 张有单卡条目 + `
      + `${EXPECTED.scenarioReference} 张剧本参考卡）/ 调查员及专属依赖 ${EXPECTED.investigators}（6 人 + 14 依赖）/ 玩家 ${EXPECTED.player}。`,
    evidencePolicy: '实跑证据两级：①通过用例标题命中卡号（strong，词边界匹配，09544a 不误命中 09544）；'
      + '②含该卡号的测试文件实跑有通过用例（file-level，token 扫描）。失败用例只进 failedEvidence，不算证据。',
    ledgerPolicy: '玩家 108 与调查员 20 复用既有验收账本（已有实跑证据与实现 sha），本工具只做分区对账与证据搬运；'
      + '战役 311 逐卡重新判定，不读源码字符串猜结论。',
    dataPolicy: '数据型条目 = 条目 abilities:[] 且 note 以 approximation: 开头并声明「P7 数据型条目」。'
      + '地点/幕/议程/剧情资产/密钥的印刷数据由章 definition 承接，证据 = 所属章 audit/tsk-scenario-acceptance.json '
      + 'verified + 章测试文件级通过；逐卡字面动作/显现仍记 literalNote 说明，不冒充 verified。',
    simplifiedPolicy: '近似披露 = 条目 simplified:true 或 note 以 approximation: / 近似： 开头；披露原文逐条保留在 '
      + 'cards[].disclosures（玩家侧的 P6/P7 披露随卡保留 disclosures 与 implementation sha）。不为了让 gate 变绿改写为 verified。',
    statusPolicy: "词表 ['verified','simplified','scenario-data','scenario-reference','missing']，blocked 恒为 0；"
      + 'tools/audit-tsk-migration.mjs 按这套词表复算 literalCardBehavior。',
    chapterPolicy: '章归属来自 audit/tsk-scope.json：章内卡 = sets.chapterGroups（chapterId + codes）；'
      + '共享遭遇组卡（66 张）不绑定单章，scenarioId=null 并记 sharedGroup；可由各章 gatherSets 反查的另记 chapters[]。',
    determinism: '账本不含时间戳/耗时/本地绝对路径；两次构建逐字节一致，--check 重算比对。',
    sources: [
      'audit/tsk-scope.json',
      'audit/tsk-scenario-acceptance.json',
      'audit/tsk-player-acceptance.json',
      'audit/tsk-investigators.json',
      'audit/tsk-campaign-plan.json',
      'src/cards/cards-data.js',
      'src/cards/encounter-abilities.js（NON_PLAYER_ABILITY_ENTRIES）',
      'src/cards/entries/index.js（CARD_ENTRY_BY_CODE）',
      'src/cards/encounter-entries/theScarletKeys/**/<code>.js',
      'tests/tsk-scenario-*.test.mjs、tests/tsk-shared-encounters-{a,b}.test.mjs、tests/tsk-campaign-flow.test.mjs、'
        + 'tests/tsk-interludes.test.mjs、tests/tsk-investigator-*.test.mjs（实跑，tools/core-test-reporter.mjs）',
      'tests/tsk-p8-campaign.test.mjs（另一 worker 的战役 E2E：不提供逐卡证据，仅登记存在性；由 P9 campaignE2E 门禁单独实跑）',
    ],
    testFile: TEST_FILE,
    exitCodes: { 0: 'gate 完整、证据测试全绿且 --check 一致', 1: '账本一致但仍有 missing 或证据测试失败',
      2: '--check 漂移/账本缺失/输入契约破坏' },
  }

  const remaining = [
    ...missingRows.map(row => `missing ${row.code}（${row.reason}）`),
    ...campaignRows.filter(row => row.status === 'simplified')
      .map(row => `simplified ${row.code}（公开披露近似：${(row.disclosures || [])[0]?.slice(0, 80) || '见条目 note'}）`),
    ...campaignRows.filter(row => row.status === 'scenario-data')
      .map(row => `scenario-data ${row.code}（逐卡字面待补：${row.literalNote}）`),
    ...testPlan.pending.map(row => `pending 测试文件：${row.file}（${row.note}）`),
  ]

  const ledger = {
    schemaVersion: 1,
    cycle: 'tsk',
    campaignId: CAMPAIGN_ID,
    generatedBy: TOOL,
    profile,
    summary,
    chapters: byChapter,
    snapshot,
    cards: sortedRows,
    missing: missingRows.map(row => ({ code: row.code, partition: row.partition, type: row.type, reason: row.reason })),
    remaining,
  }
  const json = `${JSON.stringify(ledger, null, 2)}\n`
  return { ledger, summary, json, profile, byChapter, snapshot }
}

// ---------------------------------------------------------------------------
// 报告（与账本同源，确定性；--write 重写，--check 只在漂移时提示）
// ---------------------------------------------------------------------------
export function renderReport(built) {
  const { ledger, summary, byChapter } = built
  const campaignRows = ledger.cards.filter(row => row.partition === 'tskCampaign')
  const byReason = new Map()
  for (const row of ledger.cards.filter(card => card.status === 'missing')) {
    byReason.set(row.reason, [...(byReason.get(row.reason) || []), row.code])
  }
  const lines = []
  lines.push('# 绯红密钥（The Scarlet Keys）P8 逐卡验收报告')
  lines.push('')
  lines.push(`生成器：\`${TOOL} --write\` · 账本：\`${LEDGER}\` · 守卫：\`${TEST_FILE}\``)
  lines.push('')
  lines.push(`账本 sha256：\`${sha256(built.json)}\` · ${Buffer.byteLength(built.json, 'utf8')} 字节 · ${ledger.cards.length} 行（本报告与账本同源，勿手改）`)
  lines.push('')
  lines.push('> 本报告由工具按账本复算生成，勿手改；数字与 `audit/tsk-all-card-acceptance.json` 同源。')
  lines.push('')
  lines.push('## 1. 口径')
  lines.push('')
  lines.push('- 证据只来自**实跑** `node --test`（`tools/core-test-reporter.mjs` 读 `test:pass` / `test:fail`）：'
    + '①通过用例**标题**命中卡号（词边界，`09544a` 不误命中 `09544`）= strong；'
    + '②含该卡号的测试文件实跑有通过用例 = file-level。失败用例只记 `failedEvidence`，不算证据。')
  lines.push('- 玩家 108 / 调查员 20 复用既有账本（`audit/tsk-player-acceptance.json`、`audit/tsk-investigators.json`）的 '
    + '`verified` + `evidence` + 实现 sha，不重复实跑；战役 311 逐卡重新判定。')
  lines.push('- 状态词表：`verified` / `simplified`（条目公开披露近似）/ `scenario-data`（数据型条目，行为由章 definition 承接）/ '
    + '`scenario-reference`（10 张剧本参考卡）/ `missing`。`blocked` 恒为 0。')
  lines.push('- gate：`gateComplete = missing===0 且 total===439`；`strictComplete = verified + scenario-reference === total`，'
    + `P8 预期 false（当前 ${summary.strictComplete}）。近似只披露，不改写成 verified。`)
  lines.push('')
  lines.push('## 2. 统计')
  lines.push('')
  lines.push('| 口径 | 数量 |')
  lines.push('| --- | --- |')
  lines.push(`| 记录总数 | ${summary.total} |`)
  lines.push(`| verified | ${summary.verified} |`)
  lines.push(`| simplified（公开披露近似） | ${summary.simplified} |`)
  lines.push(`| scenario-data（数据型条目） | ${summary.scenarioData} |`)
  lines.push(`| scenario-reference（剧本参考卡） | ${summary.scenarioReference} |`)
  lines.push(`| missing | ${summary.missing} |`)
  lines.push(`| blocked | ${summary.blocked} |`)
  lines.push(`| gateComplete | ${summary.gateComplete} |`)
  lines.push(`| strictComplete | ${summary.strictComplete} |`)
  lines.push('')
  lines.push('分区：战役 `' + summary.campaign + '`（`verified ' + summary.campaignVerified + '` / `simplified '
    + summary.campaignSimplified + '` / `scenario-data ' + summary.campaignScenarioData + '` / `scenario-reference '
    + summary.campaignScenarioReference + '`）· 调查员 `' + summary.investigators + '`（含 14 依赖）· 玩家 `' + summary.player + '`。')
  lines.push('')
  lines.push(`证据强度：strong ${summary.evidenceLevels.strong} / file-level ${summary.evidenceLevels.fileLevel} / `
    + `ledger ${summary.evidenceLevels.ledger} / chapter ${summary.evidenceLevels.chapter} / none ${summary.evidenceLevels.none}；`
    + `玩家侧另有 ${summary.playerDisclosedApproximations} 张随卡保留 P6/P7 披露（按既有账本口径记 verified）。`)
  lines.push('')
  lines.push('## 3. 每章')
  lines.push('')
  lines.push('| 章 | 卡数 | verified | simplified | scenario-data | reference | 共享组使用 | 章账本 | 章测试 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const chapter of byChapter) {
    lines.push(`| ${chapter.id} | ${chapter.cards} | ${chapter.verified} | ${chapter.simplified} | ${chapter.scenarioData} | `
      + `${chapter.scenarioReference} | ${chapter.sharedChapterCards} | ${chapter.scenarioLedgerStatus} | `
      + `${chapter.testFilePassingTests} 例通过 |`)
  }
  lines.push('')
  lines.push('## 4. missing 原因')
  lines.push('')
  if (!byReason.size) lines.push('- 无（`missing = 0`）。')
  for (const [reason, codes] of byReason) lines.push(`- \`${reason}\`：${codes.join('、')}`)
  lines.push('')
  lines.push('## 5. P8 剩余字面化清单')
  lines.push('')
  const simplifiedByChapter = byChapter.map(chapter => ({ id: chapter.id,
    codes: campaignRows.filter(row => row.scenarioId === chapter.id && row.status === 'simplified').map(row => row.code) }))
  const dataByChapter = byChapter.map(chapter => ({ id: chapter.id,
    codes: campaignRows.filter(row => row.scenarioId === chapter.id && row.status === 'scenario-data').map(row => row.code) }))
  lines.push(`1. **simplified ${summary.simplified} 张**（有行为条目 + 测试证据，但条目 note/simplified 公开披露近似）：逐条原文见 `
    + '`cards[].disclosures`，按章分布：')
  for (const group of simplifiedByChapter) {
    if (group.codes.length) lines.push(`   - ${group.id}：${group.codes.length} 张（${group.codes.join('、')}）`)
  }
  const sharedSimplified = campaignRows.filter(row => !row.scenarioId && row.status === 'simplified').map(row => row.code)
  if (sharedSimplified.length) {
    lines.push(`   - 共享遭遇组（scenarioId=null，共 ${summary.sharedGroupCards} 张，其中 simplified ${sharedSimplified.length} 张；`
      + `各章使用张数见 §3「共享组使用」列）：${sharedSimplified.join('、')}`)
  }
  lines.push(`2. **scenario-data ${summary.scenarioData} 张**（地点/幕/议程/剧情资产/密钥等数据型条目）：印刷数据由章 definition/behavior `
    + '承接、章账本 verified 且章测试文件级通过；**逐卡字面动作/显现仍待补**，逐卡说明见 `cards[].literalNote`。按章分布：')
  for (const group of dataByChapter) {
    if (group.codes.length) lines.push(`   - ${group.id}：${group.codes.length} 张`)
  }
  lines.push(`3. 收敛口径：simplified 与 scenario-data 都是**公开披露**，要变绿必须逐条关闭披露字段并换成语义等价的规则实现，`
    + '不能只改状态；玩家侧 61 张 P6/P7 披露同理。')
  lines.push('')
  lines.push('## 6. 实跑快照')
  lines.push('')
  lines.push(`- 证据测试文件 ${built.snapshot.testRun.files} 个，通过 ${built.snapshot.testRun.passed} 例，失败 ${built.snapshot.testRun.failed} 例，`
    + `spawnExit=${built.snapshot.testRun.spawnExit}。`)
  for (const row of built.snapshot.testFiles) {
    lines.push(`  - \`${row.file}\` · ${row.passed} 通过 / ${row.failed} 失败 · sha256 \`${row.sha256.slice(0, 16)}…\``)
  }
  if (built.snapshot.pendingTestFiles.length) {
    for (const row of built.snapshot.pendingTestFiles) lines.push(`- pending：\`${row.file}\` — ${row.note}`)
  }
  for (const row of built.snapshot.adjacentTestFiles) {
    lines.push(`- adjacent：\`${row.file}\`（present=${row.present}，**不计入逐卡证据**）— ${row.note}`)
  }
  if (built.snapshot.failedEvidence.length) {
    lines.push('- failedEvidence（不计入通过）：')
    for (const row of built.snapshot.failedEvidence) lines.push(`  - ${row.code}：${row.file} · ${row.test}`)
  }
  lines.push('')
  lines.push('## 7. 复现')
  lines.push('')
  lines.push('```bash')
  lines.push('cd games/arkhamhorror')
  lines.push(`node ${TOOL} --write     # 实跑证据集并写账本 + 本报告`)
  lines.push(`node ${TOOL} --check     # 复算并逐字节比对（0=gate 完整且一致 / 1=仍有 missing / 2=漂移）`)
  lines.push(`node --test ${TEST_FILE} # 守卫：两次构建深相等 + 与磁盘逐字节一致 + 抽样断言`)
  lines.push('```')
  lines.push('')
  return `${lines.join('\n')}\n`
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function usage() {
  console.log(`用法: node ${TOOL} [--write|--check]`)
  console.log('  --write  实跑证据集并写 audit/tsk-all-card-acceptance.json（+ 报告）')
  console.log('  --check  默认：复算并逐字节比对账本，输出统计（0=完整且一致 / 1=仍有 missing / 2=漂移）')
}

async function main(argv) {
  const args = argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) { usage(); return 0 }
  const unknown = args.filter(arg => !['--write', '--check'].includes(arg))
  if (unknown.length) {
    console.error(`未知参数: ${unknown.join(' ')}`)
    usage()
    return 2
  }
  if (args.includes('--write') && args.includes('--check')) {
    console.error('--write 与 --check 不能同时使用')
    return 2
  }
  const write = args.includes('--write')
  const built = await buildAllCardsLedger()
  const { summary, json } = built
  const printSummary = () => {
    console.log(JSON.stringify(summary))
    console.log(`\n逐卡：verified ${summary.verified} / simplified ${summary.simplified} / scenario-data ${summary.scenarioData}`
      + ` / scenario-reference ${summary.scenarioReference} / missing ${summary.missing} / blocked ${summary.blocked}`
      + `（total ${summary.total}）`)
    console.log(`gateComplete=${summary.gateComplete} · strictComplete=${summary.strictComplete}`
      + ` · 证据 strong ${summary.evidenceLevels.strong} / file-level ${summary.evidenceLevels.fileLevel}`
      + ` / ledger ${summary.evidenceLevels.ledger} / chapter ${summary.evidenceLevels.chapter}`)
    console.log(`实跑：${summary.testFiles} 个证据测试文件 / ${summary.testsPassed} 通过 / ${summary.testsFailed} 失败`
      + ` / spawnExit=${summary.spawnExit}`)
    if (summary.missing) {
      console.log(`\nmissing（前 20）：${built.ledger.missing.slice(0, 20).map(row => `${row.code}:${row.reason}`).join(', ')}`)
    }
    if (summary.pendingTestFiles.length) console.log(`pending 测试文件：${summary.pendingTestFiles.join(', ')}`)
    console.log(`\n${summary.gateComplete ? '✅ P8 逐卡账本完整（missing=0，439/439 有结论）'
      : '⏳ P8 逐卡账本仍有 missing 缺口'}`)
    if (summary.gateComplete && !summary.strictComplete) {
      console.log(`ℹ️ 最严口径仍有 ${summary.simplified} 张公开披露近似 + ${summary.scenarioData} 张数据型条目（逐条见账本 remaining）。`)
    }
  }
  if (!write) {
    const absolute = path.join(MOD, LEDGER)
    if (!fs.existsSync(absolute)) {
      console.error(`逐卡账本缺失：${LEDGER}（先跑 --write）`)
      return 2
    }
    const current = fs.readFileSync(absolute, 'utf8')
    if (current !== json) {
      console.error(`❌ 逐卡账本漂移：复算结果与磁盘 ${LEDGER} 不一致（测试覆盖、条目声明、既有账本或 scope 发生变化）。`)
      const currentLedger = (() => { try { return JSON.parse(current) } catch { return null } })()
      if (currentLedger?.summary) console.error(`磁盘 summary: ${JSON.stringify(currentLedger.summary).slice(0, 400)}`)
      console.error(`重算 summary: ${JSON.stringify(summary).slice(0, 400)}`)
      const before = new Map((currentLedger?.cards || []).map(card => [card.code, card.status]))
      const changed = built.ledger.cards.filter(card => before.has(card.code) && before.get(card.code) !== card.status)
      if (changed.length) {
        console.error(`状态变化：${changed.map(card => `${card.code}:${before.get(card.code)}→${card.status}`).join(', ')}`)
      }
      console.error('请确认变更后重跑：node tools/audit-tsk-all-cards.mjs --write')
      return 2
    }
    const reportAbsolute = path.join(MOD, REPORT)
    const report = renderReport(built)
    if (!fs.existsSync(reportAbsolute) || fs.readFileSync(reportAbsolute, 'utf8') !== report) {
      console.error(`ℹ️ 报告 ${REPORT} 与账本不同源（重跑 --write 刷新；不影响退出码）`)
    }
    printSummary()
    return summary.gateComplete && summary.testsFailed === 0 ? 0 : 1
  }
  fs.mkdirSync(path.dirname(path.join(MOD, LEDGER)), { recursive: true })
  fs.writeFileSync(path.join(MOD, LEDGER), json)
  fs.mkdirSync(path.dirname(path.join(MOD, REPORT)), { recursive: true })
  fs.writeFileSync(path.join(MOD, REPORT), renderReport(built))
  console.log(`已写入 ${LEDGER} 与 ${REPORT}`)
  printSummary()
  return 0
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null
if (invokedPath && invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const code = await main(process.argv)
    process.exit(code)
  } catch (error) {
    console.error(`❌ ${error?.stack || error?.message || error}`)
    process.exit(2)
  }
}
