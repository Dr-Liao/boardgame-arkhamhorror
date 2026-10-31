// 06337 穿过桥梁（幕 1）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：每个地点与其上方和下方的地点连接。
//       目标 - 如果每位调查员都在最下方的地点，则可以共同花费所需数量的线索来推进。
// 接线（章节 behavior，phase 2）：
//   · verticalChain：setup/展开大网时用 api.verticalChain.link 建立纵向链；
//   · objective：checkObjectives 读 bottommostGroupClues（每人 3 线索的团队支付）→ api.advanceAct；
//   · advance：actLeftPlay 读 expandWeb/spawnLegs/placeAtlachCenter，展开 8 段大网、
//     按标签生成四条「阿特拉克·纳克亚之腿」、阿特拉克·纳克亚中心牌面交接（见 simplified）。
export default {
  code: '06337',
  scope: 'act',
  implemented: true,
  actRule: {
    verticalChain: true,
    objective: { kind: 'bottommostGroupClues', cluesPerInvestigator: 3 },
    advance: { expandWeb: true, spawnLegs: true, placeAtlachCenter: true },
  },
  simplified: true,
  note: '引擎没有「中心牌面/Global 敌人」实体：阿特拉克·纳克亚在幕 2 推进前不生成实体（其翻面生成在 06338 的 advance.flipAtlachNacha 里）；参考实现的「旋转中心牌」近似为旋转四条腿（幕 2）与敌人本身（幕 3）。',
}
