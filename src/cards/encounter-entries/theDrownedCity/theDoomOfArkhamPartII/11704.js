// 11704 克苏鲁 · 邪恶利爪 · 克苏鲁敌人（多部位）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 非狂怒面：反击；X 战斗/躲避；不能受到伤害/被击败/横置；成功攻击/躲避后翻至狂怒面。
// 读点：behavior.setupCthulhuBoard / linkCthulhuParts（多部位原语 linkEnemyParts）；
//       behavior.enemyStatModifier（战斗/躲避/生命 = 狂怒值；flags.cthulhuFacet）；
//       behavior.returnCthulhuFacetsToBoard（胜利区回面板 / 翻至狂怒面）。
// 读点（第二轮已接，PRIMITIVES.md 已落地）：
//   · 非[[狂怒]]面不能受到伤害/被横置 = enemyRule.cannotBeDamaged / cannotBeExhausted
//     （enemy-restrictions.js → canDamageEnemy / combat 躲避与自动躲避 / actions 自动躲避 /
//     scenarioRuntime.exhaustEnemy；按当前面条目动态读，换面后 b 面条目不含该声明即失效）；
//   · 不能被击败沿用 enemyCannotBeDefeated（definition 非狂怒面补丁 cannotBeDefeated: true）；
//   · 翻至[[狂怒]]面后的强制效果 = scenarioBehavior.enemyFaceFlipped（Doom II behavior 实现）。
export default {
  code: '11704',
  scope: 'enemy',
  implemented: true,
  flags: { cthulhuFacet: true },
  enemyRule: { cannotBeDamaged: true, cannotBeExhausted: true },
  note: "非[[狂怒]]面：不能受到伤害/被横置/被击败（enemyRule + cannotBeDefeated）；成功攻击或躲避后翻至[[狂怒]]面，翻面后的强制由 enemyFaceFlipped 结算。",
  abilities: [],
}
