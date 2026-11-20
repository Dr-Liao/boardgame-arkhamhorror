// 淹没城区（theDrownedQuarter · 提示卡 11536）· 章节数据（scenario 只含数据）。
//
// 权威来源：
//   Scenario/Scenarios/TheDrownedCity/TheDrownedQuarter.hs +
//   Act|Agenda|Location|Enemy|Story/CardDefs/TheDrownedCity/TheDrownedQuarter.hs +
//   各卡实现（Cards/TheDrownedCity/TheDrownedQuarter/*.hs）+
//   frontend/src/locales/en/theDrownedCity/theDrownedQuarter.json（印刷正文）+
//   src/cards/cards-data.js（简中卡名/卡文）。
//
// 本关三条特有口径：
//   1. 随机海床布局（Setup）：屏障核心（未激活面）放网格中心 (0,0)；随机移出 1 张
//      淹没卫城 + 1 张珊瑚礁；其余 8 张[[海底]]地点洗牌后放进 3×3 网格的 8 个环位。
//      地点均为双面（正面 = 独特地点，背面 = 海床）：入场所给的规则是「进入海床时
//      提高本地点与一处相邻地点的淹没等级」，所以起始全部**未揭示**，由进入时揭示。
//   2. 网格相邻即相连（幕 1 正面修正）：运行期由 `mechanics.map.place` 的正交邻接
//      自动写入 connections，因此章节静态 connections 为空，layout.edges 也为空。
//      屏障核心「未激活↔已激活」按已揭示且未淹没的[[海底]]地点数（≥6 / ≤5）翻面。
//   3. 供能改道：幕 1 背面按「是否有调查员控制屏障节点」分流结局 1 / 结局 2；
//      结局 2 记录 `thePowerWasDiverted`（后续由大秘库读取布置影响）。结局 3 收尾，
//      按 `theExpeditionHeadedWest` 决定下一章 theApiary / theWesternWall。
//
// 中文叙事：本地无官方中文源，本文件的 SCENARIO_TEXT 为本轮自译摘要；完整叙事由
// narrative-guides worker 的 story-text.js 提供，二者不冲突（本文件只承载模块自用的
// 提示文本，便于离线测试与指南面板兜底）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { DROWNED_QUARTER_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'theDrownedQuarter'
export const REFERENCE_CODE = '11536'
export const ENCOUNTER_CODE = 'the_drowned_quarter'

// ---------------------------------------------------------------------------
// 通用（印刷数据取自卡表，不抄第二事实源）
// ---------------------------------------------------------------------------
function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown The Drowned Quarter card: ${code}`)
  return {
    code, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    subname: card.subnameZh || card.subname || '',
    text: card.textZh || card.text || '', textEn: card.text || '',
    type: card.type, traits: [...(card.traits || [])],
    ...(card.backText || card.backTextZh ? { backText: card.backTextZh || card.backText } : {}),
  }
}

function location(data) {
  const { id, code, cluesFixed, hasVictory, victory, clues, connected = [], ...rest } = data
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown The Drowned Quarter location: ${code}`)
  return {
    ...printed(code), id, shroud: card.shroud, connections: [...connected], ...rest,
    ...(cluesFixed ? { cluesFixed: clues } : { cluesPerInvestigator: clues ?? card.clues ?? 0 }),
    ...(hasVictory ? { victory: victory ?? card.victory ?? 1 } : {}),
    ...(card.backText || card.backName ? {
      unrevealedName: card.backNameZh || card.backName || '海床',
      unrevealedNameEn: card.backName || 'Sea Floor',
    } : {}),
  }
}

