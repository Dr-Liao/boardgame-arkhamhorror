// 06121 外神的使徒（theSearchForKadath）· 议程 2（毁灭阈值 9）
// 卡面：[action] 如果你位于[[港口]]地点：撤退。……（同 06120 的正面）
// 卡面（背面「被俘！」）：每位存活的调查员被击败。
//
// 一卡一文件：背面效果在 agendaRule.onReveal；正面撤退由 definition 给港口地点的 resign 提供。
export default {
  code: '06121', scope: 'agenda', implemented: true,
  agendaRule: {
    portResign: true,
    onReveal(state, agenda, api) {
      api.info?.('⛓️ 「被俘！」：每位存活的调查员被击败。')
      api.defeatAll?.()
      return true
    },
  },
}
