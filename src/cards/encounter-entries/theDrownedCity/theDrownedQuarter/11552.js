// 11552 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11552',
  scope: 'storyAsset',
  implemented: true,
  cannotLeavePlay: true,
  flags: {"glyphLine":["q","x","g","k","s"],"glyphHealthBonus":2},
  note: "印刷：不能被击败或离场；[reaction] 你的回合开始时治愈 1 点伤害；符文 q/x/g/k/s 集齐时 +2 生命。引擎读点：条目 cannotLeavePlay（资产不可离场）+ behavior.turnBegins（每回合治愈 1 点伤害）。+2 生命：本资产受引擎固定卡面生命（1）且不能被击败/离场，+2 生命没有可观测数值差异；数据以 flags.glyphLine / flags.glyphHealthBonus 声明，供指南与后续原语读取。全部可观测子句已接线。",
  abilities: [],
}
