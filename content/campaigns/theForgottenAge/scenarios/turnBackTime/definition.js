import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

// Haskell setup（Scenario/Scenarios/TheForgottenAge/TurnBackTime.hs）：
// gather 埃兹特里的覆灭 / 伊格的使徒 / 伊格的毒液 / 时间裂缝 / 致命陷阱 /
// 被遗忘的遗迹 / 毒素 / 地窖寒风；把时间石室、古代遗物、瓦卢西亚的预示者、
// 伊格与 4 张「中毒」放在一边；探索牌库 = 2 处大厅/石室地点 + 3 处遗迹地点
// + 5 张诡计（与《埃兹特里的覆灭》同一套 10 张）。
const deckGroups = ['eztli', 'agents_of_yig', 'venom', 'flux', 'traps', 'ruins', 'poison', 'chilling_cold']
// 瓦卢西亚的预示者（04062）与 4 张中毒弱点（04102）不进入遭遇牌库。
const gathered = encounterCards(deckGroups)
  .filter(card => !['04062', '04102'].includes(card.code))
// 放在一边的敌人：预示者与伊格（04296 不在本章遭遇组里，按卡面「查找收藏」入场）。
const setAsideCards = ['04062', '04296'].map(code => ALL_CARDS[code])
const definitions = encounterDefinitions([...gathered, ...setAsideCards])
// 卡面的 per-investigator 生命：预示者 10/人，伊格 6 + 6/人。
Object.assign(definitions.enemies['04062'], { healthPerInvestigator: 10, vengeance: 5 })
Object.assign(definitions.enemies['04296'], { healthPerPlayerBonus: 6 })

// 七处地点沿用《埃兹特里的覆灭》原卡（04060 04063 04064 04065 04066 04067 04068），
// 只把规则 id 换成以遗迹为主题的英文名。
const locations = {
  entryway: location('entryway', '04060', {
    symbol: 'circle', links: ['square', 'star'],
  }),
  ancientHall: location('ancientHall', '04063', {
    symbol: 'square', links: ['circle', 'star', 'diamond'],
  }),
  grandChamber: location('grandChamber', '04064', {
    symbol: 'star', links: ['circle', 'square', 'triangle'],
  }),
  burialPit: location('burialPit', '04065', {
    symbol: 'triangle', links: ['star', 'diamond', 'squiggle'],
  }),
  undergroundRuins: location('undergroundRuins', '04066', {
    symbol: 'diamond', links: ['square', 'triangle', 'squiggle'], vengeance: 1,
  }),
  secretPassage: location('secretPassage', '04067', {
    symbol: 'squiggle', links: ['diamond', 'triangle', 'hourglass'],
  }),
  chamberOfTime: location('chamberOfTime', '04068', {
    symbol: 'hourglass', links: ['squiggle'], vengeance: 2,
  }),
}
linkSymbolLocations(locations)

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
export const RUINS_LOCATIONS = [
  'ancientHall', 'grandChamber', 'burialPit', 'undergroundRuins', 'secretPassage',
]
// 参考实现 TurnBackTime.hs 的 setAside 是 Assets.relicOfAgesRepossessThePast（04303，
// 「重拾往昔」版本）；本关的古代遗物行动/封印结局都基于这一版本。
export const RELIC_OF_AGES = '04303'
export const HARBINGER_OF_VALUSIA = '04062'
export const YIG = '04296'
export const CHAMBER_OF_TIME = 'chamberOfTime'

// 探索牌库会占用每个诡计组一张实物；从遭遇牌库扣除一张，避免超印。
const explorationCodes = [...EXPLORATION_LOCATIONS.map(id => locations[id].originalCode),
  ...Object.values(EXPLORATION_TREACHERIES)]
const deckCodes = encounterDeck(gathered)
for (const code of explorationCodes) {
  const index = deckCodes.indexOf(code)
  if (index >= 0) deckCodes.splice(index, 1)
}

export const scenario = {
  id: 'turnBackTime',
  originalCode: '04344',
  name: '失落的时代 · 时间倒流',
  intro: '你把时间拧回埃兹特里神庙尚未坍塌的那一刻。遗迹仍在沉睡，而真正需要被改写的，是你们即将在中央石室里做出的选择。',
  setup: '收齐“埃兹特里的覆灭、伊格的使徒、伊格的毒液、时间裂缝、致命陷阱、被遗忘的遗迹、毒素、地窖寒风”遭遇组；把时间石室、古代遗物、瓦卢西亚的预示者、伊格与 4 张“中毒”放在一边。建立探索牌库（2 处大厅石室 + 3 处遗迹 + 5 张诡计），从遗迹入口开始；混乱袋额外加入 1 个旧神标记。',
  startLocation: 'entryway',
  locations,
  setAsideLocations: [CHAMBER_OF_TIME],
  acts: stages(['04345', '04346', '04347'], 'act').map((act, index) => ({
    ...act,
    reveal: { type: 'campaignRule' },
    ...(index === 0 ? { objective: { type: 'clues', perInvestigator: 3 } } : {}),
    ...(index === 1 ? {
      objective: { type: 'clues', perInvestigator: 2, atLocation: CHAMBER_OF_TIME },
    } : {}),
    ...(index === 2 ? { objective: { type: 'defeatEnemy', enemy: YIG } } : {}),
  })),
  agendas: stages(['04055', '04056'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  // 04345/04346 印着 [action]：探索；04347 的古代遗物行动也由当前幕赋予。
  scriptCards: {
    explore: { card: 'act', codes: ['04345', '04346'] },
    rules: { relicOfAgesStrike: { card: 'act', codes: ['04347'] } },
  },
  ...definitions,
  storyAssets: storyCards([RELIC_OF_AGES]),
  encounterDeck: deckCodes,
  resolutions: {
    noResolution: '时间线冲突最终吞没了你们。记录“时间之布已被拆解”，每位未撤退的调查员陷入疯狂。',
    r1: '伊格倒下，遗迹安静下来。你们把古代遗物永远封印起来——记录“调查员们永远封印了古代遗物”。获得胜利点经验。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
