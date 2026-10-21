// 03036 提灯
// 卡面：[action]：调查。本次调查你所在地点的隐藏值-1。
// 卡面：[action]弃掉提灯：对你所在地点的一个敌人造成1点伤害。本行动不会触发趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03036',
  abilities: [
    {
      "kind": "action",
      "label": "提灯调查",
      "cost": {
        "action": true
      },
      "effect": {
        "type": "investigate",
        "shroudMod": -1
      }
    },
    {
      "kind": "action",
      "label": "弃置提灯造成1点伤害",
      "cost": {
        "action": true,
        "discardSelf": true
      },
      "effect": {
        "type": "dealDamage",
        "amount": 1,
        "target": "here",
        "noOpportunityAttack": true
      }
    },
  ],
  modifiers: [

  ],
}
