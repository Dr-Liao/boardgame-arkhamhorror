// 06048 楼梯底部（Base of the Steps）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：强制 - 你进入「楼梯底部」后，若你手牌中至少有 1 张卡牌：检定意志(X)，X 为你手牌中的卡牌数
//   （投入本次检定的卡牌结算后）。若你失败，对每张手牌，你必须选择受到 1 点恐惧或弃掉该卡牌。
//   未揭示面：除非「七百级台阶」上的全部线索都被发现，否则你不能进入「楼梯底部」。
// 读点：onEnter.effect（引擎 movement.js 直接读 locationRule.onEnter.effect）；
//   entryError（引擎 investigatorEntryError 直接读，只对未揭示面生效）。
// 简化：X 用进入时的即时手牌数（引擎难度在检定开始时固定；投入后的手牌数没有二次难度读点）——见报告 simplified。
import { activeInvestigators, originalOf } from '../../_shared.js'

const CODE = '06048'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    entryError(state, location, inv) {
      const steps = (state.locations || []).find(entry => originalOf(entry) === '06047')
      if (steps && Number(steps.clues || 0) > 0) {
        return '「楼梯底部」：必须先发现「七百级台阶」上的全部线索，才能进入这里。'
      }
      return undefined
    },
    onEnter: {
      effect(state, location, api, inv) {
        if (!inv || (inv.hand || []).length < 1) return
        const difficulty = (inv.hand || []).length
        api.test?.(inv.seat, 'willpower', difficulty, result => {
          if (result.success) return
          const hand = [...(inv.hand || [])]
          api.info?.(`📜 楼梯底部：检定失败，${inv.name} 要为手中的 ${hand.length} 张卡牌逐一选择（受到 1 点恐惧或弃掉）。`)
          for (const code of hand) {
            if (!(inv.hand || []).includes(code)) continue
            const answer = api.choice?.({
              kind: 'discard', source: CODE, seat: inv.seat,
              prompt: `「${code}」：受到 1 点恐惧，或弃掉这张卡牌？`,
              options: [
                { id: 'horror', label: '受到 1 点恐惧' },
                { id: 'discard', label: '弃掉这张卡牌' },
              ],
            })
            if (answer === 'discard') api.discardFromHand?.(inv.seat, code)
            else api.horror?.(inv.seat, 1)
          }
        })
      },
    },
  },
}
