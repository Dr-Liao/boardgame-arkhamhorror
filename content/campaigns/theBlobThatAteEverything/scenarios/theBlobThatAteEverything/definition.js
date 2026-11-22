// 吞噬万物（The Blob That Ate Everything · 85001）· 单桌（Single Group）章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/TheBlobThatAteEverything.hs（Setup：13 张地点的内/外环 + 角落布置；
//     Subject 8L-08 全局放置；反制措施 1/2 资源；混乱袋；Act 1/2/3 与 Agenda 1/2/3；
//     结局 R1/R2 与 R2 奖励资产；Blob X 击败敌人→对 Subject 造成 X 伤害）
//   Act|Agenda|Location|Enemy|Treachery|Story/CardDefs/TheBlobThatAteEverything.hs
//   src/cards/cards-data.js（85001–85053 卡面中英文）
//   frontend/src/locales/en/standalone/theBlobThatAteEverything.json（指南参考文本）
//
// 本关三条特有口径：
//   1. 地点网格：The Crater 居中；内环 4 格 = 研究站 / 临时总部 / 2 张随机隔离区；外环 4 格 =
//      真菌堆 / 3 张随机隔离区；角落 4 格 = 剩余隔离区。相邻（上下左右）地点相连。
//      普通流程从 10 张隔离区中随机移除 1 张；ELSE! 变体从 14 张（含 4 张 ELSE 地点）中移除 5 张。
//   2. Subject 8L-08 视为在场但不在任何地点：全局放置（location=null），血量 15[per_investigator]；
//      每个带 Blob X 的敌人被击败时对它造成 X 伤害；它被击败 → R2。它「吞噬」的卡放在其下方（本实现
//      以 scenarioFlags.blob.devoured 计数 + 弃牌/移出游戏记账）。
//   3. 反制措施：场景参考卡上的资源（本实现以 state.scenarioFlags.blob.countermeasures 数值记账），
//      研究站/陨石坑/临时总部/真菌堆的能力可花费；研究站可用 2 线索换 1 反制措施。
//
// 剧情/指南正文由 `content/scenario-guide-sources/theBlobThatAteEverything.json` 提供。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'theBlobThatAteEverything'
export const REFERENCE_CODE = '85001'
export const ENCOUNTER_CODE = 'theBlobThatAteEverything'
export const ELSE_ENCOUNTER_CODE = 'theBlobThatAteEverythingElse'

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export const ACT1_CODE = '85006' // Expose the Anomaly（单桌）
export const ACT2_CODE = '85007' // Extraterrestrial Physiology
export const ACT3_CODE = '85009' // Blackwater's Bane（单桌）
export const ACT_CODES = Object.freeze([ACT1_CODE, ACT2_CODE, ACT3_CODE])
export const EPIC_ACT_CODES = Object.freeze(['85005', '85008'])
export const AGENDA1_CODE = '85002' // The Anomaly Spreads
export const AGENDA2_CODE = '85003' // The Anomaly Swells
export const AGENDA3_CODE = '85004' // The Anomaly Consumes
export const AGENDA_CODES = Object.freeze([AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE])
export const AGENDA_DOOM = Object.freeze({ [AGENDA1_CODE]: 6, [AGENDA2_CODE]: 6, [AGENDA3_CODE]: 8 })
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])

// ---------------------------------------------------------------------------
// 敌人 / 剧情 / 资产
// ---------------------------------------------------------------------------
export const SUBJECT_CODE = '85038' // Subject 8L-08（单桌）
export const EPIC_SUBJECT_CODE = '85037'
export const VULNERABLE_HEART_CODE = '85043'
export const MIGO_GENERAL_CODE = '85027'
export const MIGO_DRONE_CODE = '85033'
export const MIGO_HARVESTER_CODE = '85034'
export const MIGO_MEDDLER_CODE = '85035'
export const MIGO_ABDUCTOR_CODE = '85036'
export const OOZELING_CODE = '85039'
export const GRASPING_OOZE_CODE = '85040'
export const CUBIC_OOZE_CODE = '85041'
export const OOZEWRAITH_CODE = '85042'
export const STORY_CODES = Object.freeze(['85021', '85022', '85023', '85024'])
export const STORY_ASSET_CODES = Object.freeze(['85025', '85026', '85028', '85029', '85030', '85031', '85032'])
export const CHEMIST_CODE = '85025'
export const SAMPLE_CODE = '85026'
export const MILITARY_PLAN_CODE = '85028'
export const UNIVERSAL_SOLVENT_CODE = '85029'
export const PET_OOZELING_CODE = '85030'
export const MIGO_WEAPON_CODE = '85031'
export const LT_WILSON_STEWART_CODE = '85032'
export const REWARD_ASSET_CODES = Object.freeze([UNIVERSAL_SOLVENT_CODE, PET_OOZELING_CODE,
  MIGO_WEAPON_CODE, LT_WILSON_STEWART_CODE])

