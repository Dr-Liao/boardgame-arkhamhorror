// 不留痕迹（Without a Trace · 09681）· 剧本数据（scenario 对象只含数据，不含函数）。
//
// 参考：参考实现 `Scenario/Scenarios/TheScarletKeys/WithoutATrace.hs`（异界牌库、阴影三位置、
// 左/中/右残骸之城揭露入场、结局 1–4）、`Act|Agenda|Location|Enemy/CardDefs/TheScarletKeys/WithoutATrace.hs`
// （幕/议程/地点/敌人印刷字段）、locale `scenarios/withoutATrace.json`（序章、设置、特别规则、结局）。
// 卡面数据来自 `src/cards/cards-data.js`（TSK 卡面入口 `../../card-data.js`），
// 单卡行为在 `src/cards/encounter-entries/theScarletKeys/withoutATrace/<code>.js`。
//
// 本章只有两张自有地点（域外来客之廷 09688 / 域外来客之巢 09689）；其余十张异界地点来自共享组
// `beyond_the_beyond`（09747a–09750），异界牌库把它们与 09689 一起洗成一副「地点牌库」。
//
// 文本来源（P7）：`content/campaigns/theScarletKeys/story-access.js` 的 `chapterStory`；
// 本章不写死剧情正文（缺失时回退到卡片印刷文本）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  encounterDefinitions, identitiesFor, location, printed, stage,
} from '../../card-data.js'
import { chapterStory, flattenStory, resolutionText, storyText } from '../../story-access.js'
import { ENCOUNTER_GROUP_CODES } from '../../shared.js'
import { MAX_TABLET_HOLLOWS, WITHOUT_A_TRACE_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'withoutATrace'
export const REFERENCE_CODE = '09681'
export const CAMPAIGN_ID = 'theScarletKeys'

// 参考实现的档案号与所在地（百慕大三角 / #56–Y）：结局 1–4 的「启程」从这里出发。
export const ARCHIVE_LABEL = '#56–Y'
export const BERMUDA_MAP_NODE = 'Bermuda'
export const EMBARK_NODES = Object.freeze(['Bermuda', 'YborCity', 'SanJuan'])

// —— 卡号常量（只做命名，不按卡号写流程分支）——
export const RAW_CODES = Object.freeze({
  scenario: '09681',
  agenda1: '09682', agenda2: '09683', agenda3: '09684',
  act1: '09685', act2: '09686', act3: '09687',
  courtOfTheOutsiders: '09688',
  outsidersLair: '09689',
  mimeticNemesis: '09690',
  protoplasmicReassembler: '09691',
  redGlovedMan: '09692',
  aliki: '09693',
})

// 本章遭遇组（参考 Setup 的 gather 组合，顺序与卡面图标一致）。
export const GATHER_GROUPS = Object.freeze([
  'withoutATrace', 'agentsOfTheOutside', 'beyondTheBeyond', 'outsiders', 'secretWar', 'spreadingCorruption',
])
export const SHARED_GROUPS = Object.freeze([
  'agentsOfTheOutside', 'beyondTheBeyond', 'outsiders', 'secretWar', 'spreadingCorruption',
])

// 共享组里的「域外」敌人（09731 无端存在 / 09732 天启噩兆）。
export const OUTSIDERS_GROUP_ENEMIES = Object.freeze(['09731', '09732'])
export const APOCALYPTIC_PRESAGE_CODE = '09732'

// —— 场外 / 放一边 ——
// 参考 setup.setAside：戴红手套的男子（09692）、拟态克星（09690）、原生质重组者（09691）、
// 天启噩兆（09732）。四张都不进遭遇牌库（议程 1 背面才把后两张洗回去）。
export const SET_ASIDE_CODES = Object.freeze([
  RAW_CODES.redGlovedMan, RAW_CODES.mimeticNemesis, RAW_CODES.protoplasmicReassembler, APOCALYPTIC_PRESAGE_CODE,
])
// 议程 1 背面洗回遭遇牌库的两张敌人。
export const AGENDA1_SHUFFLE_BACK = Object.freeze([APOCALYPTIC_PRESAGE_CODE, RAW_CODES.protoplasmicReassembler])

// —— 异界牌库（Otherworld deck）——
// 牌库 id 走引擎 `scenarioDecks`（`mechanicState.scenarioDecks`，存档校验已覆盖）。
export const OTHERWORLD_DECK_ID = 'otherworld'
// 牌库底：域外来客之巢 + 两张疯狂峭壁（09750 印刷 2 份，因此需要两个地点实体 id）。
export const OUTSIDERS_LAIR_ID = 'outsidersLair'
export const CLIFFS_LOCATION_IDS = Object.freeze(['cliffsOfInsanityA', 'cliffsOfInsanityB'])
// 牌库顶：七张残骸之城（凌乱道路 ×3 / 异星边境 ×2 / 拟像旷野 ×2）。
export const CITY_OF_REMNANTS_LOCATION_IDS = Object.freeze([
  'ramblingRouteA', 'ramblingRouteB', 'ramblingRouteC',
  'alienFrontierA', 'alienFrontierB',
  'wealdOfEffigiesA', 'wealdOfEffigiesB',
])
export const OTHERWORLD_LOCATION_IDS = Object.freeze([
  ...CITY_OF_REMNANTS_LOCATION_IDS, ...CLIFFS_LOCATION_IDS, OUTSIDERS_LAIR_ID,
])
// 两位调查员移出 1 张、一位调查员移出 2 张残骸之城（不查看）。
export const cityRemovalCount = players => (players <= 1 ? 2 : players === 2 ? 1 : 0)

// 阴影三位置（左/中/右）；参考实现 LocationsInShadowsMetadata 的 left/middle/right。
export const SHADOW_POSITIONS = Object.freeze(['left', 'middle', 'right'])
export const SHADOW_LABELS = Object.freeze({ left: '左', middle: '中', right: '右' })
// 阴影位置的迷你卡种类（L / M / R）与诱饵。
export const MINI_KIND_BY_POSITION = Object.freeze({
  left: 'CityOfRemnantsL', middle: 'CityOfRemnantsM', right: 'CityOfRemnantsR',
})
export const POSITION_BY_MINI_KIND = Object.freeze(Object.fromEntries(
  Object.entries(MINI_KIND_BY_POSITION).map(([position, kind]) => [kind, position])))
export const DECOY_MINI_KIND = 'Decoy'
// 地点背面「隐匿 1」：曝光后该地点旁边放 1 张自己的迷你卡 + 1 张诱饵。
export const CONCEALED_PER_LOCATION = 1

// 网格坐标（`x = column`、`y = row`；引擎 grid-map 的约定）。
export const START_GRID = Object.freeze({ x: 0, y: 0 })
// 环绕起点的四个迷你卡空位：左、右、上、下。
export const START_MINI_SPOTS = Object.freeze([
  Object.freeze({ x: -1, y: 0, label: '左' }),
  Object.freeze({ x: 1, y: 0, label: '右' }),
  Object.freeze({ x: 0, y: -1, label: '上' }),
  Object.freeze({ x: 0, y: 1, label: '下' }),
])

// —— 地点 ——
// 印刷字段（帷幕/每人线索/胜利点）直接取卡表；连接一律由网格邻接推导（`connectGrid`），
// 因为本章规则是「每个地点与它相邻的地点相连」，没有印刷符号连接。
const LOCATION_BUILD = {
  courtOfTheOutsiders: {
    ...location({ id: 'courtOfTheOutsiders', code: RAW_CODES.courtOfTheOutsiders, clues: 2 }),
    // 09688 正面：[action] 撤退。检定意志/敏捷(4)。
    resignAction: true,
  },
  outsidersLair: {
    ...location({ id: OUTSIDERS_LAIR_ID, code: RAW_CODES.outsidersLair, clues: 2, hasVictory: true, victory: 1 }),
    // 09689 正面：本地每个[[域外]]敌人失去冷漠并 +1 攻击/+1 躲避；[fast] 把红手套男子放入场。
    lairRules: true,
  },
  ramblingRouteA: location({ id: 'ramblingRouteA', code: '09747a', clues: ALL_CARDS['09747a'].clues }),
  ramblingRouteB: location({ id: 'ramblingRouteB', code: '09747b', clues: ALL_CARDS['09747b'].clues }),
  ramblingRouteC: location({ id: 'ramblingRouteC', code: '09747c', clues: ALL_CARDS['09747c'].clues }),
  alienFrontierA: location({ id: 'alienFrontierA', code: '09748a', clues: ALL_CARDS['09748a'].clues }),
  alienFrontierB: location({ id: 'alienFrontierB', code: '09748b', clues: ALL_CARDS['09748b'].clues }),
  wealdOfEffigiesA: location({
    id: 'wealdOfEffigiesA', code: '09749a', clues: ALL_CARDS['09749a'].clues, hasVictory: true, victory: 1,
  }),
  wealdOfEffigiesB: location({
    id: 'wealdOfEffigiesB', code: '09749b', clues: ALL_CARDS['09749b'].clues, hasVictory: true, victory: 1,
  }),
  cliffsOfInsanityA: location({
    id: 'cliffsOfInsanityA', code: '09750', clues: ALL_CARDS['09750'].clues, hasVictory: true, victory: 1,
  }),
  cliffsOfInsanityB: location({
    id: 'cliffsOfInsanityB', code: '09750', clues: ALL_CARDS['09750'].clues, hasVictory: true, victory: 1,
  }),
}
export const LOCATIONS = Object.freeze(Object.fromEntries(
  Object.entries(LOCATION_BUILD).map(([id, entry]) => [id, Object.freeze(entry)])))
export const START_LOCATION = 'courtOfTheOutsiders'
export const OTHERWORLD_LOCATIONS = Object.freeze(OTHERWORLD_LOCATION_IDS.map(id => LOCATIONS[id]))
export const locationIdOfCode = Object.freeze({
  '09747a': 'ramblingRouteA', '09747b': 'ramblingRouteB', '09747c': 'ramblingRouteC',
  '09748a': 'alienFrontierA', '09748b': 'alienFrontierB',
  '09749a': 'wealdOfEffigiesA', '09749b': 'wealdOfEffigiesB',
  '09750': 'cliffsOfInsanityA',
  [RAW_CODES.outsidersLair]: OUTSIDERS_LAIR_ID,
})
export const codeOfLocationId = id => LOCATIONS[id]?.originalCode || LOCATIONS[id]?.code || null
export const isOtherworldLocationId = id => OTHERWORLD_LOCATION_IDS.includes(id)
export const isOtherworldCode = code => OTHERWORLD_LOCATION_IDS.some(id => codeOfLocationId(id) === String(code))

// 地点背面的「强制 - 在你揭露此地点时」效果（左/中/右）。参考 Location/CardDefs 的 exposed 分支；
// 共享组的对应地点在自己的单卡条目里声明同一句（本章 behavior 派发它们的 forced 能力），
// 这里只补本章自有地点 09689 的那一份（它没有单卡条目）。
export const EXPOSED_POSITION_EFFECTS = Object.freeze({
  [RAW_CODES.outsidersLair]: Object.freeze({
    left: { kind: 'damage', amount: 1 },
    middle: { kind: 'hollowFromHand' },
    right: { kind: 'horror', amount: 1 },
  }),
})

// —— 遭遇组 → 卡表 encounterCode ——
const groupSnake = group => ENCOUNTER_GROUP_CODES[group] || group
export const GROUP_SNAKES = Object.freeze(Object.fromEntries(GATHER_GROUPS.map(group => [group, groupSnake(group)])))
const GATHER_SNAKES = new Set(GATHER_GROUPS.map(groupSnake))

// 本章 + 共享组的敌人/诡计（印刷份数在 ENCOUNTER_DECK 里展开；地点卡不进遭遇牌库）。
const gatheredCards = Object.entries(ALL_CARDS).filter(([, card]) =>
  card.pack === 'tskc' && GATHER_SNAKES.has(card.encounterCode) && ['enemy', 'treachery'].includes(card.type))

// —— 遭遇牌定义 ——
// 遭遇定义覆盖本章两敌人 + 两张[[同谋]]剧情支援（09692/09693）；放一边的 09690/09691/09732 也在
// 定义里（spawn 需要卡面数据），只是从牌库里剔除。
const definitions = encounterDefinitions([
  ...gatheredCards.map(([code]) => code), RAW_CODES.mimeticNemesis, RAW_CODES.protoplasmicReassembler,
  RAW_CODES.redGlovedMan, RAW_CODES.aliki,
])
export const enemies = Object.freeze({ ...definitions.enemies })
export const treacheries = Object.freeze({ ...definitions.treacheries })
export const storyAssets = Object.freeze({ ...definitions.storyAssets })

const SET_ASIDE_SET = new Set(SET_ASIDE_CODES)
export const ENCOUNTER_DECK = Object.freeze(gatheredCards
  .filter(([code]) => !SET_ASIDE_SET.has(code))
  .flatMap(([code, card]) => Array(card.quantity || 1).fill(code)))

// —— 幕 / 议程 ——
const actDefinition = (id, code, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number: extra.number ?? 1 }), id, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    ...extra,
  }
}
const agendaDefinition = (id, number, code, extra = {}) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number, doom: card.doom }), id, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', backText: card.backTextZh || card.backText || '',
    ...extra,
  }
}

