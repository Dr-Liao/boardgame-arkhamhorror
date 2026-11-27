// 11532b 水下秘库[tdc_rune_z] · 剧情（西墙，11532 背面）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：你按下秘库门上的三个隐藏节点……（叙事）你发现这个符文[tdc_rune_z]：
//       在剧本日志的符文记录中，于 [tdc_rune_z] 下记录“城市”。该符文已被翻译。
//       将本卡牌翻回地点面。其不能再次被翻面。
// 读点：behavior.vaultFlipAction 验证 storyOf，记录 glyph，并应用 cannotFlipAgain。
export default {
  code: '11532b',
  scope: 'storyAsset',
  implemented: true,
  flags: { glyph: { letter: 'Z', meaning: '城市' }, storyOf: '11532', cannotFlipAgain: true },
  note: '数据型条目：叙事文本；符文结算在 behavior.vaultFlipAction（11532 的翻面行动）。',
  abilities: [],
}
