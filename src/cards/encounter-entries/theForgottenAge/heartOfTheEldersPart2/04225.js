// 04225 危险峡谷
// 归属：关卡专用 · heartOfTheEldersPart2（久远腹地（下））
// 遭遇组：knyan
// 卡面：强制 - 在你调查危险峡谷时，技能检定失败后：检查你的补给品。如果本地点没有调查员带有绳索，在危险峡谷上放置1个毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 危险峡谷（04225）：在此调查失败后，若没人带绳索就在此地点放 1 个毁灭。

export default {
  code: '04225', scope: 'location',
  locationRule: {
    afterTest({ state, inv, result, api }) {
      if (result.success || result.source?.label !== '调查') return
      if (api.checkSupplies(inv.seat, 'rope')) return
      const location = (state.locations || []).find(entry => entry.id === inv.location)
      if (location) location.doom = (location.doom || 0) + 1
    },
  },
}
