// 02132 展厅
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：强制 - 在你进入本地点后：失去你所有剩余的行动，立刻结束你的回合。
// 卡面：你在本地点时，你得到+2[agility]。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 55 轮：敦威治后段章节的地点「揭示时 / 进入时」规则从 later-behaviors.js 搬来。

export default {
  code: '02132', scope: 'location',
  locationRule: { onEnter: { effect(state, loc, api, inv) { api.endTurn(inv.seat) } } },
}
