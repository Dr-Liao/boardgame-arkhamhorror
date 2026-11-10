#!/usr/bin/env node
// 八循环《绯红密钥》P2 原语计划与只读目录。
//
//   node tools/audit-tsk-primitives.mjs --write   生成 audit/tsk-primitive-plan.json + audit/tsk-primitive-catalog.json
//   node tools/audit-tsk-primitives.mjs --check   两份账本逐字节复算（模块/导出/证据漂移即失败）
//   node tools/audit-tsk-primitives.mjs           打印计划 JSON（不写盘）
//
// 口径（docs/campaign/theScarletKeys/README.md §3 P2、primitives.md）：
//   · P1 的 77 项原语目录按 phase 分相：P2 = 本轮实现的 extend/new；reuse = 既有能力（只登记模块与读点）。
//   · 状态不手写：每个 id 的模块/导出/测试来自 tools/tsk-primitive-spec.mjs；
//     `done` 需要模块存在、导出存在、测试文件已登记进 FAST_TESTS、docs 存在，且
//     audit/tsk-node-acceptance.json（tools/verify-tsk.mjs --node 生成）的测试/回放证据通过且未过期。
//   · 本工具只读代码与证据，不写引擎；`--check` 只比较两份账本，不重写基线。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MOD, RUN, emit, json, readJson, sha, writeJson } from './tsk-migration-lib.mjs'
import { PRIMITIVE_SPEC } from './tsk-primitive-spec.mjs'
import { BLOCKED_PRIMITIVES, PRIMITIVE_CATALOG } from './tsk-mechanism-primitives.mjs'
import { buildScan } from './scan-tsk-mechanisms.mjs'
import { FAST_TESTS } from '../tests/suites.mjs'

const planPath = join(MOD, 'audit/tsk-primitive-plan.json')
const catalogPath = join(MOD, 'audit/tsk-primitive-catalog.json')
const evidencePath = join(MOD, 'audit/tsk-node-acceptance.json')
const REPLAY_BASELINE = 'tests/fixtures/replay/tsk-baseline.json'

function shaOfFile(path) {
  if (!existsSync(join(MOD, path))) return null
  return sha(readFileSync(join(MOD, path)))
}

async function moduleExports(modules) {
  const result = []
  for (const path of modules) {
    const absolute = join(MOD, path)
    if (!existsSync(absolute)) { result.push({ path, exports: null }); continue }
    const mod = await import(pathToFileURL(absolute).href)
    result.push({ path, exports: Object.keys(mod).sort() })
  }
  return result
}

function collectGapCards(scan) {
  const byId = new Map()
  const add = (id, code) => {
    if (!byId.has(id)) byId.set(id, new Set())
    byId.get(id).add(code)
  }
  for (const mechanism of scan.mechanisms) {
    for (const id of mechanism.candidatePrimitives || []) for (const code of mechanism.cards || []) add(id, code)
  }
  for (const key of scan.keyMechanisms) {
    for (const id of key.primitiveIds || []) for (const code of key.cards || []) add(id, code)
  }
  return new Map([...byId].map(([id, cards]) => [id, [...cards].sort()]))
}

/** 每个原语缺口被哪些机制引用（P1 账本直接记录；规则书型机制可能没有卡号）。 */
function collectGapMechanisms(scan) {
  return new Map((scan.primitiveGaps || []).map(gap => [gap.id, [...(gap.mechanisms || [])]]))
}

function scanEvidence(scan) {
  const files = []
  let hash = sha(json(scan))
  for (const path of ['src/engine/api-mechanics.js', 'src/engine/effects.js', 'src/engine/windows.js']) {
    files.push({ path, sha256: shaOfFile(path) })
    hash = sha(hash + '|' + path + '|' + (shaOfFile(path) || 'missing'))
  }
  return { files, scanSha256: hash }
}

