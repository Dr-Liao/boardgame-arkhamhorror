// 月之暗面（Dark Side of the Moon · 06206）· 章节剧情文本（P8-T 已自译）。
//
// 正文不再保存英文原文：全部来自生成物 `../../story-text.js`（story-source 14 批 →
// `tools/import-tde-story.mjs` 生成，运行时只读生成物）。本文件只按 en locale 的顶层键名
// （heading / setup / rules / specialRules / intro / intro1 / intro2 / resolutions）把中文投影成
// definition 既有的导出名与结构，供章节数据、测试与 UI 共用。
// `TOKENS` 是剧本参考卡 06206 的混乱标记卡面文本：中文逐字取自 cards-data 06206 的
// textZh/backTextZh（P8-T：token 不进剧情生成物，与其他章节同口径）。
import { chapterStory, flattenStory } from '../../story-access.js'

const story = chapterStory('darkSideOfTheMoon')
const section = key => story.sections[key]
const ruleOf = rule => Object.freeze({ title: rule.title, body: rule.body })

export const HEADING = flattenStory(section('heading'))

export const SETUP = Object.freeze(Object.fromEntries(
  Object.entries(section('setup')).map(([key, value]) => [key, flattenStory(value)]),
))

export const RULES = Object.freeze(Object.fromEntries(
  Object.entries(section('rules')).map(([key, value]) => [key, ruleOf(value)]),
))

export const SPECIAL_RULES = Object.freeze(section('specialRules').map(ruleOf))

export const INTRO = Object.freeze(Object.fromEntries(
  ['intro', 'intro1', 'intro2'].map(key => [key, ruleOf(section(key))]),
))

export const RESOLUTIONS = Object.freeze(Object.fromEntries(
  Object.entries(section('resolutions')).map(([key, value]) => [key, ruleOf(value)]),
))

export const TOKENS = Object.freeze({
  "easyStandard": {
    "skull": "-X，X为你警报等级的一半(向上取整)。",
    "cultist": "再揭示一个标记。如果你检定失败，并且你的警报等级高于你修正后的技能值，本次技能检定结束后，抽取遭遇牌库顶的卡牌。",
    "tablet": "-1。如果你检定失败，你的警报等级提高1级。",
    "elderThing": "+1。黑猫召唤了几只猫来帮你。如果在尝试躲避期间揭示本标记，并且你检定成功，对躲避的敌人造成2点伤害。"
  },
  "hardExpert": {
    "skull": "-X，X为你的警报等级。",
    "cultist": "再揭示一个标记。如果你检定失败，并且你的警报等级高于你修正后的技能值，本次技能检定结束后，抽取遭遇牌库顶的卡牌。",
    "tablet": "-2。如果你检定失败，你的警报等级提高1级。",
    "elderThing": "0。黑猫召唤了几只猫来帮你。如果在尝试躲避期间揭示本标记，并且你检定成功，对躲避的敌人造成2点伤害。"
  }
})
