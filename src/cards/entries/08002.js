// 08002 机修工的扳手（Mechanic's Wrench）· 丹妮拉专属支援。
//
// 卡面：
//   [fast] 横置机修工的扳手：选择你所在地点的一个敌人。该敌人攻击你。
//   [action]：攻击。本能力只能用于在你上一回合结束后，攻击过你的敌人。本次攻击你得到 +2[combat]
//     并且造成 +1 伤害。
//
// 引擎读点：`inv.attackedSinceTurnEnd`（与 08001 共用同一份权威攻击记录：敌人攻击结算时写入，
// 调查员回合结束时清空）；强制的敌人攻击走 `api.enemyAttackByCard`（卡牌造成的攻击，不计入
// 「敌人不能攻击」开关），与参考实现的 EnemyAttack 语义一致。
export default {
  code: '08002',
  abilities: [
    {
      kind: 'free',
      cost: { exhaust: true },
      label: '横置：选择你所在地点的一个敌人，该敌人攻击你',
      target: { kind: 'enemy', query: ({ inv, entity }) => entity.location === inv.location },
      resolve: ({ inv, target, api }) => {
        // ctx.target 是目标候选包装（{ id, label, entity }），敌人实例在 .entity。
        const attacker = target?.entity || target
        if (attacker) api.enemyAttackByCard(attacker, '机修工的扳手', inv.seat)
      },
    },
    {
      kind: 'action',
      countsAs: 'fight',
      label: '攻击：上一回合结束后攻击过你的敌人，本次 +2[combat]、+1 伤害',
      target: {
        kind: 'enemy',
        query: ({ inv, entity }) => (inv.attackedSinceTurnEnd || []).some(entry => entry.enemyId === entity.id),
      },
      resolve: ({ inv, target, api }) => {
        if (target) api.fight(inv.seat, target.id, { combatBonus: 2, damageBonus: 1 })
      },    },
  ],
}
