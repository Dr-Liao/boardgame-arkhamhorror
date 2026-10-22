// 02134 展厅
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：强制 - 在你进入本地点后：随机弃掉你2张手牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02134', scope: 'location',
  locationRule: { onEnter: { effect(state, loc, api, inv) { api.discardRandom(inv.seat, 2) } } },
}
