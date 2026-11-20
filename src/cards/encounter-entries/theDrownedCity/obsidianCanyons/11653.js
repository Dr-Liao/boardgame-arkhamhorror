// 11653 · location · obsidianCanyons
//
// 东侧学府[rune_b]。[[峰顶]]地点；[action] 调查员共同花 1[per_investigator] 线索 → 记录符文 rune_b「植物」（behavior.actions obsidianGlyphTranslate / translateGlyph 写 discoveredGlyphs）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11653',
  scope: 'location',
  implemented: true,
  flags: { summit: true, glyph: 'rune_b', glyphWord: 'Plant', glyphAction: 'groupClues' },
  
  note: "东侧学府[rune_b]。[[峰顶]]地点；[action] 调查员共同花 1[per_investigator] 线索 → 记录符文 rune_b「植物」（behavior.actions obsidianGlyphTranslate / translateGlyph 写 discoveredGlyphs）。",
}