// 幕目标：1 找到域外来客之巢 → 2 红手套男子入场 → 3 每位幸存调查员撤退。
export const acts = Object.freeze([
  actDefinition('act1', RAW_CODES.act1, { number: 1, objective: { type: 'campaignRule', kind: 'lairRevealed' } }),
  actDefinition('act2', RAW_CODES.act2, { number: 2, objective: { type: 'campaignRule', kind: 'redGlovedManEntersPlay' } }),
  actDefinition('act3', RAW_CODES.act3, { number: 3, objective: { type: 'campaignRule', kind: 'allResigned' } }),
])

// 议程：异界恐惧（5 毁灭）/ 异界的羔羊（5）/ 异界的屠杀（6）。
// 背面：前两张「共同选择两项」（伤害恐惧 / 空洞 / 重洗隐匿迷你卡），第三张「发疯」。
export const agendas = Object.freeze([
  agendaDefinition('agenda1', 1, RAW_CODES.agenda1,
    { backAction: 'chooseTwoOfThree', shuffleBack: AGENDA1_SHUFFLE_BACK }),
  agendaDefinition('agenda2', 2, RAW_CODES.agenda2, { backAction: 'chooseTwoOfThree' }),
  agendaDefinition('agenda3', 3, RAW_CODES.agenda3, { backAction: 'drivenInsane' }),
])
// 议程背面的三个选项（参考 label.otherworldlyHorror/otherworldlyLambs）。
export const AGENDA_BACK_OPTIONS = Object.freeze({
  damageAndHorror: { id: 'damageAndHorror', label: '每位调查员受到 1 点伤害和 1 点恐惧' },
  hollows: { id: 'hollows', label: '每位调查员把一张手中或场上的非弱点卡放在一边作为空洞' },
  shuffleConcealed: { id: 'shuffleConcealed', label: '混洗全部隐匿迷你卡并正面朝下放回原位' },
})

