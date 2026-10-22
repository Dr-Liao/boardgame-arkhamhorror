// 03209 蒙马特尔
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：[action]：揭示每位调查员牌库顶1张卡牌。你可以打出一张因本效果揭示的支援(支付其费用)，放到你的控制之下。混洗每位调查员的牌库。(团队每轮仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 蒙马特（03209）：每轮一次，揭示每位调查员牌库顶牌并可打出一张支援。

export default {
  code: '03209', scope: 'location',
  locationRule: {
    actions({ state, moves }) {
      if (state.scenarioFlags?.montmartrePlayRound === state.round) return
      moves.push({ action: 'scenarioAction', rule: 'montmartrePlay',
        label: '揭示每位调查员牌库顶牌并可打出一张支援' })
    },
  },
}
