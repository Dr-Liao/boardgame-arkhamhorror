// 06141b 无以达愿（theSearchForKadath）· 背面故事卡（哈祖斯-克列格）
// 卡面：将放在一边的「无以达愿之庙」地点放置入场。将本卡牌翻面。
//
// 一卡一文件：规则只在背面故事卡条目；章节 behavior 在掩藏地点翻面时调用 assetRule.resolve。
export default {
  code: '06141b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    resolve(state, api) {
      api.takeFromSetAside?.('06142')
      api.place?.('templeOfUnattainableDesires')
      api.info?.('🛕 无以达愿：放在一边的「无以达愿之庙」地点进入游戏。')
    },
  },
}
