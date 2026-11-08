#!/usr/bin/env node
/**
 * EOTE 八章「关卡设置」指南面板中文审计扫描器（只读；确定性可复现）。
 *
 * 对象：
 *   · web/scenario-guides/{iceAndDeathPart1..3,fatalMirage,toTheForbiddenPeaks,cityOfTheElderThings,theHeartOfMadnessPart1..2}.json
 *   · 参考 locale：G:/boardgame-hall-ai/参考资源/ArkhamHorror-main/frontend/src/locales/{en,zh}/edgeOfTheEarth/**
 *   · 同一事实源：content/campaigns/edgeOfTheEarth/story-text.js（P7 生成物）
 *   · 渲染路径：web/scenario-setup-view.js、web/locales/zh-CN.panels.js、web/card-text.js
 *
 * 用法（从 Mod 根 games/arkhamhorror 运行）：
 *   node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs              # 打印摘要
 *   node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --print coverage|findings
 *   node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --report gaps|flags|stats|consistency
 *   node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --check      # 磁盘产物与重新计算一致
 *   node docs/edgeOfTheEarth/translate/tools/guides-scan.mjs --write      # 尝试写产物（沙箱只读时自动降级为 print）
 *
 * 本脚本不写任何既有文件；--write 只写 docs/edgeOfTheEarth/translate/guides/ 下两个产物。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative } from 'node:path'

// ---------------------------------------------------------------------------
// 路径与常量
// ---------------------------------------------------------------------------
const HERE = dirname(fileURLToPath(import.meta.url))
const MOD = join(HERE, '..', '..', '..', '..') // games/arkhamhorror
const WORKSPACE = join(MOD, '..', '..') // G:/boardgame-hall-ai
const REF = join(WORKSPACE, '参考资源/ArkhamHorror-main')
const LOCALE_ROOT = join(REF, 'frontend/src/locales')
const GUIDE_DIR = join(MOD, 'web/scenario-guides')
const OUT_DIR = join(MOD, 'docs/edgeOfTheEarth/translate/guides')
const TOOL = 'docs/edgeOfTheEarth/translate/tools/guides-scan.mjs'
const GENERATED_AT = '2026-11-09'
const AUDITOR = 'guides-audit'

const relMod = path => relative(MOD, path).replaceAll('\\', '/')
const sha256 = value => createHash('sha256').update(value).digest('hex')
const readText = path => readFileSync(path, 'utf8')
const readJson = path => JSON.parse(readText(path).replace(/^\uFEFF/, ''))
const truncate = (text, limit = 90) => {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim()
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

// 与 tools/import-eote-story.mjs / tools/eote-guide-scan.mjs 同口径。
const CJK = /[\u3400-\u9fff]/
const EN_SENTENCE = /\b[a-z]{4,}\s+[a-z]{3,}\s+[a-z]{3,}\b/i
const SKIPPED = new Set(['heading', 'tokens', 'label', 'tooltips', 'remembered', 'xp', 'ui', 'messages'])
const SPECIAL_RULE_KEYS = new Set(['specialRules', 'rules', 'theVoid', 'moving', 'hiddenChamber', 'choosingARandomLocation',
  'locationsInTheEncounterDeck', 'threeActsThreeThreads', 'bodyOfAYithian', 'depthLevel', 'pursuit',
  'storyCards', 'noWayOut', 'theSpectralEncounterDeck', 'keys', 'breachesAndIncursions', 'theCosmos',
  'emptySpace', 'callOfMadness', 'seal', 'titanicRamp'])
const SPLIT_SHARED_TOP_LEVEL = {
  iceAndDeath: ['heading', 'tokens', 'icebreakerLanding', 'manifestationsOfEvil'],
  theHeartOfMadness: ['heading', 'tokens', 'specialRules'],
}
const SOURCE_FILES = [
  'base.json',
  'scenarios/iceAndDeath.json',
  'scenarios/fatalMirage.json',
  'scenarios/toTheForbiddenPeaks.json',
  'scenarios/cityOfTheElderThings.json',
  'scenarios/theHeartOfMadness.json',
]

// ---------------------------------------------------------------------------
// 基础工具：叶子遍历 / 路径取值 / 中文三态 / layer / category
// ---------------------------------------------------------------------------
function leaves(value, path = '') {
  if (typeof value === 'string') return [{ path, text: value }]
  if (Array.isArray(value)) return value.flatMap((child, index) => leaves(child, path ? `${path}.${index}` : String(index)))
  return Object.entries(value || {}).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key))
}
function getPath(object, dotted) {
  let current = object
  for (const segment of dotted.split('.')) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[segment]
  }
  return typeof current === 'string' ? current : undefined
}
function chineseStatusOf(zhText) {
  if (zhText === undefined || zhText === null) return 'missing'
  if (!CJK.test(zhText)) return 'untranslated'
  return EN_SENTENCE.test(zhText) ? 'untranslated' : 'present-needs-review'
}
function layerOf(path) {
  const segments = path.split('.')
  const has = pattern => segments.some(segment => pattern.test(segment))
  if (segments[0] === 'specialRules') return 'specialRules'
  if (segments[0] === 'tokens') return 'tokens'
  if (segments[0] === 'heading' || has(/^heading$/i)) return 'heading'
  if (has(/setup/i)) return 'setup'
  if (has(/^intro/i) || has(/intro\d*$/i)) return 'intro'
  if (has(/interlude/i)) return 'interlude'
  if (has(/^resolution/i)) return 'resolutions'
  if (has(/deck/i)) return 'deck'
  if (has(/label|tooltip/i)) return 'labels'
  if (has(/killed|missing|alive|otherwise|present|partner|confronted/i)) return 'characters'
  return 'intro'
}
function categoryOf(key) {
  if (key === 'resolutions') return 'resolutions'
  if (/intro/i.test(key) || ['dreamSelection', 'dreams'].includes(key)) return 'intro'
  if (['setup', 'investigatorSetup', 'standalone', 'regionSetup'].includes(key)) return 'setup'
  if (SPECIAL_RULE_KEYS.has(key)) return 'specialRules'
  return 'story'
}
const stripPart = (path, part) => (part && path.startsWith(`${part}.`) ? path.slice(part.length + 1) : path)
const stripRefs = value => String(value ?? '')
  .replace(/@:[A-Za-z0-9_.-]+/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
const untranslatedChinese = text => EN_SENTENCE.test(text)

// ---------------------------------------------------------------------------
// 读入：8 份指南 JSON + story-text 生成物 + 参考 locale
// ---------------------------------------------------------------------------
const storyModule = await import(pathToFileURL(join(MOD, 'content/campaigns/edgeOfTheEarth/story-text.js')).href)
const STORY = storyModule.EOTE_STORY_TEXT
const STORY_META = storyModule.EOTE_STORY_META

const chapterList = Object.keys(STORY_META.guideKeyCounts).map(id => {
  const match = /^(.*)Part([123])$/.exec(id)
  return {
    id,
    guideId: match ? match[1] : id,
    part: match ? `part${match[2]}` : null,
    guideFile: `scenarios/${match ? match[1] : id}.json`,
  }
})

const refEn = Object.fromEntries(SOURCE_FILES.map(file => [file, readJson(join(LOCALE_ROOT, 'en/edgeOfTheEarth', file))]))
const refZh = Object.fromEntries(SOURCE_FILES.map(file => [file, readJson(join(LOCALE_ROOT, 'zh/edgeOfTheEarth', file))]))

const guides = chapterList.map(chapter => {
  const path = join(GUIDE_DIR, `${chapter.id}.json`)
  const raw = readText(path)
  return { ...chapter, path, raw, json: JSON.parse(raw) }
})

// ---------------------------------------------------------------------------
// JSON 解析副产物：JSON 指针 → 行号（pretty-print 生成的 JSON 与文件顺序一致）
// ---------------------------------------------------------------------------
function pointerLines(raw) {
  const lines = new Map()
  let i = 0
  let line = 1
  const skipWs = () => {
    while (i < raw.length) {
      const c = raw[i]
      if (c === '\n') { line++; i++ } else if (c === ' ' || c === '\t' || c === '\r') i++
      else break
    }
  }
  const readString = () => {
    const start = i
    i++
    while (raw[i] !== '"') { if (raw[i] === '\\') i++; i++ }
    i++
    return JSON.parse(raw.slice(start, i))
  }
  const readValue = pointer => {
    skipWs()
    const c = raw[i]
    if (c === '{') {
      i++
      skipWs()
      if (raw[i] === '}') { i++; return }
      for (;;) {
        skipWs()
        if (raw[i] === '}') { i++; return }
        const key = readString()
        skipWs()
        i++ // ':'
        readValue(pointer ? `${pointer}.${key}` : key)
        skipWs()
        if (raw[i] === ',') i++
      }
    } else if (c === '[') {
      i++
      skipWs()
      if (raw[i] === ']') { i++; return }
      let index = 0
      for (;;) {
        readValue(`${pointer}[${index}]`)
        skipWs()
        if (raw[i] === ',') { i++; index++; continue }
        if (raw[i] === ']') { i++; return }
      }
    } else if (c === '"') {
      const startLine = line
      readString()
      lines.set(pointer, startLine)
    } else {
      while (i < raw.length && !/[,}\]:\s]/.test(raw[i])) i++
    }
  }
  readValue('')
  return lines
}

// ---------------------------------------------------------------------------
// 指南 locales 重建（带源 key 注释）：与 tools/import-scenario-guides.mjs#buildEoteGuide 同逻辑
// ---------------------------------------------------------------------------
function eoteBlocks(enNode, displayNode, gaps, path, language) {
  if (typeof enNode === 'string') {
    const english = stripRefs(enNode)
    if (language === 'en') return english ? [{ text: english, _path: path }] : []
    const gap = gaps[path]
    if (gap) return [{ text: '', missing: gap, path, _path: path }]
    const text = stripRefs(displayNode)
    if (text && untranslatedChinese(text)) return [{ text: '', missing: 'untranslated', path, _path: path }]
    return text ? [{ text, _path: path }] : [{ text: '', missing: 'missing', path, _path: path }]
  }
  if (!enNode || typeof enNode !== 'object' || Array.isArray(enNode)) return []
  const rawTitle = typeof enNode.title === 'string' ? stripRefs(displayNode?.title) : ''
  const title = typeof enNode.title === 'string'
    ? (language === 'en' ? stripRefs(enNode.title)
      : (gaps[`${path}.title`] || untranslatedChinese(rawTitle) ? '' : rawTitle))
    : ''
  if (language === 'zh' && title === '' && rawTitle && gaps[`${path}.title`] == null) gaps[`${path}.title`] = 'untranslated'
  const children = []
  for (const [key, child] of Object.entries(enNode)) {
    if (key === 'title' || SKIPPED.has(key)) continue
    children.push(...eoteBlocks(child, displayNode?.[key], gaps, `${path}.${key}`, language))
  }
  if (children.length) return [{ ...(title ? { title, _titlePath: `${path}.title` } : {}), children, _nodePath: path }]
  return title ? [{ title, _titlePath: `${path}.title`, _nodePath: path }] : []
}
function rebuildGuideLocales(chapter) {
  const story = STORY.chapters[chapter.id]
  const gaps = { ...story.chineseGaps }
  const locales = {}
  for (const language of ['zh', 'en']) {
    const sections = { intro: [], setup: [], specialRules: [], story: [], resolutions: [] }
    for (const key of Object.keys(story.sectionsEn)) {
      if (SKIPPED.has(key)) continue
      sections[categoryOf(key)].push(...eoteBlocks(story.sectionsEn[key], story.sections?.[key], gaps, key, language))
    }
    sections.specialRules = sections.specialRules.filter((block, index, all) =>
      all.findIndex(other => JSON.stringify(other) === JSON.stringify(block)) === index)
    locales[language] = sections
  }
  return { locales, gaps }
}
const stripAnnotations = value => JSON.parse(JSON.stringify(value, (key, child) => (key.startsWith('_') ? undefined : child)))
const deepEqual = (a, b) => JSON.stringify(stripAnnotations(a)) === JSON.stringify(b)

function alignPointers(actual, annotated, pointer, lines, index) {
  if (Array.isArray(annotated)) {
    annotated.forEach((child, i) => alignPointers(actual[i], child, `${pointer}[${i}]`, lines, index))
    return
  }
  if (!annotated || typeof annotated !== 'object') return
  if (annotated._path) index.text.set(annotated._path, { pointer: `${pointer}.text`, line: lines.get(`${pointer}.text`), node: actual })
  if (annotated._titlePath) index.title.set(annotated._titlePath, { pointer: `${pointer}.title`, line: lines.get(`${pointer}.title`), node: actual })
  if (annotated._nodePath) index.node.set(annotated._nodePath, { pointer, line: lines.get(pointer), node: actual })
  for (const [key, child] of Object.entries(annotated)) {
    if (key.startsWith('_')) continue
    alignPointers(actual?.[key], child, key === 'children' ? `${pointer}.children` : `${pointer}.${key}`, lines, index)
  }
}
function collectTitles(locales) {
  const titleNodes = new Map()
  const visit = node => {
    if (Array.isArray(node)) { for (const child of node) visit(child); return }
    if (!node || typeof node !== 'object') return
    if (node.title) titleNodes.set(node._titlePath, node.title)
    for (const value of Object.values(node)) visit(value)
  }
  visit(locales)
  return titleNodes
}

// ---------------------------------------------------------------------------
// 每章覆盖：参考 locale 叶子（与 tools/eote-guide-scan.mjs#buildGuides 同切片）→ 面板块状态
// ---------------------------------------------------------------------------
function chapterCoverage(chapter) {
  const guide = guides.find(entry => entry.id === chapter.id)
  const story = STORY.chapters[chapter.id]
  const en = refEn[chapter.guideFile]
  const zh = refZh[chapter.guideFile]
  const allRows = leaves(en)
  const shared = chapter.part ? SPLIT_SHARED_TOP_LEVEL[chapter.guideId] : null
  const rows = (chapter.part
    ? allRows.filter(row => shared.includes(row.path.split('.')[0]) || row.path.startsWith(`${chapter.part}.`))
    : allRows)
    .map(row => {
      const displayPath = stripPart(row.path, chapter.part)
      const zhRaw = getPath(zh, row.path)
      return {
        sourcePath: row.path,
        path: displayPath,
        layer: layerOf(row.path),
        status: chineseStatusOf(zhRaw),
        enRaw: row.text,
        zhRaw: zhRaw ?? null,
        skipped: displayPath.split('.').some(segment => SKIPPED.has(segment)),
      }
    })

  const rebuilt = rebuildGuideLocales(chapter)
  const titleText = collectTitles(rebuilt.locales.zh)
  const lines = pointerLines(guide.raw)
  const index = {}
  for (const language of ['zh', 'en']) {
    const perLanguage = { text: new Map(), title: new Map(), node: new Map() }
    alignPointers(guide.json.locales[language], rebuilt.locales[language], `locales.${language}`, lines, perLanguage)
    index[language] = perLanguage
  }

  const blocks = rows.map(row => {
    const zhText = index.zh.text.get(row.path)
    const zhTitle = index.zh.title.get(row.path)
    const enText = index.en.text.get(row.path)
    const enTitle = index.en.title.get(row.path)
    let render
    if (row.skipped) render = 'skipped-key'
    else if (row.path.endsWith('.title')) {
      render = zhTitle ? 'title-present' : enTitle ? 'title-dropped' : 'title-absent'
    } else if (zhText) {
      render = zhText.node.missing ? 'text-missing' : zhText.node.text ? 'text-present' : 'text-empty'
    } else render = enText ? 'text-dropped' : 'text-absent'
    const source = zhText || zhTitle || enText || enTitle || null
    return {
      ...row,
      render,
      marker: (zhText?.node?.missing || zhTitle?.node?.missing || null),
      zhText: zhText?.node?.text || '',
      zhTitleText: zhTitle?.node?.title || titleText.get(row.path) || '',
      enTextValue: enText?.node?.text ?? enTitle?.node?.title ?? '',
      pointer: source?.pointer || null,
      line: source?.line || null,
    }
  })

  const drift = []
  for (const language of ['zh', 'en']) {
    if (!deepEqual(rebuilt.locales[language], guide.json.locales[language])) drift.push(`locales.${language}`)
  }
  const rebuiltGapEntries = Object.entries(rebuilt.gaps)
  const recordedGapEntries = Object.entries(guide.json.chineseGaps)
  const gapsDrift = rebuiltGapEntries.length !== recordedGapEntries.length
    || rebuiltGapEntries.some(([key, value]) => guide.json.chineseGaps[key] !== value)

  const expectedGaps = new Map(blocks.filter(row => row.status !== 'present-needs-review').map(row => [row.path, row.status]))
  const recordedGaps = new Map(recordedGapEntries)
  const missingGaps = [...expectedGaps].filter(([path]) => !recordedGaps.has(path)).map(([path, status]) => ({ path, status }))
  const extraGaps = [...recordedGaps].filter(([path]) => !expectedGaps.has(path)).map(([path, status]) => ({ path, status }))
  const statusMismatch = [...expectedGaps]
    .filter(([path, status]) => recordedGaps.has(path) && recordedGaps.get(path) !== status)
    .map(([path, status]) => ({ path, expected: status, recorded: recordedGaps.get(path) }))
  const storyGaps = STORY.chapters[chapter.id].chineseGaps
  const storyGapDiff = JSON.stringify(storyGaps) !== JSON.stringify(guide.json.chineseGaps)

  const counts = {
    keys: blocks.length,
    presentNeedsReview: blocks.filter(row => row.status === 'present-needs-review').length,
    untranslated: blocks.filter(row => row.status === 'untranslated').length,
    missing: blocks.filter(row => row.status === 'missing').length,
  }
  const declared = guide.json.chinese
  const recomputed = {
    total: counts.keys,
    presentNeedsReview: counts.presentNeedsReview,
    untranslated: counts.untranslated,
    missing: counts.missing,
  }
  const countsMatch = JSON.stringify(declared) === JSON.stringify(recomputed)
  const storyCounts = STORY.chapters[chapter.id].chinese
  const storyCountsMatch = JSON.stringify(storyCounts) === JSON.stringify(recomputed)
  const metaCounts = STORY_META.chinese.byChapter[chapter.id]
  const metaCountsMatch = JSON.stringify(metaCounts) === JSON.stringify(recomputed)

  const sourceCheck = {}
  for (const [language, source] of Object.entries(guide.json.sources || {})) {
    const langDir = language === 'zh' ? 'zh' : 'en'
    const bytes = Buffer.from(readText(join(LOCALE_ROOT, langDir, 'edgeOfTheEarth', chapter.guideFile)))
    const expectedPath = `frontend/src/locales/${langDir}/edgeOfTheEarth/${chapter.guideFile}`
    sourceCheck[language] = {
      path: source.path,
      expectedPath,
      bytes: source.bytes,
      actualBytes: bytes.length,
      sha256: source.sha256,
      actualSha256: sha256(bytes),
      ok: source.path === expectedPath && source.bytes === bytes.length && source.sha256 === sha256(bytes),
    }
  }

  const render = {
    textPresent: blocks.filter(row => row.render === 'text-present').length,
    textMissing: blocks.filter(row => row.render === 'text-missing').length,
    textEmpty: blocks.filter(row => row.render === 'text-empty').length,
    textDropped: blocks.filter(row => row.render === 'text-dropped').length,
    textAbsent: blocks.filter(row => row.render === 'text-absent').length,
    titlePresent: blocks.filter(row => row.render === 'title-present').length,
    titleDropped: blocks.filter(row => row.render === 'title-dropped').length,
    titleAbsent: blocks.filter(row => row.render === 'title-absent').length,
    skippedKeys: blocks.filter(row => row.render === 'skipped-key').length,
  }
  return {
    chapter, guide, story, blocks, rebuilt, titleText, drift, gapsDrift, expectedGaps, recordedGaps, missingGaps,
    extraGaps, statusMismatch, storyGapDiff, counts, declared, recomputed, countsMatch, storyCountsMatch,
    metaCountsMatch, sourceCheck, render, meta: {
      chineseStatus: guide.json.chineseStatus,
      sectionCount: guide.json.sectionCount,
      guideKeyCount: guide.json.guideKeyCount,
      expectedSectionCount: STORY_META.guideKeyCounts[chapter.id],
      storySectionCount: story.sectionCount,
      storyGuideKeyCount: story.guideKeyCount,
    },
  }
}

// ---------------------------------------------------------------------------
// 文本级检查：全部只在 zh 面板实际显示的文本上统计；en 只用于对照
// ---------------------------------------------------------------------------
const DUP_PUNCT = [
  ['中句号+西句点', /。\s*\./g],
  ['中句号重复', /。。/g],
  ['中逗号重复', /，，/g],
  ['顿号重复', /、、/g],
  ['中叹号重复', /！！/g],
  ['中问号重复', /？？/g],
  ['全角分号重复', /；；/g],
  ['西逗号重复', /,,/g],
  ['西句点重复', /(?<!\.)\.\.(?!\.)/g],
  ['中冒号重复', /：：/g],
  ['句号后接逗号', /。[，,]/g],
]
const HALF_WIDTH_NEAR_CJK = /[\u3400-\u9fff][,;:?!]|[,;:?!][\u3400-\u9fff]/g
const HTML_ENTITY = /&[a-z#0-9]+;/gi
const HTML_TAG = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?>/gi
const ASCII_ELLIPSIS = /\.\.\./g
const MD_ITALIC = /(^|[\s（(“‘])_([^_\n]{1,80})_(?=$|[\s）)”,。；：！？、])/g
// 参考 locale 的 i18next 花括号转义 `{'{'}frost{'}'}`（生成链应还原成 [frost] 图标）。
const ESC_OPEN_TOKEN = "{'{'}"
const ESC_CLOSE_TOKEN = "{'}'}"
function escapedBraceArtifacts(value) {
  const text = String(value ?? '')
  const found = []
  let index = text.indexOf(ESC_OPEN_TOKEN)
  while (index >= 0) {
    const end = text.indexOf(ESC_CLOSE_TOKEN, index + ESC_OPEN_TOKEN.length)
    if (end < 0) break
    found.push(text.slice(index, end + ESC_CLOSE_TOKEN.length))
    index = text.indexOf(ESC_OPEN_TOKEN, end + ESC_CLOSE_TOKEN.length)
  }
  return found
}

function textStats(text) {
  const value = String(text ?? '')
  const latinRuns = [...value.matchAll(/[A-Za-z][A-Za-z0-9'’.-]*(?:[ \t]+[A-Za-z][A-Za-z0-9'’.-]*)*/g)].map(match => match[0])
  const escapedBraces = escapedBraceArtifacts(value)
  return {
    chars: value.length,
    newlines: (value.match(/\n/g) || []).length,
    blankLines: (value.match(/\n{2,}/g) || []).length,
    bullets: (value.match(/•/g) || []).length,
    tabs: (value.match(/\t/g) || []).length,
    leadingSpace: /^\s/.test(value),
    trailingSpace: /\s$/.test(value),
    doubleSpace: /[^\S\n]{2,}/.test(value),
    nbsp: (value.match(/\u00A0/g) || []).length,
    ideographicSpace: (value.match(/\u3000/g) || []).length,
    fffd: (value.match(/\uFFFD/g) || []).length,
    htmlEntity: (value.match(HTML_ENTITY) || []).length,
    htmlTag: (value.match(HTML_TAG) || []).length,
    latinRuns,
    escapedBraces,
    asciiEllipsis: (value.match(ASCII_ELLIPSIS) || []).length,
    dupPunct: DUP_PUNCT.flatMap(([name, pattern]) => [...value.matchAll(pattern)].map(() => name)),
    halfWidthNearCjk: (value.match(HALF_WIDTH_NEAR_CJK) || []).length,
    quotesOpenDouble: (value.match(/“/g) || []).length,
    quotesCloseDouble: (value.match(/”/g) || []).length,
    quotesOpenCorner: (value.match(/「/g) || []).length,
    quotesCloseCorner: (value.match(/」/g) || []).length,
    quotesOpenSingle: (value.match(/‘/g) || []).length,
    quotesCloseSingle: (value.match(/’/g) || []).length,
    parenOpenFull: (value.match(/（/g) || []).length,
    parenCloseFull: (value.match(/）/g) || []).length,
    parenOpenHalf: (value.match(/\(/g) || []).length,
    parenCloseHalf: (value.match(/\)/g) || []).length,
    bracketOpen: (value.match(/【/g) || []).length,
    bracketClose: (value.match(/】/g) || []).length,
    squareOpen: (value.match(/\[/g) || []).length,
    squareClose: (value.match(/\]/g) || []).length,
    braces: (value.match(/[{}]/g) || []).length,
    underscores: (value.match(/_/g) || []).length,
    mdItalic: [...value.matchAll(MD_ITALIC)].map(match => match[0]),
    dashes: (value.match(/[—–]/g) || []).length,
  }
}