// —— 结局 ——
const story = (() => {
  try { return chapterStory(CHAPTER_ID) } catch { return null }
})()
const sections = story?.sections || {}
// story-text 是生成物，正文里保留源站点的 HTML 片段；章节展示文本统一去掉标签与空段落。
const stripTags = value => String(value || '')
  .replace(/<section[^>]*>[\s\S]*?<\/section>/gi, '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
const flatten = value => stripTags(flattenStory(value))
const resolutionOf = (key, fallback) => stripTags(resolutionText(CHAPTER_ID, key))
  || flatten(sections.resolutions?.[key]) || fallback

export const resolutions = Object.freeze({
  noResolution: resolutionOf('noResolution', '所有调查员都被击败：特别小组成为空洞，战役失败。'),
  resolution1: resolutionOf('resolution1', '结局 1：红手套男子与艾里奇都在胜利区。'),
  resolution2: resolutionOf('resolution2', '结局 2：只有红手套男子在胜利区。'),
  resolution3: resolutionOf('resolution3', '结局 3：只有艾里奇在胜利区。'),
  resolution4: resolutionOf('resolution4', '结局 4：两人都不在胜利区。'),
})

// 结局记录（参考 WithoutATrace.hs 的 ScenarioResolution 分支）。
// `time` 是「记 N 时间」；`bonus` 是每位调查员的奖励经验。
export const RESOLUTION_TABLE = Object.freeze({
  noResolution: Object.freeze({
    records: Object.freeze({ theCellWasHollowed: true }), time: 0, bonus: 0, award: false, embark: false,
  }),
  resolution1: Object.freeze({
    records: Object.freeze({ theCellKnowsTheTrueNatureOfTheCoterie: true, alikiIsOnYourSide: true }),
    time: 3, bonus: 1, award: true, embark: true,
  }),
  resolution2: Object.freeze({
    records: Object.freeze({
      theCellKnowsTheTrueNatureOfTheCoterie: true, youHaventSeenTheLastOfAlikiZoniUperetria: true,
    }),
    time: 2, bonus: 1, award: true, embark: true,
  }),
  resolution3: Object.freeze({
    records: Object.freeze({ alikiIsOnYourSide: true }), time: 2, bonus: 0, award: true, embark: true,
  }),
  resolution4: Object.freeze({
    records: Object.freeze({ youHaventSeenTheLastOfAlikiZoniUperetria: true }), time: 1, bonus: 0, award: true, embark: true,
  }),
})

// 序章正文（Intro 1–4 与吹哨 / 丢哨两个分支）；只做展示，不决定流程。
export const INTRO_SECTIONS = Object.freeze({
  intro1: stripTags(flattenStory(sections.intro?.intro1)),
  intro2: stripTags(flattenStory(sections.intro?.intro2)),
  intro3: stripTags(flattenStory(sections.intro?.intro3)),
  intro4: stripTags(flattenStory(sections.intro?.intro4)),
  blowTheWhistle: stripTags(flattenStory(sections.intro?.label?.blowTheWhistle)) || '吹响哨子，召唤艾里奇',
  discardTheWhistle: stripTags(flattenStory(sections.intro?.label?.discardTheWhistle)) || '扔掉哨子，独自前行',
})

export const SPECIAL_RULES = Object.freeze([
  '域外之地的地点邻接：本章地点按行/列摆放，每个地点与它上下左右相邻的地点相连（只共角不算相邻）。'
  + '隐匿迷你卡同样摆在「地点旁边的空位」上，并视为位于它所相邻的地点。',
  '阴影中的地点：始终有 3 张残骸之城地点位于阴影中（左/中/右），从异界牌库顶取；'
  + '揭露对应位置的迷你卡时，把该位置的残骸之城地点放入场（未揭示面朝上）并把其它迷你卡挪到空位；'
  + '该地点离开阴影后，用异界牌库顶补上同一位置，并结算它的「隐匿 1」。',
  '异界牌库：牌库底是域外来客之巢与两张疯狂峭壁，牌库顶是七张残骸之城（1/2 人时移出 1/2 张）。'
  + '异界牌库的顺序对外隐藏，只有明确写出的效果才能查看。',
  '空洞：放在一边的空洞属于把它放在一边的调查员（红手套男子属于全队）。'
  + '议程正面在空洞数达到阈值时施加压力；[tablet] 的 X 与拟态克星的伤害都用「放一边的空洞」计算。',
])
// 指南正文（story-text 的 specialRules）与本章实现口径并列展示：先来源正文，再引擎读点说明。
const STORY_SPECIAL_RULES = Array.isArray(sections.specialRules)
  ? sections.specialRules.map(stripTags).filter(Boolean) : []

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  sectionCount: Object.keys(sections).length,
  introTitle: stripTags(flattenStory(sections.intro?.title)) || '档案 #56–Y：不留痕迹',
  intro: [INTRO_SECTIONS.intro1, INTRO_SECTIONS.intro2, INTRO_SECTIONS.intro3, INTRO_SECTIONS.intro4]
    .filter(Boolean).join('\n\n'),
  setup: [
    stripTags(storyText(CHAPTER_ID, 'setup.gatherSets')),
    stripTags(storyText(CHAPTER_ID, 'setup.placeLocations')),
    stripTags(storyText(CHAPTER_ID, 'setup.startAt')),
    stripTags(storyText(CHAPTER_ID, 'setup.blewTheWhistle')),
    stripTags(storyText(CHAPTER_ID, 'setup.setAside')),
    stripTags(storyText(CHAPTER_ID, 'setup.bottomOfDeck')),
    stripTags(storyText(CHAPTER_ID, 'setup.topOfDeck')),
    stripTags(storyText(CHAPTER_ID, 'setup.placeTopOfOtherworld')),
    stripTags(storyText(CHAPTER_ID, 'setup.placeMiniCards')),
  ].filter(Boolean).join('\n\n'),
  specialRules: [...STORY_SPECIAL_RULES, ...SPECIAL_RULES].join('\n\n'),
})

