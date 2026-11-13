// 09563 血色监视者（The Sanguine Watcher · With the Ruby Spectacles）· enemy
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   反击。
//   强制 - 当敌军阶段结束时，如果血色监视者处于重整状态：每位调查员必须受到 2 点伤害或 2 点恐惧。
//
// 逐卡规则：`enemyScript.onEnemyPhaseEnd` 由章节 behavior 的 `enemyPhaseEnd()` 派发
// （引擎在敌军阶段结束调用 behavior.enemyPhaseEnd）。反击由 definition 的印刷关键词提供。
export default {
  code: '09563',
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    onEnemyPhaseEnd(state, enemy, api) {
      if (!enemy || enemy.exhausted) return false
      const targets = (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
      for (const inv of targets) {
        const answer = api?.choose?.({
          kind: 'choice', source: enemy.code, seat: inv.seat,
          prompt: '「血色监视者」：受到 2 点伤害或 2 点恐惧。',
          options: [{ id: 'damage', label: '受到 2 点伤害' }, { id: 'horror', label: '受到 2 点恐惧' }],
        }) || 'damage'
        if (answer === 'horror') api?.harm?.(inv.seat, { horror: 2 })
        else api?.harm?.(inv.seat, { damage: 2 })
      }
      api?.info?.('🩸 敌军阶段结束：重整的血色监视者让每位调查员受到 2 点伤害或 2 点恐惧。')
      return true
    },
  },
}
