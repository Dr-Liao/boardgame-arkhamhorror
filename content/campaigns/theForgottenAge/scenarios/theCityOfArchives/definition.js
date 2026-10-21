import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

// Haskell setup（Scenario/Scenarios/TheForgottenAge/TheCityOfArchives.hs）：
// gather TheCityOfArchives / AgentsOfYogSothoth / LockedDoors / ChillingCold /
// StrikingFear；把 5 处地点、看管人（04256）与 4 张「离体体验」（04264）放在一边；
// 「合作」记录决定 1 号会谈间是到达厅（04245）还是拘束室（04246），
// 另一间与充满脓液的房间（04247）随机分配到 2/3 号会谈间。
const deckGroups = ['the_city_of_archives', 'agents_of_yog', 'locked_doors', 'chilling_cold', 'striking_fear']
// 04264「离体体验」是带 4 张的弱点：只在幕间四按判定结果加入调查员牌组，
// 从不进入本章遭遇牌库（Haskell gather 之后由战役层另行处理）。
const gathered = encounterCards(deckGroups).filter(card => card.code !== '04264')
const definitions = encounterDefinitions(gathered)

// 三个会谈间槽位与三处纳克特廊道。会谈间的卡面在布置时随机换位，
// 因此槽位身份按「印刷顺序」记录，运行期由 state.locationVariants 覆盖。
export const ROOM_CODES = { arrival: '04245', restraining: '04246', ichor: '04247' }
export const ROOM_SLOTS = ['interviewRoom1', 'interviewRoom2', 'interviewRoom3']
export const HALLS_SLOTS = ['hallsNorthern', 'hallsEastern', 'hallsWestern']
export const SET_ASIDE_LOCATIONS = [
  'greatLibrary', 'yithianOrrery', 'laboratory', 'deconstructionRoom', 'towersOfPnakotus',
]
// 场景卡 2b 上列出的 5 项任务（第 6 项是「控制看管人」）。
export const REMEMBERED_TASKS = [
  'foundTheProcess', 'dissectedAnOrgan', 'interviewedASubject', 'realizedWhatYearItIs',
  'activatedTheDevice',
]
export const TASK_LABELS = {
  foundTheProcess: '找到了归位程式',
  dissectedAnOrgan: '解剖了一个器官',
  interviewedASubject: '进行了一次会谈',
  realizedWhatYearItIs: '发现了现在的年份',
  activatedTheDevice: '启动了设备',
}
export const CUSTODIAN_CODE = '04256'
export const OBSERVER_CODE = '01177'

const locations = {
  // 会谈间：符号为印刷的「水滴」（SYMBOLS 表里没有这个符号，按原样保留 key），
  // 与菱形（东侧廊道）相连。
  interviewRoom1: location('interviewRoom1', ROOM_CODES.arrival, {
    symbol: 'droplet', links: ['diamond'],
  }),
  interviewRoom2: location('interviewRoom2', ROOM_CODES.restraining, {
    symbol: 'droplet', links: ['diamond'],
  }),
  interviewRoom3: location('interviewRoom3', ROOM_CODES.ichor, {
    symbol: 'droplet', links: ['diamond'],
  }),
  // 纳克特廊道：波浪（北）/ 菱形（东）/ 方形（西）。
  hallsNorthern: location('hallsNorthern', '04248', {
    symbol: 'squiggle', links: ['diamond', 'square', 'triangle'],
  }),
  hallsEastern: location('hallsEastern', '04249', {
    symbol: 'diamond', links: ['squiggle', 'square', 'droplet'],
  }),
  hallsWestern: location('hallsWestern', '04250', {
    symbol: 'square', links: ['squiggle', 'diamond', 'circle', 'star'],
  }),
  greatLibrary: location('greatLibrary', '04251', { symbol: 'circle', links: ['square'] }),
  yithianOrrery: location('yithianOrrery', '04252', { symbol: 'moon', links: ['triangle'] }),
  laboratory: location('laboratory', '04253', {
    symbol: 'triangle', links: ['squiggle', 'moon', 'equals'],
  }),
  deconstructionRoom: location('deconstructionRoom', '04254', {
    symbol: 'equals', links: ['triangle'],
  }),
  // 纳克特之塔：印刷符号是「星」，同样不在 SYMBOLS 表里。
  towersOfPnakotus: location('towersOfPnakotus', '04255', { symbol: 'star', links: ['square'] }),
}
linkSymbolLocations(locations)

export const scenario = {
  id: 'theCityOfArchives',
  originalCode: '04237',
  name: '失落的时代 · 天机之城',
  intro: '你们在纳克特醒来，身披伊斯人的身体。这座图书馆收藏着地球的全部记忆，'
    + '而你们必须在自己彻底忘记人类身份之前找到回去的路。',
  setup: '收齐“天机之城、约格·索托斯的使徒、锁住的门、刺骨严寒、骇人恐惧”遭遇组；'
    + '把大图书馆、伟大种族的实验室、伊斯的太阳系仪、解构室、纳克特之塔、《看管人》'
    + '与 4 张「离体体验」放在一边。按战役记录“合作/反抗”决定 1 号会谈间的卡面，'
    + '另外两间随机放置，三处纳克特廊道全部入场。所有人以伊斯人身体（04244）开始。',
  startLocation: 'interviewRoom1',
  locations,
  setAsideLocations: SET_ASIDE_LOCATIONS,
  acts: stages(['04241', '04242', '04243'], 'act').map((act, index) => ({
    ...act,
    reveal: { type: 'campaignRule' },
    // 场景 1a：每位调查员共同花费 2 个线索（任意地点）。
    ...(index === 0 ? { objective: { type: 'clues', perInvestigator: 2 } } : {}),
  })),
  agendas: stages(['04238', '04239', '04240'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  // 04243 印着 [action]：花 1 线索抽取 2 张。
  scriptCards: { rules: { repossessionDraw: { card: 'act', codes: ['04243'] } } },
  ...definitions,
  storyAssets: storyCards([CUSTODIAN_CODE]),
  encounterDeck: encounterDeck(gathered),
  resolutions: {
    noResolution: '你们彻底忘记了人类身份。记录“调查员们的记忆被抹除”，幸存的调查员全部发疯，'
      + '天机之城把你们的意识永远留在纳克特。',
    r1: '归位程式启动。统计你们在城中完成的任务：合计 6 项 → 记录“过程被完善”（+4 奖励经验）；'
      + '5 项 → 记录“过程成功了”（+2）；4 项 → 记录“过程适得其反”（+1）；'
      + '3 项 → 记录“过程适得其反，且极为壮观”。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

// 仅供 behavior.js / 测试使用的原卡号常量。
export const CARD_CODES = Object.freeze({
  scenario: '04237',
  agenda1: '04238',
  agenda2: '04239',
  agenda3: '04240',
  act1: '04241',
  act2: '04242',
  act3: '04243',
  bodyOfAYithian: '04244',
  greatLibrary: '04251',
  yithianOrrery: '04252',
  laboratory: '04253',
  deconstructionRoom: '04254',
  towersOfPnakotus: '04255',
  custodian: '04256',
  keeper: '04257',
  scientist: '04258',
  scholar: '04259',
  yithianPresence: '04260',
  cruelInterrogations: '04261',
  lostHumanity: '04262',
  captiveMind: '04263',
  outOfBodyExperience: '04264',
})

export const isItemAsset = code => {
  const card = ALL_CARDS[code]
  return !!card && card.type === 'asset' && (card.traits || []).includes('Item')
}
