// 06143b 凶星（theSearchForKadath）· 背面故事卡（地图未见之城）
// 卡面：你发现了两个神迹（在剧本参考卡上放置2资源）。
// 卡面：弃掉本地点的每个敌人。将本地点的每位调查员移动到「无以达愿之庙」（不能取消）。
//       将本卡牌翻面并加入胜利牌区。
//
// 一卡一文件：规则只在背面故事卡条目；章节 behavior 在翻面时调用 assetRule.resolve，
// 并在结算后把「地图未见之城」加入胜利展示区（条目受 R1 约束不能直写 state.victoryDisplay，
// 由 behavior 依据本条目设置的 pendingVictoryLocation 标志完成）。
export default {
  code: '06143b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    signs: 2,
    resolve(state, api, ctx = {}) {
      const locationId = ctx.location?.id || 'cityWhichAppearsOnNoMap'
      const signs = api.markers?.add?.('reference', 2) ?? 0
      api.info?.(`✨ 发现两个神迹（参考卡上现有 ${signs} 个神迹）。`)
      for (const enemy of (state.enemies || []).slice()) {
        if (enemy.location !== locationId) continue
        api.discardEnemy?.(enemy)
      }
      api.info?.('💫 凶星：本地点的敌人被弃掉。')
      for (const inv of (state.investigators || [])) {
        if (inv.defeated || inv.resigned || inv.location !== locationId) continue
        api.moveInvestigator?.(inv.seat, 'templeOfUnattainableDesires')
        api.info?.(`💫 凶星：${inv.name} 被移动到「无以达愿之庙」（不能取消）。`)
      }
      // 「加入胜利牌区」由章节 behavior 在 resolve 之后读取该标志并执行（避免条目直写状态）。
      api.setScenarioFlag?.('pendingVictoryLocation', locationId)
    },
  },
}
