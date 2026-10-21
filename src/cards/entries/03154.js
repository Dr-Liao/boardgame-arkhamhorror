// 03154 影之书
// 卡面：[action]横置影之书并花费1资源：为你控制的一个[[法术]]支援增加1充能。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03154',
  abilities: [
    {
      kind: 'action',
      label: '影之书补充1充能',
      cost: { action: true, exhaust: true, resources: 1 },
      effect: { type: 'rechargeAsset', amount: 1, trait: 'Spell' },
    },
  ],
  modifiers: [

  ],
}
