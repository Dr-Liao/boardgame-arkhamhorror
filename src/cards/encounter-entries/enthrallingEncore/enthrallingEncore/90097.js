// 90097 Sinister Soloist / 邪恶独奏者（enthrallingEncore · 挑战 90094 专属卡）
// 归属：enthrallingEncore/enthrallingEncore。
// 规则实现：关键词（警戒/冷漠/逃逸/猎手）与「非中立卡额外费用/直接恐惧」由 definition 数据与 behavior 承载；胜利点 2 走默认结算。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90097',
  name: 'Sinister Soloist',
  scope: 'enemy',
  implemented: true,
}
