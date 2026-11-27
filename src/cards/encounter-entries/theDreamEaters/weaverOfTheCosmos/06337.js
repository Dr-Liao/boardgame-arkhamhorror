// 06337 穿过桥梁（幕 1）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：每个地点与其上方和下方的地点连接。
//       目标 - 如果每位调查员都在最下方的地点，则可以共同花费所需数量的线索来推进。
// 接线（章节 behavior，phase 2）：
//   · 初始地点上下连通由章节地点图定义；
//   · objective：章节把团队线索目标绑定到最下方地点，走通用共同支付及幕推进；
//   · advance：actLeftPlay 读 expandWeb，展开 8 段大网、
//     按标签生成四条「阿特拉克·纳克亚之腿」，并放置背面的阿特拉克·纳克亚全局中心实体。
export default {
  code: '06337',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { kind: 'bottommostGroupClues', cluesPerInvestigator: 3 },
    advance: { expandWeb: true },
  },
}
