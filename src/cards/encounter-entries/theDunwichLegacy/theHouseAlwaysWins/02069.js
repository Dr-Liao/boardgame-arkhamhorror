// 02069 收牌认输
// 归属：关卡专用 · theHouseAlwaysWins（敦威治遗产 · 百赌百胜）
// 遭遇组：the_house_always_wins
// 卡面：彼得·克劳佛不由调查员控制时，他获得“[action]：谈判。检定[willpower](3)以说服彼得跟着你。如果你检定成功，从供应堆将1线索放到彼得·克劳佛上。如果彼得·克劳佛上有1[per_investigator]个线索，控制他。”
// 卡面：目标 - 如果所有未被击败的调查员都撤退，推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02069', scope: 'act',
  actRule: {
    guestAsset: '02079', guestResignedResolution: 'r3',
    onReveal(state, act, api) { api.finish('r1') },
  },
}
