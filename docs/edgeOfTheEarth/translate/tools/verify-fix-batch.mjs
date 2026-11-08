// 《地球边缘》翻译修复批次验收探针（2026-11-09）。
//
// 用法（在 games/arkhamhorror/ 下）：node docs/edgeOfTheEarth/translate/tools/verify-fix-batch.mjs
// 退出码：0 = 全绿；1 = 有断言失败（输出 problems）。
//
// 覆盖：
//   ① 章节正文 469/469 present（missing/untranslated = 0）；
//   ② 战役 locale 键 258/258 present；
//   ③ 八章指南 JSON：chineseGaps=0、缺译 marker=0、zh 正文全含中文；
//   ④ 展示文本无修复前残留（转义残渣/半角标点/繁体/英文整句/牌组/没有结局等）；
//   ⑤ 分段：flatten 与 resolutionText 用 \n\n 分段，指南保留多段。
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const problems = []
const check = (ok, message) => { if (!ok) problems.push(message) }
const readJson = relative => JSON.parse(readFileSync(`${MOD}/${relative}`, 'utf8'))
const CJK = /[\u3400-\u9fff]/
const CHAPTER_IDS = [
  'iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3', 'fatalMirage',
  'toTheForbiddenPeaks', 'cityOfTheElderThings', 'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2',
]

const storyModule = await import(pathToFileURL(`${MOD}/content/campaigns/edgeOfTheEarth/story-text.js`).href)
const { EOTE_STORY_META, EOTE_STORY_TEXT } = storyModule
const access = await import(pathToFileURL(`${MOD}/content/campaigns/edgeOfTheEarth/story-access.js`).href)

// ① 章节覆盖
const meta = EOTE_STORY_META.chinese
check(meta.total === 469 && meta.presentNeedsReview === 469 && meta.missing === 0 && meta.untranslated === 0,
  `章节覆盖异常：${JSON.stringify(meta)}`)
for (const id of CHAPTER_IDS) {
  const chapter = EOTE_STORY_TEXT.chapters[id]
  check(Object.keys(chapter.chineseGaps).length === 0, `${id} 仍有 chineseGaps`)
}
// ② 战役 locale 键
const localeEntries = Object.entries(EOTE_STORY_TEXT.localeKeys)
check(localeEntries.length === 258, `localeKeys 数量 ${localeEntries.length} != 258`)
check(localeEntries.every(([, value]) => value.status === 'present-needs-review'), 'localeKeys 存在非 present 条目')

// ③ 指南
const addMissingBlocks = (blocks, out = []) => {
  for (const block of blocks || []) {
    if (block.missing) out.push(block)
    if (block.children) addMissingBlocks(block.children, out)
  }
  return out
}
const blockTexts = (blocks, out = []) => {
  for (const block of blocks || []) {
    if (typeof block.title === 'string') out.push(block.title)
    if (typeof block.text === 'string') out.push(block.text)
    if (block.children) blockTexts(block.children, out)
  }
  return out
}
let guideParagraphTexts = 0
let guideTexts = 0
for (const id of CHAPTER_IDS) {
  const guide = readJson(`web/scenario-guides/${id}.json`)
  check(Object.keys(guide.chineseGaps || {}).length === 0, `${id} 指南仍有 chineseGaps`)
  check(addMissingBlocks(Object.values(guide.locales.zh).flat()).length === 0, `${id} 指南仍有缺译 marker`)
  const texts = blockTexts(Object.values(guide.locales.zh).flat())
  for (const text of texts) {
    if (!text.trim()) continue
    guideTexts++
    check(CJK.test(text), `${id} 指南段落疑似无中文：${text.slice(0, 50)}`)
    if (/\n{2,}/.test(text)) guideParagraphTexts++
  }
}

// ④ 展示文本残留扫描（只查 zh 展示值）
const strings = []
const walk = (value, path) => {
  if (typeof value === 'string') { strings.push({ path, value }); return }
  if (Array.isArray(value)) return value.forEach(item => walk(item, path))
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`)
}
walk(EOTE_STORY_TEXT.chapters, 'chapters')
walk(EOTE_STORY_TEXT.campaign, 'campaign')
walk(EOTE_STORY_TEXT.localeKeys, 'localeKeys')
const zhStrings = strings.filter(item => !item.path.includes('sectionsEn') && !item.path.endsWith('.en') && !item.path.includes('Sha256'))
const RESIDUAL = [
  ['繁体著', /(?<![显土编])著(?![名作述称者书])/], ['印刷留白', /\?\?\?/], ['转义残渣', /\{'\{\}'\}|\{'/], ['占位符', /\[shelterValue\]|Shelter Value|Experience:/],
  ['重复标点', /。\.|：:|\s[,;:]/], ['英文整句', /\b[a-z]{4,}\s+[a-z]{3,}\s+[a-z]{3,}\b/],
  ['牌组', /牌组/], ['没有结局', /没有结局/], ['英文缩写', /\bMIA\b/],
  ['台港用词', /计画|网路|想像/], ['异体字', /明瞭(?=\S)/], ['半角括号', /[\u3400-\u9fff]\([^)]*\)/],
  ['markdown 斜体', /(^|[^A-Za-z0-9])_[^_\n]+_(?=[^A-Za-z0-9]|$)/],
]
for (const [name, pattern] of RESIDUAL) {
  const hits = zhStrings.filter(item => pattern.test(item.value))
  check(hits.length === 0, `残留「${name}」${hits.length} 处：${hits.slice(0, 3).map(hit => hit.path).join(', ')}`)
}

// ⑤ 分段
check(access.flattenStory({ title: '标题', body: '正文' }) === '标题\n\n正文', 'flattenStory 未按空行分段')
check(access.flattenResolution({ title: '结局', body: '正文' }) === '结局\n\n正文', 'flattenResolution 未按空行分段')
const part1Intro = String(EOTE_STORY_TEXT.chapters.iceAndDeathPart1.intro)
check(part1Intro.split(/\n{2,}/).length >= 10, `章节 intro 段落数异常：${part1Intro.split(/\n{2,}/).length}`)
const resolution = access.resolutionText('iceAndDeathPart1', 'resolution1') || ''
check(resolution.includes('\n\n'), 'resolutionText 未按空行分段')
check(!/^结局\s*\d+\s*\n+结局\s*\d+/.test(resolution), 'resolutionText 标题重复')
check(guideParagraphTexts > 0, '指南中没有保留段落空行的正文')

// ⑥ 战役记录标签覆盖
const manifest = await import(pathToFileURL(`${MOD}/content/campaigns/edgeOfTheEarth/manifest.js`).href)
const schemaKeys = Object.keys(manifest.manifest.recordSchema || {})
const labelKeys = manifest.manifest.recordLabels || {}
const missingLabels = schemaKeys.filter(key => !labelKeys[key])
check(missingLabels.length === 0, `记录键缺中文标签：${missingLabels.slice(0, 5).join(', ')}`)

const summary = {
  chapters: `${meta.presentNeedsReview}/${meta.total}`,
  localeKeys: `${localeEntries.filter(([, value]) => value.status === 'present-needs-review').length}/${localeEntries.length}`,
  guides: `${CHAPTER_IDS.length} files, zh texts ${guideTexts}, multi-paragraph ${guideParagraphTexts}`,
  recordLabels: `${Object.keys(labelKeys).length}/${schemaKeys.length}`,
  zhStrings: zhStrings.length,
}
console.log(JSON.stringify({ ok: problems.length === 0, summary, problems }, null, 2))
if (problems.length) process.exitCode = 1
