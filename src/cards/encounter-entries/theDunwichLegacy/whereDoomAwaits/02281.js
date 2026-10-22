// 02281 大门打开
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：目标 - 只有哨兵峰的调查员可以共同花费所需数量的线索以推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02281', scope: 'act',
  actRule: { onReveal(state, act, api) { api.finish('r1') } },
}
