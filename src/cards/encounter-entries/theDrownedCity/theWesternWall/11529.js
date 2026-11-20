// 11529 黑曜石地基 · 地点（西墙）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：X 为本地点的层级。
//       [action]：检定[intellect](3)。如果你成功，抽取放在一边的海底壁画[tdc_rune_w]诡计。
// 印刷：shroud = 层级（X）、每调查员 2 条线索、特性 [[R'lyeh]]。
// 读点：behavior.actions/performAction 的 twwObsidianFoundations 读 flags.drawFriezeAction
//       （检定成功把放一边的 11531 放上遭遇牌库顶并抽取）。
export default {
  code: '11529',
  scope: 'location',
  implemented: true,
  flags: { shroudIsLevel: true, drawFriezeAction: true, friezeCode: '11531' },
  note: '数据型条目：抽海底壁画的行动由 behavior 实现；「洗回」由 api.drawEncounter 的正常遭遇管线处理。',
  abilities: [],
}
