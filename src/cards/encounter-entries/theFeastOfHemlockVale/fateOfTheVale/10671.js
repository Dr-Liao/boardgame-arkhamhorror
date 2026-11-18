// 10671 水晶仿体 Crystal Mimic · 敌人（×2）（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：飘忽。猎手。与你战斗或躲避它时，X 为你手牌数；否则 X 为 6。强制 - 在水晶仿体攻击你之后：随机弃掉 1 张手牌。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.crystalMimic / fightX / evadeX / handSizeMax / defaultX → behavior.enemyStatModifier
//   · flags.attackDiscard → behavior.enemyAttackResolved
//   · 布置时两张都放一边（setup.setAside）
export default {
  code: '10671',
  scope: 'enemy',
  implemented: true,
  flags: {
    crystalMimic: true,
    fightX: 'handSize',
    evadeX: 'handSize',
    defaultX: 6,
    handSizeMax: 5,
    attackDiscard: 1,
  },
  note: 'approximation: X 用 behavior.enemyStatModifier 的差值口径（X - 卡表印刷值）实现；卡表把 X 记为 -2，因此战斗/躲避的显示值由该差分补齐。',
}
