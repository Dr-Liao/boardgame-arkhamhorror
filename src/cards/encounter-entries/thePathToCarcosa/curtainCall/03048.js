// 03048 谢幕
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
// 卡面：苍白面具下的男子不在场时，前厅获得：“[action]：撤退。”
// 卡面：强制 - 当一轮结束时：与带有恐惧的地点连接的地点上如果没有恐惧，在每个此类地点上放置1点恐惧。
// 卡面：目标 - 如果所有未被击败的调查员都撤退，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '03048', scope: 'act', flags: { escapeAct: true }, actRule: { onReveal(state) { state.scenarioFlags.hazardTests = {} } } }
