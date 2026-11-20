// 沉睡者墓穴（Sepulchre of the Sleeper · 提示卡 11673）· 章节数据（scenario 只含数据）。
//
// 参考（权威）：
//   Scenario/Scenarios/TheDrownedCity/SepulchreOfTheSleeper.hs +
//   Scenarios/TheDrownedCity/SepulchreOfTheSleeper/Helpers.hs +
//   Agenda|Location|Enemy/CardDefs|Cards/TheDrownedCity/SepulchreOfTheSleeper* +
//   Campaigns/TheDrownedCity.hs 的 DoStep 1–3（入场/跳过分支）+
//   frontend/src/locales/en/theDrownedCity/sepulchreOfTheSleeper.json。
//
// 卡号归属（chapter-inventory sepulchreOfTheSleeper）：11674–11681 共 9 条记录；
// 11673 是本关提示卡（scenario 自身，不建单卡条目），本章专属组 sepulchre_of_the_sleeper。
//
// 入场/跳过分支（Campaigns/TheDrownedCity.hs DoStep 1–3，由战役流程图处理，本节只提供判定）：
//   · DoStep 1：Artifacts Earned ≥ 1 且已翻译字形 ≥ 10 → 读 2，否则跳到 Interlude III；
//   · DoStep 2：5 件神器全勾选 + 26 个字形全翻译 + 内殿已解封 → 读 3，否则加一个 0 标记并跳 Interlude III；
//   · DoStep 3：调查员决定「知道得更清楚」或「让它安息」；前者记 theInvestigatorsDidNotConfrontTheNightmare
//     并跳 Interlude III，后者才真正开始本关 Setup。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor } from '../../card-data.js'
import { CTHULHU_TOKEN_MEANINGS, disturbance } from './chaos.js'

export const CHAPTER_ID = 'sepulchreOfTheSleeper'
export const REFERENCE_CODE = '11673'
export const ENCOUNTER_CODE = 'sepulchre_of_the_sleeper'

// ---------------------------------------------------------------------------
// 议程 / 敌人 / 地点
// ---------------------------------------------------------------------------
export const BENEATH_THE_CITY_CODE = '11674'
export const CTHULHU_AWAKENED_CODE = '11675'
export const CTHULHU_CODE = '11674b'
export const AGENDA_CODES = Object.freeze([BENEATH_THE_CITY_CODE, CTHULHU_AWAKENED_CODE])
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1'])

// 5 件「Artifacts Earned」神器（Haskell rlyehArtifacts；horrorInClay 在 CONTRACT 键表但不在本关门槛）。
export const ARTIFACT_RECORDS = Object.freeze([
  Object.freeze({ record: 'barrierNode', code: '11552', name: 'Barrier Node' }),
  Object.freeze({ record: 'obsidianClaw', code: '11672a', name: 'Obsidian Claw' }),
  Object.freeze({ record: 'shardOfYchlecht', code: '11638', name: "Shard of Y'ch'lecht" }),
  Object.freeze({ record: 'tidalTablet', code: '11611', name: 'Tidal Tablet' }),
  Object.freeze({ record: 'grislyMask', code: '11582', name: 'Grisly "Mask"' }),
])
export const ARTIFACT_RECORD_KEYS = Object.freeze(ARTIFACT_RECORDS.map(item => item.record))
export const ARTIFACT_CODE_BY_RECORD = Object.freeze(Object.fromEntries(ARTIFACT_RECORDS.map(item => [item.record, item.code])))
export const GLYPH_TOTAL = 26

