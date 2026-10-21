// 02107 “我有个计划！”
// 卡面：攻击。本次攻击使用[intellect]。你每有一个线索，本次攻击造成+1伤害(最多+3伤害)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02107',
  abilities: [
    {
      kind: 'played',
      label: '“我有个计划！”',
      effect: { type: 'fight', skill: 'intellect', damagePerClue: true, maxDamageBonus: 3 },
    },
  ],
  modifiers: [

  ],
}
