// 06108 隐蔽的祖格鼠（Inconspicuous Zoog，敌人，1 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：zoogs（TSK）。
// 卡面：Spawn - 任意连接地点。猎手。Swarming 2。
//       强制 - 隐蔽的祖格鼠被击败时：取消所有超出伤害，并把其余的蜂拥/头领卡牌移动到
//       一个连接地点，呈横置状态。
// 实现：猎手/Swarming 2 由 definition 解析；生成地点由共享 spawnLocation 读点处理。
//   只有作为蜂拥卡的本敌人被击败时，onSwarmDefeated 才取消超出伤害并横置、移动头领与其余蜂拥卡。
export default {
  code: '06108',
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    onSwarmDefeated(state, swarmEnemy, host, api) {
      const here = (state.locations || []).find(location => location.id === host.location)
      const candidates = (here?.connections || [])
        .map(id => (state.locations || []).find(location => location.id === id))
        .filter(location => location && (host.elite || !location.barricade))
      if (candidates.length && !host.immobile) {
        const seat = swarmEnemy.defeatedBy ?? swarmEnemy.engagedSeat ?? state.campaign?.leadSeat ?? 0
        const answer = candidates.length === 1 ? candidates[0].id : api.choose?.({
          kind: 'location', source: '06108', seat,
          prompt: '隐蔽的祖格鼠被击败：选择头领及其余蜂拥卡移动到的连接地点。',
          options: candidates.map(location => ({ id: location.id, label: location.name })),
        })
        const destination = candidates.find(location => location.id === answer) || candidates[0]
        api.exhaustEnemy?.(host)
        api.moveEnemy?.(host, destination.id)
      }
      return { cancelExcessDamage: true }
    },
  },
  flags: {
    spawn: { kind: 'anyConnectingLocation' },
  },
}
