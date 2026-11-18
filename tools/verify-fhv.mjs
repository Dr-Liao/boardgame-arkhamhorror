#!/usr/bin/env node
// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P3 Node 验收证据生成器。
//
//   node tools/verify-fhv.mjs --node            跑 P2 原语测试 + P3 规则书数据测试 + replay 对比，写 audit/fhv-node-acceptance.json
//   node tools/verify-fhv.mjs --node --check    只校验证据文件与当前测试文件哈希一致（不跑测试）
//
// 证据口径：
//   · tests.files/totals 来自 `node --test tests/fhv-primitives.test.mjs tests/fhv-rules.test.mjs` 的真实输出（TAP）；
//   · replay.compareExit 来自 `node tools/replay-fixtures.mjs --compare tests/fixtures/replay/golden-replays.json`
//     （P0 基线，P3 只增规则数据与文档，不改卡与引擎行为时必须 exit 0）；
//   · files[] 记录每个测试文件的 SHA-256，规则审计用它判断证据是否过期（测试改了要重跑）。
// 本工具不改引擎、不写卡；只写 audit/ 与大厅根 artifacts/migration/fhv/ 的镜像。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FAST_TESTS } from '../tests/suites.mjs'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const HALL = join(MOD, '../..')
const RUN = join(HALL, 'artifacts/migration/fhv')
const EVIDENCE_PATH = 'audit/fhv-node-acceptance.json'
const REGRESSION_PATH = 'audit/fhv-regression.json'
const REPLAY_BASELINE = 'tests/fixtures/replay/golden-replays.json'
const REPORTS = join(RUN, 'reports')
const PREEXISTING = join(REPORTS, 'p3-preexisting-failures.json')
const TEST_FILES = Object.freeze([
  'tests/fhv-primitives.test.mjs',
  'tests/fhv-rules.test.mjs',
  'tests/fhv-interactions.test.mjs',
])
// P5（调查员及专属依赖）：逐人 Node 验收 + 五人共用的账本口径测试。
const INVESTIGATOR_TEST_FILES = Object.freeze([
  'tests/fhv-investigator-10001.test.mjs',
  'tests/fhv-investigator-10004.test.mjs',
  'tests/fhv-investigator-10009.test.mjs',
  'tests/fhv-investigator-10012.test.mjs',
  'tests/fhv-investigator-10015.test.mjs',
  'tests/fhv-investigator-signatures.test.mjs',
])
// P7（共享遭遇与战役）：12 个场景（4 序曲 + 8 章）章测试 + 战役层流程/正文/记录测试。
const CAMPAIGN_TEST_FILES = Object.freeze([
  'tests/fhv-scenario-welcomeToHemlockVale.test.mjs',
  'tests/fhv-scenario-writtenInRock.test.mjs',
  'tests/fhv-scenario-hemlockHouse.test.mjs',
  'tests/fhv-scenario-theSilentHeath.test.mjs',
  'tests/fhv-scenario-theLostSister.test.mjs',
  'tests/fhv-scenario-theThingInTheDepths.test.mjs',
  'tests/fhv-scenario-theTwistedHollow.test.mjs',
  'tests/fhv-scenario-dawnOfTheSecondDay.test.mjs',
  'tests/fhv-scenario-theLongestNight.test.mjs',
  'tests/fhv-scenario-dawnOfTheFinalDay.test.mjs',
  'tests/fhv-scenario-preludeTheFinalEvening.test.mjs',
  'tests/fhv-scenario-fateOfTheVale.test.mjs',
  'tests/fhv-campaign-flow.test.mjs',
  'tests/fhv-campaign-engine.test.mjs',
  'tests/fhv-p8-campaign.test.mjs',
  'tests/fhv-story.test.mjs',
  'tests/fhv-campaign-records.test.mjs',
])
// P6（一般玩家卡）：12 份分片逐卡行为测试（每张卡至少一条 P6 <code> 证据）。
const PLAYER_TEST_FILES = Object.freeze(Array.from({ length: 12 }, (_, index) => `tests/fhv-player-m2-${index + 1}.test.mjs`))
const json = value => JSON.stringify(value, null, 2) + '\n'
const readText = path => readFileSync(join(MOD, path), 'utf8').replace(/^\uFEFF/, '')
const readJson = path => JSON.parse(readText(path))
const sha = path => createHash('sha256').update(readFileSync(join(MOD, path))).digest('hex')

function passTitles(output) {
  const titles = []
  for (const line of String(output || '').split(/\r?\n/)) {
    const match = /^\s*ok \d+ - (.+?)\s*$/.exec(line)
    if (match) titles.push(match[1].trim())
  }
  return titles
}

function tapCount(output, key) {
  const match = String(output || '').match(new RegExp(`^# ${key} (\\d+)\\r?$`, 'm'))
  return match ? Number(match[1]) : null
}

function runNodeTests(files) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {
    cwd: MOD, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  const totals = { tests: tapCount(output, 'tests'), pass: tapCount(output, 'pass'), fail: tapCount(output, 'fail') }
  return {
    exit: result.status ?? null,
    totals,
    passAll: (result.status ?? 1) === 0 && (totals.fail ?? 1) === 0 && (totals.pass ?? 0) > 0,
    titles: passTitles(output).sort(),
  }
}

