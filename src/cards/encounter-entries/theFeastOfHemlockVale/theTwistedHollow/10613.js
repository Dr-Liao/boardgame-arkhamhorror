// 10613 枯疫空地 · 地点（西部树林）（theFeastOfHemlockVale/theTwistedHollow）
// 印刷：帷幕 2；线索 1[per_investigator]；特性 Forest、Blight、Dark。
// 已揭示面：枯疫空地；未揭示面：西部树林（Western Woods）。
// 卡面：强制 - 你揭示枯疫空地后：选择攻击值最低且处于追击中的敌人，将其生成在本地点。
// 未揭示面入场；被揭示后由章节行为结算其强制效果（behavior.resolveLocationReveal）与议程 1 正面的铺树林。

export default {
  code: '10613',
  scope: 'location',
  implemented: true,
  flags: {
    "westernWoods": true,
    "printedShroud": 2,
    "printedClues": 1,
    "cluesPerInvestigator": true,
    "traits": [
      "Forest",
      "Blight",
      "Dark"
    ],
    "onReveal": "lowestFightPursuitHere"
  },
  note: "近似：追击敌人由 behavior.pursuitWithHighest(state, api, \"fight\") 取最低值后生成；多候选用 api.choose 选择。",
  abilities: [],
}
