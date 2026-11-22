// 90034 最后期限（byTheBook · 调查员挑战专属卡）
// 归属：byTheBook/byTheBook。
// 规则实现：behavior.js 的 enemyCanBeDefeated（异教徒治疗至 1 生命）与 agendaReveal（→ 结局 2）。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90034',
  name: '最后期限',
  scope: 'agenda',
  implemented: true,
}
