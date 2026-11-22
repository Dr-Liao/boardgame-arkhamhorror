// 52033 誓约看守人（重返往事回声）
// 归属：关卡专用 · returnToEchoesOfThePast（重返卡尔克萨之路 · 往事回声）
// 遭遇组：return_to_echoes_of_the_past
// 卡面：当前场景编号大于当前密谋编号时获得猎手。
//       强制 - 敌军阶段结束时：找出每位所在地点与誓约看守人所在地点有相同[[特性]]的调查员，
//       将这些调查员的各 1 个线索移动到誓约看守人上。
//
// 行为读点：enemyRule.conditionalHunter（本章 behavior.enemySpawned / roundEnded 同步）
//           + enemyRule.stealClueFromSameTraitInvestigators（本章 behavior.enemyPhaseEnd）。
export default {
  code: '52033',
  name: '誓约看守人',
  scope: 'enemy',
  enemyRule: {
    conditionalHunter: 'actAheadOfAgenda',
    stealClueFromSameTraitInvestigators: 1,
  },
}
