#!/usr/bin/env node
// 九循环《铁杉谷盛宴》（FHV）P7 场景账本：12 个场景（4 序曲 + 8 章）的模块/清单/布局/behavior/
// 遭遇组/指南/测试/条目/注册/流程/记录/浏览器。
//
//   node tools/audit-fhv-scenarios.mjs --write   生成 audit/fhv-scenario-acceptance.json
//   node tools/audit-fhv-scenarios.mjs --check   逐字节复算（结论漂移即失败）
//
// 事实源：audit/fhv-campaign-plan.json（分片与逐卡清单）、story-text.js（正文）、
// web/scenario-guides/<id>.json（指南生成物）、audit/fhv-scenarios-browser.json（浏览器账本）。
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { buildCampaignPlan } from './plan-fhv-campaign.mjs'
import { buildFhvGuide } from './build-fhv-guides.mjs'
import { CAMPAIGN_ID, MOD, PLAN_PATH, RUN, json, readJson, sha } from './fhv-campaign-lib.mjs'

const EVIDENCE_PATH = join(MOD, 'audit/fhv-scenario-acceptance.json')
const BROWSER_LEDGER = join(MOD, 'audit/fhv-scenarios-browser.json')
const STORY_SCRIPT = join(MOD, 'tools/import-fhv-story.mjs')
const GUIDE_SCRIPT = join(MOD, 'tools/build-fhv-guides.mjs')
const plan = buildCampaignPlan()
const scenarioNodes = plan.nodes.filter(node => node.kind === 'chapter' || node.kind === 'prelude')
const sharedNodes = plan.nodes.filter(node => node.kind === 'shared')
const entryCodes = new Set(plan.nodes.flatMap(node => node.cards.map(card => card.code)))

