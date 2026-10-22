// 03321a 搜寻陌生人(版本一)
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：每位调查员均不能发现线索。
// 卡面：苍白面具下的男子不能被击败。
// 卡面：目标 - 调查员队长位于苍白面具下的男子所在地点时，其可以花费[action][action][action]以推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03321a', scope: 'act',
  flags: { noClueDiscovery: true, pallidMaskActVersion: 1 },
  actRule: {
    // 背面（推进到 3a 时结算）：移除男子、给领队 03321b、生成褴褛之王。
    onAdvance(state, act, api) {
      const man = state.enemies.find(enemy => enemy.code === '03059')
      if (man) api.removeEnemyFromGame(man)
      if (!state.investigators.some(inv => inv.assets.some(asset => asset.code === '03321b'))) {
        api.giveAsset(state.campaign.leadSeat, '03321b', { cannotLeavePlay: true, sanityModifier: -2 })
      }
      api.spawn('03334', 'palaceOfTheKing')
    },
  },
}
