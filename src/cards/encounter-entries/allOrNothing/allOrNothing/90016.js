// 90016 俱乐部保安（allOrNothing · 调查员挑战专属卡）
// 归属：allOrNothing/allOrNothing。
// 规则实现：behavior.js 的 actReveal（幕 1 背面生成 4 名）与罪犯关键字同步。
// 条目只声明引擎可直接读取的字段；章节流程一律走 behavior.js 的既有钩子。
export default {
  code: '90016',
  name: '俱乐部保安',
  scope: 'enemy',
  implemented: true,
}
