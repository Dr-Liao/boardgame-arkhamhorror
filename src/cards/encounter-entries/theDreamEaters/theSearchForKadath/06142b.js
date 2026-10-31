// 06142b 城中之城（theSearchForKadath）· 背面故事卡（无以达愿之庙）
// 卡面：将放在一边的「地图未见之城」地点放置入场。将本卡牌翻面。
//
// 一卡一文件：规则只在背面故事卡条目；章节 behavior 在掩藏地点翻面时调用 assetRule.resolve。
export default {
  code: '06142b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    resolve(state, api) {
      api.takeFromSetAside?.('06143')
      api.place?.('cityWhichAppearsOnNoMap')
      api.info?.('🌌 城中之城：放在一边的「地图未见之城」地点进入游戏。')
    },
  },
}
