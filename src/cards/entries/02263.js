// 02263 奇怪的溶液
// 卡面：研究完成。使用(3补给)。
// 卡面：[action]花费1补给：攻击。以基础值为6的[combat]攻击。本次攻击造成+2伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02263',
  // 第 123 轮：升级前置记录由条目声明（原 src/campaign/campaign.js 的 researchRequirement 表）。
  researchRequirement: 'identifiedStrangeSolution',
  uses: 3,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'action',
      label: '以基础战斗值 6 攻击，伤害 +2',
      cost: { action: true, uses: 1 },
      effect: { type: 'fight', combatBonus: 0, damageBonus: 2, baseValue: 6 },
    },
  ],
  modifiers: [

  ],
}
