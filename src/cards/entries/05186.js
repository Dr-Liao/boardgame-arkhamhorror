// 05186 .45汤姆逊冲锋枪（守护者 · 3 经验）
// 卡面：使用(5子弹)。
// 卡面：从.45汤姆逊冲锋枪上花费的子弹放入你的资源池，作为资源。
// 卡面：[action]花费1子弹：攻击。本次攻击你得到+2[combat]并造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05186 .45汤姆逊冲锋枪：5 子弹；攻击 +2 战斗 +1 伤害，每花 1 子弹换成 1 资源。

export default {
  code: '05186',
  uses: 5,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '花 1 子弹攻击（战斗 +2，伤害 +1；子弹化为 1 资源）',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      cost: { uses: 1 },
      resolve: ({ inv, api, targetId }) => {
        if (!targetId) return
        // 卡面：「从这张卡上花费的子弹放入你的资源池，作为资源。」每次能力花费 1 子弹。
        api.gainResources(inv.seat, 1)
        api.fight(inv.seat, targetId, { combatBonus: 2, damageBonus: 1 })
      },
    },
  ],
}
