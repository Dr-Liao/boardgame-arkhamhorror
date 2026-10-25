// 05186 .45汤姆逊冲锋枪（守护者 · 3 经验）
// 卡面：使用(5子弹)。
// 卡面：从.45汤姆逊冲锋枪上花费的子弹放入你的资源池，作为资源。
// 卡面：[action]花费1子弹：攻击。本次攻击你得到+2[combat]并造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05186 .45汤姆逊冲锋枪：5 子弹；攻击 +2 战斗 +1 伤害，每花 1 子弹换成 1 资源。
//
// 第五轮（spentUsesGainResources 原语）：条目声明 spentUsesGainResources: true，
// 任何通过 api.addUses(<本卡>, -n) 花费子弹的其它效果（如 05229 鸣枪示警的额外费用）
// 都会自动把 n 点资源给卡主（读点 src/engine/api-misc.js:209-220）。
// 注意：本卡自身 [action] 的 cost.uses 由引擎 ability-rules 直接扣减（不经 api.addUses），
// 因此 resolve 里仍保留手动 +1 资源折算；如果引擎把 cost.uses 也接到 api.addUses，请删除这行避免重复。

export default {
  code: '05186',
  uses: 5,
  usesType: 'ammo',
  spentUsesGainResources: true,
  abilities: [
    {
      kind: 'action',
      label: '花 1 子弹攻击（战斗 +2，伤害 +1；子弹化为 1 资源）',
      countsAs: 'fight',
      target: { kind: 'enemy' },
      cost: { uses: 1 },
      resolve: ({ inv, api, targetId }) => {
        if (!targetId) return
        // 卡面：「从这张卡上花费的子弹放入你的资源池，作为资源。」本卡自身 cost.uses 的手动折算。
        api.gainResources(inv.seat, 1)
        api.fight(inv.seat, targetId, { combatBonus: 2, damageBonus: 1 })
      },
    },
  ],
}
