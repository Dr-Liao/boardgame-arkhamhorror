// 03210 蒙马特尔
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：[action]花费1资源：在你控制的一张卡牌上放置1补给或子弹标记。(每轮仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 蒙马特高地（03210）：每轮每座位一次，花 1 资源补充 1 弹药/补给。

import { originalOf } from '../../_shared.js'

export default {
  code: '03210', scope: 'location',
  locationRule: {
    actions({ state, inv, location, moves }) {
      const perRoundKey = `${originalOf(location)}:${inv.seat}`
      if (state.scenarioFlags?.[perRoundKey] === state.round) return
      const reloadable = (inv.assets || []).some(asset =>
        ['ammo', 'supply', 'supplies'].includes(String(asset.usesType || '').toLowerCase()))
      moves.push({ action: 'scenarioAction', rule: 'montmartreReload',
        label: '花费1资源，为一张卡牌补充1补给或子弹',
        reason: inv.resources < 1 ? `需要 1 个资源（当前 ${inv.resources}）`
          : reloadable ? null : '需要一张带弹药或补给的支援' })
    },
  },
}
