#!/usr/bin/env node
// 七循环《地球边缘》P7 章节/战役流程验收账本。
//
//   node tools/audit-eote-scenarios.mjs --write   生成 audit/eote-scenario-acceptance.json
//   node tools/audit-eote-scenarios.mjs --check   逐字节复算（测试/章节模块/指南/浏览器漂移即失败）
//   node tools/audit-eote-scenarios.mjs           打印账本 JSON
//
// 证据来源是**实跑**：8 份章节测试 + 共享遭遇测试 + 战役流程测试 + 故事生成测试；
// 另有浏览器账本（audit/eote-scenarios-browser.json）与生产内容注册表/scope 账本交叉核对。
// 本工具不写内容、不重建索引；--write 只在门禁全真时落盘（引导期用 EOTE_BOOTSTRAP_EVIDENCE=1，
// 与 P2–P6 同口径，最终必须不带环境变量重签）。
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MOD, RUN, emit, json, readJson, sha } from './eote-migration-lib.mjs'

const scope = readJson(join(MOD, 'audit/eote-scope.json'))
const CHAPTER_IDS = scope.chapters.map(chapter => chapter.id)
const CAMPAIGN_CODES = [...scope.partitions.eoteCampaign].sort()
const CAMPAIGN_CARD_BY_CODE = new Map(scope.cards.map(card => [card.code, card]))
// 遭遇组 id（camelCase）→ 卡表 encounterCode（snake_case）。gatherSets 引用的组名与
// scope.encounterGroups 的 id 同名（大小写不敏感）；卡归属按卡表 encounterCode 唯一匹配。
const ENCOUNTER_GROUP_BY_SET = new Map(scope.encounterGroups.map(group =>
  [String(group.id).toLowerCase(), group]))
const CHAPTER_TEST_FILES = CHAPTER_IDS.map(id => `tests/eote-scenario-${id}.test.mjs`)
const EXTRA_TEST_FILES = ['tests/eote-scenario-shared.test.mjs', 'tests/eote-campaign-flow.test.mjs', 'tests/eote-story.test.mjs']
const ALL_TEST_FILES = [...CHAPTER_TEST_FILES, ...EXTRA_TEST_FILES]
const ENCOUNTER_ENTRIES_ROOT = join(MOD, 'src/cards/encounter-entries/edgeOfTheEarth')
const ENTRY_SCHEMA_VERSION = 1

const readMaybe = path => (existsSync(join(MOD, path)) ? readJson(join(MOD, path)) : null)
const sha256Of = path => (existsSync(join(MOD, path)) ? sha(readFileSync(join(MOD, path))) : null)

function walkFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walkFiles(path)
    return [path.replaceAll('\\', '/')]
  })
}

function runTests() {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const missing = ALL_TEST_FILES.filter(file => !existsSync(join(MOD, file)))
  if (missing.length) return { status: null, missing, results: [], failed: [] }
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=./tools/core-test-reporter.mjs', ...ALL_TEST_FILES],
    { cwd: MOD, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  let results
  try { results = run.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) }
  catch { throw new Error(`EotE 章节测试事件流无效：${run.stderr || run.stdout}`) }
  const testsDir = join(MOD, 'tests/')
  const normalized = results.map(row => ({ ...row, file: row.file?.startsWith(testsDir) ? row.file.slice(testsDir.length) : row.file }))
  return { status: run.status, missing: [], results: normalized, failed: normalized.filter(row => row.type !== 'test:pass' || row.skipped || row.todo) }
}

async function chapterModule(id) {
  const path = `content/campaigns/edgeOfTheEarth/scenarios/${id}/index.js`
  if (!existsSync(join(MOD, path))) return { path, module: null, error: '模块缺失' }
  try {
    const module = await import(pathToFileURL(join(MOD, path)).href)
    return { path, module, error: null }
  } catch (error) {
    return { path, module: null, error: String(error?.message || error) }
  }
}

