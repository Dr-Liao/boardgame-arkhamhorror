// 02122 寻找入口
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 58 轮：敦威治 `actReveal` 剩余可纯 `api` 表达的分支。

import { originalOf, activeInvestigators, scenarioLocationId } from '../../_shared.js'

export default {
  code: '02122', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      api.reveal(scenarioLocationId(state, '02127') || 'location02127')
      if (state.scenarioFlags.brokeMuseumDoor) {
        state.acts[1] = { ...state.scenario.acts.find(item => originalOf(item) === '02124') }
        return
      }
      const seat = api.choose({
        kind: 'story', source: '02139', seat: state.campaign.leadSeat,
        prompt: '选择剧情资产的控制者。',
        options: activeInvestigators(state).map(inv => ({ id: String(inv.seat), label: inv.name })),
      })
      api.giveAsset(Number(seat), '02139')
    },
  },
}
