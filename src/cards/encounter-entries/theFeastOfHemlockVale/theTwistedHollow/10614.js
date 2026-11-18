// 10614 毒沼 · 地点（西部树林）（theFeastOfHemlockVale/theTwistedHollow）
// 印刷：帷幕 3；线索 1[per_investigator]；特性 Forest、Blight、Dark。
// 已揭示面：毒沼；未揭示面：西部树林（Western Woods）。
// 卡面：强制 - 你揭示毒沼后：你必须受到 1 点直接伤害，或对你控制的每个[[盟友]]支援造成 1 点伤害。
// 未揭示面入场；被揭示后由章节行为结算其强制效果（behavior.resolveLocationReveal）与议程 1 正面的铺树林。

export default {
  code: '10614',
  scope: 'location',
  implemented: true,
  flags: {
    "westernWoods": true,
    "printedShroud": 3,
    "printedClues": 1,
    "cluesPerInvestigator": true,
    "traits": [
      "Forest",
      "Blight",
      "Dark"
    ],
    "onReveal": "poisonedMarsh"
  },
  note: "近似：「[[盟友]]支援」按 asset.traits 含 Ally 或卡表特性含 Ally 判定；无 api.damageAsset 时直接累加 asset.damage。",
  abilities: [],
}
