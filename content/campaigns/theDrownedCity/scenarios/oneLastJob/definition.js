// 金盆洗手（oneLastJob · 提示卡 11501，The Drowned City 十循环第七章）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/TheDrownedCity/OneLastJob.hs +
//   Act|Agenda|Location|Enemy|Treachery/CardDefs/TheDrownedCity/OneLastJob.hs +
//   Act|Agenda|Location|Enemy|Treachery/Cards/TheDrownedCity/OneLastJob/*.hs +
//   Location/CardDefs/NightOfTheZealot/TheMidnightMasks.hs（阿卡姆地点）+
//   frontend/src/locales/en/theDrownedCity/oneLastJob.json（印刷文本）。
//
// 卡号归属：11502–11504b/11505b/11506–11516 共 17 张专属卡（11501 是提示卡本身，不建条目）；
// 专属组 one_last_job；另 gather Dreams / Chilling Cold / Locked Doors / Rats / Striking Fear，
// 以及 The Midnight Masks 的**地点卡**（01124–01134，只取地点不取幕/议程/诡计）。
//
// 本关三条特有口径：
//   1. 幕 1 两版二选一（11504 Hibbs 线 / 11505 La Bella Luna 线，Setup 随机）。
//      两版共用幕 3（11508）；另一版幕 2 与对应酒馆地点移出游戏（运行时随机，静态声明
//      只给默认 Hibbs 线，见 behavior.variant）。
//   2. 阿卡姆地点按印刷连接图标相连；Tillinghast Esoterica（11509）与其右侧的
//      Miskatonic University 相连（Haskell connectBothWays）。Downtown 有两张，
//      Setup 随机留一张：本实现固定按参考后端使用 01130（First Bank），01131 移出游戏。
//   3. 混乱袋没有 [cultist] 标记（战役 ChaosBag.hs），提示卡只印 skull/tablet/elder_thing。
//
// 剧情/指南正文由 narrative-guides worker 的 story-text.js / 指南生成物提供；本文件内
// SCENARIO_TEXT 只放布置步骤与结局的忠实中译，方便设置面板在指南落地前可用。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { ONE_LAST_JOB_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'oneLastJob'
export const REFERENCE_CODE = '11501'
export const ENCOUNTER_CODE = 'one_last_job'

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export const ACT1_V1_CODE = '11504' // Questioning the Gangs（Hibb's 线）
export const ACT1_V2_CODE = '11505' // Questioning the Gangs（La Bella Luna 线）
export const ACT2_SHELDON_CODE = '11506' // The Sheldon Gang
export const ACT2_OBANNION_CODE = '11507' // The O'Bannion Gang
export const ACT3_CODE = '11508' // Face the Music
export const ACT_CODES = Object.freeze([ACT1_V1_CODE, ACT2_SHELDON_CODE, ACT3_CODE])
export const ALT_ACT_CODES = Object.freeze([ACT1_V2_CODE, ACT2_OBANNION_CODE, ACT3_CODE])
export const ACT2_CODE_BY_ACT1 = Object.freeze({
  [ACT1_V1_CODE]: ACT2_SHELDON_CODE,
  [ACT1_V2_CODE]: ACT2_OBANNION_CODE,
})
export const LINKED_LOCATION_BY_ACT1 = Object.freeze({
  [ACT1_V1_CODE]: 'hibbsRoadhouse',
  [ACT1_V2_CODE]: 'laBellaLuna',
})
export const AGENDA_CODES = Object.freeze(['11502', '11503'])
export const AGENDA1_CODE = '11502' // Arkham Nightlife
export const AGENDA2_CODE = '11503' // Long Night
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1'])

// ---------------------------------------------------------------------------
// gather 组
// ---------------------------------------------------------------------------
// The Midnight Masks 只取地点（arkham 组的诡计不进遭遇牌库），故单独列出。
export const ENCOUNTER_GROUPS = Object.freeze([
  'oneLastJob', 'dreams', 'chillingCold', 'lockedDoors', 'rats', 'strikingFear',
])
export const LOCATION_GROUP = 'theMidnightMasks'
export const MIDNIGHT_MASKS_CODE = '01120'

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
export const START_LOCATION = 'tillinghastEsoterica'

