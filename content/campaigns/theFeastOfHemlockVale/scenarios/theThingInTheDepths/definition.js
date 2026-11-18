// 深沼之物（theThingInTheDepths · 提示卡 10588）· 章节数据（scenario 只含数据）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheThingInTheDepths.hs +
//       Scenarios/TheFeastOfHemlockVale/TheThingInTheDepths/Helpers.hs +
//       Act|Agenda|Location|Enemy|Treachery/{CardDefs,Cards}/TheFeastOfHemlockVale/TheThingInTheDepths* +
//       frontend/src/locales/en/theFeastOfHemlockVale/theThingInTheDepths.json（input.guidePath）。
//
// 卡面数据一律从 card-data.js 的 printed()/location()/stage()/encounterDefinitions()/encounterGroupDeck() 读取，
// 本文件不抄第二份卡文；剧情正文来自 story-text.js（经 story-access.js 读取），章节不写死英文/中文正文。
//
// 地点模型（10 张双面地点卡，Haskell Location/CardDefs 的 quantity 展开）：
//   泥淖沼泽 Muddy Fen ×2（10593a/b）、纠葛灌丛 Tangled Thicket ×1（10594a/b）、
//   腐臭池塘 Fetid Pool ×2（10595a/b）、泛滥道路 Flooded Path ×2（10596a/b）、
//   废弃棚屋 Abandoned Shack ×1（10597a/b）、腐烂码头 Rotten Dock ×1（10598a/b）、
//   廊桥 Covered Bridge ×1（10599a/b）。
//   正面 traits=[Bog]（线索/帷幕见印刷值），背面 Open Water traits=[Sunken]（帷幕 5、线索 0）。
// 开局：10 张洗混 → 随机移出 1 张（移出游戏）→ 其余 9 张按 3×3 网格 Bog 面朝上入场。
// 「北岸 North Shore / 起始地点 Starting Location / 蔓越莓沼 Cranberry Bog」是**网格槽位标签**
// （Haskell northShorePos=(1,1)、startingPos=(-1,-1)、cranberryBogPos=(1,-1)），不是卡。
// 因此 `LOCATION_CONNECTIONS` 是**参考摆法**（DEFAULT_SLOT_ASSIGNMENT）下的网格邻接表；
// 运行时 behavior.preScenarioSetup 用 api.shuffle/api.random 洗牌后按实际槽位重算每个地点的
// connections（槽位→地点 id 记在 scenarioFlags.depthsSlots，behavior 与测试的唯一读点）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stage, encounterDefinitions, encounterGroupDeck, identitiesFor,
} from '../../card-data.js'
import { chapterStory, flattenStory } from '../../story-access.js'
import { THE_THING_IN_THE_DEPTHS_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'theThingInTheDepths'
export const REFERENCE_CODE = '10588'
export const ENCOUNTER_CODE = 'the_thing_in_the_depths'

// 提示卡 10588 是剧本参考卡（混乱标记/指南），不是可布置的卡，故不进 CARD_CODES。
export const ACT_CODES = Object.freeze(['10591', '10592'])
export const AGENDA_CODES = Object.freeze(['10589', '10590'])
export const ENEMY_CODES = Object.freeze({
  thingInTheDepths: '10600',
  chelydranHybrid: '10601',
  graspingTendril: '10602',
})
export const TREACHERY_CODES = Object.freeze(['10603', '10604'])
// 本章没有独立剧情资产卡：Judith Park / Dr. Rosa Marquez / River Hawthorne 属于共享组 residents
// （10699 / 10702 / 10697），按日期在 setup 放置；「当前日」时间标记卡（10675/10677/10679）也由
// behavior.afterDeckSetup 放进场景区。两者都登记进 scenario.storyAssets，供引擎 ALL_STORY_ASSETS 读。
export const RESIDENT_CODES = Object.freeze({
  judithPark: '10699',
  drRosaMarquez: '10702',
  riverHawthorne: '10697',
})
export const GRASPING_TENDRIL_CODE = ENEMY_CODES.graspingTendril
export const THING_IN_THE_DEPTHS_CODE = ENEMY_CODES.thingInTheDepths
export const CHELYDRAN_HYBRID_CODE = ENEMY_CODES.chelydranHybrid

// ---------------------------------------------------------------------------
// 遭遇牌库
// ---------------------------------------------------------------------------
// 参考 Setup 的四个固定 gather 组（The Thing in the Depths / Blight / The Forest / Mutations），
// 外加「当前日」对应的 The First/Second/Final Day 组（按战役日志日期在 afterDeckSetup 洗入）。
export const GATHER_GROUPS = Object.freeze(['the_thing_in_the_depths', 'blight', 'the_forest', 'mutations'])
export const EXTERNAL_GATHER_GROUPS = Object.freeze(['blight', 'the_forest', 'mutations'])
export const DAY_ENCOUNTER_GROUPS = Object.freeze({
  1: 'the_first_day', 2: 'the_second_day', 3: 'the_final_day',
})
export const DAY_STORY_CODES = Object.freeze({ 1: '10675', 2: '10677', 3: '10679' })
// 剧本区出现的剧情卡：3 位居民 + 3 张「第 N 日」时间标记。
export const STORY_CODES = Object.freeze([...Object.values(RESIDENT_CODES), ...Object.values(DAY_STORY_CODES)])

// 放在一边：深沼之物、鳄龟混种、攫噬触须 ×5（physical 5 张）。
export const SET_ASIDE_CARDS = Object.freeze([
  THING_IN_THE_DEPTHS_CODE,
  CHELYDRAN_HYBRID_CODE,
  ...Array(5).fill(GRASPING_TENDRIL_CODE),
])
export const SET_ASIDE_ENEMY_CODES = Object.freeze([
  THING_IN_THE_DEPTHS_CODE, CHELYDRAN_HYBRID_CODE, GRASPING_TENDRIL_CODE,
])

/** 当前日对应的遭遇牌库（The First/Second/Final Day 的敌人/诡计，按印刷份数展开）。 */
export function dayEncounterDeck(day) {
  const group = DAY_ENCOUNTER_GROUPS[Number(day)] || DAY_ENCOUNTER_GROUPS[1]
  return encounterGroupDeck([group])
}

// 遭遇牌库 = 四个固定组里的敌人/诡计（放一边的 3 种敌人不进牌库），按印刷份数展开。
export const ENCOUNTER_DECK = Object.freeze(encounterGroupDeck(GATHER_GROUPS, {
  exclude: [...SET_ASIDE_ENEMY_CODES],
}))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
// 槽位：3×3 网格（x 向右、y 向上，与 Haskell Pos 同向）。北岸 (1,1) / 起始地点 (-1,-1) /
// 蔓越莓沼 (1,-1) 三个槽位带印刷标签。
export const GRID_SLOTS = Object.freeze([
  Object.freeze({ id: 'northWest', x: -1, y: 1 }),
  Object.freeze({ id: 'north', x: 0, y: 1 }),
  Object.freeze({ id: 'northShore', x: 1, y: 1 }),
  Object.freeze({ id: 'west', x: -1, y: 0 }),
  Object.freeze({ id: 'center', x: 0, y: 0 }),
  Object.freeze({ id: 'east', x: 1, y: 0 }),
  Object.freeze({ id: 'startingLocation', x: -1, y: -1 }),
  Object.freeze({ id: 'south', x: 0, y: -1 }),
  Object.freeze({ id: 'cranberryBog', x: 1, y: -1 }),
])
export const SLOT_IDS = Object.freeze(GRID_SLOTS.map(slot => slot.id))
export const SLOT_LABELS = Object.freeze({
  northShore: '北岸', startingLocation: '起始地点', cranberryBog: '蔓越莓沼',
})
export const START_SLOT = 'startingLocation'
export const CENTER_SLOT = 'center'
export const GRID_ADJACENCY = Object.freeze(Object.fromEntries(GRID_SLOTS.map(slot => [slot.id,
  GRID_SLOTS.filter(other => Math.abs(other.x - slot.x) + Math.abs(other.y - slot.y) === 1).map(other => other.id),
])))

// [locationId, Bog 面卡号, Open Water 面卡号, 每调查员线索, 胜利点]
export const LOCATION_TABLE = Object.freeze([
  ['muddyFen1', '10593a', '10593b', 2, 1],
  ['muddyFen2', '10593a', '10593b', 2, 1],
  ['tangledThicket', '10594a', '10594b', 1, 0],
  ['fetidPool1', '10595a', '10595b', 1, 0],
  ['fetidPool2', '10595a', '10595b', 1, 0],
  ['floodedPath1', '10596a', '10596b', 0, 0],
  ['floodedPath2', '10596a', '10596b', 0, 0],
  ['abandonedShack', '10597a', '10597b', 2, 0],
  ['rottenDock', '10598a', '10598b', 1, 0],
  ['coveredBridge', '10599a', '10599b', 1, 1],
])
export const LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
export const BOG_CODE_BY_LOCATION = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, bog]) => [id, bog])))
export const OPEN_WATER_CODE_BY_LOCATION = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([id, , openWater]) => [id, openWater])))
export const OPEN_WATER_BY_BOG_CODE = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([, bog, openWater]) => [bog, openWater])))
// 本章 23 张卡（9 张幕/议程/敌人/诡计 + 14 个地点面）；提示卡 10588 单列为 REFERENCE_CODE。
export const CARD_CODES = Object.freeze([
  ...ACT_CODES, ...AGENDA_CODES, ...Object.values(ENEMY_CODES), ...TREACHERY_CODES,
  ...[...new Set(LOCATION_TABLE.flatMap(([, bog, openWater]) => [bog, openWater]))],
])

