// 惑人返场（Enthralling Encore · 90094）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/EnthrallingEncore.hs（setup / 混乱袋 / 结局 / 道具牌库与小节）
//   Act|Agenda|Enemy|Location CardDefs（EnthrallingEncore / CurtainCall）
//   frontend/src/locales/en/standalone/enthrallingEncore.json（intro / setup / tokens / resolutions）
//
// 归属：本关专属卡 90094–90097（90094 为剧本提示卡），遭遇组 enthralling_encore；
// 地点复用《卡尔克萨之路·谢幕》（Curtain Call，03049–03058）；道具牌库为规则书建议的
// 15 张 0 级非盟友支援（本 Mod 用固定清单近似）。
//
// 本关口径（近似项见 behavior.js 文件头）：
//   1. 萝拉·海耶斯（平行 90087）必须在场；全员从剧院开始。
//   2. 剧院、前厅、楼座、后台入场（剧院已揭示）；前厅/后台揭示时各放 2 张私密地点入场。
//   3. 邪恶独奏者生成在后台。
//   4. 道具牌库 15 张、小节（measures）从剧本参考卡上的资源记账开始（本 Mod 用纯数值记账）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, printed, identitiesFor,
} from '../../../thePathToCarcosa/card-data.js'

export const CHAPTER_ID = 'enthrallingEncore'
export const REFERENCE_CODE = '90094'
export const ENCOUNTER_CODE = 'enthralling_encore'
export const KEY_INVESTIGATOR = '90087' // 平行萝拉·海耶斯
export const ACT_CODE = '90096'
export const AGENDA_CODE = '90095'
export const SOLOIST_CODE = '90097'
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])
export const START_LOCATION = 'theatre'

// 遭遇组：本关专属 + 谢幕与共享组。
export const ENCOUNTER_GROUPS = Object.freeze([
  'enthralling_encore', 'curtain_call', 'decay', 'delusions',
  'hauntings', 'ghouls', 'striking_fear', 'rats',
])

// 道具牌库（规则书建议清单：每职介 3 张 0 级非盟友支援，共 15 张）。
export const PROPS_DECK_CODES = Object.freeze([
  '50001', '01019', '12020', // 守卫者：Physical Training / First Aid / Machete
  '01031', '50003', '01035', // 探求者：Old Book of Lore / Hyperawareness / Medical Texts
  '01045', '01046', '50005', // 流浪者：Burglary / Pickpocketing / Hard Knocks
  '01059', '01061', '50007', // 潜修者：Holy Rosary / Scrying / Arcane Studies
  '01074', '50010', '50009', // 求生者：Baseball Bat / Rabbit's Foot / Dig Deep
])

// 私密地点（谢幕的六个房间；本关在前厅/后台揭示时各放 2 张）。
export const PRIVATE_LOCATIONS = Object.freeze({
  lobby: Object.freeze(['lightingBox', 'boxOffice', 'greenRoom']),
  backstage: Object.freeze(['dressingRoom', 'rehearsalRoom', 'trapRoom']),
})
export const PRIVATE_LOCATION_IDS = Object.freeze(Object.values(PRIVATE_LOCATIONS).flat())

// 地点（谢幕印刷卡；前厅↔楼座/私密地点，后台↔私密地点）。
export const LOCATIONS = Object.freeze({
  theatre: location('theatre', '03049', ['lobby', 'backstage']),
  lobby: location('lobby', '03050', ['theatre', 'balcony', 'lightingBox', 'boxOffice', 'greenRoom']),
  balcony: location('balcony', '03051', ['theatre', 'lobby']),
  backstage: location('backstage', '03052', ['theatre', 'dressingRoom', 'rehearsalRoom', 'trapRoom']),
  lightingBox: location('lightingBox', '03053', ['lobby'], { playCostIncrease: 2 }),
  boxOffice: location('boxOffice', '03054', ['lobby']),
  greenRoom: location('greenRoom', '03055', ['lobby']),
  dressingRoom: location('dressingRoom', '03056', ['backstage']),
  rehearsalRoom: location('rehearsalRoom', '03057', ['backstage']),
  trapRoom: location('trapRoom', '03058', ['backstage']),
})

export const LOCATION_COORDINATES = Object.freeze({
  lobby: { x: 0, y: 1 }, theatre: { x: 1, y: 1 }, backstage: { x: 2, y: 1 },
  balcony: { x: 1, y: 0 }, lightingBox: { x: 0, y: 0 }, boxOffice: { x: 0, y: 2 },
  greenRoom: { x: 1, y: 2 }, dressingRoom: { x: 2, y: 0 }, rehearsalRoom: { x: 3, y: 1 },
  trapRoom: { x: 2, y: 2 },
})

