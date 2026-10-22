// 02092 厄运连连
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：bad_luck
// 卡面：显现 - 将厄运连连放置入场，放到你的威胁区域。
// 卡面：你在技能检定期间得到-1技能值。
// 卡面：强制 - 你检定成功且超过难度1点或更多后：弃掉厄运连连。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：从 content/campaigns/theDunwichLegacy/card-data.js 的逐卡分支搬来的规则。

export default {
  code: '02092', scope: 'treachery', threatEffect: { mods: { allSkills: -1 } }, implemented: true, flags: { afterTestDiscard: true },
  encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, card.originalCode || card.code)
    return true
  },
}
