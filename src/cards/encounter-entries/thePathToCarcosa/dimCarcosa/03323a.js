// 03323a 搜寻陌生人(版本三)
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：每位调查员均不能发现线索。
// 卡面：苍白面具下的男子除因伤害外不能被击败。
// 卡面：目标 - 在苍白面具下的男子将要因伤害被击败时，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03323a', scope: 'act',
  flags: { noClueDiscovery: true, pallidMaskActVersion: 3 },
  actRule: {
    onAdvance(state, act, api) {
      const man = state.enemies.find(enemy => enemy.code === '03059')
      const location = man?.location || 'palaceOfTheKing'
      if (man) api.removeEnemyFromGame(man)
      api.spawn('03333', location)
    },
  },
}
