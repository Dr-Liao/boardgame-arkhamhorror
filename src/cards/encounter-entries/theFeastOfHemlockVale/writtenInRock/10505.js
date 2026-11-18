// 10505 深入矿井 · 幕（writtenInRock）
// 卡面：目标 - 在轮末，如果每位存活调查员都在控制站，推进。（提示：赶在议程推进前到控制站！）
// 背面：无路可退 - 移除每张[[洞穴]]地点（弃掉其上的敌人/标记/附属）；瑞玟不在任何调查员
// 控制下则移出游戏；每位调查员只保留 2 条线索；如果是议程 1a，直接推进到议程 2a（不结算 1b）；
// 参考卡翻面（碎片转为道岔）；阅读幕间「塌方」。
// 目标与背面都在 behavior.checkAct1Objective / actReveal。
export default {
  code: '10505',
  scope: 'act',
  implemented: true,
  flags: {
    objective: 'allAtControlStation',
    objectiveWhen: 'roundEnd',
    back: 'caveIn',
  },
  note: null,
  abilities: [],
}
