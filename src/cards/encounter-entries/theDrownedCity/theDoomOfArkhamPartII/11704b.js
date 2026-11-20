// 11704b 克苏鲁 · 邪恶利爪（狂怒） · 克苏鲁敌人（多部位）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 狂怒面：反击；生命 = 狂怒值；翻至本面后放置 1 个毁灭；成功躲避后对其造成 1 点伤害。
// 读点：behavior.setupCthulhuBoard / linkCthulhuParts（多部位原语 linkEnemyParts）；
//       behavior.enemyStatModifier（战斗/躲避/生命 = 狂怒值；flags.cthulhuFacet）；
//       behavior.returnCthulhuFacetsToBoard（胜利区回面板 / 翻至狂怒面）。
// approximation：「不能受到伤害/被击败/横置」以 definition 补丁 cannotBeDefeated + 高生命近似；
//                翻面后的强制效果在 behavior.resolveCthulhuCard 与 flip 后处理中结算。
export default {
  code: '11704b',
  scope: 'enemy',
  implemented: true,
  flags: { cthulhuFacet: true, enraged: true },
  note: "狂怒面：生命=狂怒值；翻至本面后放置 1 个毁灭标记（enemyFaceFlipped）；成功躲避后对其造成 1 点伤害（enemyEvadedSuccessfully）。",
  abilities: [],
}
