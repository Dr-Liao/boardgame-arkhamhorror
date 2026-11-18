#!/usr/bin/env node
// 九循环《铁杉谷盛宴》（FHV）P7：剧情正文/指南读取物生成器。
//
//   node tools/import-fhv-story.mjs --write   生成 content/campaigns/theFeastOfHemlockVale/story-text.js
//   node tools/import-fhv-story.mjs --check   逐字节复算
//   node tools/import-fhv-story.mjs           打印摘要
//
// 事实源（只读参考工程）：
//   en：frontend/src/locales/en/theFeastOfHemlockVale/{base,writtenInRock,...}.json（9 份）
//   zh：参考工程无 FHV 中文 locale，因此中文由本地自译层提供：
//       content/campaigns/theFeastOfHemlockVale/story-source/<file>.json
//       （结构与 en 对应的嵌套对象一致；缺译叶子在 chineseGaps 显式标记，展示层回退英文但不冒充中文）
// 输出结构（供 content/.../story-access.js 与指南生成器读取）：
//   FHV_STORY_FILES['<file>'] = { en: 嵌套原文, zh: 嵌套译文或 null, sectionsEn: {'path': text}, sections: {...}, chineseGaps: [...] }
//   FHV_STORY_TEXT = { campaign: FHV_STORY_FILES['base.json'], chapters: { '<scenarioId>': FHV_STORY_FILES['<guide>'] }, files: ... }
//   FHV_STORY_KEYS = base.json 顶层键
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'

import {
  CAMPAIGN_ID, EN_GUIDE_FILES, GUIDE_FILE_BY_SCENARIO, MOD, STORY_SOURCE_DIR, STORY_TEXT_PATH,
  enGuidePath, fileSha, json, readText, relative, sha, storySourcePath,
} from './fhv-campaign-lib.mjs'

const CJK = /[\u3400-\u9fff]/
const flatten = (value, prefix = '', out = []) => {
  if (typeof value === 'string') out.push([prefix, value])
  else if (Array.isArray(value)) value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out))
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) flatten(item, prefix ? `${prefix}.${key}` : key, out)
  return out
}
const pathSegments = path => String(path).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
const pathOf = (root, path) => pathSegments(path).reduce((parent, key) => parent?.[key], root)

// 自译层支持分段文件：story-source/<file>.json，或 story-source/<stem>.part<N>.json（按 N 升序深合并）。
// 翻译 worker 只写自己那一段，互不覆盖；合并结果必须与 en 同构（缺键即 chineseGaps）。
function deepMerge(base, extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra === undefined ? base : extra
  const out = (base && typeof base === 'object' && !Array.isArray(base)) ? { ...base } : {}
  for (const [key, value] of Object.entries(extra)) out[key] = deepMerge(out[key], value)
  return out
}

