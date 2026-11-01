// 万千骇形（A Thousand Shapes of Horror · 06168）章节文本（P8-T 自译）。
//
// 剧情/设置/结局/记忆标签只从 story-text.js（生成物）读取：
// `chapterStory('aThousandShapesOfHorror').sections`（en locale 顶层键一一对应）。
// 混乱标记文本逐字取自 cards-data 06168 的 textZh/backTextZh（P8-T：token 不进剧情生成物，
// 与 weaverOfTheCosmos 同口径）。
// textLanguage: 'zh-CN' / textStatus: 'translated (self-translated)'。
import { chapterStory, flattenStory } from '../../story-access.js'

const story = chapterStory('aThousandShapesOfHorror')
const sections = story.sections
const text = value => flattenStory(value)

export const HEADING = text(sections.heading)

export const SETUP = Object.freeze({
  gatherSets: text(sections.setup.gatherSets),
  putLocations: text(sections.setup.putLocations),
  beginAtBurialGround: text(sections.setup.beginAtBurialGround),
  setCardsAside: text(sections.setup.setCardsAside),
  buildEncounterDeck: text(sections.setup.buildEncounterDeck),
})

// en `intro1..4` = {title, body}（story-text: sections.intro1..4，title 为章节标题）。
const introOf = key => Object.freeze({ title: text(sections[key].title), body: text(sections[key].body) })

export const INTRO = Object.freeze({
  intro1: introOf('intro1'),
  intro2: introOf('intro2'),
  intro3: introOf('intro3'),
  intro4: introOf('intro4'),
})

// en `resolutions` = {noResolution, resolution1..4} 的 {title, body}（story-text: sections.resolutions）。
export const RESOLUTIONS = Object.freeze(Object.fromEntries(
  Object.entries(sections.resolutions).map(([key, value]) => [key, Object.freeze({
    title: text(value.title),
    body: text(value.body),
  })]),
))

// en `remembered` = 4 条「记忆中」标签（story-text: sections.remembered）。
export const REMEMBERED = Object.freeze({ ...sections.remembered })

// 混乱标记文本：中文逐字取自 cards-data 06168 的 textZh/backTextZh（唯一允许的中文来源）。
export const TOKENS = Object.freeze({
  easyStandard: Object.freeze({
    skull: '-1(如果你位于[[墓地]]地点，改为-3)。',
    cultist: '再揭示一个标记。如果你检定失败并且不可名状之物在场上，其攻击你(无论其当前地点)。',
    tablet: '+2。黑猫掩护你。如果本次检定成功，选择并躲避任意地点的一个攻击值不超过X的敌人，其中X为你超过难度的点数。',
    elderThing: '-2。如果你检定失败，你必须将你的1个线索放到你所在地点，或者受到1点伤害。',
  }),
  hardExpert: Object.freeze({
    skull: '-2(如果你位于[[墓地]]地点，改为-4)。',
    cultist: '再揭示一个标记。如果你检定失败并且不可名状之物在场上，其攻击你(无论其当前地点)。',
    tablet: '+1。黑猫掩护你。如果本次检定成功，选择并躲避任意地点的一个攻击值不超过X的敌人，其中X为你超过难度的点数。',
    elderThing: '-3。如果你检定失败，你必须将你的1个线索放到你所在地点，或者受到1点伤害。',
  }),
})
