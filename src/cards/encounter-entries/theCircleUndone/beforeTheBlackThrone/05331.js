// 05331 必竟之事
// 卡面 [action] 同前；目标由章节 checkObjectives 判定（队长在黑色王座且该地点无线索）。
// 背面：按 Memento/记录从 R2/R3/R4 中选，R4 再选 R5/R1（behavior 的 resolutionChoice 流程）。
export default {
  code: '05331',
  scope: 'act',
  implemented: true,
  actRule: {
    advance: { resolutionChoice: true },
  },
}