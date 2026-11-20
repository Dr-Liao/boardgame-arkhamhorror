// 11671 · enemy · obsidianCanyons
//
// 星之吸血鬼（×2）。猎手/无情；猎物-剩余生命值最高者；攻击后治愈 1 点伤害（behavior.enemyAttackResolved 读 healDamageAfterAttack）。数值来自卡表 encounterDefinitions；猎手/无情/猎物的引擎声明未接线（近似）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11671',
  scope: 'enemy',
  implemented: true,
  flags: { prey: 'mostRemainingHealth', hunter: true, relentless: true, healDamageAfterAttack: 1 },
  
  note: "星之吸血鬼（×2）。猎手/无情；猎物-剩余生命值最高者；攻击后治愈 1 点伤害（behavior.enemyAttackResolved 读 healDamageAfterAttack）。数值来自卡表 encounterDefinitions；猎手/无情/猎物的引擎声明未接线（近似）。",
}
