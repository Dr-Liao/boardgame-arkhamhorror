#!/usr/bin/env node
// 七循环《地球边缘》P2 原语计划与只读目录。
//
//   node tools/audit-eote-primitives.mjs --write   生成 audit/eote-primitive-plan.json + audit/eote-primitive-catalog.json
//   node tools/audit-eote-primitives.mjs --check   两份账本逐字节复算（模块/导出/证据漂移即失败）
//   node tools/audit-eote-primitives.mjs           打印计划 JSON（不写盘）
//
// 口径（docs/edgeOfTheEarth/README.md §3 P2、docs/edgeOfTheEarth/primitives.md）：
//   · P1 的 60 项原语目录按 phase 分相：P2 = 本轮实现的 extend/new；P3 = 关键词/规则书项；
//     P4 = 交互项；reuse = 既有能力（只登记模块与读点，不重复实现）。
//   · 状态不手写：每个 id 的模块/导出/测试来自 tools/eote-primitive-spec.mjs；
//     `done` 需要模块存在、导出存在、node 验收与 regression 证据都 passed。
//   · 本工具只读代码与证据，不写引擎；`--check` 只比较两份账本，不重写基线。
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MOD, RUN, emit, json, readJson, sha, writeJson } from './eote-migration-lib.mjs'
import { PRIMITIVE_SPEC } from './eote-primitive-spec.mjs'
import { buildScan } from './scan-eote-mechanisms.mjs'
import { PRIMITIVE_CATALOG } from './eote-mechanism-primitives.mjs'
import { ABILITY_KINDS } from '../src/engine/ability.js'
import { EFFECT_PRIMITIVES } from '../src/engine/effects.js'
import { windows } from '../src/engine/windows.js'

const catalogPath = join(MOD, 'audit/eote-primitive-catalog.json')

async function moduleExports(modules) {
  const result = []
  for (const path of modules) {
    if (!existsSync(join(MOD, path))) { result.push({ path, exports: null }); continue }
    const mod = await import(pathToFileURL(join(MOD, path)).href)
    result.push({ path, exports: Object.keys(mod).filter(key => typeof mod[key] === 'function').sort() })
  }
  return result
}

