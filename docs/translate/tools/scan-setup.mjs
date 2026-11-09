#!/usr/bin/env node
// 全战役「关卡设置文本」中文审计扫描器（只读）。
//
// 对象（玩家在本关开始前后读到的设置层文本）：
//   · contentRegistry.listScenarios() 的 name / intro / setup / resolutions（设置面板与故事回退共用）
//   · content/scenario-guides.js 的 GUIDES（设置面板 note / setup 摘要，含行号）
//   · web/scenario-guides/<id>.json 的 setup 段（与 guide 扫描器互证，这里只做「设置层是否齐全」对账）
//
// 用法（在 games/arkhamhorror 下运行）：
//   node docs/translate/tools/scan-setup.mjs           # 摘要
//   node docs/translate/tools/scan-setup.mjs --write   # 写 scan/setup-coverage.json + scan/setup-candidates.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MOD, CAMPAIGN_IDS, CAMPAIGN_NAMES, CJK, analyzeZhText, cjkCount, flattenGuideBlocks, hasCJK,
  lineOfText, loadJson, makeLineIndex, relPath, segmentationCandidates, sha256, stripMarkup, walkFiles,
} from './_shared.mjs'

const OUT_DIR = join(MOD, 'docs/translate/scan')
const GUIDE_DIR = join(MOD, 'web/scenario-guides')
const SETUP_GUIDES_FILE = 'content/scenario-guides.js'
const candidates = []
const stats = { scenarios: 0, campaigns: {}, errors: [], guidesSourceEntries: 0 }

function campaignStat(campaignId) {
  stats.campaigns[campaignId] ??= { campaign: campaignId, name: CAMPAIGN_NAMES[campaignId] || campaignId, scenarios: 0, missingSetup: 0, missingNote: 0, candidates: 0 }
  return stats.campaigns[campaignId]
}

function addCandidate(campaignId, scenarioId, candidate) {
  candidates.push({
    layer: 'setup', campaign: campaignId, campaignName: CAMPAIGN_NAMES[campaignId] || campaignId,
    scenario: scenarioId, file: candidate.file || currentScenarioFile, ...candidate,
  })
  campaignStat(campaignId).candidates++
}

// content/scenario-guides.js 是手写摘要表：按行为键扫描（每个键一行，真实行号）。
function loadSetupGuideSummaries() {
  const filePath = join(MOD, SETUP_GUIDES_FILE)
  const text = readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/)
  const lineOf = makeLineIndex(text)
  const entries = {}
  let current = null
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const open = /^\s{2}([A-Za-z0-9]+):\s*\{\s*$/.exec(line)
    if (open) { current = { id: open[1], line: index + 1, note: null, setup: null }; entries[current.id] = current; continue }
    if (!current) continue
    const field = /^\s{2,}(note|setup):\s*'(.*)',?\s*$/.exec(line)
    if (field) current[field[1]] = { text: field[2].replace(/\\'/g, "'"), line: index + 1 }
    if (/^\s{2}\},?\s*$/.test(line)) current = null
  }
  stats.guidesSourceEntries = Object.keys(entries).length
  return entries
}

// ---------------------------------------------------------------------------
// 1) 注册表场景数据
// ---------------------------------------------------------------------------
const { contentRegistry } = await import(new URL(`file:///${join(MOD, 'content/registered.js').replaceAll('\\', '/')}`))
const scenarios = contentRegistry.listScenarios()
const summaries = loadSetupGuideSummaries()
const scenarioSourceCache = new Map()
let currentScenarioFile = null

function sourceFileOfScenario(scenarioId) {
  if (scenarioSourceCache.has(scenarioId)) return scenarioSourceCache.get(scenarioId)
  let source = walkFiles(join(MOD, 'content/campaigns'), path => path.endsWith('.js'))
    .find(path => new RegExp(`scenarios[/\\\\]${scenarioId}[/\\\\]definition\\.js$`).test(path)) || null
  if (!source) {
    // TIC 没有逐关 definition.js：设置正文由 chapter-definition 从 story-text 构建。
    const ticStory = join(MOD, 'content/campaigns/theInnsmouthConspiracy/story-text.js')
    if (scenarioId === 'thePitOfDespair' || scenarioId === 'theVanishingOfElinaHarper' || scenarioId === 'inTooDeep'
      || scenarioId === 'devilReef' || scenarioId === 'horrorInHighGear' || scenarioId === 'aLightInTheFog'
      || scenarioId === 'theLairOfDagon' || scenarioId === 'intoTheMaelstrom') source = ticStory
  }
  scenarioSourceCache.set(scenarioId, source)
  return source
}

