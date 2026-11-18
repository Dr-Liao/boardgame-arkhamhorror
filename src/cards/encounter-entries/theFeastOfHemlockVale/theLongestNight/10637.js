// 10637 外围农田（绝望丘陵）
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：[fast] 你的回合：查看敌人牌库顶 1[per_investigator] 张，弃掉任意数量，其余按任意顺序放回（团队每场游戏一次）。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10637',
  scope: 'location',
  implemented: true,
  flags: {
    outerField: true,
    direction: 'east',
    peekEnemyDeckPerInvestigator: 1,
    peekEnemyDeckGroupLimit: 'game'
  },
  note: '读取/放回走 behavior.peekEnemyDeck（api.mechanics.scenarioDecks.take/put，或同一份状态的兜底实现）。'
}
