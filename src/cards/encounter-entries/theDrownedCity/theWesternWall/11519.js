// 11519 下潜深渊 · 幕 1（西墙，西线构型）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：[fast] 调查员共同花费 1[per_investigator] 个线索：降低你所在地点的淹没等级。
//       目标 - 前往海底！如果每位存活调查员均位于黑曜石地基，调查员可以推进。
// 印刷：背面「海洋深处」→ 结局 1。
// 读点：behavior.actions/performAction 的 twwDecreaseFlood 读 flags.fastDecreaseFlood/clueCostPerInvestigator；
//       behavior.checkObjectives 读 flags.objectiveAllAt；背面在 behavior.actReveal。
export default {
  code: '11519',
  scope: 'act',
  implemented: true,
  flags: { direction: 'west', fastDecreaseFlood: true, clueCostPerInvestigator: 1, objectiveAllAt: 'obsidianFoundations' },
  note: '数据型条目：目标“全员位于黑曜石地基”由 behavior.checkObjectives 检查；'
    + '达成后由 api.choose 询问「推进 / 暂不推进」，只有 advance 才推进；skip 记本幕+本回合，本轮不再重复询问（印刷“可以推进”）。',
  abilities: [],
}
