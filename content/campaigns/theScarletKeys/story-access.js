// 绯红密钥（The Scarlet Keys）· 剧情正文读取辅助（P7）。
//
// 与 TDE 的 `story-access.js` 同一职责：`story-text.js` 是生成物（tools/import-eote-story.mjs），
// 章节 definition、interludes、flow 只通过本文件读正文，不直接拼字符串、不写死中文。
//
// 约定：生成物里所有正文段落以 `\n\n` 分隔；展示层按段落数组或整段字符串自行处理。
import { TSK_STORY_KEYS, TSK_STORY_TEXT } from './story-text.js'

export const storyParagraphs = value => String(value || '').split(/\n{2,}/).map(part => part.trim()).filter(Boolean)

/** 把 story-text 的结构（string / {title, body} / 数组 / 嵌套对象）展平成展示字符串。
 *  分段口径：title 与 body、相邻段落/子块、数组元素之间统一用空行（`\n\n`）分隔，
 *  避免故事日志/面板把标题与正文、多个步骤粘成一段。 */
export function flattenStory(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(flattenStory).filter(Boolean).join('\n\n')
  if (value && typeof value === 'object') {
    if (value.title && value.body) return `${value.title}\n\n${value.body}`
    if (Array.isArray(value.paragraphs)) return value.paragraphs.filter(Boolean).join('\n\n')
    const parts = []
    for (const child of Object.values(value)) {
      const text = flattenStory(child)
      if (text) parts.push(text)
    }
    return parts.join('\n\n')
  }
  return ''
}

/** 结局文案：`{title, body}` → 「标题 + 正文」字符串。 */
export const flattenResolution = value => flattenStory(value)

/** 章节剧情（story-text.chapters[id]）；缺失时抛错，避免静默回退到英文。 */
export function chapterStory(id) {
  const story = TSK_STORY_TEXT.chapters?.[id]
  if (!story) {
    throw new Error(`story-text 缺少章节 ${id}（先运行 node tools/import-tsk-story.mjs --write）`)
  }
  return story
}

/** 章节某正文键（顶层键 `intro`/`setup`/`resolutions`…，或点路径 `resolutions.resolution1`）。 */
export function chapterSection(id, key, fallback = '') {
  const sections = TSK_STORY_TEXT.chapters?.[id]?.sections
  if (!sections) return fallback
  if (Object.hasOwn(sections, key)) return sections[key]
  if (!String(key || '').includes('.')) return fallback
  let cursor = sections
  for (const segment of String(key).split('.')) {
    if (cursor == null || typeof cursor !== 'object' || !Object.hasOwn(cursor, segment)) return fallback
    cursor = cursor[segment]
  }
  return cursor ?? fallback
}

/** 章节某正文键的展示文本（flatten 后）。 */
export function storyText(id, key) {
  return flattenStory(chapterSection(id, key))
}

/** 章节某正文键的段落数组。 */
export function storyParagraphsOf(id, key) {
  const section = chapterSection(id, key)
  if (section && typeof section === 'object' && !Array.isArray(section) && Array.isArray(section.paragraphs)) return section.paragraphs
  return storyParagraphs(flattenStory(section))
}

/** `theScarletKeys.*` / `scenarios.*` locale 键 → `{ title, body }`（战役流程用）。 */
export function storyEntry(key) {
  return TSK_STORY_KEYS[key] ?? null
}

export function storyEntryText(key) {
  const entry = storyEntry(key)
  if (!entry) return ''
  return flattenStory(entry).replace(/\n\n/g, '\n')
}

export function storyTitle(key, fallback = '') {
  return storyEntry(key)?.title || fallback
}

/** 战役级正文（序幕/检查点/幕间/尾声/特别规则）。 */
export function campaignStory(key) {
  return TSK_STORY_TEXT.campaign?.[key] ?? null
}

/** 章节 resolution 的最终展示文本（标题 + 正文，空行分段；正文里重复的「结局 N：」前缀会被去除）。 */
export function resolutionText(id, key) {
  const resolution = TSK_STORY_TEXT.chapters?.[id]?.resolutions?.[key]
  if (!resolution) return null
  if (typeof resolution === 'string') return resolution
  const title = String(resolution.title ?? '')
  const body = title
    ? String(resolution.body ?? '').replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[：:]\\s*`), '')
    : String(resolution.body ?? '')
  return [title, body].filter(Boolean).join('\n\n')
}
