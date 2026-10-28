// 03093 骚灵
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：hauntings
// 卡面：除因[[法术]]、[[遗物]]和遭遇卡牌外不能受到伤害。
// 卡面：[action]谈判。检定[intellect](3)以尝试驱逐此灵怪。如果你检定成功，对其造成1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
// 谈判是引擎的通用 Parley 原语（src/engine/parley.js）；「只能被法术/遗物/遭遇伤害」
// 仍是 enemyScript.onDamageAllowed。

import { ALL_CARDS, originalOf } from '../../../_shared.js'

export default {
  code: '03093', scope: 'enemy', implemented: true,
  abilities: [
    {
      kind: 'action',
      actionKind: 'parley',
      label: '谈判骚灵（智识 3）：成功对其造成 1 点伤害',
      cost: { action: 1 },
      resolve: ({ inv, source, api }) => {
        api.test(inv.seat, 'intellect', 3, {
          source: { type: 'scenario', action: 'parley', name: '谈判', code: '03093', ability: true },
          resolve: result => {
            if (result.success) api.damageEnemy(source, 1, inv.seat, 'encounter')
          },
        })
      },
    },
  ],
  enemyScript: {
    onDamageAllowed(state, enemy, source, seat) {
      // 遭遇卡自己造成的伤害（`encounter` 来源）总是允许。
      if (source === 'encounter') return true
      const inv = Number.isInteger(seat) ? state.investigators[seat] : null
      // 引擎传的是「来源卡号」：支援传实例 id（用 id 找卡），事件/法术牌传 code。
      const sourceAsset = inv?.assets.find(asset => asset.id === source)
      const sourceCode = originalOf(sourceAsset) || (ALL_CARDS[source] ? source : null)
      const list = (ALL_CARDS[sourceCode]?.traits || sourceAsset?.traits || [])
        .map(trait => String(trait).toLowerCase())
      return list.some(trait => ['spell', 'relic'].includes(trait))
    },
  },
}
