// 11539 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11539',
  scope: 'act',
  implemented: true,
  flags: {"gridConnections":true,"objective":"allAtBarrierCoreActive","fastAction":true},
  note: "行为在 behavior：actions（[fast] 团队 1/人线索降低所在地点淹没）、checkObjectives（轮末且每位未击败调查员都在已激活的屏障核心时推进）、actReveal（背面按控制屏障节点分流结局 1/2）。「相邻即相连」由 behavior.setupLocations 的 map.place 正交邻接建立。",
  abilities: [],
}