// [id, 真实卡号, 连接, 额外字段]
// 连接依据印刷连接图标：Northside(T)↔Miskatonic(Diamond)/Downtown(Triangle)；
// Downtown(Triangle)↔Easttown(Moon)；Easttown(Moon)↔Rivertown(Circle)；
// Miskatonic(Diamond)↔Rivertown(Circle)；Tillinghast↔Miskatonic（卡背）；
// Hibb's Roadhouse↔Easttown、La Bella Luna↔Downtown（卡面印刷）。
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['tillinghastEsoterica', '11509', Object.freeze(['miskatonicUniversity']), Object.freeze({ resign: true })]),
  Object.freeze(['miskatonicUniversity', '01129', Object.freeze(['tillinghastEsoterica', 'northside', 'rivertown']), null]),
  Object.freeze(['northside', '01134', Object.freeze(['miskatonicUniversity', 'downtown']), null]),
  Object.freeze(['downtown', '01130', Object.freeze(['northside', 'easttown', 'laBellaLuna']), null]),
  Object.freeze(['easttown', '01132', Object.freeze(['downtown', 'rivertown', 'hibbsRoadhouse']), null]),
  Object.freeze(['rivertown', '01125', Object.freeze(['easttown', 'miskatonicUniversity']), null]),
  Object.freeze(['hibbsRoadhouse', '11504b', Object.freeze(['easttown']), null]),
  Object.freeze(['laBellaLuna', '11505b', Object.freeze(['downtown']), null]),
])
export const START_LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
export const LINKED_LOCATION_IDS = Object.freeze(['hibbsRoadhouse', 'laBellaLuna'])
export const SETUP_LOCATION_IDS = Object.freeze(
  START_LOCATION_IDS.filter(id => !LINKED_LOCATION_IDS.includes(id)))

// Setup 从游戏中移除的 Midnight Masks 地点（St. Mary's / 南区两张 / 你的房子 /
// 另一张 Downtown）。本实现固定 Downtown = 01130 在场上，01131 移出。
export const REMOVED_LOCATION_CODES = Object.freeze(['01124', '01126', '01127', '01128', '01131'])

// 桌面坐标：三行（上行 = 幕 1 背面才入场的两间酒馆，中行阿卡姆街区，下行密所一线）。
export const LOCATION_COORDINATES = Object.freeze({
  laBellaLuna: { x: 1, y: 0 },
  hibbsRoadhouse: { x: 2, y: 0 },
  northside: { x: 0, y: 1 },
  downtown: { x: 1, y: 1 },
  easttown: { x: 2, y: 1 },
  tillinghastEsoterica: { x: 0, y: 2 },
  miskatonicUniversity: { x: 1, y: 2 },
  rivertown: { x: 2, y: 2 },
})

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
    backText: c.backTextZh || c.backText || '', backTextEn: c.backText || '',
    type: c.type, traits: [...(c.traits || [])],
    ...(c.victory != null ? { victory: c.victory } : {}),
  }
}

export function location(data) {
  const { id, code, cluesFixed, clues, victory, hasVictory, connections, ...rest } = data
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown One Last Job location: ${code}`)
  return {
    ...printed(code), id, shroud: c.shroud,
    connections: [...(connections || [])],
    ...rest,
    ...(cluesFixed ? { cluesFixed } : { cluesPerInvestigator: clues ?? c.clues ?? 0 }),
    ...(hasVictory ? { victory: victory ?? c.victory ?? 0 } : (c.victory != null ? { victory: c.victory } : {})),
    unrevealedName: c.backNameZh || c.backName || c.nameZh || c.name,
    unrevealedNameEn: c.backName || c.name,
  }
}

export function stage(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown One Last Job stage: ${code}`)
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
  'Most cards in hand': 'mostCardsInHand',
  'Fewest cards in hand': 'fewestCardsInHand',
  'Highest [agility]': 'highestAgility',
  'Lowest [agility]': 'lowestAgility',
  'Highest [willpower]': 'highestWillpower',
  'Lowest [willpower]': 'lowestWillpower',
  'Bearer only': 'bearer',
  'Most damage': 'mostDamage',
  'Most horror': 'mostHorror',
})

