// 06146 跟踪的蝎狮（theSearchForKadath）· 敌人（生物 / 怪物 / 精英，胜利1）
// 卡面：强制 - 如果你成功躲避跟踪的蝎狮：与其解除交战，但不要横置它。
//       直到本阶段结束，它不能与你交战。
//
// 一卡一文件：规则数据在这里声明，章节 behavior 的 afterEvade / canEngageEnemy 读取并接线。
export default {
  code: '06146', scope: 'enemy', implemented: true,
  enemyRule: {
    // 成功躲避后：解除交战、不横置、本阶段不能与该调查员交战（behavior.afterEvade）。
    evadeDisengageWithoutExhaust: true,
    // 本阶段结束前不能与该调查员交战（behavior.canEngageEnemy）。
    cannotEngageUntilEndOfPhase: true,
  },
}
