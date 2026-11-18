// 10615 茂盛灌丛 · 地点（西部树林）（theFeastOfHemlockVale/theTwistedHollow）
// 印刷：帷幕 6；线索 1[per_investigator]；特性 Forest、Dark。
// 已揭示面：茂盛灌丛；未揭示面：西部树林（Western Woods）。
// 卡面：茂盛灌丛得到 -X 隐藏值，其中 X 为当前黑暗等级。
//     强制 - 你揭示茂盛灌丛后：检定[agility](X)，其中 X 为当前黑暗等级。如果失败，找出印刷生命值最高且处于追击中的敌人，将其生成在本地点。
// 未揭示面入场；被揭示后由章节行为结算其强制效果（behavior.resolveLocationReveal）与议程 1 正面的铺树林。

export default {
  code: '10615',
  scope: 'location',
  implemented: true,
  flags: {
    "westernWoods": true,
    "printedShroud": 6,
    "printedClues": 1,
    "cluesPerInvestigator": true,
    "traits": [
      "Forest",
      "Dark"
    ],
    "onReveal": "agilityHighestHealthPursuit"
  },
  note: "近似：-X 帷幕由 behavior.locationShroudModifier 提供；检定失败分支在 behavior.resolveLocationReveal。",
  abilities: [],
}
