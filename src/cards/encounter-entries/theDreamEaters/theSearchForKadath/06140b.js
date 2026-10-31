// 06140b 永恒美景（theSearchForKadath）· 背面故事卡（塞拉尼安）
// 卡面：位于塞拉尼安的每位调查员治愈2点伤害并获得2资源。
// 卡面：你发现了一个神迹（在剧本参考卡上放置1资源）。将本卡牌翻面。
//
// 一卡一文件：规则只在背面故事卡条目；章节 behavior 在掩藏地点翻面时调用 assetRule.resolve。
export default {
  code: '06140b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    signs: 1,
    resolve(state, api, ctx = {}) {
      const locationId = ctx.location?.id || ctx.inv?.location || 'serannian'
      for (const inv of (state.investigators || [])) {
        if (inv.defeated || inv.resigned || inv.location !== locationId) continue
        api.healDamage?.(inv.seat, 2)
        api.gainResources?.(inv.seat, 2)
        api.info?.(`🌅 永恒美景：${inv.name} 治愈 2 点伤害并获得 2 资源。`)
      }
      const signs = api.markers?.add?.('reference', 1) ?? 0
      api.info?.(`✨ 发现一个神迹（参考卡上现有 ${signs} 个神迹）。`)
    },
  },
}
