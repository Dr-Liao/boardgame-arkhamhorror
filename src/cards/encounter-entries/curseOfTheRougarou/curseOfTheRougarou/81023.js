// 81023 · 狼人诅咒（curseOfTheRougarou）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
export default {
  code: '81023',
  scope: 'enemy',
  implemented: true,
  flags: {"spawnTrait":"Bayou"},
  note: "「生成 - 任意 [[Bayou]] 地点」由 behavior.spawnLocation 读 flags.spawnTrait 结算；不能躲避由 definition.evade=null 声明；「进入非河口地点时弃掉」等待 enemyMoved 的非离场读点（本轮未接）。",
  abilities: [],
}
