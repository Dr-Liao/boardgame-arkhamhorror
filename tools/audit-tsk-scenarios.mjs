#!/usr/bin/env node
// 八循环《绯红密钥》（TSK）P7 十章账本：设置/布局/幕议程/遭遇组/指南/测试/注册/浏览器。
//
//   node tools/audit-tsk-scenarios.mjs --write   生成 audit/tsk-scenario-acceptance.json
//   node tools/audit-tsk-scenarios.mjs --check   逐字节复算（结论漂移即失败）
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MOD, RUN, emit, json, readJson, sha } from './tsk-migration-lib.mjs'
import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { buildCampaignPlan } from './plan-tsk-campaign.mjs'
import { buildTskGuide } from './import-scenario-guides.mjs'

const EVIDENCE_PATH = join(MOD, 'audit/tsk-scenario-acceptance.json')
const BROWSER_LEDGER = join(MOD, 'audit/tsk-scenarios-browser.json')
const plan = buildCampaignPlan()
const chapterNodes = plan.nodes.filter(node => node.kind === 'chapter')
const sharedNodes = plan.nodes.filter(node => node.kind === 'shared')
const entryCodes = new Set(plan.nodes.flatMap(node => node.entries.map(entry => entry.code)))

function runChapterTests() {
  const files = chapterNodes.map(node => node.testFile).filter(file => existsSync(join(MOD, file)))
  if (!files.length) return { status: 1, results: [], stderr: 'no chapter test files' }
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=./tools/core-test-reporter.mjs', ...files], {
    cwd: MOD, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  const results = []
  for (const line of (result.stdout || '').trim().split('\n').filter(Boolean)) {
    try { results.push(JSON.parse(line)) } catch { /* 忽略非 JSON 行 */ }
  }
  return { status: result.status ?? 1, results, stderr: (result.stderr || '').slice(-2000) }
}

const storyCheck = spawnSync(process.execPath, ['tools/import-tsk-story.mjs', '--check'], { cwd: MOD, encoding: 'utf8' })
const batch = runChapterTests()
const guideCheck = (() => {
  try {
    return chapterNodes.every(node => {
      const expected = `${JSON.stringify(buildTskGuide(node.id), null, 2)}\n`
      const path = join(MOD, node.guideFile)
      return existsSync(path) && readFileSync(path, 'utf8') === expected
    })
  } catch { return false }
})()

const chapters = []
for (const node of chapterNodes) {
  const scopeChapter = (readJson(join(MOD, 'audit/tsk-scope.json')).chapters || []).find(chapter => chapter.id === node.id) || null
  const guideEnCount = scopeChapter?.guideSources?.find(source => source.lang === 'en')?.keyCount ?? null
  const guide = existsSync(join(MOD, node.guideFile)) ? readJson(join(MOD, node.guideFile)) : null
  const modulePath = node.scenarioDir + '/index.js'
  let module = null
  try { module = existsSync(join(MOD, modulePath)) ? await import(pathToFileURL(join(MOD, modulePath)).href) : null } catch { module = null }
  const manifest = module?.manifest || null
  const tests = batch.results.filter(row => row.type === 'test:pass' && String(row.name || '').startsWith(`P7 ${node.id} `))
  const checks = {
    moduleLoaded: Boolean(module && module.scenario && module.behavior),
    manifestComplete: Boolean(manifest && Array.isArray(manifest.locations) && manifest.locations.length
      && Array.isArray(manifest.acts) && manifest.acts.length && Array.isArray(manifest.agendas) && manifest.agendas.length),
    layout: Boolean(module?.layout && Object.keys(module.layout).length),
    behavior: Boolean(module?.behavior && typeof module.behavior === 'object'),
    encounterGroups: Array.isArray(manifest?.requiredEncounterGroupIds) && manifest.requiredEncounterGroupIds.length > 0,
    guide: Boolean(guide) && guide.campaignId === 'theScarletKeys' && guide.guideKeyCount === guideEnCount,
    guideChineseMarked: Boolean(guide) && guide.officialChinese === false && Boolean(guide.sourceKind),
    tests: tests.length > 0,
    cardEntries: node.cards.length > 0 && node.cards.every(code => entryCodes.has(code)),
  }
  chapters.push({
    id: node.id, name: node.name, nameEn: node.nameEn, referenceCode: node.referenceCode,
    modulePath, cardCodes: node.cards, checks,
    guide: { path: node.guideFile, exists: Boolean(guide), guideKeyCount: guide?.guideKeyCount ?? null, scopeGuideKeyCount: guideEnCount },
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    sources: scopeChapter?.guideSources?.map(source => ({ lang: source.lang, path: source.path, sha256: source.sha256 })) || [],
  })
}

const campaignPack = contentRegistry.getPack('tskCampaign')
const campaign = (() => { try { return contentRegistry.getCampaign('theScarletKeys') } catch { return null } })()
const campaignSource = readFileSync(join(MOD, 'content/campaigns/theScarletKeys/manifest.js'), 'utf8')
const campaignManifest = {
  hasInterlude: /interludeHandlerId/.test(campaignSource),
  hasRecordSchema: /recordSchema/.test(campaignSource),
  status: (/status:\s*'([^']+)'/.exec(campaignSource) || [])[1] || null,
}
const flowFiles = ['flow.js', 'prologue.js', 'interludes.js', 'records.js', 'epilogue.js']
  .map(file => ({ file: `content/campaigns/theScarletKeys/${file}`, exists: existsSync(join(MOD, 'content/campaigns/theScarletKeys', file)) }))