// 遭遇牌：排除剧本参考/幕/议程/地点、被移出游戏的两张敌人与独奏者本身。
const REMOVED_CODES = Object.freeze(['03059', '03060'])
const NON_DECK_TYPES = new Set(['scenario', 'act', 'agenda', 'location', 'story'])
const gathered = encounterCards(ENCOUNTER_GROUPS)
const deckCards = gathered.filter(card => !NON_DECK_TYPES.has(card.type)
  && !REMOVED_CODES.includes(card.code) && card.code !== SOLOIST_CODE)
export const ENCOUNTER_DECK = Object.freeze(encounterDeck(deckCards))

const definitions = encounterDefinitions([
  ...deckCards,
  ALL_CARDS[SOLOIST_CODE],
].filter(Boolean))
const soloist = definitions.enemies[SOLOIST_CODE]
if (soloist) {
  Object.assign(soloist, {
    alert: true, aloof: true, elusive: true, hunter: true,
    healthPerInvestigator: true, victory: 2,
  })
}

// 幕 / 议程（印刷卡号即阶段）。
const actStage = { ...stages([ACT_CODE], 'act')[0], reveal: { type: 'campaignRule' }, objective: { type: 'manual' }, advanceText: ALL_CARDS[ACT_CODE].backTextZh || '' }
const agendaBase = { ...stages([AGENDA_CODE], 'agenda')[0], reveal: { type: 'campaignRule' }, advanceText: ALL_CARDS[AGENDA_CODE].backTextZh || '' }
// 印刷的议程背面会重置/翻回本密谋，因此按 5 个副本书表达累计轨（第 5 次推进进入结局 2）。
export const ACTS = Object.freeze([actStage])
export const AGENDAS = Object.freeze([
  Object.assign({}, structuredClone(agendaBase), { id: 'agenda1', stage: '1a' }),
  Object.assign({}, structuredClone(agendaBase), { id: 'agenda2', stage: '2a' }),
  Object.assign({}, structuredClone(agendaBase), { id: 'agenda3', stage: '3a' }),
  Object.assign({}, structuredClone(agendaBase), { id: 'agenda4', stage: '4a' }),
  Object.assign({}, structuredClone(agendaBase), { id: 'agenda5', stage: '5a' }),
])
export const STAGE_CARDS = Object.freeze({ [ACT_CODE]: actStage, [AGENDA_CODE]: agendaBase })

export const TOKEN_MEANINGS = Object.freeze({
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为小节数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-2。如果你检定失败，你必须花费 1 个线索或受到 1 点伤害。', delta: -2 }),
    tablet: Object.freeze({ text: '-3（如果你控制的卡牌中有至少 3 个职介，改为 -5）。', delta: -3 }),
    elderthing: Object.freeze({ text: '-2。如果邪恶独奏者位于你所在地点，揭示另一个标记。', delta: -2 }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为小节数量 +1。', delta: 0 }),
    cultist: Object.freeze({ text: '-3。如果你检定失败，你必须花费 1 个线索并受到 1 点伤害。', delta: -3 }),
    tablet: Object.freeze({ text: '-4（如果你控制的卡牌中有至少 3 个职介，改为 -6）。', delta: -4 }),
    elderthing: Object.freeze({ text: '-3。如果邪恶独奏者位于你所在地点，改为自动失败。', delta: -3 }),
  }),
})

