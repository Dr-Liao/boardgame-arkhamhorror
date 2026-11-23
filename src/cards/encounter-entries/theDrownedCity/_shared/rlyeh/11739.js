// 11739 独眼巨人建筑（Cyclopean Architecture）· 诡计 · 共享遭遇组 rlyeh（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/rlyeh。
// 卡面（cards-data 11739）：
//   显现 - 检定[intellect](X)，其中X为你所在地点的印刷隐藏值。
//          你每低于难度1点，选择并弃掉你手牌中的1张卡牌(最多3张)。
//
// 读点（声明即接线）：
//   · 「印刷隐藏值」= 地点实例的 shroud（印刷值；临时/永久修正记在 shroudMod，不进 X），
//     与参考实现 LocationPrintedShroud 同口径；
//   · 显现检定 = api.test（scenarioRuntime 签名）；
//   · 「低于难度每 1 点选择并弃 1 张手牌（最多 3）」= api.discardChosen(seat, n, source)
//     （scenario-runtime 的唯一「选择弃手牌 N 张」实现：逐张询问、开 wouldDiscardFromHand 取消窗口、
//     走 canDiscardFromHand 与 afterHandDiscard）。
const CODE = '11739'
const MAX_DISCARD = 3

export default {
  code: CODE,
  name: '独眼巨人建筑',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Terror'],
    quantity: 2,
    test: { skill: 'intellect', difficultyFromPrintedShroud: true },
  },
  encounterResolve(state, inv, card, api) {
    const location = state.locations?.find(item => item.id === inv.location)
    const difficulty = Math.max(0, Number(location?.shroud) || 0)
    api.test(inv.seat, 'intellect', difficulty, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「独眼巨人建筑」检定（智识 ${result.value} vs ${difficulty}）。`)
        return
      }
      const failedBy = Math.max(0, Number(result?.difficulty ?? difficulty) - Number(result?.value ?? 0))
      const count = Math.min(failedBy, MAX_DISCARD)
      if (count <= 0) return
      api.discardChosen(inv.seat, count, CODE)
      api.info?.(`🏛️ 「独眼巨人建筑」：${inv.name} 低于难度 ${failedBy} 点，选择并弃掉 ${count} 张手牌。`)
    }, 0, { code: CODE, label: '遭遇检定', name: '独眼巨人建筑' })
    return false
  },
  note: '难度 = 所在地点的印刷隐藏值（location.shroud；修正值不进 X）；失败后按失败差值最多弃 3 张手牌，'
    + '走 api.discardChosen（逐张选择、受手牌保护与取消窗口约束，与参考 chooseAndDiscardCards 同口径）。',
}
