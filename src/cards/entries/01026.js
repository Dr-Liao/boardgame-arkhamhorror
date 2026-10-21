// 01026 多余的弹药
// 卡面：在你所在地点一位调查员控制的1个[[枪械]]支援上放置3个子弹标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01026',
  abilities: [
    {
      kind: 'played',
      label: '多余的弹药',
      effect: { type: 'reloadAmmo', amount: 3, trait: 'Firearm' },
    },
  ],
  modifiers: [

  ],
}
