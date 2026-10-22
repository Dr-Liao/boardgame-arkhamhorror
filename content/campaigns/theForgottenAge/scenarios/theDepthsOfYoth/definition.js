import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

// Haskell setup: gather TheDepthsOfYoth / AgentsOfYig / YigsVenom / Expedition /
// ForgottenRuins / Poison；把古代遗物、伊格（怒气 > 0 时）、4 张中毒与随机 4 处
// 地点放在一边。9 个地点洗混后：1 处作为本深度等级的起始地点，5 张组成探索牌库
// （幽嘶的阶梯 + 4 处），其余 4 处放在一边。
const deckGroups = ['the_depths_of_yoth', 'agents_of_yig', 'venom', 'expedition', 'ruins', 'poison']
// 04102「中毒」是永久弱点：只在一边备用，不进遭遇牌库。
// 04296「伊格」被 gather 之后立刻按怒气放进一边 / 追击区域 / 移出游戏，也不留在牌库里。
const gathered = encounterCards(deckGroups).filter(card => card.code !== '04102')
const deckCards = gathered.filter(card => card.code !== '04296')
// 瓦卢西亚的预示者只在「预言者仍存活」时按记录伤害入场，本身不进遭遇牌库。
const setAsideEnemies = ['04062'].map(code => ALL_CARDS[code])
const definitions = encounterDefinitions([...gathered, ...setAsideEnemies], {
  enemies: {
    // 伊格：生命值 +6[per_investigator]（基础 6）。卡面关键词只有「猎手。庞大。」：
    // 共享的关键词启发式会把「每个其他蛇族敌人获得警戒和反击」误判成伊格自己的
    // 关键词，这里按卡面改回 false。
    '04296': { healthPerPlayerBonus: 6, alert: false, retaliate: false },
    // 深渊吞噬者：躲避值为 X = 当前深度等级，由行为钩子按深度补正。
    '04298': { evade: 0 },
  },
})
// 瓦卢西亚的预示者（04062）的 per-investigator 生命 10 与复仇 5 由共享的
// card-data.js ENEMY_RULES 提供，本章不再重复声明。

// 符号地图照 Arkham/Location/CardDefs/TheForgottenAge/TheDepthsOfYoth.hs：
// 「本地点符号 → 相连符号」逐条抄录，连线由 linkSymbolLocations 推导。
// 注：共享的 SYMBOLS 表没有收录「水滴」（Haskell 的 Droplet），这里按原样保留 key。
const locations = {
  stepsOfYoth: location('stepsOfYoth', '04286', {
    symbol: 'equals', links: ['hourglass', 'square', 'triangle', 'diamond', 'heart'],
  }),
  cityOfTheSerpents: location('cityOfTheSerpents', '04287', {
    symbol: 'diamond', links: ['equals', 'droplet', 'triangle', 't', 'square'],
  }),
  hallOfHeresy: location('hallOfHeresy', '04288', {
    symbol: 'triangle', links: ['equals', 'diamond', 'circle', 'square', 't'],
  }),
  crumblingPrecipice: location('crumblingPrecipice', '04289', {
    symbol: 'hourglass', links: ['equals', 'squiggle', 'heart', 't', 'droplet'],
  }),
  cavernsOfYoth: location('cavernsOfYoth', '04290', {
    symbol: 'droplet', links: ['circle', 'hourglass', 'heart', 'diamond', 'squiggle'],
  }),
  forkedPath: location('forkedPath', '04291', {
    symbol: 't', links: ['circle', 'diamond', 'hourglass', 'square', 'triangle'],
  }),
  bridgeOverNKai: location('bridgeOverNKai', '04292', {
    symbol: 'heart', links: ['equals', 'circle', 'droplet', 'hourglass', 'squiggle'],
  }),
  brokenPassage: location('brokenPassage', '04293', {
    symbol: 'squiggle', links: ['circle', 'droplet', 'hourglass', 'square', 'heart'],
  }),
  // 被遗弃的仪式场所：帷幕 X（= 当前深度等级），印刷数据里的 -2 是 X 的占位值。
  abandonedSite: location('abandonedSite', '04294', {
    shroud: 0, symbol: 'square', links: ['equals', 'diamond', 'triangle', 't', 'squiggle'],
  }),
  brightCanyon: location('brightCanyon', '04295', {
    symbol: 'circle', links: ['droplet', 'squiggle', 't', 'heart', 'triangle'],
  }),
}
linkSymbolLocations(locations)
// Haskell 里这两处地点带 `vengeance 2`：线索被取空 / 有调查员在场时视同进入胜利区。
Object.assign(locations.cityOfTheSerpents, { vengeance: 2 })
Object.assign(locations.hallOfHeresy, { vengeance: 2 })

