#!/usr/bin/env node
// 十循环《沉没之城》（TDC）P7：从生成物 story-text.js 生成
//   1) content/scenario-guide-sources/<chapterId>.json —— 自有双语指南源（authored 格式）
//   2) web/scenario-guides/<chapterId>.json —— 浏览器读取物（与 tools/import-scenario-guides.mjs 对
//      已注册 authored 关卡生成的结果逐字节一致：JSON.stringify(buildAuthoredScenarioGuide(manifest, source), null, 2) + '\n'）
//
//   node tools/build-tdc-guides.mjs --write   写 10 份指南源 + 10 份阅读物
//   node tools/build-tdc-guides.mjs --check   逐字节复算（译文/来源/生成物漂移即失败）
//   node tools/build-tdc-guides.mjs           打印摘要与中文缺译块
//   node tools/build-tdc-guides.mjs --only <chapterId> [--write|--check]   仅处理一章
//
// 事实源：content/campaigns/theDrownedCity/story-text.js（tools/import-tdc-story.mjs 生成，
// 上游 = 参考 en locale + content/campaigns/theDrownedCity/story-source/zh-CN/ 自译层）。
// 指南分节：intro（含条件分支）/ setup（完整设置）/ specialRules（章内规则，优先展示）/
// story（其余叙事）/ resolutions（全部结局，块 id = 结局键，见 CONTRACT §6）。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { TDC_STORY_FILES, TDC_STORY_META } from '../content/campaigns/theDrownedCity/story-text.js'
import { buildAuthoredScenarioGuide } from './authored-scenario-guide.mjs'
import { CAMPAIGN_ID, CHAPTER_FILE_BY_ID, MOD, json, readText, relative, validTranslation } from './import-tdc-story.mjs'
import { guideText } from './scenario-guide-text.mjs'
import { inspectChapter } from './tdc-p7-readiness.mjs'

export const GUIDE_SOURCE_DIR = join(MOD, 'content/scenario-guide-sources')
export const GUIDE_DIR = join(MOD, 'web/scenario-guides')

// CONTRACT §6：每章结局键（manifest.resolutionIds 的权威口径；readiness 用它校验指南覆盖）。
export const RESOLUTION_IDS = Object.freeze({
  oneLastJob: ['noResolution', 'resolution1'],
  theWesternWall: ['noResolution', 'resolution1', 'resolution2', 'resolution3'],
  theDrownedQuarter: ['noResolution', 'resolution1', 'resolution2', 'resolution3'],
  theApiary: ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'],
  theGrandVault: ['noResolution', 'resolution1', 'resolution2'],
  courtOfTheAncients: ['noResolution', 'resolution1', 'resolution2'],
  obsidianCanyons: ['noResolution', 'resolution1', 'resolution2'],
  sepulchreOfTheSleeper: ['noResolution', 'resolution1'],
  theDoomOfArkhamPartI: ['noResolution', 'resolution1', 'resolution2', 'resolution3'],
  theDoomOfArkhamPartII: ['noResolution', 'resolution1', 'resolution2', 'resolution3'],
})

// 参考 locale 与 CONTRACT §6 结局键的别名：沉睡者墓穴的 locale 用 investigatorDefeat 表示「全员被击败
// 即无结局」的结算正文，而战役清单（manifest.resolutionIds）按 §6 使用 noResolution。指南块 id 必须等于
// manifest 的结局键，因此这里把 locale 别名映射为规范键（正文与结算一字不改）。
export const RESOLUTION_ALIASES = Object.freeze({
  sepulchreOfTheSleeper: { investigatorDefeat: 'noResolution' },
})

export const CHAPTERS = Object.freeze(Object.keys(CHAPTER_FILE_BY_ID).map(id => ({
  id, campaignId: CAMPAIGN_ID, resolutionIds: RESOLUTION_IDS[id], file: CHAPTER_FILE_BY_ID[id],
})))

// 顶层键 → 指南分节。清单外的键归 story（后续剧情）。
const CATEGORY = Object.freeze({
  intro: 'intro',
  setup: 'setup',
  resolutions: 'resolutions',
  rules: 'specialRules',
  specialRules: 'specialRules',
  sunkenStairway: 'specialRules',
  cosmicOmen: 'specialRules',
  hangingShip: 'specialRules',
  magneticSpires: 'specialRules',
  lostPilgrims: 'specialRules',
  theHiveMind: 'specialRules',
  theVaultCore: 'specialRules',
  errata: 'specialRules',
})
// 不进入玩家指南的键（UI 提示/混乱标记文本/工具提示；与 FHV/TIC 的 skipped 同口径）。
const SKIPPED_KEYS = new Set(['label', 'tokens', 'tooltips', 'ui', 'headings', 'glyphs', 'key', 'rlyehMap', 'artifactsEarned'])
const REF_PATTERN = /@:theDrownedCity\.([A-Za-z0-9_.[\]]+)/g
const RESOLUTION_RE = /^([A-Za-z0-9][A-Za-z0-9_-]*)$/

