#!/usr/bin/env node
// FHV P7：从 story-text 生成 12 份阅读者指南（web/scenario-guides/<scenarioId>.json）。
//
//   node tools/build-fhv-guides.mjs --write   写 12 份指南
//   node tools/build-fhv-guides.mjs --check   逐字节复算（源码/译文变化即失败）
//   node tools/build-fhv-guides.mjs           打印摘要
//
// 事实源：content/campaigns/theFeastOfHemlockVale/story-text.js（tools/import-fhv-story.mjs 生成）
// 与 audit/fhv-scope.json#scenarios[].guideKeys（P1 扫描锁定的每场景指南键集合）。
// 输出与既有指南同形：{ id, campaignId, sourceKind, officialChinese, chineseStatus, chineseGaps,
// sectionCount, guideKeyCount, sources, locales: { zh, en } }；
// locales.<lang> = { intro: [], setup: [], specialRules: [], story: [], resolutions: [] }。
// 文本统一走 import-scenario-guides.mjs 的 guideText/stripEncounterIconHints（与 TSK/TDE 同一清洗口径）。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { FHV_STORY_FILES, FHV_STORY_META } from '../content/campaigns/theFeastOfHemlockVale/story-text.js'
import { chapters } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import { CAMPAIGN_ID, MOD, SCOPE_PATH, json, readJson } from './fhv-campaign-lib.mjs'
import { guideText, stripEncounterIconHints } from './scenario-guide-text.mjs'

const GUIDE_DIR = join(MOD, 'web/scenario-guides')
const GUIDE_FILE_BY_SCENARIO = Object.freeze({
  welcomeToHemlockVale: 'base.json', dawnOfTheSecondDay: 'base.json',
  dawnOfTheFinalDay: 'base.json', preludeTheFinalEvening: 'base.json',
  writtenInRock: 'writtenInRock.json', hemlockHouse: 'hemlockHouse.json',
  theSilentHeath: 'theSilentHeath.json', theLostSister: 'theLostSister.json',
  theThingInTheDepths: 'theThingInTheDepths.json', theTwistedHollow: 'theTwistedHollow.json',
  theLongestNight: 'theLongestNight.json', fateOfTheVale: 'fateOfTheVale.json',
})
// 序曲内容在 base.json 的 preludeN 子树里（P1 guide-scan 同表）。
const PRELUDE_ROOT = Object.freeze({
  welcomeToHemlockVale: 'prelude1', dawnOfTheSecondDay: 'prelude2',
  dawnOfTheFinalDay: 'prelude3', preludeTheFinalEvening: 'prelude4',
})
// 战役级规则（序曲指南合并展示）。
const CAMPAIGN_RULE_ROOTS = Object.freeze([
  'additionalRulesAndClarifications', 'specialRules', 'newKeywords', 'fatigue',
  'campaignLog', 'prologue', 'prelude', 'epilogue',
])
// 各场景「特别规则」顶层键（其余内容归 story）。
const SPECIAL_RULE_ROOTS = new Set([
  'specialRules', 'playingPreludes', 'barriers', 'decoys', 'traps', 'enemyDeckRules',
  'enemyLocations', 'predationTest', 'darkLocations', 'sinkingLocations', 'poisonedMarsh',
  'cosmicEmissary', 'theAbyss', 'shatteredSelf', 'slidingAndSwappingLocations', 'theMineCart',
  'cost',
])
// 不展示的键（查询/标签/UI 辅助；与 TSK 指南 skipped 同口径）。
const SKIPPED_ROOTS = new Set(['tokens', 'label', 'tooltips', 'ui', 'headings', 'key', 'remembered'])
const LANGUAGE_ORDER = Object.freeze(['zh', 'en'])
const REF_PATTERN = /@:theFeastOfHemlockVale\.([A-Za-z0-9_.[\]]+)/g

// 指南不展示 @: 引用：把 theFeastOfHemlockVale.<path> 解析为同文件对应叶子的当前语言文本。
function resolveRefs(text, language, story, depth = 0) {
  if (depth > 4 || typeof text !== 'string' || !text.includes('@:theFeastOfHemlockVale')) return text
  const sections = language === 'zh' ? story.sections : story.sectionsEn
  return text.replace(REF_PATTERN, (match, key) => {
    const raw = sections?.[key] ?? story.sectionsEn?.[key] ?? ''
    const clean = cleanText(raw, language)
    return clean ? resolveRefs(clean, language, story, depth + 1) : ''
  })
}

function resolveBlockRefs(blocks, language, story) {
  return blocks.map(block => {
    const next = { ...block }
    if (typeof next.text === 'string') next.text = resolveRefs(next.text, language, story)
    if (typeof next.title === 'string') next.title = resolveRefs(next.title, language, story)
    if (Array.isArray(next.children)) next.children = resolveBlockRefs(next.children, language, story)
    return next
  })
}

const cleanText = (text, language) => guideText(stripEncounterIconHints(String(text ?? ''), language), language)

