// 10648 蠕滑混种
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 生成：敌人最多的外围农田
// 卡面：生成 - 敌人最多的外围农田。冷漠。巡逻（农庄）。忽略屏障、诱饵、陷阱，以及 Fire! 诡计的伤害。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10648',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    patrolTarget: {
      kind: 'named',
      locationId: 'theFarmhouse'
    },
    ignoreDefenses: [
      'barrier',
      'decoy',
      'trap'
    ],
    discardToScenarioDeck: 'enemyDeck'
  },
  flags: {
    spawnFarthestEnemies: 'mostOuterField',
    aloof: true,
    patrol: 'theFarmhouse',
    ignoreDefenses: [
      'barrier',
      'decoy',
      'trap'
    ],
    ignoreFireDamage: true,
    quantity: 2
  },
  note: 'Fire! 伤害免疫走 behavior.enemyDamageAmount（source 为 10743 时返回 0）；印刷 2 张。'
}
