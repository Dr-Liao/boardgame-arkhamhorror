#!/usr/bin/env node
// 八循环《绯红密钥》（The Scarlet Keys）P0 基线：把「起始提交 + 规则/状态版本 + 能力层指标 +
// R1/R2/R3 合规基线 + 既有 fast 失败 + golden replay 指纹」固化成一份可复算的快照。
//
// 用法（在 games/arkhamhorror/ 执行）：
//   node tools/scan-tsk-baseline.mjs --write   生成 audit/tsk-baseline.json，并镜像到大厅运行目录
//   node tools/scan-tsk-baseline.mjs --check   复算并校验（版本/来源哈希/合规/指标/replay 漂移即失败）
//   node tools/scan-tsk-baseline.mjs           只打印 JSON，不写盘
//
// 口径（与 audit/tic-baseline.json、audit/eote-baseline.json 一致）：
// - 不记录时间戳、Node 版本、机器信息等易变字段，--write 两次必须逐字节相同；
// - gitHead 固定记录 P0 起始提交而不是当前 HEAD：P0 之后的提交会推进 HEAD，基线要能长期复算；
// - fastFailures 只冻结 P0 开始前就存在的失败标题（按标题），本循环工作引入的失败不得写入；
// - replay 基线在任何 TSK 行为改动之前采集，--check 用 replay-fixtures.mjs --compare 重放证明行为零变化。
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { RULES_VERSION, STATE_SCHEMA_VERSION } from '../src/engine/rules-state.js'
import { MOD, RUN, json, readJson, sha, sourceLock } from './tsk-migration-lib.mjs'

const BASELINE_FILE = 'audit/tsk-baseline.json'
const REPLAY_FILE = 'tests/fixtures/replay/tsk-baseline.json'
const ABILITY_COVERAGE_FILE = 'audit/ability-coverage.json'
const COMPLIANCE_FILE = 'audit/card-entry-compliance.json'
const RUN_MIRROR = join(RUN, 'tsk-baseline.json')

// P0 起始提交：P0 开始时 `git rev-parse HEAD` 即该值（会话开始时工作区带既有删除改动，见 worktree）。
// 不随 HEAD 推进而变；--check 只校验 40 位十六进制格式，不要求当前 HEAD 与它相同。
const P0_START_HEAD = 'fb7d53618b36bf348c6613824ca8e180f79a8b68'

// P0 开始前（任何 TSK 改动落地之前）就存在的 fast 失败：按测试标题冻结，不修、不洗白。
// 证据：artifacts/migration/tsk/reports/fast-baseline.log（7056 tests / 7049 pass / 4 fail，
// 2026-11-10 会话起始控制跑；日志 sha256 = FAST_LOG_SHA256）。
//   - 两条 EotE 账本确定性失败：工作区既有 `docs/edgeOfTheEarth/**` 46 个文件被删除（未提交），
//     构建器引用的证据文件缺失 → eote all-cards / migration ledger 两条失败；
//   - 一条 UI 本地化既有失败：`web/music-player.js` 的音乐 mood 中文串（跨循环既有）；
//   - 一条 TCU 来源漂移既有失败：`scope.json 与来源不一致`（TCU 账本工作区既有漂移）。
const FAST_FAILURES = [
  'P8 eote all-cards 两次构建一致且与账本一致',
  'P8 eote migration ledger · 确定性：导出 builder 两次深相等且与签入账本一致',
  '已本地化的 UI 文件不再残留用户可见中文',
  'P1 账本：scope.json 与 audit/tcu-migration.json 可复算且 gate 一致',
].sort()

// 采集证据：node tools/run-tests.mjs fast > ../../artifacts/migration/tsk/reports/fast-baseline.log 2>&1
// （日志在运行目录，不签入；sha256 由该次采集固定，--check 不重跑 fast，避免把测试耗时写进门禁；
//   --check 只在日志文件存在时复核该哈希，干净检出缺少忽略文件时跳过。）
const FAST_LOG_RELATIVE = 'artifacts/migration/tsk/reports/fast-baseline.log'
const FAST_LOG_FILE = join(RUN, 'reports/fast-baseline.log')
const FAST_LOG_SHA256 = '7c46665bb8b2bd1d406d62c4b81aed9eca122bf334e9d7d44386719d7121a321'