export async function buildPrimitivePlan() {
  const scan = buildScan()
  const nodeAcceptance = existsSync(join(MOD, 'audit/eote-node-acceptance.json')) ? readJson(join(MOD, 'audit/eote-node-acceptance.json')) : null
  const regression = existsSync(join(MOD, 'audit/eote-regression.json')) ? readJson(join(MOD, 'audit/eote-regression.json')) : null
  // P3 关键词/规则书阶段把 catalog 里 7 项 keyword.* 交付为「规则层实现」（关键词清单 + 规则条目 + 卡文直达），
  // 由 audit/eote-rules.json 的 deliveredPrimitives 声明；P3 账本门禁全真才回填 done。
  const rulesAudit = existsSync(join(MOD, 'audit/eote-rules.json')) ? readJson(join(MOD, 'audit/eote-rules.json')) : null




  const rulesPassed = Boolean(rulesAudit?.gates) && Object.values(rulesAudit.gates).every(Boolean)
  const deliveredPrimitives = new Set(rulesPassed ? (rulesAudit.deliveredPrimitives || []) : [])
  // P4 交互阶段把 catalog 里 5 项 interaction.* 交付为「服务端选择事务 + 投影 + 浏览器验收」，
  // 由 audit/eote-interactions.json 的 deliveredPrimitives 声明；P4 账本门禁全真才回填 done。
  const interactionsAudit = existsSync(join(MOD, 'audit/eote-interactions.json')) ? readJson(join(MOD, 'audit/eote-interactions.json')) : null
  const interactionsPassed = Boolean(interactionsAudit?.gates) && Object.values(interactionsAudit.gates).every(Boolean)
  const deliveredInteractions = new Set(interactionsPassed ? (interactionsAudit.deliveredPrimitives || []) : [])
  const rows = []
  for (const entry of PRIMITIVE_SPEC) {
    const catalog = PRIMITIVE_CATALOG[entry.id]
    if (!catalog) throw new Error(`原语 ${entry.id} 不在 P1 目录（audit/eote-mechanism-scan.json#primitives 之外的自由 id 不允许）`)
    const modules = await moduleExports(entry.modules)
    const exportNames = new Set(modules.flatMap(item => item.exports || []))
    const exportsPresent = entry.exports.every(name => exportNames.has(name))
    const modulesPresent = modules.every(item => item.exports !== null)
    const cards = [...new Set(scan.mechanisms
      .filter(mechanism => (mechanism.candidatePrimitives || []).includes(entry.id))
      .flatMap(mechanism => mechanism.cards))].sort()
    const isP2 = entry.phase === 'P2'
    // reuse 项没有新实现，只要模块与读点可定位即 done；P3 由规则书账本回填；P4 交互项按阶段延后。
    const isReuse = entry.phase === 'reuse'
    const done = modulesPresent && exportsPresent
      && nodeAcceptance?.status === 'passed' && regression?.status === 'passed'
    const p3Delivered = entry.phase === 'P3' && rulesPassed && deliveredPrimitives.has(entry.id)
    const p4Delivered = entry.phase === 'P4' && interactionsPassed && deliveredInteractions.has(entry.id)
    const status = (isReuse || isP2) ? (done ? 'done' : 'pending') : (p3Delivered || p4Delivered) ? 'done' : 'deferred'
    rows.push({
      id: entry.id, phase: entry.phase, kind: entry.classification, catalogKind: catalog.kind,
      modules: entry.modules, exports: entry.exports, tests: entry.tests, docs: entry.docs,
      api: entry.api, cards, reason: entry.reason || null,
      exportsPresent, modulesPresent, status,
      evidence: [
        'audit/eote-mechanism-scan.json', 'audit/eote-primitive-catalog.json',
        'audit/eote-node-acceptance.json', 'audit/eote-regression.json',
        ...(p3Delivered ? ['audit/eote-rules.json'] : []),
        ...(p4Delivered ? ['audit/eote-interactions.json'] : []),
      ],
    })
  }
  const byId = new Map(rows.map(row => [row.id, row]))
  const reuse = rows.filter(row => row.phase === 'reuse')
  const p2 = rows.filter(row => row.phase === 'P2')
  const deferred = rows.filter(row => ['P3', 'P4'].includes(row.phase))
  const p3Rows = rows.filter(row => row.phase === 'P3')
  const p4Rows = rows.filter(row => row.phase === 'P4')
  const p2New = p2.filter(row => row.kind !== 'reuse')
  const p2Reused = p2.filter(row => row.kind === 'reuse')
  const mechanismPrimitiveIds = [...new Set(scan.mechanisms
    .filter(mechanism => mechanism.type === 'primitive')
    .flatMap(mechanism => mechanism.candidatePrimitives || []))].sort()
  const unknownCatalogIds = PRIMITIVE_SPEC.map(entry => entry.id).filter(id => !PRIMITIVE_CATALOG[id])
  const missingSpecIds = Object.keys(PRIMITIVE_CATALOG).filter(id => !byId.has(id)).sort()
  const gates = {
    scanPassed: Object.values(scan.gates).every(Boolean),
    catalogCovered: unknownCatalogIds.length === 0 && missingSpecIds.length === 0,
    exportsPresent: p2.every(row => row.modulesPresent && row.exportsPresent),
    reuseLocatable: reuse.every(row => row.modulesPresent && row.exportsPresent),
    nodeAcceptance: nodeAcceptance?.status === 'passed',
    regressionAcceptance: regression?.status === 'passed',
    allNewDone: p2New.every(row => row.status === 'done'),
    // P3 关键词项由 audit/eote-rules.json、P4 交互项由 audit/eote-interactions.json 的 deliveredPrimitives 回填。
    p3Delivered: p3Rows.every(row => row.status === 'done'),
    p4Delivered: p4Rows.every(row => row.status === 'done'),
    deferredPhasesRecorded: ['P3', 'P4'].every(phase => rows.some(row => row.phase === phase)),
    primitiveMechanismsPlanned: mechanismPrimitiveIds.every(id => byId.has(id)),
    noEscape: true,
  }
  const catalog = {
    schemaVersion: 1, cycle: 'eote', phase: 'P2/P3/P4',
    abilityKinds: ABILITY_KINDS,
    effectPrimitives: EFFECT_PRIMITIVES,
    windows: windows(),
    state: {
      scenario: 'state.scenarioFlags.mechanics.eote（可选扩展，version:1，读点不初始化）',
      campaign: 'state.campaign.eote（可选扩展，version:1，读点不初始化）',
      module: 'src/engine/eote-state.js',
      saveMigration: 'src/engine/save-migration.js#migrateState 调用 validateEoteContainers + 各原语 validateEote 校验',
      versioning: '本轮不提升 STATE_SCHEMA_VERSION；形状变化必须显式提升扩展 version 并登记迁移',
    },
    primitives: rows.map(({ id, phase, kind, modules, exports, tests, docs, api }) => ({ id, phase, kind, modules, exports, tests, docs, api })),
    tests: [...new Set(rows.flatMap(row => row.tests))].sort(),
    docs: 'docs/edgeOfTheEarth/primitives.md',
  }
  return {
    schemaVersion: 1, cycle: 'eote', campaignId: 'edgeOfTheEarth', milestone: 'P2/P3/P4',
    step: 'P2 拆分并实现通用原语；P3 关键词与规则书回填 keyword.*；P4 交互与界面对账 interaction.*', generatedBy: 'tools/audit-eote-primitives.mjs',
    docs: 'docs/edgeOfTheEarth/primitives.md',
    scanSha256: sha(json(scan)),
    counts: {
      total: rows.length, reuse: reuse.length, p2: p2.length, p2New: p2New.length, p2Reused: p2Reused.length,
      deferred: deferred.length, p3Delivered: p3Rows.filter(row => row.status === 'done').length,
      p4Delivered: p4Rows.filter(row => row.status === 'done').length,
      byPhase: { reuse: reuse.length, P2: p2.length, P3: deferred.filter(row => row.phase === 'P3').length, P4: deferred.filter(row => row.phase === 'P4').length },
    },
    reuse, new: p2New, escape: [],
    deferred: deferred.map(row => ({ id: row.id, phase: row.phase, kind: row.kind, status: row.status, reason: row.reason, modules: row.modules })),
    p2Reused,
    catalog,
    gates,
  }
}

