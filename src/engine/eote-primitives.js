// 七循环《地球边缘》P2 原语存档校验汇总入口。
//
// 各原语模块自带 `validateEoteXxx(state, value)`；本模块按容器把「存在才校验」的调用集中到一处，
// 由 `save-migration.js#migrateState` 在读档（普通存档 / 续算基底 / 并行线）时调用。
// 口径：读点从不初始化容器；旧存档缺少整个扩展时所有校验都跳过，字节不变。
import { eoteCampaignState, eoteScenarioState, validateEoteContainers } from './eote-state.js'
import { validateEoteShelter } from './eote-shelter.js'
import { validateEoteCamp } from './eote-camp.js'
import { validateEoteFacilities } from './eote-facilities.js'
import { validateEoteClimb } from './eote-climb.js'
import { validateEoteCity } from './eote-city.js'
import { validateEoteTekeli } from './eote-tekeli.js'
import { validateEoteDeckTop } from './eote-deck-top.js'
import { validateEoteRoundDistance } from './eote-round-distance.js'
import { validateEoteLevels } from './vertical-chain.js'
import { validateEoteCityscape } from './grid-map.js'
import { validateEoteDecks } from './scenario-decks.js'
import { validateEoteValueKeys } from './scenario-keys.js'
import { validateEoteCrossSeat } from './play-channels.js'
import { validateEotePartners } from '../campaign/eote-partners.js'
import { validateEoteSeals } from '../campaign/eote-seals.js'
import { validateEoteMemorials } from '../campaign/eote-memorials.js'
import { validateEoteSupplies } from '../campaign/eote-supplies.js'
import { validateEoteMirage } from '../campaign/campaign-parts.js'
import { mechanicState } from './mechanic-state.js'
import { validateEoteDisciplines } from './eote-disciplines.js'

/** 校验一份运行时状态里的全部 EotE 可选扩展；无扩展时零成本放行。 */
export function validateEoteState(state) {
  validateEoteContainers(state)
  const scenario = eoteScenarioState(state)
  if (scenario) {
    validateEoteShelter(state, scenario.shelter)
    validateEoteCamp(state, scenario.shelter)
    validateEoteFacilities(state, scenario.facilities)
    validateEoteClimb(state, scenario.climb)
    validateEoteCity(state, scenario.city)
    validateEoteTekeli(state, scenario.tekeli)
    validateEoteDeckTop(state, scenario.deckTop)
    validateEoteRoundDistance(state, scenario.roundDistance)
    validateEoteCrossSeat(state, scenario.crossSeat)
    validateEoteCityscape(state, scenario.city?.cityscape)
  }
  const campaign = eoteCampaignState(state)
  if (campaign) {
    validateEotePartners(state, campaign.partners)
    validateEoteSeals(state, campaign.seals)
    validateEoteMemorials(state, campaign.memorials)
    validateEoteSupplies(state, campaign.supplies)
    validateEoteDisciplines(state, campaign.disciplines)
    validateEoteMirage(state, campaign.mirage)
  }
  // 复用既有 mechanicState 容器的扩展部分（只校验 EotE 新语义，既有条目仍归 mechanic-state.js）。
  const mechanics = mechanicState(state)
  if (mechanics) {
    validateEoteValueKeys(state, mechanics.keys)
    validateEoteDecks(state, mechanics.scenarioDecks)
  }
  validateEoteLevels(state, state?.locations)
}
