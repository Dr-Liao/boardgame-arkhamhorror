// 深渊守卫 · 第二章《夜之篡位者》（The Night's Usurper · 83016）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/GuardiansOfTheAbyss/TheNightsUsurper.hs（Setup / 探索牌库 / 结局 1–3 / noResolution→R1）
//   Location/CardDefs/GuardiansOfTheAbyss/{SandsOfEgypt,TheNightsUsurper}.hs（符号连接图）
//   frontend/src/locales/en/standalone/{guardiansOfTheAbyss,theNightsUsurper}.json
//
// 本章特有口径：
//   1. 深渊之力：战役模式 = 记录 dreamersInTheAbyss；独立模式 = 调查员人数（参考 Setup）。
//   2. 兄弟会特工：战役模式 = 记录 brotherhoodAgentsWhoEscaped 中的敌人置于参考卡下方；
//      独立模式 = 6 名洗混后随机 3 名置于参考卡下方（其余移出游戏）。
//   3. 探索牌库 = 7 张单面探险地点 + 金字塔下的恐怖/蝗虫成群/深渊领域/黑风各 1 张。
//   4. 幕 1 背面把 Eldritch Gate 洗入探索牌库；幕 2 背面进入「梦境之间」并生成伊扎法拉。
//   5. 无结局（noResolution）按参考直接结算结局 1（清算之日即将到来）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  BROTHERHOOD_ENEMY_CODES, bindIdentities, connectionsFromSymbols, encounterDefinitions,
  location, printed, stage,
} from '../../shared.js'

export {
  BROTHERHOOD_ENEMY_CODES, BROTHERHOOD_PAIRS, BROTHERHOOD_STORY_BY_ENEMY, BROTHERHOOD_STORY_CODES,
} from '../../shared.js'

export const CHAPTER_ID = 'theNightsUsurper'
export const REFERENCE_CODE = '83016'
export const ENCOUNTER_CODE = 'the_nights_usurper'
export const START_LOCATION = 'expeditionCamp'

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export const ACT1_CODE = '83019' // Search for the Gate
export const ACT2_CODE = '83020' // Into the Gate
export const ACT3_CODE = '83021' // The Night's Usurper
export const ACT_CODES = Object.freeze([ACT1_CODE, ACT2_CODE, ACT3_CODE])
export const AGENDA1_CODE = '83017' // The Brotherhood Bides Their Time
export const AGENDA2_CODE = '83018' // Schemes in the Dark Beyond
export const AGENDA_CODES = Object.freeze([AGENDA1_CODE, AGENDA2_CODE])
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3'])

export const XZHARAH_CODE = '83027a'
export const XZHARAH_STORY_CODE = '83027b'
export const ELDRITCH_GATE_CODE = '83028'
export const DREADED_SHANTAK_CODE = '83029'
export const SPEAKER_CODE = '83030'
export const KHOPESH_CODE = '83057'
export const SUMMONED_NIGHTGAUNT_CODE = '83058'
export const ANCIENT_ANKH_CODE = '83056'
export const JOHN_AND_JESSIE_CODE = '83055'

export const EXPEDITION_LOCATION_IDS = Object.freeze([
  'nileRiver', 'sandsOfDashur', 'dunesOfTheSahara', 'untouchedVault', 'facelessSphinx', 'desertOasis', 'sandsweptRuins',
])
export const OTHERWORLD_ROWS = Object.freeze([
  Object.freeze({ id: 'aDreamBetwixt', code: '83022a', story: '83022b', symbol: 'equals', links: Object.freeze(['square']) }),
  Object.freeze({ id: 'theGreatAbyss', code: '83023a', story: '83023b', symbol: 'square', links: Object.freeze(['equals', 'triangle', 'diamond', 'circle']) }),
  Object.freeze({ id: 'tunnelsUnderNgranek', code: '83024a', story: '83024b', symbol: 'triangle', links: Object.freeze(['square']) }),
  Object.freeze({ id: 'stairwayToSarkomand', code: '83025a', story: '83025b', symbol: 'diamond', links: Object.freeze(['square']) }),
  Object.freeze({ id: 'mistFilledCaverns', code: '83026a', story: '83026b', symbol: 'circle', links: Object.freeze(['square']) }),
])
export const OTHERWORLD_LOCATION_IDS = Object.freeze(OTHERWORLD_ROWS.map(row => row.id))
export const OTHERWORLD_STORY_CODES = Object.freeze(OTHERWORLD_ROWS.map(row => row.story))
export const ELDRITCH_GATE_ID = 'eldritchGate'
export const DREAM_BETWIXT_ID = 'aDreamBetwixt'

