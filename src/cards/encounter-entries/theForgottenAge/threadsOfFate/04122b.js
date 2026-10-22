// 04122b 哈伦·恩斯通
// 归属：关卡专用 · threadsOfFate（失落的时代 · 命运之线）
// 遭遇组：threads_of_fate
// 卡面：显现 - 将本卡牌与带有[[旁人]]特性的哈伦·恩斯通切换，将被切换版本从游戏中移除。将放在一边的古代遗物附属到哈伦·恩斯通。推进到场景3a——“夺回遗物”。
// 卡面：强制 - 在你成功躲避哈伦·恩斯通，且超过难度至少3点后：将他加入胜利区。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '04122b', scope: 'enemy', enemyRule: {"victory":1},
  // 第 118 轮：生成时接管古代遗物（命运之线的剧情敌人）。
  enemyScript: {
    onSpawn(state, enemy, api) {
      if (state.relicOfAges?.enemyId === enemy.id) return
      state.relicOfAges = { code: '04061', location: enemy.location, enemyId: enemy.id }
      const name = (state.locations || []).find(entry => entry.id === enemy.location)?.name || enemy.location
      api?.info?.(`🏺 古代遗物附属到敌人（「${name}」）。`)
    },
  } }
