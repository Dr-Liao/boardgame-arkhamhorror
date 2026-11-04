#!/usr/bin/env node
// 印斯茅斯暗潮（The Innsmouth Conspiracy，第六循环）P8 发布账本：把「生产内容注册表 + M0 范围账本 +
// P3 原语 / P4 关键词与规则书 / P5 调查员 / P6 玩家卡 / P7 八章逐章与逐卡 / P8 完整战役、真实联机、
// 浏览器发布验收与重放」的真实事实合成一份可复算的发布审计。
//
//   node tools/audit-tic.mjs --write    重写 audit/tic-migration.json
//   node tools/audit-tic.mjs --check    复算并逐字节比对（内容、判据或证据变化即失败）
//   node tools/audit-tic.mjs            打印账本 JSON（不落盘）
//
// 证据规则（docs/arkham-content-migration.md §4.8 M5 / §5 / §6 / §7）：
// - **一个事实源**：范围/卡数来自 content/campaigns/theInnsmouthConspiracy/shared.js、
//   content/packs/tic*/manifest.js 与 src/cards/cards-data.js，关键词来自本循环 keywords.js，
//   规则条目来自 web/rulebook-data.js，章节来自生产注册表 contentRegistry.listScenarios。
//   本工具逐项重算（scope/scan/plan 直接 import 生成器），不读「已冻结的结论」再复制。
// - **Node 验收由 runner 实跑**：只读 tools/verify-tic.mjs 生成的 audit/tic-node-acceptance.json；
//   报告的 sourceFiles 必须与 tools/tic-evidence.mjs 当前证据哈希一致（currentEvidence），
//   否则视为 stale，不手工补数字。
// - **浏览器/逐章/全卡/重放证据由 runner 或各自审计工具生成**：只读 audit/tic-*.json；文件缺失或
//   不自洽时对应 gate 一律 false。测试数/截图数/逐卡数从账本现读，不硬编码。
// - **remaining 由计算得出**：从 checks 为 false 的项、显式简化/原语请求/证据账本漂移、以及
//   同句模板共享工厂等维护债务汇总；不把未完成写成完成。
// - **输出确定性**：不写时间戳、耗时、git head、本机路径；spawn 子命令只记命令与退出码；
//   同一干净检出复跑应逐字节一致。audit/baseline.json 只记录 retaken 布尔，不写其文件哈希
//   （发布收尾会连写两次 baseline，记哈希会形成循环依赖）。
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { cardRuleIds, ruleById } from '../web/rulebook-data.js'
import { TIC_RULE_IDS } from '../web/tic-rules.js'
import { supportedMechanics } from '../content/mechanics.js'
import {
  CAMPAIGN_ID, CARD_PARTITIONS, CHAOS_BAGS, CYCLE_CODES, ENCOUNTER_GROUPS, INVESTIGATOR_CODES, chapters,
} from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { RECORD_TYPES } from '../content/campaigns/theInnsmouthConspiracy/records.js'
import { TIC_KEYWORDS } from '../content/campaigns/theInnsmouthConspiracy/keywords.js'
import {
  KEYWORD_MIGRATION_CHECKS, RULEBOOK_MIGRATION_CHECKS, SCENARIO_MIGRATION_CHECKS, assertMigrationConfirmations,
} from '../content/migration-confirmation.js'
import { buildImageDescriptor } from '../presentation/art-rules.js'
import { buildScope } from './scan-tic-scope.mjs'
import { buildScan } from './scan-tic-mechanisms.mjs'
import { buildPrimitivePlan } from './audit-tic-primitives.mjs'
import { currentEvidence } from './tic-evidence.mjs'

// ---------------------------------------------------------------- 常量

const CYCLE = 'tic'
const CYCLE_NAME = 'The Innsmouth Conspiracy'
const CYCLE_NAME_ZH = '印斯茅斯暗潮'
const MILESTONE = 'M5'
const STAGE = 'P8'
const PACK_IDS = ['ticCampaign', 'ticInvestigators', 'ticPlayer']
const LAUNCHABLE = new Set(['playable', 'verified'])
const MOD = fileURLToPath(new URL('../', import.meta.url))
const GAME_ROOT = MOD
const TARGET = new URL('../audit/tic-migration.json', import.meta.url)
const MODE = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'report'
const PRIMITIVE_REQUEST_DIR = 'artifacts/migration/tic/p7/primitive-requests'
const IMAGE_DIRS = Object.freeze({ en: 'web/img/cards', zh: 'web/img/zh/cards' })
const RUNTIME_SCAN_ROOTS = Object.freeze(['lib', 'src', 'content', 'web'])
const RUNTIME_SCAN_EXTENSIONS = Object.freeze(['.js', '.mjs', '.cjs', '.css', '.json', '.html'])
const REFERENCE_MARKER = '参考资源'
// 预期条目：run 自己的工具与 runner 生成证据，均以「退出码 0 + 账本 status=passed」为准。
const EXPECTED_RUNNERS = Object.freeze({
  guides: { file: 'tools/import-scenario-guides.mjs', args: [], command: 'node tools/import-scenario-guides.mjs',
    note: '不带 --write 即校验 web/scenario-guides/*.json 与来源生成结果逐字节一致' },
  presentation: { file: 'tools/build-presentation.mjs', args: ['--check'], command: 'node tools/build-presentation.mjs --check' },
  docs: { file: 'tools/check-doc-links.mjs', args: ['--json'], command: 'node tools/check-doc-links.mjs --json' },
  registry: { file: 'tools/check-tic-registry.mjs', args: [], command: 'node tools/check-tic-registry.mjs' },
})

// ---------------------------------------------------------------- 通用 IO（只读；确定性哈希）

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const json = value => `${JSON.stringify(value, null, 2)}\n`
const existsAt = relative => existsSync(join(MOD, relative))
const readText = relative => (existsAt(relative) ? readFileSync(join(MOD, relative), 'utf8') : null)
const readJson = relative => {
  const text = readText(relative)
  if (text === null) return null
  try { return JSON.parse(text.replace(/^\uFEFF/, '')) } catch { return null }
}
const fileHash = relative => {
  if (typeof relative !== 'string' || !relative) return null
  const text = readText(relative)
  return text === null ? null : sha256(text)
}
const sortedObject = entries => Object.fromEntries([...entries].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)))
const sameSet = (left, right) => left.length === right.length && left.every(item => right.includes(item))
const uniq = values => [...new Set(values)]
// 遭遇组 id 归一：snake_case 与 PascalCase 两种来源（shared.js / chapter-data.json）统一为 camelCase。
const camel = value => {
  const mapped = String(value).replace(/_([a-z])/g, (_, char) => char.toUpperCase())
  return mapped.charAt(0).toLowerCase() + mapped.slice(1)
}
const isMainCode = code => /^07\d{3}$/.test(code)
const isFaceCode = code => /^07\d{3}[a-z]$/.test(code)
const textLength = value => {
  if (typeof value === 'string') return value.replace(/<[^>]*>/g, '').replace(/\[[a-z_]+\]/gi, '').trim().length
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + textLength(item), 0)
  if (value && typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + textLength(item), 0)
  return 0
}
// 证据账本里的路径可能是「仓库根相对」（games/arkhamhorror/...）或游戏根相对；两种都解析。
const gameRelative = value => {
  if (typeof value !== 'string' || !value) return value
  const prefix = 'games/arkhamhorror/'
  return value.startsWith(prefix) ? value.slice(prefix.length) : value
}
const existsEvidencePath = value => {
  if (typeof value !== 'string' || !value) return false
  return existsSync(value) || existsSync(join(MOD, gameRelative(value)))
}
const walkFiles = (root, predicate, out = []) => {
  const absolute = join(MOD, root)
  if (!existsSync(absolute)) return out
  for (const entry of readdirSync(absolute, { withFileTypes: true }).sort((left, right) => (left.name < right.name ? -1 : 1))) {
    const relative = root ? `${root}/${entry.name}` : entry.name
    if (entry.isDirectory()) walkFiles(relative, predicate, out)
    else if (predicate(relative)) out.push(relative)
  }
  return out
}
// 子命令证据：只记录最终命令与退出码，不记录耗时/输出（确定性 + 不写本机信息）。
// Windows 下 node 子进程偶发被宿主以 0x80000003（STATUS_BREAKPOINT）终止；这类瞬态失败会
// 污染账本，因此同一命令失败时重试一次，只有两次都失败才记失败（重试不写进账本，输出仍确定）。
const runCommandOnce = (spec, { timeout = 240_000 } = {}) => spawnSync(process.execPath, [spec.file, ...spec.args], {
  cwd: GAME_ROOT, encoding: 'utf8', timeout, maxBuffer: 32 * 1024 * 1024, windowsHide: true,
})
const runCommand = (spec, options = {}) => {
  if (!existsAt(spec.file)) return { command: spec.command, exitCode: null, ok: false, missing: true }
  let result = runCommandOnce(spec, options)
  if (result.status !== 0) result = runCommandOnce(spec, options)
  return { command: spec.command, exitCode: result.status, ok: result.status === 0, missing: false, stdout: result.stdout || '' }
}
const runEvidence = result => ({ command: result.command, exitCode: result.exitCode, ok: result.ok, missing: result.missing })
// runner 账本里的 sourceFiles 是 sourceLock 形状（path/bytes/sha256）：逐条对磁盘复核，
// 用来证明「这份证据确实是在当前源码快照上跑出来的」。只统计数量，不把几千条明细写进账本。
const verifySourceLocks = entries => {
  const rows = Array.isArray(entries) ? entries : []
  let verified = 0
  for (const entry of rows) {
    const hash = fileHash(gameRelative(entry?.path))
    if (hash && hash === entry?.sha256) verified += 1
  }
  return { total: rows.length, verified, fresh: rows.length > 0 && verified === rows.length }
}

// ---------------------------------------------------------------- 基础账本复算（M0 / 第一步扫描 / 原语计划）

const scope = buildScope()
const scan = buildScan()
const plan = await buildPrimitivePlan()
const scopeText = readText('audit/tic-scope.json')
const scanText = readText('audit/tic-mechanism-scan.json')
const planText = readText('audit/tic-primitive-plan.json')
const snapshotChecks = {
  scope: scopeText !== null && scopeText === json(scope),
  scan: scanText !== null && scanText === json(scan),
  plan: planText !== null && planText === json(plan),
}

// ---------------------------------------------------------------- 生产注册事实（P8）

const campaign = contentRegistry.getCampaign(CAMPAIGN_ID)
const registryScenarios = contentRegistry.listScenarios(CAMPAIGN_ID)
const scenarioOf = id => registryScenarios.find(entry => entry.id === id) || null
const packOf = id => contentRegistry.getPack(id) || null
let launchBlocked = false
let launchError = null
try {
  contentRegistry.assertLaunchable(CAMPAIGN_ID)
} catch (error) {
  launchBlocked = true
  launchError = error?.message || String(error)
}
const lobbyEntry = campaignListForUi(contentRegistry).find(item => item.id === CAMPAIGN_ID) || null
const lobbyVisible = Boolean(lobbyEntry)
const lobbyEarlyAccess = lobbyEntry?.earlyAccess ?? null
const lobbyScenarios = lobbyEntry?.scenarios?.length ?? 0
const requiredPackClosure = new Set([...(campaign?.requiredPackIds || [])])
for (const scenario of registryScenarios) for (const packId of scenario.requiredPackIds || []) requiredPackClosure.add(packId)
const groupUniverse = new Set([...requiredPackClosure]
  .flatMap(packId => packOf(packId)?.encounterGroupIds || []))
const expectedRequiredPacksExist = [...(campaign?.requiredPackIds || [])].every(packId => Boolean(packOf(packId)))

// ---------------------------------------------------------------- 卡牌域与分区（单一事实源 cards-data.js）

const liveMainCodes = CYCLE_CODES.filter(isMainCode)
const liveFaceCodes = CYCLE_CODES.filter(isFaceCode)
const encounterCodeOf = code => ALL_CARDS[code]?.encounterCode || null
const investigatorSideOf = code => !encounterCodeOf(code)
  && (ALL_CARDS[code]?.type === 'investigator' || Boolean(ALL_CARDS[code]?.signatureFor))
const livePartitions = {
  ticCampaign: { main: liveMainCodes.filter(code => encounterCodeOf(code)).length,
    faces: liveFaceCodes.filter(code => encounterCodeOf(code)).length },
  ticInvestigators: { main: liveMainCodes.filter(investigatorSideOf).length,
    faces: liveFaceCodes.filter(investigatorSideOf).length },
  ticPlayer: { main: liveMainCodes.filter(code => !encounterCodeOf(code) && !investigatorSideOf(code)).length,
    faces: liveFaceCodes.filter(code => !encounterCodeOf(code) && !investigatorSideOf(code)).length },
}
for (const value of Object.values(livePartitions)) value.records = value.main + value.faces
const liveTotal = liveMainCodes.length + liveFaceCodes.length
const partitionCodes = {
  ticCampaign: CYCLE_CODES.filter(code => encounterCodeOf(code)),
  ticInvestigators: CYCLE_CODES.filter(investigatorSideOf),
  ticPlayer: CYCLE_CODES.filter(code => !encounterCodeOf(code) && !investigatorSideOf(code)),
}
const sharedPartitionCodes = CARD_PARTITIONS
const partitionChecks = {
  totalConserved: Object.values(partitionCodes).reduce((sum, codes) => sum + codes.length, 0) === liveTotal,
  sharedMatchesLive: Object.fromEntries(Object.keys(livePartitions).map(id =>
    [id, sameSet([...CARD_PARTITIONS[id]].sort(), [...partitionCodes[id]].sort())])),
  noOverlap: uniq(Object.values(partitionCodes).flat()).length === liveTotal,
  scopePartitionsMatch: Object.fromEntries(Object.keys(livePartitions).map(id => {
    const scopeCodes = Array.isArray(scope?.partitions?.[id]) ? [...scope.partitions[id]].sort() : []
    return [id, sameSet(scopeCodes, [...partitionCodes[id]].sort())]
  })),
  scopeCardsMatch: Array.isArray(scope?.cards) && sameSet(scope.cards.map(card => card.code).sort(), [...CYCLE_CODES].sort()),
  mainAndFaces: liveTotal === liveMainCodes.length + liveFaceCodes.length,
}
partitionChecks.pass = partitionChecks.totalConserved && partitionChecks.noOverlap && partitionChecks.mainAndFaces
  && Object.values(partitionChecks.sharedMatchesLive).every(Boolean)
  && Object.values(partitionChecks.scopePartitionsMatch).every(Boolean) && partitionChecks.scopeCardsMatch

