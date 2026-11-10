#!/usr/bin/env node
// 八循环《绯红密钥》（TSK）P4 回归证据生成器。
//
//   node tools/verify-tsk-regression.mjs          跑 replay 对比 + 读取当前 fast 结果，写 audit/tsk-regression.json
//   node tools/verify-tsk-regression.mjs --check  只校验账本与当前输入一致（不跑测试）
//
// 口径（与 audit/tsk-baseline.json 的冻结基线对齐）：
//   · fast：失败数与 P0 冻结的既有失败数一致，且失败文件集合不超出冻结清单（additionsSinceInitialBaseline 为空）；
//     P4 只要求「无新增失败」，不要求 fast 真零失败；
//   · replay：P0 基线夹具逐字节一致（sha256），`replay-fixtures.mjs --compare` exit 0。
// 本工具只写 audit/ 与 artifacts/migration/tsk/ 镜像，不改引擎/卡牌。
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { MOD, RUN, json, readJson, sha, writeJson } from './tsk-migration-lib.mjs'

const EVIDENCE_PATH = join(MOD, 'audit/tsk-regression.json')
const BASELINE_PATH = join(MOD, 'audit/tsk-baseline.json')
const FAST_COMMAND = 'node tools/run-tests.mjs fast'
const TEST_FILE_PATTERN = /test at (tests[\\/][^:]+):/

function parseFastOutput(output) {
  const count = key => {
    const match = output.match(new RegExp(`ℹ ${key} (\\d+)`))
    return match ? Number(match[1]) : null
  }
  const start = output.lastIndexOf('✖ failing tests:')
  const section = start >= 0 ? output.slice(start) : ''
  const failingFiles = new Set()
  for (const match of section.matchAll(new RegExp(TEST_FILE_PATTERN, 'g'))) {
    failingFiles.add(match[1].replaceAll('\\', '/'))
  }
  const titles = [...section.matchAll(/^✖ (.+?) \(\d/gm)].map(match => match[1])
  return { tests: count('tests'), pass: count('pass'), fail: count('fail'), failingFiles: [...failingFiles].sort(), titles }
}

function runFast() {
  const result = spawnSync(process.execPath, ['tools/run-tests.mjs', 'fast'], {
    cwd: MOD, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
  })
  const output = `${result.stdout || ''}${result.stderr || ''}`
  return { exitCode: result.status ?? null, parsed: parseFastOutput(output), outputSha256: sha(output) }
}

function runReplay(baseline) {
  const file = baseline.replayFile
  if (!file || !existsSync(join(MOD, file))) throw new Error(`replay 基线夹具缺失：${file}`)
  const expectedSha = baseline.replaySha256
  const actualSha = sha(readFileSync(join(MOD, file)))
  const result = spawnSync(process.execPath, ['tools/replay-fixtures.mjs', '--compare', file], {
    cwd: MOD, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  const output = `${result.stdout || ''}${result.stderr || ''}`
  return {
    baseline: file,
    expectedSha256: expectedSha,
    actualSha256: actualSha,
    exitCode: result.status ?? null,
    matches: expectedSha === actualSha && (result.status ?? 1) === 0,
    outputSha256: sha(output),
  }
}

function buildRegression() {
  const baseline = readJson(BASELINE_PATH)
  const fast = runFast()
  const replay = runReplay(baseline)
  // audit/tsk-baseline.json#fastFailures 是冻结的失败**标题**；文件清单在 preExistingFailures.files。
  const frozenTitles = [...(baseline.fastFailures || [])].sort()
  const frozenFiles = [...(baseline.preExistingFailures?.files || [])].sort()
  const frozenCount = frozenTitles.length
  const additions = fast.parsed.titles.filter(title => !frozenTitles.includes(title))
  return {
    schemaVersion: 1,
    cycle: 'tsk',
    generatedBy: 'tools/verify-tsk-regression.mjs',
    command: {
      fast: FAST_COMMAND,
      replay: `node tools/replay-fixtures.mjs --compare ${baseline.replayFile}`,
    },
    status: (fast.exitCode ?? 1) === 1 && additions.length === 0
      && fast.parsed.fail === frozenCount && replay.matches ? 'passed' : 'failed',
    fast: {
      exitCode: fast.exitCode,
      outputSha256: fast.outputSha256,
      totals: { tests: fast.parsed.tests, pass: fast.parsed.pass, fail: fast.parsed.fail },
      failingFiles: fast.parsed.failingFiles,
      frozenTitles,
      baselineFiles: frozenFiles,
      additionsSinceInitialBaseline: additions,
      frozenFailureCount: frozenCount,
      titles: fast.parsed.titles,
    },
    replay,
    baseline: {
      fastFailures: frozenTitles,
      fastFailureFiles: frozenFiles,
      replayFile: baseline.replayFile,
      replaySha256: baseline.replaySha256,
    },
  }
}

const check = process.argv.includes('--check')
if (check) {
  if (!existsSync(EVIDENCE_PATH)) throw new Error('audit/tsk-regression.json 不存在：先跑 node tools/verify-tsk-regression.mjs')
  const disk = readJson(EVIDENCE_PATH)
  const baseline = readJson(BASELINE_PATH)
  const frozen = [...(baseline.fastFailures || [])].sort()
  const ok = disk.status === 'passed'
    && disk.fast.additionsSinceInitialBaseline.length === 0
    && disk.fast.totals.fail === frozen.length
    && JSON.stringify(disk.fast.frozenTitles) === JSON.stringify(frozen)
    && disk.replay.matches === true
    && disk.replay.actualSha256 === disk.replay.expectedSha256
  if (!ok) throw new Error('audit/tsk-regression.json 与冻结基线不一致或回归失败')
  console.log(`tsk regression: 一致（fast fail ${disk.fast.totals.fail}/${frozen.length} 冻结项，replay ${disk.replay.matches ? 'exact' : 'drift'}）`)
} else {
  const evidence = buildRegression()
  writeJson(EVIDENCE_PATH, evidence)
  writeJson(join(RUN, 'regression.json'), evidence)
  console.log(`tsk regression: ${evidence.status}（fast ${evidence.fast.totals.tests} tests / ${evidence.fast.totals.fail} fail，additions ${evidence.fast.additionsSinceInitialBaseline.length}，replay exit ${evidence.replay.exitCode}）`)
  if (evidence.status !== 'passed') process.exitCode = 1
}
