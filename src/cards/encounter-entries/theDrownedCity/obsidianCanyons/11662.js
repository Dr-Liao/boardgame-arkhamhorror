// 11662 · location · obsidianCanyons
//
// 符文星盘仪[rune_d]。[[峰顶]]/[[符文]]，胜利 1；将离场时放一边（无线索则进胜利区；近似：behavior.removeLocationToSummitTop）；[action] 团队花 1[per_investigator] 线索翻面（behavior.glyphOrreryFlip → 记录 rune_d「波浪」）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11662',
  scope: 'location',
  implemented: true,
  flags: { summit: true, glyph: 'rune_d', glyphWord: 'Wave', canFlipToStory: true },
  
  note: "符文星盘仪[rune_d]。[[峰顶]]/[[符文]]，胜利 1；将离场时放一边（无线索则进胜利区；近似：behavior.removeLocationToSummitTop）；[action] 团队花 1[per_investigator] 线索翻面（behavior.glyphOrreryFlip → 记录 rune_d「波浪」）。",
}
