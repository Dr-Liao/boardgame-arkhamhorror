// 批次 2：「重返卡尔克萨之路」战役（参考战役 52）。
//
// 章节内容见 scenarios/<returnToXxx>/；通关结构、混乱袋、战役记录、幕间选择与
// 尾声沿用基础《卡尔克萨之路》，只把八章 id 映射到重返章节。默认弱点池通过
// requiredPackIds 引入已注册的 `rtptcPlayer`（含 52011–52013 三张「邪秽誓约」）。
import { manifest as base } from '../thePathToCarcosa/manifest.js'
import { returnCampaignManifest } from '../returnCampaignShared.js'

const SCENARIO_ID_MAP = Object.freeze({
  curtainCall: 'returnToCurtainCall',
  theLastKing: 'returnToTheLastKing',
  echoesOfThePast: 'returnToEchoesOfThePast',
  theUnspeakableOath: 'returnToTheUnspeakableOath',
  aPhantomOfTruth: 'returnToAPhantomOfTruth',
  thePallidMask: 'returnToThePallidMask',
  blackStarsRise: 'returnToBlackStarsRise',
  dimCarcosa: 'returnToDimCarcosa',
})

export const manifest = Object.freeze(returnCampaignManifest(base, {
  id: 'returnToThePathToCarcosa',
  name: '重返卡尔克萨之路',
  nameEn: 'Return to The Path to Carcosa',
  scenarioIdMap: SCENARIO_ID_MAP,
  requiredPackIds: ['core', 'carcosaCampaign', 'rtptcCampaign', 'rtptcPlayer'],
}))

export const CAMPAIGN = Object.freeze({
  id: manifest.id, name: manifest.name, nameEn: manifest.nameEn,
  scenarioOrder: manifest.scenarioIds,
})
