// 90056 Laid to Rest / 安魂镇息（laidToRest · 挑战 90054 专属卡）
// 归属：laidToRest/laidToRest。
// 规则实现：幕的 [free] 行动（移动敌人/翻地点）与目标推进由 behavior.actions / performAction / checkObjectives 实现。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90056',
  name: 'Laid to Rest',
  scope: 'act',
  implemented: true,
}
