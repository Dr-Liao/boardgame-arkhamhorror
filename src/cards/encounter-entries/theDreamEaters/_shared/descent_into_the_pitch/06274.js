// 06274 阿特拉克·纳克亚之影（Shadow of Atlach-Nacha，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：descent_into_the_pitch（PONR）。
// 卡面：Revelation - 检定[willpower](2)。本剧本参考卡上每有 1 点伤害，本次检定难度 +1。
//       如果你检定失败，受到 1 点伤害和 1 点恐惧。
// 实现：难度 = 2 + referenceDamage（PONR 章节写 scenarioFlags.referenceDamage）；
//   encounterResolve 里自定义检定，失败 api.applyPenalty({kind:'damageAndHorror',damage:1,horror:1})。
//   不使用声明式 test（difficulty.plus 没有 referenceDamage 口径）。
export default {
  code: '06274',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const referenceDamage = Math.max(0, Number(state.scenarioFlags?.referenceDamage) || 0)
    const difficulty = 2 + referenceDamage
    api.test?.(inv.seat, 'willpower', difficulty, result => {
      if (result.success) return
      api.applyPenalty?.(inv.seat, { kind: 'damageAndHorror', damage: 1, horror: 1 }, 0, { silent: true })
      api.info?.(`🌑 「阿特拉克·纳克亚之影」：${inv.name} 受到 1 点伤害和 1 点恐惧。`)
    })
    return false
  },
}
