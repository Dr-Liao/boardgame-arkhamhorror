// 疯狂之心 第 I 部分 · 剧情正文读取层（唯一入口：story-text.js → story-access.js）。
//
// 本文件不写死任何正文；definition/behavior/测试都从 `story` 对象取：
//   · story.intro / story.setup：章节开场与完整设置（中文优先、缺失回退 en）；
//   · story.sections[path]：逐段双语叶子（含 sourceSha256，供覆盖核对）；
//   · story.resolutions[key]：结局标题 + 正文。
// p2-flow 重新生成 story-text 时本文件无需改动。
import { chapterStory, flattenStory, flattenResolution, storyParagraphs } from '../../story-access.js'

export const chapterId = 'theHeartOfMadnessPart1'
export const story = chapterStory(chapterId)

export const title = story.title
export const titleEn = story.titleEn
export const status = story.status
export const intro = flattenStory(story.intro)
export const setup = flattenStory(story.setup)
export const setupParagraphs = storyParagraphs(setup)
export const sections = story.sections
export const sectionCount = story.sectionCount
export const guideKeyCount = story.guideKeyCount
export const chinese = story.chinese
export const sources = story.sources
export const resolutions = Object.freeze(Object.fromEntries(
  Object.entries(story.resolutions || {}).map(([key, value]) => [key, flattenResolution(value)]),
))
export const narration = Object.freeze([...(story.narration || [])])
