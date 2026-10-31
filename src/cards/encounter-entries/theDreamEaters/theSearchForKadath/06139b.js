// 06139b 王之良言（theSearchForKadath）· 背面故事卡（塞勒菲斯）
// 卡面：记住你「向王祈求帮助」了。
// 卡面：将1张放在一边的「黑暗夜魇」混洗入遭遇牌库（如可能）。将本卡牌翻面。
//
// 一卡一文件：规则只在背面故事卡条目；章节 behavior 在掩藏地点翻面时调用 assetRule.resolve。
export default {
  code: '06139b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    resolve(state, api) {
      api.setScenarioFlag?.('beseechedTheKing', true)
      api.info?.('👑 记住：你「向王祈求帮助」了。')
      if (api.takeFromSetAside?.('06150')) {
        api.shuffleIntoEncounterDeck?.(['06150'])
        api.info?.('👑 王之良言：1 张放在一边的黑暗夜魇洗入遭遇牌库。')
      }
    },
  },
}