// 每个 Open Water 面的印刷数据（sinkLocation / replacePrintedLocationFace 的 face 参数）。
// 关键：`normalizePrintedLocationFace` 会 assertFields 到精确 5 个字段（未知字段直接抛错），
// 且 `replacePrintedLocationFace` 会 Object.assign 整个面——所以这里只放 code/name/nameEn/shroud/traits，
// 不带 connections/clues/victory 等运行期或旧面字段（胜利点沿用同卡背面印刷值，两面对应相同）。
function openWaterFace(openWater) {
  const card = ALL_CARDS[openWater]
  return Object.freeze({
    code: openWater,
    name: card.nameZh || card.name,
    nameEn: card.name,
    shroud: card.shroud,
    traits: [...(card.traits || [])],
  })
}
export const OPEN_WATER_FACES = Object.freeze(Object.fromEntries([...new Set(
  LOCATION_TABLE.map(([, , openWater]) => openWater))].map(openWater => [openWater, openWaterFace(openWater)])))

// 参考摆法：10 张里默认移出 coveredBridge，其余 9 张进网格（仅用于静态连接表/manifest/UI 坐标；
// 运行时洗牌结果以 scenarioFlags.depthsSlots 为准）。
export const DEFAULT_SLOT_ASSIGNMENT = Object.freeze({
  northWest: 'muddyFen1',
  north: 'tangledThicket',
  northShore: 'fetidPool1',
  west: 'floodedPath1',
  center: 'abandonedShack',
  east: 'rottenDock',
  startingLocation: 'muddyFen2',
  south: 'fetidPool2',
  cranberryBog: 'floodedPath2',
})
export const DEFAULT_REMOVED_LOCATION = 'coveredBridge'

