// 10611a 希望微薄 · 剧情资产 · 山谷提灯（调查员迷失方向 / 无福祉，点燃面）（theFeastOfHemlockVale/theTwistedHollow）
// 卡名：山谷提灯（Vale Lantern）。副名：希望微薄。特性：Item、Tool、Lit。占手槽（单人局不占）。费用 2。
// 卡面：山谷提灯所在地点失去[[黑暗]]特性。
//     [action] 横置山谷提灯：查看一个连接地点的已揭示面。你可以移动到该地点，忽略其强制效果。
//     强制 - 在山谷提灯将要离场时：改为将其翻面并放置在最近的地点。
// 两张物理剧情资产（10610 = 有福祉版，10611 = 无福祉版），各双面：setup 按战役记录选一版放在调查员控制下，另一版移出游戏。
// 状态记录在 scenarioFlags.twistedHollowLantern（behavior 的唯一提灯读点）。

export default {
  code: '10611a',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    lanternRules: { peekAndMove: true },
    "lantern": true,
    "version": "plain",
    "face": "lit",
    "slot": "hand",
    "cost": 2,
    "traits": [
      "Item",
      "Tool",
      "Lit"
    ],
    "singleInvestigatorNoSlot": true
  },
  abilities: [],
}
