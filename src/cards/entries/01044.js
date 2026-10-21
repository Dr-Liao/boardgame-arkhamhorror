// 01044 弹簧刀
// 卡面：快速。
// 卡面：[action]：攻击。如果你检定成功且超过难度至少2点，本次攻击造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01044',
  fast: true,
  abilities: [
    {
      "kind": "action",
      "label": "战斗（成功差值至少 2 时伤害 +1）",
      "cost": {
        "action": true
      },
      "effect": {
        "type": "fight",
        "successBy": 2,
        "damageBonus": 1
      }
    },
  ],
  modifiers: [

  ],
}
