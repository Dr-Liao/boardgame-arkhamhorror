// 90021 希波利尔之血（badBlood · 调查员挑战专属卡）
// 归属：badBlood/badBlood。
// 规则实现：behavior.js 的 resolveChaosToken/applyTokenEffect（混乱标记）与 agendaReveal（→ 结局 2）。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90021',
  name: '希波利尔之血',
  scope: 'agenda',
  implemented: true,
}