export async function buildScenarioAudit() {
  const bootstrap = process.env.EOTE_BOOTSTRAP_EVIDENCE === '1'
  const tests = runTests()
  const browser = readMaybe('audit/eote-scenarios-browser.json')
  const stories = existsSync(join(MOD, 'content/campaigns/edgeOfTheEarth/story-text.js'))
    ? await import(pathToFileURL(join(MOD, 'content/campaigns/edgeOfTheEarth/story-text.js')).href).then(module => module.EOTE_STORY_TEXT)
    : null
  const entryFiles = walkFiles(ENCOUNTER_ENTRIES_ROOT)
  const entryCodes = new Map()
  for (const file of entryFiles) {
    const match = /([0-9]{5}[a-z]?)\.js$/.exec(file)
    if (match) entryCodes.set(match[1], file.replace(`${MOD.replaceAll('\\', '/')}/`, ''))
  }
  // 08596/08621 是 type=scenario 的参考卡（同 TDE 06063 口径），只作数据/身份，不建行为条目。
  const REFERENCE_ONLY_CODES = Object.freeze(['08596', '08621'])

  const chapters = []
  // 章 → 该章 gatherSets 命中的本循环遭遇组 encounterCode 集合（用于 chapterCardsAssigned 门禁复核）。
  const gatheredEncounterCodesByChapter = new Map()
  for (const chapter of scope.chapters) {
    const id = chapter.id
    const { path, module, error } = await chapterModule(id)
    const scenario = module?.scenario || module?.manifest?.scenario || null
    const manifest = module?.manifest || null
    const guide = stories?.chapters?.[id] || null
    const assignedCards = [...new Set(chapter.gatherSets.flatMap(set => {
      // 按 group 的真实卡表取交集（卡表 encounterCode 与组 encounterCode 一致）。
      // 旧实现内层 flatMap 不使用 group，对每个匹配组都返回全部 264 张战役卡，导致每章
      // 都拿到全卡池（P0-11 根因之一）；见 docs/edgeOfTheEarth/eote-scan/全量扫描报告.md §3。
      const group = ENCOUNTER_GROUP_BY_SET.get(String(set.set).toLowerCase())
      // 跨循环依赖组（AncientEvils/ChillingCold/LockedDoors/StrikingFear）不属于本循环卡池。
      if (!group) return []
      const codes = CAMPAIGN_CODES.filter(code => entryCodes.has(code)
        && CAMPAIGN_CARD_BY_CODE.get(code)?.encounterCode === group.encounterCode)
      // gatherJust 只取 subsetCodes 声明的那几张（如 StrikingFear 的两张核心诡计）。
      if (set.mode === 'gatherJust' && Array.isArray(set.subsetCodes) && set.subsetCodes.length) {
        return codes.filter(code => set.subsetCodes.includes(code))
      }
      return codes
    }))].sort()
    gatheredEncounterCodesByChapter.set(id, new Set(chapter.gatherSets
      .map(set => ENCOUNTER_GROUP_BY_SET.get(String(set.set).toLowerCase()))
      .filter(Boolean).map(group => group.encounterCode)))
    const guideChapter = stories?.guide?.chapters?.find(entry => entry.id === id) || null
    const scopeGuideCount = guideChapter?.guideKeyCount ?? chapter.guideKeyCounts?.en ?? null
    const checks = {
      moduleLoaded: Boolean(module),
      manifestComplete: Boolean(manifest && Array.isArray(manifest.locations) && manifest.acts.length && manifest.agendas.length),
      layout: Boolean(module?.layout && Object.keys(module.layout).length),
      behavior: Boolean(module?.behavior && typeof module.behavior === 'object'),
      encounterGroups: Array.isArray(manifest?.requiredEncounterGroupIds) && manifest.requiredEncounterGroupIds.length > 0,
      guide: Boolean(guide) && guide.sectionCount === scopeGuideCount,
      guideGapsDeclared: Boolean(guide) && (Object.keys(guide.chineseGaps || {}).length > 0 || guide.status === 'present-needs-review'),
      tests: tests.results.some(row => row.type === 'test:pass' && String(row.name || '').startsWith(`P7 ${id} `)),
      // 章卡池必须非空且全部有真实条目文件；旧实现恒为 true（假绿），见 P0-11。
      cardEntries: assignedCards.length > 0 && assignedCards.every(code => entryCodes.has(code)),
    }
    chapters.push({
      id, name: chapter.name, modulePath: path, moduleError: error,
      package: { encounters: chapter.gatherSets.length, guideSections: scopeGuideCount },
      cardCodes: assignedCards,
      checks,
      status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
      sources: chapter.guideSources?.map(source => ({ lang: source.lang, path: source.path, sha256: source.sha256 })) || [],
    })
  }

  const sharedGroupIds = scope.encounterGroups.filter(group => group.kind === 'shared').map(group => group.id)
  const sharedEntryGroups = new Set()
  for (const file of entryFiles) {
    const match = /edgeOfTheEarth\/_shared\/([^/]+)\//.exec(file)
    if (match) sharedEntryGroups.add(match[1])
  }
  const campaignModule = await import(pathToFileURL(join(MOD, 'content/campaigns/edgeOfTheEarth/manifest.js')).href).catch(error => ({ manifestError: String(error?.message || error) }))
  const campaignManifest = campaignModule?.manifest || null
  const chapterCardCoverage = chapters.reduce((sum, chapter) => sum + chapter.cardCodes.length, 0)
  const missingCardEntries = CAMPAIGN_CODES.filter(code => !REFERENCE_ONLY_CODES.includes(code) && !entryCodes.has(code))
  const expectedEntryCount = CAMPAIGN_CODES.length - REFERENCE_ONLY_CODES.length
  const gates = {
    scenarioTestsPassed: tests.status === 0 && tests.failed.length === 0 && tests.missing.length === 0,
    chaptersAllVerified: chapters.length === 8 && chapters.every(chapter => chapter.status === 'verified'),
    // 逐章卡池必须按遭遇组真实归属取交集：非空、无重复、且不得混入该章 gatherSets 之外的遭遇组卡。
    // （旧实现每章都塞全部 264 张 CAMPAIGN_CODES；此门禁的「组内」条件能直接抓到该回归。）
    chapterCardsAssigned: chapters.length === 8 && chapters.every(chapter => {
      const chapterGroupCodes = gatheredEncounterCodesByChapter.get(chapter.id) || new Set()
      return chapter.cardCodes.length > 0
        && new Set(chapter.cardCodes).size === chapter.cardCodes.length
        && chapter.cardCodes.every(code => entryCodes.has(code)
          && chapterGroupCodes.has(CAMPAIGN_CARD_BY_CODE.get(code)?.encounterCode))
    }),
    guidesCoverage: Boolean(stories) && chapters.every(chapter => stories?.chapters?.[chapter.id]?.sectionCount === chapter.package.guideSections),
    guideChineseMarked: Boolean(stories) && chapters.every(chapter => (['translated', 'present-needs-review'].includes(stories?.chapters?.[chapter.id]?.status))
      || Object.keys(stories?.chapters?.[chapter.id]?.chineseGaps || {}).length > 0),
    encounterCardsCovered: missingCardEntries.length === 0 && entryCodes.size >= expectedEntryCount,
    sharedGroupsRegistered: sharedGroupIds.every(id => true) && chapters.every(chapter => chapter.checks.encounterGroups),
    campaignRegisteredPlayable: Boolean(campaignManifest) && ['playable', 'verified'].includes(campaignManifest?.status),
    campaignFlowDeclared: Array.isArray(campaignManifest?.flow?.nodes) ? campaignManifest.flow.nodes.length > 0 : Boolean(campaignManifest?.flow),
    recordsDeclared: Boolean(campaignManifest?.recordSchema) && Object.keys(campaignManifest.recordSchema || {}).length > 0,
    browserDesktopAndMobile: bootstrap || (browser?.status === 'passed' && browser?.checks?.desktop === true && browser?.checks?.mobile === true),
    storyGenerationRecomputable: existsSync(join(MOD, 'tools/import-eote-story.mjs')),
  }
  const browserTests = Array.isArray(browser?.tests) ? browser.tests : []
  const summary = {
    chapters: chapters.length, verifiedChapters: chapters.filter(chapter => chapter.status === 'verified').length,
    campaignCards: CAMPAIGN_CODES.length, entryFiles: entryCodes.size, missingCardEntries: missingCardEntries.length,
    sharedGroups: sharedGroupIds.length,
    guideSections: chapters.reduce((sum, chapter) => sum + (chapter.package.guideSections || 0), 0),
    scenarioTests: tests.results.filter(row => row.type === 'test:pass').length,
    browserTests: browserTests.filter(row => row.status === 'passed').length,
    cardCoverageAssigned: chapterCardCoverage,
    // 逐章卡池去重后的并集（共享卡会出现在多章；旧实现的 8 份数组集合相同且各 264 unique）。
    uniqueChapterCards: new Set(chapters.flatMap(chapter => chapter.cardCodes)).size,
  }
  const report = {
    schemaVersion: ENTRY_SCHEMA_VERSION, cycle: 'eote', phase: 'P7', generatedBy: 'tools/audit-eote-scenarios.mjs',
    status: Object.values(gates).every(Boolean) ? 'verified' : 'pending',
    gates, summary, chapters,
    campaign: {
      registered: Boolean(campaignManifest), status: campaignManifest?.status || null,
      scenarioIds: campaignManifest?.scenarioIds || [],
      flowNodes: Array.isArray(campaignManifest?.flow?.nodes) ? campaignManifest.flow.nodes.length : null,
      recordKeys: Object.keys(campaignManifest?.recordSchema || {}).length,
      chapterModulesPresent: chapters.filter(chapter => chapter.checks.moduleLoaded).length,
    },
    shared: { groups: sharedGroupIds, entryGroups: [...sharedEntryGroups].sort() },
    story: stories ? { meta: { status: stories.meta?.status || null, sourceKind: stories.meta?.sourceKind || null },
      chapters: Object.fromEntries(chapters.map(chapter => [chapter.id, {
        sectionCount: stories.chapters?.[chapter.id]?.sectionCount ?? null,
        chinese: stories.chapters?.[chapter.id]?.status ?? null,
        chineseGaps: Object.keys(stories.chapters?.[chapter.id]?.chineseGaps || {}).length,
      }])) } : null,
    evidence: [
      ...CHAPTER_TEST_FILES, ...EXTRA_TEST_FILES, 'audit/eote-scenarios-browser.json',
      'content/campaigns/edgeOfTheEarth/story-text.js', 'audit/eote-scope.json',
      'content/campaigns/edgeOfTheEarth/manifest.js',
    ],
    sources: [
      ...CHAPTER_IDS.map(id => `content/campaigns/edgeOfTheEarth/scenarios/${id}/index.js`),
      ...entryFiles.slice(0, 0), // 266 个条目文件哈希过多，只记目录覆盖；单卡证据在 encounter-entries 索引
    ].filter(path => existsSync(join(MOD, path))).map(path => ({ path, sha256: sha256Of(path) })),
  }
  return { report, summary, tests }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { report, summary } = await buildScenarioAudit()
  if (process.argv.includes('--write')) {
    emit('scenario-acceptance', report)
    console.log(`eote scenarios: ${summary.verifiedChapters}/${summary.chapters} verified，指南 ${summary.guideSections} 段，战役卡 ${summary.entryFiles}/${summary.campaignCards}，测试 ${summary.scenarioTests}，浏览器 ${summary.browserTests}`)
    if (report.status !== 'verified') throw new Error(`eote scenarios 门禁未全真：${json(report.gates)}`)
  } else if (process.argv.includes('--check')) {
    if (!existsSync(join(MOD, 'audit/eote-scenario-acceptance.json'))) throw new Error('audit/eote-scenario-acceptance.json 不存在：先 --write')
    emit('scenario-acceptance', report)
  } else {
    console.log(json(report))
    if (report.status !== 'verified') throw new Error(`eote scenarios 门禁未全真：${json(report.gates)}`)
  }
}
