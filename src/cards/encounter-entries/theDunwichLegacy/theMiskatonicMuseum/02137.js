// 02137 展厅
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：追猎恐魔在本地点时，本地点不能被调查。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02137', scope: 'location',
  locationRule: {
    investigationError(state, inv, loc) {
      return state.enemies.some(enemy => enemy.code === '02141' && enemy.location === loc.id)
        ? '恐惧猎手在此，无法调查' : null
    },
  },
}
