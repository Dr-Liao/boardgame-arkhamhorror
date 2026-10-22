// 04130b 亨利·德沃
// 归属：关卡专用 · threadsOfFate（失落的时代 · 命运之线）
// 遭遇组：threads_of_fate
// 卡面：显现 - 将本卡牌与带有[[旁人]]特性的亨利·德沃切换，将被切换版本从游戏中移除。将放在一边的亚历山卓·维拉附属到亨利·德沃。推进到场景3c——“亚历山卓遇险”。
// 卡面：反击。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '04130b', scope: 'enemy', enemyRule: {"victory":1},
  // 第 118 轮：生成时被敌人带走。
  enemyScript: {
    onSpawn(state, enemy, api) {
      if (state.scenarioFlags?.alejandro?.enemyId === enemy.id) return
      state.scenarioFlags ||= {}
      state.scenarioFlags.alejandro = { code: '04051', location: enemy.location, enemyId: enemy.id }
      api?.info?.('🧭 亚历山卓·维拉被敌人带走。')
    },
  } }