function runReplay() {
  const result = spawnSync(process.execPath, ['tools/replay-fixtures.mjs', '--compare', REPLAY_BASELINE], {
    cwd: MOD, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  return {
    compareExit: result.status ?? null,
    baseline: REPLAY_BASELINE,
    baselineSha256: sha(REPLAY_BASELINE),
  }
}

function buildEvidence({ run = true } = {}) {
  const allFiles = [...TEST_FILES, ...INVESTIGATOR_TEST_FILES, ...PLAYER_TEST_FILES, ...CAMPAIGN_TEST_FILES]
  const missing = allFiles.filter(path => !existsSync(join(MOD, path)))
  if (missing.length) throw new Error(`FHV Node 测试文件缺失：${missing.join('、')}`)
  const fileHashes = allFiles.map(path => ({ path, sha256: sha(path) }))
  const previous = existsSync(join(MOD, EVIDENCE_PATH)) ? readJson(EVIDENCE_PATH) : null
  let tests
  let investigators
  let player
  let campaign
  let replay
  if (run) {
    const result = runNodeTests([...TEST_FILES])
    tests = { files: [...TEST_FILES], totals: result.totals, pass: result.passAll, titles: result.titles }
    const investigatorResult = runNodeTests([...INVESTIGATOR_TEST_FILES])
    investigators = {
      files: [...INVESTIGATOR_TEST_FILES], totals: investigatorResult.totals,
      pass: investigatorResult.passAll, titles: investigatorResult.titles,
    }
    const playerResult = runNodeTests([...PLAYER_TEST_FILES])
    player = {
      files: [...PLAYER_TEST_FILES], totals: playerResult.totals,
      pass: playerResult.passAll, titles: playerResult.titles,
    }
    const campaignResult = runNodeTests([...CAMPAIGN_TEST_FILES])
    campaign = {
      files: [...CAMPAIGN_TEST_FILES], totals: campaignResult.totals,
      pass: campaignResult.passAll, titles: campaignResult.titles,
    }
    replay = runReplay()
  } else {
    if (!previous) throw new Error('audit/fhv-node-acceptance.json 不存在：先跑 node tools/verify-fhv.mjs --node')
    const fresh = fileHashes.length === (previous.files || []).length
      && fileHashes.every(file => (previous.files || []).some(entry => entry.path === file.path && entry.sha256 === file.sha256))
    if (!fresh) throw new Error('FHV Node 测试文件已变化：证据过期，请重跑 node tools/verify-fhv.mjs --node')
    assert(fresh, 'FHV Node 证据过期')
    tests = previous.tests
    investigators = previous.investigators
    player = previous.player
    campaign = previous.campaign
    replay = previous.replay
  }
  const evidence = {
    schemaVersion: 1,
    cycle: 'fhv',
    campaignId: 'theFeastOfHemlockVale',
    milestone: 'P3–P8',
    command: 'node tools/verify-fhv.mjs --node',
    generatedBy: 'tools/verify-fhv.mjs',
    tests: { files: [...TEST_FILES], totals: tests.totals, pass: tests.pass === true, titles: tests.titles },
    investigators: {
      files: [...INVESTIGATOR_TEST_FILES], totals: investigators.totals,
      pass: investigators.pass === true, titles: investigators.titles,
    },
    player: {
      files: [...PLAYER_TEST_FILES], totals: player.totals,
      pass: player.pass === true, titles: player.titles,
    },
    campaign: {
      files: [...CAMPAIGN_TEST_FILES], totals: campaign.totals,
      pass: campaign.pass === true, titles: campaign.titles,
    },
    replay,
    files: fileHashes,
    gates: {
      testsPassed: tests.pass === true && (tests.totals.fail ?? 1) === 0,
      investigatorsPassed: investigators.pass === true && (investigators.totals.fail ?? 1) === 0,
      playerPassed: player.pass === true && (player.totals.fail ?? 1) === 0,
      campaignPassed: campaign.pass === true && (campaign.totals.fail ?? 1) === 0,
      replayNoDrift: replay.compareExit === 0,
    },
  }
  return evidence
}

// ── P4 回归证据：fast 无新增失败（基线 = P3 收口的既有失败清单）+ replay 精确一致 ──────────────
// 自指说明：`tests/fhv-rules-ledger.test.mjs` 与 `tests/fhv-interactions-ledger.test.mjs` 断言的是
// 「账本与当前源码逐字节一致」；在本账本生成之前它们必然失败，因此回归取证运行排除这两个自检文件，
// 最终的全量 `npm run test:fast`（含自检）在账本生成后作为最终验收另外执行并留档。
const GUARD_TEST = 'tests/suite-manifest.test.mjs'
const EVIDENCE_SELF_CHECKS = Object.freeze([
  'fhv-rules-ledger.test.mjs',
  'fhv-interactions-ledger.test.mjs',
])

function runFastRegressionSuite() {
  const files = FAST_TESTS
    .filter(file => !EVIDENCE_SELF_CHECKS.includes(file))
    .map(file => `tests/${file}`)
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', GUARD_TEST, ...files], {
    cwd: MOD, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
  })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  const totalOf = key => {
    const match = output.match(new RegExp(`^# ${key} (\\d+)\\r?$`, 'm'))
    return match ? Number(match[1]) : null
  }
  const totals = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped'].map(key => [key, totalOf(key)]))
  if (!Number.isFinite(totals.tests)) throw new Error('快速回归运行结果无法解析（TAP）')
  const titles = [...new Set([...output.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(([, title]) => title.trim()))].sort()
  const exitCode = result.status ?? null
  assert.equal(exitCode, Number(totals.fail + totals.cancelled > 0), '快速回归退出码不一致')
  return { exitCode, totals, titles }
}

function buildRegression() {
  if (!existsSync(PREEXISTING)) throw new Error(`缺少 P4 既有失败记账：${PREEXISTING}`)
  const preexisting = JSON.parse(readFileSync(PREEXISTING, 'utf8'))
  const knownFailures = (preexisting.fastBaseline?.failures || []).map(title => ({
    title, reason: preexisting.rootCause?.summary || 'P3 收口时已存在的既有失败，见 artifacts 记账',
  })).sort((left, right) => (left.title < right.title ? -1 : left.title > right.title ? 1 : 0))
  const fast = runFastRegressionSuite()
  const newFailures = fast.titles.filter(title => !knownFailures.some(row => row.title === title))
  const replayRun = runReplay()
  const replay = {
    baseline: REPLAY_BASELINE, baselineSha256: replayRun.baselineSha256,
    exitCode: replayRun.compareExit, matches: replayRun.compareExit === 0,
  }
  const gates = {
    fastNoNewFailures: newFailures.length === 0,
    replayNoDrift: replay.exitCode === 0 && replay.matches === true,
  }
  return {
    schemaVersion: 1,
    cycle: 'fhv',
    campaignId: 'theFeastOfHemlockVale',
    milestone: 'P4',
    command: 'node tools/verify-fhv.mjs --regression',
    generatedBy: 'tools/verify-fhv.mjs',
    baselineNote: 'P4 快速回归基线 = P3 收口时的既有失败清单（artifacts/migration/fhv/reports/p3-preexisting-failures.json）；P4 只要求不新增失败。',
    fast: {
      command: `node --test ${GUARD_TEST} + FAST_TESTS`,
      excludedEvidenceSelfChecks: [...EVIDENCE_SELF_CHECKS],
      exitCode: fast.exitCode, totals: fast.totals, titles: fast.titles, newFailures,
    },
    knownFailures,
    replay,
    gates,
    status: Object.values(gates).every(Boolean) ? 'passed' : 'failed',
  }
}

const mode = process.argv.includes('--node') ? 'node'
  : process.argv.includes('--regression') ? 'regression' : null
assert(mode, '用法：node tools/verify-fhv.mjs --node|--regression [--check]')
const check = process.argv.includes('--check')
if (mode === 'regression') {
  const path = REGRESSION_PATH
  if (check) {
    assert(existsSync(join(MOD, path)), 'audit/fhv-regression.json 不存在：先 --regression')
    assert(readText(path) === json(buildRegression()), 'audit/fhv-regression.json 与重算结果不一致；审阅证据后显式 --regression')
    const disk = readJson(path)
    console.log(`fhv regression 证据：一致（新增失败 ${disk.fast.newFailures.length}，replay exit ${disk.replay.exitCode}）`)
  } else {
    const data = buildRegression()
    mkdirSync(REPORTS, { recursive: true })
    writeFileSync(join(MOD, path), json(data))
    writeFileSync(join(RUN, 'regression.json'), json(data))
    console.log(`fhv regression 证据：已写入（新增失败 ${data.fast.newFailures.length}，replay exit ${data.replay.exitCode}）`)
    if (data.status !== 'passed') throw new Error(`fhv 回归门禁失败：${Object.entries(data.gates).filter(([, value]) => value !== true).map(([key]) => key).join('、')}`)
  }
} else {
  const data = buildEvidence({ run: !check })
  const failed = Object.entries(data.gates).filter(([, value]) => value !== true).map(([key]) => key)
  if (check) {
    assert(readText(EVIDENCE_PATH) === json(data), 'audit/fhv-node-acceptance.json 与重算结果不一致：测试文件或 replay 基线已变化，重跑 --node')
    console.log(`fhv node 证据：一致（${data.tests.totals.pass}/${data.tests.totals.tests} pass，replay exit ${data.replay.compareExit}）`)
  } else {
    mkdirSync(RUN, { recursive: true })
    writeFileSync(join(MOD, EVIDENCE_PATH), json(data))
    writeFileSync(join(RUN, 'node-acceptance.json'), json(data))
    console.log(`fhv node 证据：已写入（${data.tests.totals.pass}/${data.tests.totals.tests} pass，replay exit ${data.replay.compareExit}）`)
  }
  if (failed.length) throw new Error(`fhv node 验收失败：${failed.join('、')}`)
}
