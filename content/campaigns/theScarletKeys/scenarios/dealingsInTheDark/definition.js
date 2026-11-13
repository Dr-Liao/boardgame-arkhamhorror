// 暗中交易（Dealings in the Dark · 09566 / File #21-F · 君士坦丁堡）· 剧本数据。
//
// 规则事实源：
//   · 参考实现 `参考资源/ArkhamHorror-main/backend/.../Scenario/Scenarios/TheScarletKeys/DealingsInTheDark.hs`
//     与 `{Act,Agenda,Location,Enemy,Story,Treachery,Asset}/Cards/TheScarletKeys/DealingsInTheDark/*.hs`；
//   · 英文指南 `frontend/src/locales/en/theScarletKeys/scenarios/dealingsInTheDark.json`（specialRules /
//     tokens / act2Setup / resolutions）；
//   · 剧情正文来自 P7 生成物 `../../story-text.js`（本文件只投影键，不复制译文）。
//
// 本文件只做「本章怎么用这些卡」：印刷数值/卡文全部来自 `../../card-data.js`（cards-data 唯一事实源）。
// 逐卡规则在 `src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/<code>.js`；章节流程在 behavior.js。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { chapterStory, flattenStory, storyParagraphs } from '../../story-access.js'
import { encounterDefinitions, encounterGroupCards, identitiesFor, location, stage } from '../../card-data.js'

// ---- 卡号常量（definition / behavior / layout / tests 共用；行为层不写卡号分支，按数据表分派） ----
export const CODES = Object.freeze({
  scenario: '09566',
  agendaAgentsOfTheDark: '09567',
  actSearchForTheManuscript: '09568',
  actSearchForTheTalisman: '09569',
  agendaTheChase: '09570',
  storyTheUnveiling: '09571',
  storyTheUnsealing: '09571b',
  galataDocks: '09572',
  galata: '09573',
  obeliskOfTheodosius: '09574',
  istanbulUniversity: '09575',
  hagiaSophia: '09576',
  bazaarDarkenedAlley: '09577',
  bazaarPublicBaths: '09578',
  bazaarMarbleFountain: '09579',
  bazaarCrowdedShops: '09580',
  bazaarBusyWalkway: '09581',
  bazaarRooftopAccess: '09582',
  bazaarJewelersRoad: '09583',
  eceSahin: '09584',
  umbralHarbinger: '09585',
  sinisterAspirantA: '09586a',
  sinisterAspirantB: '09586b',
  sinisterAspirantC: '09586c',
  shadowed: '09587',
  accosted: '09588',
  lightOutOfVoid: '09589',
  keyStable: '09590a',
  keyUnstable: '09590b',
  // 遭遇组里的放一边敌人（Agents of Yuggoth）与《午夜假面》的两张诡计。
  emissaryFromYuggoth: '09739',
  huntingShadow: '01135',
  falseLead: '01136',
})

// 绯红密钥实体 id：参考 Key/Cards.hs 用物理卡号 09590（a/b 是稳定/动荡面）。
export const KEY_ID = '09590'

export const LOCATION_IDS = Object.freeze({
  hagiaSophia: 'hagiaSophia',
  istanbulUniversity: 'istanbulUniversity',
  obeliskOfTheodosius: 'obeliskOfTheodosius',
  galata: 'galata',
  galataDocks: 'galataDocks',
  bazaarDarkenedAlley: 'bazaarDarkenedAlley',
  bazaarPublicBaths: 'bazaarPublicBaths',
  bazaarMarbleFountain: 'bazaarMarbleFountain',
  bazaarCrowdedShops: 'bazaarCrowdedShops',
  bazaarBusyWalkway: 'bazaarBusyWalkway',
  bazaarRooftopAccess: 'bazaarRooftopAccess',
  bazaarJewelersRoad: 'bazaarJewelersRoad',
})

