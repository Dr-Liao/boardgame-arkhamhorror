// 12088 手摇式手电筒（Hand-Crank Flashlight）
// 卡面：[action]：调查([intellect])。你本次检定得到 +1[intellect]。
//       如果你检定成功，你可以弃掉手摇式手电筒，以使你的地点得到隐藏值 -1，直到本轮结束。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · [action] 调查 = kind:'action' + countsAs:'investigate'；
//   · 调查主流程 = api.investigate(seat, { bonus })（doInvestigate 唯一入口，返回本次检定结果）；
//   · 「弃掉本牌」= api.discardSelf（assets 区域的唯一离场入口）；
//   · 「直到本轮结束的隐藏值 -1」= api.locationShroudModUntilRoundEnd(location, amount)
//     （写入 location.roundShroudMod，调查难度读取同一字段，轮末清除）。

const CODE = '12088'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'action',
      countsAs: 'investigate',
      label: '调查（+1[智识]）；成功后可以弃掉本牌，使所在地点隐藏值 -1（直到本轮结束）',
      cost: { action: true },
      resolve: ({ inv, source, state, api }) => {
        const result = api.investigate(inv.seat, { bonus: 1 })
        if (!result?.success) return
        if (!source) return
        const answer = api.choice({
          kind: 'reaction', source: CODE, seat: inv.seat, canSkip: true,
          prompt: '手摇式手电筒：调查成功。是否弃掉它以让你所在地点隐藏值 -1（直到本轮结束）？',
          options: [{ id: 'skip', label: '保留手电筒' }, { id: 'discard', label: '弃置，隐藏值 -1' }],
        })
        if (answer !== 'discard') return
        const here = (state.locations || []).find(location => location.id === inv.location)
        api.discardSelf(CODE)
        if (here) api.locationShroudModUntilRoundEnd(here, -1)
        api.info(`🔦 「手摇式手电筒」：弃置，${here ? `「${api.locationName(here.id)}」` : '所在地点'}隐藏值 -1（直到本轮结束）。`)
      },
    },
  ],
  modifiers: [],
}
