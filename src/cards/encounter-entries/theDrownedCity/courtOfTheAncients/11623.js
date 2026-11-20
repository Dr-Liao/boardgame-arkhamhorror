// 11623 古代祭坛 · 地点（胜利 1；[action] 破封检定 → 控制伊克雷希特碎片；
//       胜利区符文 <3 不能进入；进入额外费用：东侧前厅调查员共同花费 4[per_investigator] 线索）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点：
//   · 进入限制 = behavior.moveError（胜利区符文 <3）；
//   · 进入额外费用 = 条目 locationRule.entryCost = { kind:'groupClues', perInvestigator: 4 }，
//     引擎在 moves.js#validateMove 与 movement.js 移动结算前读取：同地点调查员共同支付
//     4 × 调查员数 的线索；不足时拒绝移动，支付后进入。
export default {
  code: '11623',
  scope: 'location',
  implemented: true,
  locationRule: { entryCost: { kind: 'groupClues', perInvestigator: 4 } },
  flags: {"altarBroken":true,"cannotEnterUntilGlyphs":3,"victory":true},
  note: "进入限制（behavior.moveError，胜利区符文 <3）与额外进入费用 4[per_investigator] 线索（locationRule.entryCost）均已接线；破封行动在 behavior.actions/performAction。",
  abilities: [],
}
