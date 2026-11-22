// 吞噬万物 · ELSE! 变体（The Blob That Ate Everything Else · 89005+）· 章节数据。
//
// 参考（权威）：
//   frontend/src/locales/en/standalone/theBlobThatAteEverything.json 的 setup.gatherElseSets
//   Location/CardDefs/TheBlobThatAteEverythingELSE.hs（89006 主街 / 89007 旧墓山 / 89008 废弃风车 / 89009 屠宰场）
//   Story/CardDefs/TheBlobThatAteEverythingELSE.hs（89005 现实酸液图表）
//   Story/Cards/TheBlobThatAteEverything/{EscortTheCar,ReclaimTheBrain,PreventTheirResearch}.hs
//   Enemy/CardDefs/TheBlobThatAteEverything.hs（89010a–i 复制异变体、89013 驱逐者、89015 科学家、89018 研究者）
//
// 变体口径：
//   · 复用普通流程的全部数据（幕/议程/地点/遭遇牌库/混乱袋/结局/Part 1 剧情 85021–85024）；
//   · 隔离区池扩到 14 张（普通 10 张 + 4 张 ELSE 地点），随机移除 5 张，仍布置 9 张隔离区；
//   · 遭遇组改为 theBlobThatAteEverythingElse（必需卡包 core + blobCampaign + blbeCampaign）；
//   · 89005 现实酸液图表与 89011/89014/89017 三张 Part 1 剧情、Mi-Go Incursion II 全部卡放一边；
//   · 复制异变体由 behavior.enemyDefeated 的「复制」检查生成（花 1 反制措施可阻止，近似口径）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import * as base from '../theBlobThatAteEverything/definition.js'

export const CHAPTER_ID = 'theBlobThatAteEverythingElse'
export const REFERENCE_CODE = '85001'
export const ENCOUNTER_CODE = 'theBlobThatAteEverythingElse'
export const ELSE_GROUP = 'theBlobThatAteEverythingElse'

export const ELSE_LOCATION_TABLE = Object.freeze([
  Object.freeze(['mainStreet', '89006', 'east']),
  Object.freeze(['oldBurialHill', '89007', 'west']),
  Object.freeze(['abandonedWindmill', '89008', 'southOuter']),
  Object.freeze(['abbatoir', '89009', 'eastOuter']),
])
export const ELSE_QUARANTINE_IDS = Object.freeze(ELSE_LOCATION_TABLE.map(([id]) => id))

// 规范布局（ELSE!）：内环 东=主街 / 西=旧墓山；外环 南=废弃风车 / 东=屠宰场 / 西=下水道；
// 角落 桥 / 水塔 / 教堂 / 黏糊湖床；其余 5 张隔离区视为被移除位。
const ELSE_SLOTS = Object.freeze({
  theCrater: 'center', researchSite: 'north', temporaryHQ: 'south', fungusMound: 'northOuter',
  mainStreet: 'east', oldBurialHill: 'west',
  abandonedWindmill: 'southOuter', abbatoir: 'eastOuter', sewer: 'westOuter',
  bridge: 'northEast', waterTower: 'northWest', church: 'southEast', oozyLakebed1: 'southWest',
  oozyLakebed2: 'removed1', slimyStreets1: 'removed2', slimyStreets2: 'removed3',
  desiccatedFarmland1: 'removed4', desiccatedFarmland2: 'removed5',
})
const ELSE_REMOVED = Object.freeze({
  removed1: { x: 4, y: 4 }, removed2: { x: 4, y: 5 }, removed3: { x: 4, y: 6 },
  removed4: { x: 5, y: 4 }, removed5: { x: 5, y: 5 },
})
const ELSE_ORTHOGONAL = Object.freeze({
  center: ['north', 'south', 'east', 'west'],
  north: ['center', 'northOuter', 'northEast', 'northWest'],
  south: ['center', 'southOuter', 'southEast', 'southWest'],
  east: ['center', 'eastOuter', 'northEast', 'southEast'],
  west: ['center', 'westOuter', 'northWest', 'southWest'],
  northOuter: ['north'], southOuter: ['south'], eastOuter: ['east'], westOuter: ['west'],
  northEast: ['north', 'east'], northWest: ['north', 'west'],
  southEast: ['south', 'east'], southWest: ['south', 'west'],
})