// 把 en/zh 子树转成指南 block（{title, children} / {text}）；缺译叶子标记 missing。
function blocksOf(enNode, zhNode, path, language, gaps) {
  if (typeof enNode === 'string') {
    const english = cleanText(enNode, 'en')
    if (!english) return []
    if (language === 'en') return [{ text: english }]
    const zh = typeof zhNode === 'string' ? cleanText(zhNode, 'zh') : ''
    if (zh && /[\u3400-\u9fff]/.test(zh)) return [{ text: zh }]
    gaps.add(path)
    return [{ text: '', missing: 'untranslated', path }]
  }
  if (Array.isArray(enNode)) {
    const out = []
    enNode.forEach((child, index) => out.push(...blocksOf(child, Array.isArray(zhNode) ? zhNode[index] : null, `${path}[${index}]`, language, gaps)))
    return out
  }
  if (!enNode || typeof enNode !== 'object') return []
  const title = typeof enNode.title === 'string' ? enNode.title : ''
  const zhTitle = zhNode && typeof zhNode === 'object' && zhNode.title ? zhNode.title : ''
  const titleText = language === 'en' ? cleanText(title, 'en') : cleanText(zhTitle, 'zh')
  const titleMissing = language === 'zh' && !(titleText && /[\u3400-\u9fff]/.test(titleText))
  const children = []
  if (typeof enNode.body === 'string') children.push(...blocksOf(enNode.body, zhNode?.body, `${path}.body`, language, gaps))
  for (const key of Object.keys(enNode)) {
    if (key === 'title' || key === 'body') continue
    children.push(...blocksOf(enNode[key], zhNode?.[key], `${path}.${key}`, language, gaps))
  }
  if (title && titleMissing) gaps.add(`${path}.title`)
  if (!title) return children
  const block = { title: titleMissing ? '' : titleText, children }
  if (titleMissing) block.missingTitle = true
  return [block]
}

function categoryOf(root) {
  if (root === 'intro' || /^intro/i.test(root)) return 'intro'
  if (root === 'setup' || /^setup/i.test(root)) return 'setup'
  if (root === 'resolutions' || /^resolutions?/i.test(root) || root === 'xp') return 'resolutions'
  if (SPECIAL_RULE_ROOTS.has(root)) return 'specialRules'
  return 'story'
}

function rootsForScenario(scenarioId, story) {
  const preludeRoot = PRELUDE_ROOT[scenarioId]
  if (preludeRoot) {
    const rootKeys = Object.keys(story.en?.[preludeRoot] || {})
    return { roots: [...new Set([...rootKeys, ...CAMPAIGN_RULE_ROOTS.filter(key => key in (story.en || {}))])], preludeRoot }
  }
  const scope = readJson(SCOPE_PATH)
  const scopeScenario = (scope.scenarios || []).find(row => row.id === scenarioId)
  return { roots: (scopeScenario?.guideKeys || Object.keys(story.en || {}))
    .filter(key => !SKIPPED_ROOTS.has(key) && key in (story.en || {})), preludeRoot: null }
}

export function buildFhvGuide(scenarioId) {
  const file = GUIDE_FILE_BY_SCENARIO[scenarioId]
  if (!file) throw new RangeError(`未知铁杉谷盛宴场景 ${scenarioId}`)
  const story = FHV_STORY_FILES[file]
  if (!story) throw new Error(`story-text 缺少指南文件 ${file}`)
  const { roots, preludeRoot } = rootsForScenario(scenarioId, story)
  const guide = {
    id: scenarioId,
    campaignId: CAMPAIGN_ID,
    sourceKind: FHV_STORY_META.sourceKind,
    officialChinese: false,
    chineseStatus: FHV_STORY_META.status,
    chineseGaps: [],
    sectionCount: null,
    guideKeyCount: null,
    sources: FHV_STORY_META.sources,
    locales: {},
  }
  for (const language of LANGUAGE_ORDER) {
    const gaps = new Set()
    const sections = { intro: [], setup: [], specialRules: [], story: [], resolutions: [] }
    for (const root of roots) {
      const category = categoryOf(root)
      const enNode = preludeRoot && story.en?.[preludeRoot]?.[root] !== undefined
        ? story.en[preludeRoot][root]
        : story.en?.[root]
      const zhNode = preludeRoot && story.zh?.[preludeRoot]?.[root] !== undefined
        ? story.zh[preludeRoot][root]
        : story.zh?.[root]
      if (enNode === undefined) continue
      sections[category].push(...blocksOf(enNode, zhNode, preludeRoot ? `${preludeRoot}.${root}` : root, language, gaps))
    }
    for (const key of Object.keys(sections)) sections[key] = resolveBlockRefs(sections[key], language, story)
    guide.locales[language] = sections
    if (language === 'zh') guide.chineseGaps = [...gaps].sort()
  }
  guide.guideKeyCount = roots.length
  guide.sectionCount = LANGUAGE_ORDER.reduce((sum, language) => sum
    + Object.values(guide.locales[language]).reduce((count, list) => count + list.length, 0), 0)
  return guide
}

export function builtGuides() {
  return Object.fromEntries(chapters.map(chapter => [chapter.id, json(buildFhvGuide(chapter.id))]))
}

if (process.argv[1] && process.argv[1].endsWith('build-fhv-guides.mjs')) {
  const guides = builtGuides()
  const gapTotal = Object.values(guides).reduce((sum, body) => sum + JSON.parse(body).chineseGaps.length, 0)
  if (process.argv.includes('--write')) {
    mkdirSync(GUIDE_DIR, { recursive: true })
    for (const [id, body] of Object.entries(guides)) writeFileSync(join(GUIDE_DIR, `${id}.json`), body)
    console.log(`fhv guides: 已写入 ${Object.keys(guides).length} 份（中文缺译块 ${gapTotal}）`)
  } else if (process.argv.includes('--check')) {
    const problems = []
    for (const [id, body] of Object.entries(guides)) {
      const path = join(GUIDE_DIR, `${id}.json`)
      if (!existsSync(path) || readFileSync(path, 'utf8') !== body) problems.push(id)
    }
    if (problems.length) throw new Error(`指南与生成结果不一致：${problems.join('、')}（先 --write 并审阅）`)
    console.log(`fhv guides: 复算一致（12 份，中文缺译块 ${gapTotal}）`)
    if (gapTotal > 0) throw new Error('中文指南仍有缺译块：完成 story-source 翻译后重跑')
  } else {
    console.log(json({ files: Object.keys(guides).length, chineseGaps: gapTotal }))
  }
}
