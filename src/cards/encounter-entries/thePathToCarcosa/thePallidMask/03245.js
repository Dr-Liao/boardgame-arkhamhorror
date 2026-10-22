// 03245 逃出生天
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：强制 - 当一轮结束时，如果地狱之门在场：弃掉离地狱之门最远的地方。将位于该地点的每位调查员和每个敌人移动到一个连接地点，且他们各受到2点伤害。
// 卡面：目标 - 如果每位没有被击败的调查员都在地狱之门，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '03245', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r1') } } }
