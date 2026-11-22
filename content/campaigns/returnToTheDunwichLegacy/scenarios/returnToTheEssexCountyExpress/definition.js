// 重返疯狂列车（Return to The Essex County Express · 51025）· 章节数据。
//
// 参考：ReturnToTheEssexCountyExpress.hs。差异：
//   1. 车厢候选加入 51029 货车 / 51030 行李车厢，车头候选加入 51028（胜利 1）；
//   2. 议程牌库换为 6 张：[51026 烟雾缭绕, 51027 现实的裂口 v.II, 02161-02164]；
//      51026 推进时生成背面敌人列车主宰(51026b)；
//   3. 新资产火车机修工(51031) 放在一边，揭示 51028 车头后入场；
//   4. 首节车厢布置期间无文本；混乱袋按难度加入额外标记（沿用基础行为）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  BASE_SCENARIOS, CHAPTER_BY_ID, CHAPTER_ENCOUNTER_GROUPS, printed, location,
  retEncounterCards, retEncounterDefinitions, retEncounterDeck, identitiesFor,
} from '../../shared.js'

const chapter = CHAPTER_BY_ID.returnToTheEssexCountyExpress
const base = BASE_SCENARIOS.theEssexCountyExpress
const groups = CHAPTER_ENCOUNTER_GROUPS.returnToTheEssexCountyExpress
const asideCodes = Array(4).fill('02178')

const cards = retEncounterCards(groups)
const definitions = retEncounterDefinitions(cards)

const retAgenda = code => {
  const card = ALL_CARDS[code]
  return { ...printed(code), id: `agenda${code}`, name: card.nameZh || card.name,
    stage: `${card.stage || 1}a`, doomThreshold: card.doom, advanceText: card.backTextZh || card.backText || '',
    reveal: { type: 'campaignRule' } }
}
const agendaByCode = Object.fromEntries([...base.agendas.map(agenda => [agenda.originalCode, agenda])])
export const AGENDA_ORDER = ['51026', '51027', '02161', '02162', '02163', '02164']
const agendas = AGENDA_ORDER.map(code => (code.startsWith('510') ? retAgenda(code) : agendaByCode[code]))

export const scenario = {
  ...base,
  id: chapter.id, originalCode: chapter.code, name: `${chapter.name} · ${chapter.nameEn}`,
  intro: '开往敦威治的列车驶入了一场噩梦。烟雾从车头方向涌来，现实的裂口正在扩张，而列车主宰在车厢之间穿行。',
  setup: '使用列车网格布置 7 节车厢：从 8 张客车、2 张新货车与 10 张客车候选中随机取 6 张，再随机取 1 张车头（含 51028）。'
    + '首节车厢布置期间无文本。将 4 张跨越时空与火车机修工放在一边，按难度调整混乱袋。',
  setupNote: '按照重返剧本参考卡 51025 的布置步骤放置地点、遭遇组与放一边区：从扩充后的车厢池与车头池随机铺设列车，并使用六张议程牌库。',
  startLocation: base.startLocation,
  locations: {
    ...base.locations,
    location51028: location('location51028', '51028', []),
    location51029: location('location51029', '51029', []),
    location51030: location('location51030', '51030', []),
  },
  acts: base.acts,
  agendas,
  ...definitions,
  storyAssets: { ...base.storyAssets, ...printed('51031') && { 51031: printed('51031') } },
  encounterDeck: [...retEncounterDeck(cards.filter(card => card.code !== '51026b' && !asideCodes.includes(card.code))),
    ...Array(ALL_CARDS['02179'].quantity || 1).fill('02179')],
  setAsideEncounterCards: [],
  setAsideLocations: [...base.setAsideLocations],
  resolutions: base.resolutions,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const GROUPS = groups
export const SET_ASIDE_ALIASES = [...asideCodes, '51031']
export const RECORDS = {
  reads: [],
  writes: ['theInvestigatorsWereDelayedOnTheirWayToDunwich', 'investigatorsWereUnconsciousForSeveralHours'],
}
export const REFERENCE_CODE = chapter.code
export const CAR_POOL = ['02167', '02168', '02169', '02170', '02171', '02172', '02173', '02174', '51029', '51030']
export const ENGINE_POOL = ['02175', '02176', '02177', '51028']