function loadZhTree(file) {
  const dir = STORY_SOURCE_DIR
  if (!existsSync(dir)) return { tree: null, files: [] }
  const names = readdirSync(dir).filter(name => name.endsWith('.json'))
  const stem = file.replace(/\.json$/, '')
  const whole = names.includes(file) ? [file] : []
  const parts = names
    .filter(name => new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.part\\d+\\.json$`).test(name))
    .sort((left, right) => Number(left.match(/\.part(\d+)\.json$/)[1]) - Number(right.match(/\.part(\d+)\.json$/)[1]))
  const files = [...whole, ...parts]
  let tree = null
  for (const name of files) tree = deepMerge(tree, JSON.parse(readText(storySourcePath(name))))
  return { tree, files }
}

export function buildStory() {
  const files = {}
  const meta = {
    status: 'generated',
    stage: 'P7-story',
    sourceKind: 'reference-en-locale + local zh supplement',
    officialChinese: false,
    note: '参考工程无本循环 zh locale：中文仅来自本地自译层 story-source/；缺译叶子逐键列入 chineseGaps 并回退英文，不冒充官方中文。',
    generator: 'tools/import-fhv-story.mjs',
    generatedFrom: '参考资源/ArkhamHorror-main/frontend/src/locales/en/theFeastOfHemlockVale',
    sources: [],
  }
  let gapCount = 0
  for (const file of EN_GUIDE_FILES) {
    const enPath = enGuidePath(file)
    const enTree = JSON.parse(readText(enPath))
    const zhLoaded = loadZhTree(file)
    const zhTree = zhLoaded.tree
    const sectionsEn = Object.fromEntries(flatten(enTree))
    const sections = {}
    const chineseGaps = []
    for (const [key, text] of Object.entries(sectionsEn)) {
      const zh = zhTree ? pathOf(zhTree, key) : null
      const translated = typeof zh === 'string' && zh.trim() && CJK.test(zh)
      if (translated) sections[key] = zh
      else {
        sections[key] = null
        chineseGaps.push(key)
      }
    }
    gapCount += chineseGaps.length
    files[file] = { en: enTree, zh: zhTree, sectionsEn, sections, chineseGaps }
    meta.sources.push({
      path: relative(enPath), sha256: fileSha(enPath),
      ...(zhLoaded.files.length
        ? { chinesePaths: zhLoaded.files.map(name => relative(storySourcePath(name))) }
        : { chinesePaths: [] }),
    })
  }
  meta.sources.sort((left, right) => String(left.path).localeCompare(String(right.path)))
  meta.chineseGapCount = gapCount
  const chapters = {}
  for (const [id, file] of Object.entries(GUIDE_FILE_BY_SCENARIO)) chapters[id] = files[file]
  const keys = Object.keys(files['base.json'].en)
  const summary = {
    files: EN_GUIDE_FILES.length,
    chapters: Object.keys(chapters).length,
    keys: keys.length,
    leaves: Object.values(files).reduce((sum, row) => sum + Object.keys(row.sectionsEn).length, 0),
    translated: Object.values(files).reduce((sum, row) => sum + Object.keys(row.sections).filter(key => row.sections[key]).length, 0),
    chineseGaps: gapCount,
    selfTranslated: gapCount === 0,
  }
  const body = '// 铁杉谷盛宴（The Feast of Hemlock Vale）· 剧情正文/指南读取物（P7 生成物）。\n'
    + '// 本文件由 `node tools/import-fhv-story.mjs --write` 生成，请勿手改；改源或补译后重跑并 --check。\n'
    + '// 结构：FHV_STORY_FILES（逐文件 en/zh/sections/chineseGaps）· FHV_STORY_TEXT（campaign+chapters 视图）· FHV_STORY_KEYS。\n\n'
    + `export const FHV_STORY_META = ${json(meta)}\n`
    + `export const FHV_STORY_FILES = ${json(files)}\n`
    + `export const FHV_STORY_TEXT = ${json({ campaign: files['base.json'], chapters, files })}\n`
    + `export const FHV_STORY_KEYS = ${json(keys)}\n`
  return { body, meta, files, summary }
}

if (process.argv[1] && process.argv[1].endsWith('import-fhv-story.mjs')) {
  const story = buildStory()
  if (process.argv.includes('--write')) {
    writeFileSync(STORY_TEXT_PATH, story.body)
    writeFileSync(STORY_TEXT_PATH.replace(/story-text\.js$/, 'story-summary.json'), json({ meta: story.meta, summary: story.summary }))
    console.log(`fhv story: 已写入（${story.summary.files} 文件 / ${story.summary.leaves} 叶；中文缺译 ${story.summary.chineseGaps}）`)
  } else if (process.argv.includes('--check')) {
    if (!existsSync(STORY_TEXT_PATH)) throw new Error('content/campaigns/theFeastOfHemlockVale/story-text.js 不存在：先 --write')
    if (readText(STORY_TEXT_PATH) !== story.body) throw new Error('story-text.js 与来源/补译不一致：审阅后 --write')
    console.log(`fhv story: 复算一致（中文缺译 ${story.summary.chineseGaps}）`)
    if (story.summary.chineseGaps > 0) throw new Error('中文翻译未完成：chineseGaps > 0')
  } else {
    console.log(json(story.summary))
    console.log(`campaign=${CAMPAIGN_ID} sha=${sha(story.body)} mod=${relative(MOD)}`)
  }
}
