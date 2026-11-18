// 10545 墙外奇物 / Out of the Walls · 诡计（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · theFeastOfHemlockVale/hemlockHouse（4 份，Setup 时全部放一边，议程 1b 洗入）。
// 卡面：Revelation - 检定 [agility] (3)。若失败且……
//   · ……你所在地点是敌人：承受 1 点伤害与 1 点恐惧；
//   · ……你所在地点未封印且 [[Dormant]]：把它翻到敌人-地点面；
//   · ……你所在地点已封印：随机弃掉 1 张手牌。
// 读点：encounterResolve（抽到时接管显现结算）→ api.test + api.resolveScenarioEvent →
//       behavior.outOfTheWallsFailure（按地点三种状态分派）。
//
// 近似：引擎的声明式 `treacheryRule.test.fail` 只能表达一种固定惩罚（伤害/恐惧/弃资产…），
// 而这三条分支要读地点状态，因此显现检定在条目里发起、分支在 behavior 里按现有数据结算。
export default {
  code: '10545',
  scope: 'treachery',
  implemented: true,
  flags: {
    setAsideOnSetup: true,
    shuffledByAgenda: '10525',
    test: { skill: 'agility', difficulty: 3 },
    enemyLocationHarm: { damage: 1, horror: 1 },
    unsealedDormantFlip: true,
    sealedRandomDiscard: true,
  },
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'agility', 3, result => {
      if (result.success) return
      api.resolveScenarioEvent('hemlockOutOfTheWalls', { seat: inv.seat })
    }, 0, { label: '墙外奇物' })
    return true
  },
  note: '显现检定在条目里发起（api.test），失败的三条分支由 behavior.outOfTheWallsFailure 按地点状态结算；'
    + '卡面不改变「检定失败」的差值语义（没有按差值加罚）。',
}
