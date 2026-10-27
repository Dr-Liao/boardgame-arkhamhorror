#!/usr/bin/env node
// 《食梦者》第 2 步原语审计：把「计划」与「代码事实」合成两份可复算的产物。
//
//   node tools/audit-tde-primitives.mjs --write   重写产物
//   node tools/audit-tde-primitives.mjs --check   复算并与磁盘比对（CI/门禁用）
//   node tools/audit-tde-primitives.mjs           打印计划（report）
//
// 读取（只读，不改代码）：
//   tools/tde-primitive-spec.mjs              计划：原语 → 落点、API、测试、文档
//   artifacts/migration/tde/mechanism-scan.json    第 1 步的机制扫描（机制 → 卡号）
//   源码导出 / 注册表 / 窗口 / modifier 目标 / effect 原语 —— 从模块实际枚举，不靠字符串搜索
//   每个原语的测试文件                        —— spawnSync `node --test` 实跑
//   replay-before.json                        —— `replay-fixtures --compare` 证明 13 局零漂移
//
// 写入：
//   artifacts/migration/tde/primitive-plan.json     计划 + 实测状态（status 由代码算）
//   artifacts/migration/tde/primitive-catalog.json  主进程维护的原语快照（worker 只读）
//
// 证据规则（路线图 §8.3）：状态不手写；`status=done` 的充分条件是
// 「所有声明的读点都能在模块里枚举到 + 测试文件存在且实跑通过 + 实现文件哈希可复算」。

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { COVERAGE, CYCLE, DEFERRED_PRIMITIVES, DOC_PATH, ESCAPE, PRIMITIVES, REUSE } from './tde-primitive-spec.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const ARTIFACT_DIR = join(ROOT, 'artifacts', 'migration', 'tde')
const PLAN_PATH = join(ARTIFACT_DIR, 'primitive-plan.json')
const CATALOG_PATH = join(ARTIFACT_DIR, 'primitive-catalog.json')
const MECHANISM_SCAN = join(ARTIFACT_DIR, 'mechanism-scan.json')
const REPLAY_BEFORE = 'artifacts/migration/tde/replay-before.json'
const MODE = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'report'

const rel = path => relative(ROOT, path).replaceAll('\\', '/')
const abs = path => resolve(ROOT, path)
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const fileHash = path => (existsSync(abs(path)) ? sha256(readFileSync(abs(path))) : null)
const readJson = path => JSON.parse(readFileSync(abs(path), 'utf8'))

// 依赖注入工厂只列方法名，不执行任何方法体：Proxy 对任意属性返回空函数。
function emptyDeps() {
  return new Proxy({}, { get: () => () => undefined, has: () => true })
}

const moduleCache = new Map()
async function importModule(path) {
  if (!existsSync(abs(path))) return null
  if (!moduleCache.has(path)) moduleCache.set(path, await import(pathToFileURL(abs(path)).href))
  return moduleCache.get(path)
}

async function factoryKeys(path, factory, args = 1) {
  const mod = await importModule(path)
  const fn = mod?.[factory]
  if (typeof fn !== 'function') return null
  const deps = emptyDeps()
  const params = Array.from({ length: args }, () => deps)
  const produced = fn(...params)
  return produced && typeof produced === 'object' ? Object.keys(produced).sort() : null
}

const REGISTRY_CACHE = new Map()
async function registry(name) {
  if (REGISTRY_CACHE.has(name)) return REGISTRY_CACHE.get(name)
  const value = await loadRegistry(name)
  REGISTRY_CACHE.set(name, value)
  return value
}

