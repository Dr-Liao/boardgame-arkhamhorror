// 03009 索菲
// 卡面：马克·哈里根牌库专用。
// 卡面：索菲不能离场。
// 卡面：[free]受到1点直接伤害：你本次技能检定得到技能值+2。
// 卡面：强制 - 如果马克·哈里根身上有5点或更多伤害：将索菲翻面。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03009 苏菲（受创版）：受到 5 点以上伤害时全部技能 -1（原 engine.getStat 的卡号特判）。

export default {
  code: '03009',
  // 第 125 轮（第 8 批）：受创后公开投影翻面成 03009b（原先写死在 observation.js）。
  observationVariant: { code: '03009b', minDamage: 5 },
  modifiers: [
    { target: 'skill:*', amount: -1, condition: { damageAtLeast: 5 } },
  ],
  cannotLeavePlay: true,
  abilities: [
    {
      "kind": "action",
      "label": "受到1点直接伤害：本次检定任意技能值+2",
      "cost": {
        "action": false,
        "damageSelf": 1
      },
      "duringOwnSkillTest": true,
      "maximumInvestigatorDamage": 4,
      "effect": {
        "type": "addTestValue",
        "amount": 2
      }
    },
  ],
}
