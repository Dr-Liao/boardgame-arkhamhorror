// 10728 衰弱（Enervation）· 诡计 · 共享遭遇组 blight（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/blight。
// 卡面（cards-data 10728）：
//   显现 - 检定[战斗](5)。你每有 1 点伤害，本次检定难度降低 1 点。
//   如果你检定失败，你必须受到 2 点伤害，或选择并弃掉你手牌中印刷费用最高的卡牌。
//
// 读点（声明即接线）：显现直接在本条目结算（entryRevelation 分支，api = scenarioRuntime）。
//   难度 = 5 − 当前伤害（下限 0）；失败二选一走 api.choice，伤害走 api.damage，
//   弃最高印刷费用牌走「计算最高费用 → 平手时 api.choice → api.putInDiscard({fromHand:true})」。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '10728'
const BASE_DIFFICULTY = 5

const printedCost = code => Math.max(0, Number(ALL_CARDS[code]?.cost) || 0)

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Hazard', 'Blight'],
    quantity: 2,
    test: { skill: 'combat', difficulty: BASE_DIFFICULTY, plus: { damage: -1 } },
    failChoice: [{ damage: 2 }, { discardHighestPrintedCost: 1 }],
  },
  encounterResolve(state, inv, card, api) {
    const seat = inv?.seat
    if (!Number.isInteger(seat)) return false
    const difficulty = Math.max(0, BASE_DIFFICULTY - (Number(inv.damage) || 0))
    api.test(seat, 'combat', difficulty, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「衰弱」检定（战斗 ${result.value} vs ${difficulty}）。`)
        return
      }
      const owner = state?.investigators?.[seat]
      if (!owner || owner.defeated || owner.resigned) return
      const hand = [...(owner.hand || [])]
      const answer = String(api.choice({
        kind: 'effect', source: CODE, seat,
        prompt: '衰弱：受到 2 点伤害，或弃掉手牌中印刷费用最高的卡牌。',
        options: [
          { id: 'damage', label: '受到 2 点伤害' },
          ...(hand.length ? [{ id: 'discard', label: '弃掉印刷费用最高的手牌' }] : []),
        ],
      }))
      if (answer !== 'discard') {
        api.damage(seat, 2)
        api.info?.(`🦠 「衰弱」：${inv.name} 受到 2 点伤害。`)
        return
      }
      const highest = Math.max(...hand.map(printedCost))
      const top = [...new Set(hand.filter(code => printedCost(code) === highest))]
      const picked = top.length === 1 ? top[0] : String(api.choice({
        kind: 'card', source: CODE, seat,
        prompt: '选择弃掉印刷费用最高的其中一张手牌（费用相同）。',
        options: top.map(code => ({ id: code, label: api.cardName?.(code) || code, cardCode: code })),
      }))
      const code = top.includes(picked) ? picked : top[0]
      api.putInDiscard(seat, code, { fromHand: true })
      api.info?.(`🦠 「衰弱」：${inv.name} 弃掉印刷费用最高的「${api.cardName?.(code) || code}」。`)
    }, 0, { code: CODE, label: '遭遇检定', name: '衰弱' })
    // false = 显现结算完成后由引擎把本卡放进遭遇弃牌堆。
    return false
  },
  note: '显现自足实现：难度按当前伤害逐点降低（下限 0）；空手时只保留「受到 2 点伤害」。'
    + '弃牌走 putInDiscard(fromHand)（不触发手牌弃置窗口，见 note）。',
}
