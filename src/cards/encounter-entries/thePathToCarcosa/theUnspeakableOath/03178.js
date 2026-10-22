// 03178 病人拘禁室
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：强制 - 病人拘禁室揭示后：推进到场景2b。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03178', scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      const act = state.acts?.[state.actIndex]
      const code = act?.originalCode || act?.code
      if (code === '03164' || code === '03165') api.advanceAct()
    },
  },
}
