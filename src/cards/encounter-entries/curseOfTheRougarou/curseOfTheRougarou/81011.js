// 81011 · 狼人诅咒（curseOfTheRougarou）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
export default {
  code: '81011',
  scope: 'location',
  implemented: true,
  flags: {"afterEvadeDiscardRandom":true},
  note: "强制「躲避敌人后随机弃 1 张手牌」缺少 locationRule.onEvade 读点，本轮未接线；胜利 1 由 definition 声明。",
  abilities: [],
}
