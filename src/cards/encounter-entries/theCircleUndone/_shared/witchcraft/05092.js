// 05092 恶魔之音
// 归属：战役共用 · theCircleUndone；遭遇组：witchcraft
// 卡面：显现 - 检定[willpower](3)。遭遇弃牌中每有 1 张恶魔之音，本次检定难度 +1。
//   你检定失败且每低于难度 1 点，随机弃掉一张手牌。你每有一张卡牌无法弃掉，受到 1 点恐惧或 1 点伤害。

const VOICES = '05092'

export default {
  code: '05092',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const copiesInDiscard = (state.encounterDiscard || []).filter(code => code === VOICES).length
    const difficulty = 3 + copiesInDiscard
    let failedBy = 0
    api.test(inv.seat, 'willpower', difficulty, result => {
      if (result.success) return
      failedBy = Math.max(0, (result.difficulty ?? difficulty) - (result.value ?? 0))
    })
    if (failedBy <= 0) return false
    const handSize = (inv.hand || []).length
    const discarded = Math.min(failedBy, handSize)
    if (discarded > 0) api.discardRandom(inv.seat, discarded)
    const overflow = failedBy - discarded
    for (let index = 0; index < overflow; index++) {
      if (inv.defeated || inv.resigned) break
      const answer = api.choose({
        kind: 'choice', source: VOICES, seat: inv.seat,
        prompt: '恶魔之音：你有一张卡牌无法弃掉，受到 1 点恐惧或 1 点伤害。',
        options: [{ id: 'horror', label: '受到 1 点恐惧' }, { id: 'damage', label: '受到 1 点伤害' }],
      })
      if (answer === 'damage') api.damage(inv.seat, 1)
      else api.horror(inv.seat, 1)
    }
    return false
  },
}
