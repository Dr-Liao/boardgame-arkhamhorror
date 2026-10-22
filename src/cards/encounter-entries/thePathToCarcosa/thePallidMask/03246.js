// 03246 引领道路
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：忽略堵塞通道上的强制能力。
// 卡面：目标 - 如果每位没有被击败的调查员都在堵塞通道，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '03246', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r2') } } }
