import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

// 权威来源：Arkham/Scenario/Scenarios/TheForgottenAge/TheBoundaryBeyond.hs 的 setup
// 与 Arkham/Location/CardDefs/TheForgottenAge/TheBoundaryBeyond.hs。
//
// 地图模型（本文件最关键的决定）：印刷的 18 张地点按「现代墨西哥城 6 张 + 古代
// 特诺奇蒂特兰 12 张」登记，每张印刷卡各有一个稳定 id（一个 code 一个 id）。
// 现场只放 6 个「格位」，格位 id 就是对应现代地点的 id；古代地点不是独立格位，
// 它通过 behavior 的 shiftSlot/unshiftSlot 覆盖在格位上（卡号、名字、帷幕、线索值、
// 符号全部换成古代面），所以调查员/敌人/标记不需要移动，也不用改 id。详见
// behavior.js 的说明。12 张古代地点组成探索牌库（每张印刷卡一张）。
export const PRESENT_LOCATIONS = Object.freeze({
  templeRuins: { code: '04168', symbol: 'circle', links: ['diamond', 'star'] },
  metropolitanCathedral: { code: '04169', symbol: 'square', links: ['diamond'] },
  chapultepecPark: { code: '04170', symbol: 'triangle', links: ['star'] },
  zocalo: { code: '04171', symbol: 'diamond', links: ['heart', 'square', 'star', 'circle'] },
  xochimilco: { code: '04172', symbol: 'heart', links: ['diamond', 'star'] },
  coyoacan: { code: '04173', symbol: 'star', links: ['diamond', 'triangle', 'circle', 'heart'] },
})

export const ANCIENT_LOCATIONS = Object.freeze({
  temploMayor174: { code: '04174', symbol: 'circle', links: ['square', 'triangle'] },
  temploMayor175: { code: '04175', symbol: 'circle', links: ['square', 'triangle'] },
  templesOfTenochtitlan176: { code: '04176', symbol: 'square', links: ['diamond', 'circle'] },
  templesOfTenochtitlan177: { code: '04177', symbol: 'square', links: ['diamond', 'circle'] },
  chapultepecHill178: { code: '04178', symbol: 'triangle', links: ['star', 'circle'] },
  chapultepecHill179: { code: '04179', symbol: 'triangle', links: ['star', 'circle'] },
  canalsOfTenochtitlan180: { code: '04180', symbol: 'diamond', links: ['heart', 'square'] },
  canalsOfTenochtitlan181: { code: '04181', symbol: 'diamond', links: ['heart', 'square'] },
  lakeXochimilco182: { code: '04182', symbol: 'heart', links: ['diamond', 'star'] },
  lakeXochimilco183: { code: '04183', symbol: 'heart', links: ['diamond', 'star'] },
  sacredWoods184: { code: '04184', symbol: 'star', links: ['heart', 'triangle'] },
  sacredWoods185: { code: '04185', symbol: 'star', links: ['heart', 'triangle'] },
})

// 探索牌库：12 张古代地点 + 各 1 张下列遭遇卡（Haskell 的 treacheries 列表）。
export const EXPLORATION_TREACHERIES = Object.freeze(['04189', '04190', '04090', '04091'])
export const EXPLORATION_LOCATIONS = Object.freeze(Object.keys(ANCIENT_LOCATIONS))

// 固定的古代地点（帕德玛在 2b/2b 背面总是生成在大神庙）。
export const TEMPLO_MAYOR_IDS = Object.freeze(['temploMayor174', 'temploMayor175'])

// 遭遇组：The Boundary Beyond / Temporal Flux / Poison 必收；Pnakotic Brotherhood 与
// Guardians of Time / Yig's Venom 按混乱袋里的 cultist / tablet 标记数条件收录。
// 目录里没有核心包的 Dark Cult 组（Night of the Zealot 未收录），这一支以「只收
// Pnakotic Brotherhood」实现，并在交付说明的 gap 列表里注明。
export const BASE_GROUPS = Object.freeze(['the_boundary_beyond', 'flux', 'poison'])
export const BROTHERHOOD_GROUPS = Object.freeze(['pnakotic_brotherhood'])
export const TIME_GROUPS = Object.freeze(['venom', 'guardians_of_time'])
export const FALLBACK_GROUPS = Object.freeze(['pnakotic_brotherhood', 'guardians_of_time'])

// 探索牌库先借走 1 张的诡计：遭遇牌库只剩印刷数量的其余份数。
const EXPLORATION_COPIES = Object.freeze({ '04189': 1, '04190': 1, '04090': 1, '04091': 1 })
const SET_ASIDE_ONLY = Object.freeze(['04102', '04186'])

export function deckCodes(cards, moved = {}) {
  return cards.flatMap(card => Array(Math.max(0, (card.quantity || 1) - (moved[card.code] || 0))).fill(card.code))
}