// 场景 1 的四个起始地点（参考 Setup：圣索菲亚 / 伊斯坦布尔大学 / 狄奥多西方尖碑 / 加拉塔）。
export const INITIAL_LOCATIONS = Object.freeze([
  LOCATION_IDS.hagiaSophia, LOCATION_IDS.istanbulUniversity,
  LOCATION_IDS.obeliskOfTheodosius, LOCATION_IDS.galata,
])
export const START_LOCATION = LOCATION_IDS.hagiaSophia

// 七张大巴扎地点：场景 2 布置时随机抽 6 张入场（另一张移出游戏）；彼此按「共边相邻」连接。
export const BAZAAR_LOCATION_IDS = Object.freeze([
  LOCATION_IDS.bazaarDarkenedAlley, LOCATION_IDS.bazaarPublicBaths, LOCATION_IDS.bazaarMarbleFountain,
  LOCATION_IDS.bazaarCrowdedShops, LOCATION_IDS.bazaarBusyWalkway, LOCATION_IDS.bazaarRooftopAccess,
  LOCATION_IDS.bazaarJewelersRoad,
])
export const BAZAAR_LOCATION_CODES = Object.freeze([
  CODES.bazaarDarkenedAlley, CODES.bazaarPublicBaths, CODES.bazaarMarbleFountain, CODES.bazaarCrowdedShops,
  CODES.bazaarBusyWalkway, CODES.bazaarRooftopAccess, CODES.bazaarJewelersRoad,
])
// 场景 2 开始时放一边（或移出游戏）的全部地点：七张大巴扎 + 加拉塔码头（09572）。
export const SET_ASIDE_LOCATION_IDS = Object.freeze([...BAZAAR_LOCATION_IDS, LOCATION_IDS.galataDocks])
export const SET_ASIDE_LOCATION_CODES = Object.freeze([...BAZAAR_LOCATION_CODES, CODES.galataDocks])

// 场景 1 的四个地点：印刷连接符号（参考 Location/CardDefs：圣索菲亚=方形、大学=圆形、方尖碑=月牙、加拉塔=十字）。
// 加拉塔的十字符号还连到加拉塔码头的波浪符号（码头入场前不在场，连接先声明、入场后才可用）。
const locations = {
  hagiaSophia: location({
    id: LOCATION_IDS.hagiaSophia, code: CODES.hagiaSophia, clues: 1, symbol: 'square',
    connections: [LOCATION_IDS.obeliskOfTheodosius, LOCATION_IDS.istanbulUniversity],
  }),
  istanbulUniversity: location({
    id: LOCATION_IDS.istanbulUniversity, code: CODES.istanbulUniversity, clues: 1, hasVictory: true, victory: 1,
    symbol: 'circle', connections: [LOCATION_IDS.galata, LOCATION_IDS.hagiaSophia],
  }),
  obeliskOfTheodosius: location({
    id: LOCATION_IDS.obeliskOfTheodosius, code: CODES.obeliskOfTheodosius, clues: 1, hasVictory: true, victory: 1,
    symbol: 'moon', connections: [LOCATION_IDS.galata, LOCATION_IDS.hagiaSophia],
  }),
  galata: location({
    id: LOCATION_IDS.galata, code: CODES.galata, clues: 1, symbol: 'plus',
    connections: [LOCATION_IDS.obeliskOfTheodosius, LOCATION_IDS.istanbulUniversity, LOCATION_IDS.galataDocks],
  }),
  // 加拉塔码头：只能从加拉塔进入（另加 3 个相同技能图标的弃牌费用，见条目 09572）。
  galataDocks: location({
    id: LOCATION_IDS.galataDocks, code: CODES.galataDocks, clues: 1, hasVictory: true, victory: 1,
    symbol: 'squiggle', connections: [LOCATION_IDS.galata], entryOnlyFrom: LOCATION_IDS.galata,
  }),
  // 七张大巴扎：入场位置由 scenario 2 布置的随机图形决定，连接在 behavior 里按「共边相邻」建立。
  bazaarDarkenedAlley: location({
    id: LOCATION_IDS.bazaarDarkenedAlley, code: CODES.bazaarDarkenedAlley, clues: 1, cluesFixed: true,
    bazaar: true, connections: [],
  }),
  bazaarPublicBaths: location({
    id: LOCATION_IDS.bazaarPublicBaths, code: CODES.bazaarPublicBaths, clues: 1, bazaar: true, connections: [],
  }),
  bazaarMarbleFountain: location({
    id: LOCATION_IDS.bazaarMarbleFountain, code: CODES.bazaarMarbleFountain, clues: 3, cluesFixed: true,
    hasVictory: true, victory: 1, bazaar: true, connections: [],
  }),
  bazaarCrowdedShops: location({
    id: LOCATION_IDS.bazaarCrowdedShops, code: CODES.bazaarCrowdedShops, clues: 1, bazaar: true, connections: [],
  }),
  bazaarBusyWalkway: location({
    id: LOCATION_IDS.bazaarBusyWalkway, code: CODES.bazaarBusyWalkway, clues: 1, bazaar: true, connections: [],
  }),
  bazaarRooftopAccess: location({
    id: LOCATION_IDS.bazaarRooftopAccess, code: CODES.bazaarRooftopAccess, clues: 1, hasVictory: true, victory: 1,
    bazaar: true, connections: [],
  }),
  bazaarJewelersRoad: location({
    id: LOCATION_IDS.bazaarJewelersRoad, code: CODES.bazaarJewelersRoad, clues: 2, cluesFixed: true,
    hasVictory: true, victory: 1, bazaar: true, connections: [],
  }),
}

