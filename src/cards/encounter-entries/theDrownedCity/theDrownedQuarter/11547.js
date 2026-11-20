// 11547 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11547',
  scope: 'location',
  implemented: true,
  flags: {"seaFloor":true},
  note: "data-type（[[海底]]地点，双面：背面 = 海床；victory 1）。已接线：进入海床提高本地点与一处相邻地点的淹没（behavior.locationRevealed）；强制「被揭示后从遭遇牌库顶弃到一名敌人，将其生成在本地点」在 behavior.locationRevealed（api.discardEncounterTop + api.takeEncounterCard + api.spawnEngaged）；[reaction]「你在此地发现 1 个或更多线索后：放一边的水下寄生虫生成在本地点」在 behavior.cluesGained（引擎既有 cluesGained 读点）。全部子句已接线（反应按强制自动结算，无询问）。",
  abilities: [],
}