/** 槽位邻接 → 地点 id 连接（参考摆法）。 */
export function connectionsForAssignment(assignment) {
  const out = {}
  for (const slotId of SLOT_IDS) {
    const locationId = assignment?.[slotId]
    if (!locationId) continue
    out[locationId] = GRID_ADJACENCY[slotId].map(neighbor => assignment[neighbor]).filter(Boolean)
  }
  return out
}
export const LOCATION_CONNECTIONS = Object.freeze(connectionsForAssignment(DEFAULT_SLOT_ASSIGNMENT))
export const START_LOCATION = DEFAULT_SLOT_ASSIGNMENT[START_SLOT]
export const NORTH_SHORE_LOCATION = DEFAULT_SLOT_ASSIGNMENT.northShore
export const CRANBERRY_BOG_LOCATION = DEFAULT_SLOT_ASSIGNMENT.cranberryBog
export const CENTER_LOCATION = DEFAULT_SLOT_ASSIGNMENT[CENTER_SLOT]

/** 桌面坐标（参考摆法的槽位坐标；运行时洗牌后的实际摆位以 flags.depthsSlots 为准）。 */
export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries(
  SLOT_IDS.map(slotId => [DEFAULT_SLOT_ASSIGNMENT[slotId], (() => {
    const slot = GRID_SLOTS.find(item => item.id === slotId)
    return { x: slot.x, y: slot.y }
  })()])))

