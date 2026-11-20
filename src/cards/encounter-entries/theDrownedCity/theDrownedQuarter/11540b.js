// 11540b · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11540b',
  scope: 'location',
  implemented: true,
  note: "data-type：已激活面（shroud 4 / 0 线索）。规则同 11540；已激活时 actions「dqTakeBarrierNode」团队支付 2/人线索把放一边的屏障节点（11552）放入场由玩家控制。",
  abilities: [],
}
