// 11703 克苏鲁 · 凶恶面容 · 克苏鲁敌人（多部位）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 非狂怒面：警戒、反击；X 战斗/躲避；不能受到伤害/被击败/横置；成功攻击/躲避后翻至狂怒面。
// 读点：behavior.setupCthulhuBoard / linkCthulhuParts（多部位原语 linkEnemyParts）；
//       behavior.enemyStatModifier（战斗/躲避/生命 = 狂怒值；flags.cthulhuFacet）；
//       behavior.returnCthulhuFacetsToBoard（胜利区回面板 / 翻至狂怒面）。
// approximation：「不能受到伤害/被击败/横置」以 definition 补丁 cannotBeDefeated + 高生命近似；
//                翻面后的强制效果在 behavior.resolveCthulhuCard 与 flip 后处理中结算。
export default {
  code: '11703',
  scope: 'enemy',
  implemented: true,
  flags: { cthulhuFacet: true, nonEnraged: true },
  note: '数据型条目 + 多部位/狂怒修正读点（见文件头）。',
  abilities: [],
}
