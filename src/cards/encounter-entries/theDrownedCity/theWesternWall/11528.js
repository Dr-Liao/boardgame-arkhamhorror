// 11528 破碎遗迹[tdc_rune_v] · 地点（西墙）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：X 为本地点的层级。
//       [action] 如果本地点未淹没，你发现这个符文[tdc_rune_v]：在剧本日志的符文记录中，
//       于 [tdc_rune_v] 下记录“陌生人”。该符文已被翻译。
// 印刷：shroud = 层级（X）、每调查员 2 条线索、特性 [[R'lyeh]][[Walkway]][[Glyph]]、胜利 1。
// 读点：behavior.actions/performAction 的 twwLocationGlyph 读 flags.glyphAction；
//       behavior.addGlyph 写 discoveredGlyphs 与符文翻译。
export default {
  code: '11528',
  scope: 'location',
  implemented: true,
  flags: {
    treacherousPath: true,
    cannotEnterFromClues: true,
    glyphAction: { letter: 'V', meaning: '陌生人', requiresNotFlooded: true },
  },
  note: '数据型条目：未淹没时的符文行动由 behavior 实现。',
  abilities: [],
}
