#!/usr/bin/env node
// 十循环《沉没之城》（TDC, The Drowned City）P7：剧情正文生成器。
//
//   node tools/import-tdc-story.mjs --write          生成 content/campaigns/theDrownedCity/story-text.js
//   node tools/import-tdc-story.mjs --check          逐字节复算（来源/译文/生成物漂移即失败）
//   node tools/import-tdc-story.mjs                  打印各文件叶数 / 中文缺译统计
//   node tools/import-tdc-story.mjs --stats          同上（显式）
//   node tools/import-tdc-story.mjs --verify-source <en-file>   校验自译层与英文同构、无漏译
//   node tools/import-tdc-story.mjs --dump <en-file> [path]     原样导出英文叶子（长行不截断）
//
// 事实源（只读参考工程）：
//   en：参考资源/ArkhamHorror-main/frontend/src/locales/en/theDrownedCity/{base,interludes,10 章}.json
//   zh：参考工程没有本循环 zh locale，中文来自本地自译层（不冒充官方中文）：
//       content/campaigns/theDrownedCity/story-source/zh-CN/<en-file>.json
//       或分段文件 <stem>.part<N>.json（按 N 升序深合并，供分批翻译）
//       结构与英文 JSON 一一镜像；缺译叶子逐个记入 chineseGaps，运行时回退英文。
// 输出结构（供 content/campaigns/theDrownedCity/story-access.js 与指南生成器读取）：
//   TDC_STORY_FILES['<file>'] = { en, zh, sectionsEn: {path: 英文}, sections: {path: 中文|null}, chineseGaps: [] }
//   TDC_STORY_TEXT = { campaign: base, interludes: interludes, chapters: { <chapterId>: 章文件 }, files, keys }
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MOD = fileURLToPath(new URL('../', import.meta.url))
export const HALL = join(MOD, '../..')
export const CAMPAIGN_ID = 'theDrownedCity'
export const REFERENCE_DIR = join(HALL, '参考资源/ArkhamHorror-main/frontend/src/locales/en/theDrownedCity')
export const CAMPAIGN_DIR = join(MOD, 'content/campaigns/theDrownedCity')
export const STORY_SOURCE_DIR = join(CAMPAIGN_DIR, 'story-source/zh-CN')
export const STORY_TEXT_PATH = join(CAMPAIGN_DIR, 'story-text.js')

// 参考 locale 文件清单（base + 4 段幕间/尾声 + 10 章；顺序即 chineseGaps/摘要遍历顺序）。
export const EN_FILES = Object.freeze([
  'base.json',
  'interludes.json',
  'oneLastJob.json',
  'theWesternWall.json',
  'theDrownedQuarter.json',
  'theApiary.json',
  'theGrandVault.json',
  'courtOfTheAncients.json',
  'obsidianCanyons.json',
  'sepulchreOfTheSleeper.json',
  'theDoomOfArkhamPartI.json',
  'theDoomOfArkhamPartII.json',
])

// 章节 id ↔ 参考 locale 文件（章节 id 与 CONTRACT §6 / chapter-inventory.json 一致）。
export const CHAPTER_FILE_BY_ID = Object.freeze({
  oneLastJob: 'oneLastJob.json',
  theWesternWall: 'theWesternWall.json',
  theDrownedQuarter: 'theDrownedQuarter.json',
  theApiary: 'theApiary.json',
  theGrandVault: 'theGrandVault.json',
  courtOfTheAncients: 'courtOfTheAncients.json',
  obsidianCanyons: 'obsidianCanyons.json',
  sepulchreOfTheSleeper: 'sepulchreOfTheSleeper.json',
  theDoomOfArkhamPartI: 'theDoomOfArkhamPartI.json',
  theDoomOfArkhamPartII: 'theDoomOfArkhamPartII.json',
})

export const json = value => JSON.stringify(value, null, 2) + '\n'
export const readText = path => readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
export const sha = value => createHash('sha256').update(value).digest('hex')
export const fileSha = path => (existsSync(path) ? sha(readFileSync(path)) : null)
export const relative = path => path.replaceAll('\\', '/')
  .replace(`${HALL.replaceAll('\\', '/')}/`, '')
  .replace(`${MOD.replaceAll('\\', '/')}/`, '')

const CJK = /[\u3400-\u9fff]/
// 连续 3 个以上英文词（每个 ≥3 字母）出现，视为「未译正文冒充中文」的硬信号。
const ENGLISH_RUN = /\b[a-z]{3,}(?:\s+[a-z]{3,}){2,}\b/i

const flatten = (value, prefix = '', out = []) => {
  if (typeof value === 'string') out.push([prefix, value])
  else if (Array.isArray(value)) value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out))
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) flatten(item, prefix ? `${prefix}.${key}` : key, out)
  return out
}
const pathSegments = path => String(path).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
const pathOf = (root, path) => pathSegments(path).reduce((parent, key) => parent?.[key], root)

