// 10546 拖离正道 / Pulled In · 诡计（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · theFeastOfHemlockVale/hemlockHouse（2 份，Setup 时全部放一边，议程 1b 洗入）。
// 卡面：Revelation - 若场上没有敌人-地点，本卡获得涌动；否则检定 [combat] (4)。若失败，选择最近的
// 敌人-地点并移动（一次一个地点）过去；若失败 4 点或以上，该敌人-地点攻击你。
// 读点：behavior.encounterGainsSurge（无敌人-地点时涌动）+ encounterResolve → behavior.pulledInFailure。
export default {
  code: '10546',
  scope: 'treachery',
  implemented: true,
  flags: {
    setAsideOnSetup: true,
    shuffledByAgenda: '10525',
    test: { skill: 'combat', difficulty: 4 },
    surgeWithoutEnemyLocation: true,
    attackOnFailByFour: true,
  },
  encounterResolve(state, inv, card, api) {
    const hasEnemyLocation = (state.locations || []).some(location => location.enemyLocationFace)
    if (!hasEnemyLocation) return true
    api.test(inv.seat, 'combat', 4, result => {
      if (result.success) return
      const failedBy = Math.max(0, Number(result.difficulty || 4) - Number(result.value || 0))
      api.resolveScenarioEvent('hemlockPulledIn', { seat: inv.seat, failedBy })
    }, 0, { label: '拖离正道' })
    return true
  },
  note: '涌动由 behavior.encounterGainsSurge（场上没有敌人-地点）返回，与其它涌动共用引擎读点；'
    + '「移动到最近的敌人-地点」是一次一个地点地移动（一次 relocate），本实现按最短连接路径取目标地点。',
}