function makeLocation([id, bogCode, , clues, victory]) {
  return location({
    id, code: bogCode, clues, connections: [...(LOCATION_CONNECTIONS[id] || [])],
    sinkFaceCode: OPEN_WATER_CODE_BY_LOCATION[id],
    ...(victory ? { hasVictory: true, victory } : {}),
  })
}
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(row => [row[0], makeLocation(row)])))

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
// 幕 1「植物勘察」：一轮结束时，位于北岸的调查员可共同支付 3[per_investigator] 线索推进
//   （objective.atLocation 运行时改写为实际北岸 id）。
// 幕 2「绝世发现」：一轮结束时鳄龟混种在起始地点则立即推进（behavior.checkObjectives）。
// 议程 1「地表下沉」阈值 3；议程 2「沼地之物」阈值 10、目标「深沼之物被击败 → 结局 4」。
export const ACT_STAGES = Object.freeze({
  1: Object.freeze(stage(ACT_CODES[0], {
    objective: { type: 'clues', perInvestigator: 3, atLocation: NORTH_SHORE_LOCATION },
  })),
  2: Object.freeze(stage(ACT_CODES[1], {
    objective: { type: 'chelydranHybridAtStartingLocation' },
  })),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze(stage(AGENDA_CODES[0])),
  2: Object.freeze(stage(AGENDA_CODES[1], {
    objective: { type: 'thingInTheDepthsDefeated', resolution: 'resolution4' },
  })),
})
// scenario 里的幕/议程实例必须是可变副本：identities.js 会把原卡身份写回定义对象。
export const ACTS = Object.freeze([1, 2].map(number => structuredClone(ACT_STAGES[number])))
export const AGENDAS = Object.freeze([1, 2].map(number => structuredClone(AGENDA_STAGES[number])))

