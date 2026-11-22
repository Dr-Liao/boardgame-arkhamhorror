// 批次 2：「重返敦威治遗产」战役（参考战役 51）。
//
// 章节内容见 scenarios/<returnToXxx>/；通关结构、混乱袋、战役记录与幕间沿用基础
// 《敦威治遗产》，只把八章 id 映射到重返章节。默认弱点池通过 requiredPackIds 引入
// 已注册的 `rtdwlPlayer`（含基础弱点 51011「穿越门扉」）。
import { manifest as base } from '../theDunwichLegacy/manifest.js'
import { returnCampaignManifest } from '../returnCampaignShared.js'

const SCENARIO_ID_MAP = Object.freeze({
  extracurricularActivity: 'returnToExtracurricularActivities',
  theHouseAlwaysWins: 'returnToTheHouseAlwaysWins',
  theMiskatonicMuseum: 'returnToTheMiskatonicMuseum',
  theEssexCountyExpress: 'returnToTheEssexCountyExpress',
  bloodOnTheAltar: 'returnToBloodOnTheAltar',
  undimensionedAndUnseen: 'returnToUndimensionedAndUnseen',
  whereDoomAwaits: 'returnToWhereDoomAwaits',
  lostInTimeAndSpace: 'returnToLostInTimeAndSpace',
})

export const manifest = Object.freeze(returnCampaignManifest(base, {
  id: 'returnToTheDunwichLegacy',
  name: '重返敦威治遗产',
  nameEn: 'Return to The Dunwich Legacy',
  scenarioIdMap: SCENARIO_ID_MAP,
  requiredPackIds: ['core', 'dunwichCampaign', 'rtdwlCampaign', 'rtdwlPlayer'],
}))

export const CAMPAIGN = Object.freeze({
  id: manifest.id, name: manifest.name, nameEn: manifest.nameEn,
  scenarioOrder: manifest.scenarioIds,
})
