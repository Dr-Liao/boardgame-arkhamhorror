// 11531b 海底壁画[tdc_rune_w] · 剧情（西墙，11531 背面）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：壁画下方是一幅三联画……（叙事）你发现这个符文[tdc_rune_w]：
//       在剧本日志的符文记录中，于 [tdc_rune_w] 下记录“寄生虫”。该符文已被翻译。
//       将本卡牌加入胜利区。
// 印刷：胜利 1；双面（正面 11531）。
// 读点：behavior.friezeFlipAction 验证 storyOf，记录 glyph，并将故事面加入胜利区。
export default {
  code: '11531b',
  scope: 'storyAsset',
  implemented: true,
  flags: { glyph: { letter: 'W', meaning: '寄生虫' }, victory: 1, storyOf: '11531' },
  note: '数据型条目：叙事文本；符文与胜利区结算在 behavior.friezeFlipAction（11531 的翻面行动）。',
  abilities: [],
}
