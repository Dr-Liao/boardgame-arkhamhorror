// 10600 深沼之物 · 敌人（theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：独特。[[异形]]。[[植物]]。[[突变]]。[[精英]]。胜利 2。
//   逃逸。猎手。庞大。反击。
//   深沼之物得到 +5 [per_investigator] 生命值且不能进行趁乱攻击。
//   深沼之物移动时，其地点视为与每个[[沉没]]地点连接。
//   强制 - 深沼之物在[[沼地]]地点攻击后：治愈其 2 点伤害。
//
// 一张卡一个文件：关键词/数值由章节 definition.js#encounterDefinitions 从卡表转成敌人定义；
// 行为接线在章节 behavior：
//   · enemyStatModifier('health') → +5[per_investigator]；
//   · canOpportunityAttack → 不能趁乱攻击；
//   · enemyConnections → 移动时与每个[[沉没]]地点相连；
//   · enemyDefeated → 结局 4（议程 2 目标）。
// 尚未接线：攻击后治愈 2 点（引擎没有「敌人攻击后」的地点限定读点，见 note）。
export default {
  code: '10600',
  scope: 'enemy',
  implemented: true,
  flags: {
    unique: true, elite: true, victory: 2,
    traits: ['Abomination', 'Flora', 'Mutated', 'Elite'],
    massive: true, hunter: true, elusive: true, retaliate: true,
    healthBonusPerInvestigator: 5, cannotMakeAttacksOfOpportunity: true,
    movingConnectsToSunkenLocations: true, healAfterAttackingAtBog: 2,
    defeatResolution: 'resolution4',
  },
  note: '近似：攻击后治愈 2 点未接线（引擎无「敌人攻击后且其地点为沼地」的强制窗口）；其余读点均在 behavior。',
}
