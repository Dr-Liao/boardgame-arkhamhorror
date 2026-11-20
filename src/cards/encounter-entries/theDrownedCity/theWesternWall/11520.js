// 11520 攀上高墙 · 幕 1（西墙，东线构型）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：[fast] 调查员共同花费 1[per_investigator] 个线索：降低你所在地点的淹没等级。
//       目标 - 前往水面！如果每位存活调查员均位于西墙，调查员可以推进。
// 印刷：背面「返回水面」→ 结局 2。
// 读点：behavior.actions/performAction 的 twwDecreaseFlood 读 flags；behavior.checkObjectives 读 flags.objectiveAllAt；
//       背面在 behavior.actReveal。
export default {
  code: '11520',
  scope: 'act',
  implemented: true,
  flags: { direction: 'east', fastDecreaseFlood: true, clueCostPerInvestigator: 1, objectiveAllAt: 'westernWall' },
  note: '数据型条目：与 11519 同构（目标是西墙）；'
    + 'approximation：目标“可以推进”按满足即自动推进处理。',
  abilities: [],
}
