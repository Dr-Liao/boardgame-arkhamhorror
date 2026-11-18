// 10618 扭曲小路 · 地点（西部树林）（theFeastOfHemlockVale/theTwistedHollow）
// 印刷：帷幕 X；线索 1（固定）；特性 Forest、Dark。
// 已揭示面：扭曲小路；未揭示面：西部树林（Western Woods）。
// 卡面：X 为当前黑暗等级。
//     [reaction] 你发现本地点的线索后：查看一个连接地点的已揭示面。你可以移动到该地点。
// 未揭示面入场；被揭示后由章节行为结算其强制效果（behavior.resolveLocationReveal）与议程 1 正面的铺树林。

export default {
  code: '10618',
  scope: 'location',
  implemented: true,
  flags: {
    "westernWoods": true,
    "printedShroud": "X",
    "printedClues": 1,
    "cluesPerInvestigator": false,
    "traits": [
      "Forest",
      "Dark"
    ]
  },
  note: "近似：帷幕 = 黑暗等级（定义基数 0 + behavior.locationShroudModifier）；发现线索的反应做成每回合一次的免费行动（twistedHollowCrookedPathLook），因为引擎没有「发现线索后」的地点反应窗口。",
  abilities: [],
}
