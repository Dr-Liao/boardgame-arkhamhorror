// 04264 离体体验
// 卡面：显现 - 将你所有手牌洗入你的牌库并抽取等量的卡牌。将离体体验洗入你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04264',
  abilities: [
    { kind: 'weakness', label: '离体体验', weakness: { type: 'outOfBody' } },
  ],
  modifiers: [

  ],
}
