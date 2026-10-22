// 03059 苍白面具下的男子
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：curtain_call
// 卡面：生成 - 距离所有调查员最远的地点。
// 卡面：冷漠。
// 卡面：[action]：调查。本次调查你所在地点的隐藏值+2。如果你检定成功，不发现线索，改为击败苍白面具下的男子。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 苍白面具下的男子（03059）：被击败时推进战役记录。

export default {
  code: '03059', name: '苍白面具下的男子', scope: 'enemy', text: '生成 - 距离所有调查员最远的地点。', pallidMask: true,
  spawnFarthestFromAll: true,
  enemyScript: {
    pallidMask: true,
    encounterAction(state, inv, enemy) {
      return {
        action: 'encounterAction', actionKind: 'investigate', rule: 'investigatePallidMask',
        enemyId: enemy.id, actions: 1, label: '调查苍白面具下的男子（本地点帷幕+2）',
      }
    },
  },
}
