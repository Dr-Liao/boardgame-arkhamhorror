// 10635 牧场
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：[fast] 你的回合，若牧场有陷阱：移动到连接地点。强制 - 重整且未交战的敌人通过关键词进入牧场后，若牧场没有屏障：再结算该关键词。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10635',
  scope: 'location',
  implemented: true,
  flags: {
    pasture: true,
    fastMoveWithTrap: true,
    keywordRepriseWithoutBarriers: true
  },
  note: '再结算由 behavior.enemyMoved → pastureKeywordReprise（猎手走 api.resolveHunterMove；巡逻记剧本标记等敌人阶段再结算）。'
}
