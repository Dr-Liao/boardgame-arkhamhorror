// 11543 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11543',
  scope: 'location',
  implemented: true,
  flags: {"seaFloor":true},
  note: "data-type（[[海底]]地点，双面：背面 = 海床）。behavior.locationRevealed 执行「进入海床时提高本地点'\n      + '与一处相邻地点的淹没」；本卡其余印刷能力尚未接线（近似）：淹没卫城·崩塌遗迹（被洗牌后随机决定是否入场；回合结束后必须提高一处相邻地点淹没或受 1 点伤害；[action] 提高自身淹没降低任意地点淹没，每场两次）。",
  abilities: [],
}
