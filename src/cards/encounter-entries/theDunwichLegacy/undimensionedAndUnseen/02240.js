// 02240 古阿拉伯手稿
// 归属：关卡专用 · undimensionedAndUnseen（无人知晓）
// 遭遇组：undimensioned_and_unseen
// 卡面：目标 - 只有沃特雷家的废墟中的调查员可以共同花费所需数量的线索以推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { activeInvestigators } from '../../_shared.js'

export default {
  code: '02240', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      for (const inv of activeInvestigators(state)) api.giveAsset(inv.seat, '02254')
      state.scenarioZones.setAside = state.scenarioZones.setAside.filter(code => code !== '02254')
      if ((state.campaign.records.sacrificedToYogSothoth || []).includes('02040')) state.doom++
    },
  },
}
