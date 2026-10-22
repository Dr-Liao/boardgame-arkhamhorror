// 03093 骚灵
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：hauntings
// 卡面：除因[[法术]]、[[遗物]]和遭遇卡牌外不能受到伤害。
// 卡面：[action]谈判。检定[intellect](3)以尝试驱逐此灵怪。如果你检定成功，对其造成1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS, originalOf } from '../../../_shared.js'

export default {
  code: '03093', scope: 'enemy', implemented: true,
  enemyScript: {
    encounterAction(state, inv, enemy) {
      return {
        action: 'encounterAction', actionKind: 'parley', rule: 'parleyPoltergeist',
        enemyId: enemy.id, actions: 1, label: '谈判骚灵（智识3）：成功对其造成1点伤害',
      }
    },
    onDamageAllowed(state, enemy, source, seat) {
      if (source === 'encounter') return true
      const inv = state.investigators[seat]
      const sourceCard = inv?.assets.find(asset => asset.id === source)
      const list = (ALL_CARDS[originalOf(sourceCard)]?.traits || sourceCard?.traits || [])
        .map(trait => String(trait).toLowerCase())
      return list.some(trait => ['spell', 'relic'].includes(trait))
    },
  },
}
