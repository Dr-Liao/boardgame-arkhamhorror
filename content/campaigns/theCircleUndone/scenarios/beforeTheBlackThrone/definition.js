// 《黑色王座》（Before the Black Throne，05325）· 关卡定义
//
// 参考实现：Scenario/Scenarios/TheCircleUndone/BeforeTheBlackThrone.hs +
// BeforeTheBlackThrone/{Helpers.hs,Cosmos.hs} + Location/CardDefs/TheCircleUndone/BeforeTheBlackThrone.hs +
// {Act,Agenda,Enemy,Treachery}/Cards/TheCircleUndone/BeforeTheBlackThrone/。
// 中文文案：frontend/src/locales/zh/theCircleUndone/scenarios/beforeTheBlackThrone.json
//
// Cosmos 用 P2.13 地点牌库（api.cosmos）近似：9 张地点卡按印刷张数展开成 16 个地点 id，
// 其中 12 个进「宇宙」牌库；憎恶宫殿/皇廷/黑色王座是三个已揭示面，由幕推进放置。
// 网格/相邻/虚空格子/「宇宙 -」连接指令的等价实现见 behavior.js 的 scenarioApproximations。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor,
} from '../../card-data.js'

export const AZATHOTH = '05346'
export const PIPER = '05088'
export const DAEMONIC_PIPING = '05089'
export const MIND_DANCER = '05341'
export const ULTIMATE_CHAOS = '05342'
export const WHISPERED_BARGAIN = '05343'
export const THE_END_IS_NIGH = '05344'
export const A_WORLD_IN_DARKNESS = '05345'

export const COSMIC_INGRESS = 'cosmicIngress'
export const HIDEOUS_PALACE = 'hideousPalace'
export const COURT = 'courtOfTheGreatOldOnes'
export const BLACK_THRONE = 'theBlackThrone'
export const COSMIC_GATE = 'cosmicGate'
export const DANCERS_MIST = Object.freeze(['dancersMist1', 'dancersMist2', 'dancersMist3'])
export const FLIGHT = Object.freeze(['flightIntoOblivion1', 'flightIntoOblivion2', 'flightIntoOblivion3'])
export const INFINITY = Object.freeze(['infinityOfDarkness1', 'infinityOfDarkness2', 'infinityOfDarkness3'])
export const PATHWAY = Object.freeze(['pathwayIntoVoid1', 'pathwayIntoVoid2'])

// 宇宙牌库的 12 张卡（印刷张数展开成地点 id）。
export const COSMOS_DECK_IDS = Object.freeze([
  ...INFINITY, COSMIC_GATE, ...PATHWAY, ...DANCERS_MIST, ...FLIGHT,
])

// 四个「枢纽」地点（宇宙入口/憎恶宫殿/皇廷/黑王座）：进入时被放置，互相串联成主链。
const HUB_CONNECTIONS = {
  [COSMIC_INGRESS]: [HIDEOUS_PALACE],
  [HIDEOUS_PALACE]: [COSMIC_INGRESS, COURT],
  [COURT]: [HIDEOUS_PALACE, BLACK_THRONE],
  [BLACK_THRONE]: [COURT],
}

// 宇宙地点（未揭示面 = 印刷的「宇宙 -」连接指令；direction 是 placement 指令表的方向）。
function cosmosLocation(id, code, { direction, cost = null } = {}) {
  return location(id, code, {
    connections: [],
    cosmos: { direction, ...(cost ? { cost } : {}) },
  })
}

