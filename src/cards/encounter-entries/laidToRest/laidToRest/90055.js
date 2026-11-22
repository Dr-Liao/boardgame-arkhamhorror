// 90055 Gathering Mists / 迷雾聚集（laidToRest · 挑战 90054 专属卡）
// 归属：laidToRest/laidToRest。
// 规则实现：议程背面（放置恐惧/补充线索/翻回地点）由 behavior.agendaReveal 实现。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90055',
  name: 'Gathering Mists',
  scope: 'agenda',
  implemented: true,
}
