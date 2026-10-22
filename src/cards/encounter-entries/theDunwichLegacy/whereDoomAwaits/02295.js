// 02295 疯狂的修格斯
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：生成 - 最近的[[幻境]]地点。
// 卡面：强制 - 在疯狂的修格斯攻击时：如果本次攻击将要击败调查员，改为该调查员阵亡。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02295', scope: 'enemy', enemySpawnRule: { spawnMode: 'nearestAltered' },
  enemyScript: {
    onAttackResolved(state, enemy, inv) {
      if (inv.defeated) state.campaign.investigators[inv.seat].status = 'killed'
    },
  },
}
