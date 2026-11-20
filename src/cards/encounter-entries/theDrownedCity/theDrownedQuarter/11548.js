// 11548 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11548',
  scope: 'location',
  implemented: true,
  flags: {"seaFloor":true},
  note: "data-type（[[海底]]地点，双面：背面 = 海床；victory 1）。已接线：进入海床提高本地点与一处相邻地点的淹没（behavior.locationRevealed）；[action]「选择并弃掉你手牌中的 2 张卡牌：将放一边的黑曜石遗物放置入场，由你控制」走 behavior.actions/performAction + api.discardChosen/giveAsset + api.takeFromSetAside（每场游戏团队限一次，scenarioFlags 记账）。全部子句已接线（「选择弃掉」由 api.discardChosen 提供选择）。",
  abilities: [],
}