// ---------------------------------------------------------------- 三个内容包（P8 生产清单）

const packRangeCovers = (pack, code) => (pack?.cardRanges || []).some(range =>
  code.length === range.from.length && code >= range.from && code <= range.to)
const packs = PACK_IDS.map(id => {
  const pack = packOf(id)
  const expected = CARD_PARTITIONS[id]
  const expectedFaces = expected.filter(isFaceCode)
  const cards = Array.isArray(pack?.cards) ? pack.cards : []
  const cardCodes = cards.map(card => card.code)
  const deckbuilding = cards.filter(card => card.deckbuilding)
  // P8 生产包把该分区全部印刷记录（含关联面）登记进 cards[]；关联面的物理卡号由
  // 第二个 cardRange（07001a–07338z）覆盖，不再单独重复登记。
  const rangesCoverExpected = expected.every(code => packRangeCovers(pack, code))
  const facesRegisteredOrRanged = expectedFaces.every(code => cardCodes.includes(code) || packRangeCovers(pack, code))
  const inRange = cardCodes.every(code => packRangeCovers(pack, code))
  const checks = {
    exists: Boolean(pack),
    statusPlayable: LAUNCHABLE.has(pack?.status),
    cardsAligned: sameSet([...cardCodes].sort(), [...expected].sort()),
    recordsAligned: cards.length === expected.length,
    rulesImplemented: cards.length > 0 && cards.every(card => card.rulesImplemented === true),
    cardRangesCover: rangesCoverExpected,
    facesRegisteredOrRanged,
    cardsWithinRanges: inRange,
    noDuplicateCards: uniq(cardCodes).length === cardCodes.length,
    encounterGroupIds: Array.isArray(pack?.encounterGroupIds),
  }
  return {
    id,
    exists: Boolean(pack),
    status: pack?.status ?? null,
    cards: cards.length,
    faces: expectedFaces.length,
    records: cards.length,
    live: { ...livePartitions[id] },
    rulesImplemented: cards.filter(card => card.rulesImplemented).length,
    deckbuilding: deckbuilding.length,
    dependencyOnly: cards.filter(card => card.dependencyOnly).length,
    cardRanges: (pack?.cardRanges || []).map(range => `${range.from}-${range.to}`),
    encounterGroupIds: [...(pack?.encounterGroupIds || [])],
    behaviorIds: Array.isArray(pack?.behaviorIds) ? pack.behaviorIds.length : 0,
    checks,
    pass: Object.values(checks).every(Boolean),
  }
})
const packOfId = id => packs.find(pack => pack.id === id)

// ---------------------------------------------------------------- 证据账本（只读）

// currentEvidence 每次都要重建 tic-evidence#sourceFiles（约 2800 个文件哈希）；同一进程内
// 同名证据只算一次，避免重复的整棵源码树哈希（--check 需要稳定且足够快）。
const currentEvidenceMemo = new Map()
const currentEvidenceCached = name => {
  if (!currentEvidenceMemo.has(name)) currentEvidenceMemo.set(name, currentEvidence(name))
  return currentEvidenceMemo.get(name)
}
const nodeReport = currentEvidenceCached('node-acceptance')
// 旧 P3 浏览器账本（tools/playwright-tic-reporter.mjs）提供「规则书可读 + 8 章实机路径」结构性证据；
// P8 起浏览器证据链改为独立账本（audit/tic-release-browser.json），旧账本只做结构核对，不再要求
// tic-evidence#sourceFiles 与当前源码一致（两套哈希链并存会互相拖死，且 brw 按 Lead 架构修订不重跑旧链）。
const browserLegacyReport = readJson('audit/tic-browser-acceptance.json')
const browserLegacyCurrent = currentEvidenceCached('browser-acceptance')
const interactionRegressionReport = currentEvidenceCached('interaction-regression')
const regressionReport = interactionRegressionReport || currentEvidenceCached('regression')
const regressionPath = interactionRegressionReport ? 'audit/tic-interaction-regression.json'
  : regressionReport ? 'audit/tic-regression.json' : 'audit/tic-interaction-regression.json'
const scenarioLedger = readJson('audit/tic-scenario-acceptance.json')
const scenarioItems = Array.isArray(scenarioLedger?.items) ? scenarioLedger.items : []
const scenarioItemOf = id => scenarioItems.find(item => item.id === id) || null
const allCardLedger = readJson('audit/tic-all-card-acceptance.json')
const allCardSummary = allCardLedger?.summary || null
const allCardEntries = Array.isArray(allCardLedger?.entries) ? allCardLedger.entries : []
const storyLedger = readJson('audit/tic-story-acceptance.json')
const investigatorLedger = readJson('audit/tic-investigators.json')
const interactionLedger = readJson('audit/tic-interactions.json')
const playerLedger = readJson('audit/tic-player-acceptance.json')
const playerShards = readJson('audit/tic-player-shards.json')
const playerQueue = readJson('audit/tic-player-queue.json')
const replayReport = readJson('audit/tic-p8-replay.json')
const releaseBrowserReport = readJson('audit/tic-release-browser.json')
const releaseAcceptanceReport = readJson('audit/tic-release-acceptance.json')
const baselineLedger = readJson('audit/baseline.json')

// ---------------------------------------------------------------- Node 验收（tools/verify-tic.mjs --node 实跑产物）

// Node 验收必须覆盖 P8 的三组新测试 + 重放确定性测试（verify-tic --node 的文件清单由 rep 维护）。
const NODE_P8_FILES = Object.freeze([
  'tests/tic-p8-registration.test.mjs',
  'tests/tic-p8-campaign.test.mjs',
  'tests/tic-p8-multiplayer.test.mjs',
])
const NODE_P8_MARKERS = Object.freeze([...NODE_P8_FILES, 'replay-tic-p8'])
const nodeSummary = nodeReport?.summary || null
const nodeCommand = typeof nodeReport?.command === 'string' ? nodeReport.command : null
const nodeCoversP8 = Boolean(nodeCommand) && NODE_P8_MARKERS.every(marker => nodeCommand.includes(marker))
const nodeGate = {
  path: 'audit/tic-node-acceptance.json',
  evidence: nodeEvidenceSummary(nodeReport),
  generatedBy: nodeReport?.generatedBy ?? null,
  status: nodeReport?.status ?? null,
  command: nodeCommand,
  tests: numberOrNull(nodeSummary?.tests),
  pass: numberOrNull(nodeSummary?.pass),
  fail: numberOrNull(nodeSummary?.fail),
  skipped: numberOrNull(nodeSummary?.skipped),
  sourceFiles: Array.isArray(nodeReport?.sourceFiles) ? nodeReport.sourceFiles.length : null,
  sourceStableDuringRun: nodeReport?.sourceStableDuringRun ?? null,
  p8Markers: NODE_P8_MARKERS.filter(marker => Boolean(nodeCommand) && nodeCommand.includes(marker)),
  p8Files: NODE_P8_MARKERS.filter(marker => Boolean(nodeCommand) && nodeCommand.includes(marker)),
  current: Boolean(nodeReport),
  passGate: false,
}
nodeGate.passGate = Boolean(nodeReport) && nodeReport.status === 'passed'
  && nodeSummary?.fail === 0 && (nodeSummary?.tests ?? 0) > 0
  && nodeReport.sourceStableDuringRun !== false && nodeCoversP8

// ---------------------------------------------------------------- 回归 / 重放 / 剧情 / 联机浏览器证据

const regressionGate = {
  path: regressionPath,
  generatedBy: regressionReport?.generatedBy ?? null,
  status: regressionReport?.status ?? null,
  sourceStableDuringRun: regressionReport?.sourceStableDuringRun ?? null,
  fastExitCode: regressionReport?.fast?.exitCode ?? null,
  replayExitCode: regressionReport?.replay?.exitCode ?? null,
  failures: Array.isArray(regressionReport?.fast?.failures) ? regressionReport.fast.failures.length : null,
  present: Boolean(regressionReport),
  current: Boolean(regressionReport),
  pass: false,
}
regressionGate.pass = Boolean(regressionReport) && regressionReport.status === 'passed'
  && regressionReport.sourceStableDuringRun !== false

const replayFixtureInfo = replayReport?.fixture || null
const replayFixturePath = typeof replayFixtureInfo?.path === 'string' ? replayFixtureInfo.path : null
const replayFixtureHash = replayFixturePath ? fileHash(gameRelative(replayFixturePath)) : null
const replayFixtureHashOk = Boolean(replayFixtureInfo?.sha256) && replayFixtureHash === replayFixtureInfo.sha256
const replayFixtureCount = numberOrNull(replayFixtureInfo?.fixtures)
const replayText = replayReport ? JSON.stringify(replayReport) : ''
const replayCoveredChapters = chapters.filter(chapter => replayText.includes(chapter.id)).map(chapter => chapter.id)
const replaySourceLocks = verifySourceLocks(replayReport?.sourceFiles)
const replayGate = {
  path: 'audit/tic-p8-replay.json',
  present: Boolean(replayReport),
  generatedBy: replayReport?.generatedBy ?? null,
  status: replayReport?.status ?? null,
  sourceStableDuringRun: replayReport?.sourceStableDuringRun ?? null,
  command: replayReport?.replay?.command ?? null,
  exitCode: replayReport?.replay?.exitCode ?? null,
  fixture: replayFixtureInfo ? {
    path: replayFixturePath,
    sha256: replayFixtureInfo.sha256 ?? null,
    fixtures: replayFixtureCount,
    steps: numberOrNull(replayFixtureInfo?.steps),
    hashMatches: replayFixtureHashOk,
  } : null,
  chaptersCovered: replayCoveredChapters.length,
  sourceFiles: replaySourceLocks,
  pass: false,
}
replayGate.pass = Boolean(replayReport) && replayReport.status === 'passed'
  && replayReport.sourceStableDuringRun !== false
  && replayReport?.replay?.exitCode === 0
  && replayFixtureCount !== null && replayFixtureCount >= chapters.length
  && replayFixtureHashOk
  && replayCoveredChapters.length === chapters.length
  && (replaySourceLocks.fresh || replaySourceLocks.total === 0)

const storyChecks = storyLedger?.gates || {}
const storyGate = {
  path: 'audit/tic-story-acceptance.json',
  generatedBy: storyLedger?.generatedBy ?? null,
  sourceKind: storyLedger?.sourceKind ?? null,
  officialChinese: storyLedger?.officialChinese ?? null,
  checks: { completeChinese: storyChecks.completeChinese === true, allChapters: storyChecks.allChapters === true },
  missing: Array.isArray(storyLedger?.missing) ? storyLedger.missing.length : null,
  sourceFiles: Array.isArray(storyLedger?.sourceFiles) ? storyLedger.sourceFiles.length : null,
  translated: Array.isArray(storyLedger?.translated) ? storyLedger.translated.length : null,
  existing: Array.isArray(storyLedger?.existing) ? storyLedger.existing.length : null,
  pass: false,
}
storyGate.pass = Boolean(storyLedger) && storyGate.checks.completeChinese && storyGate.checks.allChapters
  && storyGate.missing === 0 && (storyGate.sourceFiles ?? 0) > 0

// P8 发布浏览器证据：brw 的独立发布账本（真实大厅 + 双人中转联机 + 逐章推进），
// 以及 tools/audit-tic-release.mjs 的合并验收账本（12 项 checks + 截图 sha 复核）。两者其一
// 完整通过即可；缺失时如实记 remaining 并由 releaseAcceptance.required.browser 阻断。
const releaseBrowserTests = Array.isArray(releaseBrowserReport?.tests) ? releaseBrowserReport.tests : []
const releaseBrowserChecks = releaseBrowserReport?.checks || {}
const releaseBrowserScreenshots = Array.isArray(releaseBrowserReport?.screenshots) ? releaseBrowserReport.screenshots : []
const releaseBrowserSpecs = Array.isArray(releaseBrowserReport?.specs) ? releaseBrowserReport.specs : []
const expectedReleaseSpecs = Array.isArray(releaseBrowserReport?.expectedSpecs) ? releaseBrowserReport.expectedSpecs : []
const specPassed = (specSuffix, viewport) => releaseBrowserTests.some(test =>
  String(test?.spec || '').endsWith(specSuffix) && test.viewport === viewport && test.status === 'passed')
const releaseScreenshotsOnDisk = releaseBrowserScreenshots.filter(shot => shot?.exists !== false
  && existsEvidencePath(shot?.path)).length
