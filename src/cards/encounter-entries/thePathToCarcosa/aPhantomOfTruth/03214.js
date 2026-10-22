// 03214 奥赛火车站
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：[action]花费1资源：移动到任意一个[[轨道沿线]]地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 奥赛火车站（03214）：[action] 花 1 资源移动到任意轨道沿线地点。

import { ALL_CARDS, originalOf } from '../../_shared.js'

export default {
  code: '03214', scope: 'location',
  locationRule: {
    actions({ state, inv, location, moves }) {
      const hasRail = state.locations.some(candidate =>
        candidate.id !== location.id && ALL_CARDS[originalOf(candidate)]?.traits?.includes('Rail'))
      if (!hasRail) return
      moves.push({ action: 'scenarioAction', rule: 'gareRailMove',
        actionKind: 'move', label: '花费1资源，移动到任意轨道沿线地点',
        reason: inv.resources < 1 ? `需要 1 个资源（当前 ${inv.resources}）` : null })
    },
  },
}
