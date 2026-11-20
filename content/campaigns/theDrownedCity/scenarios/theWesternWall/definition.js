// 西墙（theWesternWall · 提示卡 11517，The Drowned City 十循环第八章）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/TheDrownedCity/TheWesternWall.hs +
//   Act|Agenda|Location|Enemy|Treachery/CardDefs/TheDrownedCity/TheWesternWall.hs +
//   Act|Agenda|Location|Enemy|Treachery|Story/Cards/TheDrownedCity/TheWesternWall/*.hs +
//   Campaigns/TheDrownedCity/{CampaignSteps,Helpers,ChaosBag}.hs +
//   frontend/src/locales/en/theDrownedCity/theWesternWall.json（印刷文本）。
//
// 卡号归属：11518–11535（含 11531b/11532b 两张剧情背面）共 20 张专属卡；11517 是提示卡本身。
// 专属组 the_western_wall；另 gather Cosmic Legacy / Deep Ones / Flood(tdc_flood) / R'lyeh /
// Star Spawn / The Inescapable / Undersea Creatures / Agents of Cthulhu，以及 tdc_expedition（远征装备）。
//
// 本关四条特有口径：
//   1. 5 层纵向地点：所有地点按「行」排布，每层与上下整层互通、同层不连通
//      （引擎 P7 原语 `mechanics.map.configure({ adjacency: 'rows' })`）。
//   2. 两个方向两套构型：theExpeditionHeadedWest 时从西墙（层 1）下潜到黑曜石地基（层 5），
//      否则从黑曜石地基（层 1）攀上西墙（层 5）；淹没初始值相反（w. 2–5 / e. 1–4）。
//   3. 行走路线与底部三张地点随机洗牌（2 张移出游戏）；层数只由格子决定。
//   4. 淹没等级 0/1/2（未淹没/部分淹没/完全淹没）；完全淹没地点回合开始要「挣扎呼吸」
//      （引擎 P7 `scenario.mechanics.water = { air: true, damage: 5 }` 读点）。
//
// 剧情/指南正文由 narrative-guides worker 的 story-text.js / 指南生成物提供；本文件内
// SCENARIO_TEXT 只放布置步骤、特别规则与结局的忠实中译。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { THE_WESTERN_WALL_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'theWesternWall'
export const REFERENCE_CODE = '11517'
export const ENCOUNTER_CODE = 'the_western_wall'

// ---------------------------------------------------------------------------
// 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
export const ACT_WEST_CODE = '11519' // Descend into the Abyss
export const ACT_EAST_CODE = '11520' // Ascend the Wall
export const ACT_CODES = Object.freeze([ACT_WEST_CODE, ACT_EAST_CODE])
export const AGENDA_CODE = '11518' // Flooded Paths
export const AGENDA_CODES = Object.freeze([AGENDA_CODE])
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3'])
// 结局 3 的二选一：淹没城区 / 养育场；结局 2 与东线无结局都前往「沉睡者之墓」。
export const RESOLUTION3_CHAPTERS = Object.freeze(['theDrownedQuarter', 'theApiary'])
export const NEXT_CHAPTER_EAST = 'sepulchreOfTheSleeper'
export const DO_NO_HARM_TASK_CODES = Object.freeze(['11758a', '11758b'])
export const HUNTING_PARASITE_CODE = '11535'
export const CORAL_STAR_SPAWN_CODE = '11727'
export const INESCAPABLE_CODE = '11744'
export const SEAFLOOR_FRIEZE_CODE = '11531'
export const UNDERSEA_VAULT_CODE = '11532'
export const UNDERSEA_VAULT_ID = 'underseaVault'
export const DEEP_ONE_MATRON_CODE = '11533'

// ---------------------------------------------------------------------------
// gather 组
// ---------------------------------------------------------------------------
export const ENCOUNTER_GROUPS = Object.freeze([
  'theWesternWall', 'cosmicLegacy', 'deepOnes', 'tdcFlood', 'rlyeh',
  'starSpawn', 'theInescapable', 'underseaCreatures', 'agentsOfCthulhu',
])
export const EXPEDITION_GROUP = 'tdcExpedition'

