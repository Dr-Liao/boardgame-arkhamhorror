// 09564 分裂精魂（Apportioned Ka）· enemy
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   隐匿 4。
//   强制 - 在分裂精魂被揭露后：对血色监视者造成 5 点伤害。将分裂精魂返回阴影中，
//   并结算其隐匿关键词，在每个没有标的的非[[中心]]地点中，尽可能平均地分发其隐匿迷你卡牌。
//
// 它没有战斗/躲避/生命值（参考实现 enemyFight/enemyHealth/enemyEvade = Nothing）：
// 只能靠揭露（Expose）处理，因此这里没有可执行的战斗能力。
//
// 逐卡规则：`enemyScript.exposedDamage` / `enemyScript.returnToShadowsOnExposed` 由章节
// behavior 的 `exposeAt()` 读取并结算（behavior.exposeAt → 造成伤害 → setEnemyAside → 重新分配）。
export default {
  code: '09564',
  scope: 'enemy',
  implemented: true,
  enemyRule: { concealed: 4 },
  enemyScript: {
    exposedDamage: { code: '09563', amount: 5 },
    returnToShadowsOnExposed: true,
  },
  note: '隐匿 4 = 4 张诱饵 + 真身（共 5 张迷你卡，与参考幕间「分发其 5 张隐匿迷你卡」一致）。',
}
