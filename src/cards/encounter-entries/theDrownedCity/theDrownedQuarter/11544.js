// 11544 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11544',
  scope: 'location',
  implemented: true,
  flags: {"seaFloor":true},
  note: "data-type（[[海底]]地点，双面：背面 = 海床）。behavior.locationRevealed 执行「进入海床时提高本地点'\n      + '与一处相邻地点的淹没」；本卡其余印刷能力尚未接线（近似）：残破遗迹·沉没圆环（回合结束后提高自身淹没；[action] 本地点调查员共付 5 资源降低本地点/相邻地点淹没，每轮一次）。",
  abilities: [],
}
