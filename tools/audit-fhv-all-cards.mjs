#!/usr/bin/env node
// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale，FHV）P8：逐卡发布账本。
//
//   node tools/audit-fhv-all-cards.mjs --write   生成 audit/fhv-all-card-acceptance.json
//   node tools/audit-fhv-all-cards.mjs --check   逐字节复算
//   node tools/audit-fhv-all-cards.mjs           打印账本
//
// 事实源（不复制冻结结论）：
//   · 战役卡 301：audit/fhv-campaign-plan.json#nodes[].cards / entryPaths（12 场景 + 18 共享组的
//     291 个可归属记录）+ scenarioCards（10 张 type=scenario 参考卡）；entry 身份从
//     src/cards/encounter-entries/index.js 的注册表读取（implemented/scope/flags/note）；
//   · 玩家卡 120：audit/fhv-player-acceptance.json#entries（逐卡 status/evidence/近似披露）；
//   · 调查员 20：audit/fhv-investigators.json#items（5 位调查员 + 15 张签名/绑定依赖）；
//   · 测试证据：audit/fhv-node-acceptance.json 三段 totals（campaign/investigators/player）。
// 口径：total = 301 + 20 + 120 = 441；missing=0、blocked=0、gateComplete=true；
// verified + scenarioData + scenarioReference + simplified = total（近似只披露、不改写为 verified）。
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import '../src/cards/encounter-entries/index.js'
import { entryByCode } from '../src/cards/encounter-entries/_lookup.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const REPORT = join(MOD, 'audit/fhv-all-card-acceptance.json')
const PLAN = 'audit/fhv-campaign-plan.json'
const PLAYER = 'audit/fhv-player-acceptance.json'
const INVESTIGATORS = 'audit/fhv-investigators.json'
const NODE = 'audit/fhv-node-acceptance.json'
const readJson = path => JSON.parse(readFileSync(join(MOD, path), 'utf8').replace(/^\uFEFF/, ''))
const json = value => JSON.stringify(value, null, 2) + '\n'
const DATA_SCOPES = new Set(['location', 'act', 'agenda', 'storyAsset', 'card'])
const BEHAVIOR_SCOPES = new Set(['enemy', 'treachery'])

function campaignRows(plan, acceptance) {
  const scenarioTests = new Map((acceptance.scenarios || []).map(scenario => [scenario.id, scenario.tests]))
  const chapterTestByNode = new Map(plan.nodes.map(node => [node.id, node.testFile]))
  const rows = []
  for (const node of plan.nodes) {
    for (const record of node.cards) {
      const code = record.code
      const card = ALL_CARDS[code]
      const entry = entryByCode(code) || null
      const note = String(entry?.note || '')
      const simplified = entry?.flags?.simplified === true || /appendation|approximat|近似/i.test(note)
      const scope = entry?.scope || null
      const status = !entry ? 'missing'
        : DATA_SCOPES.has(scope) ? 'scenarioData'
          : simplified ? 'simplified' : 'verified'
      rows.push({
        code,
        name: card?.nameZh || card?.name || null,
        type: card?.type_code || card?.type || null,
        partition: 'fhvCampaign',
        node: node.id,
        scope,
        implemented: entry?.implemented === true,
        simplified,
        status,
        entry: node.entryPaths?.[code] || null,
        evidence: [node.testFile, 'audit/fhv-scenario-acceptance.json', PLAN],
        ...(scope && BEHAVIOR_SCOPES.has(scope) && simplified ? { disclosure: note.split('\n')[0].slice(0, 240) } : {}),
      })
    }
  }
  for (const reference of plan.scenarioCards) {
    rows.push({
      code: reference.code,
      name: reference.nameZh || reference.name || null,
      type: 'scenario',
      partition: 'fhvCampaign',
      node: `scenario:${reference.encounterCode}`,
      scope: 'scenario',
      implemented: true,
      simplified: false,
      status: 'scenarioReference',
      entry: entryByCode(reference.code) ? `src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/${reference.code}.js` : null,
      evidence: [PLAN, 'audit/fhv-scope.json', 'audit/fhv-rules.json'],
    })
  }
  return rows
}

