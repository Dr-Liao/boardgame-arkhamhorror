// 02109 走私品
// 卡面：选择你所在地点一位调查员控制的一个支援。将该支援上的子弹或补给标记数量翻倍。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02109',
  abilities: [
    {
      kind: 'played',
      label: '走私品',
      effect: { type: 'doubleUses', usesTypes: ['ammo', 'supplies'], target: 'location' },
    },
  ],
  modifiers: [

  ],
}
