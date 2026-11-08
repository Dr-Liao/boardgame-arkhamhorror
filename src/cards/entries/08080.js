// 08080 灭火器
// 卡面：[action]：攻击。你本次攻击得到+1[combat]并造成+1伤害。
// 卡面：[action]弃掉灭火器：躲避。自动躲避所有与你交战的敌人。你可以将弃掉灭火器改为放逐，
//       来弃掉每一张被此效果躲避的非[[精英]]敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08080',
  abilities: [
    { kind: 'action', label: '攻击（战斗 +1，伤害 +1）', cost: { action: true },
      effect: { type: 'fight', combatBonus: 1, damageBonus: 1 } },
    { kind: 'action', label: '弃掉灭火器：自动躲避所有交战敌人', cost: { action: true, discardSelf: true },
      countsAs: 'evade', noOpportunityAttack: true,
      resolve: ({ inv, state, api }) => {
        for (const enemyId of [...inv.engaged]) {
          const enemy = state.enemies.find(item => item.id === enemyId)
          if (enemy && !enemy.defeated) api.autoEvadeEnemy(enemy)
        }
      } },
    // 放逐版（印刷：可以把「弃掉」改为「放逐」，额外击败被躲避的非精英敌人）。
    { kind: 'action', label: '放逐灭火器：自动躲避并击败被躲避的非精英敌人', cost: { action: true, exileSelf: true },
      countsAs: 'evade', noOpportunityAttack: true,
      resolve: ({ inv, state, api }) => {
        const evaded = []
        for (const enemyId of [...inv.engaged]) {
          const enemy = state.enemies.find(item => item.id === enemyId)
          if (!enemy || enemy.defeated) continue
          if (api.autoEvadeEnemy(enemy)) evaded.push(enemy)
        }
        for (const enemy of evaded) if (!enemy.elite) api.defeatEnemy(enemy, inv.seat)
      } },
  ],
  modifiers: [],
}