// ---------------------------------------------------------------------------
// 剧情正文（story-text.js 生成物，经 story-access.js 读取；缺失回退英文叶子）
// ---------------------------------------------------------------------------
const safeChapterStory = id => {
  try { return chapterStory(id) } catch { return null }
}
const STORY = safeChapterStory(CHAPTER_ID) || { sectionsEn: {}, sections: {}, chineseGaps: [] }
const leafOf = key => STORY.sections?.[key] ?? STORY.sectionsEn?.[key] ?? ''
const stripHtml = value => String(value || '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
  .replace(/\{'\{\}'(?=[a-zA-Z])/g, '{').replace(/\{'\{\}'\}/g, '}')
const text = key => stripHtml(flattenStory(leafOf(key))).replace(/[ \t]+/g, ' ').trim()
const blocks = (...keys) => keys.map(text).filter(Boolean).join('\n\n')
const pairs = (keys, prefix) => Object.freeze(Object.fromEntries(keys.map(key => [key, text(`${prefix}.${key}`)])))

const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5'])
export const SCENARIO_TEXT = Object.freeze({
  // story-text 的中文自译层本章尚未覆盖（chineseGaps 全量），正文按英文叶子投影，不冒充中文。
  textLanguage: 'en',
  textStatus: 'reference-en (zh translation gap; story-text chineseGaps)',
  title: text('intro.title'),
  intro: Object.freeze({
    title: text('intro.title'),
    body: text('intro.body'),
    nightSkip: text('intro.nightSkip'),
    day1: text('intro.day1'),
    day2: text('intro.day2'),
    day3: text('intro.day3'),
    intro1: text('intro.intro1'),
    checkJudith: text('intro.checkJudith'),
    judithHigh: text('intro.judithHigh'),
    judithLow: text('intro.judithLow'),
    intro2: text('intro.intro2'),
    intro3: text('intro.intro3'),
    intro4: text('intro.intro4'),
    intro5: text('intro.intro5'),
    intro6: text('intro.intro6'),
    intro7: text('intro.intro7'),
    intro8: text('intro.intro8'),
    choiceLabels: Object.freeze({ push: text('intro.label.push'), rev: text('intro.label.rev') }),
    xpBonus: text('intro.xp.bonus'),
  }),
  setup: Object.freeze({
    gatherSets: text('setup.gatherSets'),
    currentDaySet: text('setup.currentDaySet'),
    currentDayMarker: text('setup.currentDayMarker'),
    doomDay2: text('setup.doomDay2'),
    doomDay3: text('setup.doomDay3'),
    locations: text('setup.locations'),
    shuffleLocations: text('setup.shuffleLocations'),
    startingLocation: text('setup.startingLocation'),
    residents: text('setup.residents'),
    residentsDay1: text('setup.residentsDay1'),
    residentsDay2Or3: text('setup.residentsDay2Or3'),
    removeResidents: text('setup.removeResidents'),
    setAsideEnemies: text('setup.setAsideEnemies'),
  }),
  specialRules: Object.freeze([Object.freeze({
    title: text('specialRules[0].title') || text('sinkingLocations.title'),
    body: blocks('specialRules[0].body', 'sinkingLocations.body'),
  })]),
  sinkingLocations: Object.freeze({
    title: text('sinkingLocations.title'),
    body: text('sinkingLocations.body'),
  }),
  labels: Object.freeze({
    placeSinkhole: text('label.groundDisturbance.placeSinkhole'),
    removeSinkhole: text('label.removeSinkhole'),
    doNotRemoveSinkhole: text('label.doNotRemoveSinkhole'),
    northShore: text('ui.northShore'),
    startingLocation: text('ui.startingLocation'),
    cranberryBog: text('ui.cranberryBog'),
  }),
  codex: Object.freeze({
    riverHawthorne: Object.freeze({
      title: text('codex.riverHawthorne.title'),
      uncontrolled: text('codex.riverHawthorne.uncontrolled'),
      controlled: text('codex.riverHawthorne.controlled'),
    }),
    judithPark: Object.freeze({
      title: text('codex.judithPark.title'),
      grudge: text('codex.judithPark.grudge'),
      noGrudge: text('codex.judithPark.noGrudge'),
    }),
    drRosaMarquez: Object.freeze({
      title: text('codex.drRosaMarquez.title'),
      body: text('codex.drRosaMarquez.body'),
    }),
    xpBonus: text('codex.xp.bonus'),
  }),
  tokens: Object.freeze({
    easyStandard: pairs(['skull', 'cultist', 'tablet', 'elderthing'], 'tokens.easyStandard'),
    hardExpert: pairs(['skull', 'cultist', 'tablet', 'elderthing'], 'tokens.hardExpert'),
  }),
  resolutions: Object.freeze(Object.fromEntries(RESOLUTION_KEYS.map(key =>
    [key, blocks(`resolutions.${key}.title`, `resolutions.${key}.body`)]))),
  xp: Object.freeze({
    bonus: text('resolutions.xp.bonus'),
    bonusJudith: text('resolutions.xp.bonusJudith'),
  }),
  introBranches: pairs(['nightSkip', 'day1', 'day2', 'day3'], 'intro'),
})

// ---------------------------------------------------------------------------
// 战役记录键（本章唯一写入口；resolution/intro 与测试同源）
// ---------------------------------------------------------------------------
// FHV 战役层（content/campaigns/theFeastOfHemlockVale/records.js）尚未落盘的记录键先在此约定；
// 全部经 api.setCampaignRecord / api.mechanics.* 写入（引擎读点），不新造 state 字段。
export const RECORD_KEYS = Object.freeze({
  introBranch: 'theThingInTheDepthsIntro',
  judithSharedAGrudge: 'judithSharedAGrudge',
  riverAskedForHelp: 'riverAskedForHelp',
  chelydranHybridPerished: 'theChelydranHybridPerished',
  chelydranHybridLived: 'theChelydranHybridLived',
  chelydranHybridWasDevoured: 'theChelydranHybridWasDevoured',
  thingInTheDepthsWasDefeated: 'theThingInTheDepthsWasDefeated',
  resolution: 'theThingInTheDepthsResolution',
  areasSurveyed: 'areasSurveyed',
  eastwickBog: 'eastwickBog',
  bonusXp: 'theThingInTheDepthsBonusXp',
  fewerResourcesNextScenario: 'theInvestigatorsBeginTheNextScenarioWithFewerResources',
  fewerActionsNextScenario: 'theInvestigatorsBeginTheNextScenarioWithFewerActions',
  judithRelationship: 'judithParkRelationshipLevel',
  riverRelationship: 'riverHawthorneRelationshipLevel',
})
export const RESIDENT_RECORDS = Object.freeze({
  judithPark: Object.freeze({
    level: RECORD_KEYS.judithRelationship, notes: 'judithParkNotes', crossedOut: 'judithParkCrossedOut', max: 5,
  }),
  riverHawthorne: Object.freeze({
    level: RECORD_KEYS.riverRelationship, notes: 'riverHawthorneNotes', crossedOut: 'riverHawthorneCrossedOut', max: 5,
  }),
})
export const RECORD_READS = Object.freeze([
  RECORD_KEYS.judithRelationship, RECORD_KEYS.judithSharedAGrudge,
  RECORD_KEYS.riverRelationship, RECORD_KEYS.riverAskedForHelp,
])
const WRITTEN_RECORD_KEYS = Object.freeze(Object.entries(RECORD_KEYS)
  .filter(([key]) => key !== 'eastwickBog')
  .map(([, value]) => value))
export const RECORD_WRITES = Object.freeze([...WRITTEN_RECORD_KEYS])

// ---------------------------------------------------------------------------
// scenario
// ---------------------------------------------------------------------------
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES, ...SET_ASIDE_ENEMY_CODES, ...STORY_CODES,
])

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '深沼之物 · The Thing in the Depths',
  nameEn: 'The Thing in the Depths',
  intro: SCENARIO_TEXT.intro.body,
  setup: SCENARIO_TEXT.setup.locations,
  specialRules: SCENARIO_TEXT.specialRules,
  sinkingLocations: SCENARIO_TEXT.sinkingLocations,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [],
  acts: ACTS,
  agendas: AGENDAS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: {
    noResolution: SCENARIO_TEXT.resolutions.noResolution || '',
    resolution1: SCENARIO_TEXT.resolutions.resolution1 || '',
    resolution2: SCENARIO_TEXT.resolutions.resolution2 || '',
    resolution3: SCENARIO_TEXT.resolutions.resolution3 || '',
    resolution4: SCENARIO_TEXT.resolutions.resolution4 || '',
    resolution5: SCENARIO_TEXT.resolutions.resolution5 || '',
  },
  tokenMeanings: {
    easy: { ...THE_THING_IN_THE_DEPTHS_TOKEN_MEANINGS.easy },
    standard: { ...THE_THING_IN_THE_DEPTHS_TOKEN_MEANINGS.standard },
    hard: { ...THE_THING_IN_THE_DEPTHS_TOKEN_MEANINGS.hard },
    expert: { ...THE_THING_IN_THE_DEPTHS_TOKEN_MEANINGS.expert },
  },
  // 引擎「三循环/FHV」日期原语（scenario-calendar.js）的声明位置：DAY/NIGHT 记录由 behavior 读写。
  mechanics: {
    calendar: { maximumDay: 3, record: 'hemlockDate', periodByLocationTrait: null },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
// 双面地点：manifest 的 backCode 指向 Open Water 面（正面 = Bog 面）。
for (const [id, openWater] of Object.entries(OPEN_WATER_CODE_BY_LOCATION)) {
  if (identities.locations[id]) identities.locations[id] = { ...identities.locations[id], linkedOriginalCode: openWater }
}
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ...ACT_CODES, ...AGENDA_CODES, ...Object.values(ENEMY_CODES), ...TREACHERY_CODES,
  ...LOCATION_TABLE.flatMap(([, bog, openWater]) => [bog, openWater]),
].map(code => [code, ALL_CARDS[code]])))
