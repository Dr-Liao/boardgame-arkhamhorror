// 10726 诡异突变（Strange Mutations）· 诡计 · 共享遭遇组 transfiguration（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/transfiguration。
// 卡面（cards-data 10726）：
//   显现 - 检定[意志](5)。你每有 1 点恐惧，本次检定难度降低 1 点。
//   如果你检定失败，你必须受到 2 点恐惧或随机弃掉你 2 张手牌。
//
// 读点（声明即接线）：显现直接在本条目结算（treachery-tokens.js 的 entryRevelation 分支，
//   api = scenarioRuntime）。难度 = 5 − 当前恐惧（下限 0），在 api.test 前算好传给引擎；
//   失败二选一走 api.choice，恐惧走 api.horror、随机弃牌走 api.discardRandom
//   （deck-ops 的随机弃手牌管线，含弃牌窗口）。
const CODE = '10726'
const BASE_DIFFICULTY = 5

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Power'],
    quantity: 2,
    test: { skill: 'willpower', difficulty: BASE_DIFFICULTY, plus: { horror: -1 } },
    failChoice: [{ horror: 2 }, { discardRandom: 2 }],
  },
  encounterResolve(state, inv, card, api) {
    const seat = inv?.seat
    if (!Number.isInteger(seat)) return false
    const difficulty = Math.max(0, BASE_DIFFICULTY - (Number(inv.horror) || 0))
    api.test(seat, 'willpower', difficulty, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「诡异突变」检定（意志 ${result.value} vs ${difficulty}）。`)
        return
      }
      const owner = state?.investigators?.[seat]
      if (!owner || owner.defeated || owner.resigned) return
      const options = [{ id: 'horror', label: '受到 2 点恐惧' }]
      if ((owner.hand || []).length >= 2) options.push({ id: 'discard', label: '随机弃掉 2 张手牌' })
      const answer = options.length === 1
        ? options[0].id
        : String(api.choice({
          kind: 'effect', source: CODE, seat,
          prompt: '诡异突变：受到 2 点恐惧，或随机弃掉 2 张手牌。', options,
        }))
      if (answer === 'discard') {
        api.discardRandom(seat, 2)
        api.info?.(`🧬 「诡异突变」：${inv.name} 随机弃掉 2 张手牌。`)
      } else {
        api.horror(seat, 2)
        api.info?.(`🧬 「诡异突变」：${inv.name} 受到 2 点恐惧。`)
      }
    }, 0, { code: CODE, label: '遭遇检定', name: '诡异突变' })
    // false = 显现结算完成后由引擎把本卡放进遭遇弃牌堆。
    return false
  },
  note: '显现自足实现：难度按当前恐惧逐点降低（下限 0）；手牌不足 2 张时只保留「受到 2 点恐惧」选项。',
}
