// 08708 巨型白化企鹅（Giant Albino Penguin）· 敌人 · penguins
// 卡面：冷漠。作为进入或离开本敌人所在地点的额外费用，你必须花费 1 个行动。
// 读点：冷漠来自卡面数据（aloof）；「进出所在地点额外 1 行动」需要引擎的地点移动附加费读点
//   （primitive-requests/p7-08708.json）。
export default {
  code: '08708', scope: 'enemy', implemented: true,
  flags: { moveSurchargeAtEnemyLocation: 1 },
  note: '「进入/离开本敌人所在地点额外花费 1 行动」需要引擎的地点移动附加费读点（primitive-requests/p7-08708.json）。',
}

