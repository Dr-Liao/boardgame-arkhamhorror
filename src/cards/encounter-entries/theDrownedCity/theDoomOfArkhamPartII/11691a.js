// 11691a 放逐他！ · 幕 1（仪式分支）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。
// 卡面：目标与 [fast] 同「反击！」。
// 背面：胜利区克苏鲁敌人回面板；狂怒 +1；≤3 翻回 1a；≥4 则怒气设为 5（1–2 人局 4）、全部部位翻至[[狂怒]]面、补线索、分配放在一边的盟友剧情支援，并推进到特殊议程「最终封印」。
// 读点：见 note。
export default {
  code: '11691a',
  scope: 'act',
  implemented: true,
  // 11690/11691a 正面印刷 [fast]：在你所在地点的一次攻击期间，花费 1 个线索：本次攻击伤害 +1。
  // 读点（PRIMITIVES「攻击期间线索加伤」已落地）：moves.js 生成额外 fight 变体
  // （clueDamageBonus: true），dispatch.js 支付线索并把伤害并入本次攻击；validateMove 拒绝线索不足。
  attackRule: { clueDamageBonus: { cost: 1, amount: 1 } },
  note: "数据型条目：背面在 behavior.actReveal（含最终封印切换）；[fast] 攻击期间支付 1 线索 +1 伤害走 attackRule.clueDamageBonus（moves.js / dispatch.js 读点）；最终封印时盟友按玩家顺序逐人可选控制（behavior.putAlliesIntoPlay 经 api.choose 分配，不占盟友槽）。",
  abilities: [],
}
