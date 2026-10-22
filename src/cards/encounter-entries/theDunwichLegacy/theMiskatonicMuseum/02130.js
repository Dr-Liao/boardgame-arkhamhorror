// 02130 管理办公室
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：你的资源不多于4时，不能调查管理办公室。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 70 轮：博物馆/火车地点的调查限制。

export default {
  code: '02130', scope: 'location',
  locationRule: {
    investigationError(state, inv) {
      return inv.resources <= 4 ? '资源不足 5，无法调查管理办公室' : null
    },
  },
}
