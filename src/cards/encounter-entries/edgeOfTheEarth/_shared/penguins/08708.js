// 08708 巨型白化企鹅（Giant Albino Penguin）· 敌人 · penguins
// 卡面：冷漠。作为进入或离开本敌人所在地点的额外费用，你必须花费 1 个行动。
// 移动费用读取 moveSurchargeAtEnemyLocation，冷漠由卡面关键字提供。
export default {
  code: '08708', scope: 'enemy', implemented: true,
  flags: { moveSurchargeAtEnemyLocation: 1 },
}

