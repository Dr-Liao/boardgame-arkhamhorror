// 06129b 无穷秘密（theSearchForKadath）· 背面故事卡（狄拉斯-利恩）
// 卡面：你发现了一个神迹（在剧本参考卡上放置1资源作为表示）。本场冒险剩余时间内，
//       剧本参考卡上的资源表示调查员已发现的神迹。你的任务就是发现尽可能多的神迹，从而找到卡达斯的位置。
// 卡面：将本卡牌翻面。
//
// 一卡一文件：神迹计数走通用的剧本参考卡计数原语 api.markers（默认 id = 'reference'）。
export default {
  code: '06129b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    signs: 1,
    resolve(state, api) {
      const signs = api.markers?.add?.('reference', 1) ?? 0
      api.info?.(`✨ 发现一个神迹（参考卡上现有 ${signs} 个神迹）。`)
    },
  },
}