export function encounterDefinitions(codes) {
  const enemies = {}, treacheries = {}, storyAssets = {}
  for (const code of new Set(codes)) {
    const c = ALL_CARDS[code]
    if (!c) throw new RangeError(`Unknown One Last Job encounter definition: ${code}`)
    const base = printed(code)
    if (c.type === 'enemy') {
      const keywords = String(c.text || '')
      const preyText = /Prey - ([^.]+)\./.exec(String(c.text || ''))?.[1]?.trim()
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
    } else if (c.type === 'story') {
      storyAssets[code] = { ...base, global: true }
    } else if (c.type === 'asset') {
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
// 遭遇牌库
// ---------------------------------------------------------------------------
const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const encounterCodes = groups => new Set(groups.map(snake))
const deckTypes = ['enemy', 'treachery']

// 放一边：三张幕 2/3 与三名帮派头目/执行者（Setup「Set aside ...」）。
export const SET_ASIDE_ALIASES = Object.freeze([
  ACT2_SHELDON_CODE, ACT2_OBANNION_CODE, ACT3_CODE,
  '11510', '11511', '11513', '11513',
])
const SET_ASIDE_ENEMY_CODES = Object.freeze(['11510', '11511', '11513'])

function expand(cards) {
  return cards
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
}

function groupDeck(groups, exclude = []) {
  const codes = encounterCodes(groups)
  const excluded = new Set(exclude)
  return expand(Object.entries(ALL_CARDS)
    .filter(([code, card]) => !excluded.has(code))
    .filter(([, card]) => codes.has(card.encounterCode))
    .filter(([, card]) => deckTypes.includes(card.type)))
}

export const ENCOUNTER_GROUPS_SNAKE = Object.freeze(ENCOUNTER_GROUPS.map(snake))
export const ENCOUNTER_DECK = Object.freeze(groupDeck(ENCOUNTER_GROUPS, SET_ASIDE_ENEMY_CODES))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({ ...stage(ACT1_V1_CODE, { number: 1 }), objective: { type: 'custom', clueThreshold: 2, plusPerInvestigator: 1 } }),
  2: Object.freeze({ ...stage(ACT2_SHELDON_CODE, { number: 2 }), objective: { type: 'custom', bossDamageOrClues: 3 } }),
  3: Object.freeze({ ...stage(ACT3_CODE, { number: 3 }), objective: { type: 'custom', eliteInVictory: 1 } }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze({ ...stage(AGENDA1_CODE, { number: 1 }), arkhamLastClue: true }),
  2: Object.freeze({ ...stage(AGENDA2_CODE, { number: 2 }), arkhamLastClue: true }),
})
export const ACTS = Object.freeze([structuredClone(ACT_STAGES[1]), structuredClone(ACT_STAGES[2]), structuredClone(ACT_STAGES[3])])
export const AGENDAS = Object.freeze([structuredClone(AGENDA_STAGES[1]), structuredClone(AGENDA_STAGES[2])])
export const STAGE_CARDS = Object.freeze(Object.fromEntries([
  [ACT1_V1_CODE, structuredClone(ACT_STAGES[1])],
  [ACT1_V2_CODE, structuredClone({ ...stage(ACT1_V2_CODE, { number: 1 }), objective: ACT_STAGES[1].objective })],
  [ACT2_SHELDON_CODE, structuredClone(ACT_STAGES[2])],
  [ACT2_OBANNION_CODE, structuredClone({ ...stage(ACT2_OBANNION_CODE, { number: 2 }), objective: ACT_STAGES[2].objective })],
  [ACT3_CODE, structuredClone(ACT_STAGES[3])],
  [AGENDA1_CODE, structuredClone(AGENDA_STAGES[1])],
  [AGENDA2_CODE, structuredClone(AGENDA_STAGES[2])],
]))

// ---------------------------------------------------------------------------
// 地点定义
// ---------------------------------------------------------------------------
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, connections, extra]) => {
  const card = ALL_CARDS[code]
  return [id, location({
    id, code,
    connections,
    ...extra,
    ...(id === START_LOCATION ? { revealed: true } : {}),
    ...(card.victory != null ? { hasVictory: true } : {}),
  })]
})))

