// 90033a 隐秘阴谋（byTheBook · 调查员挑战专属卡）
// 归属：byTheBook/byTheBook。
// 规则实现：behavior.js 的 enemyCanBeDefeated（异教徒治疗至 1 生命）、agendaReveal（→ 90033b Mr. Grey 入场）。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90033a',
  name: '隐秘阴谋',
  scope: 'agenda',
  implemented: true,
}
