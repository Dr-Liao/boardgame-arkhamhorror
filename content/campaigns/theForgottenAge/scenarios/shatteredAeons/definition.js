import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  identitiesFor, linkSymbolLocations,
} from '../../card-data.js'

// Haskell setup（Scenario/Scenarios/TheForgottenAge/ShatteredAeons.hs）：
// 1. 比较混乱袋里 [cultist] 与 [tablet] 的数量：多的一方决定额外收哪一组
//    （邪教徒多 → DarkCult；石板多 → AgentsOfYig；相等 → 两组都收）。本战役的
//    混乱袋只有骷髅/旧神，因此默认走「相等」分支。
// 2. 固定收「破碎永世、纳克特兄弟会、时间洪流、远古恶魔」。
// 3. 把古代遗物（时光涌流）、伊塔卡、亚历山卓、无形之子、7 处地点与两张 4a 幕放在一边。
// 4. 探索牌库 = 3 处异界地点（犹格斯星/拉莱耶海岸/隐匿之城）+ 3 张诡计
//    （时空撕裂/异界之间/远古恶魔各 1 张）。
export const NEXUS = 'nexusOfNKai'
export const POCKET = 'aPocketInTime'
export const RELIC_AGES_UNLEASH = '04343'
export const ICHTACA = '04325'
export const ALEJANDRO = '04326'
export const FORMLESS_SPAWN = '04337'
export const TEMPORAL_DEVOURER = '04338'
export const SHATTERED_AGES_TREACHERY = '04339'
export const BETWEEN_WORLDS = '04340'
export const WRACKED_BY_TIME = '04341'
export const CREEPING_DARKNESS = '04342'
export const ANCIENT_EVILS = '01166'
export const YIGS_MERCY = '04325b'
export const ANOTHER_WAY = '04326b'
// 三张「古代遗物」原卡：重拾往昔（04303）决定结局 5，时光涌流（04343）是本关放在
// 一边的那一张，04061 是埃兹特里带出来的旧版本。
export const RELIC_REPOSSESS_THE_PAST = '04303'
export const RELIC_VARIANTS = ['04061', '04303', '04343']
// 4a 幕的三个版本：修补裂痕/失乐园/锁定时间。
export const MEND_THE_SHATTER = '04321'
export const PARADISE_LOST = '04322'
export const TIMELOCK = '04323'

const deckGroups = [
  'shattered_aeons', 'pnakotic_brotherhood', 'flux', 'ancient_evils', 'agents_of_yig',
]
const setAsideEnemies = [ICHTACA, ALEJANDRO, FORMLESS_SPAWN]
// 三张进入探索牌库的诡计各占用一张实物，遭遇牌库里相应少一张（Haskell 的
// addExtraDeck ExplorationDeck）。
const EXPLORATION_TREACHERY_CODES = [BETWEEN_WORLDS, WRACKED_BY_TIME, ANCIENT_EVILS]
const gathered = encounterCards(deckGroups).filter(card => !setAsideEnemies.includes(card.code))
const definitions = encounterDefinitions([
  ...gathered, ...setAsideEnemies.map(code => ALL_CARDS[code]),
])

// 符号地图照 Arkham/Location/CardDefs/TheForgottenAge/ShatteredAeons.hs 逐条抄录。
// 注：共享 SYMBOLS 表没有 star / droplet 的图标，这里保留与原卡一致的 key。
const locations = {
  nexusOfNKai: location(NEXUS, '04324', {
    symbol: 'diamond', links: ['droplet', 'star'],
  }),
  yuggoth: location('yuggoth', '04327', {
    symbol: 'droplet', links: ['diamond'],
  }),
  shoresOfRlyeh: location('shoresOfRlyeh', '04328', {
    symbol: 'droplet', links: ['diamond'],
  }),
  cityOfTheUnseen: location('cityOfTheUnseen', '04329', {
    symbol: 'droplet', links: ['diamond'],
  }),
  aPocketInTime: location(POCKET, '04330', {
    symbol: 'star', links: ['diamond', 'equals'],
  }),
  ruinsOfNewYork: location('ruinsOfNewYork', '04331', {
    symbol: 'equals', links: ['star'],
  }),
  mu: location('mu', '04332', {
    symbol: 'equals', links: ['star'],
  }),
  atlantis: location('atlantis', '04333', {
    symbol: 'equals', links: ['star'],
  }),
  pnakotus: location('pnakotus', '04334', {
    symbol: 'equals', links: ['star'],
  }),
  valusia: location('valusia', '04335', {
    symbol: 'equals', links: ['star'],
  }),
  plateauOfLeng: location('plateauOfLeng', '04336', {
    symbol: 'equals', links: ['star'],
  }),
}
linkSymbolLocations(locations)

// 探索牌库的三处异界地点（Haskell 的 addExtraDeck）。
export const EXPLORATION_LOCATIONS = ['yuggoth', 'shoresOfRlyeh', 'cityOfTheUnseen']
export const EXPLORATION_TREACHERIES = {
  betweenWorlds: BETWEEN_WORLDS,
  wrackedByTime: WRACKED_BY_TIME,
  ancientEvils: ANCIENT_EVILS,
}
// 放在一边的 7 处地点：时间之窗 + 6 处「破碎」地点（场景 2 背面才洗进探索牌库）。
export const SHATTERED_LOCATIONS = [
  'ruinsOfNewYork', 'mu', 'atlantis', 'pnakotus', 'valusia', 'plateauOfLeng',
]
export const SET_ASIDE_LOCATIONS = [POCKET, ...SHATTERED_LOCATIONS]
export const POISONED = '04102'