export const ELSE_LOCATION_TABLE_ALL = Object.freeze([...base.FIXED_LOCATION_TABLE, ...base.QUARANTINE_TABLE, ...ELSE_LOCATION_TABLE])

export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries(ELSE_LOCATION_TABLE_ALL.map(([id]) => {
  const slot = ELSE_SLOTS[id]
  return [id, base.GRID_SLOTS[slot] || ELSE_REMOVED[slot] || { x: 4, y: 4 }]
})))

export const STATIC_CONNECTIONS = Object.freeze((() => {
  const idAtSlot = new Map(Object.entries(ELSE_SLOTS).map(([id, slot]) => [slot, id]))
  const connections = {}
  for (const [id] of ELSE_LOCATION_TABLE_ALL) {
    const slot = ELSE_SLOTS[id]
    connections[id] = (ELSE_ORTHOGONAL[slot] || []).map(otherSlot => idAtSlot.get(otherSlot)).filter(Boolean)
  }
  return connections
})())

export const LOCATIONS = Object.freeze(Object.fromEntries(ELSE_LOCATION_TABLE_ALL.map(([id, code]) => {
  const card = ALL_CARDS[code]
  return [id, {
    ...base.printed(code), id, shroud: card.shroud,
    connections: [...(STATIC_CONNECTIONS[id] || [])],
    ...(id === 'theCrater' || id === 'researchSite' || id === 'temporaryHQ' || id === 'fungusMound'
      ? { cluesFixed: card.clues ?? 0 }
      : { cluesPerInvestigator: card.clues ?? 0 }),
    unrevealedName: card.backNameZh || card.backName || card.nameZh || card.name,
    unrevealedNameEn: card.backName || card.name,
    oozified: (card.traits || []).includes('Oozified'),
  }]
})))

// ELSE! 放一边：89005 现实酸液 + Mi-Go Incursion II（89011–89021，含 2 张研究者）+ 9 张复制异变体。
export const ELSE_SET_ASIDE_CODES = Object.freeze([
  '89005',
  '89010a', '89010b', '89010c', '89010d', '89010e', '89010f', '89010g', '89010h', '89010i',
  '89011', '89012', '89013', '89014', '89015', '89016', '89017', '89018', '89018',
  '89019', '89020', '89021',
])
export const SET_ASIDE_ALIASES = Object.freeze([...base.SET_ASIDE_ALIASES, ...ELSE_SET_ASIDE_CODES])

const elseEnemyCodes = ['89010a', '89010b', '89010c', '89010d', '89010e', '89010f', '89010g',
  '89010h', '89010i', '89013', '89015', '89018']
const elseStoryCodes = ['89005', '89011', '89014', '89017']
const elseStoryAssets = ['89012', '89016', '89019', '89020', '89021']

const baseDefinitions = {
  enemies: { ...base.scenario.enemies },
  treacheries: { ...base.scenario.treacheries },
  storyAssets: { ...base.scenario.storyAssets },
}
for (const code of elseEnemyCodes) {
  const card = ALL_CARDS[code]
  baseDefinitions.enemies[code] = {
    ...base.printed(code),
    fight: card.fight ?? null, evade: card.evade ?? null,
    health: card.health ?? null, healthPerInvestigator: card.healthPerInvestigator === true,
    damage: card.damage || 0, horror: card.horror || 0,
    ...(card.victory != null ? { victory: card.victory } : {}),
    ...Object.fromEntries(['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert', 'Surge']
      .filter(key => new RegExp(`\\b${key}\\.`).test(card.text || ''))
      .map(key => [key.toLowerCase(), true])),
    elite: (card.traits || []).includes('Elite'),
    manifold: (card.traits || []).includes('Manifold'),
    blobX: card.code.startsWith('89010') ? 3 : null,
  }
}
for (const code of [...elseStoryCodes, ...elseStoryAssets]) {
  const card = ALL_CARDS[code]
  baseDefinitions.storyAssets[code] = { ...base.printed(code), global: true,
    ...(card.health != null ? { health: card.health } : {}) }
}