const isRecord = value => value != null && typeof value === 'object' && !Array.isArray(value)
const slug = value => String(value).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'text'
const cleanText = (value, language) => guideText(String(value ?? ''), language)

function resolveRefs(text, language, story, depth = 0) {
  if (depth > 4 || typeof text !== 'string' || !text.includes('@:theDrownedCity')) return text
  const sections = language === 'zh' ? story.sections : story.sectionsEn
  return text.replace(REF_PATTERN, (match, key) => {
    const raw = sections?.[key] ?? story.sectionsEn?.[key] ?? ''
    if (!validTranslation(raw) && language === 'zh') return ''
    const clean = cleanText(raw, language)
    return clean ? resolveRefs(clean, language, story, depth + 1) : ''
  })
}

/** 递归生成一个指南 block：{id, title?, text?, children?}；en/zh 同结构由同一算法保证。 */
function blockOf(node, id, language, story, path, gaps) {
  if (typeof node === 'string') {
    const text = cleanText(resolveRefs(node, language, story), language)
    if (!text) return null
    return { id, text }
  }
  if (Array.isArray(node)) {
    const children = node.map((child, index) => blockOf(child, `item${index + 1}`, language, story, `${path}[${index}]`, gaps)).filter(Boolean)
    return children.length ? { id, children } : null
  }
  if (!isRecord(node)) return null
  const title = typeof node.title === 'string' ? cleanText(resolveRefs(node.title, language, story), language) : ''
  const children = []
  let singleText = null
  const bodyKeys = Object.keys(node).filter(key => key !== 'title' && !SKIPPED_KEYS.has(key))
  // {title, body} 这类单段对象压成标题 + 正文，避免多一层无意义嵌套。
  if (bodyKeys.length === 1 && typeof node[bodyKeys[0]] === 'string' && title) {
    const text = cleanText(resolveRefs(node[bodyKeys[0]], language, story), language)
    if (text) singleText = text
  }
  if (singleText) return { id, ...(title ? { title } : {}), text: singleText }
  for (const key of bodyKeys) {
    const child = blockOf(node[key], slug(key), language, story, `${path}.${key}`, gaps)
    if (child) children.push(child)
  }
  if (!children.length) {
    if (!title) return null
    // 只有标题没有正文的块无法通过 authored 校验：记缺译，交由调用方报错。
    gaps.push(path)
    return null
  }
  return { id, ...(title ? { title } : {}), children }
}

function collectBlocks(story, language, chapterId) {
  const gaps = []
  const sections = { intro: [], setup: [], specialRules: [], story: [], resolutions: [] }
  for (const [root] of Object.entries(story.en || {})) {
    if (SKIPPED_KEYS.has(root)) continue
    const category = CATEGORY[root] || 'story'
    const enNode = story.en[root]
    const zhNode = story.zh?.[root]
    if (root === 'resolutions' && isRecord(enNode)) {
      for (const outcome of Object.keys(enNode)) {
        if (SKIPPED_KEYS.has(outcome)) continue
        const blockId = RESOLUTION_ALIASES[chapterId]?.[outcome] || outcome
        if (!RESOLUTION_RE.test(blockId)) { gaps.push(`resolutions.${outcome}`); continue }
        const block = blockOf(zhNode?.[outcome] ?? enNode[outcome], blockId, language, story, `resolutions.${outcome}`, gaps)
        if (block) sections.resolutions.push(block)
      }
      continue
    }
    const block = blockOf(language === 'zh' ? (zhNode ?? enNode) : enNode, slug(root), language, story, root, gaps)
    if (block) sections[category].push(block)
  }
  return { sections, gaps }
}

// zh 分支里空正文/未译叶子必须报错：authored 校验不接受空正文，也不允许英文冒充中文。
function validateZhCoverage(chapter, story, zhSections, extraGaps) {
  const problems = []
  const walk = (blocks, path) => {
    for (const block of blocks) {
      if (!block.text && !block.children) problems.push(`${path}.${block.id}`)
      if (block.children) walk(block.children, `${path}.${block.id}`)
    }
  }
  for (const [section, blocks] of Object.entries(zhSections)) walk(blocks, section)
  for (const gap of extraGaps) problems.push(gap)
  if (problems.length) {
    throw new Error(`${chapter.id} 中文指南仍有缺译/空正文块（缺 ${problems.length}）：\n${problems.slice(0, 60).join('\n')}${problems.length > 60 ? '\n…' : ''}\n先补齐 story-source/zh-CN/${chapter.file} 再重跑。`)
  }
}

export function buildGuideSource(chapter) {
  const story = TDC_STORY_FILES[chapter.file]
  if (!story) throw new Error(`story-text 缺少章节文件 ${chapter.file}（先 node tools/import-tdc-story.mjs --write）`)
  const source = { id: chapter.id, campaignId: chapter.campaignId, locales: {} }
  const en = collectBlocks(story, 'en', chapter.id)
  const zh = collectBlocks(story, 'zh', chapter.id)
  validateZhCoverage(chapter, story, zh.sections, zh.gaps)
  source.locales.en = en.sections
  source.locales.zh = zh.sections
  return source
}

