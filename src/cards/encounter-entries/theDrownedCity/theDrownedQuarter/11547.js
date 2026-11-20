// 11547 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11547',
  scope: 'location',
  implemented: true,
  flags: {"seaFloor":true},
  note: "data-type（[[海底]]地点，双面：背面 = 海床）。behavior.locationRevealed 执行「进入海床时提高本地点'\n      + '与一处相邻地点的淹没」；本卡其余印刷能力尚未接线（近似）：珊瑚礁·觅食地（victory 1；揭示后从遭遇牌库顶弃到敌人并生成；[reaction] 发现线索后生成放一边的水下寄生虫）。",
  abilities: [],
}
