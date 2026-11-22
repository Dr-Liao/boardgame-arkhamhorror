// 60179 监视（Stakeout，3 级）
// 卡面：调查([intellect])。你本次调查 +3[intellect]。如果检定成功，发现你所在地点额外 1 个线索并治愈 2 点恐惧。
// 读点：played countsAs investigate + api.investigate（onSuccess 追加发现线索/治愈）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60179'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    countsAs: 'investigate',
    label: '调查：+3 智识；成功额外发现 1 线索并治愈 2 恐惧',
    resolve: ({ inv, api }) => {
      api.investigate(inv.seat, {
        skillBonus: 3, source: CODE,
        onSuccess: () => {
          api.discoverClue(inv.seat, 1, inv.location)
          api.healHorror(inv.seat, 2)
        },
      })
    },
  }],
  modifiers: [],
}
