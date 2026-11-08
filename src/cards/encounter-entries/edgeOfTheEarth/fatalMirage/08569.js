// 08569 戴尔的教室
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08569',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "dyersClassroom",
    "tier": 2,
    "investigatorShroudBonus": {
      "partner": "威廉·戴尔教授",
      "amount": -2
    },
    "actionShuffleTekelili": "heal1Horror"
  },
}
