// 04137b 玛利亚·德西瓦
// 归属：关卡专用 · threadsOfFate（失落的时代 · 命运之线）
// 遭遇组：threads_of_fate
// 卡面：显现 - 将本卡牌与带有[[旁人]]特性的玛利亚·德西瓦切换，将被切换版本从游戏中移除。记住她是“伊塔卡的猎物”。推进到场景3e——“兄弟会暴露”。
// 卡面：反击。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '04137b', scope: 'enemy', enemyRule: {"victory":1},
  // 第 118 轮：生成时成为伊塔卡的猎物。
  enemyScript: {
    onSpawn(state, enemy) {
      const flags = (state.scenarioFlags ||= {})
      flags.ichtacasPrey ||= []
      if (!flags.ichtacasPrey.includes(enemy.id)) flags.ichtacasPrey.push(enemy.id)
    },
  } }
