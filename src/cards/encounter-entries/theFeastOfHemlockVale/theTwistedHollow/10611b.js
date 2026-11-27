// 10611b 光明静熄 · 剧情资产 · 山谷提灯（调查员迷失方向 / 无福祉，熄灭面）（theFeastOfHemlockVale/theTwistedHollow）
// 卡名：山谷提灯（Vale Lantern）。副名：光明静熄。特性：Item、Tool、Unlit。占手槽（单人局不占）。费用 2。
// 卡面：[fast]：控制山谷提灯，然后将其翻面。山谷提灯所在地点的任意调查员均可以触发此能力。
//     强制 - 在山谷提灯将要离场时：改为将其放置在最近的地点。
// 两张物理剧情资产（10610 = 有福祉版，10611 = 无福祉版），各双面：setup 按战役记录选一版放在调查员控制下，另一版移出游戏。
// 状态记录在 scenarioFlags.twistedHollowLantern（behavior 的唯一提灯读点）。

export default {
  code: '10611b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    lanternRules: { recover: 'fast' },
    "lantern": true,
    "version": "plain",
    "face": "unlit",
    "slot": "hand",
    "cost": 2,
    "traits": [
      "Item",
      "Tool",
      "Unlit"
    ],
    "singleInvestigatorNoSlot": true
  },
  abilities: [],
}
