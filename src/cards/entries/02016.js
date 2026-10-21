// 02016 金属棍棒
// 卡面：[action]：攻击。本次攻击你得到+1[combat]。如果你对与另一位调查员交战的敌人执行本次攻击，且你检定失败，则你不造成伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02016',
  abilities: [
    {
      kind: 'action',
      label: '战斗 +1；失败不误伤队友',
      cost: { action: true },
      effect: { type: 'fight', combatBonus: 1, damageBonus: 0, noFriendlyFire: true },
    },
  ],
  modifiers: [

  ],
}