// 与 audit/tic-baseline.json、audit/eote-baseline.json 相同的 12 项能力层指标，顺序固定便于逐字节复算。
const ARCHITECTURE_METRIC_KEYS = [
  'engineCodes', 'effectsEntries', 'effectsTopLevelFields', 'escapeCards',
  'descriptorEntries', 'descriptorAbilities', 'abilityKinds', 'windows',
  'effectPrimitives', 'nonPlayerCards', 'behaviorLines', 'declaredScenarios',
]

// P0 起始时工作区已有改动：46 个 docs/edgeOfTheEarth/** 被删除（未提交，git status -uall 记录）。
// 这是 P0 之前就存在的脏改动，迁移工作不修复、不恢复、也不据此重写其他循环的账本。
const WORKTREE = Object.freeze([
  ' D docs/edgeOfTheEarth/README.md',
  ' D docs/edgeOfTheEarth/full-scan.md',
  ' D docs/edgeOfTheEarth/interactions.md',
  ' D docs/edgeOfTheEarth/investigators.md',
  ' D docs/edgeOfTheEarth/media.md',
  ' D docs/edgeOfTheEarth/p8-release.md',
  ' D docs/edgeOfTheEarth/player-cards.md',
  ' D docs/edgeOfTheEarth/primitives.md',
  ' D docs/edgeOfTheEarth/scenarios.md',
  ' D docs/edgeOfTheEarth/translate/README.md',
  ' D docs/edgeOfTheEarth/translate/_SPEC.md',
  ' D docs/edgeOfTheEarth/translate/cards/_dump.md',
  ' D docs/edgeOfTheEarth/translate/cards/findings.json',
  ' D docs/edgeOfTheEarth/translate/cards/fix-report.md',
  ' D docs/edgeOfTheEarth/translate/cards/notes.md',
  ' D docs/edgeOfTheEarth/translate/crosscheck/cards.json',
  ' D docs/edgeOfTheEarth/translate/crosscheck/coverage.json',
  ' D docs/edgeOfTheEarth/translate/crosscheck/guides.json',
  ' D docs/edgeOfTheEarth/translate/crosscheck/shipped.json',
  ' D docs/edgeOfTheEarth/translate/crosscheck/story.json',
  ' D docs/edgeOfTheEarth/translate/crosscheck/summary.json',
  ' D docs/edgeOfTheEarth/translate/findings.json',
  ' D docs/edgeOfTheEarth/translate/fix-batch.md',
  ' D docs/edgeOfTheEarth/translate/guides/coverage.json',
  ' D docs/edgeOfTheEarth/translate/guides/findings.json',
  ' D docs/edgeOfTheEarth/translate/guides/fix-report.md',
  ' D docs/edgeOfTheEarth/translate/guides/notes.md',
  ' D docs/edgeOfTheEarth/translate/story/coverage.json',
  ' D docs/edgeOfTheEarth/translate/story/findings.json',
  ' D docs/edgeOfTheEarth/translate/story/fix-report.md',
  ' D docs/edgeOfTheEarth/translate/story/notes.md',
  ' D docs/edgeOfTheEarth/translate/terms/findings.json',
  ' D docs/edgeOfTheEarth/translate/terms/fix-report.md',
  ' D docs/edgeOfTheEarth/translate/terms/glossary.json',
  ' D docs/edgeOfTheEarth/translate/terms/glossary.md',
  ' D docs/edgeOfTheEarth/translate/terms/notes.md',
  ' D docs/edgeOfTheEarth/translate/terms/scan-report.json',
  ' D docs/edgeOfTheEarth/translate/tools/cards-scan.mjs',
  ' D docs/edgeOfTheEarth/translate/tools/guides-scan.mjs',
  ' D docs/edgeOfTheEarth/translate/tools/lead-crosscheck.mjs',
  ' D docs/edgeOfTheEarth/translate/tools/merge-findings.mjs',
  ' D docs/edgeOfTheEarth/translate/tools/regen-eote-replay-baseline.mjs',
  ' D docs/edgeOfTheEarth/translate/tools/story-scan.mjs',
  ' D docs/edgeOfTheEarth/translate/tools/terms-scan.mjs',
  ' D docs/edgeOfTheEarth/translate/tools/verify-fix-batch.mjs',
].map(line => line.replaceAll('\\', '/')).sort())

