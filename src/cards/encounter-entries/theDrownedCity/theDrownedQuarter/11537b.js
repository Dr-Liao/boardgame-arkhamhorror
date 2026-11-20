// 11537b · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11537b',
  scope: 'enemy',
  implemented: true,
  note: "印刷：巨大、巡逻（未淹没或部分淹没地点）、生成于屏障核心、+3/人生命；敌军阶段开始若重整提高所在地点淹没。行为在 behavior.agendaReveal（议程 1 背面在屏障核心生成）与 behavior.seafloorLeviathanHealth / phaseBegan。",
  abilities: [],
}
