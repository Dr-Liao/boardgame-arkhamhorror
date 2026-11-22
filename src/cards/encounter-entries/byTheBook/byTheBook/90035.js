// 90035 逮捕同谋（byTheBook · 调查员挑战专属卡）
// 归属：byTheBook/byTheBook。
// 规则实现：behavior.js 的 actions/performAction（翻开同谋、横置异教徒）与 actReveal（→ 结局 1）。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90035',
  name: '逮捕同谋',
  scope: 'act',
  implemented: true,
}
