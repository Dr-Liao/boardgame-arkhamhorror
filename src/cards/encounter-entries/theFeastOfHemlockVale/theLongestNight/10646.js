// 10646 山羊混种
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 生成：敌人最少的外围农田
// 卡面：生成 - 敌人最少的外围农田。警戒。巡逻（农庄）。忽略诱饵。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10646',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    patrolTarget: {
      kind: 'named',
      locationId: 'theFarmhouse'
    },
    ignoreDefenses: [
      'decoy'
    ],
    discardToScenarioDeck: 'enemyDeck'
  },
  flags: {
    spawnFarthestEnemies: 'fewestOuterField',
    alert: true,
    patrol: 'theFarmhouse',
    ignoreDefenses: [
      'decoy'
    ],
    quantity: 3
  },
  note: '「敌人最少的外围农田」由 behavior.spawnLocation 的 fewestOuterField 结算；印刷 3 张（cards-data quantity 3）。'
}
