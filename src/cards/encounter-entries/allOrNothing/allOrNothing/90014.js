// 90014 紧追不放（allOrNothing · 调查员挑战专属卡）
// 归属：allOrNothing/allOrNothing。
// 规则实现：behavior.js 的 actReveal（研究结局 1）、investigatorEliminated（撤退资源上幕）与 act2 状态同步。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90014',
  name: '紧追不放',
  scope: 'act',
  implemented: true,
  actRule: {"enemiesGainHunter":true},
}
