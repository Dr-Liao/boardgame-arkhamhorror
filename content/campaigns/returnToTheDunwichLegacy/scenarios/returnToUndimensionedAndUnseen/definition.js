// 重返无人知晓（Return to Undimensioned and Unseen · 51041）· 章节数据。
//
// 参考：ReturnToUndimensionedAndUnseen.hs。差异：
//   1. 遭遇组用 erratic_fear(51068-70) 替换 striking_fear；
//   2. 犹格·索托斯之子改用 4 种重返变体 51042–51045（共 5 张，含 1 张基础 02255），
//      按献祭人数生成/放在一边；新诡计不可察觉的生物(51046) 加入遭遇牌库；
//   3. 深奥的咒文(02254)×4 放在一边；每名调查员按战役规则抽取随机基础弱点（近似：沿用基础章）。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  BASE_SCENARIOS, CHAPTER_BY_ID, CHAPTER_ENCOUNTER_GROUPS, location,
  retEncounterCards, retEncounterDefinitions, retEncounterDeck, identitiesFor,
} from '../../shared.js'

const chapter = CHAPTER_BY_ID.returnToUndimensionedAndUnseen
const base = BASE_SCENARIOS.undimensionedAndUnseen
const groups = CHAPTER_ENCOUNTER_GROUPS.returnToUndimensionedAndUnseen
const asideCodes = ['02254', '02255', '51042', '51043', '51044', '51045']

const cards = retEncounterCards(groups)
const definitions = retEncounterDefinitions(cards)

export const scenario = {
  ...base,
  id: chapter.id, originalCode: chapter.code, name: `${chapter.name} · ${chapter.nameEn}`,
  intro: '敦威治的荒野里仍有东西在游荡。重返调查意味着你们要面对更多形态各异、几乎不可见的子嗣，以及被它们吓疯的镇民。',
  setup: '放置敦威治村、冷泉幽谷、十里牧场、憎恶荒野、沃特雷家废墟与恶魔花园（各自在两张版本中随机一张）。'
    + '按献祭给犹格·索托斯的人数决定子嗣总数与初始生成；4 张深奥的咒文与剩余子嗣放在一边。',
  setupNote: '按照重返剧本参考卡 51041 的布置步骤放置地点、遭遇组与放一边区：按献祭人数决定子嗣总数与初始生成地点，并把深奥的咒文放在一边。',
  startLocation: base.startLocation,
  acts: base.acts,
  agendas: base.agendas,
  ...definitions,
  storyAssets: base.storyAssets,
  encounterDeck: retEncounterDeck(cards.filter(card => !asideCodes.includes(card.code))),
  setAsideLocations: [...base.setAsideLocations],
  resolutions: base.resolutions,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const GROUPS = groups
export const SET_ASIDE_ALIASES = ['02254', '02254', '02254', '02254', '02255', '51042', '51043', '51044', '51045']
export const RECORDS = {
  reads: ['sacrificedToYogSothoth'],
  writes: ['sacrificedToYogSothoth', 'broodEscapedIntoTheWild', 'noBroodEscapedIntoTheWild',
    'youCalmedTheTownsfolk', 'youWarnedTheTownsfolk', 'investigatorsWereUnconsciousForSeveralHours'],
}
export const REFERENCE_CODE = chapter.code
export const BROOD_POOL = ['51042', '51043', '51044', '51045', '02255']
// 印刷生命 + 每名调查员增加的数值（参考各变体的 HealthModifier）。
export const BROOD_PER_PLAYER = { '51042': 1, '51043': 1, '51044': 2, '51045': 1, '02255': 1 }
export const FORMULA_CODE = '02254'
