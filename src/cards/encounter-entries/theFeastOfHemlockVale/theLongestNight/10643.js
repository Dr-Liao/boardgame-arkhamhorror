// 10643 类熊混种（饥饿憎恶）
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 生成：西面外围农田（开局在场）
// 卡面：猎手。庞大。反击。猎物 - 调查员队长。+3[per_investigator] 生命值且忽略屏障和诱饵。移动时每个[[田野]]地点视为彼此连接。胜利 2。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10643',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    ignoreDefenses: [
      'barrier',
      'decoy'
    ],
    ignoreHunterBarriers: true,
    discardToScenarioDeck: 'enemyDeck'
  },
  flags: {
    spawnDirection: 'west',
    hunter: true,
    massive: true,
    retaliate: true,
    unique: true,
    healthPerInvestigator: 3,
    victory: 2,
    ignoreDefenses: [
      'barrier',
      'decoy'
    ]
  },
  note: '+3/人生命值由 behavior.enemyStatModifier 的 health 读点提供；[[田野]]互连由 behavior.enemyConnections；胜利 2 取印刷数据。'
}
