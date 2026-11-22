// 重返毁灭之地（Return to Where Doom Awaits · 51047）· 章节数据。
//
// 参考：ReturnToWhereDoomAwaits.hs。差异：
//   1. 山脚(02282) → 山脚·扭曲变形(51048)；上山道路(02283) → 上山道路·扭曲变形(51049)；
//   2. 分岔路候选加入废弃营地(51050)，迷幻小路候选加入无底湖泊(51051)；
//   3. 内奥米·欧巴尼恩(51052) 放在一边（若已有「娜奥米支持调查员」记录则按基础章惯例给予线索）；
//   4. 遭遇组用 erratic_fear/resurgent_evils/creeping_cold 替换三组基础旧组。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  BASE_SCENARIOS, CHAPTER_BY_ID, CHAPTER_ENCOUNTER_GROUPS, location,
  retEncounterCards, retEncounterDefinitions, retEncounterDeck, identitiesFor,
} from '../../shared.js'

const chapter = CHAPTER_BY_ID.returnToWhereDoomAwaits
const base = BASE_SCENARIOS.whereDoomAwaits
const groups = CHAPTER_ENCOUNTER_GROUPS.returnToWhereDoomAwaits
const asideCodes = ['02293', '51052']

const cards = retEncounterCards(groups)
const definitions = retEncounterDefinitions(cards)

export const scenario = {
  ...base,
  id: chapter.id, originalCode: chapter.code, name: `${chapter.name} · ${chapter.nameEn}`,
  intro: '通往哨兵山的道路在重返调查中变得扭曲。山脚与山路本身都在拒绝你们，而分岔的小径通向更深的疯狂。',
  setup: '从山脚·扭曲变形(51048)开始，放置上山道路·扭曲变形(51049)与哨兵峰(02284)。'
    + '分岔路从小径候选（含废弃营地 51050）中随机取 3 张，迷幻小路从候选（含无底湖泊 51051）中随机取 3 张，放在一边。'
    + '赛斯·毕晓普与内奥米·欧巴尼恩放在一边；按进度调整混乱袋并放置毁灭标记。',
  setupNote: '按照重返剧本参考卡 51047 的布置步骤放置地点、遭遇组与放一边区：使用扭曲版山脚与上山道路，并从扩充后的小径候选中各取三张。',
  startLocation: base.startLocation,
  locations: {
    ...base.locations,
    location51048: location('location51048', '51048', ['location02283']),
    location51049: location('location51049', '51049', ['location02282', 'location02284']),
    location51050: location('location51050', '51050', []),
    location51051: location('location51051', '51051', []),
  },
  acts: base.acts,
  agendas: base.agendas,
  ...definitions,
  storyAssets: base.storyAssets,
  encounterDeck: retEncounterDeck(cards.filter(card => !asideCodes.includes(card.code))),
  setAsideLocations: [...base.setAsideLocations, 'location51050', 'location51051'],
  resolutions: base.resolutions,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const GROUPS = groups
export const SET_ASIDE_ALIASES = ['02293', '51052']
export const RECORDS = {
  reads: ['theInvestigatorsRestoredSilasBishop', 'theInvestigatorsFailedToRecoverTheNecronomicon',
    'theNecronomiconWasStolen', 'noBroodEscapedIntoTheWild', 'broodEscapedIntoTheWild',
    'theInvestigatorsPutSilasBishopOutOfHisMisery', 'naomiHasTheInvestigatorsBacks'],
  writes: ['theInvestigatorsEnteredTheGate', 'yogSothothToreApartTheBarrierBetweenWorldsAndBecameOneWithAllReality',
    'broodEscapedIntoTheWild', 'noBroodEscapedIntoTheWild'],
}
export const REFERENCE_CODE = chapter.code
export const DIVERGING_POOL = ['02285', '02286', '02287', '02288', '51050']
export const ALTERED_POOL = ['02289', '02290', '02291', '02292', '51051']
export const NAOMI_CODE = '51052'
