// 11654 · location · obsidianCanyons
//
// 西侧学府[rune_c]。[[峰顶]]地点；发现本地点最后一个线索后记录符文 rune_c「古老者」（behavior.afterInvestigate）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11654',
  scope: 'location',
  implemented: true,
  flags: { summit: true, glyph: 'rune_c', glyphWord: 'Elder Thing', glyphOnLastClue: true },
  
  note: "西侧学府[rune_c]。[[峰顶]]地点；发现本地点最后一个线索后记录符文 rune_c「古老者」（behavior.afterInvestigate）。",
}
