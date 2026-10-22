// 04347 毁灭之时
// 归属：关卡专用 · turnBackTime（失落的时代 · 时间倒流）
// 遭遇组：turn_back_time
// 卡面：古代遗物获得：“[action]：检定[willpower]或[intellect](4)。如果你检定成功，将你所在地点的一位调查员控制的一个线索翻至毁灭标记面，并将它放在你所在地点。然后，对伊格造成3点伤害。”
// 卡面：目标 - 如果伊格被击败，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '04347', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r1') } } }
