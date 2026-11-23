// 11702b 克苏鲁 · 灰白双翼（狂怒） · 克苏鲁敌人（多部位）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 狂怒面：警戒；生命 = 狂怒值；不能被横置；翻至本面后抽克苏鲁牌；成功躲避后对其造成 1 点伤害。
// 读点：behavior.setupCthulhuBoard / linkCthulhuParts（多部位原语 linkEnemyParts）；
//       behavior.enemyStatModifier（战斗/躲避/生命 = 狂怒值；flags.cthulhuFacet）；
//       behavior.returnCthulhuFacetsToBoard（胜利区回面板 / 翻至狂怒面）。
// 非狂怒面的「不能受到伤害/被击败/横置」由 11702/11703/11704 条目的 enemyRule.cannotBeDamaged/cannotBeExhausted 与 definition cannotBeDefeated 实现。
//                翻面后的强制效果在 behavior.resolveCthulhuCard 与 flip 后处理中结算。
export default {
  code: '11702b',
  scope: 'enemy',
  implemented: true,
  flags: { cthulhuFacet: true, enraged: true },
  note: "狂怒面：生命=狂怒值；翻至本面后抽克苏鲁牌（enemyFaceFlipped）；成功躲避后对其造成 1 点伤害（enemyEvadedSuccessfully）。",
  abilities: [],
}
