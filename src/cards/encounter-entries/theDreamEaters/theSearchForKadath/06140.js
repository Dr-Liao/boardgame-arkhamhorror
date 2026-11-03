// 06140 塞拉尼安（theSearchForKadath）· 地点（欧斯-纳尔盖 / 城市 / 港口，掩藏，线索1，帷幕3，胜利1）
// 卡面：掩藏。
// 卡面：作为你进入或离开塞拉尼安的额外费用，你必须选择并弃掉你的一张手牌。
//
// 一卡一文件：规则数据在这里声明；移动合法性读点在已揭示时检查手牌，
// 章节 behavior.beforeMove 在进入或离开时弃掉手牌支付额外费用。
// 港口 → definition 给 `resign: true`。
export default {
  code: '06140', scope: 'location', implemented: true,
  locationRule: {
    extraHandDiscardOnMove: true,
  },
}