// ---------------------------------------------------------------------------
// 剧情正文（忠实中译；narrative-guides 落地后可由 story-text.js 覆盖）
// ---------------------------------------------------------------------------
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale; narrative-guides story-text.js may supersede)',
  heading: '金盆洗手',
  intro: '你在闪烁的路灯下等候，忍住春夜寒风。今晚是你为本地古玩商兰德尔·蒂林哈斯特效力的最后一夜。'
    + '这位古物商从新奥尔良发来的最新一批货物失踪了，他让你把它找回来。这是你为这个狡猾老头做的又一件危险、'
    + '往往见不得光的“差事”。今晚的报酬几乎足以还清你欠蒂林哈斯特的余债。',
  introBranches: Object.freeze({
    wendy: '若你扮演温蒂·亚当斯：安迪说：“如果我们要进帮派地盘，你最好别做傻事。这票干完，我们就有足够的钱去找你父亲了。我保证。”',
  }),
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集以下遭遇组的全部卡牌：金盆洗手、梦境、刺骨严寒、上锁的门、午夜假面、鼠群、惊惧。'
      + '收集中夜假面组时只取地点卡，不要取该组的幕、议程与诡计。' },
    { key: 'locations', text: '从游戏中移除以下地点：圣玛丽医院、南区（两张）、你的房子，以及两张商业区中随机一张。' },
    { key: 'placeLocations', text: '将其余每个地点放置入场。' },
    { key: 'startAt', text: '每位调查员从蒂林哈斯特密所开始游戏。' },
    { key: 'actDeck', text: '从两张幕 1a“盘问帮派”中随机选取一张构筑幕牌库。将两张幕 2 和幕 3 放到一边（场外）。' },
    { key: 'setAside', text: '将萨迪·谢尔顿、内奥米·欧巴尼恩与两张帮派执行者放到一边。' },
    { key: 'readyToBegin', text: '现在可以开始游戏了。' },
  ]),
  rules: Object.freeze({
    locationAdjacency: '阿卡姆地点按卡面印刷的连接图标相连；蒂林哈斯特密所与其右侧的地点相连。',
  }),
  tokens: ONE_LAST_JOB_TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '没有达成任何结局（每位调查员都撤退或被击败）：你拖着伤痕累累的身体回到蒂林哈斯特密所。'
      + '露比和安迪已围在兰德尔桌旁，端详一尊小小的绿色神像。兰德尔说：“我的怀疑得到了证实：这件遗物是真的。干得好。'
      + '要是我告诉你，我有一个好得无法拒绝的提议呢？”',
    resolution1: '结局 1：你带着货物和露比·斯坦迪什一起回到蒂林哈斯特密所。珠宝窃贼闷闷不乐地承认你赢了她的小赌局，'
      + '并答应之后请你喝一杯，绝口不提她先前提出的“双倍或全无”。',
  }),
  resolutionBranches: Object.freeze({
    noResolution: '在剧本日志中记录“露比赢了赌局”。',
    resolution1: '在剧本日志中记录“露比输了赌局”。',
    discoveredAnAlienLanguage: '如果调查员发现了一种外星语言：你发现这个符文[A]，在剧本日志的符文记录中于 {runeA} 下记录“深渊”。该符文已被翻译。',
    proceed: '前往幕间 I：无法拒绝的提议。',
  }),
})

export const SCENARIO_ACT_TEXT = Object.freeze({
  [ACT1_V1_CODE]: '本幕的总线索目标值 +1[per_investigator]。[fast] 花费 X 个线索：谈判。弃掉你所在地点一名与你交战、剩余生命值为 X 的[[罪犯]]敌人。'
    + '在本幕上放置 1 个线索。目标 - 一轮结束时，如果本幕上的线索数量等于或超过其总线索目标值，推进。',
  [ACT2_SHELDON_CODE]: '萨迪·谢尔顿获得：“[action] 花费至多 4 个资源：谈判。检定[willpower]或[combat](5)。作为本行动费用花费的每个资源使本次检定难度 -1。'
    + '你每成功超过难度 1 点，在萨迪·谢尔顿上放置你的 1 个线索。”目标 - 当伤害被放置到萨迪·谢尔顿上时，推进。目标 - 如果萨迪·谢尔顿上有 3 个线索，推进。',
  [ACT3_CODE]: '每名其上有线索的[[罪犯]]敌人获得冷漠。[action] 从你所在地点一名[[罪犯]]敌人上移除 1 个线索：谈判。该敌人将其伤害值造成给你所在地点的另一名敌人。'
    + '目标 - 一轮结束时，如果胜利区至少有 1 名[[精英]]敌人，推进。',
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
// 默认（Hibbs 线）幕牌库；另一版在 behavior.preScenarioSetup 按随机数切换。
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES,
  ...SET_ASIDE_ENEMY_CODES,
])
export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ...ACT_CODES, ...AGENDA_CODES,
  ...START_LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...ENCOUNTER_DECK_CODES, ...SET_ASIDE_ENEMY_CODES,
].map(code => [code, ALL_CARDS[code]])))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '金盆洗手 · One Last Job',
  nameEn: 'One Last Job',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: Object.freeze([]),
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
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
  tokenMeanings: ONE_LAST_JOB_TOKEN_MEANINGS,
  setAsideAliases: [...SET_ASIDE_ALIASES],
  removedCodes: [...REMOVED_LOCATION_CODES],
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export default scenario
