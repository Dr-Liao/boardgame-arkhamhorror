// 11690 反击！ · 幕 1（坚守阵线分支）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。
// 卡面：[fast] 在你所在地点的一次攻击期间，花费 1 个线索：本次攻击伤害 +1（每次攻击限一次）。
// 目标 - 一轮结束时，如果胜利区有 3 名[[克苏鲁]]敌人，推进。
// 背面：胜利区每名[[克苏鲁]]敌人以非[[狂怒]]面回面板；克苏鲁的狂怒 +1；≤4 翻回 1a，≥5 → 结局 1。
// 读点：见 note。
export default {
  code: '11690',
  scope: 'act',
  implemented: true,
  note: "数据型条目：目标/背面在 behavior.roundEnded / behavior.actReveal。approximation：[fast]「攻击期间花费线索 +1 伤害」需要攻击上下文读写点，本批次未接线。",
  abilities: [],
}
