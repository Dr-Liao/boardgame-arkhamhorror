// 11656 · location · obsidianCanyons
//
// 悬浮礁石（×3）。[[峰顶]]；回合结束：随机弃 1 手牌或受 1 伤害（behavior.turnEnded）；[fast] 花 1 线索与至多 3 连接内[[峰顶]]地点的敌人交换位置（behavior.actions obsidianSuspendedReefSwap：summitEnemiesWithin 找候选，api.moveEnemy/api.moveInvestigator 交换）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11656',
  scope: 'location',
  implemented: true,
  flags: { summit: true, suspendedReef: true },
  
  note: "悬浮礁石（×3）。[[峰顶]]；回合结束：随机弃 1 手牌或受 1 伤害（behavior.turnEnded）；[fast] 花 1 线索与至多 3 连接内[[峰顶]]地点的敌人交换位置。",
}