// 地点规则表（本章 place/act 逻辑；引擎不为地点/幕/议程建单卡条目，规则由 behavior 按这张表分派）。
// 读点：behavior.actions / fastActions / performAction / moveError / beforeMove / locationShroudModifier /
// locationEntered / enemyMoved / afterTest / describe。
export const LOCATION_RULES = Object.freeze({
  [LOCATION_IDS.galata]: Object.freeze({
    fastParley: 'exposeAnywhere', resourceCost: 3, groupLimitPerRound: true,
    label: '💸 花费 3 资源：谈判。揭露任意地点一张隐匿迷你卡（团队每轮一次）',
  }),
  [LOCATION_IDS.hagiaSophia]: Object.freeze({
    studyAction: true, studyCluesPerInvestigator: 1, shroudPerStudy: 3,
    label: '📚 圣索菲亚：放 1[每人] 个线索与 1 个研究标记；每个研究标记 +3 隐藏值',
  }),
  [LOCATION_IDS.istanbulUniversity]: Object.freeze({
    studyClueAction: Object.freeze({ skills: Object.freeze(['willpower', 'intellect']), difficulty: 6 }), oncePerGame: true,
    label: '🎓 伊斯坦布尔大学：检定意志或智力(6)；成功取得 1 个「彰显的线索」（每场游戏最多成功一次）',
  }),
  [LOCATION_IDS.obeliskOfTheodosius]: Object.freeze({
    investigateFailClueToCultist: true, label: '🪨 方尖碑：调查失败后把 1 个线索移到最近的[[异教徒]]敌人',
  }),
  [LOCATION_IDS.galataDocks]: Object.freeze({
    entryOnlyFrom: LOCATION_IDS.galata, entryDiscardCards: 1,
    label: '🚢 加拉塔码头：只能从加拉塔进入，且额外弃 1 张手牌',
  }),
  [LOCATION_IDS.bazaarDarkenedAlley]: Object.freeze({ concealedFightEvadeBonus: 2 }),
  [LOCATION_IDS.bazaarPublicBaths]: Object.freeze({ blankAssetsWithTrait: 'Weapon' }),
  [LOCATION_IDS.bazaarMarbleFountain]: Object.freeze({
    fastParleyTakeClue: true, limitPerRound: true,
    label: '🤝 谈判：控制本地点[[异教徒]]敌人的 1 个线索，然后把它退回阴影并结算隐匿（每轮一次）',
  }),
  [LOCATION_IDS.bazaarCrowdedShops]: Object.freeze({ decoyExposedClueToCultist: true }),
  [LOCATION_IDS.bazaarBusyWalkway]: Object.freeze({
    leaveTest: Object.freeze({ skill: 'agility', difficulty: 3 }), leaveFailChoice: Object.freeze(['loseAction', 'cancelMove']),
  }),
  [LOCATION_IDS.bazaarRooftopAccess]: Object.freeze({
    moveReactionTest: Object.freeze({ skill: 'agility', difficulty: 4 }), reResolveEnemyKeyword: true,
  }),
  [LOCATION_IDS.bazaarJewelersRoad]: Object.freeze({ investigateCharmRelicPlay: true }),
})