// 除幽嘶的阶梯之外的 9 处地点会被洗混成「起始 / 探索牌库 / 一边」三段。
export const DEPTH_LOCATIONS = Object.freeze([
  'cityOfTheSerpents', 'hallOfHeresy', 'crumblingPrecipice', 'cavernsOfYoth', 'forkedPath',
  'bridgeOverNKai', 'brokenPassage', 'abandonedSite', 'brightCanyon',
])
export const STEPS_OF_YOTH = 'stepsOfYoth'
export const RELIC_OF_AGES = '04303'
export const HARBINGER = '04062'
// 怒气为 0 时，布署会把伊格与 3 张深坑守卫移出游戏（不进遭遇牌库）。
export const YIG = '04296'
export const PIT_WARDEN = '04297'
export const EATER_OF_THE_DEPTHS = '04298'
export const CHILDREN_OF_VALUSIA = '04299'

// Haskell setAgendaDeck：按伊格之怒的档位裁掉前面的密谋；04283 与 04284 恒在。
export const AGENDA_GATES = Object.freeze([
  { code: '04278', furyBelow: 6 },
  { code: '04279', furyBelow: 11 },
  { code: '04280', furyBelow: 15 },
  { code: '04281', furyBelow: 18 },
  { code: '04282', furyBelow: 21 },
  { code: '04283', furyBelow: null },
  { code: '04284', furyBelow: null },
])

export function agendaCodesFor(yigsFury) {
  const fury = Number(yigsFury || 0)
  return AGENDA_GATES.filter(entry => entry.furyBelow == null || fury < entry.furyBelow)
    .map(entry => entry.code)
}

// 幕只有一张（04285 前往联结点），推进后按卡面翻回正面，因此运行时反复推进同一张。
const acts = stages(['04285'], 'act').map(act => ({
  ...act,
  reveal: { type: 'campaignRule' },
  objective: { type: 'clues', perInvestigator: 3, atLocation: STEPS_OF_YOTH },
}))

// 最后一张密谋「复仇」（04284）没有毁灭阈值（Haskell：doomThresholdL .~ Nothing），不能被毁灭推进。
// 第 114 轮：按牌库顺序（最后一张）判断，不再写死卡号。
const AGENDA_CODES = ['04278', '04279', '04280', '04281', '04282', '04283', '04284']
const LAST_AGENDA_INDEX = AGENDA_CODES.length - 1
const agendas = stages(AGENDA_CODES, 'agenda')
  .map((agenda, index) => ({
    ...agenda,
    reveal: { type: 'campaignRule' },
    ...(index === LAST_AGENDA_INDEX
      ? { doomThreshold: null, objective: { type: 'allDefeated' } }
      : {}),
  }))

export const scenario = {
  id: 'theDepthsOfYoth',
  originalCode: '04277',
  name: '失落的时代 · 幽嘶深渊',
  intro: '阶梯底部的红光把你们引进一座庞大得不像人类建造的地下城市。伊塔卡说这里叫幽嘶，而某个巨大的东西正随着每一次脚步震动整片洞窟。',
  setup: '收齐“幽嘶深渊、伊格的使徒、蛇毒、远征、遗忘遗迹、毒素”遭遇组；把“古代遗物”、4 张“中毒”与随机 4 处地点放在一边。洗混 9 处地点，随机 1 处作为本深度等级的起始地点，其余组成探索牌库与一边。怒气 ≥18 时从第 5 张密谋开始，≥21 时从第 6 张开始；怒气为 0 时把伊格与深坑守卫移出游戏。当前深度等级从 1 开始。',
  // 起始地点由布署随机决定（见 behavior.setupPlan），这里只声明图鉴默认值。
  startLocation: 'cityOfTheSerpents',
  locations,
  setAsideLocations: [],
  acts,
  agendas,
  // 04285 印着 [action]：探索（仅当地点无线索时）。
  scriptCards: { explore: { card: 'act' } },
  ...definitions,
  storyAssets: storyCards([RELIC_OF_AGES]),
  encounterDeck: encounterDeck(deckCards),
  resolutions: {
    noResolution: '你们没能走到联结点。按结局 1 结算：记录“你们坠入了深渊”，并按当前深度等级承担额外创伤。',
    r1: '你们坠入了深渊。记录“你们坠入了深渊”；胜利区每有 1 点复仇点数，就在“伊格之怒”下方作 1 次记录。按当前深度等级承担额外创伤；获得等于胜利区胜利点之和的 XP，外加等于当前深度等级的 XP。',
    r2: '联结点就在前方。记录“联结点近在眼前”；胜利区每有 1 点复仇点数，就在“伊格之怒”下方作 1 次记录。获得等于胜利区胜利点之和的 XP，外加等于当前深度等级的 XP。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
