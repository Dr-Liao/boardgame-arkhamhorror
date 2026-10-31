// 06138b 特尔菲亚的废墟（theSearchForKadath）· 背面故事卡（无名遗迹）
// 卡面：你发现了一个神迹（在剧本参考卡上放置1资源）。将本卡牌翻面。
//
// 一卡一文件：神迹计数走通用的剧本参考卡计数原语 api.markers。
export default {
  code: '06138b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    signs: 1,
    resolve(state, api) {
      const signs = api.markers?.add?.('reference', 1) ?? 0
      api.info?.(`✨ 发现一个神迹（参考卡上现有 ${signs} 个神迹）。`)
    },
  },
}
