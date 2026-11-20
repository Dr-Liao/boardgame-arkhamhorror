// 11546 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11546',
  scope: 'location',
  implemented: true,
  flags: {"seaFloor":true},
  note: "data-type（[[海底]]地点，双面：背面 = 海床；victory 1）。已接线：进入海床提高本地点与一处相邻地点的淹没（behavior.locationRevealed）；[action][action]「抽取 2 张卡牌并获得 2 个资源，将放一边的水下寄生虫生成在本地点」走 behavior.actions（动作点 2）/performAction + api.drawCards/gainResources/spawnEngaged（每场游戏团队限一次，scenarioFlags 记账）。全部子句已接线。",
  abilities: [],
}