export async function buildPrimitivePlan() {
  const scan = buildScan()
  const evidence = existsSync(evidencePath) ? readJson(evidencePath) : null
  const gapCards = collectGapCards(scan)
  const gapMechanisms = collectGapMechanisms(scan)
  const fastTests = new Set(FAST_TESTS)
  const draft = []
  for (const specEntry of PRIMITIVE_SPEC) {
    const catalog = PRIMITIVE_CATALOG[specEntry.id]
    if (!catalog) throw new Error(`原语 ${specEntry.id} 不在 P1 目录（不允许自由 id）`)
    const loaded = await moduleExports(specEntry.modules)
    const moduleMissing = loaded.filter(item => item.exports === null).map(item => item.path)
    const exportNames = new Set(loaded.flatMap(item => item.exports || []))
    const exportMissing = [...new Set(specEntry.exports)].filter(name => !exportNames.has(name))
    const testsMissing = specEntry.tests.filter(path => !existsSync(join(MOD, path)))
    const testsUnregistered = specEntry.tests.filter(path => !fastTests.has(path.replace(/^tests\//, '')))
    const docsMissing = specEntry.docs && !existsSync(join(MOD, specEntry.docs)) ? [specEntry.docs] : []
    const cards = gapCards.get(specEntry.id) || []
    const mechanisms = gapMechanisms.get(specEntry.id) || []
    const reusable = specEntry.classification === 'reuse'
    const status = moduleMissing.length || exportMissing.length || testsMissing.length || testsUnregistered.length || docsMissing.length
      ? 'pending' : reusable ? 'registered' : 'done'
    draft.push({
      id: specEntry.id,
      catalogKind: catalog.kind,
      phase: specEntry.phase,
      classification: specEntry.classification,
      modules: specEntry.modules,
      exports: specEntry.exports,
      tests: specEntry.tests,
      docs: specEntry.docs,
      api: specEntry.api,
      ...(specEntry.adjudication ? { adjudication: specEntry.adjudication } : {}),
      ...(specEntry.reclassified ? { reclassified: specEntry.reclassified } : {}),
      ...(specEntry.note ? { note: specEntry.note } : {}),
      cards,
      mechanisms,
      status,
      missing: {
        modules: moduleMissing,
        exports: exportMissing,
        tests: testsMissing,
        testsUnregistered,
        docs: docsMissing,
      },
    })
  }
  const reuse = draft.filter(row => row.classification === 'reuse')
  const p2Rows = draft.filter(row => row.phase === 'P2' && row.classification !== 'reuse')
  const p2New = p2Rows.filter(row => row.classification === 'new')
  const p2Extend = p2Rows.filter(row => row.classification === 'extend')
  const gaps = draft.filter(row => ['new', 'extend'].includes(row.catalogKind))
  const reclassified = draft
    .filter(row => row.classification !== row.catalogKind)
    .map(row => ({ id: row.id, catalogKind: row.catalogKind, classification: row.classification, reason: row.reclassified || '' }))
  const adjudications = draft
    .filter(row => BLOCKED_PRIMITIVES.includes(row.id))
    .map(row => ({ id: row.id, adjudication: row.adjudication || '', status: row.status }))
  const testFiles = [...new Set(draft.flatMap(row => row.tests))].sort()
  const evidenceTests = evidence?.tests?.files || []
  const evidenceFresh = Boolean(evidence?.tests?.pass === true
    && testFiles.every(path => evidenceTests.includes(path))
    && testFiles.every(path => (evidence?.files || []).some(file => file.path === path && file.sha256 === shaOfFile(path))))
  const replayOk = (evidence?.replay?.compareExit ?? null) === 0
  const codePattern = /(^|[^0-9])0[89]\d{3}([^0-9]|$)/
  // 只扫描 P2 新建的引擎模块（tsk-*.js）：既有共享模块（modifiers.js 等）允许在注释里引用卡号；
  // 注释里引用卡号是文档，不算分支——扫描前剥掉整行注释与行尾注释。
  const stripComments = source => source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n')
  const engineModules = [...new Set(p2Rows.flatMap(row => row.modules))].filter(path => path.startsWith('src/engine/tsk-'))
  const cardCodeModules = engineModules.filter(path => {
    if (!existsSync(join(MOD, path))) return false
    return codePattern.test(stripComments(readFileSync(join(MOD, path), 'utf8')))
  })
  const pinned = scanEvidence(scan)
  const plan = {
    schemaVersion: 1,
    cycle: 'tsk',
    campaignId: 'theScarletKeys',
    milestone: 'P2',
    step: 'P2 通用原语',
    generatedBy: 'tools/audit-tsk-primitives.mjs',
    docs: 'docs/campaign/theScarletKeys/primitives.md',
    status: 'catalog-only',
    scanSha256: pinned.scanSha256,
    scanFiles: pinned.files,
    counts: {
      catalog: draft.length,
      reuse: reuse.length,
      p2: p2Rows.length,
      p2New: p2New.length,
      p2Extend: p2Extend.length,
      gaps: gaps.length,
      gapsDone: gaps.filter(row => row.status !== 'pending').length,
      reclassified: reclassified.length,
      escape: 0,
    },
    evidence: {
      generatedBy: 'tools/verify-tsk.mjs --node',
      file: 'audit/tsk-node-acceptance.json',
      present: Boolean(evidence),
      tests: evidenceTests,
      totals: evidence?.tests?.totals || null,
      fresh: evidenceFresh,
      replay: { baseline: REPLAY_BASELINE, compareExit: evidence?.replay?.compareExit ?? null },
    },
    reuse,
    p2: { new: p2New, extend: p2Extend },
    gaps,
    reclassified,
    adjudications,
    escape: [],
    escapeNote: 'P2 先完成通用接口，不批量写卡；单卡一次性逻辑在 P5/P6 才可能登记 escape（默认保持为空）。',
    tests: testFiles,
    gates: {
      catalogEntriesCovered: new Set(draft.map(row => row.id)).size === Object.keys(PRIMITIVE_CATALOG).length
        && draft.length === Object.keys(PRIMITIVE_CATALOG).length,
      everyGapPlanned: gaps.length === Object.keys(PRIMITIVE_CATALOG).filter(id => ['new', 'extend'].includes(PRIMITIVE_CATALOG[id].kind)).length,
      everyP2RowDone: p2Rows.every(row => row.status === 'done')
        && reuse.filter(row => row.classification === 'reuse' && row.phase === 'P2').every(row => row.status === 'registered'),
      everyReuseRegistered: reuse.every(row => row.status === 'registered'),
      modulesExist: draft.every(row => row.missing.modules.length === 0),
      exportsPresent: draft.every(row => row.missing.exports.length === 0),
      testsRegistered: draft.every(row => row.missing.tests.length === 0 && row.missing.testsUnregistered.length === 0),
      docsPresent: draft.every(row => row.missing.docs.length === 0),
      cardsReferenced: gaps.every(row => row.mechanisms.length > 0),
      blockedAdjudicated: adjudications.length === BLOCKED_PRIMITIVES.length
        && adjudications.every(row => row.adjudication && row.status === 'done'),
      classificationDifferencesRecorded: reclassified.every(row => row.reason),
      escapeDeclaredEmpty: true,
      noEngineCardCodeBranches: cardCodeModules.length === 0,
      evidencePresent: Boolean(evidence),
      evidenceFresh,
      replayNoDrift: replayOk,
    },
  }
  const catalog = {
    schemaVersion: 1,
    cycle: 'tsk',
    generatedBy: 'tools/audit-tsk-primitives.mjs',
    readOnly: true,
    note: '只读原语目录：来自 P1 机制扫描 + P2 计划；内容层与测试可以引用 id，不得手改本文件。',
    entries: Object.fromEntries(draft.map(row => [row.id, {
      kind: row.catalogKind,
      phase: row.phase,
      classification: row.classification,
      status: row.status,
      modules: row.modules,
      exports: row.exports,
      tests: row.tests,
      api: row.api,
    }])),
  }
  return { plan, catalog }
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isCli) {
  const target = planPath
  const { plan, catalog } = await buildPrimitivePlan()
  const failedGates = Object.entries(plan.gates).filter(([, value]) => value !== true).map(([key]) => key)
  if (process.argv.includes('--write')) {
    emit('primitive-plan', plan)
    writeJson(catalogPath, catalog)
    writeJson(join(RUN, 'primitive-catalog.json'), catalog)
    console.log(`tsk primitive-plan: 已写入（目录 ${plan.counts.catalog} 项：reuse ${plan.counts.reuse} / P2 new ${plan.counts.p2New} + extend ${plan.counts.p2Extend}；P2 全部 done：${plan.gates.everyP2RowDone}）`)
  } else if (process.argv.includes('--check')) {
    if (!existsSync(target) || readJson(target) === null) throw new Error('audit/tsk-primitive-plan.json 不存在：先 --write')
    if (json(readJson(target)) !== json(plan)) throw new Error('audit/tsk-primitive-plan.json 漂移；审阅模块/证据变化后显式 --write')
    if (!existsSync(catalogPath) || json(readJson(catalogPath)) !== json(catalog)) throw new Error('audit/tsk-primitive-catalog.json 漂移；审阅后显式 --write')
    console.log(`tsk primitive-plan: 复算一致（${plan.counts.catalog} 项目录，P2 ${plan.counts.p2} 项 done：${plan.gates.everyP2RowDone}，证据新鲜：${plan.evidence.fresh}）`)
  } else {
    console.log(json(plan))
  }
  if ((process.argv.includes('--write') || process.argv.includes('--check')) && failedGates.length) {
    throw new Error(`tsk primitive-plan 门禁失败：${failedGates.join('、')}（${json(plan.gates)}）`)
  }
}
