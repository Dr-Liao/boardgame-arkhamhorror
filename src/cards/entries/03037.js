// 03037 挖墓人的铲子
// 卡面：[action]：攻击。你本次攻击得到+2[combat]。
// 卡面：[action]弃掉挖墓人的铲子：发现你所在地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03037',
  abilities: [
    {
      "kind": "action",
      "label": "挖墓人的铲子攻击",
      "cost": {
        "action": true
      },
      "effect": {
        "type": "fight",
        "combatBonus": 2,
        "damageBonus": 0
      }
    },
    {
      "kind": "action",
      "label": "弃置铲子发现1条线索",
      "cost": {
        "action": true,
        "discardSelf": true
      },
      "effect": {
        "type": "discoverClue",
        "amount": 1
      }
    },
  ],
  modifiers: [

  ],
}
