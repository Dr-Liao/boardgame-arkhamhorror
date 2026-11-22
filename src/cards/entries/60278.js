// 60278 精神分析（Psychoanalysis，3 级）
// 卡面：你所在地点的调查员依次揭示其牌库顶 3 张，从中抽取 1 张，将剩余卡混洗回牌库，并治愈 2 点恐惧。
// 读点：api.lookAt（targetSeat）逐人结算 + api.healHorror。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60278'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    label: '所在地点每位调查员：看 3 抽 1 洗回，治愈 2 恐惧',
    resolve: ({ state, inv, api }) => {
      const targets = state.investigators.filter(owner => !owner.defeated && !owner.resigned
        && owner.location === inv.location)
      for (const target of targets) {
        api.lookAt(inv.seat, {
          zone: 'investigatorDeck', targetSeat: target.seat, count: 3, choose: 1,
          returnStrategy: 'shuffle', source: CODE,
          prompt: target.name + '：揭示牌库顶 3 张，抽取 1 张，其余混洗回牌库。',
        })
        api.healHorror(target.seat, 2)
      }
    },
  }],
  modifiers: [],
}