// ---- 幕 / 议程 ----
// 场景目标由 behavior.checkObjectives 按 chapterFlow 结算（引擎不认卡号）：
//   · manuscript：教派线索总数或调查员线索总数达到 4×人数 → 推进（不花费线索）；
//   · talisman：东门地点的调查员线索达到 8×人数，或教派线索达到 8×人数 → 推进；
//   · agentsOfTheDark：密谋 1，推进时结算背面并翻回（累加日食）；
//   · theChase：密谋 2（同时充当最终幕），目标见条目 09570。
const actOne = {
  ...stage(CODES.actSearchForTheManuscript),
  chapterFlow: 'manuscript', clueThresholdPerInvestigator: 4,
}
const actTwo = {
  ...stage(CODES.actSearchForTheTalisman),
  chapterFlow: 'talisman', clueThresholdPerInvestigator: 8, eastGateObjective: true,
}
const agendaAgents = {
  ...stage(CODES.agendaAgentsOfTheDark),
  chapterFlow: 'agentsOfTheDark', eclipseCounted: true,
}
const agendaChase = {
  ...stage(CODES.agendaTheChase),
  chapterFlow: 'theChase', setAsideUntilAct2: true,
}

// ---- 遭遇卡 ----
// 参考 Setup 收齐 7 组：暗中交易 / 犹格斯星使徒 / 黑暗笼罩 / 远古恶魔 / 黑暗异教（Dark Cult=pentagram）/
// 上锁的门 / 午夜假面（只取 2 张错误指示 + 3 张追猎鬼影）。
export const GATHER_ENCOUNTER_GROUPS = Object.freeze([
  'dealingsInTheDark', 'agentsOfYuggoth', 'darkVeiling', 'ancientEvils', 'pentagram', 'lockedDoors',
])
// 午夜假面只取两张诡计（代码 + 印刷份数在卡表 quantity 里）。
export const MIDNIGHT_MASKS_CODES = Object.freeze([CODES.huntingShadow, CODES.falseLead])
// 放一边的两名敌人：act 1 推进时洗入遭遇牌库（参考 Act 1b）。
export const SET_ASIDE_ENEMY_CODES = Object.freeze([CODES.umbralHarbinger, CODES.emissaryFromYuggoth])

function quantityOf(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`《暗中交易》缺少印刷卡 ${code}`)
  return card.quantity || 1
}

// 2026-11-13 P0：旧实现用 camelCase 组名直接比较 `ALL_CARDS[code].encounterCode`（snake_case），
// 只有 pentagram 恰巧同名能命中 → 遭遇牌库只剩 11 张、6 张已实现的卡完全不可达。
// 现在统一走 card-data.js#encounterGroupCards（含别名表）。
const gatheredCodes = encounterGroupCards(GATHER_ENCOUNTER_GROUPS, { exclude: SET_ASIDE_ENEMY_CODES })

export const ENCOUNTER_DECK = Object.freeze([
  ...gatheredCodes.flatMap(code => Array(quantityOf(code)).fill(code)),
  ...MIDNIGHT_MASKS_CODES.flatMap(code => Array(quantityOf(code)).fill(code)),
].sort())

