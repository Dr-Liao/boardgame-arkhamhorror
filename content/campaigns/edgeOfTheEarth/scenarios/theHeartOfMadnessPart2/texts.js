// 疯狂之心 第 II 部分 · 剧情正文读取层（唯一入口 story-text.js → story-access.js）。
// 本文件不写死正文；缺译叶子由 story.chineseGaps 显式标记，展示层回退 sectionsEn 并标注「中文待补」。
import { chapterStory, flattenStory, flattenResolution, storyParagraphs } from '../../story-access.js'

export const chapterId = 'theHeartOfMadnessPart2'
export const story = chapterStory(chapterId)
export const title = story.title
export const titleEn = story.titleEn
export const status = story.status
export const intro = flattenStory(story.intro)
export const setup = flattenStory(story.setup)
export const setupParagraphs = storyParagraphs(setup)
export const sections = story.sections
export const sectionsEn = story.sectionsEn
export const chineseGaps = story.chineseGaps
export const sectionCount = story.sectionCount
export const guideKeyCount = story.guideKeyCount
export const sources = story.sources
export const resolutions = Object.freeze(Object.fromEntries(
  Object.entries(story.resolutions || {}).map(([key, value]) => [key,
    typeof value === 'string' ? value : (value?.text || flattenResolution(value))]),
))
