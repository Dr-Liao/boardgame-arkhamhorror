// 11701 克苏鲁 · 古老邪恶 · 克苏鲁敌人（多部位）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 克苏鲁本体：庞大数据面板，共享特性/文本框/地点；本身不作为攻击/躲避目标（由 3 张部位承担）。
// 读点：behavior.setupCthulhuBoard / linkCthulhuParts（多部位原语 linkEnemyParts）；
//       behavior.enemyStatModifier（战斗/躲避/生命 = 狂怒值；flags.cthulhuFacet）；
//       behavior.returnCthulhuFacetsToBoard（胜利区回面板 / 翻至狂怒面）。
// approximation：本体不可作为攻击/躲避目标由多部位原语保证；不可被击败/移动由定义补丁近似。
export default {
  code: '11701',
  scope: 'enemy',
  implemented: true,
  note: '数据型条目 + 多部位/狂怒修正读点（见文件头）。',
  abilities: [],
}
