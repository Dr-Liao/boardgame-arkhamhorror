// 06006 贝基
// 卡面：托米·马尔登牌库专用。使用(2 子弹)。
//       从托米·马尔登的 [reaction] 能力获得的每个资源都可以改为放在贝基上，作为子弹。
//        [action] 花费 1 子弹：攻击。本次攻击你得到 +2 [combat] 并造成 +1 伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 「资源改为放在贝基上」写在 06001 的 reaction 里（api.addUses），这里只声明使用次数与攻击能力。

export default {
  code: '06006',
  uses: 2,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '花费 1 子弹：攻击（战斗 +2，伤害 +1）',
      cost: { action: true, uses: 1 },
      effect: { type: 'fight', combatBonus: 2, damageBonus: 1 },
    },
  ],
  modifiers: [],
}
