// 10617 月光空地 · 地点（西部树林）（theFeastOfHemlockVale/theTwistedHollow）
// 印刷：帷幕 1；线索 1[per_investigator]；特性 Forest、Lair、Dark。
// 已揭示面：月光空地；未揭示面：西部树林（Western Woods）。
// 卡面：敌人移动时，其所在地点视为与月光空地连接。
//     强制 - 你揭示月光空地后：检定[willpower](X)，其中 X 为当前黑暗等级。如果失败，找出攻击值最高且处于追击中的敌人，将其生成在本地点。
// 未揭示面入场；被揭示后由章节行为结算其强制效果（behavior.resolveLocationReveal）与议程 1 正面的铺树林。

export default {
  code: '10617',
  scope: 'location',
  implemented: true,
  flags: {
    "westernWoods": true,
    "enemyConnectedFromOtherLocations": true,
    "printedShroud": 1,
    "printedClues": 1,
    "cluesPerInvestigator": true,
    "traits": [
      "Forest",
      "Lair",
      "Dark"
    ],
    "onReveal": "willpowerHighestFightPursuit"
  },
  note: "月光空地揭示后，章节在敌人移动时提供额外连接。",
  abilities: [],
}
