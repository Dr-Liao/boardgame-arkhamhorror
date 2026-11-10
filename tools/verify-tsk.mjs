#!/usr/bin/env node
// 八循环《绯红密钥》P2 原语验收证据生成器。
//
//   node tools/verify-tsk.mjs --node            跑 P2 原语 Node 测试 + replay 对比，写 audit/tsk-node-acceptance.json
//   node tools/verify-tsk.mjs --node --check    只校验证据文件与当前测试文件哈希一致（不跑测试）
//
// 证据口径：
//   · tests.files/totals 来自 `node --test tests/tsk-primitives-*.test.mjs` 的真实输出（pass/fail 计数）；
//   · replay.compareExit 来自 `node tools/replay-fixtures.mjs --compare tests/fixtures/replay/tsk-baseline.json`
//     （P0 基线，P2 不改卡/不改引擎行为时必须 exit 0）；
//   · files[] 记录每个测试文件的 SHA-256，audit-tsk-primitives 用它判断证据是否过期（测试改了要重跑）。
// 本工具不改引擎、不写卡；只写 audit/ 与大厅根 artifacts/migration/tsk/ 的镜像。
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { MOD, RUN, json, readJson, sha, writeJson } from './tsk-migration-lib.mjs'
import { PRIMITIVE_SPEC } from './tsk-primitive-spec.mjs'

const EVIDENCE_PATH = join(MOD, 'audit/tsk-node-acceptance.json')
const REPLAY_BASELINE = 'tests/fixtures/replay/tsk-baseline.json'

// P5（调查员及专属依赖）：逐人 Node 验收文件；证据里保存通过标题，P5 审计按「P5 <code> 」前缀判定。
export const P5_INVESTIGATOR_TEST_FILES = Object.freeze([
  'tests/tsk-investigator-09001.test.mjs',
  'tests/tsk-investigator-09004.test.mjs',
  'tests/tsk-investigator-09008.test.mjs',
  'tests/tsk-investigator-09011.test.mjs',
  'tests/tsk-investigator-09015.test.mjs',
  'tests/tsk-investigator-09018.test.mjs',
  'tests/tsk-investigator-signatures.test.mjs',
])

function passTitles(output) {
  const titles = []
  for (const line of String(output || '').split(/\r?\n/)) {
    const match = /\u2714\s+(.+?)(?:\s+\(\d+(?:\.\d+)?ms\))?\s*$/.exec(line)
    if (match) titles.push(match[1].trim())
  }
  return titles
}

function primitiveTestFiles() {
  return [...new Set(PRIMITIVE_SPEC.flatMap(row => row.tests))].filter(path => path.startsWith('tests/tsk-primitives-')).sort()
}

