// 03203 第三夜
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：你的确信高于疑惑时，本密谋获得：
// 卡面：“在检查毁灭阈值时，改为从场上毁灭标记总数中减去本密谋以外的其他卡牌上的毁灭标记数，而不是加上。”
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03203', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const records = state.campaign.records || {}
      if (Number(records.doubt || 0) >= Number(records.conviction || 0)) { api.finish('r3'); return }
      // 卡背：确信高于疑惑时直接推进到场景 2b（不要先翻 2a 的背面）。
      const index = state.acts.findIndex(act => act?.stage === '2b')
      if (index >= 0) state.actIndex = index
      else api.advanceAct()
    },
  },
}