// ---------------------------------------------------------------------------
// 地点（id 为稳定 ASCII ID；符号连接图来自 Location/CardDefs/GuardiansOfTheAbyss/*.hs）
// ---------------------------------------------------------------------------
export const LOCATION_ROWS = Object.freeze([
  Object.freeze({ id: 'expeditionCamp', code: '83037', symbol: 'circle', links: Object.freeze(['diamond', 'hourglass', 'moon', 'plus']) }),
  Object.freeze({ id: 'nileRiver', code: '83038', symbol: 'moon', links: Object.freeze(['circle', 'star', 'heart', 'hourglass']) }),
  Object.freeze({ id: 'sandsOfDashur', code: '83039', symbol: 'hourglass', links: Object.freeze(['circle', 'plus', 't', 'squiggle', 'heart', 'moon']) }),
  Object.freeze({ id: 'dunesOfTheSahara', code: '83040', symbol: 'plus', links: Object.freeze(['circle', 'hourglass', 't', 'droplet']) }),
  Object.freeze({ id: 'untouchedVault', code: '83041', symbol: 'droplet', links: Object.freeze(['plus', 't']) }),
  Object.freeze({ id: 'facelessSphinx', code: '83042', symbol: 'star', links: Object.freeze(['moon', 'heart']) }),
  Object.freeze({ id: 'desertOasis', code: '83043', symbol: 'heart', links: Object.freeze(['star', 'moon', 'hourglass', 'squiggle']) }),
  Object.freeze({ id: 'sandsweptRuins', code: '83044', symbol: 't', links: Object.freeze(['droplet', 'plus', 'hourglass', 'squiggle']) }),
  Object.freeze({ id: 'eldritchGate', code: '83028', symbol: 'squiggle', links: Object.freeze(['hourglass', 't', 'heart']) }),
  ...OTHERWORLD_ROWS,
])
const CONNECTION_MAP = connectionsFromSymbols(LOCATION_ROWS)
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_ROWS.map(row =>
  [row.id, location({ id: row.id, code: row.code, symbol: row.symbol, links: row.links, connections: CONNECTION_MAP[row.id] })])))

export const LOCATION_COORDINATES = Object.freeze({
  expeditionCamp: { x: 2, y: 1 },
  nileRiver: { x: 3, y: 1 },
  sandsOfDashur: { x: 4, y: 1 },
  dunesOfTheSahara: { x: 2, y: 2 },
  untouchedVault: { x: 3, y: 2 },
  facelessSphinx: { x: 4, y: 2 },
  desertOasis: { x: 3, y: 3 },
  sandsweptRuins: { x: 4, y: 3 },
  eldritchGate: { x: 4, y: 0 },
  aDreamBetwixt: { x: 1, y: 0 },
  theGreatAbyss: { x: 2, y: 0 },
  tunnelsUnderNgranek: { x: 1, y: 1 },
  stairwayToSarkomand: { x: 1, y: 2 },
  mistFilledCaverns: { x: 0, y: 1 },
})

// ---------------------------------------------------------------------------
// 遭遇牌库 / 放一边 / 探索牌库
// ---------------------------------------------------------------------------
const SANDS_CARDS = Object.freeze(['83045', '83046', '83047', '83048', '83049', '83050', '83051', '83052', '83053', '83054'])
const ENCOUNTER_POOL = Object.freeze([SPEAKER_CODE, ...SANDS_CARDS])
export const ENCOUNTER_DECK = Object.freeze(ENCOUNTER_POOL.flatMap(code =>
  Array(Math.max(1, Number(ALL_CARDS[code]?.quantity) || 1)).fill(code)))

// 探索牌库：7 张单面探险地点 + 1 张各（深渊领域/黑风/金字塔下的恐怖/蝗虫成群）。
export const EXPLORATION_TREACHERY_CODES = Object.freeze(['83054', '83053', '83049', '83050'])
export const EXPLORATION_DECK = Object.freeze([...EXPEDITION_LOCATION_IDS, ...EXPLORATION_TREACHERY_CODES])

