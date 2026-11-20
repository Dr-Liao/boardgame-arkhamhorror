// 沉没之城（The Drowned City）· 剧情正文读取辅助（P7）。
//
// 与 FHV/TSK/TDE 的 `story-access.js` 同一职责：`story-text.js` 是生成物
// （tools/import-tdc-story.mjs），章节 definition / 营火步骤 / flow / interludes 只通过本文件读正文，
// 不直接拼字符串、不写死中文。
//
// 数据形状：TDC_STORY_FILES['<file>'] = { en, zh, sectionsEn: {path: 英文}, sections: {path: 中文|null}, chineseGaps: [] }
// - 章节取正文：chapterStory('<chapterId>') 返回该章指南文件的 sections/sectionsEn（键为相对文件根的路径）。
// - 战役级序章/规则：campaignStory()；四段幕间与尾声：interludeStory('<key>'）。
// - 所有读取函数在数据缺失时返回空结构，不抛错（导入期/裁剪包可用）。
import { TDC_STORY_FILES, TDC_STORY_KEYS, TDC_STORY_META, TDC_STORY_TEXT } from './story-text.js'

export { TDC_STORY_FILES, TDC_STORY_KEYS, TDC_STORY_META, TDC_STORY_TEXT }

const EMPTY_STORY = Object.freeze({
  en: {}, zh: null, sectionsEn: {}, sections: {}, chineseGaps: [],
})

export const storyParagraphs = value => String(value || '').split(/\n{2,}/).map(part => part.trim()).filter(Boolean)

/** 把 story-text 的结构（string / {title, body} / 数组 / 嵌套对象）展平为展示字符串。 */
export function flattenStory(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(flattenStory).filter(Boolean).join('\n\n')
  if (!value || typeof value !== 'object') return ''
  const parts = []
  if (typeof value.title === 'string') parts.push(value.title)
  if (typeof value.body === 'string') parts.push(value.body)
  for (const [key, item] of Object.entries(value)) {
    if (key === 'title' || key === 'body') continue
    const text = flattenStory(item)
    if (text) parts.push(text)
  }
  return parts.filter(Boolean).join('\n\n')
}

/** 任一参考 locale 文件的完整数据（base / interludes / 章文件），缺失返回空结构。 */
export function fileStory(file) {
  return TDC_STORY_FILES?.[file] || EMPTY_STORY
}

/** 章节指南文件数据；缺章节时返回空数据（导入期不阻断）。 */
export function chapterStory(id) {
  return TDC_STORY_TEXT?.chapters?.[id] || EMPTY_STORY
}

/** 战役级数据（base.json：序章、campaign 规则、Campaign Log 键）。 */
export function campaignStory() {
  return TDC_STORY_TEXT?.campaign || EMPTY_STORY
}

/** 幕间/尾声数据（interludes.json：Interlude I–IV、终章导入、尾声）。 */
export function interludesStory() {
  return TDC_STORY_TEXT?.interludes || EMPTY_STORY
}

/**
 * 通用取值：storyText('interludes.json', 'anOfferYouCantRefuse.interlude1', 'zh')。
 * 中文缺译时回退英文（调用方可用 storyIsTranslated 区分），两者都没有时返回空串。
 */
export function storyText(file, key, language = 'en') {
  const story = fileStory(file)
  const zh = story.sections?.[key]
  if (language === 'zh') return zh ?? story.sectionsEn?.[key] ?? ''
  return story.sectionsEn?.[key] ?? ''
}

/** 某文件某键是否有中文译文（缺译时为 false，调用方可据此标注「中文待补」）。 */
export function storyIsTranslated(file, key) {
  return Boolean(fileStory(file).sections?.[key])
}

/** 取章节内某个键的中/英文（键为相对该章指南文件根的路径，如 `intro.body1`、`setup.gatherSets`）。 */
export function chapterText(id, key, language = 'en') {
  const story = chapterStory(id)
  if (language === 'zh') return story.sections?.[key] ?? story.sectionsEn?.[key] ?? ''
  return story.sectionsEn?.[key] ?? ''
}

/** 按键前缀取整段（返回 {en, zh} 成对叶子，供指南/正文分段使用）。 */
export function chapterLeaves(id, prefix = '') {
  const story = chapterStory(id)
  const keys = Object.keys(story.sectionsEn || {}).filter(key => !prefix || key === prefix || key.startsWith(`${prefix}.`))
  return keys.map(key => ({
    key,
    en: story.sectionsEn?.[key] ?? '',
    zh: story.sections?.[key] ?? null,
    translated: Boolean(story.sections?.[key]),
  }))
}

export const chapterChineseGaps = id => [...(chapterStory(id).chineseGaps || [])]
export const fileChineseGaps = file => [...(fileStory(file).chineseGaps || [])]
export const allChineseGaps = () => Object.fromEntries(Object.keys(TDC_STORY_FILES || {})
  .map(file => [file, fileChineseGaps(file)]).filter(([, gaps]) => gaps.length))

/** 章节是否已具备全部必需正文（每章 intro 与全部结局的叶子；campaign 层测试用）。 */
export function missingChapterStory(id, resolutionIds = []) {
  const story = chapterStory(id)
  const missing = []
  if (!Object.keys(story.sectionsEn || {}).some(key => key === 'intro' || key.startsWith('intro.'))) missing.push('intro')
  for (const outcome of resolutionIds) {
    if (!Object.keys(story.sectionsEn || {}).some(key => key === `resolutions.${outcome}` || key.startsWith(`resolutions.${outcome}.`))) {
      missing.push(`resolutions.${outcome}`)
    }
  }
  return missing
}

/** 章节指南必备正文的英/中缺失情况（中文缺译单独列出，用于降级提示）。 */
export function chapterTranslationStatus(id, resolutionIds = []) {
  const story = chapterStory(id)
  const missingEn = missingChapterStory(id, resolutionIds)
  const missingZh = []
  const keys = Object.keys(story.sectionsEn || {})
  for (const key of keys) {
    if (!story.sections?.[key] && (key === 'intro' || key.startsWith('intro.') || key.startsWith('resolutions.'))) missingZh.push(key)
  }
  return { missingEn, missingZh, chineseGaps: chapterChineseGaps(id) }
}
