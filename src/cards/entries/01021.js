// 01021 看门狗
// 卡面：[reaction]在敌人的攻击对看门狗造成伤害时：对攻击敌人造成1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01021 护卫犬：与敌人交战时支援受伤，反击 1 点伤害。

export default {
  code: '01021',
  abilities: [
    {
      kind: 'reaction', trigger: 'enemyAttackDamage', id: 'guardDog', legacyReaction: true,
      criteria: { requiresAssetDamage: true }, label: '支援受伤时反击 1 点伤害',
      effect: { type: 'dealDamage', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
