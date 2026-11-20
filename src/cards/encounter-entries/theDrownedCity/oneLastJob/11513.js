// 11513 帮派执行者 · 敌人 ×2（金盆洗手，放一边）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：猎手。猎物 - 线索最多者。
//       强制 - 每轮中，本敌人所在地点的一位调查员首次攻击另一名[[罪犯]]敌人后：
//       重整帮派执行者并攻击该调查员。
// 印刷：战斗 3 / 躲避 2 / 生命 3 / 伤害 2 / 恐惧 0 / 特性 [[Humanoid]][[Criminal]][[Syndicate]] / 胜利 1。
// 读点：猎手/猎物由 definition.encounterDefinitions 解析卡文（hunter/prey=mostClues）；
//       议程背面生成在 behavior.agendaReveal；
//       「攻击另一名罪犯敌人后重整并攻击」由 behavior.enemyAttackedSuccessfully（combat.js 既有读点）。
export default {
  code: '11513',
  scope: 'enemy',
  implemented: true,
  note: '猎手/猎物由 definition 解析；强制「每轮首次攻击另一名罪犯敌人后重整并攻击该调查员」'
    + '由 behavior.enemyAttackedSuccessfully 实现（每轮一次，记 state.scenarioFlags.oneLastJobEnforcerRounds）。',
  abilities: [],
}