// 定义表要覆盖：遭遇牌库全部卡 + 放一边的两个敌人 + 剧情卡/剧情资产。
// 生产组合根按章展开 definitions 注册全局遭遇表；漏掉牌库里的卡会让真实抽取报「未知遭遇卡」。
export const ENCOUNTER_DEFINITION_CODES = Object.freeze([
  ...new Set([...gatheredCodes, ...SET_ASIDE_ENEMY_CODES, ...MIDNIGHT_MASKS_CODES]),
])
const definitions = encounterDefinitions([
  ...ENCOUNTER_DEFINITION_CODES,
  CODES.storyTheUnveiling, CODES.storyTheUnsealing, CODES.eceSahin,
])

// ---- 剧情正文（生成物 ../../story-text.js；只投影键名，不二次翻译） ----
const story = chapterStory('dealingsInTheDark')
const section = key => story.sections[key]
const paragraphTexts = value => storyParagraphs(flattenStory(value))

export const INTRO_TEXT = Object.freeze({
  title: section('intro')?.title || 'File #21–F: Dealings in the Dark',
  paragraphs: Object.freeze(paragraphTexts(section('intro'))),
  labels: Object.freeze({
    giveToEce: section('intro')?.label?.giveToEce || '「好吧。我们会找到它，交给你保管。」',
    giveToEceLying: section('intro')?.label?.giveToEceLying || '（你在撒谎。）',
    takeForOurSelves: section('intro')?.label?.takeForOurselves || '「我们会找到它，但会由我们保管。」',
  }),
})

export const SPECIAL_RULES = Object.freeze((section('specialRules') || []).map(rule =>
  Object.freeze({ title: rule.title, body: rule.body })))

export const SETUP_STEPS = Object.freeze(Object.values(section('setup') || {})
  .map(value => flattenStory(value)).filter(Boolean))
export const ACT2_SETUP_STEPS = Object.freeze(Object.values(section('act2Setup') || {})
  .map(value => flattenStory(value)).filter(Boolean))

const resolutions = section('resolutions') || {}
const resolutionText = key => {
  const value = resolutions[key]
  if (!value) return ''
  return flattenStory(value)
}
export const RESOLUTIONS = Object.freeze(Object.fromEntries(
  ['noResolution', 'noResolutionAct3', 'resolution1', 'resolution2', 'resolution3', 'resolution4',
    'resolution5', 'resolution6'].map(key => [key, resolutionText(key)])))

export const TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: { text: '-X。X为场上线索标记最多的[[异教徒]]敌人上的线索标记数，最多为3。(如果是场景3，则X为3。)', delta: 0 },
    cultist: { text: '-5。你可以在最近的[[异教徒]]敌人上放置1个毁灭标记以将本标记的修正值变为-1。', delta: -5 },
    tablet: { text: '-3。如果你检定失败，将你的1个线索放到你所在地点。', delta: -3 },
    elderthing: { text: '-2。如果你检定失败，在最近的[[异教徒]]敌人上放置1个毁灭标记。', delta: -2 },
  }),
  standard: Object.freeze({
    skull: { text: '-X。X为场上线索标记最多的[[异教徒]]敌人上的线索标记数，最多为3。(如果是场景3，则X为3。)', delta: 0 },
    cultist: { text: '-5。你可以在最近的[[异教徒]]敌人上放置1个毁灭标记以将本标记的修正值变为-1。', delta: -5 },
    tablet: { text: '-3。如果你检定失败，将你的1个线索放到你所在地点。', delta: -3 },
    elderthing: { text: '-2。如果你检定失败，在最近的[[异教徒]]敌人上放置1个毁灭标记。', delta: -2 },
  }),
  hard: Object.freeze({
    skull: { text: '-X。X为场上[[异教徒]]敌人上的线索标记总数，最多为4。(如果是场景3，则X为4。)', delta: 0 },
    cultist: { text: '-7。你可以在最近的[[异教徒]]敌人上放置1个毁灭标记以将本标记的修正值变为-3。', delta: -7 },
    tablet: { text: '-4。如果你检定失败，将你的1个线索放到你所在地点。', delta: -4 },
    elderthing: { text: '-2。在最近的[[异教徒]]敌人上放置1个毁灭标记。', delta: -2 },
  }),
  expert: Object.freeze({
    skull: { text: '-X。X为场上[[异教徒]]敌人上的线索标记总数，最多为4。(如果是场景3，则X为4。)', delta: 0 },
    cultist: { text: '-7。你可以在最近的[[异教徒]]敌人上放置1个毁灭标记以将本标记的修正值变为-3。', delta: -7 },
    tablet: { text: '-4。如果你检定失败，将你的1个线索放到你所在地点。', delta: -4 },
    elderthing: { text: '-2。在最近的[[异教徒]]敌人上放置1个毁灭标记。', delta: -2 },
  }),
})