// 刻印壁龛（每张对应一件神器的故事；[action] 检定 → 在对应神器上放 1 毁灭）。
export const ALCove_TABLE = Object.freeze([
  Object.freeze(['sigilCarvedAlcoveAmbition', '11677', Object.freeze({ artifactRecord: 'obsidianClaw', skill: 'willpower' })]),
  Object.freeze(['sigilCarvedAlcoveResilience', '11678', Object.freeze({ artifactRecord: 'barrierNode', skill: 'combat' })]),
  Object.freeze(['sigilCarvedAlcoveInfinity', '11679', Object.freeze({ artifactRecord: 'tidalTablet', skill: 'intellect' })]),
  Object.freeze(['sigilCarvedAlcoveDefiance', '11680', Object.freeze({ artifactRecord: 'grislyMask', skill: 'agility' })]),
  Object.freeze(['sigilCarvedAlcoveVoyage', '11681', Object.freeze({ artifactRecord: 'shardOfYchlecht', skill: null })]),
])
export const ALCove_IDS = Object.freeze(ALCove_TABLE.map(([id]) => id))
export const ALCove_OPTIONS = Object.freeze(Object.fromEntries(ALCove_TABLE.map(([id, , options]) => [id, options])))
export const ALCove_CODE = Object.freeze(Object.fromEntries(ALCove_TABLE.map(([id, code]) => [id, code])))
export const DREAMERS_REST = 'dreamersRest'
export const START_LOCATION = DREAMERS_REST
export const LOCATION_IDS = Object.freeze([DREAMERS_REST, ...ALCove_IDS])
export const LOCATION_COORDINATES = Object.freeze({
  sigilCarvedAlcoveAmbition: { x: 0, y: 1 },
  sigilCarvedAlcoveResilience: { x: 1, y: 1 },
  sigilCarvedAlcoveInfinity: { x: 2, y: 1 },
  sigilCarvedAlcoveDefiance: { x: 0, y: 0 },
  dreamersRest: { x: 1, y: 0 },
  sigilCarvedAlcoveVoyage: { x: 2, y: 0 },
})

