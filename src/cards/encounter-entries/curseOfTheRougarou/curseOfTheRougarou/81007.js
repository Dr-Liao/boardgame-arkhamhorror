// 81007 · 狼人诅咒（curseOfTheRougarou）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
export default {
  code: '81007',
  scope: 'location',
  implemented: true,
  flags: {"locationLeft":"cursedShores"},
  note: "强制「离开诅咒河岸时弃 1 张技能卡」由 behavior.locationLeft 读 flags.locationLeft 结算；[action] 受伤换 +2 技能尚未接线（缺少回合内技能加值原语），条目保持 rulesPending。",
  abilities: [],
}
