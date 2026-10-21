import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

// Haskell setupThreadsOfFate：gather ThreadsOfFate / PnakoticBrotherhood / LockedDoors /
// Nightgaunts / DarkCult（目录里的组名是 pentagram），再用 gatherJust 取夜之狂热的
// 追猎鬼影与错误指示各 1 张。哈伦／亨利／玛利亚三张敌人卡是幕卡背面，不能进遭遇牌库。
const deckGroups = ['threads_of_fate', 'pnakotic_brotherhood', 'locked_doors', 'nightgaunts', 'pentagram']
export const ACT_BACK_ENEMIES = ['04122b', '04130b', '04137b']
const gathered = encounterCards(deckGroups)
const midnightExtras = ['01135', '01136'].map(code => ({ ...ALL_CARDS[code], quantity: 1 }))
const deckCards = [
  ...gathered.filter(card => !ACT_BACK_ENEMIES.includes(card.code)),
  ...midnightExtras,
]
const definitions = encounterDefinitions([...gathered, ...midnightExtras])

// ---------------------------------------------------------------------------
// 地图：阿卡姆（夜之狂热的核心地点 + 命运之线的 TFA 地点）。起点是河岸城。
// 符号相连规则照印刷：TFA 地点用「本地点符号 → 相连符号」推导；没有符号的地点
// （维尔玛小餐馆、珍品店、市政厅、警察局、火车轨道）按卡面文字与指定地点相连。
// ---------------------------------------------------------------------------
const locations = {
  // 河岸城是本章的中心地点：核心遭遇卡「乘着黑暗之翼」（01173）会把调查员退到这里。
  rivertown: location('rivertown', '01125', {
    symbol: 'circle', links: ['moon', 'diamond', 'square', 'squiggle', 'hourglass'], central: true,
  }),
  northside: location('northside', '01134', { symbol: 't', links: ['diamond', 'triangle'] }),
  downtown: location('downtown', '01130', { symbol: 'triangle', links: ['moon', 't'] }),
  easttown: location('easttown', '01132', { symbol: 'moon', links: ['circle', 'triangle'] }),
  miskatonicUniversity: location('miskatonicUniversity', '01129', {
    symbol: 'diamond', links: ['t', 'plus', 'circle', 'square'],
  }),
  velmasDiner: location('velmasDiner', '04141', { explicitConnections: ['easttown'] }),
  curiositieShoppe: location('curiositieShoppe', '04142', { explicitConnections: ['northside'] }),
  townHall: location('townHall', '04143', { explicitConnections: ['downtown'] }),
  eztliExhibit: location('eztliExhibit', '04117b', { symbol: 'plus', links: ['diamond'] }),
  arkhamPoliceStation: location('arkhamPoliceStation', '04126b', { explicitConnections: ['easttown'] }),
  trainTracks: location('trainTracks', '04128b', { explicitConnections: ['northside'] }),
  blackCave: location('blackCave', '04133b', { symbol: 'hourglass', links: ['circle'] }),
}
linkSymbolLocations(locations)
// 无符号地点的连接是双向的（卡面「东城区与维尔玛小餐馆相互连接」）。
const REVERSE_LINKS = {
  velmasDiner: 'easttown',
  curiositieShoppe: 'northside',
  townHall: 'downtown',
  arkhamPoliceStation: 'easttown',
  trainTracks: 'northside',
}
for (const [id, target] of Object.entries(REVERSE_LINKS)) {
  const list = locations[target].connections
  if (!list.includes(id)) list.push(id)
}

export const START_LOCATIONS = [
  'rivertown', 'northside', 'downtown', 'easttown', 'miskatonicUniversity',
  'velmasDiner', 'curiositieShoppe',
]
export const SET_ASIDE_LOCATIONS = ['townHall']
export const THREAD_IDS = ['ab', 'cd', 'ef']

// ---------------------------------------------------------------------------
// 三本幕牌库。Haskell `setupThreadsOfFate` 的选牌逻辑：
//   A/B：给了哈伦保管遗物 → [哈伦遇险, 哈伦的诅咒(随机 1/2), 寻找遗物, 夺回遗物]
//        否则                → [遗物不见了！, 来到展厅(随机 1/2), 寻找遗物, 夺回遗物]
//   C/D：布置时二选一（去警局 / 自己找）
//   E/F：听过伊塔卡的故事 → [守卫者追根究底, 古怪遗物(随机 1/2), 怪事丛生, 兄弟会暴露]
//        否则               → [女猎手的苦旅, 漆黑的洞穴(随机 1/2), 怪事丛生, 兄弟会暴露]
// 每本牌库印刷 4 张，但第三张（3a）只有一张会被「推进到场景 3…」点名使用，因此这里
// 用 [第 1 幕, 第 2 幕, 由第 2 幕点名的第 3 幕] 三步表示。
// next: 'deck' = 卡面「推进场景牌库」（取本线第 2 张）；字符串 = 卡面点名的下一张幕。
// ---------------------------------------------------------------------------
export const ACTS_TABLE = [
  // A/B —— 遗物不见了
  { code: '04117a', thread: 'ab', stage: 1, at: 'miskatonicUniversity', per: 1, next: 'deck' },
  { code: '04118a', thread: 'ab', stage: 1, at: 'miskatonicUniversity', per: 2, next: 'deck' },
  { code: '04119', thread: 'ab', stage: 2, at: 'eztliExhibit', per: 2, next: '04123' },
  { code: '04120', thread: 'ab', stage: 2, at: 'eztliExhibit', per: 2, next: '04124' },
  { code: '04121', thread: 'ab', stage: 2, next: '04123' },
  { code: '04122', thread: 'ab', stage: 2, next: '04124' },
  { code: '04123', thread: 'ab', stage: 3, next: null },
  { code: '04124', thread: 'ab', stage: 3, next: null },
  // C/D —— 寻找亚历山卓
  { code: '04125a', thread: 'cd', stage: 1, at: 'easttown', per: 1, next: 'deck' },
  { code: '04126a', thread: 'cd', stage: 1, at: 'easttown', per: 1, next: 'deck' },
  { code: '04127', thread: 'cd', stage: 2, at: 'arkhamPoliceStation', per: 2, next: '04132' },
  { code: '04128a', thread: 'cd', stage: 2, at: 'arkhamPoliceStation', per: 2, next: '04131' },
  { code: '04129', thread: 'cd', stage: 2, next: '04131' },
  { code: '04130a', thread: 'cd', stage: 2, next: '04132' },
  { code: '04131', thread: 'cd', stage: 3, next: null },
  { code: '04132', thread: 'cd', stage: 3, next: null },
  // E/F —— 伊塔卡的猎物
  { code: '04133a', thread: 'ef', stage: 1, at: 'rivertown', per: 2, next: 'deck' },
  { code: '04134a', thread: 'ef', stage: 1, at: 'northside', per: 1, next: 'deck' },
  { code: '04135', thread: 'ef', stage: 2, rule: true, next: '04140' },
  { code: '04136', thread: 'ef', stage: 2, rule: true, next: '04139' },
  { code: '04137a', thread: 'ef', stage: 2, next: '04140' },
  { code: '04138', thread: 'ef', stage: 2, next: '04139' },
  { code: '04139', thread: 'ef', stage: 3, next: null },
  { code: '04140', thread: 'ef', stage: 3, next: null },
]