// Blob X：带该关键词的敌人被击败时对 Subject 8L-08 造成 X 伤害。
export const BLOB_X = Object.freeze({
  [OOZELING_CODE]: 1, [GRASPING_OOZE_CODE]: 3, [CUBIC_OOZE_CODE]: 2, [OOZEWRAITH_CODE]: 5,
})

// 剧情卡档案：入场生成物 + 成功/失败条件 + 奖励（对应 Haskell Story/Cards/*.hs）。
// enemyPlacement: 'fungusMound'（固定）| 'farthest'（离所有调查员最远的地点）。
// assetPlacement: 'farthest' | 'crater' | 'global' | 'attachedToEnemy' | 'farthestFromFungus' | 'fungusMound'。
export const STORY_RULES = Object.freeze({
  // 拯救化学家：生成 Mi-Go Abductor 与 University Chemist；化学家进入临时总部→成功；化学家被击败/吞噬→失败。
  '85021': Object.freeze({
    title: 'Rescue the Chemist', titleZh: '拯救化学家',
    enemy: MIGO_ABDUCTOR_CODE, enemyPlacement: 'fungusMound',
    asset: CHEMIST_CODE, assetPlacement: 'farthest',
    successText: '化学家被救出（theChemistWasSaved）', successFact: 'theChemistWasSaved',
    failureText: '化学家没能完成配方（theFormulaWasNotCompleted）', failureFact: 'theFormulaWasNotCompleted',
    reward: UNIVERSAL_SOLVENT_CODE,
  }),
  '85022': Object.freeze({
    title: 'Recover the Sample', titleZh: '回收样本',
    enemy: MIGO_HARVESTER_CODE, enemyPlacement: 'fungusMound',
    asset: SAMPLE_CODE, assetPlacement: 'crater',
    successText: '样本被回收（theSampleWasRecovered）', successFact: 'theSampleWasRecovered',
    failureText: '样本丢失（theSampleWasLost）', failureFact: 'theSampleWasLost',
    reward: PET_OOZELING_CODE,
  }),
  '85023': Object.freeze({
    title: 'Drive Off the Mi-Go', titleZh: '赶走米·戈',
    enemy: MIGO_GENERAL_CODE, enemyPlacement: 'fungusMound', asset: null,
    successText: '米·戈被赶走（theMiGoWereDrivenOff）', successFact: 'theMiGoWereDrivenOff',
    failureText: '软泥的秘密被窃取（theSecretOfTheOozeWasStolen）', failureFact: 'theSecretOfTheOozeWasStolen',
    reward: MIGO_WEAPON_CODE,
  }),
  '85024': Object.freeze({
    title: 'Defuse the Explosives', titleZh: '拆除炸药',
    enemy: MIGO_MEDDLER_CODE, enemyPlacement: 'fungusMound',
    asset: MILITARY_PLAN_CODE, assetPlacement: 'global',
    successText: '炸药被拆除（theExplosivesWereDefused）', successFact: 'theExplosivesWereDefused',
    failureText: '炸药被引爆（theExplosivesWereDetonated）', failureFact: 'theExplosivesWereDetonated',
    reward: LT_WILSON_STEWART_CODE,
  }),
  // ELSE! 变体（Mi-Go Incursion II）。
  '89011': Object.freeze({
    title: 'Escort the Car', titleZh: '护送装甲车',
    enemy: '89013', enemyPlacement: 'fungusMound',
    asset: '89012', assetPlacement: 'farthestFromFungus',
    successText: '装甲车抵达目标（theCarReachedItsTarget）', successFact: 'theCarReachedItsTarget',
    failureText: '护送失败（theEscortFailed）', failureFact: 'theEscortFailed',
    reward: '89019',
  }),
  '89014': Object.freeze({
    title: 'Reclaim the Brain', titleZh: '夺回脑匣',
    enemy: '89015', enemyPlacement: 'farthest',
    asset: '89016', assetPlacement: 'attachedToEnemy',
    successText: '脑匣被回收（theBrainWasRecovered）', successFact: 'theBrainWasRecovered',
    failureText: '脑匣被夺走（theBrainWasTaken）', failureFact: 'theBrainWasTaken',
    reward: '89020',
  }),
  '89017': Object.freeze({
    title: 'Prevent Their Research', titleZh: '阻止他们的研究',
    enemy: null, enemyPlacement: null,
    extraEnemies: Object.freeze([Object.freeze({ code: '89018', placement: 'fungusMound' }),
      Object.freeze({ code: '89018', placement: 'farthest' })]),
    asset: null,
    successText: '米·戈的研究被阻止（theMiGoResearchWasStopped）', successFact: 'theMiGoResearchWasStopped',
    failureText: '米·戈完成了研究（theMiGoCompletedTheirResearch）', failureFact: 'theMiGoCompletedTheirResearch',
    reward: '89021',
  }),
})