export const scenario = {
  ...base.scenario,
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '吞噬万物 · ELSE! 变体',
  nameEn: 'The Blob That Ate Everything Else',
  encounterCode: ENCOUNTER_CODE,
  elseMode: true,
  elseQuarantineIds: [...ELSE_QUARANTINE_IDS],
  locations: { ...LOCATIONS },
  ...baseDefinitions,
  setAsideAliases: [...SET_ASIDE_ALIASES],
  intro: base.SCENARIO_TEXT.intro,
  setup: [...base.SCENARIO_TEXT.setupSteps.map(step => step.text),
    'ELSE! 变体：额外混入 4 张 ELSE 隔离区地点（主街/旧墓山/废弃风车/屠宰场），从 14 张隔离区中随机移除 5 张；'
    + '把《米·戈入侵 II》全部卡牌与现实酸液图表 89005 放到一边。'].join('\n\n'),
  specialRules: Object.freeze([
    ...base.SCENARIO_TEXT.specialRules.map(rule => rule.title + '：' + rule.text),
    '现实酸液（ELSE!）：个体代号8L-08 每吞噬一种「现实」都会产生持续影响；照 89005 图表结算（本实现按行为层近似）。',
    '复制异变体：当[[异质]]敌人被击败时，队长可以花费 1 个反制措施阻止复制；否则生成一张横置的复制异变体（89010a–i）。',
  ]),
}

export const identities = base.identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze({
  ...base.CARD_DATA,
  ...Object.fromEntries([...elseEnemyCodes, ...elseStoryCodes, ...elseStoryAssets].map(code => [code, ALL_CARDS[code]])),
})

export const ENCOUNTER_DECK = base.ENCOUNTER_DECK
export const ENCOUNTER_GROUPS = Object.freeze([ELSE_GROUP])
export const ENCOUNTER_DECK_CODES = base.ENCOUNTER_DECK_CODES
export const ACT_CODES = base.ACT_CODES
export const AGENDA_CODES = base.AGENDA_CODES
export const ACTS = base.ACTS
export const AGENDAS = base.AGENDAS
export const ACT_STAGES = base.ACT_STAGES
export const AGENDA_STAGES = base.AGENDA_STAGES
export const STAGE_CARDS = base.STAGE_CARDS
export const RESOLUTION_KEYS = base.RESOLUTION_KEYS
export const START_LOCATION = base.START_LOCATION
export const SUBJECT_CODE = base.SUBJECT_CODE
export const VULNERABLE_HEART_CODE = base.VULNERABLE_HEART_CODE
export const STORY_CODES = base.STORY_CODES
export const STORY_RULES = base.STORY_RULES
export const SCENARIO_TEXT = base.SCENARIO_TEXT
export const LOCATION_TABLE = ELSE_LOCATION_TABLE_ALL
export const QUARANTINE_TABLE = Object.freeze([...base.QUARANTINE_TABLE, ...ELSE_LOCATION_TABLE])
export const FIXED_LOCATION_TABLE = base.FIXED_LOCATION_TABLE
export const GRID_SLOTS = base.GRID_SLOTS
export const REMOVED_SLOTS = ELSE_REMOVED
export const BLOB_X = base.BLOB_X
export const REWARD_ASSET_CODES = base.REWARD_ASSET_CODES

export default scenario
