// 重返百赌百胜（Return to The House Always Wins · 51015）· 章节数据。
//
// 参考：ReturnToTheHouseAlwaysWins.hs。差异：
//   1. 俱乐部大厅(02071) / 新版大厅(51016) 随机二选一，另一版本移出游戏；
//   2. 俱乐部舞台(51017) 放在一边，大厅被揭示后入场；
//   3. 新诡计骗术穿帮(51018)/提高赌注(51019) 加入遭遇牌库；
//   4. 收集 hideous_abominations 与 erratic_fear 置一边。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  BASE_SCENARIOS, CHAPTER_BY_ID, CHAPTER_ENCOUNTER_GROUPS, location,
  retEncounterCards, retEncounterDefinitions, retEncounterDeck, identitiesFor,
} from '../../shared.js'

const chapter = CHAPTER_BY_ID.returnToTheHouseAlwaysWins
const base = BASE_SCENARIOS.theHouseAlwaysWins
const groups = CHAPTER_ENCOUNTER_GROUPS.returnToTheHouseAlwaysWins

const cards = retEncounterCards(groups)
const asideCards = retEncounterCards(['hideous_abominations', 'erratic_fear'])
const definitions = retEncounterDefinitions(cards)
Object.assign(definitions.enemies['02078'], { hunter: true, prey: 'highestIntellect' })

const loungeRet = location('cloverClubLoungeRet', '51016', ['laBellaLuna', 'cloverClubBar', 'cloverClubCardroom'])

export const scenario = {
  ...base,
  id: chapter.id, originalCode: chapter.code, name: `${chapter.name} · ${chapter.nameEn}`,
  intro: '摩尔根博士最后被人看见走进了四叶草俱乐部。这一次俱乐部多了一个舞台，而柜台后的打手比以往更加警觉。',
  setup: '从月下美人进入。布置俱乐部酒吧和卡牌室；在两张俱乐部大厅中随机选一张入场，另一张移出游戏。'
    + '把俱乐部舞台、赌场管理员、黑暗走廊、画廊、VIP 区、后巷、剧情资产以及隐藏异形/反常恐惧遭遇组放在一边。',
  setupNote: '按照重返剧本参考卡 51015 的布置步骤放置地点、遭遇组与放一边区：随机选用一张俱乐部大厅，并把俱乐部舞台放在一边等待揭示后入场。',
  startLocation: 'laBellaLuna',
  locations: {
    ...base.locations,
    cloverClubStage: location('cloverClubStage', '51017', ['cloverClubBar']),
    cloverClubLoungeRet: loungeRet,
  },
  locationVariants: {
    cloverClubLounge: [base.locations.cloverClubLounge, { ...loungeRet, id: 'cloverClubLounge' }],
  },
  acts: base.acts,
  agendas: base.agendas,
  ...definitions,
  storyAssets: base.storyAssets,
  encounterDeck: retEncounterDeck(cards.filter(card => card.code !== '02078')),
  setAsideEncounterCards: retEncounterDeck(asideCards),
  setAsideLocations: [...base.setAsideLocations],
  resolutions: base.resolutions,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const GROUPS = groups
export const SET_ASIDE_ALIASES = ['02079', '02080',
  ...asideCards.flatMap(card => Array(card.quantity || 1).fill(card.code))]
export const RECORDS = {
  reads: [],
  writes: ['drFrancisMorganWasKidnapped', 'theInvestigatorsRescuedDrFrancisMorgan', 'naomiHasTheInvestigatorsBacks',
    'oBannionGangHasABoneToPickWithTheInvestigators', 'investigatorsWereUnconsciousForSeveralHours'],
}
export const REFERENCE_CODE = chapter.code
