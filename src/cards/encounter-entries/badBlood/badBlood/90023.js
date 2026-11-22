// 90023 艾尔佩斯·博丹（badBlood · 调查员挑战专属卡）
// 归属：badBlood/badBlood。
// 规则实现：behavior.js 的 enemyDefeated（翻面结算 90023b）、enemyStatModifier（记忆降低战斗/闪避）、enemyPhaseEnd（收集/巡逻）。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90023',
  name: '艾尔佩斯·博丹',
  scope: 'enemy',
  implemented: true,
}
