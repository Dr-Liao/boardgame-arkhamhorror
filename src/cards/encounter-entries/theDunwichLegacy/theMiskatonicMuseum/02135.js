// 02135 展厅
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：强制 - 在你调查本地点时技能检定失败后：失去1个行动。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02135', scope: 'location',
  locationRule: {
    onTestFail(state, loc, api, inv, result) {
      if (result.source?.label === '调查') inv.actionsLeft = Math.max(0, inv.actionsLeft - 1)
    },
  },
}