// 自译层支持整文件 story-source/zh-CN/<file>.json，或分段 <stem>.part<N>.json（按 N 升序深合并）。
function deepMerge(base, extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra === undefined ? base : extra
  const out = (base && typeof base === 'object' && !Array.isArray(base)) ? { ...base } : {}
  for (const [key, value] of Object.entries(extra)) out[key] = deepMerge(out[key], value)
  return out
}

export function enStoryPath(file) { return join(REFERENCE_DIR, file) }
export function storySourcePath(file) { return join(STORY_SOURCE_DIR, file) }

export function loadZhTree(file) {
  if (!existsSync(STORY_SOURCE_DIR)) return { tree: null, files: [] }
  const names = readdirSync(STORY_SOURCE_DIR).filter(name => name.endsWith('.json'))
  const stem = file.replace(/\.json$/, '')
  const whole = names.includes(file) ? [file] : []
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = names
    .filter(name => new RegExp(`^${escaped}\\.part\\d+\\.json$`).test(name))
    .sort((left, right) => Number(left.match(/\.part(\d+)\.json$/)[1]) - Number(right.match(/\.part(\d+)\.json$/)[1]))
  const files = [...whole, ...parts]
  let tree = null
  for (const name of files) tree = deepMerge(tree, JSON.parse(readText(storySourcePath(name))))
  return { tree, files }
}

