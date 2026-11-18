// 10574 直面甲壳（Face to Carapace）· 幕 3
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：[action] 花费 1[per_investigator] 线索并选择一个连接的[[黑暗]]地点的敌人：把该敌人移到你的地点。
//       目标 - 如果鳖类混种被击败，立即推进。
// 背面：(→ 结局 1)。
//
// 一张卡一个文件：目标在 behavior.checkObjectives（击败判定读 lostSisterLimulusDefeated 与胜利区），
// 背面在 behavior.actReveal（api.finish('resolution1')）。
export default {
  code: '10574',
  scope: 'act',
  implemented: true,
  abilities: [],
  flags: {
    actStage: 3,
    objective: 'defeatEnemy',
    objectiveEnemyCodes: ['10583a', '10583b'],
    action: 'moveDarkEnemy',
    cluesPerInvestigator: 1,
    backResolution: 'resolution1',
  },
  note: '数据型条目：双面鳖类混种的两个卡号都算「鳖类混种被击败」。',
}
