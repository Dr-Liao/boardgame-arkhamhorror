// 90013 来玩牌吧（allOrNothing · 调查员挑战专属卡）
// 归属：allOrNothing/allOrNothing。
// 规则实现：behavior.js 的 roundEnded（≥15 资源推进）、enemyDefeated（罪犯被击败 +1 毁灭）与 actReveal。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90013',
  name: '来玩牌吧',
  scope: 'act',
  implemented: true,
}
