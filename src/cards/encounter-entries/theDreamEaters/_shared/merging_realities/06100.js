// 06100 现实之线（Threads of Reality，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：merging_realities（WN / ATSOH）。
// 卡面：Revelation - 附属到你控制的印刷费用最高的非永久、非弱点支援。否则，现实之线获得涌动。
//       将所附属支援的印刷文本框视为空白（[[特性]] 与强制能力除外）。
//       [action] 弃掉一个你控制的支援：弃掉现实之线。
// 实现：选择宿主 = 内容可做的最高印刷费用筛选；但「附属到支援 + 文本空白 + 摆脱行动」需要
//   共享层 asset 附属/文本空白数据分派（内容层无 attach-to-asset api）→ 已登记 coordinator request。
//   数据写在 flags 上（宿主选择口径 + surge 回退）。
export default {
  code: '06100',
  scope: 'treachery',
  implemented: true,
  flags: {
    attachToAsset: { highestPrintedCost: true, excludePermanent: true, excludeWeakness: true, surgeIfNone: true },
    blankHostTextExceptTraitsAndForced: true,
    discardHostAction: true,
  },
  simplified: true,
  note: '附属到支援/文本空白/摆脱行动由使用本章的章节 behavior 读 flags 接线（内容层无 attach-to-asset API）；数据已备好。',
}