// ---------------------------------------------------------------------------
// 地点（13 张物理卡实例；10 张入场、1 张放一边、2 张移出游戏）
// ---------------------------------------------------------------------------
// 每行 [实例 id, 真实卡号, 默认（西线）层, 默认列]。
// 层/列只是静态展示与 manifest 的规范排布；运行期按洗牌结果重写网格（behavior.setupScenario）。
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['westernWall', '11530', 1, 1]),
  Object.freeze(['slickStepsA', '11521', 2, 1]),
  Object.freeze(['slickStepsB', '11521', 3, 0]),
  Object.freeze(['erodedShelfA', '11522', 3, 1]),
  Object.freeze(['erodedShelfB', '11522', 4, 0]),
  Object.freeze(['precariousClimb', '11523', 4, 1]),
  Object.freeze(['drownedShanty', '11527', 4, 2]),
  Object.freeze(['obsidianFoundations', '11529', 5, 0]),
  Object.freeze(['sunkenStairway', '11526', 5, 1]),
  Object.freeze(['shatteredRuins', '11528', 5, 2]),
  Object.freeze(['underseaVault', '11532', null, null]),
  Object.freeze(['deadlyPass', '11524', null, null]),
  Object.freeze(['shallowDen', '11525', null, null]),
])
export const LOCATION_CODES = Object.freeze(LOCATION_TABLE.map(([, code]) => code))
export const LEVEL_COUNTS = Object.freeze({ 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 })
export const START_LOCATION_WEST = 'westernWall'
export const START_LOCATION_EAST = 'obsidianFoundations'
export const START_LOCATION = START_LOCATION_WEST
// 两间可互换的「端点」地点：西线是西墙在层 1、黑曜石地基在层 5；东线相反。
export const SWAPPABLE_ENDPOINTS = Object.freeze(['westernWall', 'obsidianFoundations'])
export const SET_ASIDE_LOCATION_IDS = Object.freeze([UNDERSEA_VAULT_ID])
export const SPECIAL_LOCATION_IDS = Object.freeze(['drownedShanty', 'sunkenStairway', 'shatteredRuins'])
export const PATH_LOCATION_IDS = Object.freeze([
  'slickStepsA', 'slickStepsB', 'erodedShelfA', 'erodedShelfB',
  'precariousClimb', 'deadlyPass', 'shallowDen',
])
export const REMOVED_PATH_COUNT = 2
// 规范排布下移出游戏的两张行走路线（实际随机；manifest 只记录固定移出的星之眷族）。
export const CANONICAL_REMOVED_PATH_IDS = Object.freeze(['deadlyPass', 'shallowDen'])
export const LEVEL_UPPER_SLOTS = Object.freeze([
  Object.freeze({ level: 2, column: 1 }),
  Object.freeze({ level: 3, column: 0 }),
  Object.freeze({ level: 3, column: 1 }),
  Object.freeze({ level: 4, column: 0 }),
  Object.freeze({ level: 4, column: 1 }),
  Object.freeze({ level: 4, column: 2 }),
])
export const LEVEL_BOTTOM_SLOTS = Object.freeze([
  Object.freeze({ level: 5, column: 0 }),
  Object.freeze({ level: 5, column: 1 }),
  Object.freeze({ level: 5, column: 2 }),
])

// ---------------------------------------------------------------------------
// 卡面数据助手（本地实现，不依赖战役层 card-data.js）
// ---------------------------------------------------------------------------
export function printed(code) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown The Drowned City card: ${code}`)
  return {
    code, originalCode: code,
    name: c.nameZh || c.name, nameEn: c.name,
    subname: c.subnameZh || c.subname || '', subnameEn: c.subname || '',
    text: c.textZh || c.text || '', textEn: c.text || '',
    backName: c.backNameZh || c.backName || '', backNameEn: c.backName || '',
    backText: c.backTextZh || c.backText || '', backTextEn: c.backText || '',
    type: c.type, traits: [...(c.traits || [])],
    ...(c.victory != null ? { victory: c.victory } : {}),
  }
}

export function location(data) {
  const { id, code, connections, level, column, ...rest } = data
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown The Western Wall location: ${code}`)
  const fixed = c.cluesFixed === true
  return {
    ...printed(code), id,
    shroud: Number(c.shroud) >= 0 ? Number(c.shroud) : (Number(level) || 1),
    connections: [...(connections || [])],
    ...(level != null ? { level } : {}),
    ...(column != null ? { column } : {}),
    ...rest,
    ...(fixed ? { cluesFixed: c.clues } : { cluesPerInvestigator: c.clues ?? 0 }),
    ...(c.victory != null ? { victory: c.victory } : {}),
    unrevealedName: c.backNameZh || c.backName || c.nameZh || c.name,
    unrevealedNameEn: c.backName || c.name,
  }
}

