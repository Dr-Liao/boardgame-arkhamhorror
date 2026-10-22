// 03177 地下室走廊
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：强制 - 地下室走廊揭示后：将4张放在一边的病人拘禁室地点放置入场。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 95 轮：邪秽誓约的病人拘禁室与地窖入口。

export default {
  code: '03177', scope: 'location',
  locationRule: {
    entryError(state, location) {
      if (location.revealed || state.actIndex >= 1) return null
      return '通往地下室走廊的门锁住了。你不能进入地下室走廊。'
    },
    onReveal(state, location, api) {
      if (state.scenarioFlags.cellsPlaced) return
      state.scenarioFlags.cellsPlaced = true
      const cells = ['danielsCell', 'occupiedCell', 'drearyCell', 'familiarCell']
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor((api.random?.() ?? 0.5) * (i + 1))
        ;[cells[i], cells[j]] = [cells[j], cells[i]]
      }
      for (const id of cells) api.place(id)
    },
  },
}
