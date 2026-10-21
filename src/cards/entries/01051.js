// 01051 背刺
// 卡面：攻击。本次攻击不使用[combat]，改为使用[agility]。本次攻击造成+2伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01051',
  abilities: [
    {
      kind: 'played',
      label: '背刺',
      effect: { type: 'fight', skill: 'agility', damageBonus: 2 },
    },
  ],
  modifiers: [

  ],
}