export function stage(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown The Western Wall stage: ${code}`)
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

const PREY_KEYS = Object.freeze({
  'Most clues': 'mostClues',
  'Fewest clues': 'fewestClues',
  'Bearer only': 'bearer',
})

export function encounterDefinitions(codes) {
  const enemies = {}, treacheries = {}, storyAssets = {}
  for (const code of new Set(codes)) {
    const c = ALL_CARDS[code]
    if (!c) throw new RangeError(`Unknown The Western Wall encounter definition: ${code}`)
    const base = printed(code)
    if (c.type === 'enemy') {
      const keywords = String(c.text || '')
      const preyText = /Prey - ([^.]+)\./.exec(keywords)?.[1]?.trim()
      enemies[code] = {
        ...base,
        fight: c.fight ?? null, evade: c.evade ?? null,
        health: c.health ?? null, damage: c.damage || 0, horror: c.horror || 0,
        ...(c.healthPerInvestigator ? { healthPerInvestigator: c.health } : {}),
        ...(c.victory != null ? { victory: c.victory } : {}),
        ...(PREY_KEYS[preyText] ? { prey: PREY_KEYS[preyText] } : {}),
        ...Object.fromEntries(['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert', 'Swarming']
          .filter(k => new RegExp(`\\b${k}\\.`).test(keywords)).map(k => [k.toLowerCase(), true])),
        elite: (c.traits || []).includes('Elite'),
      }
    } else if (c.type === 'treachery') {
      treacheries[code] = {
        ...base, entryRevelation: true,
        surge: /^Surge\./m.test(c.text || ''),
        peril: /(?:^|\n|\. )Peril\./.test(c.text || ''),
      }
    } else if (c.type === 'story' || c.type === 'asset') {
      storyAssets[code] = { ...base, global: true }
    }
  }
  return { enemies, treacheries, storyAssets }
}

export function identitiesFor(scenarioData) {
  const identity = value => ({
    originalCode: value.originalCode || value.code,
    artCode: value.originalCode || value.code,
  })
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas']
    .map(category => [category, Object.fromEntries(Object.values(scenarioData[category] || {})
      .map(value => [value.id || value.code, identity(value)]))]))
}

// ---------------------------------------------------------------------------
// 遭遇牌库 / 放一边 / 移出游戏
// ---------------------------------------------------------------------------
const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const encounterCodes = groups => new Set(groups.map(snake))
const deckTypes = ['enemy', 'treachery']

export const SET_ASIDE_ALIASES = Object.freeze([SEAFLOOR_FRIEZE_CODE, HUNTING_PARASITE_CODE, CORAL_STAR_SPAWN_CODE, INESCAPABLE_CODE])
export const REMOVED_STAR_SPAWN_CODES = Object.freeze(['11725', '11726', '11728'])
const DECK_EXCLUDED = Object.freeze([
  ...SET_ASIDE_ALIASES,
  ...REMOVED_STAR_SPAWN_CODES,
  UNDERSEA_VAULT_CODE,
])

function expand(cards) {
  return cards.sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
}

function groupDeck(groups, exclude = []) {
  const codes = encounterCodes(groups)
  const excluded = new Set(exclude)
  return expand(Object.entries(ALL_CARDS)
    .filter(([code]) => !excluded.has(code))
    .filter(([, card]) => codes.has(card.encounterCode))
    .filter(([, card]) => deckTypes.includes(card.type)))
}

export const ENCOUNTER_DECK = Object.freeze(groupDeck(ENCOUNTER_GROUPS, DECK_EXCLUDED))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 地点定义（规范（西线）层-列排布；相邻整层全互通）
// ---------------------------------------------------------------------------
const levelById = Object.fromEntries(LOCATION_TABLE.map(([id, , level]) => [id, level]))
const columnById = Object.fromEntries(LOCATION_TABLE.map(([id, , , column]) => [id, column]))
const LEVEL_GROUPS = Object.freeze(Object.fromEntries([1, 2, 3, 4, 5].map(level => [
  level, LOCATION_TABLE.filter(([id, , value]) => value === level).map(([id]) => id),
])))
export const LEVEL_GROUPS_BY_LEVEL = LEVEL_GROUPS

function connectionsByLevel(id) {
  const level = levelById[id]
  if (!level) return []
  return [...(LEVEL_GROUPS[level - 1] || []), ...(LEVEL_GROUPS[level + 1] || [])]
}

export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, level, column]) => [
  id,
  location({
    id, code,
    level: level ?? undefined,
    column: column ?? undefined,
    connections: connectionsByLevel(id),
    ...(code === UNDERSEA_VAULT_CODE ? { vault: true, revealed: true } : {}),
  }),
])))
export const LEVEL_BY_LOCATION = Object.freeze({ ...levelById })
export const COLUMN_BY_LOCATION = Object.freeze({ ...columnById })

// 桌面坐标（展示投影；运行期网格写入 mechanicState.grid）。
// 西线 = 向西下潜：层 2–5 在 y = -1..-4。
export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.filter(([, , level]) => level != null).map(([id, , level, column]) => [
    id, { x: column, y: level === 1 ? 0 : -(level - 1) },
  ]).concat([
    [UNDERSEA_VAULT_ID, { x: 4, y: -4 }],
    ['deadlyPass', { x: 3, y: -2 }],
    ['shallowDen', { x: 3, y: -3 }],
  ]),
))

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
const WEST_OBJECTIVE = Object.freeze({ type: 'custom', allAt: START_LOCATION_WEST, target: 'obsidianFoundations' })
const EAST_OBJECTIVE = Object.freeze({ type: 'custom', allAt: START_LOCATION_EAST, target: 'westernWall' })
export const ACT_STAGES = Object.freeze({
  west: Object.freeze({ ...stage(ACT_WEST_CODE, { number: 1 }), direction: 'west', objective: WEST_OBJECTIVE }),
  east: Object.freeze({ ...stage(ACT_EAST_CODE, { number: 1 }), direction: 'east', objective: EAST_OBJECTIVE }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze({ ...stage(AGENDA_CODE, { number: 1 }), floodedPaths: true, airDamage: 5 }),
})
export const ACTS = Object.freeze([structuredClone(ACT_STAGES.west)])
export const AGENDAS = Object.freeze([structuredClone(AGENDA_STAGES[1])])
export const STAGE_CARDS = Object.freeze(Object.fromEntries([
  [ACT_WEST_CODE, structuredClone(ACT_STAGES.west)],
  [ACT_EAST_CODE, structuredClone(ACT_STAGES.east)],
  [AGENDA_CODE, structuredClone(AGENDA_STAGES[1])],
]))

// 淹没初始值（相对「层」而不是相对卡片）：西线 2–5 层 +1、4–5 层再 +1；
// 东线 1–4 层 +1、1–2 层再 +1。
export const FLOOD_SETUP = Object.freeze({
  west: Object.freeze({ floodLevels: Object.freeze([2, 3, 4, 5]), fullyFloodLevels: Object.freeze([4, 5]) }),
  east: Object.freeze({ floodLevels: Object.freeze([1, 2, 3, 4]), fullyFloodLevels: Object.freeze([1, 2]) }),
})

// ---------------------------------------------------------------------------
// 剧情正文（忠实中译）
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale; narrative-guides story-text.js may supersede)',
  heading: '西墙',
  introWest: '西墙 1：随着你们继续向西，越来越清楚脚下这片海滩是一道古老环形城墙的顶部。'
    + '城墙下方数英寻处是直坠海底圆形广场的悬崖。只要计划周密，你们可以从古老遗迹中一处又一处的气囊下到海底。'
    + '小心行事，也许就能活着抵达海床。',
  introEast: '西墙 2：随着拉莱耶继续上升，古老城市不稳定的地基在颤抖。崩塌的砖石层与裸露的走廊构成一条通往水面的险路。'
    + '要安全攀上这面古墙，你们必须在聚气的空腔之间移动。深知减压病的危险，你们不能直接浮上水面。'
    + '小心行事，也许就能活着回到水面。',
  checkCampaignLog: '查看剧本日志。',
  doNoHarm: Object.freeze({
    title: '任务：不伤害他人',
    instructions: '只有当你拥有“不伤害他人”任务时才阅读。',
    body: '准备穿越城墙时，你发现黑沙上俯卧着一具躯体。那是个披着破旧拼布斗篷的男人。你压下“他怎么到这里来的”疑问，'
      + '走上前探他的脉搏。他还活着，但伤得很重。他的脖颈、手臂与胸口渗出黄色脓液的圆形吸盘伤痕。你尽力包扎伤口，'
      + '用嗅盐把他唤醒。他睁开眼，嘶哑地挤出一个词：“母亲。”你看向其他人。这人显然需要帮助。',
    choose: '你必须决定（选择一项）：',
    bringAlong: '“带上他。我们还能救他。”布置本剧本后，在议程上放置 1 个毁灭标记。在剧本日志中记录“远征队帮助了朝圣者”。',
    leaveBehind: '“把他留下。”在下一剧本揭示起始地点时，不要在该地点放置线索。在剧本日志中记录“远征队抛弃了朝圣者”。',
  }),
  setupSteps: Object.freeze({
    west: Object.freeze([
      { key: 'gatherSets', text: '收集西墙、宇宙遗产、深潜者、洪水、拉莱耶、星之眷族、穷途异魔、海底生物、克苏鲁的爪牙各组卡牌。' },
      { key: 'locations', text: '将黑曜石地基、淹没棚屋、沉没阶梯、破碎遗迹[tdc_rune_v]与水下秘库[tdc_rune_z]放到一边（场外）。' },
      { key: 'upperWalkways', text: '把其余五张险恶道路与放到一边的淹没棚屋、沉没阶梯、破碎遗迹混洗，将其中六张以未揭示面朝上放在西墙下方第 2–4 层。' },
      { key: 'actDeck', text: '使用幕 1a“下潜深渊”构筑幕牌库。将另一张幕移出游戏。' },
      { key: 'expeditionAsset', text: '按玩家顺序，每位玩家可以从“远征”遭遇组选择 1 张[[物品]]支援，在其控制下开始游戏。' },
      { key: 'bottomWalkways', text: '把剩余两张险恶道路与放到一边的黑曜石地基混洗（使你们不知道哪张是哪张），以未揭示面朝上放在第 5 层。' },
      { key: 'floodLevels', text: '提高第 2–5 层每处地点的淹没等级。' },
      { key: 'fullyFloodLevels', text: '提高第 4、5 层的淹没等级，使其完全淹没。' },
      { key: 'startAt', text: '每位调查员从西墙开始游戏。' },
      { key: 'setAside', text: '将穷途异魔敌人、猎食寄生虫弱点与双面海底壁画[tdc_rune_w]诡计放到一边。' },
      { key: 'coralStarSpawn', text: '从星之眷族组找出珊瑚星之眷族敌人放到一边。将星之眷族组其余卡牌移出游戏。' },
      { key: 'readyToBegin', text: '现在可以开始游戏了。' },
    ]),
    east: Object.freeze([
      { key: 'gatherSets', text: '收集西墙、宇宙遗产、深潜者、洪水、拉莱耶、星之眷族、穷途异魔、海底生物、克苏鲁的爪牙各组卡牌。' },
      { key: 'locations', text: '将西墙、淹没棚屋、沉没阶梯、破碎遗迹[tdc_rune_v]与水下秘库[tdc_rune_z]放到一边（场外）。' },
      { key: 'upperWalkways', text: '把其余五张险恶道路与放到一边的淹没棚屋、沉没阶梯、破碎遗迹混洗，将其中六张以未揭示面朝上放在黑曜石地基下方第 2–4 层。' },
      { key: 'actDeck', text: '使用幕 1a“攀上高墙”构筑幕牌库。将另一张幕移出游戏。' },
      { key: 'expeditionAsset', text: '按玩家顺序，每位玩家可以从已获得的[[文物]]支援或“远征”遭遇组的 1 张[[物品]]支援中选择 1 张，在其控制下开始游戏。' },
      { key: 'bottomWalkways', text: '把剩余两张险恶道路与放到一边的西墙混洗（使你们不知道哪张是哪张），以未揭示面朝上放在第 5 层。' },
      { key: 'floodLevels', text: '提高第 1–4 层每处地点的淹没等级。' },
      { key: 'fullyFloodLevels', text: '提高第 1、2 层的淹没等级，使其完全淹没。' },
      { key: 'startAt', text: '每位调查员从黑曜石地基开始游戏。' },
      { key: 'setAside', text: '将穷途异魔敌人、猎食寄生虫弱点与双面海底壁画[tdc_rune_w]诡计放到一边。' },
      { key: 'coralStarSpawn', text: '从星之眷族组找出珊瑚星之眷族敌人放到一边。将星之眷族组其余卡牌移出游戏。' },
      { key: 'readyToBegin', text: '现在可以开始游戏了。' },
    ]),
  }),
  specialRules: Object.freeze([
    Object.freeze({
      title: '西墙的地点相邻',
      body: '本剧本中，地点排列成固定的 5 层模式。每处地点都有自己的层级（西墙/黑曜石地基为第 1 层，向下到第 5 层）。'
        + '任何提及地点层级的效果都指其编号所在的行。本剧本中，每处地点与上一层和下一层的每处地点相连；同一层的地点彼此不相连。',
    }),
    Object.freeze({
      title: '挣扎呼吸',
      body: '当你的回合开始时，如果你位于一处完全淹没的地点：你挣扎着呼吸空气。当你的回合结束时，'
        + '如果你没有进入一处未淹没或部分淹没的地点、也没有降低你当前所在地点的淹没等级，受到 5 点直接伤害。',
    }),
  ]),
  rules: Object.freeze({
    locationAdjacency: '每处地点与上一层和下一层的每处地点相连；同层不连通。',
    struggleForAir: '完全淹没地点：回合开始记录；回合结束未离开或降低淹没则受 5 点直接伤害。',
  }),
  tokens: THE_WESTERN_WALL_TOKEN_MEANINGS,
  resolutions: Object.freeze({
    resolution1: '结局 1：海底是阴森植物与噩梦生物的幻景。在剧本日志中划掉拉莱耶地图上的“西墙”。'
      + '若某位调查员拥有“不伤害他人”任务，结算其对应剧情。每位调查员获得胜利区每张卡 Victory X 的经验。跳过至结局 3。',
    resolution2: '结局 2：古老城市的一阵震动把你们掀倒。露比咒骂着扶住一根倒下的柱子。在剧本日志中划掉拉莱耶地图上的“西墙”。'
      + '结算“不伤害他人”任务；获得经验；前往“沉睡者之墓”。',
    noResolution: '无结局（每位调查员都被击败）：在远征队其他人的帮助下，你们一瘸一拐地抵达目的地。'
      + '在剧本日志中划掉拉莱耶地图上的“西墙”。结算“不伤害他人”任务；获得经验；'
      + '如果远征队向西前进，跳过至结局 3，否则前往“沉睡者之墓”。',
    resolution3: '结局 3：海底一座古老圆顶诱人地闪烁着。你们必须决定：为了揭开海床圆顶的秘密，前往“淹没城区”；'
      + '或者继续进入拉莱耶地下，前往“养育场”。',
  }),
  resolutionBranches: Object.freeze({
    resolution3: Object.freeze([
      Object.freeze({ id: 'theDrownedQuarter', text: '为了揭开海床圆顶的秘密，前往《淹没城区》。' }),
      Object.freeze({ id: 'theApiary', text: '继续进入拉莱耶地下，前往《养育场》。' }),
    ]),
    doNoHarm: Object.freeze({
      helped: '如果远征队帮助了朝圣者，前往任务 1：找到放到一边的猎食寄生虫弱点并永久加入你的牌库（不计入牌库张数）；在“不伤害他人”下标记 2 点进度。',
      otherwise: '否则前往任务 2：你抛弃了需要帮助的人。承受 1 点精神创伤；在“不伤害他人”下擦除 1 点进度。',
    }),
  }),
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES,
  ...SET_ASIDE_ALIASES,
  SEAFLOOR_FRIEZE_CODE,
])
export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ...ACT_CODES, ...AGENDA_CODES,
  ...LOCATION_CODES, ...ENCOUNTER_DECK_CODES, ...SET_ASIDE_ALIASES,
  '11531b', '11532b', '11725', '11726', '11728',
].map(code => [code, ALL_CARDS[code]])))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '西墙 · The Western Wall',
  nameEn: 'The Western Wall',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.introWest,
  introBranches: { west: SCENARIO_TEXT.introWest, east: SCENARIO_TEXT.introEast },
  setup: SCENARIO_TEXT.setupSteps.west.map(step => step.text).join('\n\n'),
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  connectByRows: true,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionBranches: { ...SCENARIO_TEXT.resolutionBranches },
  tokenMeanings: THE_WESTERN_WALL_TOKEN_MEANINGS,
  setAsideAliases: [...SET_ASIDE_ALIASES],
  removedCodes: [...REMOVED_STAR_SPAWN_CODES],
  mechanics: {
    // 引擎 P7 原语：完全淹没地点回合开始挣扎呼吸（turn.js 读 mechanics.water.air）。
    // 层间邻接由 behavior 的 api.mechanics.map.configure({ adjacency: 'rows' }) 建立，
    // 不是 scenario.mechanics 字段（registry 只接受 water/keys/vehicles/calendar/codex/
    // residents/defenses/survey/noEncounterDeck/protectInvestigators/tdc）。
    water: { air: true, damage: 5 },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export default scenario
