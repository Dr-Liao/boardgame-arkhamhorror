// 03126 誓约
// 归属：关卡专用 · echoesOfThePast（卡尔克萨之路 · 往事回声）
// 遭遇组：echoes_of_the_past
// 卡面：带有[[通道]]特性的地点互相连接。
// 卡面：目标 - 只有在隐藏的图书馆的调查员可以共同花费所需数量的线索以推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03126', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      const answer = api.choose({
        kind: 'story', source: act.id, seat: state.campaign.leadSeat,
        prompt: '如何处置黑玛瑙扣环？',
        options: [{ id: 'r1', label: '拿走它' }, { id: 'r2', label: '留在原处' }],
      })
      api.finish(answer)
    },
  },
}
