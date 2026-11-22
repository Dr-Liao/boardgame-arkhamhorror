// 90058 Ravenous Spirit / 饥饿之魂（laidToRest · 挑战 90054 专属卡）
// 归属：laidToRest/laidToRest。
// 规则实现：「进入地点翻到幽灵面」由 behavior.locationFlipped 实现；胜利点 1 走默认结算。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90058',
  name: 'Ravenous Spirit',
  scope: 'enemy',
  implemented: true,
}
