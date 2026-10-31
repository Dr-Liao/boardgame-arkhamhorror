// 06132b 亡者之魂（theSearchForKadath）· 背面故事卡（伊伯遗迹）
// 卡面：记住调查员「知道伊伯发生的事情」。将本卡牌翻面。
//
// 一卡一文件：这是本场冒险内的小记录（不是 55 个战役记录键），走 scenarioFlags。
export default {
  code: '06132b', scope: 'storyAsset', implemented: true,
  assetRule: {
    story: true,
    resolve(state, api) {
      api.setScenarioFlag?.('knowWhatHappenedToIb', true)
      api.info?.('🗿 记住：调查员「知道伊伯发生的事情」。')
    },
  },
}
