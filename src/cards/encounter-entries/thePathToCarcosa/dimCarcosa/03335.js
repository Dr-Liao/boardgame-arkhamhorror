// 03335 迪蒙生物
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：生成 - 迪蒙深渊。
// 卡面：庞大。
// 卡面：强制 - 在迪蒙生物所在地点或一个连接地点翻面时，如果迪蒙生物处于重整状态：它攻击位于该地点的每位调查员。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03335', scope: 'enemy', implemented: true,
  enemyScript: {
    onSpawnLocation(state, code, fallback) {
      return state.locations.some(location => location.id === 'depthsOfDemhe') ? 'depthsOfDemhe' : fallback
    },
    onLocationWillFlip(state, enemy, location, api) {
      if (enemy.exhausted) return
      const origin = state.locations.find(candidate => candidate.id === enemy.location)
      if (enemy.location === location.id || origin?.connections?.includes(location.id)) {
        for (const inv of state.investigators.filter(candidate => !candidate.defeated && !candidate.resigned
          && candidate.location === location.id)) api.attack(enemy, inv)
      }
    },
  },
}