const REFERENCE_COMMIT_NOTE = [
  'gitHead 记录 P0 起始提交，而不是快照生成时的 HEAD：P0 之后的提交会推进 HEAD，基线要能长期复算。',
  'P0 开始时工作区不是干净检出：docs/edgeOfTheEarth/** 46 个文件处于未提交删除状态（见 worktree），'
    + '这是 P0 之前就存在的脏改动，迁移工作不恢复、不修复，也不据此重写其他循环的账本。',
  '既有失败按测试标题冻结，只用于区分「P0 之前就失败」与「本循环新增失败」，不修、不洗白。',
  'golden replay 基线在任何 TSK 行为改动之前采集；此后并发的工作区改动只用于控制跑（control run），不得重写本基线。',
].join('\n')

const PRE_EXISTING_FAILURES = Object.freeze({
  files: ['tests/eote-all-cards.test.mjs', 'tests/eote-migration-ledger.test.mjs', 'tests/i18n-dict.test.mjs', 'tests/tcu-migration.test.mjs'],
  command: 'node tools/run-tests.mjs fast',
  evidence: FAST_LOG_RELATIVE,
  note: '2026-11-10 P0 起始控制跑 7056 tests / 7049 pass / 4 fail（sha256=' + FAST_LOG_SHA256 + '）。'
    + '两条 EotE 失败源于 P0 前工作区已有的 docs/edgeOfTheEarth/** 删除（证据文件缺失），'
    + '一条 UI 本地化既有失败（web/music-player.js），一条 TCU scope 来源漂移；均不修、不计为本轮新增失败。',
  // fast tier 之外、README §7 门禁里 P0 前就失败的既有命令：同样不修、不动其他循环账本，只如实登记。
  otherCommands: [
    {
      command: 'npm run docs:check',
      result: '7 条失效链接（238 条中）',
      cause: '7 条全部指向 P0 前已存在的未提交删除 docs/edgeOfTheEarth/**；P0 未改动这些文档，也不恢复该删除。',
      evidence: 'artifacts/migration/tsk/reports/docs-check.log',
    },
    {
      command: 'npm run presentation:check',
      result: 'drift: audit/presentation-report.json',
      cause: 'P0 前 web/** 产物哈希已与签入的展示报告漂移（与 TSK 卡池/注册无关）；P0 不重签展示报告。',
      evidence: 'artifacts/migration/tsk/reports/presentation-check.log',
    },
    {
      command: 'npm run audit:check',
      result: 'audit-resources validation failed（baseline-drift）',
      cause: 'N0 资源基线 audit/migration-scope.json 本身早已漂移（targetCodes 815→5930 等）；与 TSK 无关，P0 不重签资源基线。',
      evidence: 'artifacts/migration/tsk/reports/audit-check.log',
    },
  ],
})

const fail = message => {
  throw new Error(message)
}
const parseJsonBytes = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const lastLine = text => (String(text || '').trim().split(/\r?\n/).filter(Boolean).pop() || '').slice(0, 400)

const currentHead = () => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: MOD, encoding: 'utf8' })
  return result.status === 0 ? String(result.stdout || '').trim() : null
}

