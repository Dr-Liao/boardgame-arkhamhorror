// 81022 · 狼人诅咒（curseOfTheRougarou）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
export default {
  code: '81022',
  scope: 'enemy',
  implemented: true,
  flags: {"bayouStatBonus":{"fight":2,"evade":2},"prey":"lowestAgility"},
  note: "「位于 [[Bayou]] 地点时 +2 战斗/+2 躲避」由 behavior.enemyStatModifier 读 flags.bayouStatBonus 结算；猎物=敏捷最低由 definition.prey 声明。",
  abilities: [],
}