function textUnitsOf(value) {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(textUnitsOf)
  return []
}

for (const entry of scenarios) {
  stats.scenarios++
  const scenario = contentRegistry.getScenarioData(entry.id)
  const campaignId = entry.campaignId
  const campaign = campaignStat(campaignId)
  campaign.scenarios++
  const sourceFile = sourceFileOfScenario(entry.id)
  const locate = fragment => (sourceFile ? lineOfText(sourceFile, fragment) : null)
  const scenarioFile = sourceFile ? relPath(sourceFile) : null
  currentScenarioFile = scenarioFile || 'content/scenario-guides.js'

  const summary = summaries[entry.id] || null
  const guide = loadJson(join(GUIDE_DIR, `${entry.id}.json`))
  const guideZhSetup = flattenGuideBlocks(guide.locales?.zh?.setup, 'locales.zh.setup').filter(leaf => leaf.kind === 'text')
  const guideEnSetup = flattenGuideBlocks(guide.locales?.en?.setup, 'locales.en.setup').filter(leaf => leaf.kind === 'text')

  // ---- 场景名 ----
  if (scenario.name) {
    for (const issue of analyzeZhText(scenario.name, { path: 'scenario.name', kind: 'name', allowEnglishName: true })) {
      if (issue.kind === 'mixed-language-name' || issue.kind === 'untranslated') {
        addCandidate(campaignId, entry.id, { kind: 'scenario-name-mixed', severity: 'low', pointer: 'scenario.name', evidence: scenario.name, line: locate(scenario.name) })
      }
    }
  }
  // ---- intro ----
  const intro = String(scenario.intro || '')
  if (!intro.trim()) {
    addCandidate(campaignId, entry.id, { kind: 'scenario-intro-missing', severity: 'medium', pointer: 'scenario.intro', evidence: '' })
  } else {
    for (const issue of analyzeZhText(intro, { path: 'scenario.intro', kind: 'block' })) {
      addCandidate(campaignId, entry.id, { kind: `intro-${issue.kind}`, severity: issue.severity || 'low', pointer: 'scenario.intro', evidence: issue.evidence || intro.slice(0, 100), line: locate(intro) })
    }
    for (const issue of segmentationCandidates(intro, { kind: 'block' })) {
      addCandidate(campaignId, entry.id, { kind: `intro-${issue.kind}`, severity: issue.severity || 'low', pointer: 'scenario.intro', evidence: issue.evidence || '', line: locate(intro) })
    }
  }
  // ---- setup ----
  const setup = String(scenario.setup || '')
  if (!setup.trim()) {
    campaign.missingSetup++
    addCandidate(campaignId, entry.id, { kind: 'scenario-setup-empty', severity: 'low', pointer: 'scenario.setup', evidence: guideZhSetup.length ? 'guide 有设置正文，场景数据为空' : '场景与指南均无设置正文' })
  } else {
    for (const issue of analyzeZhText(setup, { path: 'scenario.setup', kind: 'block' })) {
      addCandidate(campaignId, entry.id, { kind: `setup-${issue.kind}`, severity: issue.severity || 'low', pointer: 'scenario.setup', evidence: issue.evidence || setup.slice(0, 100), line: locate(setup) })
    }
    for (const issue of segmentationCandidates(setup, { kind: 'block' })) {
      addCandidate(campaignId, entry.id, { kind: `setup-${issue.kind}`, severity: issue.severity || 'low', pointer: 'scenario.setup', evidence: issue.evidence || '', line: locate(setup) })
    }
  }
  // ---- resolutions（设置面板/故事回退） ----
  for (const [key, value] of Object.entries(scenario.resolutions || {})) {
    for (const text of textUnitsOf(value)) {
      if (!text.trim()) {
        addCandidate(campaignId, entry.id, { kind: 'resolution-empty', severity: 'medium', pointer: `scenario.resolutions.${key}`, evidence: key })
        continue
      }
      for (const issue of analyzeZhText(text, { path: `scenario.resolutions.${key}`, kind: 'block' })) {
        addCandidate(campaignId, entry.id, { kind: `resolutions-${issue.kind}`, severity: issue.severity || 'low', pointer: `scenario.resolutions.${key}`, evidence: issue.evidence || text.slice(0, 100), line: locate(text) })
      }
      const label = /^(?:结局|尾声|无结局|Resolution|No Resolution)\s*\d*\s*[：:]/.exec(stripMarkup(text))
      if (label) addCandidate(campaignId, entry.id, { kind: /^[A-Za-z]/.test(label[0]) ? 'resolution-label-untranslated' : 'resolution-label-duplicate', severity: /^[A-Za-z]/.test(label[0]) ? 'high' : 'low', pointer: `scenario.resolutions.${key}`, evidence: label[0], line: locate(text) })
    }
  }
  // ---- 设置面板摘要（content/scenario-guides.js） ----
  if (summary?.note) {
    for (const issue of analyzeZhText(summary.note.text, { path: 'guides.note', kind: 'block' })) {
      addCandidate(campaignId, entry.id, { kind: `note-${issue.kind}`, severity: issue.severity || 'low', pointer: 'guides.note', evidence: issue.evidence || '', file: SETUP_GUIDES_FILE, line: summary.note.line })
    }
  } else {
    campaign.missingNote++
    addCandidate(campaignId, entry.id, { kind: 'setup-note-missing', severity: 'low', pointer: 'guides.note', evidence: '设置面板无说明' })
  }
  if (summary?.setup) {
    for (const issue of analyzeZhText(summary.setup.text, { path: 'guides.setup', kind: 'block' })) {
      addCandidate(campaignId, entry.id, { kind: `guideSetup-${issue.kind}`, severity: issue.severity || 'low', pointer: 'guides.setup', evidence: issue.evidence || '', file: SETUP_GUIDES_FILE, line: summary.setup.line })
    }
  }
  // ---- 设置层齐全性对账 ----
  const hasAnySetup = Boolean(setup.trim() || summary?.setup?.text?.trim() || guideZhSetup.length)
  if (!hasAnySetup) addCandidate(campaignId, entry.id, { kind: 'setup-all-empty', severity: 'medium', pointer: 'locales', evidence: '场景、摘要、指南三处都没有设置正文' })
  if (!guideZhSetup.length && guideEnSetup.length) addCandidate(campaignId, entry.id, { kind: 'guide-setup-missing-zh', severity: 'high', pointer: 'locales.zh.setup', evidence: `en 有 ${guideEnSetup.length} 个设置段落` })
  // 摘要 note 是否引用了不存在的关键词/错误术语（「按图标收齐遭遇组」但指南 setup 无图标）
  if (summary?.setup && /图标/.test(summary.setup.text) && !/\[[a-z][a-z0-9_]*\]/.test(summary.setup.text)) {
    addCandidate(campaignId, entry.id, { kind: 'guideSetup-icon-dangling', severity: 'medium', pointer: 'guides.setup', evidence: summary.setup.text.slice(0, 100), file: SETUP_GUIDES_FILE, line: summary.setup.line })
  }
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
const byKind = candidates.reduce((accumulator, candidate) => {
  accumulator[candidate.kind] = (accumulator[candidate.kind] || 0) + 1
  return accumulator
}, {})
const bySeverity = candidates.reduce((accumulator, candidate) => {
  accumulator[candidate.severity] = (accumulator[candidate.severity] || 0) + 1
  return accumulator
}, {})
const groups = new Map()
for (const candidate of candidates) {
  const key = `${candidate.campaign}\u0000${candidate.scenario}\u0000${candidate.kind}\u0000${sha256(candidate.evidence || '')}`
  if (!groups.has(key)) groups.set(key, { ...candidate, count: 0, scenarios: [] })
  const group = groups.get(key)
  group.count++
  if (group.scenarios.length < 8) group.scenarios.push(candidate.scenario)
}
const grouped = [...groups.values()]
const summary = {
  generatedAt: '2026-11-09',
  scope: { scenarios: stats.scenarios, campaigns: CAMPAIGN_IDS.length, guidesSourceEntries: stats.guidesSourceEntries },
  byKind, bySeverity,
  candidateCount: candidates.length,
  groupedCount: grouped.length,
  campaigns: Object.fromEntries(Object.entries(stats.campaigns).map(([id, value]) => [id, value])),
  sourceErrors: stats.errors,
}

if (process.argv.includes('--write')) {
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'setup-coverage.json'), `${JSON.stringify(summary, null, 2)}\n`)
  writeFileSync(join(OUT_DIR, 'setup-candidates.json'), `${JSON.stringify({ summary, candidates: grouped }, null, 2)}\n`)
  console.log(`setup scan written: ${grouped.length} groups / ${candidates.length} occurrences`)
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, candidates: grouped }, null, 2))
} else {
  console.log(JSON.stringify(summary, null, 2))
}
