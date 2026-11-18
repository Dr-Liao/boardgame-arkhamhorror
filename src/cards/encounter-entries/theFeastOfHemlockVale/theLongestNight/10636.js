// 10636 外围农田（血染小径）
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：[action] 把一个敌人移动到连接地点（团队每场游戏一次）。[reaction] 你发现本地点的最后线索后：治愈病俘 2 点伤害（团队每场游戏一次）。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10636',
  scope: 'location',
  implemented: true,
  flags: {
    outerField: true,
    direction: 'west',
    moveEnemyActionGroupLimit: 'game',
    healCaptivesOnLastClue: 2
  },
  note: '「发现最后线索」走引擎 cluesRemoved 钩子（behavior.cluesRemoved 自动触发，反应的可选性被简化）。'
}
