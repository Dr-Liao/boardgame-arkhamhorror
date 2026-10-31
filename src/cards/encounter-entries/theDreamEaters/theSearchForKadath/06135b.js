// 06135b 祖兰-提克的地穴（theSearchForKadath）· 背面故事卡（祖兰-提克）
// 卡面：你发现了一个神迹（在剧本参考卡上放置1资源）。
// 卡面：将「夜色怪群」加入胜利牌区。将本卡牌翻面。
//
// 一卡一文件：规则只在背面故事卡条目；章节 behavior 在掩藏地点翻面时调用 assetRule.resolve。
export default {
  code: '06135b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    signs: 1,
    resolve(state, api) {
      const signs = api.markers?.add?.('reference', 1) ?? 0
      api.info?.(`✨ 发现一个神迹（参考卡上现有 ${signs} 个神迹）。`)
      const horde = (state.enemies || []).find(enemy => (enemy.originalCode || enemy.code) === '06147'
        && enemy.swarmHostId == null)
      if (horde) {
        api.banish?.(horde)
        api.info?.('🕳️ 祖兰-提克的地穴：夜色怪群被加入胜利牌区。')
      } else {
        api.info?.('🕳️ 祖兰-提克的地穴：夜色怪群不在场上，没有可加入胜利牌区的目标。')
      }
    },
  },
}
