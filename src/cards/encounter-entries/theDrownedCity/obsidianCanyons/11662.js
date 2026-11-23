// 11662 · location · obsidianCanyons
//
// 符文星盘仪[rune_d]。[[峰顶]]/[[符文]]，胜利 1。将离场时放一边、位于场外（无线索则改为进胜利区；
// leavesPlayTo:'setAside' 声明 + behavior.removeLocationToSummitTop 按线索分流）。
// 入场费（若不控制黑曜石之爪：花 1 线索或[敏捷](2)，失败取消移动）由 locationRule.entryToll 声明
// （读点 movement.js#relocateInvestigator）。[action] 团队花 1[per_investigator] 线索翻面：
// behavior.glyphOrreryFlip → 引擎 api.flipLocation（flipScenarioLocation）→ behavior.locationStory
// 记录 rune_d「Wave」并翻回地点面（location.cannotFlipAgain 由引擎守卫）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11662',
  scope: 'location',
  implemented: true,
  // 印刷「若将离场，放在一边，位于场外（若其上没有线索则改为放进胜利区）」。
  // 读点：behavior.removeLocationToSummitTop 消费本声明（setAside / victory 分流）。
  leavesPlayTo: 'setAside',
  locationRule: {
    entryToll: { unlessControls: ['11672a', '11672b'], cost: { clues: 1 },
      test: { skill: 'agility', difficulty: 2 }, cancelOnFail: true },
  },
  flags: { summit: true, glyph: 'rune_d', glyphWord: 'Wave' },

  note: "符文星盘仪[rune_d]。[[峰顶]]/[[符文]]，胜利 1；将离场时放一边（无线索则进胜利区；leavesPlayTo:'setAside' + behavior.removeLocationToSummitTop 分流）；入场费由 locationRule.entryToll 接线（movement.js#relocateInvestigator）；[action] 团队花 1[per_investigator] 线索翻面（behavior.glyphOrreryFlip → 引擎 api.flipLocation → behavior.locationStory 记录 rune_d「波浪」、翻回地点面且不能再次翻面）。",
}
