// 万千骇形（A Thousand Shapes of Horror · 06168）· 剧本数据。
//
// 参考实现：Scenario/Scenarios/TheDreamEaters/AThousandShapesOfHorror.hs +
// Location/Act/Agenda/Enemy/Treachery/CardDefs|Cards/TheDreamEaters/AThousandShapesOfHorror/*.hs。
// 卡面印刷数据只从 `../../card-data.js` 取（唯一事实源）；剧情/设置/结局正文只从 `./text-en.js`
// 取锁定英文原文（P8-T 自译前不写中文摘要；scenario 上标 textLanguage:'en' + textStatus:'pending-self-translation'）。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  encounterCards, encounterDefinitions, encounterDeck, location, stages, storyCards, identitiesFor,
} from '../../card-data.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { INTRO, RESOLUTIONS, SETUP, TOKENS } from './text-en.js'

// ---------------------------------------------------------------------------
// 卡号常量（本文件与单卡条目共用；条目文件里不 import 本文件）
// ---------------------------------------------------------------------------
export const SCENARIO_CODE = '06168'
export const BURIAL_GROUND = '06174'
export const FRONT_PORCH_ENTRYWAY = '06175'
export const DEN = '06176'
export const PARLOR = '06177'
export const UPSTAIRS_HALLWAY = '06178'
export const LIBRARY = '06179'
export const BEDROOM = '06180'
export const ATTIC = '06181'
export const UNMARKED_TOMB = '06182'
export const MYSTERIOUS_STAIRS = Object.freeze(['06183', '06184', '06185', '06186', '06187', '06188'])
export const SILVER_KEY = '06189'
export const ENDLESS_DESCENT = '06190'
export const THE_UNNAMABLE = '06169b'
export const ACT_CODES = Object.freeze(['06172', '06173'])
export const AGENDA_CODES = Object.freeze(['06169a', '06170', '06171'])
export const TREACHERY_CODES = Object.freeze(['06190', '06191', '06192', '06193', '06194'])

// 遭遇组：卡池 encounterCode（snake_case）。Creation 组来自核心/战役共享组。
export const ENCOUNTER_GROUPS = Object.freeze([
  'aThousandShapesOfHorror', 'creaturesOfTheUnderworld', 'mergingRealities',
  'chillingCold', 'ghouls', 'lockedDoors', 'rats',
])

// 放在一边的卡（setup）：不可名状之物、阁楼、无名坟墓、6 张神秘阶梯、4 张无尽深入、银钥匙。
// 地点用 setAsideLocations；非地点卡在 index.js 的 manifest.setAsideAliases 里按张数登记。
export const SET_ASIDE_CODES = Object.freeze([
  THE_UNNAMABLE, ATTIC, UNMARKED_TOMB, ...MYSTERIOUS_STAIRS,
  ENDLESS_DESCENT, ENDLESS_DESCENT, ENDLESS_DESCENT, ENDLESS_DESCENT, SILVER_KEY,
])

const isSetAsideCard = code => [THE_UNNAMABLE, ENDLESS_DESCENT, SILVER_KEY].includes(code)
  || MYSTERIOUS_STAIRS.includes(code) || [ATTIC, UNMARKED_TOMB].includes(code)

// ---------------------------------------------------------------------------
// 地点：9 个房屋/墓地地点 + 6 张神秘阶梯（纵向链，act1 背面才入场）。
// 双面地点用 `unrevealed` 数据表示未揭示面（背面名来自 cards-data 的 backName）；
// 阶梯的上下连接由 behavior.setupLocations/act1 背面用 api.verticalChain.link 建立，
// 定义里只声明 setAside 与空连接（检查口径允许 setAside 地点无连接）。
// ---------------------------------------------------------------------------
const houseConnections = {
  burialGround: ['frontPorchEntryway', 'unmarkedTomb'],
  frontPorchEntryway: ['burialGround', 'upstairsHallway', 'den', 'parlor'],
  upstairsHallway: ['frontPorchEntryway', 'attic', 'library', 'bedroom'],
  den: ['frontPorchEntryway'],
  parlor: ['frontPorchEntryway'],
  library: ['upstairsHallway'],
  bedroom: ['upstairsHallway'],
  attic: ['upstairsHallway'],
  unmarkedTomb: ['burialGround'],
}

const unrevealedFace = code => ({
  nameZh: ALL_CARDS[code]?.backNameZh || ALL_CARDS[code]?.backName || ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || '',
})

function houseLocation(id, code) {
  const connections = houseConnections[id] || []
  const unrevealedCodes = [DEN, PARLOR, LIBRARY, BEDROOM, FRONT_PORCH_ENTRYWAY, UPSTAIRS_HALLWAY]
  return location(id, code, {
    connections,
    ...(unrevealedCodes.includes(code) ? { unrevealed: unrevealedFace(code) } : {}),
  })
}

