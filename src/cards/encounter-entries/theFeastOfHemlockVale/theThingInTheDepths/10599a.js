// 10599a 廊桥 · 地点（Bog 面，theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[[沼地]]。帷幕 4，每名调查员 1 条线索，胜利 1。
// 强制 - 你调查廊桥时，揭示带有符号的标记后：抽取遭遇牌库顶的卡牌。
//
// 由 behavior.afterTest 读取 { resolvedTokens, test.actionKind === 'investigate' } 结算。
export default {
  code: '10599a',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 4, printedCluesPerInvestigator: 1, printedVictory: 1,
    traits: ['Bog'], side: 'bog', sinkFaceCode: '10599b',
    investigateSymbolDrawEncounter: true,
  },
  note: '数据型地点条目；调查揭示符号标记后的抽牌由 behavior.afterTest 结算。',
  abilities: [],
}