function runNodeTests(files) {
  const result = spawnSync(process.execPath, ['--test', ...files], { cwd: MOD, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const output = `${result.stdout || ''}${result.stderr || ''}`
  const counts = key => {
    const match = output.match(new RegExp(`ℹ ${key} (\\d+)`))
    return match ? Number(match[1]) : null
  }
  return {
    exit: result.status ?? null,
    tests: counts('tests'),
    pass: counts('pass'),
    fail: counts('fail'),
    passAll: (result.status ?? 1) === 0 && (counts('fail') ?? 1) === 0 && (counts('pass') ?? 0) > 0,
    titles: passTitles(output),
  }
}

function runReplay() {
  const result = spawnSync(process.execPath, ['tools/replay-fixtures.mjs', '--compare', REPLAY_BASELINE], {
    cwd: MOD, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
  return {
    compareExit: result.status ?? null,
    baseline: REPLAY_BASELINE,
    baselineSha256: sha(readFileSync(join(MOD, REPLAY_BASELINE))),
    outputSha256: sha(output),
    tail: output.split(/\r?\n/).slice(-3),
  }
}

function buildEvidence({ run = true } = {}) {
  const files = primitiveTestFiles()
  const missing = files.filter(path => !existsSync(join(MOD, path)))
  if (missing.length) throw new Error(`P2 原语测试文件缺失：${missing.join('、')}`)
  const prev = existsSync(EVIDENCE_PATH) ? readJson(EVIDENCE_PATH) : null
  const fileHashes = files.map(path => ({ path, sha256: sha(readFileSync(join(MOD, path))) }))
  const investigatorFiles = [...P5_INVESTIGATOR_TEST_FILES]
  const missingInvestigators = investigatorFiles.filter(path => !existsSync(join(MOD, path)))
  if (missingInvestigators.length) throw new Error(`P5 调查员测试文件缺失：${missingInvestigators.join('、')}`)
  const investigatorHashes = investigatorFiles.map(path => ({ path, sha256: sha(readFileSync(join(MOD, path))) }))
  let investigatorTests = null
  let tests
  let replay
  if (!run && prev?.investigators) {
    // --check：不重跑测试，只复用已签入证据；文件哈希新鲜度在下方单独校验。
    investigatorTests = {
      totals: prev.investigators.totals,
      tests: prev.investigators.totals?.tests ?? 0,
      pass: prev.investigators.totals?.pass ?? 0,
      fail: prev.investigators.totals?.fail ?? 0,
      passAll: prev.investigators.pass === true,
      titles: prev.investigators.titles || [],
    }
    tests = prev.tests
    replay = prev.replay
  }
  if (run) {
    investigatorTests = runNodeTests(investigatorFiles)
    const result = runNodeTests(files)
    tests = { files, totals: { tests: result.tests, pass: result.pass, fail: result.fail }, pass: result.passAll }
    replay = runReplay()
  } else {
    if (!prev) throw new Error('audit/tsk-node-acceptance.json 不存在：先跑 node tools/verify-tsk.mjs --node')
    const fresh = files.length === (prev.tests?.files || []).length
      && fileHashes.every(file => (prev.files || []).some(entry => entry.path === file.path && entry.sha256 === file.sha256))
    if (!fresh) throw new Error('P2 原语测试文件已变化：证据过期，请重跑 node tools/verify-tsk.mjs --node')
    const freshInvestigators = (prev.investigators?.files || []).every(row => existsSync(join(MOD, row.path))
      && sha(readFileSync(join(MOD, row.path))) === row.sha256)
    if (!freshInvestigators || (prev.investigators?.files || []).length !== P5_INVESTIGATOR_TEST_FILES.length) {
      throw new Error('P5 调查员 Node 测试文件已变化：证据过期，请重跑 node tools/verify-tsk.mjs --node')
    }
    tests = prev.tests
    replay = prev.replay
  }
  const evidence = {
    schemaVersion: 1,
    cycle: 'tsk',
    command: 'node tools/verify-tsk.mjs --node',
    generatedBy: 'tools/verify-tsk.mjs',
    tests: { files, totals: tests.totals, pass: tests.pass === true },
    investigators: investigatorTests
      ? { files: investigatorHashes, totals: { tests: investigatorTests.tests, pass: investigatorTests.pass, fail: investigatorTests.fail },
        pass: investigatorTests.passAll === true, titles: investigatorTests.titles }
      : { files: investigatorHashes, totals: { tests: 0, pass: 0, fail: 0 }, pass: false, titles: [] },
    replay,
    files: fileHashes,
    gates: {
      testsPassed: tests.pass === true && (tests.totals.fail ?? 1) === 0,
      replayNoDrift: replay.compareExit === 0,
    },
  }
  return evidence
}

const check = process.argv.includes('--check')
const data = buildEvidence({ run: !check })
const failed = Object.entries(data.gates).filter(([, value]) => value !== true).map(([key]) => key)
if (check) {
  if (json(readJson(EVIDENCE_PATH)) !== json(data)) {
    const disk = readJson(EVIDENCE_PATH)
    const changed = [...new Set([...Object.keys(disk), ...Object.keys(data)])]
      .filter(key => JSON.stringify(disk[key]) !== JSON.stringify(data[key]))
    const invDisk = disk.investigators || {}
    const invBuilt = data.investigators || {}
    const invChanged = [...new Set([...Object.keys(invDisk), ...Object.keys(invBuilt)])]
      .filter(key => JSON.stringify(invDisk[key]) !== JSON.stringify(invBuilt[key]))
      .map(key => `${key}: disk=${JSON.stringify(invDisk[key]).slice(0, 300)} built=${JSON.stringify(invBuilt[key]).slice(0, 300)}`)
    throw new Error(`audit/tsk-node-acceptance.json 与重算结果不一致（差异键：${changed.join(', ')}）；${invChanged.join(' | ')}`)
  }
  console.log(`tsk node 证据：一致（${data.tests.totals.pass}/${data.tests.totals.tests} pass，replay exit ${data.replay.compareExit}）`)
} else {
  writeJson(EVIDENCE_PATH, data)
  writeJson(join(RUN, 'node-acceptance.json'), data)
  console.log(`tsk node 证据：已写入（${data.tests.totals.pass}/${data.tests.totals.tests} pass，replay exit ${data.replay.compareExit}）`)
}
if (failed.length) throw new Error(`tsk node 验收失败：${failed.join('、')}`)
