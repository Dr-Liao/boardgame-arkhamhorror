// 04075 杂草丛生的遗迹
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：rainforest
// 卡面：强制 - 在你进入杂草丛生的遗迹后，如果你已中毒：失去所有剩余行动并结束你的回合。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 杂草丛生的遗迹（04075）：进入后若已中毒，失去所有剩余行动并结束回合。

import { isPoisonedInvestigator } from '../../../_shared.js'

export default {
  code: '04075', scope: 'location',
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        if (!isPoisonedInvestigator(inv)) return
        api.endTurn(inv.seat)
        api?.info?.(`🕳️ ${inv.name} 已中毒：进入漆黑洞穴后立即失去所有行动并结束回合。`)
      },
    },
  },
}
