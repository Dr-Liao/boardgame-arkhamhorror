// 06133b 彩虹宫殿（theSearchForKadath）· 背面故事卡（伊莱克-瓦达）
// 卡面：位于伊莱克-瓦达的每位调查员治愈2点恐惧并抽取2张卡牌。将本卡牌翻面。
//
// 一卡一文件：规则只在背面故事卡条目；章节 behavior 在掩藏地点翻面时调用 assetRule.resolve。
export default {
  code: '06133b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    resolve(state, api, ctx = {}) {
      const locationId = ctx.location?.id || ctx.inv?.location || 'ilekVad'
      for (const inv of (state.investigators || [])) {
        if (inv.defeated || inv.resigned || inv.location !== locationId) continue
        api.healHorror?.(inv.seat, 2)
        api.drawCards?.(inv.seat, 2)
        api.info?.(`🌈 彩虹宫殿：${inv.name} 治愈 2 点恐惧并抽 2 张卡。`)
      }
    },
  },
}
