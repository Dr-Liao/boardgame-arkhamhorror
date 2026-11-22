// 81031 · 狼人诅咒（curseOfTheRougarou）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
export default {
  code: '81031',
  scope: 'enemy',
  implemented: false,
  flags: {"spawnTraitExcluded":"Bayou"},
  note: "「生成 - 任意非 [[Bayou]] 地点」由 behavior.spawnLocation 读 flags.spawnTraitExcluded；猎手由 definition 声明；进入地点时同地点调查员各受 1 恐惧缺少 enemyEntered 读点，本轮未接线。",
  abilities: [],
}