const browser = existsSync(BROWSER_LEDGER) ? readJson(BROWSER_LEDGER) : null
const missingCardEntries = plan.nodes.flatMap(node => node.missingEntries)
const sharedRegistered = sharedNodes.every(node => node.entryCount > 0 && node.missingEntries.length === 0)
const scenarioReferenceCount = plan.scenarioCards.length
const campaignCardCount = plan.summary.campaignCards

const gates = {
  scenarioTestsPassed: batch.status === 0 && batch.results.length > 0
    && batch.results.filter(row => row.type !== 'test:pass' || row.skipped || row.todo).length === 0,
  chaptersAllVerified: chapters.length === 10 && chapters.every(chapter => chapter.status === 'verified'),
  chapterCardsAssigned: plan.gates.noOverlap && plan.gates.coversCampaignCards && plan.gates.noUnassigned
    && plan.nodes.filter(node => node.kind === 'chapter').every(node => node.cards.length > 0),
  guidesCoverage: guideCheck && chapters.every(chapter => chapter.guide.exists),
  guideChineseMarked: chapters.every(chapter => chapter.checks.guideChineseMarked),
  encounterCardsCovered: missingCardEntries.length === 0
    && campaignCardCount - scenarioReferenceCount === entryCodes.size,
  sharedGroupsRegistered: sharedRegistered && sharedNodes.length === 16,
  campaignRegisteredPlayable: Boolean(campaign) && campaign.status === 'playable'
    && campaignListForUi(contentRegistry).some(entry => entry.id === 'theScarletKeys')
    && campaignPack?.status === 'playable',
  campaignFlowDeclared: flowFiles.every(entry => entry.exists) && campaignManifest.hasInterlude,
  recordsDeclared: flowFiles.find(entry => entry.file.endsWith('records.js'))?.exists === true
    && campaignManifest.hasRecordSchema,
  browserDesktopAndMobile: browser?.status === 'passed' && browser?.checks?.desktop === true && browser?.checks?.mobile === true,
  storyGenerationRecomputable: storyCheck.status === 0,
}
const summary = {
  chapters: chapters.length,
  verified: chapters.filter(chapter => chapter.status === 'verified').length,
  pending: chapters.filter(chapter => chapter.status !== 'verified').map(chapter => chapter.id),
  campaignCards: campaignCardCount,
  scenarioReferenceCards: scenarioReferenceCount,
  expectedEntries: campaignCardCount - scenarioReferenceCount,
  coveredEntries: entryCodes.size,
  missingEntries: missingCardEntries.length,
  testsPassed: batch.results.filter(row => row.type === 'test:pass').length,
  guides: chapters.filter(chapter => chapter.guide.exists).length,
}
const report = {
  schemaVersion: 1, cycle: 'tsk', phase: 'P7',
  generatedBy: 'tools/audit-tsk-scenarios.mjs',
  status: Object.values(gates).every(Boolean) ? 'verified' : 'pending',
  gates, summary, chapters,
  sharedGroups: sharedNodes.map(node => ({ id: node.id, encounterCode: node.encounterCode, cards: node.entryCount, missing: node.missingEntries.length })),
  flow: flowFiles,
  evidence: [
    'tests/tsk-scenario-<chapterId>.test.mjs', 'tests/tsk-shared-encounters-a.test.mjs', 'tests/tsk-shared-encounters-b.test.mjs',
    'tests/tsk-campaign-flow.test.mjs', 'tests/tsk-story.test.mjs', 'audit/tsk-campaign-plan.json', 'audit/tsk-scenarios-browser.json',
    'web/scenario-guides/<chapterId>.json', 'content/campaigns/theScarletKeys/story-text.js',
  ],
  sources: [...new Set([
    'content/campaigns/theScarletKeys/manifest.js', 'content/campaigns/theScarletKeys/records.js', 'content/campaigns/theScarletKeys/flow.js',
    'tools/import-tsk-story.mjs', 'tools/import-scenario-guides.mjs', 'tools/plan-tsk-campaign.mjs',
    ...chapters.map(chapter => chapter.modulePath),
  ])].filter(file => existsSync(join(MOD, file))).map(file => ({ path: file, sha256: sha(readFileSync(join(MOD, file))) })),
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const body = json(report)
  if (process.argv.includes('--write')) {
    emit('scenario-acceptance', report)
    console.log(`tsk scenarios: 已写入（status=${report.status}，${summary.verified}/${summary.chapters} verified，缺条目 ${summary.missingEntries}）`)
    console.log(json(report.gates))
    if (report.status !== 'verified') throw new Error(`tsk scenarios 门禁未全真：${json(gates)}`)
  } else if (process.argv.includes('--check')) {
    if (!existsSync(EVIDENCE_PATH)) throw new Error('audit/tsk-scenario-acceptance.json 不存在：先 --write')
    if (readFileSync(EVIDENCE_PATH, 'utf8') !== body) throw new Error('audit/tsk-scenario-acceptance.json 与复算不一致：审阅后 --write')
    if (report.status !== 'verified') throw new Error(`tsk scenarios 门禁未全真：${json(gates)}`)
    console.log('tsk scenarios: 复算一致')
  } else {
    console.log(body)
  }
}
