// 11532 水下秘库[tdc_rune_z] · 地点（西墙，放一边；沉没阶梯揭示后入场）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：[action]：检定[intellect](X)，其中 X 为本地点的层级。如果你成功，将本卡牌翻面并结算其文本。
// 印刷：shroud 5、每调查员 1 条线索、特性 [[Vault]][[Glyph]]、胜利 1；单面（背面 11532b 为剧情面）。
// 读点：behavior.actions/performAction 的 twwUnderseaVault 读 flags.vaultFlipAction/glyph；
//       入场由 behavior.locationRevealed（11526 沉没阶梯）放置。
export default {
  code: '11532',
  scope: 'location',
  implemented: true,
  flags: {
    vaultFlipAction: true, cannotFlipAgain: true, storyCode: '11532b',
    glyph: { letter: 'Z', meaning: '城市' },
  },
  note: '数据型条目：智力(层级) 翻面行动与符文 Z 由 behavior 实现；胜利点取卡表。',
  abilities: [],
}
