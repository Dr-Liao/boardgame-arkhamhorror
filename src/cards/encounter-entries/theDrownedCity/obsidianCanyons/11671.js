// 11671 · enemy · obsidianCanyons
//
// 星之吸血鬼（×2）。猎手/无情；猎物-剩余生命值最高者；攻击后治愈 1 点伤害（behavior.enemyAttackResolved 读 healDamageAfterAttack）。数值来自卡表 encounterDefinitions；猎手/无情由 api.scenario.setEnemyKeywords 声明，猎物取自卡表 preyRules。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11671',
  scope: 'enemy',
  implemented: true,
  flags: { prey: 'mostRemainingHealth', hunter: true, relentless: true },
  enemyRule: { relentless: true },
  note: "星之吸血鬼（×2）。猎手/无情（入场与每轮神话阶段开始用 P7 `api.scenario.setEnemyKeywords(enemy,['relentless'],{enabled:true,throughRound:state.round})` 声明，`enemyRule.relentless` 为印刷回退；过期自动回印刷值）；猎物-剩余生命值最高者（card-data 的 preyRules 把印刷「Most remaining health」映射为 prey:'mostRemainingHealth'，引擎 PREY_RANK 求值）；攻击后治愈 1 点伤害（behavior.enemyAttackResolved 读 healDamageAfterAttack）。",
}