function stage(code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown The Drowned Quarter stage: ${code}`)
  const { doom, stage: number, ...rest } = extra
  return {
    ...printed(code), id: `${card.type}${code}`, type: card.type, stage: `${number ?? card.stage ?? 1}a`,
    reveal: { type: 'campaignRule' }, ...rest,
    ...(card.type === 'agenda' ? { doomThreshold: doom ?? card.doom } : {}),
  }
}

function encounterDefinitions(codes) {
  const enemies = {}
  const treacheries = {}
  const storyAssets = {}
  for (const code of new Set(codes)) {
    const card = ALL_CARDS[code]
    if (!card) throw new RangeError(`Unknown encounter definition: ${code}`)
    const base = printed(code)
    if (card.type === 'enemy') {
      const text = card.text || ''
      const keywords = String(text).split('\n').join(' ')
      enemies[code] = {
        ...base, surge: /^Surge\./m.test(text), fight: card.fight ?? null, evade: card.evade ?? null,
        health: card.health ?? null, damage: card.damage || 0, horror: card.horror || 0,
        ...(card.healthPerInvestigator ? { healthPerInvestigator: true } : {}),
        ...(Object.hasOwn(card, 'victory') ? { victory: card.victory } : {}),
        ...Object.fromEntries(['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert', 'Patrol']
          .filter(keyword => new RegExp(`\\b${keyword}`).test(keywords))
          .map(keyword => [keyword.toLowerCase(), true])),
        elite: (card.traits || []).includes('Elite'),
      }
    } else if (card.type === 'treachery') {
      treacheries[code] = { ...base, entryRevelation: true, surge: /^Surge\./m.test(card.text || '') }
    } else if (card.type === 'story' || card.type === 'asset') {
      storyAssets[code] = { ...base, ...(card.type === 'asset' ? {
        slots: [...(card.slots || [])],
        ...(card.health != null ? { health: card.health } : {}),
        ...(card.sanity != null ? { sanity: card.sanity } : {}),
      } : { global: false }) }
    }
  }
  return { enemies, treacheries, storyAssets }
}

function identitiesFor(scenario) {
  const identity = value => ({
    originalCode: value.originalCode || value.code,
    artCode: value.originalCode || value.code,
    ...(value.linkedCode ? { linkedOriginalCode: value.linkedCode } : {}),
  })
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas']
    .map(category => [category,
      Object.fromEntries(Object.values(scenario[category] || {}).map(value => [value.id || value.code, identity(value)]))]))
}

// ---------------------------------------------------------------------------
// 幕 / 议程 / 结局键
// ---------------------------------------------------------------------------
export const ACT_CODES = Object.freeze(['11539'])
export const AGENDA_CODES = Object.freeze(['11537', '11538'])
export const ACT1_CODE = ACT_CODES[0]
export const AGENDA1_CODE = AGENDA_CODES[0]
export const AGENDA2_CODE = AGENDA_CODES[1]
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3'])
export const RESOLUTION_CHAIN = Object.freeze({
  noResolution: Object.freeze(['noResolution', 'resolution3']),
  resolution1: Object.freeze(['resolution1', 'resolution3']),
  resolution2: Object.freeze(['resolution2', 'resolution3']),
  resolution3: Object.freeze(['resolution3']),
})

// 下一章按「远征方向」记录决定（西 → 养育场；东 → 西墙）。
export const NEXT_SCENARIO_IDS = Object.freeze({
  west: 'theApiary',
  east: 'theWesternWall',
})

// ---------------------------------------------------------------------------
// 地点（真实卡号身份；同卡多份 / 双面 / 二选一都建独立实例 id）
// ---------------------------------------------------------------------------
export const START_LOCATION = 'barrierCore'

// 屏障核心：11540 未激活 / 11540b 已激活（同一物理卡两面）。
export const BARRIER_CORE_INACTIVE_CODE = '11540'
export const BARRIER_CORE_ACTIVE_CODE = '11540b'
export const BARRIER_CORE_ACTIVE = 'barrierCoreActive'
export const BARRIER_CORE_INACTIVE = 'barrierCoreInactive'

// [[海底]]地点：8 张入场候选（3 张深渊沟壑 + 淹没卫城二选一 + 残破遗迹两张 +
// 珊瑚礁二选一 + 古代展廊）。二选一的地点两张都声明，Setup 随机移出其中一张。
export const SEA_FLOOR_TABLE = Object.freeze([
  Object.freeze(['abyssalTrench1', '11541', 'abyssalTrench', Object.freeze([])]),
  Object.freeze(['abyssalTrench2', '11541', 'abyssalTrench', Object.freeze([])]),
  Object.freeze(['abyssalTrench3', '11541', 'abyssalTrench', Object.freeze([])]),
  Object.freeze(['acropolisEphemeral', '11542', 'acropolis', Object.freeze([])]),
  Object.freeze(['acropolisCollapsed', '11543', 'acropolis', Object.freeze([])]),
  Object.freeze(['blastedSunkenCircle', '11544', 'blastedRuins', Object.freeze([])]),
  Object.freeze(['blastedCrumbling', '11545', 'blastedRuins', Object.freeze([])]),
  Object.freeze(['coralStatuaryGarden', '11546', 'coralReef', Object.freeze([])]),
  Object.freeze(['coralFeedingGrounds', '11547', 'coralReef', Object.freeze([])]),
  Object.freeze(['ancientGallery', '11548', 'ancientGallery', Object.freeze([])]),
])
export const SEA_FLOOR_POOL_IDS = Object.freeze(SEA_FLOOR_TABLE.map(([id]) => id))
export const SEA_FLOOR_EXCLUSIVE_PAIRS = Object.freeze([
  Object.freeze(['acropolisEphemeral', 'acropolisCollapsed']),
  Object.freeze(['coralStatuaryGarden', 'coralFeedingGrounds']),
])
export const SEA_FLOOR_IN_PLAY_COUNT = 8

// 3×3 网格：屏障核心居中 (0,0)，8 个环位（Haskell Setup 的 Pos 列表顺序）。
export const SEA_FLOOR_CELLS = Object.freeze([
  Object.freeze({ x: -1, y: 1 }), Object.freeze({ x: 0, y: 1 }), Object.freeze({ x: 1, y: 1 }),
  Object.freeze({ x: -1, y: 0 }), Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: -1, y: -1 }), Object.freeze({ x: 0, y: -1 }), Object.freeze({ x: 1, y: -1 }),
])
export const BARRIER_CORE_CELL = Object.freeze({ x: 0, y: 0 })

// 桌面展示坐标：入场地点固定 8 个环位；二选一的另一面与它共用槽位（只会有一张入场）。
export const LOCATION_COORDINATES = Object.freeze({
  barrierCore: Object.freeze({ x: 0, y: 0 }),
  abyssalTrench1: Object.freeze({ x: -1, y: 1 }),
  abyssalTrench2: Object.freeze({ x: 0, y: 1 }),
  abyssalTrench3: Object.freeze({ x: 1, y: 1 }),
  acropolisEphemeral: Object.freeze({ x: -1, y: 0 }),
  acropolisCollapsed: Object.freeze({ x: -1, y: 0 }),
  blastedSunkenCircle: Object.freeze({ x: -1, y: -1 }),
  blastedCrumbling: Object.freeze({ x: 0, y: -1 }),
  coralStatuaryGarden: Object.freeze({ x: 1, y: 0 }),
  coralFeedingGrounds: Object.freeze({ x: 1, y: 0 }),
  ancientGallery: Object.freeze({ x: 1, y: -1 }),
})

// 静态 connections 为空：连接来自运行期网格邻接（幕 1 正面「每处地点与相邻地点相连」）。
const locationRows = [
  ['barrierCore', BARRIER_CORE_INACTIVE_CODE, {
    linkedCode: BARRIER_CORE_ACTIVE_CODE, clues: 1, central: true,
    // 未激活面印刷「每名调查员 1 条线索」；已激活面 0 条（行为在翻面时重算）。
    face: 'inactive',
  }],
]
for (const [id, code] of SEA_FLOOR_TABLE) {
  locationRows.push([id, code, { seaFloor: true, unrevealed: true }])
}

export const LOCATIONS = Object.freeze(Object.fromEntries(locationRows.map(([id, code, extra]) => {
  const card = ALL_CARDS[code]
  const data = location({
    id, code, clues: card.clues ?? 0, connected: [], ...extra,
    printedName: card.nameZh || card.name,
    printedTraits: [...(card.traits || [])],
  })
  if (id === START_LOCATION) Object.assign(data, { resign: false, revealed: true, start: true })
  return [id, data]
})))
export const LOCATION_IDS = Object.freeze(Object.keys(LOCATIONS))

// ---------------------------------------------------------------------------
// 放一边（Setup）：屏障节点、双面水下寄生虫、双面黑曜石遗物
// ---------------------------------------------------------------------------
export const ENEMY_CODES = Object.freeze(['11549', '11551', '11537b'])
export const UNDESEA_PARASITE_CODE = '11549'
export const UNDESEA_PARASITE_STORY_CODE = '11549b'
export const MEDUSA_CODE = '11551'
export const SEAFLOOR_LEVIATHAN_CODE = '11537b'
export const OBSIDIAN_RELIC_CODE = '11550'
export const OBSIDIAN_RELIC_STORY_CODE = '11550b'
export const BARRIER_NODE_CODE = '11552'
export const SET_ASIDE_ENEMY_CODES = Object.freeze([UNDESEA_PARASITE_CODE, SEAFLOOR_LEVIATHAN_CODE])
export const SET_ASIDE_ASSET_CODES = Object.freeze([OBSIDIAN_RELIC_CODE, BARRIER_NODE_CODE])
export const SET_ASIDE_CARDS = Object.freeze([
  BARRIER_NODE_CODE, UNDESEA_PARASITE_CODE, OBSIDIAN_RELIC_CODE,
])
export const SET_ASIDE_ALIASES = Object.freeze([...SET_ASIDE_CARDS])

// ---------------------------------------------------------------------------
// 遭遇牌库（8 组）：地点/幕/议程/剧情资产不进牌库；水下寄生虫放一边；
// 海底利维坦是议程 1 的背面（由议程翻面生成），也不进牌库。
// ---------------------------------------------------------------------------
const snake = value => String(value)
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .toLowerCase()
const cardsOfGroups = groups => {
  const codes = new Set(groups.map(snake))
  return Object.entries(ALL_CARDS).filter(([, card]) => codes.has(card.encounterCode))
}
const deckCardTypes = ['enemy', 'treachery']
const expand = rows => rows
  .sort(([left], [right]) => left.localeCompare(right))
  .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))

export const GATHER_GROUPS = Object.freeze([
  'theDrownedQuarter', 'alienMachinery', 'cosmicLegacy', 'deepOnes',
  'elderMist', 'tdcFlood', 'rlyeh', 'underseaCreatures',
])
// 不进遭遇牌库的组内卡：放一边的敌人 + 议程背面敌人。
export const ENCOUNTER_DECK_EXCLUDE = Object.freeze([
  UNDESEA_PARASITE_CODE, SEAFLOOR_LEVIATHAN_CODE,
])
export const ENCOUNTER_DECK = Object.freeze(expand(cardsOfGroups(GATHER_GROUPS)
  .filter(([, card]) => deckCardTypes.includes(card.type))
  .filter(([code]) => !ENCOUNTER_DECK_EXCLUDE.includes(code))))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 遭遇定义（数值/关键词取印刷数据）
// ---------------------------------------------------------------------------
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES,
  ...ENEMY_CODES,
  UNDESEA_PARASITE_STORY_CODE,
  ...SET_ASIDE_ASSET_CODES,
  OBSIDIAN_RELIC_STORY_CODE,
])
// 海底利维坦：+3 生命/每名调查员（卡表没有该字段，行为生成时补）。
if (definitions.enemies[SEAFLOOR_LEVIATHAN_CODE]) {
  Object.assign(definitions.enemies[SEAFLOOR_LEVIATHAN_CODE], { healthPerInvestigatorBonus: 3 })
}
// 屏障节点：不能击败/离场、回合开始自愈 1 点、集齐 5 枚字形 +2 生命（行为读点）。
if (definitions.storyAssets[BARRIER_NODE_CODE]) {
  Object.assign(definitions.storyAssets[BARRIER_NODE_CODE], {
    cannotLeavePlay: true, healPerTurn: 1, glyphLine: ['q', 'x', 'g', 'k', 's'], glyphHealthBonus: 2,
  })
}

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(ACT1_CODE),
    // 幕 1 正面：每处地点与相邻地点相连；[fast] 团队花费 1/人线索降低你所在地点淹没等级。
    gridConnections: true,
    fastAction: { kind: 'decreaseFloodAtYourLocation', groupCluesPerInvestigator: 1 },
    // 目标：一轮结束时，每位未击败调查员都在屏障核心（已激活）。
    objective: { type: 'allAtBarrierCoreActive', atRoundEnd: true },
  }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(AGENDA1_CODE, { doom: 7 }),
    // 正面 = 战斗空气（mechanics.water.air 读点）；背面 = 生成海底利维坦。
    air: true,
    backSpawns: SEAFLOOR_LEVIATHAN_CODE,
  }),
  2: Object.freeze({
    ...stage(AGENDA2_CODE, { doom: 7 }),
    air: true,
    backDefeatsAll: true,
  }),
})
export const ACTS = Object.freeze([structuredClone(ACT_STAGES[1])])
export const AGENDAS = Object.freeze([
  structuredClone(AGENDA_STAGES[1]), structuredClone(AGENDA_STAGES[2]),
])
export const STAGE_CARDS = Object.freeze(Object.fromEntries([
  [ACT1_CODE, structuredClone(ACT_STAGES[1])],
  [AGENDA1_CODE, structuredClone(AGENDA_STAGES[1])],
  [AGENDA2_CODE, structuredClone(AGENDA_STAGES[2])],
]))

// ---------------------------------------------------------------------------
// 剧情正文（自译摘要；完整叙事见 story-text.js）
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'self-translated summary (printed en in locale; full story via narrative-guides worker)',
  heading: '淹没城区',
  intro: '电火噼啪作响，你进入海底穹顶。圆形广场被淹没的沟壑与崩塌的废墟覆盖，'
    + '目光总被异星屏障外的海水吸引：一群水母在幽暗深处悠然漂浮。屏障一旦消失，远征队必被卷走。',
  introBranches: Object.freeze({
    headedWest: '远征队向西：安迪指向广场中央的圆形结构——正是能量场的源头。'
      + '其内部是一台旋转的浑天仪，核心锁着一颗炽白球体。「它在给机器供能。我不知道取走它会怎样……」',
    headedEast: '远征队向东：你们循着光芒来到能量场的源头。内部是一台旋转的浑天仪，核心锁着一颗炽白球体。'
      + '鲁比咂舌：「这是某种泵站，那颗球是它的一部分。偷走它，海水大概会当头砸下来。」',
  }),
  setupSteps: Object.freeze([
    Object.freeze({ key: 'gatherSets', text: '收集遭遇组：淹没城区、异界机械、宇宙遗产、深潜者、古老迷雾、洪水、拉莱耶、海底生物。' }),
    Object.freeze({ key: 'placeBarrierCore', text: '把屏障核心（未激活面朝上）放入场地。' }),
    Object.freeze({ key: 'gatherSeaFloorLocations', text: '收集全部[[海底]]地点，随机将 1 张珊瑚礁与 1 张淹没卫城移出游戏。' }),
    Object.freeze({ key: 'placeSeaFloorLocations', text: '把其余 8 张[[海底]]地点洗混，按布置图放进屏障核心周围的 3×3 网格（未揭示）。' }),
    Object.freeze({ key: 'beginAtBarrierCore', text: '每位调查员从屏障核心开始游戏。' }),
    Object.freeze({ key: 'setCardsAside', text: '把屏障节点剧情支援、双面水下寄生虫[tdc_rune_x]、双面黑曜石遗物[tdc_rune_y]放在一边。' }),
    Object.freeze({ key: 'chooseExpeditionAsset', text: '按玩家顺序，每名玩家可选择 1 张已获得的[[神器]]或[[物品]]（远征遭遇组）开始在场。' }),
    Object.freeze({ key: 'addFloodTokens', text: '把淹没标记加入标记池并查看剧本日志。' }),
    Object.freeze({ key: 'headedEast', text: '若远征队向东：上升的城市震动了穹顶，提高 1/每名调查员处[[海底]]地点的淹没等级。', when: 'headedEast' }),
    Object.freeze({ key: 'buildEncounterDeck', text: '把其余遭遇卡洗混成遭遇牌库。' }),
    Object.freeze({ key: 'readyToBegin', text: '准备开始。' }),
  ]),
  layoutRules: Object.freeze({
    grid: '每处地点与相邻的每处地点相连。',
    air: '强制 - 你的回合开始时，如果你位于完全淹没的地点：你挣扎着呼吸空气。你的回合结束时，'
      + '如果你未进入一处未淹没或部分淹没的地点，且未降低你所在地点的淹没等级，受到 5 点直接伤害。',
  }),
  resolutions: Object.freeze({
    noResolution: Object.freeze({
      title: '无结局',
      body: '你们穿过穹顶入口，回望幽暗的海底。海水在几秒内重新吞没了异星穹顶，你们没被卷走已是小小的奇迹。'
        + '失败分散了你们的注意力：每位调查员必须尽量擦除其任务下的 1 点进度。',
    }),
    resolution1: Object.freeze({
      title: '结局 1',
      body: '奇异的节点在手中脉动，投出一层柔和的光泡，挡住坠落的碎石。你们在穹顶如泡影般崩裂前冲出入口。'
        + '一阵细微刺痛传来，节点钻入你的掌心，蛛网状的黑发丝在皮下蔓延，又在拔出节点时无痛地缩回。'
        + '蒂林哈斯特一定会为这件发现欣喜。在剧本日志「已获得的神器」中勾选「屏障节点」。',
    }),
    resolution2: Object.freeze({
      title: '结局 2',
      body: '重新激活的核心在几分钟内抽干了淹没穹顶的海水。你们随远征队巡视这座沉没遗迹的边界，惊叹于它的古老壮丽。'
        + '在剧本日志中记录「供能被改道」。每名调查员因细致研究淹没城区获得 2 点奖励经验。',
    }),
    resolution3: Object.freeze({
      title: '结局 3',
      body: '通往城市的那条隧道外的能量场依旧稳固。拉莱耶参差的地基仍在崩落。是时候继续前进了。'
        + '在剧本日志中把「淹没城区」从拉莱耶地图上划掉；每名调查员获得胜利区每张卡 Victory X 值的经验。',
    }),
  }),
  tokens: DROWNED_QUARTER_TOKEN_MEANINGS,
})

// ---------------------------------------------------------------------------
// scenario
// ---------------------------------------------------------------------------
export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '淹没城区 · The Drowned Quarter',
  nameEn: 'The Drowned Quarter',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: [
    { title: '网格相邻', body: SCENARIO_TEXT.layoutRules.grid },
    { title: '挣扎呼吸空气', body: SCENARIO_TEXT.layoutRules.air },
  ],
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  setAsideCards: [...SET_ASIDE_CARDS],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionChain: { ...RESOLUTION_CHAIN },
  nextScenarioIds: { ...NEXT_SCENARIO_IDS },
  tokenMeanings: DROWNED_QUARTER_TOKEN_MEANINGS,
  // 引擎读点：完全淹没地点的「挣扎呼吸空气」由 mechanics.water.air 承担（turn.js /
  // turn-flow.js / flood.js）；网格正交邻接由 behavior.setupLocations 的 map.place 建立。
  mechanics: {
    // 正交邻接由 behavior.setupLocations 的 api.mechanics.map.place 建立（P7 原语），
    // 不是 scenario.mechanics 字段。
    water: { air: true, damage: 5 },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE,
  ...ACT_CODES, ...AGENDA_CODES,
  ...LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...LOCATION_IDS.map(id => LOCATIONS[id].linkedCode).filter(Boolean),
  ...ENCOUNTER_DECK_CODES,
  ...ENEMY_CODES, UNDESEA_PARASITE_STORY_CODE,
  ...SET_ASIDE_ASSET_CODES, OBSIDIAN_RELIC_STORY_CODE,
].map(code => [code, ALL_CARDS[code]])))
