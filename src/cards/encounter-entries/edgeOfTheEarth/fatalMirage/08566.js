// 08566 飞机场
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 幻景层与特殊规则由章节 behavior/遭遇结算读点消费；数值/线索取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08566',
  scope: 'location',
  implemented: true,
  flags: {
    "mirageId": "airfield",
    "tier": 2,
    "investigatorShroudBonus": {
      "partner": "高田弘子",
      "amount": -2
    },
    "extraInvestigateCost": {
      "resources": 1
    }
  },
}