export const tokenTier = state => (['hard', 'expert'].includes(String(state?.difficulty || 'standard')) ? 'hard' : 'standard')

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh',
  textStatus: 'authored-zh (mirrors printed English locale)',
  heading: '惑人返场',
  intro: '每个人在人生这出戏里都有自己的角色。你不确定自《黄衣之王》来到阿卡姆的沃德剧院以来过了多久。'
    + '从那以后，你就把这件事抛在脑后，只当是一场无法解释、却异常鲜明的幻觉。但后来你听见了它。'
    + '起初它只在梦里出现——那出戏管弦乐谱的萦绕旋律，如今由一把小提琴独奏。'
    + '它把你引到了阿卡姆一个你一直回避的角落：沃德剧院。剧院漆黑寂静，只有那支只有你能听见的旋律……',
  introBranches: Object.freeze({}),
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: '收齐以下遭遇组：惑人返场、谢幕、腐朽与污秽、妄想、如影随形、食尸鬼、恐惧打击、老鼠。除惑人返场外均可在核心包与《卡尔克萨之路》战役扩展中找到。原《谢幕》的剧本参考卡、幕与议程移出游戏。' },
    { key: 'propsDeck', text: '组建道具牌库：从每个职介（守卫者、探求者、流浪者、潜修者、求生者）各找 3 张 0 级非盟友支援，共 15 张（尽量不重复），洗混后放在剧本参考卡旁。（规则书建议清单：Physical Training、First Aid、Machete、Old Book of Lore、Hyperawareness、Medical Texts、Burglary、Pickpocketing、Hard Knocks、Holy Rosary、Scrying、Arcane Studies、Baseball Bat、Rabbit\'s Foot、Dig Deep。）' },
    { key: 'removeCards', text: '将 The Man in the Pallid Mask 与 Royal Emissary 移出游戏。' },
    { key: 'setAside', text: '将每张前厅走廊门口与后台走廊门口（本 Mod 以六个私密地点近似）放在一边，置于场外。' },
    { key: 'placeLocations', text: '将剧院、前厅、楼座与后台放入场。' },
    { key: 'startAt', text: '每位调查员从剧院开始游戏。' },
    { key: 'sinisterSoloist', text: '将邪恶独奏者敌人放入后台。' },
  ]),
  specialRules: Object.freeze([
    { title: '小节（Measures）', text: '小节以剧本参考卡上的资源表示。每当剧本提示放置一个小节时，就在剧本参考卡上放置 1 个资源。' },
    { title: '道具牌库（Props Deck）', text: '道具牌库是一副独立牌库，包含 15 张 0 级非盟友支援。效果会揭示其顶牌，被抽走的牌进入调查员手牌，其余牌混洗后放回牌库底。' },
    { title: '私密地点（Private Locations）', text: '前厅或后台揭示时，从放在一边的私密地点中随机放 2 张入场。私密地点只与对应的前厅或后台相连。' },
  ]),
  rules: Object.freeze({
    soloist: '邪恶独奏者：警戒、冷漠、逃逸、猎手。在邪恶独奏者所在地点打出非中立卡牌时，作为额外费用你必须受到 1 点恐惧。强制 - 敌人阶段结束时，如果邪恶独奏者处于重整状态：其所在地点与每个连接地点的每位调查员受到 1 点直接恐惧。',
  }),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: '若没有达成任何结局（所有调查员被击败）：跳到结局 2。',
    resolution1: '结局 1：小提琴手被击败后，你只能希望那出亵渎戏剧的最后一缕幽魂终于安息。沃德剧院事件之后的每一天，你的神经都绷得紧紧的，总在等待那段旋律。日子过去，旋律再未回来，仿佛《黄衣之王》相关的一切从未真正发生。但它们确实发生过，不是吗？'
      + '每位调查员获得等于胜利区卡牌胜利点数之和的经验。每位调查员可以选择：把签名卡升级为进阶版，或把进阶版弱点降级为原本版本（若能做到）。无法升级进阶签名卡或降级进阶弱点的调查员改为获得 2 点额外经验。',
    resolution2: '结局 2：再也无法承受独奏者，你双膝跪地，任由旋律压倒性的力量如不可阻挡的洪流般冲刷而过。音符灌满耳朵，淹没了其他一切念头。你的视野褪色，沃德剧院的现实变暗、扭曲，以怪异的角度被拉长。'
      + '……你发现自己躺在舞台落满灰尘的木板上。独奏者消失了。怪物消失了。剧院漆黑，似乎只剩你一人。你缓缓起身，转身逃走。你确信这个地方被诅咒了，这出戏被诅咒了，而这诅咒将困扰你余生。'
      + '每位调查员获得等于胜利区卡牌胜利点数之和的经验。每位调查员必须：把弱点升级为进阶版，或把进阶版签名卡降级为原本版本（若能做到）。',
  }),
})

export const SCENARIO_ACT_TEXT = Object.freeze({
  [ACT_CODE]: '[fast] 位于同一[[私密]]地点的调查员共同花费 1[per_investigator] 个线索：谈判。揭示道具牌库顶的 3 张卡牌，并选择一位调查员抽取其中 1 张。将其余卡牌混洗后放到道具牌库底。'
    + '目标 - 当邪恶独奏者位于胜利区时，推进。',
})
export const SCENARIO_AGENDA_TEXT = Object.freeze({
  [AGENDA_CODE]: '[fast] 位于邪恶独奏者所在地点时，从你手牌弃掉每个职介各 1 张卡牌：谈判。自动躲避邪恶独奏者。本轮剩余时间内，将邪恶独奏者的文字框视为留白（[[特性]]除外）。',
})

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ACT_CODE, AGENDA_CODE, SOLOIST_CODE,
  ...Object.values(LOCATIONS).map(location => location.originalCode),
  ...ENCOUNTER_DECK,
].map(code => [code, ALL_CARDS[code]]).filter(([, card]) => Boolean(card))))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '惑人返场 · Enthralling Encore',
  nameEn: 'Enthralling Encore',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '挑战剧本：萝拉·海耶斯（平行版）必须在场；本批为 1 人独立开局，起始经验 2。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [...PRIVATE_LOCATION_IDS],
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  removedCodes: [...REMOVED_CODES],
  actText: SCENARIO_ACT_TEXT,
  agendaText: SCENARIO_AGENDA_TEXT,
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export { printed }

export default scenario