/** 与 tools/import-scenario-guides.mjs（authored 分支）完全一致的生成口径。 */
export function manifestOf(chapter) {
  return { id: chapter.id, campaignId: chapter.campaignId, resolutionIds: [...chapter.resolutionIds] }
}

export function builtGuides(only = null) {
  const selected = only ? CHAPTERS.filter(chapter => chapter.id === only) : CHAPTERS
  const sources = {}
  const outputs = {}
  for (const chapter of selected) {
    const source = buildGuideSource(chapter)
    const sourceBody = json(source)
    const guide = buildAuthoredScenarioGuide(manifestOf(chapter), source)
    sources[chapter.id] = sourceBody
    outputs[chapter.id] = `${JSON.stringify(guide, null, 2)}\n`
  }
  return { sources, outputs, chapters: selected }
}

/**
 * 注册前预检：用 audit/tdc-scope.json 的章节身份 + 本轮的 resolutionIds 合成 manifest，
 * 走 tools/tdc-p7-readiness.mjs#inspectChapter 的同一口径，证明 Lead 注册后指南即为 ready。
 */
export function readinessReport() {
  const scope = JSON.parse(readText(join(MOD, 'audit/tdc-scope.json')))
  const scopeById = new Map((scope.scenarios || []).map(row => [row.id, row]))
  const readOptional = path => {
    const absolute = join(MOD, path)
    return existsSync(absolute) ? readText(absolute) : null
  }
  return CHAPTERS.map(chapter => {
    const source = scopeById.get(chapter.id)
    const manifest = {
      id: chapter.id,
      campaignId: CAMPAIGN_ID,
      referenceCode: source?.code ?? null,
      status: 'development',
      resolutionIds: [...chapter.resolutionIds],
    }
    const scopeRow = source ?? { id: chapter.id, code: manifest.referenceCode }
    return { id: chapter.id, referenceCode: manifest.referenceCode, ...inspectChapter(scopeRow, CAMPAIGN_ID, manifest, readOptional) }
  })
}

function main(argv) {
  const flag = name => argv.includes(name)
  const value = name => {
    const index = argv.indexOf(name)
    return index >= 0 ? argv[index + 1] : null
  }
  if (flag('--readiness')) {
    const report = readinessReport()
    console.log(json(report))
    const notReady = report.filter(row => row.guideStatus !== 'ready')
    if (notReady.length) throw new Error(`TDC 指南预检未通过：${notReady.map(row => `${row.id}:${row.guideStatus}`).join('、')}`)
    console.log(`tdc guides: 注册前预检通过（${report.length}/${report.length} ready）`)
    return
  }
  const only = value('--only')
  if (only && !RESOLUTION_IDS[only]) throw new Error(`未知 TDC 章节 ${only}`)
  const built = builtGuides(only)
  const ids = built.chapters.map(chapter => chapter.id)
  const sourceDir = GUIDE_SOURCE_DIR
  const guideDir = GUIDE_DIR
  if (flag('--write')) {
    mkdirSync(sourceDir, { recursive: true })
    mkdirSync(guideDir, { recursive: true })
    for (const id of ids) {
      writeFileSync(join(sourceDir, `${id}.json`), built.sources[id])
      writeFileSync(join(guideDir, `${id}.json`), built.outputs[id])
    }
    console.log(`tdc guides: 已写入 ${ids.length} 份指南源 + ${ids.length} 份阅读物（${relative(sourceDir)} / ${relative(guideDir)}）`)
  } else if (flag('--check')) {
    const problems = []
    for (const id of ids) {
      const sourcePath = join(sourceDir, `${id}.json`)
      const guidePath = join(guideDir, `${id}.json`)
      if (!existsSync(sourcePath) || readText(sourcePath) !== built.sources[id]) problems.push(`source:${id}`)
      if (!existsSync(guidePath) || readText(guidePath) !== built.outputs[id]) problems.push(`web:${id}`)
    }
    if (problems.length) throw new Error(`TDC 指南与生成结果不一致：${problems.join('、')}（审阅后 --write）`)
    console.log(`tdc guides: 复算一致（${ids.length} 章，指南源与 web 阅读物逐字节相同）`)
  } else {
    const summary = {
      chapters: ids.length,
      resolutionIds: Object.fromEntries(ids.map(id => [id, built.sources[id].length ? RESOLUTION_IDS[id] : []])),
      sourceKind: 'authored',
      officialChinese: false,
      storyStatus: TDC_STORY_META.status,
      storyChineseGaps: TDC_STORY_META.chineseGapCount,
      sectionCount: Object.fromEntries(ids.map(id => {
        const guide = JSON.parse(built.outputs[id])
        return [id, Object.values(guide.locales.en).reduce((sum, list) => sum + list.length, 0)]
      })),
    }
    console.log(json(summary))
  }
}

if (process.argv[1] && process.argv[1].endsWith('build-tdc-guides.mjs')) main(process.argv.slice(2))
