// 02125 查找古书
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：目标 - 如果展厅(禁止入内)上没有线索，推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02125', scope: 'act',
  actRule: {
    objective(state, { empty }) { return empty('02137') },
    onReveal(state, act, api) {
      const choice = api.choose({
        kind: 'story', source: act.originalCode || act.code, seat: state.campaign.leadSeat,
        prompt: '如何处置死灵之书？',
        options: [{ id: 'r1', label: '销毁' }, { id: 'r2', label: '保管' }],
      })
      api.finish(choice)
    },
  },
}
