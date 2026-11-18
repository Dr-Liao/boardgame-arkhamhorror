// 10610a 希望信标 · 剧情资产 · 山谷提灯（母亲瑞秋指路 / 有福祉，点燃面）（theFeastOfHemlockVale/theTwistedHollow）
// 卡名：山谷提灯（Vale Lantern）。副名：希望信标。特性：Item、Tool、Lit、Boon。占手槽（单人局不占）。费用 2。
// 卡面：山谷提灯所在地点和每个连接地点失去[[黑暗]]特性。
//     [reaction] 当你的地点的调查员移动进入并揭示[[森林]]地点时，横置山谷提灯：该调查员忽略该地点的强制效果。
//     强制 - 在山谷提灯将要离场时：改为将其翻面并放置在最近的地点。
// 两张物理剧情资产（10610 = 有福祉版，10611 = 无福祉版），各双面：setup 按战役记录选一版放在调查员控制下，另一版移出游戏。
// 状态记录在 scenarioFlags.twistedHollowLantern（behavior 的唯一提灯读点）。

export default {
  code: '10610a',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    "lantern": true,
    "version": "boon",
    "face": "lit",
    "slot": "hand",
    "cost": 2,
    "traits": [
      "Item",
      "Tool",
      "Lit",
      "Boon"
    ],
    "singleInvestigatorNoSlot": true
  },
  note: "近似：提灯用剧情资产 + lantern 记录表达（「控制者/所在地点/点燃」三件事）；引擎没有双面剧情资产实例的通用翻面读点，翻面由 behavior.flipLantern 同步 code/lit/location。",
  abilities: [],
}
