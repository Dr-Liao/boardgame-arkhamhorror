// 02068 孤注一掷
// 归属：关卡专用 · theHouseAlwaysWins（敦威治遗产 · 百赌百胜）
// 遭遇组：the_house_always_wins
// 卡面：佛朗西斯·摩尔根博士不由调查员控制时，他获得“[action]：谈判。检定[willpower](3)以摇醒摩尔根博士。如果你检定成功，从供应堆将1线索放到佛朗西斯·摩尔根博士上。如果佛朗西斯·摩尔根博士上有1[per_investigator]个线索，控制他。”
// 卡面：目标 - 如果所有未被击败的调查员都撤退，推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02068', scope: 'act',
  actRule: {
    // 第 115 轮：孤注一掷的剧情角色与撤退结局（读者在 theHouseAlwaysWins 的 behavior）。
    guestAsset: '02080', guestResignedResolution: 'r2',
    onReveal(state, act, api) { api.finish('r1') },
  },
}
