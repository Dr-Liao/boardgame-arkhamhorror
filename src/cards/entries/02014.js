// 02014 杜克
// 卡面：“灰堆”皮特牌库专用。
// 卡面：[action]横置杜克：攻击。你以基础值为4的[combat]攻击。本次攻击造成+1伤害。
// 卡面：[action]横置杜克：调查。你以基础值为4的[intellect]调查。你可以在以本效果调查前立刻移动到一个连接地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02014',
  abilities: [
    {
      kind: 'action',
      label: '杜克攻击（基础战斗 4，伤害 +1）',
      cost: { action: true, exhaust: true },
      effect: { type: 'fight', baseValue: 4, damageBonus: 1 },
    },
    {
      kind: 'action',
      label: '杜克调查（可先移动，基础智识 4）',
      cost: { action: true, exhaust: true },
      effect: { type: 'dukeInvestigate' },
    },
  ],
  modifiers: [

  ],
}
