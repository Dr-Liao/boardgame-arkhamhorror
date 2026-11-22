// 60158 制式左轮（Service Revolver）
// 卡面：使用(3子弹)。[reaction] 一个敌人攻击你后，花 1 子弹：攻击该敌人，+1[combat]、伤害 +1。
// 卡面另有基础攻击能力（[action] 花 1 子弹：攻击 +1[combat]）。
// 读点：action 描述子 + api.fight；reaction trigger enemyAttacked（enemies.js 攻击窗口 context.enemy）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60158',
  uses: 3,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '花 1 子弹：攻击（战斗 +1）',
      cost: { action: true, uses: 1 },
      countsAs: 'fight',
      target: { kind: 'enemy' },
      resolve: ({ inv, target, source, api }) => {
        if (!target) return
        api.fight(inv.seat, target.id, { assetId: source?.id, combatBonus: 1 })
      },
    },
    {
      kind: 'reaction',
      trigger: 'enemyAttacked',
      label: '敌人攻击你后，花 1 子弹：反击该敌人（+1 战斗，+1 伤害）',
      cost: { uses: 1 },
      criteria: [({ inv, context }) => context?.seat === inv.seat && context?.enemy
        && context.attackCancelled !== true],
      resolve: ({ inv, context, source, api }) => {
        api.fight(inv.seat, context.enemy.id, { assetId: source?.id, combatBonus: 1, damageBonus: 1 })
      },
    },
  ],
  modifiers: [],
}