// ---------------------------------------------------------------------------
// 地点（网格 13 格：中心 1 + 内环 4 + 外环 4 + 角落 4）
// ---------------------------------------------------------------------------
export const START_LOCATION = 'temporaryHQ'

// 网格槽位坐标（上下左右相邻 = 相连）。
export const GRID_SLOTS = Object.freeze({
  center: { x: 0, y: 0 },
  north: { x: 0, y: 1 }, south: { x: 0, y: -1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 },
  northOuter: { x: 0, y: 2 }, southOuter: { x: 0, y: -2 }, eastOuter: { x: 2, y: 0 }, westOuter: { x: -2, y: 0 },
  northEast: { x: 1, y: 1 }, northWest: { x: -1, y: 1 }, southEast: { x: 1, y: -1 }, southWest: { x: -1, y: -1 },
})
const ORTHOGONAL = Object.freeze({
  center: ['north', 'south', 'east', 'west'],
  north: ['center', 'northOuter', 'northEast', 'northWest'],
  south: ['center', 'southOuter', 'southEast', 'southWest'],
  east: ['center', 'eastOuter', 'northEast', 'southEast'],
  west: ['center', 'westOuter', 'northWest', 'southWest'],
  northOuter: ['north'], southOuter: ['south'], eastOuter: ['east'], westOuter: ['west'],
  northEast: ['north', 'east'], northWest: ['north', 'west'],
  southEast: ['south', 'east'], southWest: ['south', 'west'],
})

// 固定地点 + 隔离区（Quarantine Zone）实例表。[实例 id, 原卡号, 槽位（默认布局）]
export const FIXED_LOCATION_TABLE = Object.freeze([
  Object.freeze(['theCrater', '85010', 'center']),
  Object.freeze(['researchSite', '85011', 'north']),
  Object.freeze(['temporaryHQ', '85012', 'south']),
  Object.freeze(['fungusMound', '85013', 'northOuter']),
])
export const QUARANTINE_TABLE = Object.freeze([
  Object.freeze(['sewer', '85014', 'east']),
  Object.freeze(['bridge', '85015', 'west']),
  Object.freeze(['waterTower', '85016', 'southOuter']),
  Object.freeze(['church', '85017', 'eastOuter']),
  Object.freeze(['oozyLakebed1', '85018', 'westOuter']),
  Object.freeze(['oozyLakebed2', '85018', 'removed1']),
  Object.freeze(['slimyStreets1', '85019', 'northEast']),
  Object.freeze(['slimyStreets2', '85019', 'northWest']),
  Object.freeze(['desiccatedFarmland1', '85020', 'southEast']),
  Object.freeze(['desiccatedFarmland2', '85020', 'southWest']),
])
export const REMOVED_SLOTS = Object.freeze({
  removed1: { x: 4, y: 4 }, removed2: { x: 4, y: 5 }, removed3: { x: 4, y: 6 },
  removed4: { x: 5, y: 4 }, removed5: { x: 5, y: 5 }, removed6: { x: 5, y: 6 },
})
export const LOCATION_TABLE = Object.freeze([...FIXED_LOCATION_TABLE, ...QUARANTINE_TABLE])