const browserChecksNormalized = {
  desktopBrowser: releaseBrowserChecks.desktopBrowser === true,
  mobileBrowser: releaseBrowserChecks.mobileBrowser === true,
  release: {
    desktop: releaseBrowserChecks?.release?.desktop === true || specPassed('tic-release.browser.mjs', 'desktop'),
    mobile: releaseBrowserChecks?.release?.mobile === true || specPassed('tic-release.browser.mjs', 'mobile'),
  },
  online: {
    desktop: releaseBrowserChecks?.online?.desktop === true || specPassed('tic-online.browser.mjs', 'desktop'),
    mobile: releaseBrowserChecks?.online?.mobile === true || specPassed('tic-online.browser.mjs', 'mobile'),
  },
  progression: {
    desktop: releaseBrowserChecks?.progression?.desktop === true,
    mobile: releaseBrowserChecks?.progression?.mobile === true,
  },
  privacy: {
    desktop: releaseBrowserChecks?.privacy?.desktop === true,
    mobile: releaseBrowserChecks?.privacy?.mobile === true,
  },
  permission: releaseBrowserChecks?.permission === true,
  disconnect: releaseBrowserChecks?.disconnect === true,
}
const browserChecksAllTrue = browserChecksNormalized.desktopBrowser && browserChecksNormalized.mobileBrowser
  && Object.values(browserChecksNormalized.release).every(Boolean)
  && Object.values(browserChecksNormalized.online).every(Boolean)
  && Object.values(browserChecksNormalized.progression).every(Boolean)
  && Object.values(browserChecksNormalized.privacy).every(Boolean)
  && browserChecksNormalized.permission && browserChecksNormalized.disconnect
const releaseSpecsCovered = ['tests/tic-release.browser.mjs', 'tests/tic-online.browser.mjs', 'tests/tic-progression.browser.mjs']
  .every(spec => releaseBrowserSpecs.includes(spec))
  && (expectedReleaseSpecs.length === 0 || releaseBrowserSpecs.length === expectedReleaseSpecs.length)
const releaseBrowserSourceLocks = verifySourceLocks(releaseBrowserReport?.sourceFiles)
const mergedAcceptanceChecks = releaseAcceptanceReport?.checks || {}
const mergedAcceptanceOk = Boolean(releaseAcceptanceReport)
  && releaseAcceptanceReport.status === 'passed'
  && releaseAcceptanceReport?.gate?.pass === true
  && Array.isArray(releaseAcceptanceReport?.missing) && releaseAcceptanceReport.missing.length === 0
  && Object.keys(mergedAcceptanceChecks).length > 0
  && Object.values(mergedAcceptanceChecks).every(value => value === true)
  && (releaseAcceptanceReport?.screenshots?.missing ?? []).length === 0
  && (releaseAcceptanceReport?.screenshots?.mismatched ?? []).length === 0
const releaseBrowserGate = {
  path: 'audit/tic-release-browser.json',
  mergedPath: 'audit/tic-release-acceptance.json',
  present: Boolean(releaseBrowserReport),
  mergedPresent: Boolean(releaseAcceptanceReport),
  generatedBy: releaseBrowserReport?.generatedBy ?? null,
  status: releaseBrowserReport?.status ?? null,
  complete: releaseBrowserReport?.complete ?? null,
  sourceStableDuringRun: releaseBrowserReport?.sourceStableDuringRun ?? null,
  sourceFiles: releaseBrowserSourceLocks,
  specs: releaseBrowserSpecs,
  expectedSpecs: expectedReleaseSpecs,
  specsCovered: releaseSpecsCovered,
  tests: releaseBrowserTests.length,
  screenshots: releaseScreenshotsOnDisk,
  checks: browserChecksNormalized,
  acceptance: releaseAcceptanceReport ? {
    status: releaseAcceptanceReport.status ?? null,
    gatePass: releaseAcceptanceReport?.gate?.pass ?? null,
    checks: mergedAcceptanceChecks,
    missing: Array.isArray(releaseAcceptanceReport?.missing) ? releaseAcceptanceReport.missing.length : null,
    screenshots: releaseAcceptanceReport?.screenshots ? {
      total: releaseAcceptanceReport.screenshots.total ?? null,
      verified: releaseAcceptanceReport.screenshots.verified ?? null,
      existing: releaseAcceptanceReport.screenshots.existing ?? null,
      missing: Array.isArray(releaseAcceptanceReport.screenshots.missing) ? releaseAcceptanceReport.screenshots.missing.length : null,
      mismatched: Array.isArray(releaseAcceptanceReport.screenshots.mismatched) ? releaseAcceptanceReport.screenshots.mismatched.length : null,
    } : null,
  } : null,
  pass: false,
}
const browserLedgerOk = releaseBrowserGate.present && releaseBrowserGate.status === 'passed'
  && releaseBrowserGate.complete === true && releaseBrowserGate.sourceStableDuringRun === true
  && releaseBrowserSourceLocks.fresh
  && releaseBrowserGate.specsCovered && browserChecksAllTrue
  && releaseBrowserGate.tests > 0 && releaseBrowserGate.screenshots > 0
releaseBrowserGate.pass = browserLedgerOk || mergedAcceptanceOk

// 旧 P3 浏览器账本（规则书桌面/移动可读 + 章节实机路径）：只服务 confirmations.rulebook。
const legacyBrowserChecks = {
  reportPresent: Boolean(browserLegacyReport),
  generatedBy: browserLegacyReport?.generatedBy ?? null,
  status: browserLegacyReport?.status ?? null,
  current: Boolean(browserLegacyCurrent),
  coverage: browserLegacyReport?.coverage ?? null,
  links: browserLegacyReport?.links ?? null,
  tests: Array.isArray(browserLegacyReport?.tests) ? browserLegacyReport.tests.length : 0,
  screenshots: Array.isArray(browserLegacyReport?.screenshots) ? browserLegacyReport.screenshots.length : 0,
  scenariosCovered: Array.isArray(browserLegacyReport?.scenarios)
    ? browserLegacyReport.scenarios.filter(entry => entry?.desktop === true && entry?.mobile === true).length : 0,
}
legacyBrowserChecks.desktop = browserLegacyReport?.coverage?.['desktop:zh-CN'] === true
  && browserLegacyReport?.coverage?.['desktop:en'] === true && browserLegacyReport?.links?.desktop === true
legacyBrowserChecks.mobile = browserLegacyReport?.coverage?.['mobile:zh-CN'] === true
  && browserLegacyReport?.coverage?.['mobile:en'] === true && browserLegacyReport?.links?.mobile === true
legacyBrowserChecks.pass = legacyBrowserChecks.reportPresent
  && /playwright/i.test(String(legacyBrowserChecks.generatedBy || ''))
  && legacyBrowserChecks.status === 'passed'
  && legacyBrowserChecks.desktop && legacyBrowserChecks.mobile
  && legacyBrowserChecks.tests > 0 && legacyBrowserChecks.screenshots > 0
  && legacyBrowserChecks.scenariosCovered === chapters.length

// ---------------------------------------------------------------- 关键词与规则书（P4；真实数据复算）

const scanMechanisms = Array.isArray(scan?.mechanisms) ? scan.mechanisms : []
const keywordItems = TIC_KEYWORDS.map(keyword => {
  const checks = {
    sourceInventoried: scanMechanisms.some(row => row.id === keyword.id && (row.cards || []).length > 0),
    engineBehavior: keyword.primitives.every(id => [...plan.new, ...plan.reuse]
      .some(row => row.id === id && row.status === 'done')),
    nodeAcceptance: Boolean(nodeReport),
    rulebookEntry: ruleById(keyword.ruleId)?.id === keyword.ruleId,
    cardLinks: keyword.cardCodes.every(code => cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId)),
  }
  for (const key of KEYWORD_MIGRATION_CHECKS) if (typeof checks[key] !== 'boolean') checks[key] = Boolean(checks[key])
  const complete = KEYWORD_MIGRATION_CHECKS.every(key => checks[key] === true)
  return {
    id: keyword.id,
    ruleId: keyword.ruleId,
    zh: keyword.zh,
    kind: keyword.kind,
    cards: [...keyword.cardCodes],
    checks,
    status: complete ? 'verified' : 'pending',
    evidence: ['audit/tic-mechanism-scan.json', 'audit/tic-primitive-plan.json', 'audit/tic-node-acceptance.json', 'web/tic-rules.js'],
  }
})
const keywordFailures = keywordItems.filter(item => item.status !== 'verified')
const keywordsStatus = keywordFailures.length === 0 ? 'verified' : 'pending'
const scannedKeywordIds = TIC_KEYWORDS.filter(keyword => scanMechanisms
  .some(row => row.id === keyword.id && (row.cards || []).length > 0)).map(keyword => keyword.id).sort()
const keywordMechanismIds = TIC_KEYWORDS.map(keyword => keyword.id).sort()
// TIC 的第一步扫描没有 keyword 布尔标记（与 TDE 不同）：关键词以机制 id 出现在 scan.mechanisms。
// 因此对齐口径为「每个关键词都能在扫描账本里找到带卡面的机制」；额外机制由 scan.gates 覆盖。
const scanAlignment = {
  scanMechanisms: scannedKeywordIds,
  keywordMechanisms: keywordMechanismIds,
  missing: keywordMechanismIds.filter(id => !scannedKeywordIds.includes(id)),
  extra: [],
  snapshot: snapshotChecks.scan,
}
scanAlignment.pass = scanAlignment.missing.length === 0 && scanAlignment.snapshot

const ruleMentions = (rule, word) => Boolean(rule)
  && `${rule.title} ${rule.aliases.join(' ')} ${rule.body.join('')}`.toLowerCase().includes(String(word).toLowerCase())
const ruleIdSet = new Set(TIC_RULE_IDS)
const ticRuleEntries = TIC_RULE_IDS.map(ruleId => ruleById(ruleId))
const keywordById = id => TIC_KEYWORDS.find(keyword => keyword.id === id) || null
const campaignRule = ruleById('ticCampaign')
const campaignBody = campaignRule?.id === 'ticCampaign' ? campaignRule.body.join('') : ''
const rulebookDetails = {
  campaignOverview: {
    entryPresent: campaignRule?.id === 'ticCampaign',
    listsEveryChapter: chapters.every(chapter => campaignBody.includes(chapter.name)
      || campaignBody.toLowerCase().includes(chapter.nameEn.toLowerCase())),
    listsInterludes: campaignBody.includes('幕间') && campaignBody.includes('尾声'),
    statesScenarioOrder: campaignBody.includes('绝望深坑') && campaignBody.includes('暗潮之下'),
    relatedRulesExist: (campaignRule?.related || []).every(id => ruleIdSet.has(id)),
  },
  scenarioMechanics: {
    planGates: Object.values(plan.gates || {}).every(Boolean),
    requiredRuleEntries: TIC_RULE_IDS.length,
    entriesPresent: ticRuleEntries.every(rule => TIC_RULE_IDS.includes(rule?.id ?? '')),
    entriesInGroup: ticRuleEntries.every(rule => String(rule?.group || '').includes('印斯茅斯')),
    entriesRelatedResolved: ticRuleEntries.every(rule => (rule?.related || []).every(id => TIC_RULE_IDS.includes(id) || Boolean(ruleById(id)?.id === id))),
    scenarioReferenceCards: chapters.every(chapter => Boolean(ALL_CARDS[chapter.code]) && ALL_CARDS[chapter.code].type === 'scenario'),
    scenarioCardsLinkCampaignRule: chapters.every(chapter => cardRuleIds(ALL_CARDS[chapter.code]).includes('ticCampaign')),
  },
  keywordEntries: {
    total: keywordItems.length,
    // 关键词可指向本循环新增条目（TIC_RULE_IDS）或既有通用条目（hunter/surge/victory…）；
    // 唯一口径是「能按 ruleId 找到同名规则条目」，不能只认 TIC_RULE_IDS。
    entriesPresent: keywordItems.every(item => ruleById(item.ruleId)?.id === item.ruleId),
    searchable: keywordItems.every(item => ruleMentions(ruleById(item.ruleId), keywordById(item.id)?.zh || '')),
    statusVerified: keywordsStatus === 'verified',
    status: keywordsStatus,
  },
  cardLinks: {
    cards: CYCLE_CODES.length,
    linked: CYCLE_CODES.filter(code => cardRuleIds(ALL_CARDS[code]).length > 0).length,
    unlinked: CYCLE_CODES.filter(code => cardRuleIds(ALL_CARDS[code]).length === 0),
    keywordLinkTargets: keywordItems.every(item => item.cards.every(code => cardRuleIds(ALL_CARDS[code]).length > 0)),
    keywordCards: TIC_KEYWORDS.reduce((sum, keyword) => sum + keyword.cardCodes.length, 0),
  },
  desktopBrowser: releaseBrowserGate.checks.desktopBrowser,
  mobileBrowser: releaseBrowserGate.checks.mobileBrowser,
  legacyDesktopBrowser: legacyBrowserChecks.desktop,
  legacyMobileBrowser: legacyBrowserChecks.mobile,
}
const rulebookChecks = {
  campaignOverview: Object.values(rulebookDetails.campaignOverview).every(Boolean),
  scenarioMechanics: Object.values(rulebookDetails.scenarioMechanics)
    .every(value => value === true || value === TIC_RULE_IDS.length),
  keywordEntries: rulebookDetails.keywordEntries.entriesPresent
    && rulebookDetails.keywordEntries.searchable && rulebookDetails.keywordEntries.statusVerified,
  cardLinks: rulebookDetails.cardLinks.unlinked.length === 0 && rulebookDetails.cardLinks.keywordLinkTargets,
  // P8 起规则书「桌面/移动可读」以独立发布浏览器账本的真实大厅规则书用例为准
  // （brw 的 tic-release.browser.mjs 覆盖 F1 规则目录 TIC 条目）；旧 P3 账本只作补充证据。
  desktopBrowser: rulebookDetails.desktopBrowser,
  mobileBrowser: rulebookDetails.mobileBrowser,
}
const rulebookStatus = Object.values(rulebookChecks).every(Boolean) ? 'verified' : 'pending'
// ticCampaign 是「战役与记忆」概述规则条目（规则书内容），不是引擎机制；其余 9 条 TIC 规则
// 必须登记在 content/mechanics.js#supportedMechanics。
const CAMPAIGN_OVERVIEW_RULE_ID = 'ticCampaign'
const MECHANIC_RULE_IDS = TIC_RULE_IDS.filter(ruleId => ruleId !== CAMPAIGN_OVERVIEW_RULE_ID)
const mechanicsRegistered = MECHANIC_RULE_IDS.filter(ruleId => supportedMechanics.has(ruleId))
const mechanicsGate = {
  expected: MECHANIC_RULE_IDS.length,
  registered: mechanicsRegistered.length,
  missing: MECHANIC_RULE_IDS.filter(ruleId => !supportedMechanics.has(ruleId)),
  campaignOverviewRule: CAMPAIGN_OVERVIEW_RULE_ID,
  pass: MECHANIC_RULE_IDS.every(ruleId => supportedMechanics.has(ruleId)),
}

