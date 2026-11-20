// 11534 “小心！” · 诡计 ×3（西墙）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：显现 - 检定[intellect](3)。如果你失败，将“小心！”放置入场，位于你的威胁区。
//       强制 - 每轮中，你首次进入一处淹没地点后：受到 1 点恐惧。
//       强制 - 你的回合结束时：检定[agility](3)。如果你成功，弃掉“小心！”。
// 印刷：特性 [[Terror]]。
export default {
  code: '11534',
  scope: 'treachery',
  implemented: false,
  note: '未实现：需要「进入淹没地点」与「回合结束」两个威胁区窗口 + 检定；'
    + '当前只保留卡面数据，不标 implemented。',
  abilities: [],
}
