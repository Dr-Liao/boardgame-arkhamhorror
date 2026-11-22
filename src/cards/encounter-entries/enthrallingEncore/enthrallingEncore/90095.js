// 90095 The Haunting of the Ward Theatre / 沃德剧院闹鬼（enthrallingEncore · 挑战 90094 专属卡）
// 归属：enthrallingEncore/enthrallingEncore。
// 规则实现：议程 [fast] 谈判（弃五职介手牌自动躲避独奏者）与背面小节/意志检定由 behavior 的 actions / agendaReveal 实现。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90095',
  name: 'The Haunting of the Ward Theatre',
  scope: 'agenda',
  implemented: true,
}
