// 04166 过去与现在
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：目标 - 在时间耗尽之前，尽可能多地发现不同的[[特诺奇蒂特兰]]地点的所有线索，从而找到通往联结点的道路。如果场上有6个[[特诺奇蒂特兰]]地点上没有线索，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 115 轮：界限彼端（失落时代第二章）的幕/密谋背面。
// 三张牌的结算都是「时间线换图」这一组操作，实现只有一份、仍留在章节 behavior；
// 条目通过 onReveal 的第四个参数拿到 hooks（sweep / shiftPresentDay / …）来编排顺序。

export default {
  code: '04166', scope: 'act',
  actRule: {
    onReveal(state, act, api, hooks) {
      // 过去与现在（背面）：所有特诺奇蒂特兰地点进胜利区 → 换图 → 失去线索 →
      // 在大神庙生成帕德玛 → 移除当前场景/密谋牌库，把场景 3a 与密谋 3a 放进场。
      hooks.sweep({ onlyCleared: false })
      hooks.shiftPresentDay('04166')
      hooks.loseAllClues()
      hooks.spawnPadma()
      state.scenarioZones.removed = [...(state.scenarioZones.removed || []), '04162', '04163']
      // 引擎在 actReveal 之后才把 actIndex +1，所以这里只补上场景 3a 的槽位；
      // 密谋 3a 则直接成为当前密谋。
      hooks.enterFinalStage({ advanceAct: true })
    },
  },
}