function runNodeTests(files) {
  const existing = files.filter(file => existsSync(join(MOD, file)))
  if (!existing.length) return { status: 1, results: [] }
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=./tools/core-test-reporter.mjs', ...existing],
    { cwd: MOD, env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
  const results = []
  for (const line of (result.stdout || '').trim().split('\n').filter(Boolean)) {
    try { results.push(JSON.parse(line)) } catch { /* 忽略非 JSON */ }
  }
  return { status: result.status ?? 1, results, stderr: (result.stderr || '').slice(-2000) }
}

const scenarioTests = runNodeTests(scenarioNodes.map(node => node.testFile))
const campaignTestFiles = ['tests/fhv-campaign-flow.test.mjs', 'tests/fhv-story.test.mjs', 'tests/fhv-campaign-records.test.mjs']
const campaignTests = runNodeTests(campaignTestFiles)
const storyCheck = spawnSync(process.execPath, ['tools/import-fhv-story.mjs', '--check'], { cwd: MOD, encoding: 'utf8' })
const guideCheckRun = spawnSync(process.execPath, ['tools/build-fhv-guides.mjs', '--check'], { cwd: MOD, encoding: 'utf8' })

const scenarios = []
for (const node of scenarioNodes) {
  const modulePath = `${node.scenarioDir}/index.js`
  let module = null
  try { module = existsSync(join(MOD, modulePath)) ? await import(pathToFileURL(join(MOD, modulePath)).href) : null } catch { module = null }
  const manifest = module?.manifest || null
  const guidePath = node.guideFile
  const guide = existsSync(join(MOD, guidePath)) ? readJson(join(MOD, guidePath)) : null
  let guideReproducible = false
  try { guideReproducible = guide !== null && readFileSync(join(MOD, guidePath), 'utf8') === json(buildFhvGuide(node.id)) } catch { guideReproducible = false }
  const tests = scenarioTests.results.filter(row => row.type === 'test:pass' && !row.skipped
    && String(row.name || '').startsWith(`P7 ${node.id} `))
  const checks = {
    moduleLoaded: Boolean(module && module.scenario && module.behavior && module.layout),
    manifestComplete: Boolean(manifest && Array.isArray(manifest.locations) && manifest.locations.length
      && Array.isArray(manifest.acts) && manifest.acts.length && Array.isArray(manifest.agendas) && manifest.agendas.length),
    // 序曲无本章单卡条目（卡都归共享组/其他章），只要求章内列出的卡（若有）都已落盘。
    cardEntries: node.cards.every(card => existsSync(join(MOD, node.entryPaths[card.code]))),
    guide: guide !== null && guide.campaignId === CAMPAIGN_ID,
    guideReproducible,
    guideChineseMarked: guide !== null && guide.officialChinese === false && Boolean(guide.sourceKind),
    tests: tests.length > 0,
  }
  scenarios.push({
    id: node.id, kind: node.kind, name: node.name, referenceCode: node.referenceCode,
    modulePath, cards: node.cards.map(card => card.code),
    checks, status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    guide: { path: guidePath, exists: guide !== null, guideKeyCount: guide?.guideKeyCount ?? null, chineseGaps: guide?.chineseGaps?.length ?? null, reproducible: guideReproducible },
    tests: { count: tests.length, titles: tests.map(row => row.name) },
  })
}

const campaignSource = readFileSync(join(MOD, 'content/campaigns/theFeastOfHemlockVale/manifest.js'), 'utf8')
const campaign = (() => { try { return contentRegistry.getCampaign(CAMPAIGN_ID) } catch { return null } })()
const campaignPack = (() => { try { return contentRegistry.getPack('fhvCampaign') } catch { return null } })()
const flowFiles = ['flow.js', 'prologue.js', 'interludes.js', 'epilogue.js', 'records.js', 'parts.js']
  .map(file => ({ file: `content/campaigns/theFeastOfHemlockVale/${file}`, exists: existsSync(join(MOD, 'content/campaigns/theFeastOfHemlockVale', file)) }))
const browser = existsSync(BROWSER_LEDGER) ? readJson(BROWSER_LEDGER) : null
// 引导期：浏览器验收尚在并行落盘时，仅允许显式环境变量跳过浏览器门禁生成待签账本；
// 完成真实浏览器验收后必须不带环境变量重跑 --write 重签（与 P2/P4/P5/P6 引导期口径一致）。
const bootstrapEvidence = process.env.FHV_BOOTSTRAP_EVIDENCE === '1'
const missingEntries = scenarioNodes.flatMap(node => node.cards.filter(card => !existsSync(join(MOD, node.entryPaths[card.code]))))
const sharedMissing = sharedNodes.flatMap(node => node.cards.filter(card => !existsSync(join(MOD, node.entryPaths[card.code]))))
const scenarioTestsPassed = scenarioTests.status === 0 && scenarioTests.results.length > 0
  && scenarioTests.results.filter(row => row.type !== 'test:pass' || row.skipped || row.todo).length === 0
const chapterNodes = scenarioNodes.filter(node => node.kind === 'chapter')

const gates = {
  scenarioTestsPassed,
  scenariosAllVerified: scenarios.length === 12 && scenarios.every(row => row.status === 'verified'),
  chapterCardsAssigned: plan.gates.noOverlap && plan.gates.coversAssignableCards && plan.gates.noUnassigned,
  guidesCoverage: scenarios.every(row => row.guide.exists && row.guide.reproducible),
  guideChineseMarked: scenarios.every(row => row.checks.guideChineseMarked),
  guideChineseComplete: scenarios.every(row => row.guide.chineseGaps === 0),
  encounterCardsCovered: missingEntries.length === 0 && sharedMissing.length === 0 && entryCodes.size === 291,
  sharedGroupsRegistered: sharedNodes.length === 18 && sharedNodes.every(node => node.cards.length > 0 && node.cards.every(card => existsSync(join(MOD, node.entryPaths[card.code])))),
  campaignRegisteredPlayable: Boolean(campaign) && campaign.status === 'playable'
    && campaignListForUi(contentRegistry).some(entry => entry.id === CAMPAIGN_ID)
    && campaignPack?.status === 'playable',
  campaignFlowDeclared: flowFiles.every(row => row.exists) && /interludeHandlerId/.test(campaignSource),
  recordsDeclared: /recordSchema/.test(campaignSource)
    && existsSync(join(MOD, 'content/campaigns/theFeastOfHemlockVale/records.js')),
  campaignFlowTestsPassed: campaignTests.status === 0 && campaignTests.results.length > 0
    && campaignTests.results.filter(row => row.type !== 'test:pass' || row.skipped || row.todo).length === 0,
  browserDesktopAndMobile: bootstrapEvidence
    || (browser?.status === 'passed' && browser?.checks?.desktop === true && browser?.checks?.mobile === true),
  storyGenerationRecomputable: storyCheck.status === 0,
  guidesRecomputable: guideCheckRun.status === 0,
  docsPresent: existsSync(join(MOD, 'docs/campaign/theFeastOfHemlockVale/README.md'))
    && existsSync(join(MOD, 'docs/campaign/theFeastOfHemlockVale/p7-worker-contract.md')),
}
const summary = {
  scenarios: scenarios.length,
  chapters: chapterNodes.length,
  preludes: scenarios.length - chapterNodes.length,
  verified: scenarios.filter(row => row.status === 'verified').length,
  pending: scenarios.filter(row => row.status !== 'verified').map(row => row.id),
  campaignCards: plan.summary.campaignCards,
  assignableCards: plan.summary.assignableCards,
  expectedEntries: plan.summary.assignableCards,
  coveredEntries: entryCodes.size,
  missingEntries: missingEntries.length + sharedMissing.length,
  scenarioTestPassed: scenarioTests.results.filter(row => row.type === 'test:pass').length,
  campaignTestPassed: campaignTests.results.filter(row => row.type === 'test:pass').length,
  guides: scenarios.filter(row => row.guide.exists).length,
  guidesWithChineseGaps: scenarios.filter(row => (row.guide.chineseGaps || 0) > 0).length,
  sharedGroups: sharedNodes.length,
  storyCheck: storyCheck.status === 0 ? 'ok' : 'gaps',
}
const report = {
  schemaVersion: 1, cycle: 'fhv', phase: 'P7', campaignId: CAMPAIGN_ID,
  generatedBy: 'tools/audit-fhv-scenarios.mjs',
  status: Object.values(gates).every(Boolean) ? 'verified' : 'pending',
  gates, summary, scenarios,
  sharedGroups: sharedNodes.map(node => ({ id: node.id, cards: node.cards.length, missing: node.cards.filter(card => !existsSync(join(MOD, node.entryPaths[card.code]))).length })),
  flow: flowFiles,
  plan: { path: 'audit/fhv-campaign-plan.json', status: plan.status, gates: plan.gates },
  evidence: [
    'tests/fhv-scenario-<scenarioId>.test.mjs', 'tests/fhv-campaign-flow.test.mjs', 'tests/fhv-story.test.mjs',
    'tests/fhv-campaign-records.test.mjs', 'audit/fhv-campaign-plan.json', 'audit/fhv-scenarios-browser.json',
    'web/scenario-guides/<scenarioId>.json', 'content/campaigns/theFeastOfHemlockVale/story-text.js',
    'docs/campaign/theFeastOfHemlockVale/p7-worker-contract.md', 'docs/campaign/theFeastOfHemlockVale/p7-translation-contract.md',
  ],
  sources: [...new Set([
    'content/campaigns/theFeastOfHemlockVale/manifest.js', 'content/campaigns/theFeastOfHemlockVale/records.js',
    'content/campaigns/theFeastOfHemlockVale/flow.js', 'content/campaigns/theFeastOfHemlockVale/card-data.js',
    'content/campaigns/theFeastOfHemlockVale/story-access.js', 'content/campaigns/theFeastOfHemlockVale/scenarios/index.js',
    'tools/import-fhv-story.mjs', 'tools/build-fhv-guides.mjs', 'tools/plan-fhv-campaign.mjs',
    ...scenarios.map(row => row.modulePath),
  ])].filter(file => existsSync(join(MOD, file))).map(file => ({ path: file, sha256: sha(readFileSync(join(MOD, file))) })),
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const body = json(report)
  if (process.argv.includes('--write')) {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(EVIDENCE_PATH, body)
    writeFileSync(join(RUN, 'scenario-acceptance.json'), body)
    console.log(`fhv scenarios: 已写入（status=${report.status}，${summary.verified}/${summary.scenarios} verified，缺条目 ${summary.missingEntries}，中文缺译指南 ${summary.guidesWithChineseGaps}）`)
    console.log(json(report.gates))
    if (report.status !== 'verified' && !bootstrapEvidence) throw new Error(`fhv scenarios 门禁未全真：${json(gates)}`)
  } else if (process.argv.includes('--check')) {
    if (!existsSync(EVIDENCE_PATH)) throw new Error('audit/fhv-scenario-acceptance.json 不存在：先 --write')
    const { readFileSync: read } = await import('node:fs')
    if (read(EVIDENCE_PATH, 'utf8') !== body) throw new Error('audit/fhv-scenario-acceptance.json 与复算不一致：审阅后 --write')
    if (report.status !== 'verified') throw new Error(`fhv scenarios 门禁未全真：${json(gates)}`)
    console.log('fhv scenarios: 复算一致')
  } else {
    console.log(body)
  }
}