export const PLAYER_SET_ASIDE = Object.freeze(['04186', '04167', '04164'])
export const POISON_CODE = '04102'

const gathered = encounterCards([...BASE_GROUPS, ...BROTHERHOOD_GROUPS, ...TIME_GROUPS])
  .filter(card => !SET_ASIDE_ONLY.includes(card.code))
const definitions = encounterDefinitions([...gathered, ALL_CARDS['04186'], ALL_CARDS['04102']])
// 帕德玛·阿姆丽塔：每位调查员 3 点生命、2 点胜利点、2 点复仇点。
Object.assign(definitions.enemies['04186'], { healthPerInvestigator: 3, vengeance: 2, victory: 2 })
// 兄弟会之手：生成在任意无人地点。
Object.assign(definitions.enemies['04188'], { spawnAnyEmpty: true })

const baseDeckCards = encounterCards(BASE_GROUPS).filter(card => !SET_ASIDE_ONLY.includes(card.code))
export const ENCOUNTER_DECK = Object.freeze(deckCodes(baseDeckCards, EXPLORATION_COPIES))
export const CONDITIONAL_DECKS = Object.freeze({
  brotherhood: deckCodes(encounterCards(BROTHERHOOD_GROUPS)),
  time: deckCodes(encounterCards(TIME_GROUPS)),
  fallback: deckCodes(encounterCards(FALLBACK_GROUPS)),
})

const present = Object.fromEntries(Object.entries(PRESENT_LOCATIONS).map(([id, spec]) => [
  id, location(id, spec.code, { symbol: spec.symbol, links: spec.links }),
]))
const ancient = Object.fromEntries(Object.entries(ANCIENT_LOCATIONS).map(([id, spec]) => [
  id, location(id, spec.code, { symbol: spec.symbol, links: spec.links }),
]))
// 现代 / 古代是两套独立的符号地图：混合连线会让「现代符号 ↔ 古代同名符号」互相
// 牵引。运行时的连线由 behavior 按「在场地点」的符号重算（card-data 的
// symbolConnections），因此这里只要保证两套各自的邻接正确。
linkSymbolLocations(present)
linkSymbolLocations(ancient)
const locations = { ...present, ...ancient }

export const scenario = {
  id: 'theBoundaryBeyond',
  originalCode: '04161',
  name: '失落的时代 · 界限彼端',
  intro: '墨西哥城的街景在银色的闪电里被撕开一道口子。你踏进那道裂缝，另一侧是同一条街——只不过是在五百年前。',
  setup: '收齐“界限彼端、时间流、毒素”遭遇组；混乱袋里有 2 个以上异教徒标记时加收兄弟会，有 2 个以上石板标记时加收伊格之毒与时间守卫者（都不满足时收兄弟会与时间守卫者）。放置 6 处现代墨西哥城地点，调查员从索卡洛广场或科约阿坎区开始。用 12 张古代特诺奇蒂特兰地点加 4 张诡计建立探索牌库。帕德玛·阿姆丽塔、场景 3a、密谋 3a 与未入牌库的中毒弱点放在一边。',
  startLocation: 'zocalo',
  locations,
  locationsStartRevealed: true,
  acts: stages(['04165', '04166', '04167'], 'act').map((act, index) => ({
    ...act,
    reveal: { type: 'campaignRule' },
    // 场景 3a：在大神庙的调查员共同支付「每位调查员 2 个」线索即可推进（Haskell
    // 的 GroupClueCost (PerPlayer 2)）。格位 id 沿用现代的神庙遗迹，古代地点覆盖
    // 之后 id 不变，所以这里指向 templeRuins。
    ...(index === 2 ? {
      objective: { type: 'clues', perInvestigator: 2, atLocation: 'templeRuins' },
    } : {}),
  })),
  agendas: stages(['04162', '04163', '04164'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  ...definitions,
  storyAssets: storyCards(['04191']),
  encounterDeck: ENCOUNTER_DECK,
  setAsideLocations: [],
  resolutions: {
    noResolution: '你们在旅馆的床上醒来，伊塔卡瘫倒在门边。记录“已知X条道路”（X = 胜利区内特诺奇蒂特兰地点的数量，若游戏结束时处于场景2，则先把场上没有线索的特诺奇蒂特兰地点加入胜利区）。获得胜利点经验，且每个特诺奇蒂特兰地点额外 1 点。',
    r1: '你们跌回中央广场，伊塔卡确认那道红色洞窟就是通往联结点之路。记录“已知X条道路”；X 不少于 3 时同时记录“伊塔卡对你有信心”。获得胜利点经验，且每个特诺奇蒂特兰地点额外 1 点。',
    r2: '你们被困在不属于你们的时间里。边界在眼前合拢，回家的路断了。记录“已知X条道路”，获得胜利点经验，且每个特诺奇蒂特兰地点额外 1 点。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
