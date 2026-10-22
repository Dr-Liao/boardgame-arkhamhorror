// 03083 难缠的客人
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
// 卡面：显现 - 将难缠的客人放置入场，放在密谋牌库旁。
// 卡面：每位调查员必须花费额外1个行动才能谈判。
// 卡面：强制 - 当一轮结束时：弃掉难缠的客人。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03083', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state) {
    state.scenarioFlags.toughCrowd.push('03083')
    return true
  },
}
