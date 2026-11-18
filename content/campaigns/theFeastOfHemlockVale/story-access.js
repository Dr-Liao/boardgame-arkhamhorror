// 铁杉谷盛宴（The Feast of Hemlock Vale）· 剧情正文读取辅助（P7）。
//
// 与 TSK/TDE 的 `story-access.js` 同一职责：`story-text.js` 是生成物
// （tools/import-fhv-story.mjs），章节 definition / interludes / flow 只通过本文件读正文，
// 不直接拼字符串、不写死中文。
//
// 数据形状：FHV_STORY_FILES['<file>'] = { en, zh, sectionsEn: {path: 英文}, sections: {path: 中文|null}, chineseGaps: [] }
// 章节取正文：chapterStory('<scenarioId>') 返回该章指南文件的 sections/sectionsEn（键为相对文件根的路径）。
import { FHV_STORY_FILES, FHV_STORY_KEYS, FHV_STORY_META, FHV_STORY_TEXT } from './story-text.js'

export { FHV_STORY_FILES, FHV_STORY_KEYS, FHV_STORY_META, FHV_STORY_TEXT }

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

/** 章节指南文件数据；缺章节时返回空数据（导入期不阻断）。 */
export function chapterStory(id) {
  return FHV_STORY_TEXT.chapters?.[id] || { sectionsEn: {}, sections: {}, en: {}, zh: null, chineseGaps: [] }
}

/** 取章节内某个键的中/英文（键为相对该章指南文件根的路径，如 `intro.body`、`setup.body`）。 */
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
