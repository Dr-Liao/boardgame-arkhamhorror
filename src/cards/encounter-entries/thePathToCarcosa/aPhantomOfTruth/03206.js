// 03206 闻风追影
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：[reaction]你成功攻击风琴手后：你所在地点的一位调查员可以将自己的1个线索放置到风琴手上。(团队每轮仅限1[per_investigator]次。)
// 卡面：目标 - 如果风琴手上有3[per_investigator]个线索，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03206', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      api.finish(state.campaign.records?.youIntrudedOnASecretMeeting ? 'r2' : 'r1')
    },
  },
}
