import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

// Haskell setup（HeartOfTheElders.hs，scenarioStep = One）：
// gather PillarsOfJudgement / HeartOfTheElders / Rainforest / Serpents / Expedition / Poison。
// 04215 落入陷阱、04216 有毒孢子 属于上下两部共用的 HeartOfTheElders 遭遇组，
// 其效果在本章 behavior.js 里本地实现（encounter-rules.js 尚未收录）。
const deckGroups = [
  'pillars_of_judgment', 'heart_of_the_elders', 'rainforest', 'serpents', 'expedition', 'poison',
]
const gathered = encounterCards(deckGroups)

// 04102「中毒」弱点不进入遭遇牌库：按 Haskell 的 setAside 处理，抽出 4 - 牌组中已有张数放在一边。
// 04209b「羽翼蛇族」由场景 1 推进带出（genEncounterCard），也不进遭遇牌库。
const DECK_EXCLUDED = ['04102', '04209b']
const deckCards = gathered.filter(card => !DECK_EXCLUDED.includes(card.code))
const definitions = encounterDefinitions([
  ...gathered,
  ...['04102'].map(code => ALL_CARDS[code]),
])

// 印刷卡面校正（card-data.js 的共享 ENEMY_RULES 只给了占位值）：
// 绝命噬藤只有 1 点胜利、没有复仇；蛇怪带 2 点复仇；羽翼蛇族不能被击败、不能发动借机攻击。
Object.assign(definitions.enemies['04219'], { vengeance: 0, victory: 1 })
Object.assign(definitions.enemies['04220'], { vengeance: 2 })
Object.assign(definitions.enemies['04209b'], {
  cannotBeDefeated: true, noOpportunityAttack: true, spawnAt: 'mouthOfKnyan',
  // 羽翼蛇族没有生命值（不能被击败），不要用 ?? 1 兜底成 1。
  health: null,
})

export const POISONED_WEAKNESS = '04102'
export const WINGED_SERPENT = '04209b'
export const BASILISK = '04220'
export const APEX_STRANGLEWEED = '04219'
export const PILLARS_TO_OPEN = 6
// 探索牌库（Haskell：timeWrackedWoods + square/moon/triangle/heart + riverCanyon + 一处遗迹 + 4 张诡计）。
export const EXPLORATION_LOCATIONS = [
  'timeWrackedWoods', 'pathOfThorns', 'riverCanyon', 'ropeBridge', 'serpentsHaven', 'circuitousTrail',
]
export const RUINS_CANDIDATES = ['overgrownRuins', 'templeOfTheFang', 'stoneAltar']
export const EXPLORATION_TREACHERIES = ['04215', '04221', '04081', '04082']
// 印刷的诡计数量固定：建探索牌库时从遭遇牌库总量里各取走 1 张，避免凭空多出 4 张。
const deckCodes = encounterDeck(deckCards)
for (const code of EXPLORATION_TREACHERIES) {
  const index = deckCodes.indexOf(code)
  if (index >= 0) deckCodes.splice(index, 1)
}

// 地点符号与相连符号来自 Location/CardDefs/TheForgottenAge/{HeartOfTheElders,Rainforest}.hs。
const locations = {
  mouthOfKnyan: location('mouthOfKnyan', '04206', {
    symbol: 'equals', links: ['squiggle', 't', 'hourglass'],
  }),
  timeWrackedWoods: location('timeWrackedWoods', '04217', {
    symbol: 'circle', links: ['square', 'diamond', 'moon'],
  }),
  stoneAltar: location('stoneAltar', '04218', {
    symbol: 'hourglass', links: ['triangle', 'heart', 'equals'],
  }),
  pathOfThorns: location('pathOfThorns', '04069', {
    symbol: 'square', links: ['circle', 'diamond', 'triangle', 'squiggle'],
  }),
  riverCanyon: location('riverCanyon', '04070', {
    symbol: 'diamond', links: ['circle', 'moon', 'heart', 'triangle', 'square'],
  }),
  ropeBridge: location('ropeBridge', '04071', {
    symbol: 'moon', links: ['circle', 'diamond', 'heart', 't'],
  }),
  serpentsHaven: location('serpentsHaven', '04072', {
    symbol: 'triangle', links: ['squiggle', 'square', 'diamond', 'hourglass'],
  }),
  circuitousTrail: location('circuitousTrail', '04073', {
    symbol: 'heart', links: ['hourglass', 'diamond', 'moon', 't'],
  }),
  templeOfTheFang: location('templeOfTheFang', '04074', {
    symbol: 'squiggle', links: ['square', 'triangle', 'equals'],
  }),
  overgrownRuins: location('overgrownRuins', '04075', {
    symbol: 't', links: ['moon', 'heart', 'equals'],
  }),
}
linkSymbolLocations(locations)

export const scenario = {
  id: 'heartOfTheEldersPart1',
  originalCode: '04205',
  name: '久远腹地（上）· 昆扬之口',
  intro: '你们在雨林中找到巨大的洞窟入口，六根石柱环绕在旁，凹槽中的微光像在等待被解开。'
    + '进入昆扬之前，先弄清这些石柱的图案。',
  setup: '收齐“审判之柱、久远腹地、雨林、蛇族、远征、毒素”遭遇组；把中毒弱点放在一边。'
    + '在昆扬之口开始，并按已记录的通路数（pathsAreKnownToYou）在昆扬之口放置等量石柱标记。'
    + '从错时林地、棘荆之路、河流峡谷、索桥、万蛇据点、曲折小道与一处随机遗迹地点组成探索牌库，'
    + '再洗入落入陷阱、蚁群缠身、迷失荒野与补给短缺各 1 张。',
  startLocation: 'mouthOfKnyan',
  locations,
  // 三处遗迹地点一开始都不在场上：随机一处洗入探索牌库，其余两张移出游戏。
  setAsideLocations: [...RUINS_CANDIDATES],
  acts: stages(['04209', '04210'], 'act').map((act, index) => ({
    ...act,
    reveal: { type: 'campaignRule' },
    // 场景 1a：在任意地点共同支付每位调查员 2 个线索。
    ...(index === 0 ? { objective: { type: 'clues', perInvestigator: 2 } } : {}),
  })),
  // 密谋 1/2 都是「5 点毁灭」的固定阈值，背面由 behavior.agendaReveal 结算。
  agendas: stages(['04207', '04208'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  // 04207/04208 印着 [action]：探索；04210 的解石柱行动带显式 scriptCard。
  scriptCards: { explore: { card: 'agenda' } },
  ...definitions,
  encounterDeck: deckCodes,
  resolutions: {
    noResolution: '你们没能解开六根石柱的谜题就撤回了营地。记录已知的通路数量（pathsAreKnownToYou）；'
      + '本次冒险没有结局，队伍必须重新来过（重玩：Haskell 的 RestartScenario）。',
    r1: '六根石柱全部就位，洞窟深处传来石头摩擦的声音。进入昆扬的道路已经打开。'
      + '把胜利区中带复仇点数的卡牌记入“丛林窥视”（theJungleWatches），并获得胜利点经验。',
    r2: '你们没有解开六根石柱的谜题，但不愿在这片敌意重重的丛林中继续耽搁。'
      + '补上缺失的石柱标记并记录伊格之怒，然后照样进入洞窟（原卡：进入昆扬，即结局 1）。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