export const ACTS_BY_CODE = Object.fromEntries(ACTS_TABLE.map(entry => [entry.code, entry]))

const acts = stages(ACTS_TABLE.map(entry => entry.code), 'act').map((act, index) => {
  const table = ACTS_TABLE[index]
  return {
    ...act,
    stage: `${table.stage}a`,
    thread: table.thread,
    threadStage: table.stage,
    next: table.next,
    reveal: { type: 'campaignRule' },
    objective: table.at
      ? { type: 'clues', perInvestigator: table.per, atLocation: table.at }
      : { type: 'actRule' },
  }
})

// 第三步的卡面目标各自不同（地点无线索 / 敌人离场 / 资产上有线索），
// 统一交给 behavior.checkObjectives 判定。
export const SPECIAL_ACT_OBJECTIVES = {
  '04121': { kind: 'bystanderClues', asset: '04118b' },
  '04122': { kind: 'bystanderClues', asset: '04118b' },
  '04123': { kind: 'relicLocationEmpty' },
  '04124': { kind: 'relicCarrierLeftPlay' },
  '04129': { kind: 'bystanderClues', asset: '04125b' },
  '04130a': { kind: 'bystanderClues', asset: '04125b' },
  '04131': { kind: 'alejandroLocationEmpty' },
  '04132': { kind: 'alejandroCarrierLeftPlay' },
  '04135': { kind: 'caveClues', per: 2, at: 'blackCave' },
  '04136': { kind: 'caveClues', per: 2, at: 'blackCave' },
  '04137a': { kind: 'bystanderClues', asset: '04134b' },
  '04138': { kind: 'bystanderClues', asset: '04134b' },
  '04139': { kind: 'destinationsEmpty' },
  '04140': { kind: 'preyGone' },
}

export const scenario = {
  id: 'threadsOfFate',
  originalCode: '04113',
  name: '失落的时代 · 命运之线',
  intro: '三条线索在阿卡姆交缠：失踪的古代遗物、下落不明的亚历山卓·维拉，以及伊塔卡追猎的兄弟会异教徒。'
    + '你们只有有限的时间，每推进一条线，另外两条也在暗中发酵。',
  setup: '收齐“命运之线、兄弟会、上锁的门、夜魇、黑暗教团”遭遇组，再取“追猎鬼影”“错误指示”各 1 张。'
    + '以河岸城为起点，放置北区、商业区、东城区、米斯卡塔尼克大学、维尔玛小餐馆、珍品店。'
    + '把市政厅、伊塔卡、探险日志、亚历山卓·维拉、古代遗物放在一边。'
    + '按战役记录组出三本幕牌库（A/B 遗物线、C/D 亚历山卓线、E/F 伊塔卡线），密谋牌库固定为三张。',
  startLocation: 'rivertown',
  locations,
  setAsideLocations: SET_ASIDE_LOCATIONS,
  acts,
  agendas: stages(['04114', '04115', '04116'], 'agenda').map(agenda => ({
    ...agenda, reveal: { type: 'campaignRule' },
  })),
  // 04114–04116 印着 [action]：撤退。
  scriptCards: { rules: { resignAgenda: { card: 'agenda', codes: ['04114', '04115', '04116'] } } },
  ...definitions,
  storyAssets: storyCards(['04118b', '04125b', '04134b', '04147', '04148']),
  encounterDeck: encounterDeck(deckCards),
  resolutions: {
    noResolution: '你们带着已搜集到的信息撤离阿卡姆。已经完成的那几条线留下了记录，'
      + '剩下的线索沉入更深的阴影里：遗物、亚历山卓、伊塔卡的下落都按已完成的幕牌库结算。',
    r1: '三条线全部收束：遗物的位置、亚历山卓的下落、伊塔卡追猎的真相都水落石出。'
      + '你们完成了全部三本幕牌库，获得对应的战役记录与经验。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
