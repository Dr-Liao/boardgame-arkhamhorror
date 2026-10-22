// 02126 博物馆大门
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：位于博物馆大门的调查员不能获得资源。
// 卡面：[action]：撤退。“呃。一本书能有多重要呢，是吧？”
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 72 轮：博物馆入口/教堂不能获得资源；火车两节车厢的场景行动。

export default {
  code: '02126', scope: 'location',
  locationRule: { canGainResources: false },
}
