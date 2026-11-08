// 08526 失踪队员（The Lost Expedition）· 幕 2 · 幕
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart2（lostInTheNight 组）。
// [free] 同地点共同花费 1[per_investigator] 线索：抽取所在地点底下的一张遭遇卡；[action] 若在营地：撤退。目标：找到尽可能多的失踪队员（加入胜利区），黎明前回到营地；所有未被击败的调查员撤退后推进（behavior.scenarioActions / performScenarioAction / checkObjectives）。
export default {
  code: '08526',
  scope: 'act',
  implemented: true,
  actRule: {
    stage: 2,
    chapterFlow: 'theLostExpedition',
    objective: { type: 'rescuePartners', returnToCamp: true },
    freeAction: { rule: 'drawUnderLocation', clueCostPerInvestigator: 1 },
    action: { rule: 'campResign', atCamp: true },
  },
}
