// 11551 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11551',
  scope: 'enemy',
  implemented: true,
  note: "印刷：冷漠、巡逻（最近的未淹没或部分淹没地点）；敌军阶段开始时若重整：提高所在地点淹没，不能则放 1 毁灭。行为在 behavior.phaseBegan（按卡号 11551）。巡逻目标的「未淹没或部分淹没」筛选尚未接线（近似）。",
  abilities: [],
}