// 6 张神秘阶梯共用同一 id 规则（verticalIndex 由 behavior 在 act1 背面写入；布局按 verticalIndex 纵列）。
const stairsLocations = Object.fromEntries(MYSTERIOUS_STAIRS.map((code, index) => {
  const id = `mysteriousStairs${index + 1}`
  return [id, location(id, code, { setAside: true })]
}))

export const STAIRS_IDS = Object.freeze(MYSTERIOUS_STAIRS.map((_, index) => `mysteriousStairs${index + 1}`))

const locations = {
  burialGround: houseLocation('burialGround', BURIAL_GROUND),
  frontPorchEntryway: houseLocation('frontPorchEntryway', FRONT_PORCH_ENTRYWAY),
  den: houseLocation('den', DEN),
  parlor: houseLocation('parlor', PARLOR),
  upstairsHallway: houseLocation('upstairsHallway', UPSTAIRS_HALLWAY),
  library: houseLocation('library', LIBRARY),
  bedroom: houseLocation('bedroom', BEDROOM),
  attic: houseLocation('attic', ATTIC),
  unmarkedTomb: houseLocation('unmarkedTomb', UNMARKED_TOMB),
  ...stairsLocations,
}

// ---------------------------------------------------------------------------
// 幕/议程：按卡号顺序 = 阶段顺序；`reveal.type` 让引擎走 behavior.actReveal/agendaReveal。
// ---------------------------------------------------------------------------
export const scenario = {
  id: 'aThousandShapesOfHorror',
  campaignId: 'theDreamEaters',
  originalCode: SCENARIO_CODE,
  referenceCode: SCENARIO_CODE,
  name: '万千骇形',
  nameEn: 'A Thousand Shapes of Horror',
  part: 'B',
  pair: 2,
  // 文本口径：P8 只落锁定英文原文，P8-T 自译。
  textLanguage: 'en',
  textStatus: 'pending-self-translation',
  intro: INTRO.intro1?.body || '',
  intros: INTRO,
  setup: [SETUP.gatherSets, SETUP.putLocations, SETUP.beginAtBurialGround, SETUP.setCardsAside, SETUP.buildEncounterDeck]
    .filter(Boolean),
  setupSteps: SETUP,
  startLocation: 'burialGround',
  locations,
  // 放在一边的地点：阁楼、无名坟墓、6 张神秘阶梯。
  setAsideLocations: [ATTIC, UNMARKED_TOMB].map(code => Object.keys(locations).find(id => locations[id].originalCode === code))
    .concat(STAIRS_IDS),
  acts: stages(ACT_CODES, 'act').map(act => ({ ...act, reveal: { type: 'campaignRule' } })),
  agendas: stages(AGENDA_CODES, 'agenda').map(agenda => ({ ...agenda, reveal: { type: 'campaignRule' } })),
  storyAssets: storyCards([SILVER_KEY]),
  resolutions: Object.fromEntries(Object.entries(RESOLUTIONS).map(([key, value]) => [
    key, `**${value.title}**\n\n${value.body}`,
  ])),
  // 混乱标记数值与失败后果：整表在 chaos.js（P4/P6 口径）；这里只放 tokenMeanings（引擎读 scenario.tokenMeanings）。
  tokenMeanings: {
    standard: {
      skull: { text: TOKENS.easyStandard.skull, delta: -1 },
      cultist: { text: TOKENS.easyStandard.cultist, delta: 0 },
      tablet: { text: TOKENS.easyStandard.tablet, delta: 2 },
      elder_thing: { text: TOKENS.easyStandard.elderThing, delta: -2 },
    },
    hard: {
      skull: { text: TOKENS.hardExpert.skull, delta: -2 },
      cultist: { text: TOKENS.hardExpert.cultist, delta: 0 },
      tablet: { text: TOKENS.hardExpert.tablet, delta: 1 },
      elder_thing: { text: TOKENS.hardExpert.elderThing, delta: -3 },
    },
  },
}

// ---------------------------------------------------------------------------
// 遭遇牌库与定义：收齐 7 个组；set aside 的 06169b/06190 不进牌库。
// ---------------------------------------------------------------------------
const gathered = encounterCards(ENCOUNTER_GROUPS)
const deckCards = gathered.filter(card => !isSetAsideCard(card.code))
const definitionCards = [
  ...gathered,
  ALL_CARDS[THE_UNNAMABLE],
]
export const definitions = encounterDefinitions(definitionCards)
scenario.enemies = definitions.enemies
scenario.treacheries = definitions.treacheries
scenario.encounterDeck = encounterDeck(deckCards)

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export default scenario


// P8：本章 behavior.js 引用的印刷卡号统一放数据表（content 章节流程不写卡号字面量）。
export const RAW_CODES = Object.freeze({
  c06190: '06190',
  c06191: '06191',
  c06192: '06192',
  c06193: '06193',
  c06194: '06194',
})
