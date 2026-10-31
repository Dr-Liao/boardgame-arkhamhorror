// 06137b 远古诸神的面容（theSearchForKadath）· 背面故事卡（恩格拉尼克山脉）
// 卡面：你发现了一个神迹（在剧本参考卡上放置1资源）。
// 卡面：将1张放在一边的「黑暗夜魇」混洗入遭遇牌库（如可能）。将本卡牌翻面。
//
// 一卡一文件：规则只在背面故事卡条目；章节 behavior 在掩藏地点翻面时调用 assetRule.resolve。
export default {
  code: '06137b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    signs: 1,
    resolve(state, api) {
      const signs = api.markers?.add?.('reference', 1) ?? 0
      api.info?.(`✨ 发现一个神迹（参考卡上现有 ${signs} 个神迹）。`)
      if (api.takeFromSetAside?.('06150')) {
        api.shuffleIntoEncounterDeck?.(['06150'])
        api.info?.('🗻 远古诸神的面容：1 张放在一边的黑暗夜魇洗入遭遇牌库。')
      }
    },
  },
}
