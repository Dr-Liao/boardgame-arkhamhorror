// 03046 惊醒
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 佛朗西斯·摩尔根博士（02080）的 assetRule.morgan 已在 entries/02080.js 声明。
// 第 7 批：卡尔克萨第一章「谢幕」的幕/密谋脚本。

export default {
  code: '03046', scope: 'act', flags: { firstAct: true },
  actRule: {
    // 第 114 轮：幕一的目标从条目读（chapter definition 不再按卡号分支）。
    objective: { type: 'clues', perInvestigator: 3 },
    onReveal(state, act, api) {
      const pool = [...state.scenarioFlags.lobbyDoorways, ...state.scenarioFlags.backstageDoorways]
      const id = pool.length ? pool[Math.min(pool.length - 1, Math.floor(api.random() * pool.length))] : null
      if (!id) throw new Error('没有可用于生成苍白面具下的男子的放在一边地点')
      for (const key of ['lobbyDoorways', 'backstageDoorways']) {
        const index = state.scenarioFlags[key].indexOf(id)
        if (index >= 0) state.scenarioFlags[key].splice(index, 1)
      }
      api.place(id)
      api.spawn('03059', id)
    },
  },
}
