// 05267 幽灵乌鸦（Spectral Raven）
// 归属：关卡专用 05238《聚合幻灭》（uad）。卡面：生成 - 首位调查员所在地点；
// 与你交战时：结算所在地点的闹鬼能力，或让它 +2 攻击/+2 躲避直到调查阶段结束。
// 一卡一文件：生成地点走 enemySpawnRule.spawnAtFirstInvestigator；
// 交战二选一走 enemyScript.onEngaged（共享 enemyEngaged 派发）；
// +2 数值走 enemyStatRule.boostUntilRound（读点 TCU enemyStatModifier），不再手写章节分支。
export default {
  code: '05267',
  scope: 'enemy',
  implemented: true,
  enemySpawnRule: { spawnAtFirstInvestigator: true },
  enemyStatRule: {
    boostUntilRound: { key: 'ravenBoostUntilRound', stats: ['fight', 'evade'], amount: 2 },
  },
  enemyScript: {
    onEngaged(state, enemy, inv, api) {
      const haunted = api.hauntedAt?.(inv.location)?.length > 0
      let answer = 'modify'
      if (typeof api.choose === 'function') {
        answer = api.choose({
          kind: 'enemy', source: '05267', seat: inv.seat,
          prompt: '幽灵乌鸦与你交战：结算所在地点的闹鬼能力，或让它 +2 攻击/+2 躲避直到调查阶段结束。',
          options: [
            ...(haunted ? [{ id: 'haunted', label: '结算所在地点的闹鬼能力' }] : []),
            { id: 'modify', label: '幽灵乌鸦 +2 攻击与 +2 躲避' },
          ],
        })
      }
      if (answer === 'haunted') {
        api.haunted?.(inv.seat, { locationId: inv.location })
        return
      }
      // 卡面「直到调查阶段结束」：敌人阶段/补给阶段触发时指向下一轮的调查阶段结束。
      const until = (state.phase === 'enemy' || state.phase === 'upkeep') ? state.round + 1 : state.round
      api.boostEnemyUntil?.(enemy, 'ravenBoostUntilRound', until)
      api.info?.('幽灵乌鸦得到 +2 攻击与 +2 躲避直到调查阶段结束。')
    },
  },
}
