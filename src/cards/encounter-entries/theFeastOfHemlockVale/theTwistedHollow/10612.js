// 10612 荧光草地 · 地点（西部树林）（theFeastOfHemlockVale/theTwistedHollow）
// 印刷：帷幕 2；线索 0（固定）；特性 Forest、Dark。
// 已揭示面：荧光草地；未揭示面：西部树林（Western Woods）。
// 卡面：[action]：撤退。「伯蒂肯定没事！」
//     [action]：治愈 1 点恐惧。(每轮仅限一次。)
// 未揭示面入场；被揭示后由章节行为结算其强制效果（behavior.resolveLocationReveal）与议程 1 正面的铺树林。

export default {
  code: '10612',
  scope: 'location',
  implemented: true,
  flags: {
    "westernWoods": true,
    "printedShroud": 2,
    "printedClues": 0,
    "cluesPerInvestigator": false,
    "traits": [
      "Forest",
      "Dark"
    ]
  },
  note: "近似：撤退由地点定义 resign 提供；治愈行动是 behavior.actions 的 scenarioAction（twistedHollowGlimmeringHeal，每轮一次）。",
  abilities: [],
}