function makeLocation(id, code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Sepulchre of the Sleeper location: ${code}`)
  return location({
    id, code,
    clues: card.clues,
    connections: extra.connections ? [...extra.connections] : [],
    ...extra,
    printedName: card.nameZh || card.name || code,
    printedTraits: [...(card.traits || [])],
  })
}

// 连接：沉睡者墓穴（印刷 Plus 符号）与五张刻印壁龛（Star 符号）相连；壁龛之间不相连。
const DREAMERS_REST_CONNECTIONS = Object.freeze([...ALCove_IDS])
export const LOCATIONS = Object.freeze(Object.fromEntries([
  [DREAMERS_REST, makeLocation(DREAMERS_REST, '11676', {
    connections: [...DREAMERS_REST_CONNECTIONS], start: true, revealed: true, lair: true,
  })],
  ...ALCove_TABLE.map(([id, code, options]) => [id, makeLocation(id, code, {
    connections: [DREAMERS_REST], glyph: true, artifactRecord: options.artifactRecord, skill: options.skill,
  })]),
]))
export const LOCATION_CONNECTIONS = Object.freeze(Object.fromEntries(
  Object.entries(LOCATIONS).map(([id, value]) => [id, Object.freeze([...(value.connections || [])])])))

// ---------------------------------------------------------------------------
// 远征物品（Setup：每位调查员可拿 1 件 Expedition 组的 Item）
// ---------------------------------------------------------------------------
export const EXPEDITION_ITEM_CODES = Object.freeze(['11761', '11762', '11763', '11764'])
export const EXPEDITION_ALLY_CODES = Object.freeze(['11765', '11766'])
export const EXPEDITION_CODES = Object.freeze([...EXPEDITION_ITEM_CODES, ...EXPEDITION_ALLY_CODES])

// ---------------------------------------------------------------------------
// gather 组与遭遇牌库
// ---------------------------------------------------------------------------
export const GATHER_GROUPS = Object.freeze([
  'sepulchreOfTheSleeper', 'domination', 'dreams', 'rlyeh', 'starSpawn', 'ancientEvils', 'strikingFear',
])
const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const deckCardTypes = ['enemy', 'treachery']
const expand = rows => rows
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
export const ENCOUNTER_DECK = Object.freeze(expand(Object.entries(ALL_CARDS)
  .filter(([, card]) => GATHER_GROUPS.map(snake).includes(card.encounterCode))
  .filter(([, card]) => deckCardTypes.includes(card.type))))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 遭遇定义
// ---------------------------------------------------------------------------
const definitions = encounterDefinitions([CTHULHU_CODE, ...ENCOUNTER_DECK_CODES, ...EXPEDITION_CODES])

// ---------------------------------------------------------------------------
// 议程阶段（特殊议程牌库：只有 2 张，没有幕）
// ---------------------------------------------------------------------------
export const AGENDA_STAGES = Object.freeze({
  [BENEATH_THE_CITY_CODE]: Object.freeze({
    ...stage(BENEATH_THE_CITY_CODE),
    // 印刷没有毁灭阈值；「扰动达到 6/8」时立刻推进（behavior.maybeAdvanceBeneathTheCity）。
    doomThreshold: null,
  }),
  [CTHULHU_AWAKENED_CODE]: Object.freeze({
    ...stage(CTHULHU_AWAKENED_CODE),
    objective: Object.freeze({ type: 'scenario', kind: 'defeatCthulhu' }),
  }),
})
export const STAGE_CARDS = Object.freeze({ ...AGENDA_STAGES })
export const AGENDAS = Object.freeze(Object.values(AGENDA_STAGES))

// 没有幕：引擎需要非空 acts，这里给一张「无幕」占位（只在 P7 development 阶段使用）。
export const ACT_STAGES = Object.freeze({
  11673: Object.freeze({
    ...stage('11673'),
    id: 'act11673',
    objective: Object.freeze({ type: 'scenario', kind: 'defeatCthulhu' }),
  }),
})
export const ACTS = Object.freeze(Object.values(ACT_STAGES))

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export const RESOLUTIONS = Object.freeze({
  noResolution: Object.freeze({ id: 'noResolution', label: 'Investigator Defeat / No Resolution' }),
  resolution1: Object.freeze({
    id: 'resolution1', label: 'Resolution 1',
    record: 'theInvestigatorsHaltedCthulhusAwakening', bonusXp: 10, mentalTrauma: 2,
    campaignWin: true, next: 'epilogue',
  }),
})

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '沉睡者墓穴 · Sepulchre of the Sleeper',
  nameEn: 'Sepulchre of the Sleeper',
  encounterCode: ENCOUNTER_CODE,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  coordinateSystem: 'location-group',
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...RESOLUTIONS },
  tokenMeanings: {
    easy: { ...CTHULHU_TOKEN_MEANINGS.easy },
    standard: { ...CTHULHU_TOKEN_MEANINGS.standard },
    hard: { ...CTHULHU_TOKEN_MEANINGS.hard },
    expert: { ...CTHULHU_TOKEN_MEANINGS.expert },
  },
  // disturbance 记录由 behavior 用 scenarioFlags/records 处理；registry 的 scenario.mechanics
  // 不接受自定义字段，故不在此声明。
  entryConditions: Object.freeze({
    preparedArtifacts: 1, preparedGlyphs: 10,
    fullyPreparedArtifacts: ARTIFACT_RECORDS.length, fullyPreparedGlyphs: GLYPH_TOTAL,
    requiresInnerSanctum: true,
  }),
  textLanguage: 'en',
  textStatus: 'printed-text (en; story/guide zh 由 narrative-guides worker 落 story-text.js)',
}

// 章节定义内的 stage/agenda 对象是 Object.freeze 的只读数据；身份绑定要在可写克隆上做。
scenario.acts = (scenario.acts || []).map(entry => structuredClone(entry))
scenario.agendas = (scenario.agendas || []).map(entry => structuredClone(entry))
export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, CTHULHU_CODE,
  ...LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...AGENDA_CODES, ...ENCOUNTER_DECK_CODES, ...EXPEDITION_CODES,
].map(code => [code, ALL_CARDS[code]])))

export { disturbance }
