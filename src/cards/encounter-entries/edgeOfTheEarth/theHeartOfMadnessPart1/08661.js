// 08661 疯狂呼唤（Call of Madness）· 议程 3
// 背面：每名剩余调查员被击败，并必须选择承受 1 点精神创伤或把忒咳哩-哩牌库顶 3 张洗入牌库。
export default {
  code: '08661',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    onLeave(state, agenda, api) {
      const active = (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
      for (const inv of active) {
        api.addTrauma?.(inv.seat, 'mental', 1)
        api.info?.(`🫀 疯狂呼唤：${inv.name || inv.seat} 被击败并承受 1 点精神创伤（忒咳哩-哩近似）。`)
        api.defeatInvestigator?.(inv.seat, { cause: 'madness' })
      }
    },
  },
}
