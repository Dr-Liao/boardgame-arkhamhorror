// 10616 蘑菇园 · 地点（西部树林）（theFeastOfHemlockVale/theTwistedHollow）
// 印刷：帷幕 2；线索 1[per_investigator]；特性 Forest、Dark。
// 已揭示面：蘑菇园；未揭示面：西部树林（Western Woods）。
// 卡面：蘑菇园没有[[黑暗]]特性时得到 +2 隐藏值。
//     强制 - 你揭示蘑菇园后：检定[intellect](X)，其中 X 为当前黑暗等级。如果失败，躲避值最高且处于追击中的敌人攻击你。
// 未揭示面入场；被揭示后由章节行为结算其强制效果（behavior.resolveLocationReveal）与议程 1 正面的铺树林。

export default {
  code: '10616',
  scope: 'location',
  implemented: true,
  flags: {
    "westernWoods": true,
    "printedShroud": 2,
    "printedClues": 1,
    "cluesPerInvestigator": true,
    "traits": [
      "Forest",
      "Dark"
    ],
    "onReveal": "intellectHighestEvadeAttacks"
  },
  note: "近似：+2 帷幕由 behavior.locationShroudModifier 读 isDarkLocation（山谷提灯会移除 Dark）；攻击走 api.attack。",
  abilities: [],
}
