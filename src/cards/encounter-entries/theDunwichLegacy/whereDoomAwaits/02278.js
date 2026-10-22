// 02278 登山路途(版本一)
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：线索不能放置在非[[幻境]]地点。
// 卡面：目标 - 在有调查员进入哨兵峰时，推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02278', scope: 'act',
  actRule: {
    objective(state, { entered }) { return entered('02284') },
    onReveal() {},
    cluesOnReveal: 0,
  },
}
