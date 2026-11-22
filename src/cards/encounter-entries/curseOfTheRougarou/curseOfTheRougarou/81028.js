// 81028 · 狼人诅咒（curseOfTheRougarou）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
export default {
  code: '81028',
  scope: 'enemy',
  implemented: true,
  flags: {"rougarou":true,"elite":true},
  note: "冷漠/反击由 definition 关键词声明；交战额外费用（团队线索）等待 canEngageEnemy 的付费读点；「一个阶段内受到 1[per_investigator] 伤害后移动到离所有调查员最远的地点」由 behavior.enemyDamaged 结算。",
  abilities: [],
}
