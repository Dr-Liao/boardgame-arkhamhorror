// 10593a 泥淖沼泽 · 地点（Bog 面，theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[[沼地]]。帷幕 4，每名调查员 2 条线索，胜利 1。（背面 Open Water 10593b 帷幕 5、胜利 1。）
//
// 一张卡一个文件：印刷数据由章节 definition.js 的 location() 从卡表读取；地点规则（3 个渗坑翻面、
// 翻回 Bog 面等）在章节 behavior.js 与 definition.js#OPEN_WATER_FACES。
// 本条目只声明卡面身份与数值标记（数据型条目：abilities 为空）。
export default {
  code: '10593a',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 4, printedCluesPerInvestigator: 2, printedVictory: 1,
    traits: ['Bog'], side: 'bog', sinkFaceCode: '10593b',
  },
  note: '数据型地点条目：印刷数值 + 沉没面身份；渗坑（伤害标记）达到 3 个时由 behavior 调用引擎原语 api.sinkLocation 翻面。',
  abilities: [],
}