export function slotConnections(slotMap) {
  const slotOf = new Map(Object.entries(slotMap))
  const connections = {}
  for (const [id] of LOCATION_TABLE) {
    const slot = slotOf.get(id)
    if (!slot || !ORTHOGONAL[slot]) { connections[id] = []; continue }
    connections[id] = ORTHOGONAL[slot]
      .map(otherSlot => [...slotOf].find(([, value]) => value === otherSlot)?.[0])
      .filter(Boolean)
  }
  return connections
}

export const DEFAULT_SLOT_MAP = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, , slot]) => [id, slot])))
export const STATIC_CONNECTIONS = Object.freeze(slotConnections(DEFAULT_SLOT_MAP))
export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id]) => {
  const slot = DEFAULT_SLOT_MAP[id]
  return [id, GRID_SLOTS[slot] || REMOVED_SLOTS[slot] || { x: 4, y: 4 }]
})))

// ---------------------------------------------------------------------------
// 卡面数据助手
// ---------------------------------------------------------------------------
export function printed(code) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown The Blob That Ate Everything card: ${code}`)
  return {
    code, originalCode: code,
    name: c.textZh || c.nameZh ? (c.nameZh || c.name) : c.name,
    nameEn: c.name,
    text: c.textZh || c.text || '',
    textEn: c.text || '',
    backText: c.backTextZh || c.backText || '',
    backTextEn: c.backText || '',
    type: c.type, traits: [...(c.traits || [])],
    ...(c.victory != null ? { victory: c.victory } : {}),
  }
}

export function location(data) {
  const { id, code, cluesFixed, clues, connections, ...rest } = data
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown The Blob That Ate Everything location: ${code}`)
  return {
    ...printed(code), id, shroud: c.shroud,
    connections: [...(connections || [])],
    ...rest,
    ...(cluesFixed != null ? { cluesFixed } : { cluesPerInvestigator: clues ?? c.clues ?? 0 }),
    unrevealedName: c.backNameZh || c.backName || c.nameZh || c.name,
    unrevealedNameEn: c.backName || c.name,
    oozified: (c.traits || []).includes('Oozified'),
  }
}

