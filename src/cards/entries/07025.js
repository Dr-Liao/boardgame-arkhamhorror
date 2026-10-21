// 07025 .25自动手枪
// 卡面：快速。使用(4子弹)。
// 卡面：[action]花费1子弹：攻击。如果被攻击的敌人处于横置状态，你本次攻击得到+2[combat]并造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 07025 .25自动手枪：快速；使用(4子弹)；[行动]花 1 子弹攻击，
// 若目标横置则 +2 战斗 +1 伤害。
// Phase 1（B1）：目标写进描述子，legalMoves 直接展开成「手枪 → 敌人」，
// resolve 里不再自己询问（牌桌先选目标、AI 少一轮）。

export default {
  code: '07025',
  uses: 4,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action', label: '花 1 子弹攻击（目标横置时战斗 +2、伤害 +1）',
      cost: { uses: 1 },
      target: { kind: 'enemy' },
      resolve: ({ inv, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return api.info('这里没有可攻击的敌人。')
        const bonus = enemy.exhausted ? { combatBonus: 2, damageBonus: 1 } : {}
        api.fight(inv.seat, enemy.id, { ...bonus, assetId: '07025' })
      },
    },
  ],
  modifiers: [

  ],
}
