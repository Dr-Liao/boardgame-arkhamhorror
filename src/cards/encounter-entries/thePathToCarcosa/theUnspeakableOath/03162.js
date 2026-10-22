// 03162 他的领地
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：强制 - 在你将要把一个敌人放到场景牌库底下时：改为将该敌人洗入遭遇牌库。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03162', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.defeat(inv, null)
      const resigned = state.investigators.some(inv => inv.resigned)
      api.finish(resigned ? (state.scenarioFlags.tookKeysByForce ? 'r2' : 'r3') : 'r1')
    },
  },
}