// 图标 token：从 web/card-text.js 的 SYMBOLS 表解析已知图标 token。
const cardTextSource = readText(join(MOD, 'web/card-text.js'))
const symbolBlock = cardTextSource.slice(cardTextSource.indexOf('const SYMBOLS = {'), cardTextSource.indexOf('export function symbolToken'))
const KNOWN_SYMBOLS = new Set([...symbolBlock.matchAll(/^\s{2}([a-zA-Z_]+)\s*:\s*\[/gm)].map(match => match[1]))
const TOKEN = /\[([a-z_]+)\]/gi
const iconTokens = text => [...String(text ?? '').matchAll(TOKEN)].map(match => match[1].toLowerCase())

// 繁体字表（traditional-only；「著」简繁两用，单独排除常见简体词）。
const TRADITIONAL_PAIRS = `
與与 於于 裡里 裏里 祕秘 來来 個个 說说 這这 麼么 麽么 為为 對对 時时 會会 開开 關关 門门 問问 間间 實实 現现
發发 經经 過过 還还 進进 樣样 點点 電电 頭头 題题 體体 戰战 場场 夢梦 見见 覺觉 視视 閃闪 們们 沒没 嗎吗 誰谁
請请 讓让 認认 識识 語语 話话 讀读 寫写 聽听 聲声 響响 媽妈 爺爷 師师 傳传 傷伤 動动 勞劳 勢势 區区 醫医 華华
萬万 專专 業业 東东 絲丝 兩两 嚴严 喪丧 僅仅 從从 復复 徵征 憶忆 應应 懷怀 據据 攜携 數数 斷断 舊旧 曆历 書书
條条 極极 樂乐 樓楼 標标 樹树 檢检 歡欢 殺杀 氣气 溝沟 滅灭 滿满 潔洁 燈灯 牆墙 獨独 獲获 環环 產产 畫画 異异
當当 疊叠 瘋疯 療疗 盡尽 監监 盤盘 確确 礎础 禮礼 種种 稱称 穩稳 窮穷 竊窃 紀纪 純纯 紙纸 級级 綠绿 維维 網网
緊紧 線线 練练 組组 細细 終终 絕绝 給给 統统 綱纲 緣缘 縣县 總总 績绩 繼继 續续 罰罚 聞闻 腦脑 臉脸 臨临 興兴
舉举 艱艰 艙舱 莊庄 葉叶 蓋盖 薩萨 虧亏 蟲虫 術术 衛卫 衝冲 補补 裝装 製制 複复 規规 親亲 觀观 計计 訊讯 討讨
訓训 記记 講讲 許许 論论 設设 訪访 證证 評评 詞词 試试 詩诗 該该 詳详 誠诚 課课 調调 談谈 諮谘 諾诺 謀谋 謝谢
譜谱 議议 護护 變变 讚赞 貝贝 負负 財财 貢贡 貧贫 貨货 販贩 貪贪 責责 貴贵 買买 貸贷 費费 貼贴 資资 賊贼 賓宾
賜赐 賞赏 賠赔 賢贤 賣卖 質质 購购 賽赛 贈赠 贊赞 贏赢 趕赶 趨趋 跡迹 踐践 車车 軌轨 軍军 軒轩 軟软 較较 載载
輔辅 輕轻 輛辆 輪轮 輸输 轉转 轟轰 辭辞 農农 邊边 邏逻 郵邮 鄉乡 醜丑 釋释 針针 釘钉 釣钓 鈴铃 銀银 銅铜 銷销
鋒锋 鋼钢 錄录 錢钱 錫锡 錦锦 鍵键 鍾钟 鎮镇 鏈链 鐘钟 鐵铁 鑄铸 長长 閉闭 閑闲 閱阅 闆板 闡阐 陣阵 陰阴 陳陈
陸陆 陽阳 隊队 階阶 隨随 險险 隱隐 隻只 雜杂 雞鸡 離离 難难 雲云 霧雾 靈灵 靜静 韓韩 頁页 頂顶 項项 順顺 須须
預预 頌颂 領领 頸颈 頻频 顆颗 額额 顏颜 願愿 類类 顧顾 顯显 風风 飛飞 飯饭 飲饮 飽饱 養养 餘余 館馆 馬马 駕驾
騎骑 驚惊 驗验 髮发 鬥斗 魚鱼 鳥鸟 鳴鸣 鴉鸦 鹽盐 麗丽 麥麦 黃黄 齊齐 齒齿 龍龙 龜龟 亞亚 歐欧 灣湾 歲岁 歷历
廣广 廠厂 庫库 廟庙 廢废 廳厅 彎弯 徹彻 惱恼 愛爱 慘惨 慣惯 憲宪 懶懒 戲戏 戶户 擁拥 擇择 擊击 擔担 敗败 敵敌
曉晓 機机 檔档 櫃柜 毀毁 決决 淚泪 測测 渾浑 湯汤 準准 潛潜 澤泽 濁浊 濃浓 濕湿 濫滥 災灾 烏乌 無无 煙烟 煩烦
熱热 燒烧 營营 犧牺 狀状 猶犹 獎奖 獄狱 瑪玛 甦苏 畢毕 癡痴 盜盗 禍祸 禪禅 穀谷 競竞 筆笔 範范 築筑 簡简 籃篮
籌筹 簽签 簾帘 約约 紅红 紋纹 納纳 紐纽 紗纱 紛纷 綁绑 緒绪 編编 緩缓 縱纵 縫缝 縮缩 繞绕 繩绳 繪绘 纏缠 罵骂
罷罢 羅罗 義义 習习 聖圣 聯联 聰聪 職职 肅肃 脅胁 脫脱 腳脚 膚肤 蒼苍 蓮莲 蔣蒋 蕭萧 薑姜 薦荐 藍蓝 藝艺 藥药
蘇苏 蘋苹 蘭兰 處处 號号 褲裤 覓觅 訂订 諱讳 訝讶 診诊 註注 詠咏 誇夸 誌志 誤误 諒谅 謂谓 豐丰 豬猪 貓猫 貫贯
賈贾 賤贱 賬账 賭赌 賴赖 趙赵 躍跃 雛雏 鵝鹅 鷹鹰 豔艳 豎竖 貞贞 負负 貳贰 賁贲 賀贺 賄贿 賂赂 賃赁
`.trim().split(/\s+/).map(pair => ([...pair]))
const TRADITIONAL_MAP = new Map(TRADITIONAL_PAIRS)
const ZHU_OK = /著[作名稱称述顯显書书名]/g

function traditionalChars(text) {
  const value = String(text ?? '')
  const found = new Map()
  for (const [traditional, simplified] of TRADITIONAL_MAP) {
    const count = value.split(traditional).length - 1
    if (count) {
      const previous = found.get(traditional)
      found.set(traditional, { simplified, count: (previous?.count || 0) + count })
    }
  }
  const zhu = (value.split('著').length - 1) - (value.match(ZHU_OK) || []).length
  if (zhu > 0) found.set('著', { simplified: '着', count: zhu })
  return found
}

// ---------------------------------------------------------------------------
// 每章扫描 + 全局候选问题聚合
// ---------------------------------------------------------------------------
const coverages = chapterList.map(chapterCoverage)
const analysis = {
  gaps: [],
  titleDropped: [],
  skippedGaps: [],
  renderAnomalies: [],
  flags: {
    visibleTexts: 0,
    visibleTitles: 0,
    duplicatePunctuation: [],
    traditional: new Map(),
    latinRuns: new Map(),
    multiWordLatin: [],
    latinTitles: [],
    titlePairs: [],
    tokenMismatches: [],
    unknownTokens: [],
    escapedBraces: [],
    literalBraces: [],
    markdownItalic: [],
    underscoreLeaks: [],
    quoteImbalance: [],
    parenImbalance: [],
    bracketImbalance: [],
    spaceAnomalies: [],
    newlineAnomalies: [],
    fffd: [],
    htmlResidue: [],
    asciiEllipsis: [],
    halfWidthNearCjk: [],
    doubleSpace: [],
    bulletAnomalies: [],
    numberMismatches: [],
    lexicon: [],
    textTypos: [],
  },
}
// 台港/异体用词候选（简体语料中应替换；「透过/支援」在简体中亦通行，不列入缺陷）。
const LEXICON_CANDIDATES = ['计画', '网路', '想像']
// 人工确认的漏字/错字（needle 必须能在当前 zh 面板文本中命中，否则自动跳过）。
const TEXT_TYPOS = [
  { needle: '拥有额 1使用', expected: '拥有额外 1 次使用', note: '「额外」漏「外」；同章其余两段为「额外1使用」' },
]
const numericTokens = text => [...String(text ?? '').matchAll(/[0-9]+/g)]
  .map(match => String(Number(match[0]))).sort((a, b) => Number(a) - Number(b))
for (const coverage of coverages) {
  const chapter = coverage.chapter
  const visible = []
  for (const row of coverage.blocks) {
    if (row.skipped) continue
    if (row.render === 'text-present') visible.push({ row, kind: 'text', text: row.zhText })
    else if (row.render === 'title-present') visible.push({ row, kind: 'title', text: row.zhTitleText })
    if (row.status !== 'present-needs-review') {
      analysis.gaps.push({
        chapter: chapter.id,
        path: row.path,
        sourcePath: row.sourcePath,
        layer: row.layer,
        status: row.status,
        render: row.render,
        pointer: row.pointer,
        location: row.line ? `web/scenario-guides/${chapter.id}.json:${row.line}` : null,
        en: truncate(row.enRaw, 160),
      })
      if (row.render === 'skipped-key') analysis.skippedGaps.push({ chapter: chapter.id, path: row.path, status: row.status })
      if (row.render === 'title-dropped') analysis.titleDropped.push({ chapter: chapter.id, path: row.path, layer: row.layer, status: row.status, pointer: row.pointer, location: row.line ? `web/scenario-guides/${chapter.id}.json:${row.line}` : null, en: truncate(row.enRaw, 120) })
    }
    if (['text-absent', 'title-absent', 'text-empty', 'text-dropped'].includes(row.render)) {
      analysis.renderAnomalies.push({ chapter: chapter.id, path: row.path, layer: row.layer, status: row.status, render: row.render, en: truncate(row.enRaw, 120) })
    }
  }
  const index = { text: new Map(), title: new Map() }
  const lines = pointerLines(coverage.guide.raw)
  const perLanguage = { text: new Map(), title: new Map(), node: new Map() }
  alignPointers(coverage.guide.json.locales.en, coverage.rebuilt.locales.en, 'locales.en', lines, perLanguage)
  index.en = perLanguage

  for (const entry of visible) {
    const { row, kind, text } = entry
    const stats = textStats(text)
    const location = row.line ? `web/scenario-guides/${chapter.id}.json:${row.line}` : (row.pointer ? `web/scenario-guides/${chapter.id}.json#${row.pointer}` : null)
    if (kind === 'text') analysis.flags.visibleTexts++
    else analysis.flags.visibleTitles++
    if (stats.dupPunct.length) {
      const byRule = {}
      for (const name of stats.dupPunct) byRule[name] = (byRule[name] || 0) + 1
      analysis.flags.duplicatePunctuation.push({ chapter: chapter.id, path: row.path, layer: row.layer, kind,
        rules: byRule, count: stats.dupPunct.length, location, pointer: row.pointer, sample: truncate(text, 110) })
    }
    for (const [char, info] of traditionalChars(text)) {
      const key = `${char}`
      if (!analysis.flags.traditional.has(key)) analysis.flags.traditional.set(key, { char, simplified: info.simplified, count: 0, chapters: new Set(), samples: [] })
      const record = analysis.flags.traditional.get(key)
      record.count += info.count
      record.chapters.add(chapter.id)
      if (record.samples.length < 4) record.samples.push({ location, pointer: row.pointer, path: row.path, sample: truncate(text, 90) })
    }
    for (const run of stats.latinRuns) {
      if (!analysis.flags.latinRuns.has(run)) analysis.flags.latinRuns.set(run, { run, count: 0, samples: [] })
      const record = analysis.flags.latinRuns.get(run)
      record.count++
      if (record.samples.length < 4) record.samples.push({ chapter: chapter.id, path: row.path, kind, location, context: truncate(text, 120) })
      const isRoman = /^[IVXLC]+$/.test(run)
      const isLetter = /^[A-Za-z]$/.test(run)
      const isTokenArtifact = /^(frost|shelterValue)$/.test(run)
      if (!isRoman && !isLetter && !isTokenArtifact) {
        analysis.flags.multiWordLatin.push({ chapter: chapter.id, path: row.path, kind, run, location, pointer: row.pointer, sample: truncate(text, 120) })
      }
    }
    if (kind === 'title') {
      analysis.flags.titlePairs.push({ chapter: chapter.id, path: row.path, zh: text, en: row.enTextValue, status: row.status, location })
      for (const run of stats.latinRuns) if (/[A-Za-z]{2,}/.test(run)) {
        analysis.flags.latinTitles.push({ chapter: chapter.id, path: row.path, run, location, sample: truncate(text, 80) })
      }
    }
    for (const token of iconTokens(text)) {
      if (!KNOWN_SYMBOLS.has(token)) analysis.flags.unknownTokens.push({ chapter: chapter.id, path: row.path, kind, token, location, pointer: row.pointer, sample: truncate(text, 140) })
    }
    for (const match of stats.escapedBraces) {
      analysis.flags.escapedBraces.push({ chapter: chapter.id, path: row.path, kind, token: match, location, pointer: row.pointer, sample: truncate(text, 120) })
    }
    if (stats.braces > 0) {
      analysis.flags.literalBraces.push({ chapter: chapter.id, path: row.path, kind, count: stats.braces, location, sample: truncate(text, 100) })
    }
    if (stats.mdItalic.length) {
      analysis.flags.markdownItalic.push({ chapter: chapter.id, path: row.path, kind, markers: stats.mdItalic, location, pointer: row.pointer, sample: truncate(text, 120) })
    }
    if (stats.underscores) {
      analysis.flags.underscoreLeaks.push({ chapter: chapter.id, path: row.path, kind, count: stats.underscores, location, pointer: row.pointer, sample: truncate(text, 120) })
    }
    if (stats.quotesOpenDouble !== stats.quotesCloseDouble) {
      analysis.flags.quoteImbalance.push({ chapter: chapter.id, path: row.path, kind, open: stats.quotesOpenDouble, close: stats.quotesCloseDouble, location, pointer: row.pointer, sample: truncate(text, 100) })
    }
    if (stats.parenOpenFull !== stats.parenCloseFull || stats.parenOpenHalf !== stats.parenCloseHalf) {
      analysis.flags.parenImbalance.push({ chapter: chapter.id, path: row.path, kind, full: [stats.parenOpenFull, stats.parenCloseFull], half: [stats.parenOpenHalf, stats.parenCloseHalf], location, sample: truncate(text, 100) })
    }
    if (stats.bracketOpen !== stats.bracketClose || stats.squareOpen !== stats.squareClose) {
      analysis.flags.bracketImbalance.push({ chapter: chapter.id, path: row.path, kind, bracket: [stats.bracketOpen, stats.bracketClose], square: [stats.squareOpen, stats.squareClose], location, sample: truncate(text, 100) })
    }
    if (stats.leadingSpace || stats.trailingSpace || stats.nbsp || stats.ideographicSpace || stats.tabs) {
      analysis.flags.spaceAnomalies.push({ chapter: chapter.id, path: row.path, kind, leading: stats.leadingSpace, trailing: stats.trailingSpace, nbsp: stats.nbsp, ideographic: stats.ideographicSpace, tabs: stats.tabs, location, sample: truncate(text, 100) })
    }
    if (stats.doubleSpace) analysis.flags.doubleSpace.push({ chapter: chapter.id, path: row.path, kind, location, sample: truncate(text, 100) })
    if (stats.fffd) analysis.flags.fffd.push({ chapter: chapter.id, path: row.path, kind, count: stats.fffd, location })
    if (stats.htmlEntity || stats.htmlTag) analysis.flags.htmlResidue.push({ chapter: chapter.id, path: row.path, kind, entities: stats.htmlEntity, tags: stats.htmlTag, location, sample: truncate(text, 100) })
    if (stats.asciiEllipsis) analysis.flags.asciiEllipsis.push({ chapter: chapter.id, path: row.path, kind, count: stats.asciiEllipsis, location, sample: truncate(text, 100) })
    if (stats.halfWidthNearCjk) {
      // fatalMirage 标题「Scenario ???: Fatal Mirage」的 ??? 源自 en 源文有意占位，不计入半/全角缺陷。
      let matches = [...String(text).matchAll(HALF_WIDTH_NEAR_CJK)].map(match => match[0])
      if (String(text).includes('???')) matches = matches.filter(match => match.replace(/[\u3400-\u9fff]/g, '') !== '?')
      if (matches.length) {
        const chars = {}
        for (const match of matches) {
          const half = match.replace(/[\u3400-\u9fff]/g, '')
          chars[half] = (chars[half] || 0) + 1
        }
        analysis.flags.halfWidthNearCjk.push({ chapter: chapter.id, path: row.path, kind, count: matches.length, pointer: row.pointer,
          chars: Object.keys(chars).sort(), samples: [...new Set(matches)].slice(0, 6), location, sample: truncate(text, 100) })
      }
    }
    for (const word of LEXICON_CANDIDATES) {
      if (text.includes(word)) analysis.flags.lexicon.push({ chapter: chapter.id, path: row.path, kind, word, location, pointer: row.pointer, sample: truncate(text, 110) })
    }
    for (const typo of TEXT_TYPOS) {
      if (text.includes(typo.needle)) analysis.flags.textTypos.push({ chapter: chapter.id, path: row.path, kind, pointer: row.pointer,
        needle: typo.needle, expected: typo.expected, note: typo.note, location, sample: truncate(text, 120) })
    }
    // en/zh 对照：图标 token、列表符号、段落数
    const enValue = kind === 'title' ? (row.enTextValue || '') : row.enTextValue
    if (kind === 'text' && enValue) {
      const zhTokens = iconTokens(text).sort()
      const enTokens = iconTokens(enValue).sort()
      if (JSON.stringify(zhTokens) !== JSON.stringify(enTokens)) {
        analysis.flags.tokenMismatches.push({ chapter: chapter.id, path: row.path, location, zh: zhTokens, en: enTokens, sample: truncate(text, 100), enSample: truncate(enValue, 100) })
      }
      const zhStats = stats
      const enStats = textStats(enValue)
      if (enStats.blankLines > zhStats.blankLines) {
        analysis.flags.newlineAnomalies.push({ chapter: chapter.id, path: row.path, location, zhBlank: zhStats.blankLines, enBlank: enStats.blankLines, sample: truncate(text, 100) })
      }
      if (enStats.bullets !== zhStats.bullets) {
        analysis.flags.bulletAnomalies.push({ chapter: chapter.id, path: row.path, location, zhBullets: zhStats.bullets, enBullets: enStats.bullets, sample: truncate(text, 80) })
      }
      // 数字对照：阿拉伯数字多重集合（中文数词转换后）与 en 不一致时列为人工复核候选。
      const zhNumbers = numericTokens(text)
      const enNumbers = numericTokens(enValue)
      if (JSON.stringify(zhNumbers) !== JSON.stringify(enNumbers)) {
        analysis.flags.numberMismatches.push({ chapter: chapter.id, path: row.path, location, zhNumbers, enNumbers, sample: truncate(text, 110), enSample: truncate(enValue, 110) })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 战役共享段（base.json）：不属指南面板渲染范围，作为补译 backlog 单列。
// ---------------------------------------------------------------------------
function campaignSharedBacklog() {
  const en = refEn['base.json']
  const zh = refZh['base.json']
  const rows = leaves(en).map(row => {
    const zhRaw = getPath(zh, row.path)
    return {
      path: row.path,
      topLevel: row.path.split('.')[0],
      layer: layerOf(row.path),
      status: chineseStatusOf(zhRaw),
      en: truncate(row.text, 160),
    }
  })
  const groups = new Map()
  for (const row of rows) {
    if (!groups.has(row.topLevel)) groups.set(row.topLevel, { topLevel: row.topLevel, keys: 0, presentNeedsReview: 0, untranslated: 0, missing: 0, backlog: [] })
    const group = groups.get(row.topLevel)
    group.keys++
    if (row.status === 'present-needs-review') group.presentNeedsReview++
    else {
      if (row.status === 'untranslated') group.untranslated++
      else group.missing++
      group.backlog.push(row)
    }
  }
  const totals = { keys: rows.length, presentNeedsReview: rows.filter(row => row.status === 'present-needs-review').length, untranslated: rows.filter(row => row.status === 'untranslated').length, missing: rows.filter(row => row.status === 'missing').length }
  return { source: 'frontend/src/locales/en/edgeOfTheEarth/base.json', totals, groups: [...groups.values()] }
}
const campaignShared = campaignSharedBacklog()

// ---------------------------------------------------------------------------
// 渲染路径证据（动态取行号，避免写死过期）
// ---------------------------------------------------------------------------
function findLine(file, needle, from = 0) {
  const text = readText(join(MOD, file))
  const index = text.indexOf(needle, from)
  if (index < 0) return null
  return text.slice(0, index).split('\n').length
}
const renderEvidence = {
  setupView: {
    file: 'web/scenario-setup-view.js',
    missingMarker: findLine('web/scenario-setup-view.js', "t('setup.chineseMissing')"),
    textBranch: findLine('web/scenario-setup-view.js', 'block.text ? paragraphs(block.text)'),
    titleBranch: findLine('web/scenario-setup-view.js', 'block.title ? h(\'h4\''),
    localeChoice: findLine('web/scenario-setup-view.js', "loaded?.guide?.locales[currentLanguage()"),
    layers: {
      specialRules: findLine('web/scenario-setup-view.js', 'guide.specialRules.length'),
      intro: findLine('web/scenario-setup-view.js', 'guide.intro.length'),
      setup: findLine('web/scenario-setup-view.js', "section(t('setup.steps')"),
      story: findLine('web/scenario-setup-view.js', 'spoilerSection(t(\'setup.storySpoilers\')'),
      resolutions: findLine('web/scenario-setup-view.js', "spoilerSection(t('setup.resolutionSpoilers')"),
    },
  },
  panels: {
    file: 'web/locales/zh-CN.panels.js',
    chineseMissing: findLine('web/locales/zh-CN.panels.js', "'setup.chineseMissing': '中文待补'"),
  },
  cardText: {
    file: 'web/card-text.js',
    symbolSplit: findLine('web/card-text.js', 'split(/(\\[\\[[^\\]]+\\]\\]|\\[[a-z_]+\\])/gi)'),
    unknownTokenFallback: findLine('web/card-text.js', 'return links ? linkedText(h,part) : part'),
  },
}

// ---------------------------------------------------------------------------
// 输出：摘要
// ---------------------------------------------------------------------------
function summarize() {
  const totals = { keys: 0, presentNeedsReview: 0, untranslated: 0, missing: 0, textPresent: 0, textMissing: 0,
    textEmpty: 0, textDropped: 0, textAbsent: 0, titlePresent: 0, titleDropped: 0, titleAbsent: 0, skippedKeys: 0, recordedGaps: 0 }
  for (const coverage of coverages) {
    totals.keys += coverage.counts.keys
    totals.presentNeedsReview += coverage.counts.presentNeedsReview
    totals.untranslated += coverage.counts.untranslated
    totals.missing += coverage.counts.missing
    for (const key of ['textPresent', 'textMissing', 'textEmpty', 'textDropped', 'textAbsent', 'titlePresent', 'titleDropped', 'titleAbsent', 'skippedKeys']) totals[key] += coverage.render[key]
    totals.recordedGaps += coverage.recordedGaps.size
  }
  return {
    totals,
    campaignShared: campaignShared.totals,
    chapters: coverages.map(coverage => ({
      id: coverage.chapter.id,
      guideFile: `web/scenario-guides/${coverage.chapter.id}.json`,
      counts: coverage.counts,
      render: coverage.render,
      gaps: {
        recorded: coverage.recordedGaps.size,
        expected: coverage.expectedGaps.size,
        missing: coverage.missingGaps.length,
        extra: coverage.extraGaps.length,
        statusMismatch: coverage.statusMismatch.length,
        storyTextEqual: !coverage.storyGapDiff,
        rebuiltEqual: coverage.drift.length === 0 && !coverage.gapsDrift,
      },
      checks: {
        countsMatch: coverage.countsMatch,
        storyCountsMatch: coverage.storyCountsMatch,
        metaCountsMatch: coverage.metaCountsMatch,
        sourcesOk: Object.values(coverage.sourceCheck).every(entry => entry.ok),
        meta: coverage.meta,
      },
    })),
    renderEvidence,
  }
}

function reportGaps() {
  return {
    gaps: analysis.gaps,
    titleDropped: analysis.titleDropped,
    skippedGaps: analysis.skippedGaps,
    renderAnomalies: analysis.renderAnomalies,
  }
}
function reportStats() {
  const byChapter = coverages.map(coverage => ({
    id: coverage.chapter.id,
    keys: coverage.counts.keys,
    render: coverage.render,
    backlog: analysis.gaps.filter(row => row.chapter === coverage.chapter.id).length,
  }))
  const traditional = [...analysis.flags.traditional.values()].map(record => ({
    char: record.char, simplified: record.simplified, count: record.count, chapters: [...record.chapters], samples: record.samples,
  })).sort((a, b) => b.count - a.count)
  const dup = {}
  for (const row of analysis.flags.duplicatePunctuation) {
    for (const [rule, count] of Object.entries(row.rules)) {
      if (!dup[rule]) dup[rule] = { rule, occurrences: 0, blocks: 0 }
      dup[rule].occurrences += count
      dup[rule].blocks++
    }
  }
  const count = name => (Array.isArray(analysis.flags[name]) ? analysis.flags[name].length : 0)
  return {
    byChapter,
    flagCounts: {
      duplicatePunctuationBlocks: analysis.flags.duplicatePunctuation.length,
      duplicatePunctuationOccurrences: Object.values(dup).reduce((total, record) => total + record.occurrences, 0),
      traditionalChars: traditional.reduce((total, record) => total + record.count, 0),
      traditionalKinds: traditional.length,
      englishFragments: analysis.flags.multiWordLatin.length,
      latinTitles: analysis.flags.latinTitles.length,
      tokenMismatches: count('tokenMismatches'),
      unknownTokens: count('unknownTokens'),
      escapedBraces: count('escapedBraces'),
      literalBraceBlocks: count('literalBraces'),
      markdownItalic: count('markdownItalic'),
      underscoreLeaks: count('underscoreLeaks'),
      quoteImbalance: count('quoteImbalance'),
      parenImbalance: count('parenImbalance'),
      bracketImbalance: count('bracketImbalance'),
      spaceAnomalies: count('spaceAnomalies'),
      newlineAnomalies: count('newlineAnomalies'),
      fffd: count('fffd'),
      htmlResidue: count('htmlResidue'),
      asciiEllipsis: count('asciiEllipsis'),
      halfWidthNearCjkBlocks: count('halfWidthNearCjk'),
      doubleSpace: count('doubleSpace'),
      bulletAnomalies: count('bulletAnomalies'),
      numberMismatches: count('numberMismatches'),
    },
    dupByRule: dup,
    traditional,
    latinRunFrequency: [...analysis.flags.latinRuns.values()].sort((a, b) => b.count - a.count),
    multiWordLatin: analysis.flags.multiWordLatin,
    latinTitles: analysis.flags.latinTitles,
    titlePairs: analysis.flags.titlePairs,
    underscoreLeaks: analysis.flags.underscoreLeaks,
    escapedBraces: analysis.flags.escapedBraces,
    unknownTokens: analysis.flags.unknownTokens,
    halfWidthNearCjk: analysis.flags.halfWidthNearCjk,
    quoteImbalance: analysis.flags.quoteImbalance,
    bulletAnomalies: analysis.flags.bulletAnomalies,
    newlineAnomalies: analysis.flags.newlineAnomalies,
    tokenMismatches: analysis.flags.tokenMismatches,
    numberMismatches: analysis.flags.numberMismatches,
  }
}
function reportFlags() {
  const { visibleTexts, visibleTitles, ...flags } = analysis.flags
  return { visibleTexts, visibleTitles, ...flags,
    latinRuns: [...analysis.flags.latinRuns.values()], traditional: [...analysis.flags.traditional.values()] }
}
function reportConsistency() {
  return coverages.map(coverage => ({
    id: coverage.chapter.id,
    declared: coverage.declared,
    recomputed: coverage.recomputed,
    storyChapter: { chinese: coverage.story.chinese, sectionCount: coverage.story.sectionCount, guideKeyCount: coverage.story.guideKeyCount, partSectionCount: coverage.story.partSectionCount, part: coverage.story.part },
    meta: coverage.meta,
    checks: {
      countsMatch: coverage.countsMatch,
      storyCountsMatch: coverage.storyCountsMatch,
      metaCountsMatch: coverage.metaCountsMatch,
      storyGapEqual: !coverage.storyGapDiff,
      rebuiltEqual: coverage.drift.length === 0 && !coverage.gapsDrift,
      missingGaps: coverage.missingGaps,
      extraGaps: coverage.extraGaps,
      statusMismatch: coverage.statusMismatch,
      sources: coverage.sourceCheck,
      drift: coverage.drift,
    },
  }))
}

// ---------------------------------------------------------------------------
// 产物：coverage.json（全量 backlog）与 findings.json（_SPEC §5 schema）
// ---------------------------------------------------------------------------
const guideJsonPath = id => `web/scenario-guides/${id}.json`
const REF_SOURCE_ROOT = '参考资源/ArkhamHorror-main/frontend/src/locales'
const referenceLineMaps = new Map()
// leaves() 用点号展开数组下标；JSON 指针需按源结构区分对象键与数组下标。
function referencePointerOf(file, sourcePath) {
  let current = refEn[file]
  let pointer = ''
  for (const segment of sourcePath.split('.')) {
    if (Array.isArray(current)) {
      pointer += `[${segment}]`
      current = current[Number(segment)]
    } else {
      pointer = pointer ? `${pointer}.${segment}` : segment
      current = current?.[segment]
    }
  }
  return pointer
}
function referenceLine(file, sourcePath) {
  if (!referenceLineMaps.has(file)) {
    referenceLineMaps.set(file, pointerLines(readText(join(LOCALE_ROOT, 'en/edgeOfTheEarth', file))))
  }
  return referenceLineMaps.get(file).get(referencePointerOf(file, sourcePath)) ?? null
}
function guideRawLine(guide, needle) {
  const index = guide.raw.indexOf(needle)
  return index < 0 ? null : guide.raw.slice(0, index).split('\n').length
}
const byLayerStats = () => {
  const layers = {}
  for (const coverage of coverages) {
    for (const row of coverage.blocks) {
      if (!layers[row.layer]) layers[row.layer] = { keys: 0, presentNeedsReview: 0, untranslated: 0, missing: 0,
        textMissing: 0, titleDropped: 0, titleAbsent: 0, skipped: 0 }
      const layer = layers[row.layer]
      layer.keys++
      layer[row.status === 'present-needs-review' ? 'presentNeedsReview' : row.status]++
      if (row.status !== 'present-needs-review') {
        if (row.render === 'text-missing') layer.textMissing++
        else if (row.render === 'title-dropped') layer.titleDropped++
        else if (row.render === 'title-absent') layer.titleAbsent++
        else if (row.render === 'skipped-key') layer.skipped++
      }
    }
  }
  return layers
}
function gapRenderStats(coverage) {
  const stats = { textMissing: 0, titleDropped: 0, titleAbsent: 0, skippedHidden: 0, other: 0 }
  for (const row of coverage.blocks) {
    if (row.status === 'present-needs-review') continue
    if (row.render === 'text-missing') stats.textMissing++
    else if (row.render === 'title-dropped') stats.titleDropped++
    else if (row.render === 'title-absent') stats.titleAbsent++
    else if (row.render === 'skipped-key') stats.skippedHidden++
    else stats.other++
  }
  return stats
}
function sharedSectionsOf(coverage) {
  const { chapter, story, blocks } = coverage
  if (!chapter.part) return { count: 0, topLevels: [], partSectionCount: story.partSectionCount }
  const shared = SPLIT_SHARED_TOP_LEVEL[chapter.guideId]
  const rows = blocks.filter(row => shared.includes(row.sourcePath.split('.')[0]))
  return {
    count: rows.length,
    topLevels: shared,
    partSectionCount: story.partSectionCount,
    note: '共享篇段在每个 part 的 guideKeyCount/chinese 统计中重复计入（P0 口径）',
  }
}
function coverageDoc() {
  const chapters = coverages.map(coverage => {
    const chapter = coverage.chapter
    const records = coverage.blocks.map(row => {
      let pointer = row.pointer
      let location = row.line ? `${guideJsonPath(chapter.id)}:${row.line}` : null
      if (!location) {
        // 标题被整段省略（如 @: 引用）时，退回到 chineseGaps 中该键所在行。
        const gapLine = guideRawLine(coverage.guide, `"${row.path}": "${row.status}"`)
        if (gapLine) {
          location = `${guideJsonPath(chapter.id)}:${gapLine}`
          pointer = pointer || `chineseGaps.${row.path}`
        }
      }
      return {
        path: row.path,
        sourcePath: row.sourcePath,
        sourceFile: chapter.guideFile,
        sourceLine: referenceLine(chapter.guideFile, row.sourcePath),
        layer: row.layer,
        status: row.status,
        render: row.render,
        pointer,
        location,
        en: truncate(row.enRaw, 160),
      }
    })
    const backlog = records.filter(row => row.status !== 'present-needs-review')
    const layerKeys = {}
    for (const row of records) {
      if (!layerKeys[row.layer]) layerKeys[row.layer] = { keys: 0, presentNeedsReview: 0, untranslated: 0, missing: 0 }
      layerKeys[row.layer].keys++
      layerKeys[row.layer][row.status === 'present-needs-review' ? 'presentNeedsReview' : row.status]++
    }
    const gapStats = gapRenderStats(coverage)
    return {
      id: chapter.id,
      guideId: chapter.guideId,
      part: chapter.part,
      guideJson: guideJsonPath(chapter.id),
      sourceLocale: {
        en: { path: `frontend/src/locales/en/edgeOfTheEarth/${chapter.guideFile}`, ...coverage.guide.json.sources.en },
        zh: { path: `frontend/src/locales/zh/edgeOfTheEarth/${chapter.guideFile}`, ...coverage.guide.json.sources.zh },
      },
      counts: coverage.counts,
      declared: coverage.declared,
      guideMeta: {
        chineseStatus: coverage.guide.json.chineseStatus,
        sectionCount: coverage.guide.json.sectionCount,
        guideKeyCount: coverage.guide.json.guideKeyCount,
        storySectionCount: chapter && coverage.story.sectionCount,
        storyGuideKeyCount: coverage.story.guideKeyCount,
        expectedGuideKeyCount: STORY_META.guideKeyCounts[chapter.id],
      },
      sharedSections: sharedSectionsOf(coverage),
      render: coverage.render,
      keysByLayer: layerKeys,
      chineseGapsAudit: {
        recorded: coverage.recordedGaps.size,
        expected: coverage.expectedGaps.size,
        missingKeys: coverage.missingGaps,
        extraKeys: coverage.extraGaps,
        statusMismatch: coverage.statusMismatch,
        storyTextEqual: !coverage.storyGapDiff,
        rebuiltEqualsGuideJson: coverage.drift.length === 0 && !coverage.gapsDrift,
        byRender: gapStats,
      },
      backlog,
    }
  })
  const sum = key => chapters.reduce((total, chapter) => total + (chapter[key] ?? 0), 0)
  const gapTotals = chapters.reduce((total, chapter) => {
    for (const [key, value] of Object.entries(chapter.chineseGapsAudit.byRender)) total[key] += value
    return total
  }, { textMissing: 0, titleDropped: 0, titleAbsent: 0, skippedHidden: 0, other: 0 })
  const campaignBacklogRows = campaignShared.groups.flatMap(group => group.backlog.map(row => ({
    group: group.topLevel,
    path: row.path,
    sourceFile: 'base.json',
    sourceLine: referenceLine('base.json', row.path),
    layer: row.layer,
    status: row.status,
    en: row.en,
  })))
  return {
    area: 'guides',
    auditor: AUDITOR,
    generatedAt: GENERATED_AT,
    schemaVersion: 1,
    method: '以参考 locale en 叶子为事实源（与 tools/eote-guide-scan.mjs#buildGuides 同一切片）重算中文三态，逐 key 对齐 8 份 web/scenario-guides JSON 的 locales.zh 渲染树与 chineseGaps；再与 content/campaigns/edgeOfTheEarth/story-text.js 生成物逐字段核对。',
    scope: {
      chapters: chapterList.length,
      guideFiles: chapterList.map(chapter => guideJsonPath(chapter.id)),
      keyCount: coverages.reduce((total, coverage) => total + coverage.counts.keys, 0),
      sourceLocale: {
        en: SOURCE_FILES.map(file => `frontend/src/locales/en/edgeOfTheEarth/${file}`),
        zh: SOURCE_FILES.map(file => `frontend/src/locales/zh/edgeOfTheEarth/${file}`),
        root: REF_SOURCE_ROOT,
        referenceProject: '参考资源/ArkhamHorror-main',
      },
      facts: 'content/campaigns/edgeOfTheEarth/story-text.js（P7 生成物；chineseGaps/统计/章节映射同一事实源）',
      panel: ['web/scenario-setup-view.js', 'web/locales/zh-CN.panels.js', 'web/card-text.js'],
      campaignShared: `frontend/src/locales/{en,zh}/edgeOfTheEarth/base.json（${campaignShared.totals.keys} 个叶子，不在指南面板渲染范围）`,
      backlogDefinition: 'status != present-needs-review 的 key（missing = zh 无同路径；untranslated = zh 存在但无 CJK 或夹 3+ 连续英文小写词）；render 字段说明该 key 在面板的呈现方式。',
    },
    summary: {
      keys: coverages.reduce((total, coverage) => total + coverage.counts.keys, 0),
      chinese: {
        presentNeedsReview: coverages.reduce((total, coverage) => total + coverage.counts.presentNeedsReview, 0),
        untranslated: coverages.reduce((total, coverage) => total + coverage.counts.untranslated, 0),
        missing: coverages.reduce((total, coverage) => total + coverage.counts.missing, 0),
      },
      render: {
        textBlocks: coverages.reduce((total, coverage) => total + coverage.render.textPresent, 0),
        textMissing: coverages.reduce((total, coverage) => total + coverage.render.textMissing, 0),
        titlePresent: coverages.reduce((total, coverage) => total + coverage.render.titlePresent, 0),
        titleDropped: coverages.reduce((total, coverage) => total + coverage.render.titleDropped, 0),
        titleAbsent: coverages.reduce((total, coverage) => total + coverage.render.titleAbsent, 0),
        skippedKeys: coverages.reduce((total, coverage) => total + coverage.render.skippedKeys, 0),
      },
      chineseGaps: {
        recorded: coverages.reduce((total, coverage) => total + coverage.recordedGaps.size, 0),
        ...gapTotals,
        note: 'recorded = textMissing + titleDropped + titleAbsent + skippedHidden；后三类不显示「中文待补」',
      },
      backlog: {
        total: chapters.reduce((total, chapter) => total + chapter.backlog.length, 0) + campaignBacklogRows.length,
        chapterGuides: chapters.reduce((total, chapter) => total + chapter.backlog.length, 0),
        campaignShared: campaignBacklogRows.length,
        byStatus: {
          missing: coverages.reduce((total, coverage) => total + coverage.counts.missing, 0) + campaignShared.totals.missing,
          untranslated: coverages.reduce((total, coverage) => total + coverage.counts.untranslated, 0) + campaignShared.totals.untranslated,
        },
      },
      byLayer: byLayerStats(),
      consistency: {
        guideJsonEqualsStoryText: coverages.every(coverage => !coverage.storyGapDiff && coverage.storyCountsMatch && coverage.countsMatch && coverage.metaCountsMatch),
        guideJsonEqualsRegenerated: coverages.every(coverage => coverage.drift.length === 0 && !coverage.gapsDrift),
        chineseGapsMatchesSourceLocale: coverages.every(coverage => coverage.missingGaps.length === 0 && coverage.extraGaps.length === 0 && coverage.statusMismatch.length === 0),
        sourceLocksOk: coverages.every(coverage => Object.values(coverage.sourceCheck).every(entry => entry.ok)),
        chapterMapping: coverages.map(coverage => ({
          id: coverage.chapter.id,
          guideId: coverage.chapter.guideId,
          part: coverage.chapter.part,
          expectedGuideKeyCount: STORY_META.guideKeyCounts[coverage.chapter.id],
          sectionCount: coverage.guide.json.sectionCount,
          guideKeyCount: coverage.guide.json.guideKeyCount,
          storySectionCount: coverage.story.sectionCount,
          partSectionCount: coverage.story.partSectionCount,
          sharedSections: sharedSectionsOf(coverage).count,
        })),
      },
    },
    chapters,
    campaignShared: {
      note: 'base.json 的战役共享段（序幕/检查点/幕间/尾声/特别规则/记录标签）。这些段不进入「关卡设置」面板，只作为补译批次的战役共享 backlog 单列；状态口径与章节 backlog 相同。',
      source: 'frontend/src/locales/en/edgeOfTheEarth/base.json',
      totals: campaignShared.totals,
      groups: campaignShared.groups.map(group => ({
        topLevel: group.topLevel,
        keys: group.keys,
        presentNeedsReview: group.presentNeedsReview,
        untranslated: group.untranslated,
        missing: group.missing,
      })),
      backlog: campaignBacklogRows,
    },
    renderEvidence,
  }
}

function findingsDoc() {
  const findings = []
  const push = finding => {
    findings.push({
      id: `guides-${String(findings.length + 1).padStart(4, '0')}`,
      ...finding,
    })
  }
  const uniqueChapters = rows => [...new Set(rows.map(row => row.chapter))]
  const sample = (location, note, extra = {}) => ({ location, note, ...extra })

  // 1) i18next 花括号转义残留
  const braces = analysis.flags.escapedBraces
  if (braces.length) {
    push({
      category: 'symbol-format',
      severity: 'high',
      title: `${braces.length} 处 i18next 花括号转义 \`{'{'}frost{'}'}\` 原样进入中文正文，冰霜标记不可读`,
      scope: { kind: 'token-placeholder', token: "{'{'}frost{'}'}", chapters: uniqueChapters(braces) },
      location: braces[0].location,
      pointer: braces[0].pointer ?? null,
      evidence: braces[0].sample,
      expected: '`[frost]`（renderRulesText 会渲染成冰霜图标），或译作「冰霜标记」；en locale 同源亦有 7 处相同残留',
      suggestion: `在 tools/import-tde-story.mjs#cleanText 与 tools/import-eote-story.mjs#localizePlaceholders 增加 \`{'{'}名称{'}'}\` → \`{名称}\` 的通用还原（与 tools/import-scenario-guides.mjs#guideText 现有同类替换同口径），再重跑 import-eote-story --write / import-scenario-guides --write 并同步来源哈希与账本。`,
      source: 'generated',
      count: braces.length,
      samples: braces.map(row => sample(row.location, `${row.chapter} · ${row.path}`)),
    })
  }

  // 2) 缺译标题静默消失（无「中文待补」）
  const titleDropped = analysis.titleDropped
  if (titleDropped.length) {
    const layers = [...new Set(titleDropped.map(row => row.layer))].sort()
    push({
      category: 'missing-translation',
      severity: 'high',
      title: `${titleDropped.length} 个已登记缺译标题在面板中静默消失：标题缺译不显示「中文待补」，${titleDropped.filter(row => row.layer === 'specialRules').length} 个特别规则分组标题整组丢失`,
      scope: { kind: 'title-drop', layers, renderer: 'web/scenario-setup-view.js:53-57' },
      location: titleDropped[0].location,
      pointer: titleDropped[0].pointer ?? null,
      evidence: `renderBlocks 只在 \`block.text\` 缺译时显示 \`t('setup.chineseMissing')\`（web/scenario-setup-view.js:56）；标题缺译时 eoteBlocks 直接省略 title，没有任何提示。样本：${titleDropped[0].chapter} ${titleDropped[0].path}（en: ${titleDropped[0].en}）`,
      expected: '标题缺译时在标题位置显示「中文待补」，与正文层缺译口径一致；或直接补译这些标题',
      suggestion: 'tools/import-scenario-guides.mjs#eoteBlocks 在 title gap 时输出 `{ title: "", titleMissing: gap }`，web/scenario-setup-view.js#renderBlocks 增加标题缺译分支渲染 `t(\'setup.chineseMissing\')`。',
      source: 'generated',
      count: titleDropped.length,
      samples: titleDropped.slice(0, 10).map(row => sample(row.location, `${row.chapter} · ${row.path} · en「${row.en}」`)),
    })
  }

  // 3) @: 跨节引用未展开 → Part3 调查员设置整段假性缺译
  const atReferenceCoverage = coverages.find(coverage => coverage.chapter.id === 'iceAndDeathPart3')
  const atReferenceRows = atReferenceCoverage
    ? atReferenceCoverage.blocks.filter(row => row.path === 'investigatorSetup.title' || row.path === 'investigatorSetup.body')
    : []
  if (atReferenceRows.length) {
    const guide = guides.find(entry => entry.id === 'iceAndDeathPart3')
    const bodyLine = guideRawLine(guide, '"investigatorSetup.body": "untranslated"')
    const titleLine = guideRawLine(guide, '"investigatorSetup.title": "untranslated"')
    push({
      category: 'missing-translation',
      severity: 'high',
      title: 'Part3「调查员设置」标题+正文因 @: 跨节引用未展开而丢失：zh 面板显示「中文待补」，en 面板整块消失（Part2 同段已有中文）',
      scope: { chapter: 'iceAndDeathPart3', keys: ['investigatorSetup.title', 'investigatorSetup.body'],
        sourceValue: getPath(refEn['scenarios/iceAndDeath.json'], 'part3.investigatorSetup.title') },
      location: `${guideJsonPath('iceAndDeathPart3')}:${titleLine}`,
      pointer: 'chineseGaps.investigatorSetup.title / chineseGaps.investigatorSetup.body',
      evidence: `参考 locale en/zh 的 part3.investigatorSetup 均为 \`@:edgeOfTheEarth.iceAndDeath.part2.investigatorSetup.{title,body}\`；生成链 stripRefs 把整行删掉。guide JSON 中 zh locales 首块为 {text:"", missing:"untranslated", path:"investigatorSetup.body"}（line ${bodyLine}），无标题；locales.en 该块整段缺失。`,
      expected: '展开 @: 引用为 edgeOfTheEarth.iceAndDeath.part2.investigatorSetup 的对应文本；Part2 已有完整中文「调查员设置」及正文，展开后 zh 不再显示中文待补、en 恢复该设置段',
      suggestion: '在 tools/import-eote-story.mjs 增加 @: 引用展开（可参考 tools/import-scenario-guides.mjs#translated 的 depth 解析），或先在 eote-guide-scan 的 sections 上递归解析引用；重跑生成链。',
      source: 'generated',
      count: 2,
      samples: [sample(`${guideJsonPath('iceAndDeathPart3')}:${titleLine}`, 'chineseGaps.investigatorSetup.title = untranslated'),
        sample(`${guideJsonPath('iceAndDeathPart3')}:${bodyLine}`, 'chineseGaps.investigatorSetup.body = untranslated')],
    })
  }

  // 4) 中英混杂/半译
  const latinRows = analysis.flags.multiWordLatin
  if (latinRows.length) {
    const blocks = new Map()
    for (const row of latinRows) {
      const key = `${row.chapter}\u0000${row.path}`
      if (!blocks.has(key)) blocks.set(key, { ...row, runs: [] })
      blocks.get(key).runs.push(row.run)
    }
    const rows = [...blocks.values()]
    push({
      category: 'mixed-language',
      severity: 'medium',
      title: `${rows.length} 段中文正文夹英文/半译（${latinRows.length} 处英文片段）：结算标签与 Setup/Resolution/Intro 前缀未译`,
      scope: { kind: 'semi-translated', chapters: uniqueChapters(rows) },
      location: rows[0].location,
      pointer: rows[0].pointer ?? null,
      evidence: `${rows[0].chapter} ${rows[0].path} 「${rows[0].runs.join(' / ')}」：${rows[0].sample}`,
      expected: '结算标签「庇护值/经验」、进入设置、「结局 3：」「序言 3：」等中文文本（与其余段落一致）',
      suggestion: '逐条替换 samples 中 7 段（均来自参考 zh locale 的半译）；建议回写参考 locale 后再进补译批次，避免只改生成物。',
      source: 'reference-locale',
      count: rows.length,
      samples: rows.map(row => sample(row.location, `${row.chapter} · ${row.path} · ${row.runs.join('/')}`)),
    })
  }

  // 5) 未知占位符 [shelterValue]
  const unknownTokens = analysis.flags.unknownTokens
  if (unknownTokens.length) {
    push({
      category: 'symbol-format',
      severity: 'medium',
      title: `${unknownTokens.length} 处 \`[shelterValue]\` 占位符未被替换，面板原样显示方括号 token`,
      scope: { kind: 'unknown-placeholder', token: 'shelterValue', chapters: uniqueChapters(unknownTokens) },
      location: unknownTokens[0].location,
      pointer: unknownTokens[0].pointer ?? null,
      evidence: `${unknownTokens[0].chapter} ${unknownTokens[0].path}：${unknownTokens[0].sample}`,
      expected: '静态指南无法取运行时庇护值，应替换为中性文字（如「营地庇护值」）或与 en 同步处理为可读占位',
      suggestion: 'web/card-text.js#renderRulesText 只识别 SYMBOLS 表中的 token（card-text.js:47-56），未知 `[x]` 原样输出；在指南生成期把 [shelterValue] 统一成「庇护值」，或给 renderRulesText 加显式占位符处理。',
      source: 'generated',
      count: unknownTokens.length,
      samples: unknownTokens.map(row => sample(row.location, `${row.chapter} · ${row.path}`)),
    })
  }

  // 6) 简繁/异体与台港用词
  const traditional = [...analysis.flags.traditional.values()]
  const zhu = traditional.find(record => record.char === '著')
  const lexicon = analysis.flags.lexicon
  if (zhu || lexicon.length) {
    const samples = [...(zhu?.samples ?? []).slice(0, 3).map(row => sample(row.location, `著（应为「着」）：${row.sample}`)),
      ...lexicon.slice(0, 4).map(row => sample(row.location, `${row.word}：${row.sample}`))]
    const zhuCount = zhu?.count ?? 0
    push({
      category: 'terminology',
      severity: 'medium',
      title: `简繁/异体字混用：简体语料中「著」出现 ${zhuCount} 处（应为「着」，8 章全部命中），另有台港用词 计画/网路/想像 ${lexicon.length} 处`,
      scope: { kind: 'traditional-simplified-mix', chars: ['著'], words: ['计画', '网路', '想像'], chapters: [...new Set([...(zhu?.chapters ?? []), ...lexicon.map(row => row.chapter)])] },
      location: (zhu?.samples?.[0]?.location) ?? lexicon[0].location,
      pointer: (zhu?.samples?.[0]?.pointer) ?? lexicon[0].pointer ?? null,
      evidence: (zhu?.samples?.[0]?.sample) ?? lexicon[0].sample,
      expected: '著→着（保留 著作/著名/显著 等简体合法词）；计画→计划、网路→网络、想像→想象',
      suggestion: '对参考 zh locale 做一次定向 s2t/用词校正（只处理「著(zhe)、计画、网路、想像」白名单，避免误改 著作/著名），再重跑生成链；本轮不改源文件，仅登记。',
      source: 'reference-locale',
      count: zhuCount + lexicon.length,
      samples: samples.slice(0, 10),
    })
  }

  // 7) 重复标点 。.
  const duplicatePunctuation = analysis.flags.duplicatePunctuation
  if (duplicatePunctuation.length) {
    const occurrences = duplicatePunctuation.reduce((total, row) => total + row.count, 0)
    push({
      category: 'symbol-format',
      severity: 'medium',
      title: `${duplicatePunctuation.length} 段 ${occurrences} 处「中句号+西句点」（\`。.\`）重复标点`,
      scope: { kind: 'duplicate-punctuation', pattern: '。.', chapters: uniqueChapters(duplicatePunctuation) },
      location: duplicatePunctuation[0].location,
      pointer: duplicatePunctuation[0].pointer ?? null,
      evidence: duplicatePunctuation[0].sample,
      expected: '只保留一个中文句号「。」',
      suggestion: '在参考 zh locale 中批量删除中文句号后的 ASCII 句点（正则 `。\\s*\\.`），重跑生成链；若为脚本清洗残留需同时修生成器。',
      source: 'reference-locale',
      count: occurrences,
      samples: duplicatePunctuation.slice(0, 10).map(row => sample(row.location, `${row.chapter} · ${row.path}（${row.count} 处）`)),
    })
  }

  // 8) 引号不配对
  const quotes = analysis.flags.quoteImbalance
  if (quotes.length) {
    push({
      category: 'symbol-format',
      severity: 'medium',
      title: `${quotes.length} 段中文引号不配对（“ 与 ” 数量不一致），对白边界错乱`,
      scope: { kind: 'quote-imbalance', chapters: uniqueChapters(quotes) },
      location: quotes[0].location,
      pointer: quotes[0].pointer ?? null,
      evidence: `${quotes[0].chapter} ${quotes[0].path}：${quotes[0].sample}`,
      expected: '每段内“ 与 ”成对（开 ' + quotes[0].open + ' / 闭 ' + quotes[0].close + '）',
      suggestion: '按 samples 位置补/删缺失的右引号（多数为段末缺失一个 ”）。',
      source: 'reference-locale',
      count: quotes.length,
      samples: quotes.map(row => sample(row.location, `${row.chapter} · ${row.path}（开 ${row.open}/闭 ${row.close}）`)),
    })
  }

  // 9) markdown 斜体 _..._ 泄漏
  const underscores = analysis.flags.underscoreLeaks
  if (underscores.length) {
    push({
      category: 'symbol-format',
      severity: 'medium',
      title: `${underscores.length} 段正文残留 markdown 斜体下划线（如 \`_附身_\`、\`_此外…_\`、\`_序言 2_\`），面板原样显示`,
      scope: { kind: 'markdown-leak', marker: '_', chapters: uniqueChapters(underscores) },
      location: underscores[0].location,
      pointer: underscores[0].pointer ?? null,
      evidence: `${underscores[0].chapter} ${underscores[0].path}：${underscores[0].sample}`,
      expected: '去掉 `_` 标记或渲染为 <em> 斜体（en 侧同为 _…_ 标记）',
      suggestion: 'web/card-text.js#renderRulesText 不处理 `_`；在 cleanText 中把 `_x_` 清洗为 x（现有下划线清洗正则的边界字符集缺少「：_“」等组合，漏掉 _此外…_ 这类），或生成期统一剥离。',
      source: 'generated',
      count: underscores.length,
      samples: underscores.map(row => sample(row.location, `${row.chapter} · ${row.path}`)),
    })
  }

  // 10) 半/全角混用
  const halfWidth = analysis.flags.halfWidthNearCjk
  if (halfWidth.length) {
    const chars = halfWidth.reduce((total, row) => total + row.count, 0)
    push({
      category: 'symbol-format',
      severity: 'medium',
      title: `${halfWidth.length} 段 ${chars} 处中英文标点半/全角混用（ASCII 冒号/逗号/叹号紧邻汉字）`,
      scope: { kind: 'half-full-width-mix', patterns: [...new Set(halfWidth.flatMap(row => row.chars))], chapters: uniqueChapters(halfWidth) },
      location: halfWidth[0].location,
      pointer: halfWidth[0].pointer ?? null,
      evidence: `${halfWidth[0].chapter} ${halfWidth[0].path}：${halfWidth[0].sample}`,
      expected: '中文语境统一用全角「：」「，」「！」（如「结局 1：」「否则：」「,形成」）',
      suggestion: '按 samples 位置替换：多数为段落标签的 ASCII 冒号（「结局 1:」「序言 1:」「导言:」「否则:」），另有中文之间的 ASCII 逗号与段末 ASCII 问号/叹号；fatalMirage 标题「???」为源文有意占位，已从计数中排除。',
      source: 'reference-locale',
      count: chars,
      samples: halfWidth.slice(0, 10).map(row => sample(row.location, `${row.chapter} · ${row.path} · ${row.chars.join(' ')}`)),
    })
  }

  // 11) Part2 章节标题数字错误
  const partTwoTitle = analysis.flags.titlePairs.find(row => row.path === 'intro.title' && row.chapter === 'iceAndDeathPart2')
  if (partTwoTitle) {
    push({
      category: 'mistranslation',
      severity: 'medium',
      title: 'Part2 开场标题写成「亡命冰原 第I部分I」，与 en「Ice and Death, Part II」不符（应为第II部分）',
      scope: { kind: 'wrong-part-number', chapter: 'iceAndDeathPart2', pointer: 'locales.zh.intro[0].title' },
      location: partTwoTitle.location,
      pointer: 'locales.zh.intro[0].title',
      evidence: `zh「${partTwoTitle.zh}」 vs en「${partTwoTitle.en}」`,
      expected: '「亡命冰原 第II部分」',
      suggestion: '修正参考 zh locale 的 `part2.intro.title`；同章 intro1–intro4 标题「第1部分」建议统一为罗马数字体例（第I/II/III部分）。',
      source: 'reference-locale',
      count: 1,
      samples: [sample(partTwoTitle.location, partTwoTitle.zh)],
    })
  }

  // 12) No Resolution 译法不一致
  const noResolutionTitles = analysis.flags.titlePairs.filter(row => /No Resolution/i.test(row.en))
  const variants = new Map()
  for (const row of noResolutionTitles) {
    if (!variants.has(row.zh)) variants.set(row.zh, [])
    variants.get(row.zh).push(row)
  }
  if (variants.size > 1) {
    const [firstZh] = variants.keys()
    push({
      category: 'terminology',
      severity: 'low',
      title: `同一 en 标题「No Resolution」有两种译法：${[...variants.keys()].map(zh => `「${zh}」`).join(' / ')}`,
      scope: { kind: 'inconsistent-heading', en: 'No Resolution', variants: [...variants.keys()] },
      location: [...variants.values()].at(-1)[0].location,
      pointer: 'locales.zh.resolutions[0].title',
      evidence: [...variants.entries()].map(([zh, rows]) => `「${zh}」×${rows.length}（${rows.map(row => row.chapter).join('、')}）`).join('；'),
      expected: '统一为「未达成结局」（多数译法）',
      suggestion: `把 ${[...variants.keys()].filter(zh => zh !== '未达成结局').map(zh => `「${zh}」`).join('、')} 统一成「未达成结局」。`,
      source: 'reference-locale',
      count: noResolutionTitles.length,
      samples: [...variants.entries()].flatMap(([zh, rows]) => rows.slice(0, 2).map(row => sample(row.location, `${row.chapter}「${zh}」`))).slice(0, 10),
    })
  }

  // 13) 漏字/错字
  const textTypos = analysis.flags.textTypos
  if (textTypos.length) {
    push({
      category: 'mistranslation',
      severity: 'low',
      title: `中文正文漏字 ${textTypos.length} 处（如「拥有额 1使用」漏「外」）`,
      scope: { kind: 'typo', chapters: uniqueChapters(textTypos) },
      location: textTypos[0].location,
      pointer: textTypos[0].pointer ?? null,
      evidence: textTypos[0].sample,
      expected: textTypos[0].expected,
      suggestion: `修正为「${textTypos[0].expected}」；同类漏字可在补译批次一并校对。`,
      source: 'reference-locale',
      count: textTypos.length,
      samples: textTypos.map(row => sample(row.location, `${row.chapter} · ${row.path} · ${row.needle}`)),
    })
  }

  // 14) 列表/段落结构与 en 不一致
  const structural = [
    ...analysis.flags.bulletAnomalies.map(row => ({ ...row, kind: 'bullet-count' })),
    ...analysis.flags.newlineAnomalies.map(row => ({ ...row, kind: 'blank-lines' })),
  ]
  if (structural.length) {
    push({
      category: 'symbol-format',
      severity: 'low',
      title: `列表项/段落数与 en 不一致 ${structural.length} 处（如 Part3 结局2 中文 6 个 • 而 en 7 个）`,
      scope: { kind: 'structure-mismatch', chapters: uniqueChapters(structural) },
      location: structural[0].location,
      pointer: null,
      evidence: structural.map(row => `${row.chapter} ${row.path}：${row.kind === 'bullet-count' ? `• ${row.zhBullets} vs en ${row.enBullets}` : `空行 ${row.zhBlank} vs en ${row.enBlank}`}`).join('；'),
      expected: '与 en 的列表/段落结构一致（缺的「获得额外经验」应恢复为独立列表项，空行按 en 保留）',
      suggestion: '按 samples 位置恢复独立 bullet 与空行；规则信息未丢失，属结构不一致。',
      source: 'reference-locale',
      count: structural.length,
      samples: structural.map(row => sample(row.location, `${row.chapter} · ${row.path}`)),
    })
  }

  const byCategory = { 'missing-translation': 0, 'mixed-language': 0, 'symbol-format': 0, mistranslation: 0, 'marker-leak': 0, terminology: 0 }
  const bySeverity = { high: 0, medium: 0, low: 0 }
  for (const finding of findings) {
    byCategory[finding.category]++
    bySeverity[finding.severity]++
  }
  return {
    area: 'guides',
    auditor: AUDITOR,
    generatedAt: GENERATED_AT,
    method: '逐章以参考 locale en 叶子为事实源重算三态与面板块状态，对照 chineseGaps/story-text；在 zh 面板实际渲染文本上统计中英混杂、符号/标点、简繁与结构问题，证据行号由脚本定位。',
    scope: {
      source: 'web/scenario-guides/{8 章}.json 的 locales.zh/en、chineseGaps；参考 locale 6 文件；content/campaigns/edgeOfTheEarth/story-text.js；渲染路径 web/scenario-setup-view.js / web/locales/zh-CN.panels.js / web/card-text.js',
      count: coverages.reduce((total, coverage) => total + coverage.counts.keys, 0),
      notes: ['覆盖 8 章 469 个 en 叶子 key（含拆章共享篇段重复计数）', '战役共享段（base.json）只进 coverage.json backlog，不计入 findings'],
    },
    summary: { findings: findings.length, byCategory, bySeverity },
    findings,
  }
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2)
const has = name => argv.includes(`--${name}`)
const argValue = name => {
  const prefix = `--${name}=`
  const match = argv.find(value => value.startsWith(prefix))
  return match ? match.slice(prefix.length) : null
}
const buildDocs = () => ({ 'coverage.json': coverageDoc(), 'findings.json': findingsDoc() })

if (has('check')) {
  const docs = buildDocs()
  const checkDir = argValue('out-dir') || OUT_DIR
  let failed = false
  for (const [name, doc] of Object.entries(docs)) {
    const path = join(checkDir, name)
    if (!existsSync(path)) {
      console.error(`缺少产物：${relMod(path)}（运行 --write 生成）`)
      failed = true
      continue
    }
    const expected = `${JSON.stringify(doc, null, 2)}\n`
    const actual = readText(path)
    if (actual !== expected) {
      const expectedLines = expected.split('\n')
      const actualLines = actual.split('\n')
      let first = 0
      while (first < expectedLines.length && first < actualLines.length && expectedLines[first] === actualLines[first]) first++
      console.error(`${relMod(path)} 与脚本重算不一致：第 ${first + 1} 行起（期望 ${JSON.stringify(expectedLines[first] ?? '')}，实际 ${JSON.stringify(actualLines[first] ?? '')}）`)
      failed = true
    } else {
      console.log(`OK ${relMod(path)}（${actual.split('\n').length - 1} 行）`)
    }
  }
  if (failed) process.exit(1)
  const coverage = docs['coverage.json']
  const findings = docs['findings.json']
  console.log(JSON.stringify({
    ok: true,
    coverage: { keys: coverage.summary.keys, backlog: coverage.summary.backlog },
    findings: findings.summary,
  }, null, 2))
} else if (has('write') || argValue('out-dir')) {
  const outDir = argValue('out-dir') || OUT_DIR
  const docs = buildDocs()
  for (const [name, doc] of Object.entries(docs)) {
    writeFileSync(join(outDir, name), `${JSON.stringify(doc, null, 2)}\n`)
    console.log(`写出 ${join(outDir, name)}`)
  }
} else if (argValue('print')) {
  const name = argValue('print')
  const docs = buildDocs()
  const file = name === 'coverage' ? 'coverage.json' : name === 'findings' ? 'findings.json' : null
  if (!file) {
    console.error('用法：--print=coverage|findings')
    process.exit(2)
  }
  console.log(JSON.stringify(docs[file], null, 2))
} else if (argValue('report')) {
  const name = argValue('report')
  const reports = { gaps: reportGaps, stats: reportStats, flags: reportFlags, consistency: reportConsistency }
  if (!reports[name]) {
    console.error(`未知报告：${name}；可用：${Object.keys(reports).join(', ')}`)
    process.exit(2)
  }
  const output = JSON.stringify(reports[name](), null, 2)
  const out = argValue('out')
  if (out) writeFileSync(out, `${output}\n`)
  else console.log(output)
} else {
  const coverage = coverageDoc()
  const findings = findingsDoc()
  console.log(JSON.stringify({
    keys: coverage.summary.keys,
    chinese: coverage.summary.chinese,
    backlog: coverage.summary.backlog,
    render: coverage.summary.render,
    chineseGaps: coverage.summary.chineseGaps,
    consistency: {
      guideJsonEqualsStoryText: coverage.summary.consistency.guideJsonEqualsStoryText,
      guideJsonEqualsRegenerated: coverage.summary.consistency.guideJsonEqualsRegenerated,
      chineseGapsMatchesSourceLocale: coverage.summary.consistency.chineseGapsMatchesSourceLocale,
      sourceLocksOk: coverage.summary.consistency.sourceLocksOk,
    },
    findings: findings.summary,
  }, null, 2))
}
