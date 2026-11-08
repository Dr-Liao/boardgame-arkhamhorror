// 失落之峰（To the Forbidden Peaks · 08596）· 章节正文读取（P7）。
//
// 正文唯一来源：`content/campaigns/edgeOfTheEarth/story-access.js`（story-text.js 由 p2-flow 生成）。
// p2-flow 未就绪时 story-text 的章节正文为空，本文件回退到卡片印刷文本/简短占位，
// 保证 definition 结构可读；正文就绪后自动生效，无需改章节代码。
import {
  chapterStory, chapterSection, flattenStory, flattenResolution, storyText as accessStoryText,
  resolutionText as accessResolutionText,
} from '../../story-access.js'

/** 章节 sections（story-text 生成物）；缺失时返回 null（不抛错，便于联调期测试）。 */
export function storySections(chapterId) {
  try {
    return chapterStory(chapterId)?.sections || null
  } catch {
    return null
  }
}

/** 章节 section 数（story-text.sectionCount；缺失返回 0）。 */
export function sectionCountOf(chapterId) {
  try {
    return Number(chapterStory(chapterId)?.sectionCount) || 0
  } catch {
    return 0
  }
}

export function chapterText(chapterId, key, fallback = '') {
  const section = chapterSection(chapterId, key, null)
  if (section == null) return fallback
  const text = flattenStory(section)
  return text || fallback
}

export function storyTextOf(chapterId, key, fallback = '') {
  try {
    return accessStoryText(chapterId, key) || fallback
  } catch {
    return fallback
  }
}

export function resolutionTextOf(chapterId, key, fallback = '') {
  try {
    return accessResolutionText(chapterId, key) || fallback
  } catch {
    return fallback
  }
}

export function chapterParagraphs(chapterId, key, fallback = []) {
  const text = chapterText(chapterId, key, '')
  return text ? text.split(/\n{2,}/).map(part => part.trim()).filter(Boolean) : fallback
}

export { flattenStory, flattenResolution }
