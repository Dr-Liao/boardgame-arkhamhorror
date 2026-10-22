// 04165 穿越界限
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：目标 - 在通过成功探索第一次将[[特诺奇蒂特兰]]地点放置入场后，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 97 轮：边界之外的场景/密谋翻面（04165/04167/04164）。

export default {
  code: '04165', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      const flags = (state.scenarioFlags ||= {})
      const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      const seat = flags.ancientPlacerSeat ?? active[0]?.seat
      if (seat == null) return
      api.test(seat, 'willpower', 4, result => {
        if (result.success) return
        api.info?.('🌫️ 穿过界限的冲击让你心神不宁：从收藏中找出一张基础疯狂/损伤弱点洗入牌库。')
        api.addBasicWeakness?.(seat, ['madness', 'injury'])
      })
    },
  },
}