// 快照纯函数：只读当前仓库事实（版本、审计账本、replay 文件）与 P0 冻结常量，不写盘、不含时间戳。
export function buildBaseline() {
  const ability = readJson(join(MOD, ABILITY_COVERAGE_FILE))
  const compliance = readJson(join(MOD, COMPLIANCE_FILE))
  const replayBytes = readFileSync(join(MOD, REPLAY_FILE))
  const replay = parseJsonBytes(replayBytes)
  const metrics = ability.metrics || {}
  const missingMetrics = ARCHITECTURE_METRIC_KEYS.filter(key => !Number.isInteger(metrics[key]))
  if (missingMetrics.length) {
    fail(`${ABILITY_COVERAGE_FILE} 缺少能力层指标：${missingMetrics.join(', ')}；先运行 node tools/audit-abilities.mjs --write`)
  }
  if (!compliance.baseline || !Array.isArray(compliance.baseline.directStateWrite)) {
    fail(`${COMPLIANCE_FILE} 缺少 baseline.directStateWrite；先运行 node tools/audit-card-entry-compliance.mjs --write`)
  }

  const architectureMetrics = Object.fromEntries(ARCHITECTURE_METRIC_KEYS.map(key => [key, metrics[key]]))
  const replaySummary = replay.fixtures.map(fixture => ({
    id: fixture.id,
    moves: Number(fixture.log?.meta?.moveCount ?? fixture.log?.moves?.length ?? -1),
    hashes: fixture.hashes.length,
  }))

  return {
    schemaVersion: 1,
    cycle: 'tsk',
    campaignId: 'theScarletKeys',
    gitHead: P0_START_HEAD,
    rulesVersion: RULES_VERSION,
    stateSchemaVersion: STATE_SCHEMA_VERSION,
    // 与 audit/tic-baseline.json、audit/eote-baseline.json 同名的四项能力层计数（减少是一次迁移证据）。
    engineCardLiterals: metrics.engineCodes,
    effectEntries: metrics.effectsEntries,
    effectsTopLevelFields: metrics.effectsTopLevelFields,
    escapeCards: metrics.escapeCards,
    // R1（直写状态）/ R2（重印双实现）/ R3（回合限制缺失）基线：只减不增。
    complianceBaseline: JSON.parse(JSON.stringify(compliance.baseline)),
    fastFailures: [...FAST_FAILURES],
    fastLogFile: FAST_LOG_RELATIVE,
    fastLogSha256: FAST_LOG_SHA256,
    // P0 开始时工作区带既有删除改动：逐条冻结，不修复、不恢复。
    worktree: [...WORKTREE],
    replayFile: REPLAY_FILE,
    replaySha256: sha(replayBytes),
    replaySummary,
    architectureMetrics,
    preExistingFailures: JSON.parse(JSON.stringify(PRE_EXISTING_FAILURES)),
    referenceCommitNote: REFERENCE_COMMIT_NOTE,
  }
}

const totalReplaySteps = report => report.replaySummary.reduce((sum, fixture) => sum + fixture.moves, 0)

const baselinePath = join(MOD, BASELINE_FILE)

function writeBaseline() {
  const report = buildBaseline()
  mkdirSync(dirname(baselinePath), { recursive: true })
  writeFileSync(baselinePath, json(report))

  // 运行镜像只做副本，不参与 --check；大厅根目录 artifacts/ 默认忽略，不签入。
  mkdirSync(RUN, { recursive: true })
  writeFileSync(RUN_MIRROR, json(report))

  const head = currentHead()
  if (head && head !== P0_START_HEAD) {
    console.error(`提示：当前 HEAD ${head} 不是 P0 起始提交；gitHead 仍固定记录 ${P0_START_HEAD}。`)
  }
  console.log(`tsk baseline: 已写入 ${BASELINE_FILE}（镜像 ${RUN_MIRROR}）；`
    + `replay ${report.replaySummary.length} 局 / ${totalReplaySteps(report)} 步；`
    + `fastFailures ${report.fastFailures.length} 条；指标 ${ARCHITECTURE_METRIC_KEYS.length} 项`)
}

