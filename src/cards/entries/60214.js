// 60214 燃烧午夜油
// 卡面：调查。本行动开始时，获得2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60214',
  abilities: [{
    kind: 'played', countsAs: 'investigate', label: '调查，行动开始时获得 2 资源',
    resolve: ({ inv, api }) => {
      api.gainResources(inv.seat, 2)
      api.investigate(inv.seat)
    },
  }],
}