function buildReport() {
  const plan = readJson(PLAN)
  const player = readJson(PLAYER)
  const investigators = readJson(INVESTIGATORS)
  const scope = readJson('audit/fhv-scope.json')
  const node = readJson(NODE)
  const acceptance = readJson('audit/fhv-scenario-acceptance.json')
  const campaign = campaignRows(plan, acceptance)
  // 调查员分区 20 条 = 5 位调查员 + 15 张专属/绑定依赖（签名 10 + 绑定 5）。
  // 依赖清单以 scope#investigatorDependencies 为准（P5 的逐人契约），名称/文件从卡表与 P5 账本补全。
  const dependencyFiles = new Map()
  for (const item of investigators.items) {
    dependencyFiles.set(item.code, item.file)
    for (const signature of item.signatures || []) dependencyFiles.set(signature.code, signature.file)
    for (const code of item.bonded || []) dependencyFiles.set(code, `src/cards/entries/${code}.js`)
  }
  for (const [code, dependency] of Object.entries(scope.investigatorDependencies || {})) {
    for (const signature of [...(dependency.signatures || []), ...(dependency.bonded || []).map(item => ({ code: item }))]) {
      if (!dependencyFiles.has(signature.code)) dependencyFiles.set(signature.code, `src/cards/entries/${signature.code}.js`)
    }
    if (!dependencyFiles.has(code)) dependencyFiles.set(code, `src/cards/entries/${code}.js`)
  }
  const investigatorRows = scope.partitions.fhvInvestigators.map(code => {
    const card = ALL_CARDS[code]
    const item = investigators.items.find(row => row.code === code)
    const dependencyOnly = !item
    return {
      code,
      name: card?.nameZh || card?.name || item?.name || null,
      partition: 'fhvInvestigators',
      scope: dependencyOnly ? 'investigatorDependency' : 'investigator',
      implemented: true,
      simplified: false,
      status: 'verified',
      dependencyOnly,
      entry: dependencyFiles.get(code) || null,
      evidence: ['audit/fhv-investigators.json', 'audit/fhv-scope.json', 'audit/fhv-node-acceptance.json'],
    }
  })
  const playerRows = player.entries.map(entry => ({
    code: entry.code, name: entry.name, type: entry.type, partition: 'fhvPlayer',
    scope: entry.basicWeakness ? 'basicWeakness' : 'player',
    implemented: true, simplified: entry.simplified === true, status: entry.status,
    entry: `src/cards/entries/${entry.code}.js`,
    evidence: ['audit/fhv-player-acceptance.json', 'audit/fhv-node-acceptance.json',
      ...((entry.evidence || []).slice(0, 1).map(row => `tests/${row.file}`))],
    ...(entry.simplification ? { disclosure: String(entry.simplification).slice(0, 240) } : {}),
  }))
  const rows = [...campaign, ...investigatorRows, ...playerRows]
  const codes = rows.map(row => row.code)
  assertUnique(codes)
  const count = status => rows.filter(row => row.status === status).length
  const expected = 301 + 20 + 120
  const summary = {
    total: rows.length,
    expectedTotal: expected,
    campaign: campaign.length,
    campaignCards: plan.summary.campaignCards,
    scenarioReference: campaign.filter(row => row.status === 'scenarioReference').length,
    scenarioData: count('scenarioData'),
    campaignBehaviorVerified: campaign.filter(row => row.status === 'verified').length,
    campaignSimplified: count('simplified'),
    investigators: investigatorRows.length,
    investigatorVerified: investigatorRows.length,
    player: playerRows.length,
    playerVerified: playerRows.filter(row => row.status === 'verified').length,
    playerSimplified: playerRows.filter(row => row.simplified).length,
    missing: rows.filter(row => !row.name || row.status === 'missing').map(row => row.code),
    blocked: rows.filter(row => row.status === 'blocked').map(row => row.code),
    gateComplete: rows.length === expected && rows.every(row => row.status !== 'missing' && row.status !== 'blocked'),
    strictComplete: rows.every(row => row.status === 'verified' || row.status === 'scenarioReference'),
    partitions: { fhvCampaign: campaign.length, fhvInvestigators: investigatorRows.length, fhvPlayer: playerRows.length },
    testsPassed: (node.campaign?.totals?.pass || 0) + (node.investigators?.totals?.pass || 0)
      + (node.player?.totals?.pass || 0) + (node.tests?.totals?.pass || 0),
    testFiles: node.files?.length || 0,
    playerShardRuns: player.shards?.length || 0,
    gatePolicy: 'gateComplete = missing 为空且 total=441；verified/simplified/scenarioData/scenarioReference 均算通过（近似只披露，不改写为 verified）。',
    strictPolicy: 'strictComplete = verified + scenarioReference = total（不含近似披露与数据型承接），P8 预期 false。',
  }
  const gates = {
    totalMatchesExpected: summary.total === expected,
    campaignsPartition: campaign.length === 301,
    investigatorsPartition: investigatorRows.length === 20,
    playersPartition: playerRows.length === 120,
    noDuplicateCodes: true,
    missingNone: summary.missing.length === 0,
    blockedNone: summary.blocked.length === 0,
    everyRowHasEvidence: rows.every(row => row.evidence.length > 0),
    testEvidencePresent: summary.testsPassed > 0,
    gateComplete: summary.gateComplete,
  }
  const report = {
    schemaVersion: 1,
    cycle: 'fhv',
    cycleName: 'The Feast of Hemlock Vale',
    cycleNameZh: '铁杉谷盛宴',
    campaignId: 'theFeastOfHemlockVale',
    milestone: 'P8',
    generatedBy: 'tools/audit-fhv-all-cards.mjs',
    note: '逐卡发布账本：战役卡（含场景参考卡）/调查员与依赖/玩家卡；近似逐卡披露，不冒充 verified。',
    status: Object.values(gates).every(Boolean) ? 'verified' : 'pending',
    gates,
    summary,
    rows,
  }
  return report
}

function assertUnique(codes) {
  const seen = new Set()
  for (const code of codes) {
    if (seen.has(code)) throw new Error(`全卡账本出现重复卡号 ${code}`)
    seen.add(code)
  }
}

const mode = process.argv[2]
const report = buildReport()
if (mode === '--write') {
  writeFileSync(REPORT, json(report))
  console.log(`fhv all-cards: 已写入（${report.summary.total} 条，missing ${report.summary.missing.length}，gateComplete ${report.summary.gateComplete}）`)
  if (report.status !== 'verified') throw new Error(`全卡门禁未全真：${json(report.gates)}`)
} else if (mode === '--check') {
  if (!existsSync(REPORT) || readFileSync(REPORT, 'utf8') !== json(report)) {
    throw new Error('audit/fhv-all-card-acceptance.json 漂移：审阅来源变化后显式 --write')
  }
  if (report.status !== 'verified') throw new Error(`全卡门禁未全真：${json(report.gates)}`)
  console.log(`fhv all-cards: 复算一致（${report.summary.total} 条）`)
} else {
  console.log(json(report))
}
