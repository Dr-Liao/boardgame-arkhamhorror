// 90012 众目睽睽（allOrNothing · 调查员挑战专属卡）
// 归属：allOrNothing/allOrNothing。
// 规则实现：behavior.js 的 actions/performAction（卡牌室兑现筹码）与 agendaReveal（→ 结局 2）。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90012',
  name: '众目睽睽',
  scope: 'agenda',
  implemented: true,
}