export const scenario = Object.freeze({
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: ALL_CARDS[REFERENCE_CODE].nameZh || ALL_CARDS[REFERENCE_CODE].name,
  nameEn: ALL_CARDS[REFERENCE_CODE].name,
  referenceCode: REFERENCE_CODE,
  campaignId: CAMPAIGN_ID,
  migrationStatus: 'development',
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [],
  enemies, treacheries, storyAssets,
  acts, agendas, resolutions,
  encounterDeck: ENCOUNTER_DECK,
  tokenMeanings: WITHOUT_A_TRACE_TOKEN_MEANINGS,
  ...SCENARIO_TEXT,
})

export const identities = Object.freeze(identitiesFor(scenario))

// 审计/覆盖用：本章单卡条目的原卡号（地点/幕/议程/剧本参考卡不建条目）。
export const CHAPTER_ENTRY_CODES = Object.freeze([
  RAW_CODES.mimeticNemesis, RAW_CODES.protoplasmicReassembler, RAW_CODES.redGlovedMan, RAW_CODES.aliki,
])
export const entryCodes = () => CHAPTER_ENTRY_CODES
export const enemyCodesFor = () => [RAW_CODES.mimeticNemesis, RAW_CODES.protoplasmicReassembler]

// —— 战役记录 ——
export const RECORD_READS = Object.freeze([
  'theCellBlewTheWhistle', 'theCellThrewAwayTheWhistle', 'agentQuinnHasYourBack',
])
export const RECORD_WRITES = Object.freeze([
  'theCellBlewTheWhistle', 'theCellThrewAwayTheWhistle', 'agentQuinnHasYourBack', 'theCellWasHollowed',
  'theCellKnowsTheTrueNatureOfTheCoterie', 'alikiIsOnYourSide', 'youHaventSeenTheLastOfAlikiZoniUperetria',
  'erasedFromExistence', 'erasedCards',
])

// [skull] 取「场上地点数量」：阴影中的地点不算（参考 selectCount $ not_ InTheShadows）。
export const skullLocationCount = locations => locations.filter(loc => !loc.inShadows).length

export { MAX_TABLET_HOLLOWS, printed, storyText, resolutionText }
