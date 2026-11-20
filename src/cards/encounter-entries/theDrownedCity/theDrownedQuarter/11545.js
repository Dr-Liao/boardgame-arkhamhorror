// 11545 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11545',
  scope: 'location',
  implemented: true,
  flags: {"seaFloor":true},
  note: "data-type（[[海底]]地点，双面：背面 = 海床）。已接线：进入海床提高本地点与一处相邻地点的淹没（behavior.locationRevealed）；强制「你在残破遗迹（崩毁建筑）结束回合后：提高其淹没等级」走 behavior.turnEnded；[action]「位于本地的调查员共同弃掉手牌中合计 1[per_investigator] 张卡牌：降低本地点或一处相邻地点的淹没等级」走 behavior.actions/performAction（每轮团队限一次，scenarioFlags 记账）。全部子句已接线。",
  abilities: [],
}
