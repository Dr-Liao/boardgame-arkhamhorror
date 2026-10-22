// 03336 长翼者
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：生成 - 荒凉平原。
// 卡面：反击。
// 卡面：强制 - 一个地点翻面后，如果长翼者处于重整状态且未与调查员交战：将其朝该地点移动一次。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03336', scope: 'enemy', implemented: true,
  enemyScript: {
    onSpawnLocation(state, code, fallback) {
      return state.locations.some(location => location.id === 'bleakPlains') ? 'bleakPlains' : fallback
    },
    onLocationFlipped(state, enemy, location, api) {
      if (!enemy.exhausted && enemy.engagedSeat == null && enemy.location !== location.id) {
        const next = api.stepToward(enemy.location, location.id)
        if (next) api.moveEnemy(enemy, next)
      }
    },
  },
}
