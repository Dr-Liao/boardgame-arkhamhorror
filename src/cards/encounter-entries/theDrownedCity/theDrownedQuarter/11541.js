// 11541 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11541',
  scope: 'location',
  implemented: true,
  flags: {"seaFloor":true},
  note: "data-type（[[海底]]地点 ×3，双面：背面 = 海床）。已接线：X 帷幕（X = 已揭示[[海底]]地点数的一半向下取整）由 behavior.locationShroudModifier（引擎既有读点 actions.js/moves.js/scenario-runtime.js）供给、卡面 shroud 占位改为 0；进入海床提高本地点与一处相邻地点淹没由 behavior.locationRevealed；[reaction]「你在深渊沟壑成功攻击或躲避一名敌人后：降低其淹没等级（每场游戏团队限一次）」由 behavior.enemyAttackedSuccessfully / behavior.enemyEvadedSuccessfully（引擎既有 combat.js 成功攻击/躲避钩子）接线（scenarioFlags 记账）。全部子句已接线。",
  abilities: [],
}
