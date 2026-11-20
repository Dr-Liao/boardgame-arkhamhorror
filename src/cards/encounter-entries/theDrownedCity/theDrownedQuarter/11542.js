// 11542 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11542',
  scope: 'location',
  implemented: true,
  flags: {"seaFloor":true},
  note: "data-type（[[海底]]地点，双面：背面 = 海床）。已接线：进入海床提高本地点与一处相邻地点的淹没（behavior.locationRevealed）；强制「你在淹没卫城结束回合后：提高其淹没等级，或受到 1 点恐惧」走 behavior.turnEnded（引擎既有 turnEnded 读点）；[action]「提高自身淹没等级：选择任意地点并降低其淹没等级」走 behavior.actions/performAction（每场游戏团队限两次，scenarioFlags 记账）。全部子句已接线。",
  abilities: [],
}
