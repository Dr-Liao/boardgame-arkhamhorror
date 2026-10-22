// 03319 疯狂灭亡
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：哈斯塔得到+2攻击。
// 卡面：除非有调查员“知道了秘密”，否则哈斯塔不能被击败。(FAQ，v1.3)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03319', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const records = state.campaign.records || {}
      api.finish(Number(records.conviction || 0) >= Number(records.doubt || 0) ? 'r4' : 'r5')
    },
  },
}
