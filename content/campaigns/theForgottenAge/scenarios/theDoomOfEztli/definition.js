import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

// Haskell setup（Scenario/Scenarios/TheForgottenAge/TheDoomOfEztli.hs）：
// 收齐「埃兹特里的覆灭”“伊格的使徒”“伊格的毒液”“时间洪流”“致命陷阱”
// “被遗忘的遗迹”“毒素”“地窖寒风”；把时间石室、古代遗物、瓦卢西亚的预示者
// 与 4 张「中毒」放在一边，再从遗迹入口开始。
export const RELIC_OF_AGES = '04061'
export const HARBINGER = '04062'
export const CHAMBER_OF_TIME = '04068'
export const ENTRYWAY = '04060'
export const ANCIENT_HALL = '04063'
export const GRAND_CHAMBER = '04064'
export const BURIAL_PIT = '04065'
export const UNDERGROUND_RUINS = '04066'
export const SECRET_PASSAGE = '04067'

const deckGroups = [
  'theDoomOfEztli', 'agentsOfYig', 'venom', 'flux', 'traps', 'ruins', 'poison', 'chillingCold',
]
// 预示者与 4 张「中毒」放在一边，因此不能再声明进遭遇牌库（区域不得重复入牌）。
const setAsideCodes = [RELIC_OF_AGES, HARBINGER, '04102', '04102', '04102', '04102']
const setAside = new Set(setAsideCodes)
const gathered = encounterCards(deckGroups).filter(card => !setAside.has(card.code))
const definitions = encounterDefinitions([
  ...gathered,
  ...[...setAside].map(code => ALL_CARDS[code]),
])

// 卡面：瓦卢西亚的预示者生命值为 10[per_investigator]（Haskell cdHealth =
// healthPerInvestigator 10）。共享遭遇表把 04062 写成了 1，这里按印刷卡面覆盖。
Object.assign(definitions.enemies[HARBINGER], { healthPerInvestigator: 10 })

const locations = {
  entryway: location('entryway', ENTRYWAY, {
    symbol: 'circle', links: ['square', 'star'],
  }),
  ancientHall: location('ancientHall', ANCIENT_HALL, {
    symbol: 'square', links: ['circle', 'star', 'diamond'],
  }),
  grandChamber: location('grandChamber', GRAND_CHAMBER, {
    symbol: 'star', links: ['circle', 'square', 'triangle'],
  }),
  burialPit: location('burialPit', BURIAL_PIT, {
    symbol: 'triangle', links: ['star', 'diamond', 'squiggle'],
  }),
  // 印刷卡面：复仇 1（没有胜利点）；有敌人时视作在胜利区，见 behavior。
  undergroundRuins: location('undergroundRuins', UNDERGROUND_RUINS, {
    symbol: 'diamond', links: ['square', 'triangle', 'squiggle'], vengeance: 1,
  }),
  secretPassage: location('secretPassage', SECRET_PASSAGE, {
    symbol: 'squiggle', links: ['diamond', 'triangle', 'hourglass'],
  }),
  // 印刷卡面：胜利 2、复仇 2（Haskell `victory 2 $ vengeance 2`）。
  chamberOfTime: location('chamberOfTime', CHAMBER_OF_TIME, {
    symbol: 'hourglass', links: ['squiggle'], victory: 2, vengeance: 2,
  }),
}
linkSymbolLocations(locations)

// 探索牌库：5 处遗迹地点 + 5 张遭遇组诡计（Haskell setup 里的 explorationDeck）。
export const EXPLORATION_LOCATIONS = [
  'ancientHall', 'grandChamber', 'burialPit', 'undergroundRuins', 'secretPassage',
]
export const EXPLORATION_TREACHERIES = {
  illOmen: '04092',
  deepDark: '04094',
  finalMistake: '04088',
  entombed: '04089',
  cryptChill: '01167',
}
export const POISONED = '04102'

export const scenario = {
  id: 'theDoomOfEztli',
  originalCode: '04054',
  name: '失落的时代 · 埃兹特里的覆灭',
  intro: '遗迹入口在你们身后合拢。石壁上的雕文在黑暗中发亮，空气里有一种类似蛇蜕的腥味——这座神庙醒着，而且它已经等了很久。',
  setup: '收齐“埃兹特里的覆灭”“伊格的使徒”“伊格的毒液”“时间洪流”“致命陷阱”“被遗忘的遗迹”“毒素”“地窖寒风”遭遇组；把时间石室、古代遗物、瓦卢西亚的预示者与 4 张“中毒”放在一边。用 5 处遗迹地点与 5 张诡计建立探索牌库，从遗迹入口开始。',
  startLocation: 'entryway',
  locations,
  setAsideLocations: ['chamberOfTime'],
  acts: stages(['04057', '04058', '04059'], 'act').map((act, index) => ({
    ...act,
    reveal: { type: 'campaignRule' },
    // 进入遗迹：任意地点共同支付 3×人数线索；科学与魔法：仅限时间石室，2×人数。
    ...(index === 0 ? { objective: { type: 'clues', perInvestigator: 3 } } : {}),
    ...(index === 1 ? { objective: { type: 'clues', perInvestigator: 2, atLocation: 'chamberOfTime' } } : {}),
  })),
  agendas: stages(['04055', '04056'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  storyAssets: storyCards([RELIC_OF_AGES]),
  encounterDeck: encounterDeck(gathered),
  resolutions: {
    noResolution: '时间耗尽：神庙深处的低鸣变成了咆哮，你们只能选择退回时间石室，或亲手摧毁这座遗迹（→ 结局 3）。',
    r1: '你们带着古代遗物逃出了神庙。记录“调查员们夺回了古代遗物”，把古代遗物加入一位调查员的牌组。获得胜利点经验。',
    r2: '亚历山卓抢在你们之前夺走了古代遗物。记录“亚历山卓夺回了古代遗物”。获得胜利点经验。',
    r3: '遗迹在你们脚下重新拼合，一切归于沉寂。选择回到遗迹深处（→ 结局 4），或彻底摧毁此处（→ 结局 5）。',
    r4: '你们再次走进了遗迹——神庙又一次把你们当成了新的祭品。重演本场冒险。',
    r5: '你们炸毁了时间石室，遗迹轰然崩塌。记录“调查员们夺回了古代遗物”，把古代遗物加入一位调查员的牌组，并记录“遗迹被摧毁”的复仇 10 点。获得胜利点经验。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