export const scenario = {
  id: 'dealingsInTheDark',
  originalCode: CODES.scenario,
  referenceCode: CODES.scenario,
  name: '暗中交易',
  nameEn: 'Dealings in the Dark',
  // 参考实现：worldMap 节点君士坦丁堡；档案号 #21-F。
  mapNodeId: 'Constantinople',
  archiveLabel: 'File #21-F',
  textLanguage: 'zh-CN',
  textStatus: 'translated (generated from locked zh locale)',
  intro: INTRO_TEXT.paragraphs.join('\n\n'),
  setup: SETUP_STEPS.join('\n'),
  startLocation: START_LOCATION,
  locations,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  acts: [actOne, actTwo],
  agendas: [agendaAgents, agendaChase],
  enemies: definitions.enemies,
  treacheries: definitions.treacheries,
  storyAssets: definitions.storyAssets,
  encounterDeck: [...ENCOUNTER_DECK],
  // 新章节数据：enemyMoved / enemyEnteredLocation 等窗口按事件实例派发（见 card-model.md P7 接口）。
  eventWindowInstances: true,
  // setup 需要把关键剧情卡放到一边、把密钥登记为战役密钥实体。
  setAsideStory: [CODES.storyTheUnveiling],
  tokenMeanings: TOKEN_MEANINGS,
  specialRules: SPECIAL_RULES,
  act2Setup: ACT2_SETUP_STEPS,
  resolutions: RESOLUTIONS,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

// behavior.js / layout.js / tests 引用的印刷卡号与地点 id 统一放数据表（章节流程不写裸卡号字面量）。
export const RAW_CODES = Object.freeze({
  scenario: CODES.scenario,
  actOne: CODES.actSearchForTheManuscript,
  actTwo: CODES.actSearchForTheTalisman,
  agendaAgents: CODES.agendaAgentsOfTheDark,
  agendaChase: CODES.agendaTheChase,
  unveiling: CODES.storyTheUnveiling,
  unsealing: CODES.storyTheUnsealing,
  eceSahin: CODES.eceSahin,
  umbralHarbinger: CODES.umbralHarbinger,
  emissaryFromYuggoth: CODES.emissaryFromYuggoth,
  keyStable: CODES.keyStable,
  keyUnstable: CODES.keyUnstable,
  galata: CODES.galata,
  galataDocks: CODES.galataDocks,
  bazaarBusyWalkway: CODES.bazaarBusyWalkway,
  bazaarCrowdedShops: CODES.bazaarCrowdedShops,
  bazaarDarkenedAlley: CODES.bazaarDarkenedAlley,
  bazaarJewelersRoad: CODES.bazaarJewelersRoad,
  bazaarMarbleFountain: CODES.bazaarMarbleFountain,
  bazaarPublicBaths: CODES.bazaarPublicBaths,
  bazaarRooftopAccess: CODES.bazaarRooftopAccess,
  hagiaSophia: CODES.hagiaSophia,
  istanbulUniversity: CODES.istanbulUniversity,
  obeliskOfTheodosius: CODES.obeliskOfTheodosius,
})

export { story }
