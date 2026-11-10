// 八循环《绯红密钥》P2 原语存档校验汇总入口。
//
// 各原语模块自带 `validateTskXxx(state, value)`；本模块按容器把「存在才校验」的调用集中到一处，
// 由 `save-migration.js#migrateState` 在读档（普通存档 / 续算基底 / 并行线）时调用。
// 口径：读点从不初始化容器；旧存档缺少整个扩展时所有校验都跳过，字节不变。
import { tskCampaignState, tskScenarioState, validateTskContainers } from './tsk-state.js'
import { validateTskConcealed } from './tsk-concealed.js'
import { validateTskErased, validateTskHollows, validateTskInvalidCards } from './tsk-hollow.js'
import { validateTskKeys } from './tsk-scarlet-keys.js'
import { validateTskDossiers, validateTskMap, validateTskSideStories, validateTskStatusReports } from './tsk-map.js'
import { validateTskCustomizations } from './tsk-customizable.js'
import { validateTskCoterie } from './tsk-coterie.js'
import { validateTskCrossSeat, validateTskDoomDiscount, validateTskEvidence } from './tsk-investigator.js'
import { mechanicState } from './mechanic-state.js'

/** 校验一份运行时状态里的全部 TSK 可选扩展；无扩展时零成本放行。 */
export function validateTskState(state) {
  validateTskContainers(state)
  const scenario = tskScenarioState(state)
  if (scenario) {
    validateTskConcealed(state, scenario.concealed)
    validateTskHollows(state, scenario.hollows)
    validateTskCrossSeat(state, scenario.crossSeat)
    validateTskDoomDiscount(state, scenario.doomDiscount)
    validateTskEvidence(state, scenario.evidence)
  }
  const campaign = tskCampaignState(state)
  if (campaign) {
    validateTskKeys(state, campaign.keys)
    validateTskMap(state, campaign.map)
    validateTskStatusReports(state, campaign.statusReports)
    validateTskDossiers(state, campaign.dossiers)
    validateTskSideStories(state, campaign.sideStories)
    validateTskCustomizations(state, campaign.customizations)
    validateTskCoterie(state, campaign.coterie)
    validateTskErased(state, campaign.erased)
    validateTskInvalidCards(state, campaign.invalidCards)
  }
  // 既有 mechanicState 容器里允许出现 tsk 键（场景级扩展的父容器）。
  if (mechanicState(state)?.tsk != null) validateTskContainers(state)
  return true
}

/** 容器是否存在（P4/P7 面板与测试读点；不初始化）。 */
export function tskStateSummary(state) {
  const scenario = tskScenarioState(state)
  const campaign = tskCampaignState(state)
  return {
    scenario: scenario ? Object.keys(scenario).filter(key => key !== 'version').sort() : [],
    campaign: campaign ? Object.keys(campaign).filter(key => key !== 'version').sort() : [],
  }
}