const locations = {
  cosmicIngress: location(COSMIC_INGRESS, '05332', { connections: HUB_CONNECTIONS[COSMIC_INGRESS] }),
  hideousPalace: location(HIDEOUS_PALACE, '05333', { connections: HUB_CONNECTIONS[HIDEOUS_PALACE] }),
  courtOfTheGreatOldOnes: location(COURT, '05334', { connections: HUB_CONNECTIONS[COURT] }),
  theBlackThrone: location(BLACK_THRONE, '05335', {
    connections: HUB_CONNECTIONS[BLACK_THRONE],
    // 卡面：[skull 值] 隐藏值 + ceil(阿撒托斯毁灭/2) 由 behavior.locationShroudModifier 提供。
    // 闹鬼 - 在阿撒托斯上放 1 毁灭，或阿撒托斯攻击你（behavior.hauntedScript）。
    haunted: [{
      text: '闹鬼 - 你必须在阿撒托斯上放置 1 个毁灭标记，或阿萨托斯攻击你。',
      effect: [{ kind: 'script', id: 'blackThroneHaunt' }],
    }],
  }),
  // 无尽黑暗（3）：宇宙 - 与下方连接，或受到 2 点伤害与最靠下的已揭示地点任意方向连接。
  ...Object.fromEntries(INFINITY.map((id, index) => [id,
    cosmosLocation(id, '05338', { direction: 'down', cost: { damage: 2 } })])),
  // 宇宙门扉（1）：宇宙 - 与任意一个已揭示地点的任意方向连接。
  cosmicGate: cosmosLocation(COSMIC_GATE, '05339', { direction: 'any' }),
  // 虚空之路（2）：宇宙 - 与任意方向连接。
  ...Object.fromEntries(PATHWAY.map(id => [id, cosmosLocation(id, '05340', { direction: 'any' })])),
  // 舞者之雾（3）：宇宙 - 必须与右方连接，或失去 2 资源与相邻地点任意方向连接。
  ...Object.fromEntries(DANCERS_MIST.map(id => [id,
    cosmosLocation(id, '05336', { direction: 'right', cost: { resources: 2 } })])),
  // 飞入湮灭（3）：宇宙 - 必须与上方连接，或受到 2 点恐惧与最靠上的已揭示地点任意方向连接。
  ...Object.fromEntries(FLIGHT.map(id => [id,
    cosmosLocation(id, '05337', { direction: 'up', cost: { horror: 2 } })])),
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export const ACT_CODES = Object.freeze(['05329', '05330', '05331'])
export const AGENDA_CODES = Object.freeze(['05326', '05327', '05328'])

const acts = stages(ACT_CODES, 'act').map((act, index) => ({
  ...act,
  reveal: { type: 'campaignRule' },
  ...(index === 0 ? { objective: { type: 'clues', perInvestigator: 1, atLocation: HIDEOUS_PALACE } } : {}),
  ...(index === 1 ? { objective: { type: 'clues', perInvestigator: 2, atLocation: COURT } } : {}),
  // 幕 3 目标由 behavior.checkObjectives 判定（队长在黑色王座且该地点无线索）。
}))

// ---------------------------------------------------------------------------
// 遭遇牌库
//
// 参考实现收 5 组；DarkCult 在本仓库卡表里没有 dark_cult 组（Acolyte/Wizard/Mysterious Chanting
// 归在 pentagram 组），作为近似登记（approximation）。阿撒托斯 05346 与吹笛手 05088 不入牌库。
// ---------------------------------------------------------------------------
export const DECK_GROUPS = Object.freeze([
  'beforeTheBlackThrone', 'agentsOfAzathoth', 'inexorableFate', 'ancientEvils', 'pentagram',
])
const sideCodes = new Set([AZATHOTH, PIPER])
const gathered = Object.freeze(encounterCards(DECK_GROUPS).filter(card => !sideCodes.has(card.code)))
const definitions = encounterDefinitions([
  ...gathered,
  ALL_CARDS[AZATHOTH],
  ALL_CARDS[PIPER],
])
// 阿撒托斯不在任何地点、免疫玩家效果、不能被击败：数据上标记，行为层用 scenarioFlags 计时。
Object.assign(definitions.enemies[AZATHOTH], {
  rulesPending: false,
  cannotBeDefeated: true,
  immuneToPlayerCards: true,
  omnipotent: true,
  spawnAt: null,
})

export const scenario = {
  id: 'beforeTheBlackThrone',
  originalCode: '05325',
  name: '万象无终 · 黑色王座',
  intro: '坐骑载着你们冲进宇宙彼端的虚空。形如水螅的恐怖生物在黑暗中缓缓移动，'
    + '而在这片瑰丽又残酷的星空尽头，盲目痴愚之神阿撒托斯正随着不谐的笛声沉眠——你们必须赶在它醒来之前抵达黑色王座。',
  setup: '收齐黑色王座、阿撒托斯的使徒、在劫难逃、远古恶魔与黑暗异教徒遭遇组。'
    + '把憎恶宫殿、旧日支配者皇廷与黑色王座放一边；宇宙入口入场，调查员从宇宙入口开始；'
    + '剩余地点以「宇宙」面朝上混洗成宇宙牌库；阿撒托斯入场（不在任何地点）；吹笛手放一边。'
    + '按剧本日志「你面前的道路蜿蜒曲折」的次数在冒险参考卡上放资源。',
  startLocation: COSMIC_INGRESS,
  locations,
  setAsideLocations: [COURT, BLACK_THRONE],
  acts,
  agendas: stages(AGENDA_CODES, 'agenda').map(agenda => ({ ...agenda, reveal: { type: 'campaignRule' } })),
  // 三张幕都印着 [action] 花费 X 线索：抽取宇宙顶 X 张，选 1 放置。
  scriptCards: { rules: { actCosmosTake: { card: 'act', codes: [...ACT_CODES] } } },
  ...definitions,
  storyAssets: {},
  encounterDeck: encounterDeck(gathered),
  resolutions: {
    noResolution: '阿撒托斯从终极虚空的王座上升起，吞食了整个宇宙——一切归于寂静。全员死亡，世界进入终局（→ 结局 1）。',
    r1: '原初混沌苏醒，张开巨口吞下宇宙。在这空虚的宇宙中央，盲目痴愚之神再次入睡，'
      + '它的梦境向四面八方扩散，诞生了一个新的宇宙。每位调查员死亡，记录「阿撒托斯吞食了宇宙」。',
    r2: '吹笛人的乐声被打断，阿撒托斯开始活动；调查员队长选择加入吹笛人，用新的催眠曲让它重新入睡。'
      + '阿撒托斯暂时沉睡，队长发疯，每位调查员受到 2 点精神创伤。',
    r3: '你们用从女巫斗篷取来的幽暗精华、鬼魂身上的一缕鬼灵迷雾与阿卡姆历史的知识编织壁障，'
      + '让阿撒托斯重新沉入梦乡。每位调查员受到 2 点物理创伤。',
    r4: '你们来到阿撒托斯黑如深夜的王座，却无法杀死它。绝望中你们翻开凯夏的黑书寻找答案——'
      + '你必须在黑书上签下名字，或者拒绝。',
    r5: '你用鹅毛笔刺破手臂，蘸着鲜血在黑书上签下姓名：阿撒托斯睡着……暂时是的。'
      + '每位调查员受到 2 点伤害与 2 点恐惧（物理与精神创伤各 2）。',
    r6: '你们逆转了咒语，用古老的知识把阿撒托斯重新送进梦乡。每位调查员受到 1 点物理与 1 点精神创伤。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