export function catalogJson(plan) { return json(plan.catalog) }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const plan = await buildPrimitivePlan()
  const target = join(MOD, 'audit/eote-primitive-plan.json')
  if (process.argv.includes('--write')) {
    writeJson(target, plan)
    writeJson(join(RUN, 'primitive-plan.json'), plan)
    writeJson(catalogPath, plan.catalog)
    writeJson(join(RUN, 'primitive-catalog.json'), plan.catalog)
    console.log(`eote primitive-plan: 已写入 ${target}（${plan.counts.total} 项：reuse ${plan.counts.reuse} / P2 ${plan.counts.p2} / P3/P4 ${plan.counts.deferred}）`)
  } else if (process.argv.includes('--check')) {
    if (!existsSync(target) || readJson(target) === null) throw new Error('audit/eote-primitive-plan.json 不存在：先 --write')
    const diskPlan = readJson(target)
    if (json(diskPlan) !== json(plan)) throw new Error('audit/eote-primitive-plan.json 漂移；审阅模块/证据变化后显式 --write')
    if (!existsSync(catalogPath) || json(readJson(catalogPath)) !== json(plan.catalog)) throw new Error('audit/eote-primitive-catalog.json 漂移；审阅后显式 --write')
    console.log(`eote primitive-plan: 复算一致（P2 new ${plan.counts.p2New} 项全部 done：${plan.new.every(row => row.status === 'done')}）`)
  } else {
    console.log(json(plan))
  }
  if (process.argv.includes('--write') || process.argv.includes('--check')) {
    if (Object.values(plan.gates).some(value => value !== true)) throw new Error(`eote primitive-plan 门禁失败：${json(plan.gates)}`)
  }
}
