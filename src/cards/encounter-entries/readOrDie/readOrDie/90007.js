// 90007 死书之灵（readOrDie · 调查员挑战专属卡）
// 归属：readOrDie/readOrDie。
// 规则实现：behavior.js 的 enemyDefeated（改为治愈/横置/移回奥恩图书馆）与 performAction（Parley 推进幕）。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90007',
  name: '死书之灵',
  scope: 'enemy',
  implemented: true,
}
