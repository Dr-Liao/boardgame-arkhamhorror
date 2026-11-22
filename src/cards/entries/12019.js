// 12019 M1911手枪
// 卡面：使用(4子弹)。
// 卡面：[action]花费1子弹：攻击([combat])。你本次攻击得到+1[combat]并且造成伤害+1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 使用次数 = 条目级 uses/usesType（newPlayerAssetInstance 初始化实例，cost.uses 扣费、
//     useAmmoSpent 结算，与 01016 .45自动手枪同一口径）；
//   · [action] 攻击 = action 描述子 + effect fight（combatBonus/damageBonus），
//     doFight 是攻击的唯一结算入口；assetId 由 executeDescriptor 自动指向本支援。

export default {
  code: '12019',
  uses: 4,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '射击（战斗 +1，伤害 +1）',
      cost: { action: true, uses: 1 },
      effect: { type: 'fight', combatBonus: 1, damageBonus: 1 },
    },
  ],
  modifiers: [
  ],
}
