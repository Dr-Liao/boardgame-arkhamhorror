// 06014 脱离现实
// 卡面：显现 - 如果梦境之门(奇妙旅程)已在场上，将其翻面。否则，查找你的绑定卡牌，找出
//       梦境之门(无谓现实) 将其放置入场。不论是哪一种情况，与你交战的每个敌人解除交战，
//       你移动到梦境之门。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// ⚠️ 显式简化：梦境之门地点的放置/翻面/移动属 P8（地点型 Bonded 接线）。
// 当前实现只结算「与你交战的每个敌人解除交战」，并把其余部分写进待实现清单。

export default {
  code: '06014',
  simplified: true,
  note: '梦境之门（06015a/b）的翻面、放置与移动到该地点尚未接线（属 P8）；当前只结算「解除所有交战」。',
  abilities: [
    {
      kind: 'weakness',
      label: '解除所有交战（梦境之门待实现）',
      weakness: { type: 'custom' },
      resolve: ({ inv, api }) => {
        api.disengageAll(inv.seat)
        api.info(`「脱离现实」：${inv.name} 与所有敌人解除交战。`)
      },
    },
  ],
  modifiers: [],
}
