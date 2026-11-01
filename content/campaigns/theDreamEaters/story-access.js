// 食梦者（The Dream Eaters）· 剧情正文读取辅助（P8-T）。
//
// `story-text.js` 是生成物（内容 → `content/campaigns/theDreamEaters/story-source/*.json` →
// `tools/import-tde-story.mjs`）；章节 `definition.js`、`interludes.js`、`dual-story.js` 只通过本文件
// 读正文，不直接拼字符串、不写死中文，方便 P8-T 之后重生成与 P9 校对。
//
// 约定：生成物里所有正文段落以 `\n\n` 分隔；展示层按段落数组或整段字符串自行处理。
import { TDE_STORY_KEYS, TDE_STORY_TEXT } from './story-text.js'

export const storyParagraphs = value => String(value || '').split(/\n{2,}/).map(part => part.trim()).filter(Boolean)

/** 把 story-text 的结构（string / {title, body} / 数组 / 嵌套对象）展平成展示字符串。 */
export function flattenStory(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(flattenStory).filter(Boolean).join('\n')
  if (value && typeof value === 'object') {
    const parts = []
    if (value.title && value.body) return `${value.title}\n${value.body}`
    for (const child of Object.values(value)) {
      const text = flattenStory(child)
      if (text) parts.push(text)
    }
    return parts.join('\n')
  }
  return ''
}

/** 结局文案：`{title, body}` → 既有 definition 期望的「标题 + 正文」字符串。 */
export const flattenResolution = value => flattenStory(value)

/** 解析后的章节正文：既可直接取键（storyText），也可取段落数组（storyParagraphsOf）。 */
export function storyText(id, key) {
  const section = chapterSection(id, key)
  return flattenStory(section)
}

export function storyParagraphsOf(id, key) {
  const section = chapterSection(id, key)
  if (section && typeof section === 'object' && !Array.isArray(section) && Array.isArray(section.paragraphs)) return section.paragraphs
  return storyParagraphs(flattenStory(section))
}

/** 章节剧情（story-text.chapters[id]）；缺失时抛错，避免静默回退到英文。 */
export function chapterStory(id) {
  const story = TDE_STORY_TEXT.chapters[id]
  if (!story) throw new Error(`story-text 缺少章节 ${id}（先运行 node tools/import-tde-story.mjs --write）`)
  return story
}

/** 章节 scenario 的某个顶层正文键（`intro`/`intro1`/`setup`/`resolutions`/`dreams`…）。 */
export function chapterSection(id, key, fallback = '') {
  return chapterStory(id).sections[key] ?? fallback
}

/** `theDreamEaters.*` locale 键 → `{ title, body }`（interludes/dual-story/manifest 用）。 */
export function storyEntry(key) {
  return TDE_STORY_KEYS[key] ?? null
}

/** locale 键的正文整段中文（段落间 `\n`，供 flow 节点的单段 text）。 */
export function storyEntryText(key) {
  const entry = storyEntry(key)
  if (!entry) return ''
  return String(entry.body || '').replace(/\n\n/g, '\n')
}

/** 幕间/尾声标题：优先 story-text，回退英文标题（仅用于未翻译键，P8-T 后不应发生）。 */
export function storyTitle(key, fallback = '') {
  return storyEntry(key)?.title || fallback
}

/** 16 段尾声之一（1–16）或特殊尾声。 */
export function epilogueCell(id) {
  return TDE_STORY_TEXT.epilogue.cells.find(cell => cell.id === Number(id)) || null
}

export function epilogueSpecial(key) {
  return TDE_STORY_TEXT.epilogue.special[key] || null
}

/** 章节 resolutions 的最终展示文本（标题 + 正文，没有标题时只有正文）。 */
export function resolutionText(id, key) {
  const resolution = chapterStory(id).resolutions?.[key]
  if (!resolution) return null
  if (typeof resolution === 'string') return resolution
  return [resolution.title, resolution.body].filter(Boolean).join('\n')
}
