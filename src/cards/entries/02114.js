// 02114 灭火器
// 卡面：[action]：攻击。你本次攻击得到+1[combat]。
// 卡面：[action]放逐灭火器：躲避。你本次检定得到+3[agility]。如果你检定成功，也躲避与你交战的其他每个敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02114',
  abilities: [
    {
      "kind": "action",
      "label": "灭火器攻击（战斗 +1）",
      "cost": {
        "action": true
      },
      "effect": {
        "type": "fight",
        "combatBonus": 1,
        "damageBonus": 0
      }
    },
    {
      "kind": "action",
      "label": "流放灭火器：敏捷 +3 躲避，成功时躲避所有其他交战敌人",
      "cost": {
        "action": true,
        "exileSelf": true
      },
      "effect": {
        "type": "evade",
        "bonus": 3,
        "evadeOthersOnSuccess": true
      }
    },
  ],
  modifiers: [

  ],
}
