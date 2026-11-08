// 08570b 记忆剧情卡（地点背面）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// behavior.flipStoryFace 读点：伙伴活着→生成记忆敌人；被划掉→放逐到胜利区，调查员/敌人移回记忆囚笼。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08570b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyFlip: { memoryEnemy: '08576', partner: '08590', victoryOnBanish: true },
  },
}
