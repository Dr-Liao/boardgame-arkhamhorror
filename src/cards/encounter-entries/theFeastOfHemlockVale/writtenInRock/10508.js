// 10508 控制站 · 地点（writtenInRock）
// 卡面：[fast] 你的回合内：交换 2 个相邻[[轨道]]地点。（团队每局限一次。）
// 背面：作为进入控制站的额外费用，位于相邻地点的调查员必须共同花费 2[per_investigator] 条线索。
// 印刷数据由 definition 的 location() 从卡表读取；能力在 behavior.actions / performAction
// （writtenInRockStationSwap）与 definition 的 enterCostCluesPerInvestigator 承接。
export default {
  code: '10508',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 1,
    printedCluesPerInvestigator: 2,
    fastSwapOncePerGame: true,
    enterCostCluesPerInvestigator: 2,
  },
  note: null,
  abilities: [],
}
