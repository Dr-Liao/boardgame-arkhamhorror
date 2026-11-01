// 神居之所（Where the Gods Dwell · 06286）· 章节剧情文本（P8-T 已自译）。
//
// 正文不再保存英文原文：来自生成物 `../../story-text.js`（story-source 14 批 →
// `tools/import-tde-story.mjs` 生成，运行时只读生成物）。本文件只按 en locale 顶层键名
// （heading / setup / intro / intro1 / intro2 / grandDesign1..5 / resolutions）把中文投影成
// definition 既有的 `EN_TEXTS` 结构（导出名沿用 P8 读取路径，内容已是 story-text 中文）。
import { chapterStory, flattenStory } from '../../story-access.js'

const story = chapterStory('whereTheGodsDwell')
const section = key => story.sections[key]
const textOf = value => flattenStory(value?.body ?? value)

export const TDE_WGD_TEXT_META = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  source: 'story-text.js（P8-T 自译；生成器 tools/import-tde-story.mjs）',
})

export const EN_TEXTS = Object.freeze({
  intro: textOf(section('intro')),
  introOne: textOf(section('intro1')),
  introTwo: textOf(section('intro2')),
  setup: flattenStory(section('setup')),
  grandDesign1: textOf(section('grandDesign1')),
  grandDesign2: textOf(section('grandDesign2')),
  grandDesign3: textOf(section('grandDesign3')),
  grandDesign4: textOf(section('grandDesign4')),
  grandDesign5: textOf(section('grandDesign5')),
  noResolution: textOf(section('resolutions').noResolution),
  resolution1: textOf(section('resolutions').resolution1),
  resolution2: textOf(section('resolutions').resolution2),
  resolution3: textOf(section('resolutions').resolution3),
  resolution4: textOf(section('resolutions').resolution4),
  resolution5: textOf(section('resolutions').resolution5),
})
