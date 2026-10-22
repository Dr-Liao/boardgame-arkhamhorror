// 03207 暗影缠身
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：[free]共同花费1[per_investigator]个线索：在当前密谋上放置1个毁灭标记，或自动躲避风琴手。(团队每轮仅限一次。)
// 卡面：目标 - 熬过三个夜晚。(不要推进场景，直到你受到指示。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03207', scope: 'act',
  actRule: {
    // 第 119 轮：幕背面提供「跟踪阴影」团队行动（内容层按这个标志展开）。
    shadowAction: true,
    onReveal(state, act, api) {
      api.finish(state.campaign.records?.youIntrudedOnASecretMeeting ? 'r2' : 'r1')
    },
  },
}