async function loadRegistry(name) {
  if (name === 'windows') {
    const mod = await importModule('src/engine/windows.js')
    return (mod?.windows?.() || []).map(entry => entry.id).sort()
  }
  if (name === 'modifierTargets') {
    const mod = await importModule('src/engine/modifiers.js')
    return [...(mod?.MODIFIER_TARGETS || [])].sort()
  }
  if (name === 'grantTargets') {
    const mod = await importModule('src/engine/modifiers.js')
    return [...(mod?.GRANT_TARGETS || [])].sort()
  }
  if (name === 'effectPrimitives') {
    const mod = await importModule('src/engine/effects.js')
    return [...(mod?.EFFECT_PRIMITIVES || [])].sort()
  }
  if (name === 'abilityKinds') {
    const mod = await importModule('src/engine/ability.js')
    return [...(mod?.ABILITY_KINDS || [])].sort()
  }
  if (name === 'scenarioRuntime') {
    const mod = await importModule('src/engine/scenario-runtime.js')
    if (typeof mod?.createScenarioRuntime !== 'function') return null
    const runtime = mod.createScenarioRuntime(emptyDeps())(emptyDeps(), [], null)
    return Object.keys(runtime).sort()
  }
  if (name === 'ctxApi') {
    const keys = new Set()
    for (const [file, factory] of [
      ['src/engine/api-misc.js', 'createMiscApi'],
      ['src/engine/api-test.js', 'createTestApi'],
      ['src/engine/api-clue.js', 'createClueApi'],
      ['src/engine/api-enemy.js', 'createEnemyApi'],
      ['src/engine/api-card.js', 'createCardApi'],
    ]) {
      const list = await factoryKeys(file, factory, 3)
      if (!list) return null
      for (const key of list) keys.add(key)
    }
    return [...keys].sort()
  }
  throw new Error(`未知注册表：${name}`)
}

// ---------------------------------------------------------------------------
// 读点校验
// ---------------------------------------------------------------------------

async function verifyCheck(check) {
  const record = { kind: check.kind, ...('file' in check ? { file: check.file } : {}) }
  if (check.name) record.name = check.name
  try {
    if (check.kind === 'module-export') {
      const mod = await importModule(check.file)
      const value = mod?.[check.name]
      const ok = check.type ? typeof value === check.type : value !== undefined
      return { ...record, ok, detail: mod ? (ok ? 'exported' : `typeof ${typeof value}`) : 'module missing' }
    }
    if (check.kind === 'factory-keys') {
      const keys = await factoryKeys(check.file, check.factory, check.args || 1)
      const ok = Boolean(keys?.includes(check.name))
      return { ...record, ok, detail: keys ? `${keys.length} keys` : 'factory missing' }
    }
    if (check.kind === 'scenario-runtime') {
      const keys = await registry('scenarioRuntime')
      return { ...record, ok: Boolean(keys?.includes(check.name)), detail: keys ? `${keys.length} keys` : 'missing' }
    }
    if (check.kind === 'ctx-api') {
      const keys = await registry('ctxApi')
      return { ...record, ok: Boolean(keys?.includes(check.name)), detail: keys ? `${keys.length} keys` : 'missing' }
    }
    if (check.kind === 'window') {
      const ids = await registry('windows')
      return { ...record, ok: ids.includes(check.name), detail: `${ids.length} windows` }
    }
    if (check.kind === 'modifier-target') {
      const targets = await registry('modifierTargets')
      const grants = await registry('grantTargets')
      return { ...record, ok: targets.includes(check.name) || grants.includes(check.name), detail: `${targets.length}+${grants.length}` }
    }
    if (check.kind === 'effect-primitive') {
      const list = await registry('effectPrimitives')
      return { ...record, ok: list.includes(check.name), detail: `${list.length} primitives` }
    }
    if (check.kind === 'ability-kind') {
      const list = await registry('abilityKinds')
      return { ...record, ok: list.includes(check.name), detail: `${list.length} kinds` }
    }
    if (check.kind === 'source-pattern') {
      if (!existsSync(abs(check.file))) return { ...record, ok: false, detail: 'file missing' }
      const source = readFileSync(abs(check.file), 'utf8')
      return { ...record, pattern: check.pattern, ok: new RegExp(check.pattern).test(source), detail: check.why || '' }
    }
    return { ...record, ok: false, detail: `未知读点类型 ${check.kind}` }
  } catch (error) {
    return { ...record, ok: false, detail: `error: ${error.message}` }
  }
}

async function verifyChecks(checks = []) {
  const results = []
  for (const check of checks) results.push(await verifyCheck(check))
  return { results, ok: results.every(entry => entry.ok) }
}

// ---------------------------------------------------------------------------
// 测试实跑与重放零漂移
// ---------------------------------------------------------------------------