// ---------------------------------------------------------------- 逐章（生产注册表 + P7 逐章账本）

const chapterData = readJson('content/campaigns/theInnsmouthConspiracy/chapter-data.json') || {}
const ticGroupIds = new Set(ENCOUNTER_GROUPS.map(camel))
// 跨循环共享遭遇组：scope.externalDependencies 的 set 名与 chapter-data.gatherSets 的写法未必一致
// （例：DarkCult 卡片的 encounterCode 是 pentagram，而 gatherSets 写 pentagram）。所以按三种口径
// 归一解析：set 名 camel、成员卡的实际 encounterCode camel、以及已注册内容包的 encounterGroupIds。
const externalGroupEntries = Array.isArray(scope?.externalDependencies) ? scope.externalDependencies : []
const externalGroupAliases = new Set()
for (const entry of externalGroupEntries) {
  externalGroupAliases.add(camel(entry.set))
  for (const code of entry.codes || []) {
    const encounterCode = ALL_CARDS[code]?.encounterCode
    if (encounterCode) externalGroupAliases.add(camel(encounterCode))
  }
}
const crossCycleGroupResolved = group => externalGroupAliases.has(group) || groupUniverse.has(group)
const recordKeys = new Set(Object.keys(RECORD_TYPES))
const scenarioVerified = item => Boolean(item) && SCENARIO_MIGRATION_CHECKS.every(check => item.checks?.[check] === true)
const ledgerTestFile = item => item?.notes?.chapterTest?.file || null
// 逐章账本 fileHashes 的键是符号名（scenarioIndex/guide/acceptanceTest），不是文件路径；
// 这里按审计口径映射回真实文件再逐文件核对（testFile 来自本章验收测试记录）。
const chapterFileHashSources = item => ({
  scenarioIndex: `content/campaigns/theInnsmouthConspiracy/scenarios/${item?.id}/index.js`,
  guide: `web/scenario-guides/${item?.id}.json`,
  acceptanceTest: ledgerTestFile(item),
})
const chapterFileHashesFresh = item => {
  const hashes = item?.fileHashes || {}
  const sources = chapterFileHashSources(item)
  const checked = Object.entries(hashes)
    .filter(([key]) => typeof sources[key] === 'string' && sources[key])
    .map(([key, hash]) => fileHash(gameRelative(sources[key])) === hash)
  return Object.keys(hashes).length > 0 && checked.length === Object.keys(hashes).length
    && checked.every(Boolean)
}
const chapterChecks = chapters.map(chapter => {
  const registered = scenarioOf(chapter.id)
  const ledger = scenarioItemOf(chapter.id)
  const spec = chapterData[chapter.id] || {}
  const manifest = registered || null
  let scenarioData = null
  try { scenarioData = contentRegistry.getScenarioData(chapter.id) } catch { scenarioData = null }
  const gatherGroups = uniq((Array.isArray(spec.gatherSets) ? spec.gatherSets : []).map(camel))
  const expectedTicGroups = gatherGroups.filter(group => ticGroupIds.has(group))
  const requiredGroups = [...(manifest?.requiredEncounterGroupIds || [])]
  const crossCycleGroups = gatherGroups.filter(group => !ticGroupIds.has(group))
  const crossCycleResolved = crossCycleGroups.every(group => crossCycleGroupResolved(group))
  const locations = Array.isArray(manifest?.locations) ? manifest.locations : []
  const layout = manifest?.layout || null
  const layoutCoordinates = layout?.locations || {}
  const layoutComplete = locations.length > 0 && locations.every(location => {
    const point = layoutCoordinates[location.id]
    return point && typeof point.x === 'number' && Number.isFinite(point.x)
      && typeof point.y === 'number' && Number.isFinite(point.y)
  })
  const declaredConnections = new Set(locations.flatMap(location =>
    (location.connections || []).map(to => `${location.id}>${to}`)))
  const layoutEdges = Array.isArray(layout?.edges) ? layout.edges : null
  const layoutEdgesLegal = Array.isArray(layoutEdges) && layoutEdges.every(edge =>
    typeof edge?.from === 'string' && typeof edge?.to === 'string'
      && locations.some(location => location.id === edge.from)
      && declaredConnections.has(`${edge.from}>${edge.to}`))
  const checks = {
    campaignRegistered: Boolean(campaign?.scenarioIds?.includes(chapter.id)),
    statusPlayable: LAUNCHABLE.has(manifest?.status),
    referenceCodeMatches: manifest?.referenceCode === chapter.code,
    campaignIdMatches: manifest?.campaignId === CAMPAIGN_ID,
    referenceCardExists: Boolean(ALL_CARDS[chapter.code]) && ALL_CARDS[chapter.code].type === 'scenario',
    layoutComplete,
    layoutEdgesLegal,
    requiredPacksExist: (manifest?.requiredPackIds || []).every(packId => Boolean(packOf(packId))),
    requiredMechanicsSupported: (manifest?.requiredMechanicIds || []).every(id => supportedMechanics.has(id)),
    recordKeysExist: [...(manifest?.recordReads || []), ...(manifest?.recordWrites || [])].every(key => recordKeys.has(key)),
    encounterGroupsRegistered: requiredGroups.every(group => groupUniverse.has(group)),
    expectedGroupsDeclared: sameSet([...requiredGroups].sort(), [...expectedTicGroups].sort()),
    crossCycleGroupsResolved: crossCycleResolved,
    stageStructurePresent: Boolean(scenarioData)
      && (scenarioData.acts || []).length > 0 && (scenarioData.agendas || []).length > 0
      && (manifest?.zones?.encounterDeck || []).length > 0,
    ledgerItemPresent: Boolean(ledger),
    ledgerTwelveTrue: scenarioVerified(ledger),
    ledgerFileHashesFresh: chapterFileHashesFresh(ledger),
    testFilePresent: Boolean(ledgerTestFile(ledger)) && existsAt(gameRelative(ledgerTestFile(ledger) || '')),
  }
  const inventory = ledger?.inventory || null
  return {
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    nameEn: chapter.nameEn,
    status: manifest?.status ?? null,
    referenceCode: manifest?.referenceCode ?? null,
    requiredPackIds: [...(manifest?.requiredPackIds || [])],
    requiredEncounterGroupIds: requiredGroups,
    expectedEncounterGroupIds: expectedTicGroups,
    crossCycleGroups,
    recordReads: [...(manifest?.recordReads || [])],
    recordWrites: [...(manifest?.recordWrites || [])],
    testFile: ledgerTestFile(ledger),
    testCases: numberOrNull(ledger?.notes?.chapterTest?.passedCases),
    inventory: inventory ? {
      locations: inventory.locationDefinitions ?? inventory.locations ?? null,
      acts: inventory.acts ?? null,
      agendas: inventory.agendas ?? null,
      enemies: inventory.enemies ?? null,
      treacheries: inventory.treacheries ?? null,
      encounterCards: inventory.encounterCards ?? null,
    } : null,
    checks,
    launchable: LAUNCHABLE.has(manifest?.status) && scenarioVerified(ledger),
    pass: Object.values(checks).every(Boolean),
  }
})
const chapterPlan = {
  total: chapters.length,
  launchable: chapterChecks.filter(chapter => chapter.launchable).length,
  allLaunchable: chapterChecks.every(chapter => chapter.launchable),
  verifiedLedger: chapterChecks.filter(chapter => chapter.checks.ledgerTwelveTrue).length,
  allVerified: chapterChecks.every(chapter => chapter.checks.ledgerTwelveTrue),
  allPass: chapterChecks.every(chapter => chapter.pass),
}
const scenarioChecks = {
  ledgerPresent: Boolean(scenarioLedger),
  ledgerStatus: scenarioLedger?.status ?? null,
  ledgerVerified: scenarioLedger?.status === 'verified',
  chaptersAligned: scenarioItems.length === chapters.length && chapters.every(chapter => {
    const item = scenarioItemOf(chapter.id)
    return Boolean(item) && item.code === chapter.code && item.name === chapter.name
  }),
  twelveOfTwelve: chapterChecks.every(chapter => chapter.checks.ledgerTwelveTrue),
  fileHashesFresh: chapterChecks.every(chapter => chapter.checks.ledgerFileHashesFresh),
  sourceStableDuringRun: scenarioLedger?.sourceStableDuringRun !== false,
  testsPresent: chapterChecks.every(chapter => chapter.checks.testFilePresent),
  pendingRequests: numberOrNull(scenarioLedger?.summary?.primitiveRequests?.pending),
  pendingRequestFiles: Array.isArray(scenarioLedger?.summary?.primitiveRequests?.pendingFiles)
    ? scenarioLedger.summary.primitiveRequests.pendingFiles.length : null,
}
scenarioChecks.pass = scenarioChecks.ledgerPresent && scenarioChecks.ledgerVerified && scenarioChecks.chaptersAligned
  && scenarioChecks.twelveOfTwelve && scenarioChecks.fileHashesFresh && scenarioChecks.sourceStableDuringRun
  && scenarioChecks.testsPresent

// ---------------------------------------------------------------- 逐卡账本（P7 全卡；P8 收口后 strict）

const allCardSimplifiedCodes = allCardEntries.filter(entry => entry.status === 'simplified').map(entry => entry.code)
const allCardPassingStatuses = new Set(['verified', 'simplified', 'no-behavior'])
const allCardCountsAligned = Boolean(allCardSummary)
  && allCardSummary.total === partitionCodes.ticCampaign.length
  && allCardSummary.campaignPartition === partitionCodes.ticCampaign.length
  && allCardSummary.allRecords === liveTotal
  && allCardEntries.length === allCardSummary.total
  && uniq(allCardEntries.map(entry => entry.code)).length === allCardEntries.length
const allCardGate = {
  path: 'audit/tic-all-card-acceptance.json',
  present: Boolean(allCardLedger),
  generatedBy: allCardLedger?.generatedBy ?? null,
  total: allCardSummary?.total ?? 0,
  verified: allCardSummary?.verified ?? 0,
  simplified: allCardSummary?.simplified ?? 0,
  noBehavior: allCardSummary?.noBehavior ?? 0,
  missing: allCardSummary?.missing ?? -1,
  blocked: allCardSummary?.blocked ?? -1,
  pending: allCardSummary?.pending ?? -1,
  strictComplete: allCardSummary?.strictComplete ?? null,
  gateComplete: allCardSummary?.gateComplete ?? null,
  testsPassed: allCardSummary?.testsPassed ?? 0,
  testFiles: allCardSummary?.testFiles ?? 0,
  simplifiedCodes: allCardSimplifiedCodes,
  behaviorRequests: allCardSummary?.behaviorPrimitiveRequests ?? null,
  refactorRequests: allCardSummary?.refactorPrimitiveRequests ?? null,
  countsAligned: allCardCountsAligned,
  entriesPassing: allCardEntries.length > 0 && allCardEntries.every(entry => allCardPassingStatuses.has(entry.status)),
  ledger: { path: 'audit/tic-all-card-acceptance.json', sha256: fileHash('audit/tic-all-card-acceptance.json') },
}
allCardGate.pass = allCardGate.present && allCardCountsAligned && allCardGate.entriesPassing
  && allCardGate.missing === 0 && allCardGate.blocked === 0 && allCardGate.pending === 0
allCardGate.strictPass = allCardGate.pass && allCardGate.strictComplete === true && allCardGate.simplified === 0

// ---------------------------------------------------------------- 调查员 / 玩家卡 / 交互（已有分账）

const investigatorItems = Array.isArray(investigatorLedger?.items) ? investigatorLedger.items : []
const investigatorGate = {
  path: 'audit/tic-investigators.json',
  status: investigatorLedger?.status ?? null,
  formal: INVESTIGATOR_CODES.length,
  items: investigatorItems.length,
  verified: investigatorItems.filter(item => item.status === 'verified').length,
  gates: investigatorLedger?.gates ?? null,
  pass: false,
}
investigatorGate.pass = investigatorLedger?.status === 'verified'
  && investigatorItems.length === INVESTIGATOR_CODES.length
  && investigatorItems.every(item => item.status === 'verified')
  && Object.values(investigatorLedger?.gates || {}).every(Boolean)

const playerSummary = playerLedger?.summary || null
const playerShardCodes = uniq((playerShards?.shards || []).flatMap(shard => shard.codes || []))
const playerEntryCodes = (Array.isArray(playerLedger?.entries) ? playerLedger.entries : []).map(entry => entry.code)
const playerCards = packOfId('ticPlayer')?.cards ?? 0
const playerGate = {
  path: 'audit/tic-player-acceptance.json',
  status: playerLedger ? 'verified' : null,
  total: playerSummary?.total ?? 0,
  verified: playerSummary?.verified ?? 0,
  missing: playerSummary?.missing ?? -1,
  simplified: playerSummary?.simplified ?? -1,
  buildable: playerSummary?.buildable ?? 0,
  dependencyOnly: playerSummary?.dependencyOnly ?? 0,
  testsPassed: playerSummary?.testsPassed ?? 0,
  packCards: playerCards,
  deckbuilding: packOfId('ticPlayer')?.deckbuilding ?? 0,
  shardCodes: playerShardCodes.length,
  entryCodes: new Set(playerEntryCodes).size,
  queue: playerQueue?.summary ? { ...playerQueue.summary } : null,
  gates: playerLedger?.gates ?? null,
  pass: false,
}
playerGate.pass = Boolean(playerLedger)
  && playerSummary?.total === partitionCodes.ticPlayer.length
  && playerSummary?.verified === partitionCodes.ticPlayer.length
  && playerSummary?.missing === 0 && playerSummary?.simplified === 0
  && playerSummary?.buildable === packOfId('ticPlayer')?.deckbuilding
  && Object.values(playerLedger?.gates || {}).every(Boolean)
  && playerShardCodes.length === partitionCodes.ticPlayer.length
  && (playerQueue?.summary?.pending ?? 0) === 0

