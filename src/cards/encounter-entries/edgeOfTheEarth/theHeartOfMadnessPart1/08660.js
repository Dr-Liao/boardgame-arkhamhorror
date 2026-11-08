// 08660 瘴气召唤（The Miasma Beckons）· 议程 2
// 背面：检查每名调查员控制的封印（无人控制的跳过）：[seal_a] 控制者受 1 伤害（激活则 2）；
// [seal_b] 控制者随机弃 2 张手牌（激活则 4）；[seal_c] 控制者受 1 恐惧（激活则 2）；
// [seal_d] 控制者获得 1 个线索；[seal_e] 控制者获得 2 资源。读点：章节 behavior.agendaLeftPlay 分派。
export default {
  code: '08660',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    forced: { anyWindow() { return undefined } },
    onLeave(state, agenda, api) {
      const seals = state.campaign?.eote?.seals?.entries || []
      const active = kind => seals.some(entry => entry.kind === kind && entry.active)
      const controlled = kind => seals.find(entry => entry.kind === kind && entry.placedBySeat != null)
      const a = controlled('A')
      if (a) api.damage?.(a.placedBySeat, active('A') ? 2 : 1)
      const b = controlled('B')
      if (b) api.discardRandom?.(b.placedBySeat, active('B') ? 4 : 2)
      const c = controlled('C')
      if (c) api.horror?.(c.placedBySeat, active('C') ? 2 : 1)
      const d = controlled('D')
      if (d) api.gainClues?.(d.placedBySeat, 1)
      const e = controlled('E')
      if (e) api.gainResources?.(e.placedBySeat, 2)
      api.info?.('🫀 瘴气召唤背面：按封印控制者结算伤害/恐惧/弃牌/线索/资源。')
    },
  },
}
