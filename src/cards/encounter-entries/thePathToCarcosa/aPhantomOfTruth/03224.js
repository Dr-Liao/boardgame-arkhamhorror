// 03224 致命运数
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：显现 - 检定[willpower](3)。如果你检定失败，从遭遇牌库顶弃掉卡牌，直到弃掉一个敌人。你必须抽取该敌人，或该敌人攻击你(从遭遇弃牌堆)。如果没有敌人被弃掉，改为受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS, originalOf } from '../../_shared.js'

export default {
  code: '03224', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    api.test(inv.seat, 'willpower', 3, result => {
      if (result.success) return
      let enemyCode = null
      while (state.encounterDeck.length) {
        const discarded = state.encounterDeck.pop()
        state.encounterDiscard.push(discarded)
        if (ALL_CARDS[originalOf(discarded)]?.type === 'enemy') { enemyCode = discarded; break }
      }
      const enemies = state.encounterDiscard.filter(candidate => ALL_CARDS[originalOf(candidate)]?.type === 'enemy')
      if (!enemyCode || !enemies.length) { api.horror(inv.seat, 1); return }
      const choice = api.choose({
        kind: 'encounter', source: code, seat: inv.seat,
        prompt: `致命运数：选择抽取刚弃掉的「${ALL_CARDS[originalOf(enemyCode)]?.nameZh || enemyCode}」，或让它攻击你。`,
        options: [{ id: 'draw', label: `抽取「${ALL_CARDS[originalOf(enemyCode)]?.nameZh || enemyCode}」` },
          { id: 'attack', label: `让刚弃掉的「${ALL_CARDS[originalOf(enemyCode)]?.nameZh || enemyCode}」攻击你` }],
      })
      if (choice === 'draw') {
        state.encounterDiscard.splice(state.encounterDiscard.lastIndexOf(enemyCode), 1)
        state.encounterDeck.push(enemyCode)
        api.drawEncounter(inv.seat)
        return
      }
      // 攻击你的必须是刚弃掉的那张敌人，不能从弃牌堆改选。
      api.attackFromDiscard(enemyCode, inv.seat)
    })
    return false
  },
}
