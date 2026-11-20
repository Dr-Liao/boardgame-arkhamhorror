// 11516 谈判破裂 · 诡计 ×2（金盆洗手）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：显现 - 将谈判破裂附属到最近的一名[[罪犯]]敌人。每名敌人限附属 1 张。
//       如果不能如此做，谈判破裂获得涌动。
//       强制 - 一位调查员在本地点谈判后：附属敌人攻击该调查员。
//       [action]：检定[willpower](3)。如果你成功，弃掉本卡牌。
// 印刷：特性 [[Blunder]]。
export default {
  code: '11516',
  scope: 'treachery',
  implemented: false,
  note: '未实现：「附属到最近的罪犯敌人」需要敌人附属目标选择与「谈判后」窗口；'
    + '当前只保留卡面数据，不标 implemented。',
  abilities: [],
}
