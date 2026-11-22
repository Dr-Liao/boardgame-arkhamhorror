// 90022 搜集回忆之路（badBlood · 调查员挑战专属卡）
// 归属：badBlood/badBlood。
// 规则实现：behavior.js 的 actions/performAction（[fast] 收集记忆）、checkMemories 与 actReveal（→ 结局 1）。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90022',
  name: '搜集回忆之路',
  scope: 'act',
  implemented: true,
}
