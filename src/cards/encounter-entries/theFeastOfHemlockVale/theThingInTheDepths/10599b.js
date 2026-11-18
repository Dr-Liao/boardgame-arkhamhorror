// 10599b 开阔水域 · 地点（[[沉没]]面，theThingInTheDepths）
// 卡面：[[沉没]]。帷幕 5、线索 0、胜利 1。强制 - 你移动进入本地点后：抽取遭遇牌库顶的卡牌。
export default {
  code: '10599b',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 5, printedClues: 0, printedVictory: 1,
    traits: ['Sunken'], side: 'sunken', moveInDrawEncounter: true, bogFaceCode: '10599a',
  },
  note: '数据型地点条目：沉没面印刷数值；进入抽牌由 behavior.locationEntered 统一结算。',
  abilities: [],
}
