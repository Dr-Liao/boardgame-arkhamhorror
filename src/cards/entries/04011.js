// 04011 芬恩可靠的.38手枪
// 卡面：芬恩·爱德华兹牌库专用。快速。使用(3子弹)。
// 卡面：[action]花费1子弹：攻击。你本次攻击得到+2[combat]。如果被攻击敌人未与你交战，你本次攻击造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// ---- Phase 5（5c-3）：TFA 武器与检定加值 5 张 ----
// 这批把「选目标」交给描述子的 target 枚举（B1），武器能力统一走 `api.fight`。
// 04011 芬恩可靠的 .38 手枪：快速资产；花 1 子弹攻击（战斗 +2，未交战敌人额外 +1 伤害）。
// `fast` 是**条目级**关键字（资产没有 played 钩子），读点 lifecycle.playFlag。

export default {
  code: '04011',
  fast: true,
  uses: 3,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action', label: '花费 1 子弹：攻击（战斗 +2，未交战敌人额外 +1 伤害）',
      cost: { action: true, uses: 1 }, countsAs: 'fight', target: { kind: 'enemy' },
      resolve: ({ target, inv, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        api.fight(inv.seat, enemy.id, { combatBonus: 2, damageBonus: enemy.engagedSeat !== inv.seat ? 1 : 0 })
      },
    },
  ],
  modifiers: [

  ],
}