// 4a 幕的另外两个版本：正常剧本推进到 04321；接受伊格的宽恕/另有他法后换成
// 04322 / 04323（Haskell 把这两张与 04321 一起 setAside）。
export const ALTERNATE_ACTS = {
  [PARADISE_LOST]: {
    ...stages([PARADISE_LOST], 'act')[0], id: 'act4-paradiseLost', stage: '4a',
    reveal: { type: 'campaignRule' },
  },
  [TIMELOCK]: {
    ...stages([TIMELOCK], 'act')[0], id: 'act4-timelock', stage: '4a',
    reveal: { type: 'campaignRule' },
  },
}

// 04340「异界之间」是双面卡：正面是诡计，背面是一个 3 隐藏值、1 个线索的异界地点。
// 它没有印刷在地图上，只在诡计结算时才入场，因此不进 scenario.locations（否则会被
// 当成初始地图的一部分），而是用同一份目录数据现场构造。
export const BETWEEN_WORLDS_LOCATION = {
  ...location('betweenWorlds', BETWEEN_WORLDS, { connections: [NEXUS] }),
  // 卡面：作为一个异界地点，有 3 隐藏值和 1 个线索。04340 是诡计卡，
  // 目录里没有 shroud/clues，必须在这里补上，否则调查难度是 NaN。
  shroud: 3,
  traits: ['Otherworld'],
  traitsZh: ['异界'],
}

const acts = stages(['04318', '04319', '04320', MEND_THE_SHATTER], 'act').map((act, index) => ({
  ...act,
  reveal: { type: 'campaignRule' },
  // 彼端的世界：全队共同支付 2×人数线索；搜寻兄弟会：有调查员进入时间之窗。
  ...(index === 0 ? { objective: { type: 'clues', perInvestigator: 2 } } : {}),
  ...(index === 1 ? { objective: { type: 'enterLocation', location: POCKET } } : {}),
}))

const agendas = stages(['04315', '04316', '04317'], 'agenda').map(agenda => ({
  ...agenda, reveal: { type: 'campaignRule' },
}))

// 探索牌库会占用每张诡计一份实物，遭遇牌库相应扣掉。
const deckCodes = encounterDeck(gathered)
for (const code of EXPLORATION_TREACHERY_CODES) {
  const index = deckCodes.indexOf(code)
  if (index >= 0) deckCodes.splice(index, 1)
}

export const scenario = {
  id: 'shatteredAeons',
  originalCode: '04314',
  name: '失落的时代 · 破碎永世',
  intro: '通道尽头是联结点：一口无底的竖井，井里翻涌着撕开时间的能量。线在这里断开，而你们必须把它缝回去。',
  setup: '比较混乱袋里 [cultist] 与 [tablet] 的数量：多的一方决定额外收「黑暗教团」或「伊格的使徒」（相等则两组都收）。收齐“破碎永世、纳克特兄弟会、时间洪流、远古恶魔”遭遇组，并把古代遗物（时光涌流）、伊塔卡、亚历山卓·维拉、无形之子、时间之窗与 6 处「破碎」地点、场景 4a“失乐园”“锁定时间”放在一边。用 3 处异界地点与 3 张诡计建立探索牌库，从恩凯联结点开始。',
  startLocation: NEXUS,
  locations,
  setAsideLocations: [...SET_ASIDE_LOCATIONS],
  acts,
  agendas,
  // 04320 的取遗物/控制遗物与 04321–04323 的修补裂痕行动都印在当前幕卡上。
  scriptCards: { rules: {
    searchRelic: { card: 'act', codes: ['04320'] },
    takeRelic: { card: 'act', codes: ['04320'] },
    attachLocation: { card: 'act', codes: ['04321', '04322', '04323'] },
  } },
  ...definitions,
  storyAssets: storyCards([RELIC_AGES_UNLEASH, YIGS_MERCY, ANOTHER_WAY]),
  encounterDeck: deckCodes,
  resolutions: {
    noResolution: '无结局：阅读结局 4。时间之布被彻底拆解，每位调查员陷入疯狂，本战役以失败告终。',
    r1: '结局 1：你们缝补了时间之布上的裂口，人类免于巨难。记录“调查员们修补了时间之布上的裂口”；每位调查员受到 2 点肉体创伤与 2 点精神创伤；附属到古代遗物上的地点进入胜利区；获得等于胜利区胜利点的 XP，额外 +5。',
    r2: '结局 2：瓦卢西亚与伊格的子嗣在新时间线里安然无恙。记录“调查员们拯救了蛇族的文明”。',
    r3: '结局 3：伟大种族伊斯与纳克特在新时间线里安然无恙。记录“调查员们拯救了伊斯人的文明”。',
    r4: '结局 4：现世不会一成不变，但时间的第四维度已被切成无数位面。记录“时间之布已被拆解”，每位调查员陷入疯狂。',
    r5: '结局 5：你们带着「重拾往昔」的古代遗物回到了过去，把遗物永远封存。记录“调查员们倒转了时间”；附属到古代遗物上的地点进入胜利区；获得等于胜利区胜利点的 XP，随后进入尾声（时间倒流）。',
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)