function checkBaseline() {
  if (!existsSync(baselinePath)) {
    fail(`${BASELINE_FILE} 不存在；先运行 node tools/scan-tsk-baseline.mjs --write`)
  }
  const raw = readFileSync(baselinePath, 'utf8')
  const embedded = JSON.parse(raw)
  const expected = buildBaseline()

  // 1) 起始提交格式（不要求等于当前 HEAD，P0 之后 HEAD 会推进）。
  if (!/^[0-9a-f]{40}$/.test(String(embedded.gitHead || ''))) {
    fail(`gitHead 不是 40 位十六进制：${JSON.stringify(embedded.gitHead)}`)
  }
  // 2) 规则版本与状态 schema 版本必须与当前源码一致。
  if (embedded.rulesVersion !== expected.rulesVersion) {
    fail(`rulesVersion 漂移：基线 ${embedded.rulesVersion}，当前 ${expected.rulesVersion}；审阅后显式 --write`)
  }
  if (embedded.stateSchemaVersion !== expected.stateSchemaVersion) {
    fail(`stateSchemaVersion 漂移：基线 ${embedded.stateSchemaVersion}，当前 ${expected.stateSchemaVersion}；审阅后显式 --write`)
  }
  // 3) replay 基线文件内容哈希（按文件字节复算，不允许手写“已知哈希”）。
  if (embedded.replayFile !== REPLAY_FILE) {
    fail(`replayFile 漂移：基线 ${JSON.stringify(embedded.replayFile)}，应为 ${REPLAY_FILE}`)
  }
  let replayLock
  try {
    replayLock = sourceLock(embedded.replayFile, MOD)
  } catch (error) {
    fail(`replay 基线文件缺失或不可读：${error?.message || error}`)
  }
  if (replayLock.sha256 !== embedded.replaySha256) {
    fail(`replay 基线文件已漂移：${embedded.replayFile} 当前 sha256=${replayLock.sha256}，`
      + `基线=${embedded.replaySha256}；行为变动需重新采集，不允许改哈希掩盖`)
  }
  // 4) R1/R2/R3 合规基线必须与当前审计账本一致。
  if (!sameJson(embedded.complianceBaseline, expected.complianceBaseline)) {
    fail('complianceBaseline 与当前 audit/card-entry-compliance.json#baseline 不一致；'
      + '基线只能减不能增，审阅后显式 --write')
  }
  // 5) 能力层 12 项指标必须与当前 audit/ability-coverage.json#metrics 一致。
  if (!sameJson(embedded.architectureMetrics, expected.architectureMetrics)) {
    const keys = ARCHITECTURE_METRIC_KEYS.filter(key =>
      JSON.stringify(embedded.architectureMetrics?.[key]) !== JSON.stringify(expected.architectureMetrics[key]))
    fail(`architectureMetrics 漂移：${keys.join(', ')}；先运行 node tools/audit-abilities.mjs --write 并审阅，再显式 --write`)
  }
  // 6) 冻结证据：fast 采集日志在运行目录存在时复核 sha256；干净检出没有该忽略文件时跳过。
  let fastLogState = 'absent'
  if (existsSync(FAST_LOG_FILE)) {
    const fastLogSha = sha(readFileSync(FAST_LOG_FILE))
    if (fastLogSha !== embedded.fastLogSha256) {
      fail(`fast 采集日志已变化：${FAST_LOG_FILE} 当前 sha256=${fastLogSha}，基线=${embedded.fastLogSha256}；`
        + '重新采集并 --write，或恢复该证据日志')
    }
    fastLogState = 'matched'
  }
  // 7) golden replay 用当前代码逐局重放：任何行为变化都必须让 --check 失败。
  const compare = spawnSync(process.execPath, [join(MOD, 'tools/replay-fixtures.mjs'), '--compare', embedded.replayFile], {
    cwd: MOD, encoding: 'utf8', timeout: 600_000,
  })
  if (compare.status !== 0) {
    fail(`replay --compare 失败（exit=${compare.status}）：${lastLine(compare.stdout || compare.stderr)}`)
  }
  // 8) 其余冻结字段（fastFailures/fastLogSha256/worktree/replaySummary/referenceCommitNote 等）逐字节复算：
  //    快照是单次历史记录，任何手改或代码重构导致的序列化漂移都要求显式 --write。
  if (raw !== json(expected)) {
    const embeddedKeys = Object.keys(embedded)
    const expectedKeys = Object.keys(expected)
    const diffs = expectedKeys.filter(key => !sameJson(embedded[key], expected[key]))
      .concat(embeddedKeys.filter(key => !expectedKeys.includes(key)))
    fail(`${BASELINE_FILE} 与当前快照不一致：${diffs.join(', ') || '(JSON 序列化格式)'}；审阅后显式 --write`)
  }

  console.log(`tsk baseline: check ok（gitHead ${String(embedded.gitHead).slice(0, 7)}；`
    + `replay ${embedded.replaySummary.length} 局 / ${totalReplaySteps(embedded)} 步 sha256=${String(embedded.replaySha256).slice(0, 12)}…；`
    + `rulesVersion ${embedded.rulesVersion} / schemaVersion ${embedded.stateSchemaVersion}；`
    + `合规与 ${ARCHITECTURE_METRIC_KEYS.length} 项指标一致；`
    + `fast 日志 ${fastLogState === 'matched' ? 'sha256 一致' : '缺失（跳过）'}；replay --compare exit 0）`)
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) {
  const mode = process.argv[2]
  try {
    if (mode === '--write') {
      writeBaseline()
    } else if (mode === '--check') {
      checkBaseline()
    } else if (!mode) {
      process.stdout.write(json(buildBaseline()))
    } else {
      console.error('用法：node tools/scan-tsk-baseline.mjs --write | --check（无参数打印 JSON）')
      process.exitCode = 2
    }
  } catch (error) {
    console.error(`tsk baseline: FAILED：${error?.message || error}`)
    process.exitCode = 1
  }
}