function runTestFile(path) {
  const absolute = abs(path)
  if (!existsSync(absolute)) return { path, exists: false, ok: false, tests: 0, fail: 0, skipped: true, note: '测试文件不存在' }
  const run = spawnSync(process.execPath, ['--test', absolute], { cwd: ROOT, encoding: 'utf8', timeout: 180000 })
  const output = `${run.stdout || ''}\n${run.stderr || ''}`
  const tests = Number((output.match(/^ℹ tests (\d+)$/m) || output.match(/^# tests (\d+)$/m) || [])[1] || 0)
  const fail = Number((output.match(/^ℹ fail (\d+)$/m) || output.match(/^# fail (\d+)$/m) || [])[1] || 0)
  return { path, exists: true, ok: run.status === 0 && fail === 0 && tests > 0, tests, fail, exitCode: run.status, skipped: false }
}

function replayZeroDrift() {
  if (!existsSync(abs(REPLAY_BEFORE))) return { ok: false, path: REPLAY_BEFORE, detail: '基线缺失（先跑 replay-fixtures --baseline）' }
  const run = spawnSync(process.execPath, ['tools/replay-fixtures.mjs', '--compare', REPLAY_BEFORE], { cwd: ROOT, encoding: 'utf8', timeout: 300000 })
  const output = `${run.stdout || ''}\n${run.stderr || ''}`.trim()
  const tail = output.split(/\r?\n/).filter(Boolean).pop() || ''
  return { ok: run.status === 0, path: REPLAY_BEFORE, exitCode: run.status, detail: tail.slice(0, 240) }
}

// ---------------------------------------------------------------------------
// 引擎边界（§4.4：src/engine 不出现 06 卡号与战役名）
// ---------------------------------------------------------------------------

function listDir(directory) {
  try { return readdirSync(directory, { withFileTypes: true }) } catch { return [] }
}

function scanEngineBoundary() {
  const files = []
  const walk = directory => {
    for (const entry of listDir(directory)) {
      const full = join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.js')) files.push(full)
    }
  }
  walk(join(ROOT, 'src', 'engine'))
  const codes = []
  const names = []
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const path = rel(file)
    for (const match of source.matchAll(/['"](06\d{3}[a-zA-Z]?)['"]/g)) codes.push({ file: path, code: match[1] })
    if (/\btde\b|theDreamEaters/i.test(source)) names.push(path)
  }
  return { files: files.length, codes, names }
}

// ---------------------------------------------------------------------------
// 组装计划与目录
// ---------------------------------------------------------------------------

async function buildNewPrimitive(entry) {
  const { results, ok: readPointsOk } = await verifyChecks(entry.checks)
  const tests = entry.tests.map(runTestFile)
  const files = entry.files.map(path => ({ path, sha256: fileHash(path), exists: existsSync(abs(path)) }))
  const filesPresent = files.filter(file => file.exists)
  const blockers = []
  if (!readPointsOk) {
    for (const check of results.filter(result => !result.ok)) blockers.push(`读点未接线：${check.kind} ${check.name || check.pattern || ''}`.trim())
  }
  for (const file of files.filter(file => !file.exists)) blockers.push(`文件缺失：${file.path}`)
  for (const test of tests.filter(test => !test.exists)) blockers.push(`测试缺失：${test.path}`)
  for (const test of tests.filter(test => test.exists && !test.ok)) blockers.push(`测试未通过：${test.path}（${test.fail} 失败）`)
  if (!entry.docs) blockers.push('缺少 docs 条目')
  const status = blockers.length === 0 ? 'done' : 'pending'
  return {
    id: entry.id,
    step: entry.step,
    title: entry.title,
    mechanism: entry.mechanism,
    layer: entry.layer,
    status,
    api: entry.api,
    params: entry.params,
    docs: entry.docs,
    note: entry.note,
    checks: results,
    files,
    tests,
    blockers,
    symbolCount: filesPresent.length,
  }
}

async function buildPlan() {
  const scanBuffered = existsSync(MECHANISM_SCAN) ? readFileSync(MECHANISM_SCAN) : null
  const scan = scanBuffered ? JSON.parse(scanBuffered.toString('utf8')) : null
  const newPrimitives = []
  for (const entry of PRIMITIVES) newPrimitives.push(await buildNewPrimitive(entry))

  const reuse = []
  for (const entry of REUSE) {
    const { results, ok } = await verifyChecks(entry.checks)
    reuse.push({ primitive: entry.primitive, api: entry.api, mechanisms: entry.mechanisms, checks: results, ok })
  }

  const scanMechanisms = new Map((scan?.mechanisms || []).map(entry => [entry.id, entry]))
  const coverage = COVERAGE.map(entry => {
    const primitiveMechanism = scanMechanisms.get(entry.mechanism)
    const referenced = entry.by || []
    const newIds = new Set(newPrimitives.map(item => item.id))
    const reuseIds = new Set(reuse.map(item => item.primitive))
    const missing = referenced.filter(id => !newIds.has(id) && !reuseIds.has(id))
    const doneReferenced = referenced.filter(id => {
      const item = newPrimitives.find(candidate => candidate.id === id)
      if (item) return item.status === 'done'
      return reuse.find(candidate => candidate.primitive === id)?.ok === true
    })
    return {
      mechanism: entry.mechanism,
      cards: primitiveMechanism?.cards ?? 0,
      by: referenced,
      ...(entry.deferredTo ? { deferredTo: entry.deferredTo } : {}),
      ...(entry.reason ? { reason: entry.reason } : {}),
      unknownReferences: missing,
      doneReferences: doneReferenced,
      covered: missing.length === 0 && referenced.length > 0 && doneReferenced.length === referenced.length,
      deferred: Boolean(entry.deferredTo),
    }
  })

  const boundary = scanEngineBoundary()
  const done = newPrimitives.filter(item => item.status === 'done')
  const escape = ESCAPE.map(entry => ({ ...entry, ok: Boolean(entry.card && entry.reason) }))
  const mechanismIds = [...scanMechanisms.keys()].filter(id => scanMechanisms.get(id).type === 'primitive')
  const coveredMechanisms = coverage.filter(entry => entry.covered).map(entry => entry.mechanism)
  const missingMechanisms = mechanismIds.filter(id => !coveredMechanisms.includes(id) && !coverage.find(entry => entry.mechanism === id)?.deferred)
  const replay = replayZeroDrift()

  const gate = {
    newPrimitives: { expected: PRIMITIVES.length, done: done.length, pending: newPrimitives.length - done.length, pass: done.length === PRIMITIVES.length },
    newPrimitivesHaveTests: { pass: done.every(item => item.tests.some(test => test.exists && test.ok)) },
    docsPresent: { pass: newPrimitives.every(item => item.files.some(file => file.path === DOC_PATH && file.exists)) },
    reuseReadPoints: { expected: reuse.length, verified: reuse.filter(item => item.ok).length, pass: reuse.every(item => item.ok) },
    escapeRegistered: { expected: escape.length, pass: escape.every(item => item.ok) },
    mechanismCoverage: { total: mechanismIds.length, covered: coveredMechanisms.length, missing: missingMechanisms, pass: missingMechanisms.length === 0 },
    engineBoundary: { codes: boundary.codes.length, campaignNames: boundary.names.length, pass: boundary.codes.length === 0 && boundary.names.length === 0 },
    replayZeroDrift: { pass: replay.ok, detail: replay.detail },
  }
  const pass = Object.values(gate).every(item => item.pass)

  const plan = {
    schemaVersion: 1,
    cycle: CYCLE.id,
    cycleName: CYCLE.name,
    cycleNameZh: CYCLE.nameZh,
    campaignId: CYCLE.campaignId,
    step: 2,
    stepName: '拆分原语（P3 批次 1：双战役骨架）',
    milestone: 'P3',
    generatedBy: 'tools/audit-tde-primitives.mjs',
    spec: 'tools/tde-primitive-spec.mjs',
    docs: DOC_PATH,
    prerequisites: scanBuffered
      ? [{ path: rel(MECHANISM_SCAN), sha256: sha256(scanBuffered), gatePass: scan?.gate?.pass === true }]
      : [],
    summary: {
      batch: 'P3-1+2',
      newTotal: newPrimitives.length,
      done: done.length,
      pending: newPrimitives.length - done.length,
      reuse: reuse.length,
      escape: escape.length,
      deferred: DEFERRED_PRIMITIVES.length,
      mechanismsTotal: mechanismIds.length,
      mechanismsCovered: coveredMechanisms.length,
      mechanismsDeferred: coverage.filter(entry => entry.deferred).map(entry => entry.mechanism),
    },
    reuse,
    new: newPrimitives,
    deferredPrimitives: DEFERRED_PRIMITIVES,
    escape,
    coverage,
    replay,
    gate: { ...gate, pass },
  }

  const fileHashes = {}
  for (const entry of newPrimitives) for (const file of entry.files) if (file.exists) fileHashes[file.path] = file.sha256

  const catalog = {
    schemaVersion: 1,
    cycle: CYCLE.id,
    generatedBy: 'tools/audit-tde-primitives.mjs',
    note: '主进程维护；worker 只读。状态由 tools/audit-tde-primitives.mjs 从代码与测试复算，不手写。',
    batch: 'P3-1+2',
    primitives: {
      new: newPrimitives.map(item => ({
        id: item.id,
        step: item.step,
        status: item.status,
        api: item.api,
        readPoints: item.checks.filter(check => check.ok).map(check => `${check.kind}:${check.name || check.pattern || ''}`),
      })),
      reuse: reuse.map(item => ({ primitive: item.primitive, api: item.api, ok: item.ok })),
      deferred: DEFERRED_PRIMITIVES.map(item => ({ id: item.id, mechanism: item.mechanism, batch: item.batch })),
    },
    files: fileHashes,
    gate,
  }
  return { plan, catalog }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

const { plan, catalog } = await buildPlan()

if (MODE === 'write') {
  mkdirSync(ARTIFACT_DIR, { recursive: true })
  writeFileSync(PLAN_PATH, stableJson(plan), 'utf8')
  writeFileSync(CATALOG_PATH, stableJson(catalog), 'utf8')
  console.log(`primitive-plan: ${rel(PLAN_PATH)}`)
  console.log(`primitive-catalog: ${rel(CATALOG_PATH)}`)
  console.log(`batch ${plan.summary.batch} · new ${plan.summary.done}/${plan.summary.newTotal} done · reuse ${plan.summary.reuse} · escape ${plan.summary.escape} · deferred ${plan.summary.deferred} · gate ${plan.gate.pass ? 'pass' : 'fail'}`)
  for (const entry of plan.new.filter(item => item.status !== 'done')) {
    console.log(`  pending ${entry.step} ${entry.id}: ${entry.blockers.slice(0, 3).join(' | ')}`)
  }
  if (!plan.gate.pass) {
    console.log('gate 未通过：')
    for (const [key, value] of Object.entries(plan.gate)) {
      if (key === 'pass') continue
      if (value && value.pass === false) console.log(`  - ${key}: ${JSON.stringify(value)}`)
    }
  }
} else if (MODE === 'check') {
  if (!existsSync(PLAN_PATH) || !existsSync(CATALOG_PATH)) {
    console.error('产物不存在：先运行 node tools/audit-tde-primitives.mjs --write')
    process.exit(1)
  }
  const planMatch = readFileSync(PLAN_PATH, 'utf8') === stableJson(plan)
  const catalogMatch = readFileSync(CATALOG_PATH, 'utf8') === stableJson(catalog)
  if (!planMatch) console.error('primitive-plan.json 与代码不一致（重新 --write 并审阅 diff）')
  if (!catalogMatch) console.error('primitive-catalog.json 与代码不一致（重新 --write 并审阅 diff）')
  if (!planMatch || !catalogMatch) process.exit(1)
  console.log(`primitive-plan/catalog 复算一致 · batch ${plan.summary.batch} · new ${plan.summary.done}/${plan.summary.newTotal} done · gate ${plan.gate.pass ? 'pass' : 'fail'}`)
  if (!plan.gate.pass) {
    for (const [key, value] of Object.entries(plan.gate)) {
      if (key === 'pass') continue
      if (value && value.pass === false) console.log(`  gate 未通过 ${key}: ${JSON.stringify(value).slice(0, 400)}`)
    }
    process.exit(1)
  }
} else {
  console.log(JSON.stringify(plan, null, 2))
}