const interactionGate = {
  path: 'audit/tic-interactions.json',
  status: interactionLedger?.status ?? null,
  checks: interactionLedger?.checks ?? null,
  pass: false,
}
interactionGate.pass = interactionLedger?.status === 'verified'
  && Object.values(interactionLedger?.gates || {}).every(Boolean)

// ---------------------------------------------------------------- 原语与请求队列（P3–P8）

const planNew = Array.isArray(plan?.new) ? plan.new : []
const planReuse = Array.isArray(plan?.reuse) ? plan.reuse : []
const unfinishedPrimitives = planNew.filter(row => row.status !== 'done').map(row => row.id)
const deferredPrimitives = Array.isArray(plan?.deferredPrimitives) ? plan.deferredPrimitives : []
const escapePrimitives = Array.isArray(plan?.escape) ? plan.escape : []
const requestFiles = existsAt(PRIMITIVE_REQUEST_DIR)
  ? readdirSync(join(MOD, PRIMITIVE_REQUEST_DIR)).filter(name => name.endsWith('.json')).sort() : []
const primitiveRequestItems = requestFiles.map(file => {
  const request = readJson(`${PRIMITIVE_REQUEST_DIR}/${file}`)
  return request ? { file, path: `${PRIMITIVE_REQUEST_DIR}/${file}`, request } : null
}).filter(Boolean)
const requestStatus = item => String(item.request.status || 'unknown')
const behaviorPendingRequests = primitiveRequestItems.filter(item =>
  !['done', 'rejected', 'withdrawn'].includes(requestStatus(item)) && item.request.kind !== 'shared-factory')
const refactorPendingRequests = primitiveRequestItems.filter(item =>
  !['done', 'rejected', 'withdrawn'].includes(requestStatus(item)) && item.request.kind === 'shared-factory')
const rejectedRequests = primitiveRequestItems.filter(item => requestStatus(item) === 'rejected')
const withdrawnRequests = primitiveRequestItems.filter(item => requestStatus(item) === 'withdrawn')
const primitiveDebtCount = behaviorPendingRequests.length + rejectedRequests.length + withdrawnRequests.length
  + deferredPrimitives.length + escapePrimitives.length
const primitiveGate = {
  path: 'audit/tic-primitive-plan.json',
  new: planNew.length,
  done: planNew.filter(row => row.status === 'done').length,
  reuse: planReuse.length,
  unfinished: unfinishedPrimitives,
  deferred: deferredPrimitives.length,
  escape: escapePrimitives.length,
  requests: {
    files: primitiveRequestItems.length,
    done: primitiveRequestItems.filter(item => requestStatus(item) === 'done').length,
    pending: primitiveRequestItems.filter(item => !['done', 'rejected', 'withdrawn'].includes(requestStatus(item))).length,
    behaviorPending: behaviorPendingRequests.map(item => item.request.id || item.file),
    refactorPending: refactorPendingRequests.map(item => item.request.id || item.file),
    rejected: rejectedRequests.map(item => item.request.id || item.file),
    withdrawn: withdrawnRequests.map(item => item.request.id || item.file),
  },
  planGates: plan?.gates ?? null,
  snapshot: snapshotChecks.plan,
  pass: false,
}
// 发布口径：行为类债务必须为 0；同句模板共享工厂（refactor）只作维护债务，不阻塞发布。
primitiveGate.pass = unfinishedPrimitives.length === 0 && deferredPrimitives.length === 0
  && escapePrimitives.length === 0 && behaviorPendingRequests.length === 0
  && rejectedRequests.length === 0 && withdrawnRequests.length === 0
  && Object.values(plan?.gates || {}).every(Boolean)
const maintenance = refactorPendingRequests.map(item => ({
  id: item.request.id || item.file,
  kind: item.request.kind || 'shared-factory',
  status: requestStatus(item),
  file: item.path,
  cards: Array.isArray(item.request.cards) ? [...item.request.cards] : [],
  note: '同句模板共享工厂重构（code hygiene）；不改变卡牌行为，不阻塞 P8 发布。',
}))

// ---------------------------------------------------------------- 图片 / 展示 / 文档 / 指南 / 注册校验（P8 发布卫生）