export const SET_ASIDE_LOCATION_IDS = Object.freeze([...EXPEDITION_LOCATION_IDS])
export const SET_ASIDE_CODES = Object.freeze([
  KHOPESH_CODE, SUMMONED_NIGHTGAUNT_CODE, ELDRITCH_GATE_CODE, XZHARAH_CODE,
  ...OTHERWORLD_LOCATION_IDS.map(id => LOCATIONS[id].code), DREADED_SHANTAK_CODE, DREADED_SHANTAK_CODE,
  ...BROTHERHOOD_ENEMY_CODES,
])
export const SET_ASIDE_ALIASES = Object.freeze([...new Set(SET_ASIDE_CODES)])
export const ENCOUNTER_GROUPS = Object.freeze(['theEternalSlumber', 'theNightsUsurper'])

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  [ACT1_CODE]: Object.freeze({ ...stage(ACT1_CODE, { number: 1 }), objective: { type: 'custom' } }),
  [ACT2_CODE]: Object.freeze({ ...stage(ACT2_CODE, { number: 2 }), objective: { type: 'custom' } }),
  [ACT3_CODE]: Object.freeze({ ...stage(ACT3_CODE, { number: 3 }), objective: { type: 'custom' } }),
})
export const AGENDA_STAGES = Object.freeze({
  [AGENDA1_CODE]: stage(AGENDA1_CODE, { number: 1 }),
  [AGENDA2_CODE]: stage(AGENDA2_CODE, { number: 2 }),
})
export const ACTS = Object.freeze(ACT_CODES.map(code => structuredClone(ACT_STAGES[code])))
export const AGENDAS = Object.freeze(AGENDA_CODES.map(code => structuredClone(AGENDA_STAGES[code])))
export const STAGE_CARDS = Object.freeze(Object.fromEntries([
  ...Object.entries(ACT_STAGES), ...Object.entries(AGENDA_STAGES),
]))

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: { delta: 'X', text: '-X（X = 深渊之力）' },
    cultist: { delta: 0, text: '再抽 1 个标记；若失败且深渊之力 ≤3，深渊之力 +1' },
    tablet: { delta: -1, text: '-1；本次检定无视所有技能值正面修正' },
    elderthing: { delta: -4, text: '-4；若成功且深渊之力 ≥4，深渊之力 -1' },
  }),
  hard: Object.freeze({
    skull: { delta: 'X+1', text: '-X（X = 深渊之力 +1）' },
    cultist: { delta: 0, text: '再抽 1 个标记；若失败且深渊之力 ≤5，深渊之力 +1' },
    tablet: { delta: -3, text: '-3；本次检定无视所有技能值正面修正' },
    elderthing: { delta: -5, text: '-5；若成功且深渊之力 ≥4，深渊之力 -1' },
  }),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale; guide source is authoritative)',
  heading: '夜之篡位者',
  intro: '温洛克捻着胡子，斟酌着你们的话。作为正在达舒尔挖掘的探险队领队，是否让你们加入探险队由他决定。'
    + '「我读过你们收集的证据，也知道开罗发生了什么。我相信你们的故事，但……」他烦恼地叹了口气，'
    + '「我不知道该怎么说服队里其他人。古庙还说得过去，可一道通往异次元的门？那个叫伊扎法拉的家伙？'
    + '这些都不可能是真的吧？」你们的研究与经历告诉你们并非如此：一个秘密组织正在埃及活动——野兽兄弟会；'
    + '若不阻止他们，他们新找到的「选民」将掀起一场以毁灭地球告终的战争。你们最后一次坚持要求使用探险队的资源。'
    + '「好吧，好吧，」温洛克让步了，「我不知道你们在沙漠里找什么，但希望你们找到。」你们摇了摇头——你们宁愿一无所获。',
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收集遭遇组：夜之篡位者、埃及之沙、野兽兄弟会、深渊赠礼。' },
    { key: 'placeLocations', text: '将探险营地放入场；每名调查员从探险营地开始游戏。' },
    { key: 'setAside', text: '将深渊弯刀、召唤夜魇、单面地点超凡之门、双面敌人伊扎法拉、5 张双面异界地点与 2 张可怖山克放到一边（场外）。' },
    { key: 'explorationDeck', text: '组建探索牌库：7 张剩余单面地点 + 深渊领域、黑风、金字塔下的恐怖、蝗虫成群各 1 张。' },
    { key: 'brotherhood', text: '战役模式：把记录在「逃脱的兄弟会特工」下的每名敌人置于剧本参考卡下方；独立模式：洗混 6 名后随机取 3 名置于参考卡下方。' },
    { key: 'strengthOfTheAbyss', text: '战役模式：按「深渊中的沉梦者」括号内数字放置深渊之力；独立模式：放置等同调查员人数的资源标记。' },
  ]),
  specialRules: Object.freeze([
    '故事卡：本支线出现背面为「故事卡」的双面卡；被指示结算故事卡时，读出其故事与游戏文本即可。',
    '深渊之力：剧本参考卡上的资源标记代表深渊之力的当前强度；按卡面指示增减。某些遭遇卡会随深渊之力变强。',
    '被深渊吞没：当调查员或[[盟友]]支援被「深渊吞没」时，先深渊之力 +1；若为独特卡，在战役日志记录「（卡名）被深渊吞没」。',
    '探索：从探索牌库顶逐张翻牌，直到翻出与所在地点符号相连的地点（成功：入场并移动）或诡计（按正常流程结算）。',
  ]),
  rules: Object.freeze({}),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '没有达成任何结局（所有调查员撤退或被击败）：按参考直接进入结局 1「清算之日即将到来」。',
    resolution1: '结局 1：「这只是一道拱门。老板，你这么紧张干什么？」温洛克抱臂。可这一切都透着不对劲——'
      + '他确信这正是那群阿卡姆人寻找的地方：一道雕着精致花纹、却不通向任何地方的拱门；然而温洛克确定，'
      + '拱门的另一侧有什么东西。「这不是埃及的，」他眯眼看着，「甚至不像……人类的。」'
      + '「你信那些疯子？老板，这只是个空门！」一名手下笑道。「是吗？」温洛克厉声反问，「是吗？」'
      + '记录「清算之日即将到来」。',
    resolution2: '结局 2：伊扎法拉体内的精华渐渐消散。翻涌的雾气包围他、逼他跪倒。深渊的生物无声地出现在你们身侧，'
      + '带着沉默而面无表情的恨意围绕伊扎法拉。他的剑背叛了他，从手中滑落，剑刃在触地时碎裂。'
      + '「……预言必须实现……」这是他最后一句恶毒的耳语。他的形体化入此界的雾中，大深渊归于寂静。'
      + '记录「深渊已被拯救」，划掉所有「被深渊吞没」；任意一名调查员可将召唤夜魇加入牌组（不计入牌组张数）。',
    resolution3: '结局 3：伊扎法拉冰冷的手按在跪倒于他面前的你们的肩上。「你们的忠诚已得到证明，」他宣告。'
      + '深渊的生物围在你们周围，向新主人低头致敬——再没有人能反抗他。'
      + '「你们之中少有能看见眼下之外、看见预言实现的人。但你们有资格睁开双眼，比那些我过去信任的蠢货更有资格。」'
      + '他示意你们起身，把浸血之剑的剑柄放到你们手中。「起来吧，野兽的仆人，在我們之中取得你的位置。」'
      + '记录「你们与伊扎法拉联手」；任意一名调查员可将深渊弯刀加入牌组（不计入牌组张数）。',
  }),
  resolutionBranches: Object.freeze({
    noResolution: '按参考直接结算结局 1。',
    resolution1: '记录「清算之日即将到来」；结算经验。',
    resolution2: '记录「深渊已被拯救」，划掉所有「被深渊吞没」；任意一名调查员获得召唤夜魇；结算经验。',
    resolution3: '记录「你们与伊扎法拉联手」；任意一名调查员获得深渊弯刀；结算经验。',
  }),
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
const CARD_CODES = Object.freeze([
  REFERENCE_CODE, ...ACT_CODES, ...AGENDA_CODES,
  ...LOCATION_ROWS.map(row => row.code),
  ...BROTHERHOOD_ENEMY_CODES, ...BROTHERHOOD_ENEMY_CODES,
  XZHARAH_CODE, XZHARAH_STORY_CODE,
  ...OTHERWORLD_STORY_CODES,
  DREADED_SHANTAK_CODE, SPEAKER_CODE,
  KHOPESH_CODE, SUMMONED_NIGHTGAUNT_CODE, ANCIENT_ANKH_CODE, JOHN_AND_JESSIE_CODE,
  '83045', '83046', '83047', '83048', '83049', '83050', '83051', '83052', '83053', '83054',
])
export const CARD_DATA = Object.freeze(Object.fromEntries(CARD_CODES.map(code => [code, ALL_CARDS[code]])))

const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK, ...BROTHERHOOD_ENEMY_CODES, XZHARAH_CODE,
  KHOPESH_CODE, SUMMONED_NIGHTGAUNT_CODE,
])
const stories = encounterDefinitions([
  ...OTHERWORLD_STORY_CODES, XZHARAH_STORY_CODE, ...BROTHERHOOD_ENEMY_CODES.map(code => `${code.slice(0, 5)}b`),
])

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '夜之篡位者 · The Night\'s Usurper',
  nameEn: "The Night's Usurper",
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '依照剧本参考卡 83016 与参考支线的设置页布置：探索牌库 11 张；兄弟会特工与深渊之力按战役/独立模式分别初始化；独立开局每人 2 XP。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: Object.freeze([...SCENARIO_TEXT.specialRules]),
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  storyCards: { ...stories.storyAssets },
  otherworldPairs: OTHERWORLD_ROWS,
  encounterDeck: [...ENCOUNTER_DECK],
  explorationDeck: [...EXPLORATION_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionBranches: { ...SCENARIO_TEXT.resolutionBranches },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
  cardData: CARD_DATA,
}

export const identities = bindIdentities(scenario)
export default scenario
