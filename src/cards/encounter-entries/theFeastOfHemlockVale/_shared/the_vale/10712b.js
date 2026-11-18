// 10712b 集会厅 · 地点（The Vale · 黑夜面 [night]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10712b）：[[毒堇谷]]。黑夜面。帷幕 2，线索 1，连接符号 ★ → ◆ / ■ / ♠。
//   敌人移动时，其所在地点视为与集会厅连接。
//   [action]：检定[智力](3)，然后[战斗](2)，然后[敏捷](1)。如果你这些检定都成功，获得 5 资源。
//     然后，如果当前幕为「山谷的命运（版本四）」，记住「调查员找到了希奥的卡车」。
//
// 读点（数据型条目，规则在章节层）：「视为与集会厅连接」是敌人移动图的修正，读点在章节 behavior 的
//   移动/敌人连接读点（引擎没有按地点声明「动态相邻」的字段）；三项检定行动的数值在 flags。
export default {
  code: '10712b',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'night', period: 'night', oppositeCode: '10712a',
    printedShroud: 2, printedClues: 1, printedVictory: 0, cluesFixed: false,
    symbol: 'star', connectsTo: ['diamond', 'square', 'spade'],
    enemyMovesTreatAsConnectedToCommons: true,
    actionTests: { sequence: [['intellect', 3], ['combat', 2], ['agility', 1]] },
    onAllTestsSucceed: { gainResources: 5 },
    rememberIfActFateOfTheValeIV: ['investigatorsFoundTheoTruck'],
  },
  note: '数据型地点条目：动态相邻在章节 behavior 的敌人移动读点（无声明式字段）；三项检定数值在 flags。',
  abilities: [],
}
