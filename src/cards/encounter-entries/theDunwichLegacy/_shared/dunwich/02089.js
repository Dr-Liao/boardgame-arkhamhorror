// 02089 忍气吞声
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：dunwich
// 卡面：显现 - 将忍气吞声附属到你所在地点。
// 卡面：强制 - 当一轮结束时：附属地点的每位调查员受到1点恐惧。
// 卡面：强制 - 在密谋推进时：弃掉忍气吞声。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 忍气吞声（02089）：地点离场时按计数器把这张遭遇卡放回遭遇弃牌堆。

export default {
  code: '02089', implemented: true, name: '忍气吞声', scope: 'treachery', text: '地点计数器型障碍。',
  locationCounter: 'sordidAndSilent',
  encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv) {
    const location = state.locations.find(item => item.id === inv.location)
    location.sordidAndSilent = (location.sordidAndSilent || 0) + 1
    return true
  },
}
