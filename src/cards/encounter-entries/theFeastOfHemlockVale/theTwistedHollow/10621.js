// 10621 扭曲空洞 · 地点（西部树林）（theFeastOfHemlockVale/theTwistedHollow）
// 印刷：帷幕 4；线索 1[per_investigator]；特性 Forest、Dark。
// 已揭示面：扭曲空洞；未揭示面：西部树林（Western Woods）。
// 卡面：目标 - 当一轮结束时，如果所有幸存的调查员都在扭曲空洞，则可以共同花费 2[per_investigator] 个线索推进至幕 2b。
// 胜利 1。
// 未揭示面入场；被揭示后由章节行为结算其强制效果（behavior.resolveLocationReveal）与议程 1 正面的铺树林。

export default {
  code: '10621',
  scope: 'location',
  implemented: true,
  flags: {
    "westernWoods": true,
    "printedShroud": 4,
    "printedClues": 1,
    "cluesPerInvestigator": true,
    "traits": [
      "Forest",
      "Dark"
    ]
  },
  note: "近似：地点目标由 behavior.checkActTwoObjective 在轮末结算（幕 2 → 幕 2b）；胜利点由 definition 的 hasVictory/victory 提供。",
  abilities: [],
}
