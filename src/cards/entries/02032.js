// 02032 消防斧
// 卡面：[action]：攻击。如果你的资源池中没有资源，本次攻击造成+1伤害。
// 卡面：[free]在使用消防斧的攻击期间，花费1资源：你本次技能检定得到+2[combat]。(每次攻击仅限三次。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02032',
  abilities: [
    {
      kind: 'action',
      label: '消防斧攻击',
      cost: { action: true },
      effect: { type: 'fight', combatBonus: 0, damageBonus: 0, fireAxe: true },
    },
  ],
  modifiers: [

  ],
}
