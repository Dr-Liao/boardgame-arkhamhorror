// 重返迷失时空（Return to Lost in Time and Space · 51053）· 章节数据。
//
// 参考：ReturnToLostInTimeAndSpace.hs。差异：
//   1. 若仪式已完成，幕 2a 用超越领域(版本二, 51055) 替换；密谋 3a 一律用突破(版本二, 51054)；
//   2. 起始后把单面地点彼端领域(51057) 放置入场，并把犹格·索托斯(02323) 生成在该地点；
//   3. 赛斯·毕晓普(51056) 放在一边；宇宙的边缘(02321)/时间缝隙(02322) 照基础章放一边；
//   4. 新地点难以理解的阶梯(51058)/高耸辉地(51059)/不稳定的漩涡(51060) 加入遭遇地点；
//   5. 遭遇组用 yog_sothoths_emissaries 替换 agents_of_yog。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  BASE_SCENARIOS, CHAPTER_BY_ID, CHAPTER_ENCOUNTER_GROUPS, printed, location,
  retEncounterCards, retEncounterDefinitions, retEncounterDeck, identitiesFor,
} from '../../shared.js'

const chapter = CHAPTER_BY_ID.returnToLostInTimeAndSpace
const base = BASE_SCENARIOS.lostInTimeAndSpace
const groups = CHAPTER_ENCOUNTER_GROUPS.returnToLostInTimeAndSpace
const asideCodes = ['02323', '51056']

const cards = retEncounterCards(groups)
const definitions = retEncounterDefinitions(cards)

const retStage = (code, stage) => {
  const card = ALL_CARDS[code]
  return { ...printed(code), id: `${card.type}${code}`, stage,
    ...(card.type === 'agenda' ? { doomThreshold: card.doom } : {}),
    advanceText: card.backTextZh || card.backText || '', reveal: { type: 'campaignRule' } }
}
// 运行期替换用的额外幕/密谋定义：引擎从 scenario.stageCards 实例化。
const STAGE_CARDS = {
  '51055': retStage('51055', '2a'),
  '51054': retStage('51054', '3a'),
}

const encounterLocations = [...Array.from({ length: 5 }, (_, i) => String(2324 + i).padStart(5, '0')),
  '51058', '51059', '51060']

export const scenario = {
  ...base,
  id: chapter.id, originalCode: chapter.code, name: `${chapter.name} · ${chapter.nameEn}`,
  intro: '现实在你们周围崩裂。重返调查让时空本身也加入了对你们的围猎，而彼端领域正等待它的主人。',
  setup: '从另一个次元开始。将彼端领域(51057) 放置入场，并把犹格·索托斯生成在该地点。'
    + '将宇宙的边缘、时间缝隙与赛斯·毕晓普放在一边；将新增的三处遭遇地点洗入遭遇牌库。'
    + '按仪式是否完成选择幕 2a（51055/02317），密谋 3a 使用 51054。',
  setupNote: '按照重返剧本参考卡 51053 的布置步骤放置地点、遭遇组与放一边区：放置彼端领域并生成犹格·索托斯，再按仪式记录选用幕 2a 版本。',
  startLocation: base.startLocation,
  locations: {
    ...base.locations,
    location51057: location('location51057', '51057', ['location02320']),
    location51058: location('location51058', '51058', []),
    location51059: location('location51059', '51059', []),
    location51060: location('location51060', '51060', []),
  },
  acts: base.acts,
  agendas: base.agendas,
  stageCards: STAGE_CARDS,
  ...definitions,
  storyAssets: base.storyAssets,
  encounterDeck: [...retEncounterDeck(cards.filter(card => !asideCodes.includes(card.code))),
    ...encounterLocations.flatMap(code => Array(ALL_CARDS[code]?.quantity || 1).fill(code))],
  setAsideLocations: ['location02321', 'location02322'],
  resolutions: base.resolutions,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const GROUPS = groups
export const SET_ASIDE_ALIASES = ['02321', '02322', '51056']
export const RECORDS = {
  reads: ['theRitualWasCompleted'],
  writes: ['theInvestigatorsClosedTheTearInReality', 'yogSothothHasFledToAnotherDimension',
    'theInvestigatorsEnteredTheGate', 'yogSothothToreApartTheBarrierBetweenWorldsAndBecameOneWithAllReality'],
}
export const REFERENCE_CODE = chapter.code
export const ACT_ORDER = ['02316', '51055', '02318', '02319']
export const AGENDA_ORDER = ['02312', '02313', '51054', '02315']
export const REALMS_BEYOND = 'location51057'
export const SETH_BISHOP_CODE = '51056'
export const ACT_V2_CODE = '51055'
export const AGENDA_V2_CODE = '51054'
export { STAGE_CARDS }