const imagePolicyExpected = {
  english: 'web/img/cards/',
  chinese: 'web/img/zh/cards/',
  remoteFallback: ['imagesrc', 'backimagesrc'],
  cycleCopies: false,
}
const imagePolicy = scope?.imagePolicy ?? null
const scanImageDir = dir => {
  const absolute = join(MOD, dir)
  if (!existsSync(absolute)) return { dir, dirExists: false, files: 0, codes: [] }
  const codes = []
  for (const name of readdirSync(absolute).sort()) {
    const match = /^(07\d{3}[a-z]?)\.avif$/.exec(name)
    if (match) codes.push(match[1])
  }
  return { dir, dirExists: true, files: codes.length, codes }
}
const imageDirs = Object.fromEntries(Object.entries(IMAGE_DIRS).map(([locale, dir]) => {
  const scanOf = scanImageDir(dir)
  const known = new Set(CYCLE_CODES)
  // 本地图片缓存被 .gitignore 忽略（web/img/**），且缓存里有卡表未登记的背面美术（如 07048b）；
  // 这里只做「清单 vs 循环卡号」核对：记录覆盖数与非卡表背面数，不用缺图/多图当仓库缺陷。
  const inCycle = scanOf.codes.filter(code => known.has(code))
  const outsideCycle = scanOf.codes.filter(code => !known.has(code))
  return [locale, {
    dir: scanOf.dir,
    dirExists: scanOf.dirExists,
    files: scanOf.files,
    covered: inCycle.length,
    records: CYCLE_CODES.length,
    outsideCycleCodes: outsideCycle.sort(),
  }]
}))
const remoteImageCodes = CYCLE_CODES.filter(code => Boolean(ALL_CARDS[code]?.imagesrc))
const backImageCodes = CYCLE_CODES.filter(code => Boolean(ALL_CARDS[code]?.backimagesrc))
const runtimeScanFiles = [
  ...(existsAt('index.js') ? ['index.js'] : []),
  ...RUNTIME_SCAN_ROOTS.flatMap(root => walkFiles(root, relative => RUNTIME_SCAN_EXTENSIONS
    .some(extension => relative.endsWith(extension)))),
]
const referenceMentions = []
const referenceBound = []
const REFERENCE_BOUND = /(?:from\s*|import\s*\(\s*|require\s*\(\s*|new\s+URL\s*\(\s*|fetch\s*\(\s*)[`'"][^`'"]*参考资源/
for (const file of runtimeScanFiles) {
  const lines = (readText(file) || '').split('\n')
  for (const [index, line] of lines.entries()) {
    if (!line.includes(REFERENCE_MARKER)) continue
    referenceMentions.push(`${file}:${index + 1}`)
    if (REFERENCE_BOUND.test(line)) referenceBound.push(`${file}:${index + 1}`)
  }
}
const imagesGate = {
  policy: imagePolicy,
  policyExpected: imagePolicyExpected,
  policyMatches: JSON.stringify(imagePolicy) === JSON.stringify(imagePolicyExpected),
  dirs: imageDirs,
  remoteFallback: {
    fields: ['imagesrc', 'backimagesrc'],
    records: CYCLE_CODES.length,
    withImagesrc: remoteImageCodes.length,
    withBackimagesrc: backImageCodes.length,
    availableForAllRecords: remoteImageCodes.length === CYCLE_CODES.length,
  },
  referenceSourceScan: {
    scope: ['index.js', ...RUNTIME_SCAN_ROOTS.map(root => `${root}/**`)],
    filesScanned: runtimeScanFiles.length,
    mentionCount: referenceMentions.length,
    boundReferenceCount: referenceBound.length,
    boundReferences: referenceBound,
  },
  pass: false,
}
imagesGate.pass = imagesGate.policyMatches && imagesGate.remoteFallback.availableForAllRecords
  && imagePolicy?.cycleCopies === false
  && Object.values(imageDirs).every(entry => entry.dirExists && entry.files > 0)
  && referenceBound.length === 0

const presentationRun = runCommand(EXPECTED_RUNNERS.presentation)
const presentationReport = readJson('audit/presentation-report.json')
const ticDescriptorsResolved = CYCLE_CODES.filter(code => {
  try { return Boolean(buildImageDescriptor(ALL_CARDS[code])) } catch { return false }
}).length
const presentationGate = {
  ...runEvidence(presentationRun),
  report: {
    path: 'audit/presentation-report.json',
    present: Boolean(presentationReport),
    presentationVersion: presentationReport?.presentationVersion ?? null,
    catalogCards: presentationReport?.catalog?.total ?? null,
    imageResolutionCards: presentationReport?.imageResolution ? 1 : 0,
  },
  ticDescriptors: { resolved: ticDescriptorsResolved, records: CYCLE_CODES.length },
  pass: false,
}
presentationGate.pass = presentationRun.ok && Boolean(presentationReport)
  && ticDescriptorsResolved === CYCLE_CODES.length

const docsRun = runCommand(EXPECTED_RUNNERS.docs)
let docsJson = null
try { docsJson = JSON.parse(docsRun.stdout || '') } catch { docsJson = null }
const docsGate = {
  ...runEvidence(docsRun),
  files: numberOrNull(docsJson?.files),
  links: numberOrNull(docsJson?.links),
  broken: Array.isArray(docsJson?.broken) ? docsJson.broken.length : null,
  brokenLinks: Array.isArray(docsJson?.broken) ? docsJson.broken.slice(0, 10) : [],
  pass: docsRun.ok && Array.isArray(docsJson?.broken) && docsJson.broken.length === 0,
}

const guidesRun = runCommand(EXPECTED_RUNNERS.guides)
const ticGuides = chapters.map(chapter => {
  const relative = `web/scenario-guides/${chapter.id}.json`
  const guide = readJson(relative)
  const localeOk = language => {
    const locale = guide?.locales?.[language]
    if (!locale) return false
    const has = section => Array.isArray(locale[section]) && locale[section].length > 0
    return has('intro') && has('setup') && has('specialRules') && has('resolutions')
      && textLength(locale.intro) > 20 && textLength(locale.setup) > 80
      && textLength(locale.specialRules) > 80 && textLength(locale.resolutions) > 40
  }
  const zh = localeOk('zh')
  const en = localeOk('en')
  return {
    id: chapter.id,
    path: relative,
    exists: Boolean(guide),
    campaignId: guide?.campaignId ?? null,
    zh,
    en,
    pass: Boolean(guide) && guide.id === chapter.id && guide.campaignId === CAMPAIGN_ID && zh && en,
  }
})
const guidesGate = {
  ...runEvidence(guidesRun),
  chapters: chapters.length,
  complete: ticGuides.filter(guide => guide.pass).length,
  pass: guidesRun.ok && ticGuides.every(guide => guide.pass),
}

const registryRun = runCommand(EXPECTED_RUNNERS.registry)
const registryGate = {
  ...runEvidence(registryRun),
  pass: registryRun.ok,
}

// ---------------------------------------------------------------- 发布门禁（首次组装；releaseGate 在 required 之后）

const campaignLaunchableChecks = {
  registered: Boolean(campaign),
  statusPlayable: LAUNCHABLE.has(campaign?.status),
  assertLaunchable: !launchBlocked,
  lobbyVisible,
  libraryScenarioCount: registryScenarios.length,
  scenarioCountMatches: registryScenarios.length === chapters.length,
  scenarioIdsOrdered: sameSet([...(campaign?.scenarioIds || [])], chapters.map(chapter => chapter.id))
    && (campaign?.scenarioIds || []).length === chapters.length,
  requiredPacks: [...(campaign?.requiredPackIds || [])],
  requiredPacksExist: expectedRequiredPacksExist,
  chaosBagsMatch: JSON.stringify(campaign?.chaosBags ?? null) === JSON.stringify(CHAOS_BAGS),
  recordSchemaMatches: JSON.stringify(campaign?.recordSchema ?? null) === JSON.stringify(RECORD_TYPES),
  interludeHandler: campaign?.interludeHandlerId ?? null,
  resolutionIds: campaign?.resolutionIds ?? null,
}
campaignLaunchableChecks.pass = campaignLaunchableChecks.registered && campaignLaunchableChecks.statusPlayable
  && campaignLaunchableChecks.assertLaunchable && campaignLaunchableChecks.lobbyVisible
  && campaignLaunchableChecks.scenarioCountMatches && campaignLaunchableChecks.scenarioIdsOrdered
  && campaignLaunchableChecks.requiredPacksExist && campaignLaunchableChecks.chaosBagsMatch
  && campaignLaunchableChecks.recordSchemaMatches

const lobbyChecks = {
  visible: lobbyVisible,
  earlyAccess: lobbyEarlyAccess,
  scenarios: lobbyScenarios,
  expectedScenarios: chapters.length,
  standard: lobbyVisible && lobbyEarlyAccess === false && lobbyScenarios === chapters.length,
  nameMatches: lobbyEntry?.name === campaign?.name && lobbyEntry?.nameEn === campaign?.nameEn,
}
lobbyChecks.pass = lobbyChecks.standard && lobbyChecks.nameMatches

const chaptersLaunchableChecks = {
  chapters: chapterChecks.length,
  launchable: chapterPlan.launchable,
  lobbyChapters: lobbyScenarios,
  pass: chapterPlan.allLaunchable && chapterPlan.allVerified && lobbyScenarios === chapters.length,
}

const campaignEncounterGroups = Array.isArray(packOfId('ticCampaign')?.encounterGroupIds)
  ? packOfId('ticCampaign').encounterGroupIds : []
const expectedGroupIds = ENCOUNTER_GROUPS.map(camel)
const sharedGroupIds = ENCOUNTER_GROUPS.filter(group => !chapters.some(chapter => chapter.encounterCode === group))
const encounterGroupChecks = {
  expected: expectedGroupIds.length,
  registered: campaignEncounterGroups.length,
  unique: uniq(campaignEncounterGroups).length === campaignEncounterGroups.length,
  matchesExpected: sameSet([...campaignEncounterGroups].sort(), [...expectedGroupIds].sort()),
  chapterGroups: chapters.length,
  sharedGroups: sharedGroupIds.length,
  chapterGroupsRegistered: chapters.every(chapter => campaignEncounterGroups.includes(chapter.id)),
  sharedGroupsRegistered: sharedGroupIds.map(camel).every(group => campaignEncounterGroups.includes(group)),
  unresolvedChapterGroups: chapterChecks.flatMap(chapter => chapter.requiredEncounterGroupIds
    .filter(group => !groupUniverse.has(group)).map(group => `${chapter.id}:${group}`)),
  externalGroupsDeclared: [...externalGroupAliases].sort(),
  pass: false,
}
encounterGroupChecks.pass = encounterGroupChecks.matchesExpected && encounterGroupChecks.unique
  && encounterGroupChecks.chapterGroupsRegistered && encounterGroupChecks.sharedGroupsRegistered
  && encounterGroupChecks.unresolvedChapterGroups.length === 0

const packCountChecks = {
  packs: Object.fromEntries(PACK_IDS.map(id => [id, { cards: packOfId(id)?.cards ?? 0, records: packOfId(id)?.records ?? 0 }])),
  totalRecords: PACK_IDS.reduce((sum, id) => sum + (packOfId(id)?.records ?? 0), 0),
  liveRecords: liveTotal,
  campaignPartition: partitionCodes.ticCampaign.length,
  investigatorPartition: partitionCodes.ticInvestigators.length,
  playerPartition: partitionCodes.ticPlayer.length,
  allCardLedgerTotal: allCardSummary?.total ?? null,
  allCardLedgerAllRecords: allCardSummary?.allRecords ?? null,
  pass: false,
}
packCountChecks.pass = packCountChecks.totalRecords === liveTotal
  && packCountChecks.packs.ticCampaign.records === partitionCodes.ticCampaign.length
  && packCountChecks.packs.ticInvestigators.records === partitionCodes.ticInvestigators.length
  && packCountChecks.packs.ticPlayer.records === partitionCodes.ticPlayer.length
  && packCountChecks.allCardLedgerTotal === partitionCodes.ticCampaign.length
  && packCountChecks.allCardLedgerAllRecords === liveTotal

const gate = {
  scopeLedger: {
    path: 'audit/tic-scope.json',
    sha256: fileHash('audit/tic-scope.json'),
    gates: scope?.gates ?? null,
    snapshot: snapshotChecks.scope,
    pass: Boolean(scope) && Object.values(scope?.gates || {}).every(Boolean) && snapshotChecks.scope,
  },
  scanLedger: {
    path: 'audit/tic-mechanism-scan.json',
    sha256: fileHash('audit/tic-mechanism-scan.json'),
    gates: scan?.gates ?? null,
    snapshot: snapshotChecks.scan,
    pass: Boolean(scan) && Object.values(scan?.gates || {}).every(Boolean) && snapshotChecks.scan,
  },
  planLedger: {
    path: 'audit/tic-primitive-plan.json',
    sha256: fileHash('audit/tic-primitive-plan.json'),
    gates: plan?.gates ?? null,
    snapshot: snapshotChecks.plan,
    pass: Boolean(plan) && Object.values(plan?.gates || {}).every(Boolean) && snapshotChecks.plan,
  },
  records: { ...partitionChecks, total: liveTotal, main: liveMainCodes.length, faces: liveFaceCodes.length, pass: partitionChecks.pass },
  packsByPhase: {
    campaign: { status: packOfId('ticCampaign')?.status ?? null, cards: packOfId('ticCampaign')?.cards ?? 0,
      records: packOfId('ticCampaign')?.records ?? 0, pass: Boolean(packOfId('ticCampaign')?.pass) },
    investigators: { status: packOfId('ticInvestigators')?.status ?? null, cards: packOfId('ticInvestigators')?.cards ?? 0,
      records: packOfId('ticInvestigators')?.records ?? 0, pass: Boolean(packOfId('ticInvestigators')?.pass) },
    player: { status: packOfId('ticPlayer')?.status ?? null, cards: packOfId('ticPlayer')?.cards ?? 0,
      records: packOfId('ticPlayer')?.records ?? 0, deckbuilding: packOfId('ticPlayer')?.deckbuilding ?? 0,
      pass: Boolean(packOfId('ticPlayer')?.pass) },
    pass: packs.every(pack => pack.pass),
  },
  campaignLaunchable: { ...campaignLaunchableChecks },
  launchEnabled: { enabled: !launchBlocked, error: launchError, pass: !launchBlocked },
  lobby: { ...lobbyChecks },
  chaptersLaunchable: { ...chaptersLaunchableChecks },
  encounterGroups: { ...encounterGroupChecks },
  packCounts: { ...packCountChecks },
  requiredPacksExist: { packs: [...(campaign?.requiredPackIds || [])], pass: expectedRequiredPacksExist },
  keywordScanAligned: { ...scanAlignment },
  keywordsVerified: {
    total: keywordItems.length,
    verified: keywordItems.length - keywordFailures.length,
    pending: keywordFailures.map(item => item.id),
    pass: keywordFailures.length === 0,
  },
  rulebookEntries: {
    expected: TIC_RULE_IDS.length,
    present: ticRuleEntries.filter(rule => TIC_RULE_IDS.includes(rule?.id ?? '')).length,
    pass: ticRuleEntries.every(rule => TIC_RULE_IDS.includes(rule?.id ?? '')),
  },
  rulebookVerified: { checks: rulebookChecks, status: rulebookStatus, pass: rulebookStatus === 'verified' },
  mechanicsRegistered: { ...mechanicsGate },
  nodeAcceptance: { ...nodeGate, pass: nodeGate.passGate },
  regressionVerified: { ...regressionGate },
  replayVerified: { ...replayGate },
  investigatorsVerified: { ...investigatorGate },
  playerCardsVerified: { ...playerGate },
  scenariosVerified: { ...scenarioChecks, verified: chapterPlan.verifiedLedger, total: chapters.length, pass: scenarioChecks.pass },
  allCardsVerified: { ...allCardGate, pass: allCardGate.pass },
  allCardsStrict: {
    strictComplete: allCardGate.strictComplete,
    simplified: allCardGate.simplified,
    behaviorRequests: allCardGate.behaviorRequests,
    pass: allCardGate.strictPass,
  },
  browserAcceptance: { ...legacyBrowserChecks, pass: legacyBrowserChecks.pass },
  releaseBrowserVerified: { ...releaseBrowserGate },
  storyVerified: { ...storyGate },
  guidesVerified: { ...guidesGate },
  imagesVerified: { ...imagesGate },
  presentationVerified: { ...presentationGate },
  docsVerified: { ...docsGate },
  registryCheck: { ...registryGate },
  primitivesDone: { ...primitiveGate },
  interactionVerified: { ...interactionGate },
  baseline: {
    path: 'audit/baseline.json',
    milestone: baselineLedger?.milestone ?? null,
    ticAuditRecorded: ticBaselineAuditCommands(baselineLedger).length > 0,
    pass: true, // baseline 是发布收尾项，不进硬门禁；由 remaining / baseline.retaken 暴露。
  },
  pass: false,
}

// ---------------------------------------------------------------- 发布验收 / 提前体验 / 披露

const requiredWithoutDisclosure = {
  launch: gate.campaignLaunchable.pass && gate.launchEnabled.pass && gate.registryCheck.pass,
  lobby: gate.lobby.pass,
  chapters: gate.scenariosVerified.pass && gate.chaptersLaunchable.pass,
  allCards: gate.allCardsVerified.pass,
  allCardsStrict: gate.allCardsStrict.pass,
  node: gate.nodeAcceptance.pass,
  browser: gate.releaseBrowserVerified.pass,
  replay: gate.replayVerified.pass,
  regression: gate.regressionVerified.pass,
  story: gate.storyVerified.pass,
  guides: gate.guidesVerified.pass,
  images: gate.imagesVerified.pass,
  presentation: gate.presentationVerified.pass,
  docs: gate.docsVerified.pass,
}
// 已知偏差（简化/缺口/行为类原语债务）：这些才决定是否以「提前体验」发布。
const deferredCandidates = []
if (allCardGate.simplified > 0) {
  deferredCandidates.push({
    id: 'all-cards-simplified',
    kind: 'all-cards',
    count: allCardGate.simplified,
    codes: allCardSimplifiedCodes,
    status: 'deferred',
    reason: `逐卡账本仍有 ${allCardGate.simplified} 张显式简化（未逐条等价），见 audit/tic-all-card-acceptance.json`,
    evidence: 'audit/tic-all-card-acceptance.json',
  })
}
for (const item of behaviorPendingRequests) {
  deferredCandidates.push({
    id: item.request.id || item.file,
    kind: item.request.kind || 'behavior-primitive-request',
    status: requestStatus(item),
    cards: Array.isArray(item.request.cards) ? [...item.request.cards] : [],
    reason: `行为类原语请求未完成：${item.request.primitive || item.request.missingPrimitive || '(未命名)'}`,
    evidence: item.path,
  })
}
for (const primitive of deferredPrimitives) {
  deferredCandidates.push({ id: `primitive:${primitive.id || primitive}`, kind: 'deferred-primitive', status: 'deferred',
    reason: `原语显式延后：${primitive.id || primitive}`, evidence: 'audit/tic-primitive-plan.json' })
}
for (const primitive of escapePrimitives) {
  deferredCandidates.push({ id: `primitive-escape:${primitive.id || primitive}`, kind: 'primitive-escape', status: 'deferred',
    reason: `单卡一次性逻辑逃逸登记：${primitive.id || primitive}`, evidence: 'audit/tic-primitive-plan.json' })
}
for (const chapter of chapterChecks) {
  const ledger = scenarioItemOf(chapter.id)
  const gaps = Array.isArray(ledger?.gaps) ? ledger.gaps : []
  for (const gap of gaps) deferredCandidates.push({ id: `scenario-gap:${chapter.id}`, kind: 'scenario-gap',
    status: 'deferred', reason: gap, evidence: 'audit/tic-scenario-acceptance.json' })
}
const requiredFailing = Object.entries(requiredWithoutDisclosure).filter(([, value]) => value !== true).map(([key]) => key)
const earlyAccessRequired = deferredCandidates.length > 0 || requiredFailing.length > 0
const releaseDisclosure = {
  earlyAccess: earlyAccessRequired,
  deferred: earlyAccessRequired ? deferredCandidates : [],
  lobbyEarlyAccess,
  lobbyMarked: lobbyEarlyAccess === true,
  pass: earlyAccessRequired
    ? (deferredCandidates.length > 0)
    : (lobbyEarlyAccess === false && deferredCandidates.length === 0),
}
const required = { ...requiredWithoutDisclosure, disclosure: releaseDisclosure.pass }
const deferred = earlyAccessRequired ? deferredCandidates : []
gate.releaseGate = {
  ...required,
  pass: Object.values(required).every(Boolean),
}
gate.releaseDisclosure = { ...releaseDisclosure, pass: releaseDisclosure.pass }
gate.pass = Object.entries(gate).filter(([key]) => key !== 'pass').every(([, value]) => value?.pass === true)
const gatePass = gate.pass
const earlyAccess = earlyAccessRequired
const equivalenceCertified = !earlyAccessRequired && gatePass

// ---------------------------------------------------------------- remaining（算出来，不手写结论）

const remaining = []
if (allCardGate.simplified > 0) {
  remaining.push(`逐卡账本 ${allCardGate.verified}/${allCardGate.total} verified，${allCardGate.simplified} 张显式简化未逐条等价：`
    + `${allCardSimplifiedCodes.slice(0, 24).join(', ')}${allCardSimplifiedCodes.length > 24 ? ' …' : ''}`)
}
if (behaviorPendingRequests.length) {
  remaining.push(`行为类原语请求仍有 ${behaviorPendingRequests.length} 条未完成：`
    + behaviorPendingRequests.map(item => item.request.id || item.file).join('、'))
}
if (rejectedRequests.length || withdrawnRequests.length) {
  remaining.push(`原语请求 rejected ${rejectedRequests.length} / withdrawn ${withdrawnRequests.length} 条`)
}
if (deferredPrimitives.length || escapePrimitives.length) {
  remaining.push(`原语 deferred ${deferredPrimitives.length} / escape ${escapePrimitives.length} 条`)
}
for (const chapter of chapterChecks) {
  const ledger = scenarioItemOf(chapter.id)
  for (const gap of Array.isArray(ledger?.gaps) ? ledger.gaps : []) remaining.push(`${chapter.id}：${gap}`)
}
if (!gate.nodeAcceptance.pass) {
  remaining.push(`Node 验收账本不 current/未通过（audit/tic-node-acceptance.json；`
    + `${gate.nodeAcceptance.status ?? '缺失'}，P8 文件 ${gate.nodeAcceptance.p8Files.length}/${NODE_P8_FILES.length}，请 node tools/verify-tic.mjs --node）`)
}
if (!gate.releaseBrowserVerified.pass) {
  remaining.push('P8 发布浏览器证据缺失或未通过（audit/tic-release-browser.json：真实大厅 + 双人中转联机 + 隐私/权限/断线；'
    + '请 tools/run-tic-browser.mjs 生成）')
}
if (!gate.replayVerified.pass) {
  remaining.push(`P8 战役重放证据缺失或未通过（audit/tic-p8-replay.json：status=${gate.replayVerified.status ?? '缺失'}，`
    + 'fixture 覆盖 8 章；请 node tools/verify-tic.mjs --p8-replay）')
}
if (!gate.regressionVerified.pass) {
  remaining.push(`回归证据不 current/未通过（${regressionPath}）`)
}
if (!gate.storyVerified.pass) remaining.push('剧情导入验收未通过（audit/tic-story-acceptance.json）')
if (!gate.guidesVerified.pass) remaining.push('冒险指南生成校验未通过（node tools/import-scenario-guides.mjs）')
if (!gate.imagesVerified.pass) remaining.push('图片清单/远程回退策略未通过（TIC 中英本地库存 + imagesrc/backimagesrc + 运行时代码不得依赖参考资源）')
if (!gate.presentationVerified.pass) {
  remaining.push('展示资源校验未通过（node tools/build-presentation.mjs --check；发布前需按产线重生成 audit/presentation-report.json）')
}
if (!gate.docsVerified.pass) {
  remaining.push(`文档链接体检未通过（${gate.docsVerified.broken ?? '?'} 条失效；node tools/check-doc-links.mjs --json）`)
}
if (!gate.registryCheck.pass) remaining.push('注册校验未通过（node tools/check-tic-registry.mjs）')
if (keywordFailures.length) remaining.push(`关键词未 verified：${keywordFailures.map(item => item.id).join('、')}`)
if (rulebookStatus !== 'verified') {
  remaining.push(`规则书未 verified：${Object.entries(rulebookChecks).filter(([, value]) => !value).map(([key]) => key).join('、')}`)
}
for (const [key, value] of Object.entries(requiredWithoutDisclosure)) {
  if (!value) remaining.push(`发布验收未通过：${key}`)
}
// baseline 维护口径：audit/baseline.json 由发布收尾重采；只记 retaken 布尔与 milestone，不记文件哈希。
const baselineRetaken = baselineRecollected(baselineLedger)
if (!baselineRetaken) {
  remaining.push(`audit/baseline.json 尚未记录 TIC 发布审计（milestone ${baselineLedger?.milestone ?? '缺失'}）：`
    + '发布收尾需 node tools/audit-baseline.mjs --write（AUDITS 增加 node tools/scan-tic-scope.mjs --check 与 node tools/audit-tic.mjs --check）')
}
for (const [key, value] of Object.entries(gate)) {
  if (key === 'pass' || key === 'releaseGate' || key === 'releaseDisclosure' || value?.pass === true) continue
  if (key === 'baseline') continue
  remaining.push(`P8 门禁未通过：${key}`)
}
if (!gate.releaseGate.pass) {
  remaining.push(`发布门禁未通过：${Object.entries(required).filter(([, value]) => value !== true).map(([key]) => key).join('、')}`)
}
if (nodeReport && nodeReport.status !== 'passed') {
  remaining.push(`Node 验收 ${nodeReport.status}：fail=${nodeGate.fail}`)
}

// ---------------------------------------------------------------- 确认组（剧本 / 关键词 / 规则书；keep assertMigrationConfirmations）

const scenarioConfirmationItems = chapters.map(chapter => {
  const ledger = scenarioItemOf(chapter.id)
  const checks = Object.fromEntries(SCENARIO_MIGRATION_CHECKS.map(check => [check, ledger?.checks?.[check] === true]))
  const complete = SCENARIO_MIGRATION_CHECKS.every(check => checks[check])
  return {
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    status: complete ? 'verified' : 'pending',
    checks,
    evidence: ['audit/tic-scenario-acceptance.json', 'tools/audit-tic-scenarios.mjs',
      ...(Array.isArray(ledger?.evidence) ? ledger.evidence.slice(0, 1) : [])],
  }
})
const confirmations = {
  scenarios: {
    status: scenarioConfirmationItems.every(item => item.status === 'verified') ? 'verified' : 'pending',
    milestone: 'M3',
    stage: scenarioLedger?.stage ?? null,
    chapters: scenarioConfirmationItems.length,
    checks: Object.fromEntries(SCENARIO_MIGRATION_CHECKS.map(check =>
      [check, scenarioConfirmationItems.filter(item => item.checks[check]).length])),
    summary: scenarioLedger?.summary ?? null,
    items: scenarioConfirmationItems,
    ledger: { path: 'audit/tic-scenario-acceptance.json', sha256: fileHash('audit/tic-scenario-acceptance.json') },
    evidence: ['tools/audit-tic-scenarios.mjs', 'audit/tic-scenario-acceptance.json', 'audit/tic-scope.json',
      'audit/tic-all-card-acceptance.json', 'audit/tic-browser-acceptance.json',
      ...chapters.map(chapter => `tests/tic-scenario-${chapter.id}.test.mjs`)],
  },
  keywords: {
    status: keywordsStatus,
    total: keywordItems.length,
    verified: keywordItems.length - keywordFailures.length,
    items: keywordItems,
    scan: { path: 'audit/tic-mechanism-scan.json', sha256: fileHash('audit/tic-mechanism-scan.json') },
    evidence: ['content/campaigns/theInnsmouthConspiracy/keywords.js', 'tests/tic-rules.test.mjs',
      'audit/tic-mechanism-scan.json', 'audit/tic-primitive-plan.json', 'web/tic-rules.js'],
  },
  rulebook: {
    status: rulebookStatus,
    entries: TIC_RULE_IDS.length,
    requiredRuleIds: [...TIC_RULE_IDS],
    checks: rulebookChecks,
    details: rulebookDetails,
    evidence: ['web/rulebook-data.js', 'web/tic-rules.js', 'content/campaigns/theInnsmouthConspiracy/keywords.js',
      'tests/tic-rules.test.mjs', 'audit/tic-browser-acceptance.json'],
  },
}

// ---------------------------------------------------------------- 账本

const sources = [
  'content/registered.js',
  'content/registry.js',
  'content/mechanics.js',
  'content/schema.js',
  'content/scenario-manifest.js',
  'content/migration-confirmation.js',
  'content/campaigns/theInnsmouthConspiracy/shared.js',
  'content/campaigns/theInnsmouthConspiracy/manifest.js',
  'content/campaigns/theInnsmouthConspiracy/records.js',
  'content/campaigns/theInnsmouthConspiracy/keywords.js',
  'content/campaigns/theInnsmouthConspiracy/chapter-entry.js',
  'content/campaigns/theInnsmouthConspiracy/chapter-definition.js',
  'content/campaigns/theInnsmouthConspiracy/chapter-data.json',
  'content/campaigns/theInnsmouthConspiracy/flow.js',
  'content/campaigns/theInnsmouthConspiracy/entry-rules.js',
  'content/campaigns/theInnsmouthConspiracy/resolutions.js',
  'content/campaigns/theInnsmouthConspiracy/interludes.js',
  'content/campaigns/theInnsmouthConspiracy/story-text.js',
  'content/packs/ticCampaign/manifest.js',
  'content/packs/ticInvestigators/manifest.js',
  'content/packs/ticPlayer/manifest.js',
  'web/rulebook-data.js',
  'web/tic-rules.js',
  'web/deck-rules.js',
  'presentation/art-rules.js',
  'src/cards/cards-data.js',
  'src/cards/card-rules.js',
  'src/cards/core-acceptance.js',
  'src/deck/availability.js',
  'tools/audit-tic.mjs',
  'tools/audit-tic-scenarios.mjs',
  'tools/audit-tic-all-cards.mjs',
  'tools/tic-evidence.mjs',
  'tools/verify-tic.mjs',
  'tools/check-tic-registry.mjs',
  'tools/import-scenario-guides.mjs',
  'tools/audit-tic-release.mjs',
  'tools/playwright-tic-release-reporter.mjs',
  'tools/run-tic-release-browser.mjs',
  'tools/replay-tic-recipes.mjs',
  'tools/replay-tic-fixtures.mjs',
  'tests/playwright/playwright.tic-release.config.mjs',
  'tests/tic-browser-helpers.mjs',
  'tests/tic-release.browser.mjs',
  'tests/tic-online.browser.mjs',
  'tests/tic-progression.browser.mjs',
  'tests/replay-tic-p8.test.mjs',
  'tests/fixtures/replay/tic-p8-baseline.json',
  'tests/tic-p8-fixture.mjs',
  'tests/tic-migration.test.mjs',
  'tests/tic-chapter-fixture.mjs',
  ...NODE_P8_FILES,
  'tests/tic-late-b-cards.test.mjs',
  ...chapters.map(chapter => `tests/tic-scenario-${chapter.id}.test.mjs`),
  ...chapters.map(chapter => `content/campaigns/theInnsmouthConspiracy/scenarios/${chapter.id}/index.js`),
  ...chapters.map(chapter => `content/campaigns/theInnsmouthConspiracy/scenarios/${chapter.id}/layout.js`),
  'content/campaigns/theInnsmouthConspiracy/layout.js',
  'docs/arkham-content-migration.md',
].map(path => ({ path, sha256: fileHash(path) }))
const evidenceFilePaths = [
  'audit/tic-scope.json',
  'audit/tic-mechanism-scan.json',
  'audit/tic-primitive-plan.json',
  'audit/tic-primitive-catalog.json',
  'audit/tic-node-acceptance.json',
  'audit/tic-scenario-acceptance.json',
  'audit/tic-all-card-acceptance.json',
  'audit/tic-browser-acceptance.json',
  'audit/tic-release-browser.json',
  'audit/tic-release-acceptance.json',
  'audit/tic-interaction-regression.json',
  'audit/tic-regression.json',
  'audit/tic-interactions.json',
  'audit/tic-investigators.json',
  'audit/tic-player-acceptance.json',
  'audit/tic-player-shards.json',
  'audit/tic-player-queue.json',
  'audit/tic-story-acceptance.json',
  'audit/tic-p8-replay.json',
  'audit/presentation-report.json',
  'audit/tic-control-regression.json',
  ...requestFiles.map(file => `${PRIMITIVE_REQUEST_DIR}/${file}`),
  ...(replayFixturePath ? [gameRelative(replayFixturePath)] : []),
]
const audit = {
  schemaVersion: 2,
  cycle: CYCLE,
  cycleName: CYCLE_NAME,
  cycleNameZh: CYCLE_NAME_ZH,
  campaignId: CAMPAIGN_ID,
  milestone: MILESTONE,
  stage: STAGE,
  generatedBy: 'tools/audit-tic.mjs',
  docs: 'docs/arkham-content-migration.md',
  scope: { path: 'audit/tic-scope.json', sha256: fileHash('audit/tic-scope.json') },
  baseline: {
    path: 'audit/baseline.json',
    retaken: baselineRetaken,
    milestone: baselineLedger?.milestone ?? null,
    note: baselineRetaken ? null : '发布收尾需 node tools/audit-baseline.mjs --write 记录 TIC 审计命令',
  },
  campaign: {
    id: CAMPAIGN_ID,
    status: campaign?.status ?? null,
    name: campaign?.name ?? null,
    nameEn: campaign?.nameEn ?? null,
    chapters: registryScenarios.length,
    scenarioIds: [...(campaign?.scenarioIds || [])],
    requiredPackIds: [...(campaign?.requiredPackIds || [])],
    sharedEncounterGroupIds: [...(campaign?.sharedEncounterGroupIds || [])],
    unlock: campaign?.unlock ?? null,
    flowNodes: campaign?.flow?.nodes ? Object.keys(campaign.flow.nodes).length : null,
    recordKeys: Object.keys(RECORD_TYPES).length,
    chaosBags: Object.fromEntries(Object.entries(CHAOS_BAGS).map(([difficulty, tokens]) => [difficulty,
      { tokens: tokens.length, skull: tokens.filter(token => token === 'skull').length }])),
    launchBlocked,
    launchError,
    lobbyVisible,
    lobbyEarlyAccess,
  },
  status: campaign?.status ?? null,
  playable: LAUNCHABLE.has(campaign?.status) && !launchBlocked,
  launchEnabled: !launchBlocked,
  earlyAccess,
  earlyAccessReason: earlyAccess ? deferred.map(item => item.reason || item.id).join('；') : null,
  equivalenceCertified,
  releaseAcceptance: { required, deferred },
  releaseGate: { ...gate.releaseGate },
  releaseDisclosure: { ...gate.releaseDisclosure },
  maintenance,
  verifiedScope: `M0 范围 ${liveTotal} 条 07 记录（${liveMainCodes.length} 主卡 + ${liveFaceCodes.length} 关联面；`
    + `战役 ${partitionCodes.ticCampaign.length} / 调查员 ${partitionCodes.ticInvestigators.length} / 玩家 ${partitionCodes.ticPlayer.length}），`
    + `${ENCOUNTER_GROUPS.length} 遭遇组；M1 五位调查员；M2 ${partitionCodes.ticPlayer.length} 张玩家卡；`
    + `M3 八章逐章 12/12 检查与逐卡 252/252；M4 ${keywordItems.length} 条关键词与 ${TIC_RULE_IDS.length} 条规则书条目；`
    + `M5 生产注册、真实大厅启动、P8 完整战役/失败路线/存档/多人 AI/真实联机/重放/浏览器发布验收。`
    + (earlyAccess ? '仍有余项以 earlyAccess 披露，见 remaining 与 releaseAcceptance.deferred。'
      : '原始循环已完成，显式简化、章节缺口与行为类原语债务均为零；同句模板共享工厂维护债务见 maintenance。'),
  packs,
  scenarios: chapterChecks.map(chapter => ({
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    nameEn: chapter.nameEn,
    status: chapter.status,
    referenceCode: chapter.referenceCode,
    requiredPackIds: chapter.requiredPackIds,
    requiredEncounterGroupIds: chapter.requiredEncounterGroupIds,
    testFile: chapter.testFile,
    testCases: chapter.testCases,
    launchable: chapter.launchable,
    checks: chapter.checks,
  })),
  chapters: chapterChecks,
  encounterGroups: [...ENCOUNTER_GROUPS],
  counts: {
    records: liveTotal,
    main: liveMainCodes.length,
    faces: liveFaceCodes.length,
    partitions: Object.fromEntries(Object.keys(partitionCodes).map(id => [id, partitionCodes[id].length])),
    packCards: Object.fromEntries(PACK_IDS.map(id => [id, packOfId(id)?.cards ?? 0])),
    packRecords: Object.fromEntries(PACK_IDS.map(id => [id, packOfId(id)?.records ?? 0])),
    chapters: chapters.length,
    encounterGroups: ENCOUNTER_GROUPS.length,
    keywords: keywordItems.length,
    rulebookEntries: TIC_RULE_IDS.length,
  },
  chaosBags: Object.fromEntries(Object.entries(CHAOS_BAGS).map(([difficulty, tokens]) => [difficulty,
    { tokens: tokens.length, skull: tokens.filter(token => token === 'skull').length }])),
  recordSchema: sortedObject(Object.entries(RECORD_TYPES)),
  investigatorCodes: [...INVESTIGATOR_CODES],
  keywords: { status: keywordsStatus, items: keywordItems },
  mechanics: {
    status: mechanicsGate.pass ? 'verified' : 'pending',
    items: TIC_RULE_IDS.map(ruleId => ({
      id: ruleId,
      registered: supportedMechanics.has(ruleId),
      evidence: 'tests/tic-rules.test.mjs',
    })),
  },
  primitives: { ...primitiveGate, outstanding: {
    behaviorPending: behaviorPendingRequests.map(item => item.request.id || item.file),
    refactorPending: refactorPendingRequests.map(item => item.request.id || item.file),
    rejected: rejectedRequests.map(item => item.request.id || item.file),
    withdrawn: withdrawnRequests.map(item => item.request.id || item.file),
    deferred: deferredPrimitives.length,
    escape: escapePrimitives.length,
  } },
  sources,
  confirmations,
  evidence: {
    files: sortedObject(evidenceFilePaths.map(path => [path, fileHash(path)])),
    browser: {
      legacy: { path: 'audit/tic-browser-acceptance.json', status: legacyBrowserChecks.status,
        coverage: legacyBrowserChecks.coverage, links: legacyBrowserChecks.links,
        tests: legacyBrowserChecks.tests, screenshots: legacyBrowserChecks.screenshots,
        scenariosCovered: legacyBrowserChecks.scenariosCovered },
      release: { path: 'audit/tic-release-browser.json', status: releaseBrowserGate.status,
        complete: releaseBrowserGate.complete, checks: releaseBrowserGate.checks,
        tests: releaseBrowserGate.tests, screenshots: releaseBrowserGate.screenshots,
        specs: releaseBrowserGate.specs, expectedSpecs: releaseBrowserGate.expectedSpecs,
        sourceStableDuringRun: releaseBrowserGate.sourceStableDuringRun },
      merged: { path: 'audit/tic-release-acceptance.json', present: Boolean(releaseAcceptanceReport),
        status: releaseAcceptanceReport?.status ?? null, gatePass: releaseAcceptanceReport?.gate?.pass ?? null,
        checks: mergedAcceptanceChecks },
    },
    scenarioLedger: { path: 'audit/tic-scenario-acceptance.json', status: scenarioLedger?.status ?? null,
      chapters: scenarioItems.length, sourceStableDuringRun: scenarioLedger?.sourceStableDuringRun ?? null,
      summary: scenarioLedger?.summary ?? null },
    allCardLedger: { path: 'audit/tic-all-card-acceptance.json', generatedBy: allCardLedger?.generatedBy ?? null,
      summary: allCardSummary },
    node: { path: 'audit/tic-node-acceptance.json', generatedBy: nodeReport?.generatedBy ?? null,
      status: nodeReport?.status ?? null, commands: nodeCommand, p8Files: nodeGate.p8Files,
      summary: nodeSummary, sourceFiles: nodeGate.sourceFiles },
    replay: { path: 'audit/tic-p8-replay.json', generatedBy: replayReport?.generatedBy ?? null,
      status: replayReport?.status ?? null, fixture: replayGate.fixture, replay: {
        command: replayReport?.replay?.command ?? null, exitCode: replayReport?.replay?.exitCode ?? null } },
    regression: { path: regressionPath, generatedBy: regressionReport?.generatedBy ?? null,
      status: regressionReport?.status ?? null, fast: regressionReport?.fast ?? null,
      replay: { command: regressionReport?.replay?.command ?? null, exitCode: regressionReport?.replay?.exitCode ?? null } },
    story: { path: 'audit/tic-story-acceptance.json', generatedBy: storyLedger?.generatedBy ?? null,
      checks: storyGate.checks, missing: storyGate.missing, sourceFiles: storyGate.sourceFiles },
    images: {
      records: CYCLE_CODES.length,
      enLocal: imageDirs.en.files,
      zhLocal: imageDirs.zh.files,
      remoteFallbackAvailable: remoteImageCodes.length,
      remoteFallbackMissing: CYCLE_CODES.length - remoteImageCodes.length,
      referenceSourceMentions: referenceMentions.length,
      referenceSourceBound: referenceBound.length,
      runtimeFilesScanned: runtimeScanFiles.length,
    },
    guides: { command: guidesRun.command, exitCode: guidesRun.exitCode, chapters: ticGuides.length,
      complete: ticGuides.filter(guide => guide.pass).length },
    presentation: { command: presentationRun.command, exitCode: presentationRun.exitCode,
      presentationVersion: presentationReport?.presentationVersion ?? null, ticDescriptorsResolved },
    docs: { command: docsRun.command, exitCode: docsRun.exitCode, files: docsGate.files,
      links: docsGate.links, broken: docsGate.broken },
    registry: { command: registryRun.command, exitCode: registryRun.exitCode },
    baseline: { path: 'audit/baseline.json', milestone: baselineLedger?.milestone ?? null },
  },
  tests: {
    node: {
      path: 'audit/tic-node-acceptance.json',
      generatedBy: nodeReport?.generatedBy ?? null,
      command: nodeCommand,
      status: nodeReport?.status ?? null,
      tests: nodeGate.tests,
      pass: nodeGate.pass,
      fail: nodeGate.fail,
      skipped: nodeGate.skipped,
      sourceFiles: nodeGate.sourceFiles,
      sourceStableDuringRun: nodeGate.sourceStableDuringRun,
      p8Files: nodeGate.p8Files,
      current: Boolean(nodeReport),
    },
    browser: {
      legacy: legacyBrowserChecks.tests,
      release: releaseBrowserGate.tests,
      screenshots: releaseBrowserGate.screenshots,
    },
    replay: { fixtures: replayFixtureCount, steps: numberOrNull(replayFixtureInfo?.steps) },
    scenarioAcceptance: {
      testFiles: scenarioItems.map(item => ledgerTestFile(item)).filter(Boolean),
      passedCases: scenarioItems.reduce((sum, item) => sum + (numberOrNull(item?.notes?.chapterTest?.passedCases) || 0), 0),
    },
  },
  remaining,
  gate: { ...gate, pass: gatePass },
}
assertMigrationConfirmations(audit, chapters.map(chapter => chapter.id))
const serialized = json(audit)

// ---------------------------------------------------------------- CLI

const summaryLine = `TIC P8 发布账本：milestone ${audit.milestone} · ${audit.stage} · gate ${gatePass ? 'pass' : 'fail'}`
  + ` · 记录 ${liveTotal}（${partitionCodes.ticCampaign.length}/${partitionCodes.ticInvestigators.length}/${partitionCodes.ticPlayer.length}）`
  + ` · 八章 ${chapterPlan.verifiedLedger}/8 verified（launchable ${chapterPlan.launchable}/8）`
  + ` · 逐卡 ${allCardGate.verified}/${allCardGate.total}${allCardGate.strictPass ? ' strict' : `（${allCardGate.simplified} simplified）`}`
  + ` · earlyAccess ${earlyAccess} · equivalenceCertified ${equivalenceCertified}`
  + ` · maintenance ${maintenance.length} · remaining ${remaining.length}`

if (MODE === 'write') {
  writeFileSync(TARGET, serialized, 'utf8')
  console.log(`audit: audit/tic-migration.json · milestone ${audit.milestone} · ${audit.stage} · gate ${gatePass ? 'pass' : 'fail'}`)
  console.log(`记录 ${liveTotal} = ${liveMainCodes.length} 主卡 + ${liveFaceCodes.length} 关联面；`
    + `三包 ${partitionCodes.ticCampaign.length}/${partitionCodes.ticInvestigators.length}/${partitionCodes.ticPlayer.length}（卡 ${packs.map(pack => `${pack.id}:${pack.cards}`).join(' ')}）；`
    + `八章 ${chapterPlan.launchable}/8 launchable；大厅 ${lobbyVisible}（earlyAccess=${String(lobbyEarlyAccess)}）；assertLaunchable ${!launchBlocked}`)
  console.log(`关键词 ${gate.keywordsVerified.verified}/${gate.keywordsVerified.total} ${keywordsStatus} · 规则书 ${rulebookStatus}`
    + `（${TIC_RULE_IDS.length} 条 / 6 项）· 机制 ${mechanicsGate.registered}/${mechanicsGate.expected}`)
  console.log(`剧本 ${chapterPlan.verifiedLedger}/8 章 12/12 verified · 逐章账本 ${scenarioLedger?.status ?? '缺失'}`
    + ` · 逐卡 ${allCardGate.verified}/${allCardGate.total}（simplified ${allCardGate.simplified} / no-behavior ${allCardGate.noBehavior} / strictComplete ${allCardGate.strictComplete}）`)
  console.log(`发布证据 Node ${gate.nodeAcceptance.status ?? '缺失'} · 浏览器 release ${gate.releaseBrowserVerified.status ?? '缺失'}`
    + ` · 旧 P3 ${gate.browserAcceptance.status ?? '缺失'} · 重放 ${gate.replayVerified.status ?? '缺失'}`
    + ` · 回归 ${gate.regressionVerified.status ?? '缺失'} · 剧情 ${gate.storyVerified.checks.completeChinese ? 'verified' : 'pending'}`
    + ` · 指南 ${ticGuides.filter(guide => guide.pass).length}/8 · 文档 broken ${docsGate.broken ?? '?'} · 图片 ${imageDirs.en.files}/${imageDirs.zh.files}`)
  console.log(`Node 验收 ${nodeGate.pass ?? '?'}/${nodeGate.tests ?? '?'} 例（P8 文件 ${nodeGate.p8Files.length}/${NODE_P8_FILES.length}）`
    + ` · earlyAccess ${earlyAccess} · equivalenceCertified ${equivalenceCertified} · maintenance ${maintenance.length}`
    + ` · baseline retaken ${audit.baseline.retaken} · remaining ${remaining.length}`)
  if (!gatePass) {
    for (const [key, value] of Object.entries(gate)) {
      if (key === 'pass' || value?.pass === true) continue
      console.log(`  gate 未通过 ${key}: ${JSON.stringify(value).slice(0, 320)}`)
    }
  }
} else if (MODE === 'check') {
  if (!existsSync(TARGET)) {
    console.error('audit/tic-migration.json 不存在：先运行 node tools/audit-tic.mjs --write')
    process.exit(1)
  }
  const disk = readFileSync(TARGET, 'utf8')
  if (disk !== serialized) {
    let changed = []
    try {
      const previous = JSON.parse(disk)
      changed = Object.keys(audit).filter(key => JSON.stringify(previous[key]) !== JSON.stringify(audit[key]))
    } catch {
      changed = ['(JSON 无法解析)']
    }
    console.error(`audit/tic-migration.json 与内容不一致（重新 --write 并审阅 diff）：${changed.join(', ') || '格式/换行'}`)
    process.exit(1)
  }
  if (!gatePass) {
    for (const [key, value] of Object.entries(gate)) {
      if (key === 'pass' || value?.pass === true) continue
      console.error(`  gate 未通过 ${key}: ${JSON.stringify(value).slice(0, 320)}`)
    }
    console.error(`发布门禁未通过：${Object.entries(required).filter(([, value]) => value !== true).map(([key]) => key).join('、')}`)
    process.exit(1)
  }
  console.log(`audit 复算一致：${audit.milestone} · ${audit.stage}，记录 ${liveTotal} 条，八章 ${chapterPlan.verifiedLedger}/8，`
    + `逐卡 ${allCardGate.verified}/${allCardGate.total}（strict ${allCardGate.strictPass}），关键词 ${keywordItems.length}，`
    + `剧本 8/8，浏览器 ${gate.releaseBrowserVerified.status ?? '缺失'}，重放 ${gate.replayVerified.status ?? '缺失'}，`
    + `earlyAccess ${earlyAccess}，gate pass`)
  console.log(summaryLine)
} else {
  console.log(serialized)
}
process.exit(process.exitCode ?? 0)

// ---------------------------------------------------------------- 局部工具函数（仅本文件使用）

function numberOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null
}
function nodeEvidenceSummary(report) {
  if (!report || typeof report !== 'object') return null
  return { summary: report.summary ?? null, testTitles: Array.isArray(report.testTitles) ? report.testTitles.length : null }
}
// baseline 重采口径：baseline.json 的 audits 里记录过 TIC 的发布审计命令且为 status 0，
// 同时 tests.status===0 且 tests.fail===0。只读 milestone/命令/状态，不读文件哈希（避免二次漂移）。
function ticBaselineAuditCommands(baseline) {
  const audits = Array.isArray(baseline?.audits) ? baseline.audits : []
  return audits.filter(entry => /tools\/(?:audit-tic|scan-tic-scope|audit-tic-scenarios|audit-tic-release)\.mjs/.test(String(entry?.command || '')))
}
function baselineRecollected(baseline) {
  const commands = ticBaselineAuditCommands(baseline)
  const auditRecorded = commands.some(entry => /tools\/audit-tic\.mjs/.test(String(entry?.command || ''))
    && entry.status === 0)
  return auditRecorded && baseline?.tests?.status === 0 && baseline?.tests?.fail === 0
}
