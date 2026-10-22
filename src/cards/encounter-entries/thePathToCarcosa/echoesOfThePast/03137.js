// 03137 历史协会
// 归属：关卡专用 · echoesOfThePast（卡尔克萨之路 · 往事回声）
// 遭遇组：echoes_of_the_past
// 卡面：位于本地点的调查员控制皮博迪先生时，本地点隐藏值-2。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'
import { nonPlayerEntryFor } from '../../_lookup.js'

export default {
  code: '03137', scope: 'location', historicalRoom: true,
  // 第 119 轮：皮博迪先生在此地点时帷幕 -2（原 locationShroudModifier 分支）。
  modifiers: [{
    target: 'locationShroud', amount: -2,
    condition: { when: ({ state, entity }) => (state.investigators || []).some(inv =>
      inv.location === entity.id && (inv.assets || []).some(asset => nonPlayerEntryFor(originalOf(asset))?.assetRule?.peabody)) },
  }],
}
