// 11749 痛苦幻象（Tortured Visions）· 诡计 · 共享遭遇组 dreams（印刷 3 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/dreams。
// 卡面（cards-data 11749）：
//   显现 - 检定[willpower](3)。如果你手牌中不超过3张卡牌，本检定难度+2。
//          如果你失败，受到1点直接恐惧，并随机弃掉你手牌中的1张卡牌。
//
// 读点（声明即接线）：
//   · 显现检定难度按「手牌 ≤3 张时 +2」在条目内计算后交给 api.test；
//   · 失败直接恐惧 = api.directHorror（scenario-runtime 的直接恐惧入口）；
//   · 随机弃 1 张手牌 = api.discardRandom（discardRandomFromHand 的场景运行时别名）。
const CODE = '11749'
const BASE_DIFFICULTY = 3

export default {
  code: CODE,
  name: '痛苦幻象',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Terror'],
    quantity: 3,
    test: { skill: 'willpower', difficulty: BASE_DIFFICULTY, handAtMostPlus: { handAtMost: 3, plus: 2 } },
    failDirectHorror: 1,
    failDiscardRandom: 1,
  },
  encounterResolve(state, inv, card, api) {
    const handSize = (inv.hand || []).length
    const difficulty = BASE_DIFFICULTY + (handSize <= 3 ? 2 : 0)
    api.test(inv.seat, 'willpower', difficulty, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「痛苦幻象」检定（意志 ${result.value} vs ${difficulty}）。`)
        return
      }
      api.directHorror(inv.seat, 1)
      api.discardRandom(inv.seat, 1)
      api.info?.(`😖 「痛苦幻象」：${inv.name} 检定失败，受到 1 点直接恐惧并随机弃掉 1 张手牌。`)
    }, 0, { code: CODE, label: '遭遇检定', name: '痛苦幻象' })
    return false
  },
  note: '难度 = 3（手牌 ≤3 张时 +2，按显现时手牌数计算）；失败 = 1 点直接恐惧 + 随机弃 1 张手牌。'
    + '难度在发起检定前按当前手牌数一次性计算；检定期间手牌数不会变化，与参考的动态修正等价。',
}
