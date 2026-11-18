// 10506 地下迷宫 · 幕（writtenInRock）
// 卡面：[fast] 你的回合内，共同花费 1[per_investigator] 条线索：把一个地点滑入相邻空格，
// 或交换 2 个相邻地点。[action] 花费 1[per_investigator] 资源：把一个已揭示地点滑入相邻空格
// （团队每轮一次）。[action] 如果棱柱碎片在你的地点：取得其控制权。
// 目标 - 抵达轨道出口！当矿车进入轨道出口时，立即推进。
// 背面：安全了 - 按席米恩/莉亚是否被调查员控制/仍在场/放一边，进入结局 1–5。
// 行动在 behavior.actions / performAction（幕 2 的 slide/swap/取碎片），目标与背面在
// behavior.checkAct2Objective / actReveal。
export default {
  code: '10506',
  scope: 'act',
  implemented: true,
  flags: {
    objective: 'mineCartEntersRailExit',
    fastSlideSwapCluesPerInvestigator: 1,
    paidSlideResourcesPerInvestigator: 1,
    takePrismaticShardAction: true,
    back: 'resolutions1to5',
  },
  note: null,
  abilities: [],
}
