// 01070 影之书
// 卡面：你拥有额外1个法术槽位。
// 卡面：[action]横置影之书：为你控制的一个[[法术]]支援增加1充能。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01070',
  passive: { extraSlots: { arcane: 1 } },
  abilities: [
    {
      kind: 'action', label: '灌注（横置，为一个法术支援 +1 充能）',
      cost: { action: true, exhaust: true },
      effect: { type: 'rechargeAsset', amount: 1, trait: 'Spell' },
    },
  ],
  modifiers: [

  ],
}
