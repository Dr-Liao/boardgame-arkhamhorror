// 90006 快速阅读（readOrDie · 调查员挑战专属卡）
// 归属：readOrDie/readOrDie。
// 规则实现：behavior.js 的 actions/performAction（取回书卷）与 actReveal（放逐死书之灵 → 结局 1）。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90006',
  name: '快速阅读',
  scope: 'act',
  implemented: true,
}
