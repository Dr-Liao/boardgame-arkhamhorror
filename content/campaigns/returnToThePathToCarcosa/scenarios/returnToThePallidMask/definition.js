// 重返苍白面具（returnToThePallidMask · 印刷剧本参考卡 52048）· 章节数据。
//
// 参考：Scenario/Scenarios/ReturnToThePathToCarcosa/ReturnToThePallidMask.hs +
//       Scenario/Scenarios/ThePathToCarcosa/ThePallidMask.hs 的 `whenReturnTo` 分支。
//
// 重返差异：
//   - 额外收集 New Encounter Set for Return to The Pallid Mask（52049–52053）；
//   - 地下墓穴牌库加入四张新的地下墓穴地点（秘密通道/骸骨堆/研究站点/颅骨之海），
//     随后随机选择四张地下墓穴地点移出游戏；
//   - 52053 畸形骸骨进入遭遇牌库。
import { scenario as baseScenario } from '../../../thePathToCarcosa/scenarios/thePallidMask/definition.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  deriveScenario, finishScenario, gather, returnToGroups, location, encounterDeck,
} from '../../scenario-utils.js'

export const BASE_ID = 'thePallidMask'
export const REFERENCE_CODE = '52048'
export const SCENARIO_ID = 'returnToThePallidMask'

export const ENCOUNTER_GROUPS = returnToGroups(
  ['the_pallid_mask', 'ghouls', 'hauntings', 'chilling_cold'],
  { add: ['return_to_the_pallid_mask'] },
)

// 四张新的地下墓穴地点（正面效果由 encounter-entries 声明；未揭示面按基础同款进入费用）。
export const RETURN_CATACOMBS = Object.freeze({
  returnToSecretPassage: '52049',
  moundOfBones: '52050',
  researchSite: '52051',
  seaOfSkulls: '52052',
})
export const MALFORMED_SKELETON = '52053'
export const RETURN_CATACOMB_CODES = Object.freeze(['52049', '52050', '52051', '52052'])

const gathered = gather(ENCOUNTER_GROUPS)
const returnCards = gather(['return_to_the_pallid_mask'])
const definitionsScenario = deriveScenario(baseScenario, {
  id: SCENARIO_ID,
  originalCode: REFERENCE_CODE,
  name: '重返卡尔克萨之路 · 苍白面具',
  nameEn: 'Return to The Pallid Mask',
  intro: baseScenario.intro,
  setup: '建立事务化随机地下墓穴牌堆；暗影坟墓与堵塞通道混入底部五张。接着把四张新的地下墓穴地点（52049–52052）与剩余地点放在一起，再随机选择四张地下墓穴地点移出游戏。按前一幕结局选择起始地点。',
  setupNote: '按照重返剧本参考卡 52048 的布置步骤：四张新地下墓穴加入牌库后，随机移除四张原有地下墓穴；暗影坟墓与堵塞通道仍按常规放在底部。',
  locations: {
    ...baseScenario.locations,
    returnToSecretPassage: location('returnToSecretPassage', '52049', [], { catacomb: true }),
    moundOfBones: location('moundOfBones', '52050', [], { catacomb: true }),
    researchSite: location('researchSite', '52051', [], { catacomb: true }),
    seaOfSkulls: location('seaOfSkulls', '52052', [], { catacomb: true }),
  },
  resolutions: {
    noResolution: baseScenario.resolutions.noResolution,
    r1: baseScenario.resolutions.r1,
    r2: baseScenario.resolutions.r2,
  },
}, returnCards)

export const scenario = {
  ...definitionsScenario,
  encounterDeck: [
    ...encounterDeck(gathered.filter(card => card.code !== '03241b')),
  ],
}

const finished = finishScenario(scenario)
export const identities = finished.identities
export const CARD_DATA = Object.freeze({
  BASE_ID, REFERENCE_CODE, SCENARIO_ID, ENCOUNTER_GROUPS,
  RETURN_CATACOMBS, MALFORMED_SKELETON, RETURN_CATACOMB_CODES,
})
