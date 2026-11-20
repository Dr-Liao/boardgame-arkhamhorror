// 11515 卷入交火 · 诡计 ×2（金盆洗手）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：显现 - 将卷入交火放置入场，位于你的威胁区。
//       强制 - 你所在地点一名[[罪犯]]敌人被造成伤害时：检定[intellect]或[agility](3)。
//       如果你失败，将对该敌人造成的伤害减 1，并受到 1 点直接伤害。弃掉卷入交火。
// 印刷：特性 [[Hazard]]；无涌动/险境。
export default {
  code: '11515',
  scope: 'treachery',
  implemented: false,
  note: '未实现：需要在「敌人受到伤害」窗口里插入检定并回写伤害修正（-1 伤害 + 1 直接伤害），'
    + '当前引擎没有可复用的威胁区伤害拦截声明；只保留卡面数据，不标 implemented。',
  abilities: [],
}
