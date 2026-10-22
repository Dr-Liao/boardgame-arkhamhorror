// 04163 屏障薄弱
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04163', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api, hooks) {
      // 未来幻象（背面）：与场景 2b 相同的换图流程，但只把「没有线索」的特诺奇蒂特兰
      // 地点放进胜利区；随后把场景 3a 与密谋 3a 放进场。
      hooks.sweep({ onlyCleared: true })
      hooks.shiftPresentDay()
      hooks.loseAllClues()
      hooks.spawnPadma()
      state.scenarioZones.removed = [...(state.scenarioZones.removed || []), '04165', '04166']
      hooks.enterFinalStage({ advanceAgenda: true })
    },
  },
}