export function stage(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown The Blob That Ate Everything stage: ${code}`)
  const { number, doom, ...rest } = extra
  return {
    ...printed(code),
    id: `${c.type}${code}`,
    type: c.type,
    stage: `${number ?? c.stage ?? 1}a`,
    reveal: { type: 'campaignRule' },
    ...rest,
    ...(c.type === 'agenda' ? { doomThreshold: doom ?? c.doom } : {}),
  }
}

export function encounterDefinitions(codes) {
  const enemies = {}, treacheries = {}, storyAssets = {}
  for (const code of new Set(codes)) {
    const c = ALL_CARDS[code]
    if (!c) throw new RangeError(`Unknown The Blob That Ate Everything encounter definition: ${code}`)
    const base = printed(code)
    if (c.type === 'enemy') {
      enemies[code] = {
        ...base,
        fight: c.fight ?? null, evade: c.evade ?? null,
        health: c.health ?? null, healthPerInvestigator: c.healthPerInvestigator === true,
        damage: c.damage || 0, horror: c.horror || 0,
        ...(c.victory != null ? { victory: c.victory } : {}),
        ...Object.fromEntries(['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert', 'Surge']
          .filter(key => new RegExp(`\\b${key}\\.`).test(c.text || ''))
          .map(key => [key.toLowerCase(), true])),
        elite: (c.traits || []).includes('Elite'),
        manifold: (c.traits || []).includes('Manifold'),
        blobX: BLOB_X[code] || null,
      }
    } else if (c.type === 'treachery') {
      treacheries[code] = {
        ...base, entryRevelation: true,
        surge: /^Surge\./m.test(c.text || ''),
      }
    } else if (c.type === 'asset' || c.type === 'story') {
      storyAssets[code] = { ...base, global: true, ...(c.health != null ? { health: c.health } : {}) }
    }
  }
  return { enemies, treacheries, storyAssets }
}

export function identitiesFor(scenarioData) {
  const identity = value => ({ originalCode: value.originalCode || value.code, artCode: value.originalCode || value.code })
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas']
    .map(category => [category, Object.fromEntries(Object.values(scenarioData[category] || {})
      .map(value => [value.id || value.code, identity(value)]))]))
}

// ---------------------------------------------------------------------------
// 地点定义（默认布局；运行时 behavior 会按随机槽位重写 connections）
// ---------------------------------------------------------------------------
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code]) =>
  [id, location({ id, code, connections: STATIC_CONNECTIONS[id] || [] })])))

// ---------------------------------------------------------------------------
// 遭遇牌库 / 放一边
// ---------------------------------------------------------------------------
export const ENCOUNTER_GROUPS = Object.freeze(['theBlobThatAteEverything'])
// 注意：紧噬软泥 / 方体软泥各有 1 张按 Setup 放在一边，但场景区的静态分区校验不允许同卡号
// 同时出现在 encounterDeck 与 setAside；因此两张都声明为放一边，behavior.afterDeckSetup 再把
// 其中各 1 张先洗入遭遇牌库（与印刷布置等价，仅静态分区口径调整）。
const ENCOUNTER_COUNTS = Object.freeze({
  [OOZELING_CODE]: 4,
  '85044': 4, '85045': 2, '85046': 2, '85047': 3, '85048': 3,
  '85049': 2, '85050': 2, '85051': 2, '85052': 2, '85053': 2,
})
export const ENCOUNTER_DECK = Object.freeze(Object.entries(ENCOUNTER_COUNTS)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([code, count]) => Array(count).fill(code)))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

const MIGO_SET_CODES = Object.freeze(['85021', '85022', '85023', '85024', '85025', '85026', '85027',
  '85028', '85029', '85030', '85031', '85032', '85033', '85033', '85033', '85034', '85035', '85036'])
export const SET_ASIDE_CODES = Object.freeze([
  VULNERABLE_HEART_CODE, GRASPING_OOZE_CODE, GRASPING_OOZE_CODE, CUBIC_OOZE_CODE, CUBIC_OOZE_CODE,
  OOZEWRAITH_CODE, OOZEWRAITH_CODE,
  ...MIGO_SET_CODES,
])
export const SET_ASIDE_ALIASES = Object.freeze([...SET_ASIDE_CODES])
export const REWARD_ALIASES = Object.freeze([...REWARD_ASSET_CODES])

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  // 幕 1：一轮开始时，团队花费 2[per_investigator] 线索推进；推进后被击中的 Subject 弱点暴露。
  [ACT1_CODE]: Object.freeze({ ...stage(ACT1_CODE, { number: 1 }), objective: { type: 'custom' } }),
  // 幕 2：一轮结束时强制推进；背面按脆弱心脏的伤害数从遭遇牌库顶弃到足够 Manifold 总血量。
  [ACT2_CODE]: Object.freeze({ ...stage(ACT2_CODE, { number: 2 }), objective: { type: 'custom' } }),
  // 幕 3：一轮结束时强制推进；背面随机读一张 Part 1 剧情卡并把幕牌库重置回 1。
  [ACT3_CODE]: Object.freeze({ ...stage(ACT3_CODE, { number: 3 }), objective: { type: 'custom' } }),
})
export const AGENDA_STAGES = Object.freeze(Object.fromEntries(AGENDA_CODES.map(code =>
  [code, stage(code, { doom: AGENDA_DOOM[code] })])))
export const ACTS = Object.freeze(ACT_CODES.map(code => structuredClone(ACT_STAGES[code])))
export const AGENDAS = Object.freeze(AGENDA_CODES.map(code => structuredClone(AGENDA_STAGES[code])))
export const STAGE_CARDS = Object.freeze(Object.fromEntries([...Object.entries(ACT_STAGES), ...Object.entries(AGENDA_STAGES)]))

// ---------------------------------------------------------------------------
// 混乱标记 / 剧情正文
// ---------------------------------------------------------------------------
const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: { delta: 0, dynamic: 'devouredPerFive', text: '个体代号8L-08每吞噬 5 张卡牌，-1' },
    cultist: { delta: -2, text: '-2；若在攻击敌人时揭示，该敌人本次攻击获得「反击」' },
    tablet: { delta: -3, text: '-3；本次检定结束后，个体代号8L-08吞噬投入本次检定的每张卡牌' },
    elderthing: { delta: -5, text: '-5；选择手中至多 5 张卡牌被吞噬，本次检定每吞噬 1 张 +1 技能值' },
  }),
  hard: Object.freeze({
    skull: { delta: 0, dynamic: 'devouredPerThree', text: '个体代号8L-08每吞噬 3 张卡牌，-1' },
    cultist: { delta: -3, text: '-3；若在攻击敌人时揭示，该敌人本次攻击获得「反击」' },
    tablet: { delta: -4, text: '-4；本次检定结束后，个体代号8L-08吞噬投入本次检定的每张卡牌' },
    elderthing: { delta: -7, text: '-7；选择手中至多 7 张卡牌被吞噬，本次检定每吞噬 1 张 +1 技能值' },
  }),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale; guide source is authoritative)',
  heading: '吞噬万物',
  intro: '事件报告：8L-08。1928 年 7 月 5 日，星期四，马萨诸塞州黑水镇。'
    + '凌晨 3 时 12 分——黑水镇外发生撞击事件。我们截获了警方的电话，随即派出特工前往调查。'
    + '据当地农夫罗恩·格雷厄姆称，陨石有好几英尺宽，泛着绿光。坑洞直径约 100 码，外围检测到辐射。'
    + '建议立即隔离，并由研究团队进一步观察。情况已得到控制……然而事实并非如此。'
    + '接下来几天，黑水镇被彻底封锁。报纸上只谈论这次撞击，但除了那个巨大的坑洞和它对乡间造成的影响外，'
    + '人们所知甚少。没有人被允许离开小镇，只有那个隐秘政府机构批准的人才能进入，其中包括高级政府特工，'
    + '以及附近米斯卡托尼克大学被召来研究陨石的研究团队。对镇上其余居民而言，这不过是桩怪事……直到陨石孵化了。'
    + '我亲眼看见了。异变体钻出时，第一件事就是吞噬了被派来采集和研究陨石样本的研究团队。'
    + '接着它吞掉了实验室设备，然后是罗恩·格雷厄姆的拖拉机，再然后是他的整栋房子。它不断生长、蔓延，'
    + '吞噬沿途一切。我勉强捡回一条命。军队赶到时以为用子弹和炮弹就能杀死它，但一波接一波的弹药都被它吞了下去。'
    + '随后它分裂成数百个更小的自己，军队很快被淹没。战斗仍在继续时，我和镇上其他人看见天空中出现光点和巨大的形体。'
    + '有什么东西在上面等待着，伺机而动……',
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集《吞噬万物》遭遇组的所有卡牌。' },
    { key: 'setAsideMiGo', text: '将米·戈入侵遭遇组的所有卡牌放到一边（场外）。' },
    { key: 'setAside', text: '从《吞噬万物》遭遇组中找出脆弱心脏、1 张紧噬软泥、1 张方体软泥和 2 张软泥幽灵，放到一边（场外）。' },
    { key: 'subject', text: '将个体代号8L-08敌人生成在密谋牌库旁：它不在任何地点。' },
    { key: 'shuffleQuarantine', text: '洗混隔离区地点，随机移除 1 张。' },
    { key: 'placeCrater', text: '将陨石坑放入场中（网格中心）。' },
    { key: 'innerRing', text: '取研究站、临时总部和 2 张随机隔离区地点，洗混后分别与陨石坑相连放置（内环 4 格）。' },
    { key: 'outerRing', text: '取真菌堆和 3 张随机隔离区地点，洗混后分别放入外环 4 格（离陨石坑最远）。' },
    { key: 'remaining', text: '将剩余隔离区地点放入场中（角落 4 格）。' },
    { key: 'startAt', text: '每位调查员从临时总部开始游戏。' },
    { key: 'countermeasures', text: '在场景参考卡上放置 1 个资源作为反制措施（3 或 4 名调查员时改为 2 个）。' },
  ]),
  specialRules: Object.freeze([
    { id: 'blobX', title: 'Blob X（软泥 X）', text: '本场景中许多敌人是异变体身上崩落、拥有自身意识的部分。击败这些敌人会伤害异变体：'
      + '当一个带有 Blob X 的敌人被击败时，对个体代号8L-08造成 X 点伤害。带有 Blob X 的敌人被击败时不会放入胜利区，'
      + '除非它还带有 Victory X。' },
    { id: 'devour', title: '吞噬（Devour）', text: '个体代号8L-08能吞噬各种事物。若一张卡牌被吞噬，它被放到个体代号8L-08下方'
      + '（视为场外；游戏结束时归还其主人）。若一位调查员被吞噬，他/她阵亡。若一个标记被吞噬，它回到标记池。'
      + '选择被吞噬的地点时，不能选择会导致另一个地点失去所有有效连接的地点。' },
    { id: 'countermeasures', title: '反制措施（Countermeasures）', text: '反制措施代表可能帮助调查员生存的补给、研究或军事装备。'
      + '可以通过某些卡牌能力花费反制措施来触发强力效果；但获得新反制措施的机会很少，请谨慎花费。' },
    { id: 'storyCards', title: '剧情卡（Story Cards）', text: '剧情卡是本场景引入的新卡牌类型，用于提供额外叙事，通常以其他场景卡的背面出现。'
      + '当被要求结算一张剧情卡时，阅读其剧情文本，并结算其中的游戏文本（若有）。' },
  ]),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '没有达成任何结局（每位调查员都被击败）：异变体已经突破隔离区。你被吞噬了——眼前只剩一片黑暗，'
      + '没有声音，没有痛苦。黑水镇不复存在。',
    resolution1: '结局 1：黑水镇什么都没留下。隔离区崩溃了，异变体无法被收容。它先会蔓延过整个乡间，吞噬沿途一切；'
      + '很快整个马萨诸塞州都会被吞噬，然后是整个新英格兰。它已经在地底钻行，连海洋也无法阻止它。'
      + '没有任何大陆是安全的，地球上每一个生命体都会被吞噬。然后是地球……但这还不是终点。'
      + '连宇宙的虚空也阻止不了它的生长。终有一刻，它会继续扩张、吞噬，直到只剩下冰冷空旷的太空，'
      + '和那个吞噬万物的软泥团。',
    resolution2: '结局 2：事件报告：8L-08（续）。1928 年 7 月 11 日，星期三，马萨诸塞州黑水镇。'
      + '凌晨 7 时 42 分——与敌对异星目标取得接触。目标通过陨石抵达；研究人员尚不确定陨石是星际旅行的载体，'
      + '还是一种武器化的卵。立即启动紧急应对程序。大约 5 时，目标被第三方消灭。'
      + '按照行动协议，已采集样本并送往罗斯威尔作进一步研究。特工正在清理隔离区内目标存在的残余痕迹。'
      + '强烈建议立即销毁此前矛盾的报告。黑水镇居民已被告知隔离是因空气传播病毒所致。'
      + '特工正试图与未经许可的武装人员会面以进行情况汇报。鉴于事件的敏感性，建议释放他们并密切观察。'
      + '必须严格保密——不能让任何人知道这里真正发生了什么。',
  }),
  resolutionBranches: Object.freeze({
    noResolution: '每位调查员被击败：阅读结局「没有达成任何结局」。调查员输掉本战役。',
    resolution1: '在剧本日志中记录「个体代号8L-08吞噬了整个宇宙」。调查员输掉本战役。',
    resolution2: '在剧本日志中记录「异变体已被收容」。场上每张奖励资产（万能溶剂、宠物软泥怪、米·戈武器、'
      + '威尔逊·斯图尔特中尉）可由任意一位调查员选择加入其牌组（不计入牌组张数）。'
      + '每位调查员获得胜利区中每张卡牌的 Victory X 经验；另外每位调查员额外获得 3 点经验（剧情奖励）。',
  }),
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES, ...SET_ASIDE_CODES, SUBJECT_CODE, VULNERABLE_HEART_CODE,
])
export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ...ACT_CODES, ...AGENDA_CODES,
  ...LOCATION_TABLE.map(([, code]) => code),
  ...ENCOUNTER_DECK_CODES, ...SET_ASIDE_CODES,
].map(code => [code, ALL_CARDS[code]])))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '吞噬万物 · The Blob That Ate Everything',
  nameEn: 'The Blob That Ate Everything',
  encounterCode: ENCOUNTER_CODE,
  elseEncounterCode: ELSE_ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '依照剧本参考卡 85001 与指南设置：13 张地点按内环/外环/角落布置，Subject 8L-08 全局放置；'
    + '单桌模式下场景参考卡上有 1–2 个反制措施；独立开局每人 2 XP。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: Object.freeze(SCENARIO_TEXT.specialRules.map(rule => rule.title + '：' + rule.text)),
  rules: Object.freeze({}),
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  connectByIcons: true,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionBranches: { ...SCENARIO_TEXT.resolutionBranches },
  setAsideAliases: [...SET_ASIDE_ALIASES],
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export default scenario