const stripMarkup = value => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/@:[\w.]+/g, ' ')
  .replace(/\{[^{}]*\}/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

/** 译文有效 = 有中文、且不是成段英文原样灌入；同文件内 `@:key` 引用串视为已译（由消费方解析到已译叶子）。 */
export function validTranslation(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  if (/^@:[\w.[\]]+$/.test(value.trim())) return true
  if (!CJK.test(value)) return false
  return !ENGLISH_RUN.test(stripMarkup(value))
}

export function inspectSource(file) {
  const enPath = enStoryPath(file)
  if (!existsSync(enPath)) throw new Error(`未知参考 locale 文件：${file}（可选：${EN_FILES.join(', ')}）`)
  const enTree = JSON.parse(readText(enPath))
  const zhLoaded = loadZhTree(file)
  const zhTree = zhLoaded.tree
  const leaves = flatten(enTree)
  const missing = []
  const untranslated = []
  const extra = []
  for (const [key] of leaves) {
    const zh = zhTree ? pathOf(zhTree, key) : undefined
    if (zh === undefined) missing.push(key)
    else if (!validTranslation(zh)) untranslated.push(key)
  }
  if (zhTree) {
    const enKeys = new Set(leaves.map(([key]) => key))
    for (const [key] of flatten(zhTree)) if (!enKeys.has(key)) extra.push(key)
  }
  return { file, enPath, zhTree, zhFiles: zhLoaded.files, leaves, missing, untranslated, extra }
}

export function buildStory() {
  const files = {}
  const meta = {
    status: 'generated',
    stage: 'P7-story',
    campaignId: CAMPAIGN_ID,
    sourceKind: 'reference-en-locale + local zh supplement',
    officialChinese: false,
    note: '参考工程无本循环 zh locale：中文仅来自本地自译层 story-source/zh-CN/；缺译叶子逐键列入 chineseGaps 并回退英文，不冒充官方中文。',
    generator: 'tools/import-tdc-story.mjs',
    generatedFrom: '参考资源/ArkhamHorror-main/frontend/src/locales/en/theDrownedCity',
    sources: [],
  }
  let gapCount = 0
  for (const file of EN_FILES) {
    const enPath = enStoryPath(file)
    if (!existsSync(enPath)) throw new Error(`缺少参考 locale：${relative(enPath)}`)
    const enTree = JSON.parse(readText(enPath))
    const zhLoaded = loadZhTree(file)
    const zhTree = zhLoaded.tree
    const sectionsEn = Object.fromEntries(flatten(enTree))
    const sections = {}
    const chineseGaps = []
    for (const [key, text] of Object.entries(sectionsEn)) {
      const zh = zhTree ? pathOf(zhTree, key) : null
      if (validTranslation(zh)) sections[key] = zh
      else {
        sections[key] = null
        chineseGaps.push(key)
      }
    }
    gapCount += chineseGaps.length
    files[file] = { en: enTree, zh: zhTree, sectionsEn, sections, chineseGaps }
    meta.sources.push({
      path: relative(enPath),
      sha256: fileSha(enPath),
      leaves: Object.keys(sectionsEn).length,
      translated: Object.keys(sections).filter(key => sections[key]).length,
      chinesePaths: zhLoaded.files.map(name => relative(storySourcePath(name))),
    })
  }
  meta.sources.sort((left, right) => String(left.path).localeCompare(String(right.path)))
  meta.chineseGapCount = gapCount
  const chapters = {}
  for (const [id, file] of Object.entries(CHAPTER_FILE_BY_ID)) chapters[id] = files[file]
  const keys = Object.keys(files['base.json'].en)
  const totalLeaves = Object.values(files).reduce((sum, row) => sum + Object.keys(row.sectionsEn).length, 0)
  const translatedLeaves = Object.values(files).reduce((sum, row) => sum + Object.keys(row.sections).filter(key => row.sections[key]).length, 0)
  meta.summary = {
    files: EN_FILES.length,
    chapters: Object.keys(chapters).length,
    keys: keys.length,
    leaves: totalLeaves,
    translated: translatedLeaves,
    chineseGaps: gapCount,
    fullyTranslated: gapCount === 0,
  }
  const body = '// 沉没之城（The Drowned City）· 剧情正文读取物（P7 生成物）。\n'
    + '// 本文件由 `node tools/import-tdc-story.mjs --write` 生成，请勿手改；改源或补译后重跑并 --check。\n'
    + '// 结构：TDC_STORY_FILES（逐文件 en/zh/sections/chineseGaps）· TDC_STORY_TEXT（campaign+interludes+chapters 视图）· TDC_STORY_KEYS。\n'
    + `// 生成来源：${meta.generatedFrom} + content/campaigns/theDrownedCity/story-source/zh-CN/（自译，非官方中文）。\n\n`
    + `export const TDC_STORY_META = ${json(meta)}\n`
    + `export const TDC_STORY_FILES = ${json(files)}\n`
    + `export const TDC_STORY_TEXT = ${json({
      campaign: files['base.json'],
      interludes: files['interludes.json'],
      chapters,
      files,
      keys,
    })}\n`
    + `export const TDC_STORY_KEYS = ${json(keys)}\n`
  return { body, meta, files, summary: meta.summary }
}

function main(argv) {
  const flag = name => argv.includes(name)
  const value = name => {
    const index = argv.indexOf(name)
    return index >= 0 ? argv[index + 1] : null
  }
  const verifyFile = value('--verify-source')
  if (verifyFile) {
    const report = inspectSource(verifyFile)
    const only = value('--only')
    const within = key => !only || key === only || key.startsWith(`${only}.`) || key.startsWith(`${only}[`)
    const missing = report.missing.filter(within)
    const untranslated = report.untranslated.filter(within)
    const extra = report.extra.filter(within)
    for (const path of missing) console.log(`缺译 MISSING ${path}`)
    for (const path of untranslated) console.log(`非中文/疑似未译 SUSPECT ${path}`)
    for (const path of extra) console.log(`多余 EXTRA ${path}`)
    const leaves = report.leaves.filter(([key]) => within(key))
    console.log(`${verifyFile}${only ? `（仅 ${only}）` : ''}: 译文来源 ${report.zhFiles.length ? report.zhFiles.join(', ') : '（无）'}；叶子 ${leaves.length}；缺 ${missing.length}；疑似未译 ${untranslated.length}；多余 ${extra.length}`)
    if (missing.length || untranslated.length) {
      console.error('verify-source 未通过：补齐后重跑。')
      process.exitCode = 1
    }
    return
  }
  const dumpFile = value('--dump')
  if (dumpFile) {
    const report = inspectSource(dumpFile)
    const only = value('--path')
    for (const [path, text] of report.leaves) {
      if (only && path !== only) continue
      console.log(`\n=== ${path} ===\n${text}`)
    }
    return
  }
  const story = buildStory()
  if (flag('--write')) {
    mkdirSync(CAMPAIGN_DIR, { recursive: true })
    writeFileSync(STORY_TEXT_PATH, story.body)
    console.log(`tdc story: 已写入（${story.summary.files} 文件 / ${story.summary.leaves} 叶；中文缺译 ${story.summary.chineseGaps}）`)
  } else if (flag('--check')) {
    if (!existsSync(STORY_TEXT_PATH)) throw new Error(`${relative(STORY_TEXT_PATH)} 不存在：先 --write`)
    if (readText(STORY_TEXT_PATH) !== story.body) {
      throw new Error('story-text.js 与参考 en locale / 自译层不一致：审阅差异后 --write')
    }
    console.log(`tdc story: 复算一致（${story.summary.files} 文件 / ${story.summary.leaves} 叶；中文缺译 ${story.summary.chineseGaps}）`)
  } else {
    console.log(json(story.summary))
    for (const source of story.meta.sources) {
      console.log(`${source.path}: ${source.translated}/${source.leaves} 已译${source.chinesePaths.length ? `（${source.chinesePaths.length} 个自译文件）` : ''}`)
    }
    console.log(`mod=${relative(MOD)} sha=${sha(story.body)}`)
  }
}

if (process.argv[1] && process.argv[1].endsWith('import-tdc-story.mjs')) main(process.argv.slice(2))
