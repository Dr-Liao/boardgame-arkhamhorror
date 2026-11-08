// 古老者之城（City of the Elder Things · 08621）· 章节正文读取（P7）。
//
// 正文唯一来源：`content/campaigns/edgeOfTheEarth/story-access.js`；story-text 按 locale
// `scenarios/cityOfTheElderThings.json` 的顶层键生成：`intro`/`setup.v1|v2|v3`/`specialRules`/
// `resolutions`…。三套 setup 由 definition 按版本取。
import {
  chapterStory, chapterSection, flattenStory, flattenResolution, storyText as accessStoryText,
  resolutionText as accessResolutionText,
} from '../../story-access.js'

export function storySections(chapterId) {
  try {
    return chapterStory(chapterId)?.sections || null
  } catch {
    return null
  }
}

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

/** 三套 setup 之一（v1/v2/v3；缺失时回退整个 setup 段）。 */
export function citySetupText(version = 'v1') {
  const sections = storySections('cityOfTheElderThings')
  const setup = sections?.setup
  if (setup && typeof setup === 'object' && setup[version]) return flattenStory(setup[version])
  return flattenStory(setup || '')
}

export function chapterParagraphs(chapterId, key, fallback = []) {
  const text = chapterText(chapterId, key, '')
  return text ? text.split(/\n{2,}/).map(part => part.trim()).filter(Boolean) : fallback
}

export { flattenStory, flattenResolution }
