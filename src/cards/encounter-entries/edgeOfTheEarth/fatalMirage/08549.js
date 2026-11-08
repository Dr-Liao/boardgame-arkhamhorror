// 08549 致命幻景（混乱标记参考卡）
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 场景参考卡：标记数值由 chaos.js/behavior.chaosTokenValue 实现。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08549',
  scope: 'scenario',
  implemented: true,
  flags: {
    tokenMeanings: {
      skull: '胜利区剧情卡牌数（困难/专家 + 当前密谋编号）',
      cultist: -2, tablet: -3, elderthing: -4,
    },
  },
}
