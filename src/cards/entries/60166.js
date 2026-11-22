// 60166 监视（Stakeout）
// 卡面：调查([intellect])。你本次调查 +2[intellect]。如果检定成功，治愈 1 点恐惧。
// 读点：played 描述子 countsAs investigate + api.investigate（skillBonus 选项；测试回调治愈恐惧）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60166'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    countsAs: 'investigate',
    label: '调查：+2 智识；成功治愈 1 点恐惧',
    resolve: ({ inv, api }) => {
      api.investigate(inv.seat, {
        skillBonus: 2, source: CODE,
        onSuccess: () => api.healHorror(inv.seat, 1),
      })
    },
  }],
  modifiers: [],
}
