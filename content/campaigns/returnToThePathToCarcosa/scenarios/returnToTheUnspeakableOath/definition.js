// 重返邪秽誓约（returnToTheUnspeakableOath · 印刷剧本参考卡 52034）· 章节数据。
//
// 参考：Scenario/Scenarios/ReturnToThePathToCarcosa/ReturnToTheUnspeakableOath.hs +
//       Scenario/Scenarios/ThePathToCarcosa/TheUnspeakableOath.hs 的 `whenReturnTo` 分支。
//
// 重返差异：
//   - 额外收集 New Encounter Sets for Return to The Unspeakable Oath（52035–52039）；
//   - 妄想组 → 发狂妄想，衰败与汙秽 → 衰败现实，哈斯塔的使者 → 哈斯塔的使节；
//   - 疯狂之主（52037）与根除疗法（52038）放在一边；
//   - 场景 2 不使用原版版本选择，改为按剧本日志：确信 ≥ 疑惑 → 52035（版本三），
//     否则 52036（版本四）。
import { scenario as baseScenario } from '../../../thePathToCarcosa/scenarios/theUnspeakableOath/definition.js'
import {
  deriveScenario, finishScenario, gather, returnToGroups, encounterDeck, stages,
} from '../../scenario-utils.js'

export const BASE_ID = 'theUnspeakableOath'
export const REFERENCE_CODE = '52034'
export const SCENARIO_ID = 'returnToTheUnspeakableOath'

export const ENCOUNTER_GROUPS = returnToGroups(
  ['the_unspeakable_oath', 'hasturs_gift', 'inhabitants_of_carcosa', 'delusions', 'decay', 'agents_of_hastur'],
  {
    replace: {
      delusions: 'maddening_delusions',
      decay: 'decaying_reality',
      agents_of_hastur: 'hasturs_envoys',
    },
    add: ['return_to_the_unspeakable_oath'],
  },
)

export const ACT_CODES = Object.freeze([
  '03163', '03164', '03165', '52035', '52036', '03166', '03167',
])
export const ACT_TWO_V3 = '52035'
export const ACT_TWO_V4 = '52036'
export const HOST_OF_INSANITY = '52037'
export const RADICAL_TREATMENT = '52038'
export const CLOUDED_MEMORY = '52039'

const gathered = gather(ENCOUNTER_GROUPS)
const returnCards = gather(['return_to_the_unspeakable_oath'])
const definitionsScenario = deriveScenario(baseScenario, {
  id: SCENARIO_ID,
  originalCode: REFERENCE_CODE,
  name: '重返卡尔克萨之路 · 邪秽誓约',
  nameEn: 'Return to The Unspeakable Oath',
  intro: baseScenario.intro,
  setup: '收集“邪秽誓约、哈斯塔的馈赠、卡尔克萨的居民、发狂妄想、衰败现实、哈斯塔的使节、重返邪秽誓约”遭遇组。随机选择东西病房各一个版本放置入场；将四张病人拘禁室、丹尼尔、疯狂之主（52037）与根除疗法（52038）放在一边。先按人数从怪物与疯子两组各抽敌人组成场景外牌堆。将基础场景 2 的两个版本移出游戏，按剧本日志选择 52035（确信 ≥ 疑惑）或 52036（疑惑更高）。',
  setupNote: '按照重返剧本参考卡 52034 的布置步骤：场景 2 改为按剧本日志使用版本三或版本四，并把疯狂之主与根除疗法放在一边。',
  acts: (() => {
    const cards = stages([...ACT_CODES], 'act')
    const ids = ['act1', 'act2v1', 'act2v2', 'act2v3', 'act2v4', 'act3', 'act4']
    return cards.map((card, index) => ({
      ...card,
      id: ids[index],
      ...(index === 0 ? { objective: { type: 'clues', perInvestigator: 3 } } : {}),
      reveal: { type: 'campaignRule' },
    }))
  })(),
  agendas: baseScenario.agendas,
  setAsideLocations: [...baseScenario.setAsideLocations],
  resolutions: {
    noResolution: baseScenario.resolutions.noResolution,
    r1: baseScenario.resolutions.r1,
    r2: baseScenario.resolutions.r2,
    r3: baseScenario.resolutions.r3,
  },
}, returnCards)

// 怪物牌堆 / 疯子牌堆：基础章节同一划分（按特性），52037 不属于两者而进主遭遇牌库。
const isEnemyTrait = (card, trait) => card.type === 'enemy' && card.code !== '03182b'
  && (card.traits || []).includes(trait)
export const monsterDeck = gathered.filter(card => isEnemyTrait(card, 'Monster'))
  .flatMap(card => Array(card.quantity || 1).fill(card.code))
export const lunaticsDeck = gathered.filter(card => isEnemyTrait(card, 'Possessed'))
  .flatMap(card => Array(card.quantity || 1).fill(card.code))
const sideEnemyCodes = new Set([...monsterDeck, ...lunaticsDeck, '03182b'])
const mainEncounterCards = gathered.filter(card => !sideEnemyCodes.has(card.code))

export const scenario = {
  ...definitionsScenario,
  monsterDeck,
  lunaticsDeck,
  encounterDeck: encounterDeck([
    ...mainEncounterCards,
    // 基础章节的 03065b 变身敌人不在分组收集范围内，但需要定义（由 03185 等生成）。
    ...(mainEncounterCards.some(card => card.code === '03065b') ? [] : []),
  ]),
}

const finished = finishScenario(scenario)
export const identities = finished.identities
export const CARD_DATA = Object.freeze({
  BASE_ID, REFERENCE_CODE, SCENARIO_ID, ENCOUNTER_GROUPS, ACT_CODES,
  ACT_TWO_V3, ACT_TWO_V4, HOST_OF_INSANITY, RADICAL_TREATMENT, CLOUDED_MEMORY,
})
