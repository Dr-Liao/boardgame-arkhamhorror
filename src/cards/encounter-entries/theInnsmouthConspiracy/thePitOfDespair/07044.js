// 深海献祭：以效果击败幸存者并明确增加一次肉体创伤，不伪造超量伤害。
// 三张议程正面的缺氧规则由本章启用通用 water.air 机制统一读取。
export default {
  code: '07044', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of state.investigators.filter(inv => !inv.defeated && !inv.resigned)) {
        api.trauma(inv.seat, 'physical', 1)
        api.defeat(inv)
      }
    },
  },
}
