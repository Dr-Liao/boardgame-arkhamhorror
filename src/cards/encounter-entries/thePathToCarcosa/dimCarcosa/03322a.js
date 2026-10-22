// 03322a 搜寻陌生人(版本二)
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：每位调查员均不能发现线索。
// 卡面：苍白面具下的男子除因其[action]能力外不能被击败。
// 卡面：目标 - 在苍白面具下的男子将要因其[action]能力被击败时，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03322a', scope: 'act',
  flags: { noClueDiscovery: true, pallidMaskActVersion: 2 },
  actRule: {
    onAdvance(state, act, api) {
      const man = state.enemies.find(enemy => enemy.code === '03059')
      if (man) api.removeEnemyFromGame(man)
      const spawned = api.spawn('03332', 'palaceOfTheKing')
      // 卡背：哈斯塔视为在场，但不在任何地点（战斗/躲避仍通过剧情能力处理）。
      if (spawned) {
        spawned.location = null
        spawned.engagedSeat = null
        spawned.noLocation = true
      }
    },
  },
}
