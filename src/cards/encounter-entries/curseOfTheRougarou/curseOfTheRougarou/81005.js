// 81005 · 狼人诅咒（curseOfTheRougarou）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
export default {
  code: '81005',
  scope: 'act',
  implemented: true,
  flags: {"actIndex":1,"groupClueCostPerInvestigator":1,"bayouOnly":true},
  note: "目标 data：objective.type=clues / perInvestigator=1 / atLocation=入场堆 Bayou 地点（behavior.prepareScenario 填写）；背面由 behavior.actReveal（ACT1_CODE）：Lady Esprit 入场、放一边地点全部入场、生成狼人、洗入狼人组、队长威胁区放诅咒弱点。",
  abilities: [],
}
