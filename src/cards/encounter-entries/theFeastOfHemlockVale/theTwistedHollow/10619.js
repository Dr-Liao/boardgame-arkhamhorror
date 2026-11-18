// 10619 尸林 · 地点（西部树林）（theFeastOfHemlockVale/theTwistedHollow）
// 印刷：帷幕 3；线索 1[per_investigator]；特性 Forest、Lair、Dark。
// 已揭示面：尸林；未揭示面：西部树林（Western Woods）。
// 卡面：强制 - 你揭示尸林后：受到 1 点恐惧。
//     强制 - 你成功调查尸林后：受到 1 点恐惧。
// 未揭示面入场；被揭示后由章节行为结算其强制效果（behavior.resolveLocationReveal）与议程 1 正面的铺树林。

export default {
  code: '10619',
  scope: 'location',
  implemented: true,
  flags: {
    "westernWoods": true,
    "printedShroud": 3,
    "printedClues": 1,
    "cluesPerInvestigator": true,
    "traits": [
      "Forest",
      "Lair",
      "Dark"
    ],
    "onReveal": "corpseGroveHorror"
  },
  note: "近似：成功调查后的恐惧走 behavior.investigateResult（引擎的调查结果窗口，返回 undefined 不替换调查结算）。",
  abilities: [],
}
