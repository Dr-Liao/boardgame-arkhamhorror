// 08648 疯狂之心（The Heart of Madness）混乱标记参考卡 · scenario · the_heart_of_madness
// 归属：战役共用 · edgeOfTheEarth/_shared（Part I–II 共用印刷提示卡 08648）。
// 卡面：简单/普通 [skull] -1（所在地点有[[古神]]敌人改为 -3）；[cultist] -1（所在地点有封印或
//   是迷雾高塔时视为 [frost]）；[tablet] -3（失败抽忒咳哩-哩顶 1 张）；[elder_thing] -4（失败且
//   低 3 点以上在当前密谋放 1 毁灭）。困难/专家 [skull] -2（-4）；[cultist] -1 且再 -1；[tablet] -3；
//   [elder_thing] -5。
// 读点：卡面数值口径落在 flags.tokenMeanings（章节 chaos.js 的 tokenMeanings 与本表同源）。
export default {
  code: '08648', scope: 'scenario', implemented: true,
  flags: {
    tokenMeanings: {
      skull: '所在地点有[[古神]]敌人：简单/普通 -3、困难/专家 -4；否则 -1/-2',
      cultist: '-1；所在地点有封印或是迷雾高塔时视为 [frost]（困难/专家再 -1）',
      tablet: '-3；失败抽忒咳哩-哩牌库顶 1 张',
      elderthing: '简单/普通 -4、困难/专家 -5；失败且低 3 点以上在当前密谋放 1 毁灭',
    },
    sealAwareToken: true,
    towerAwareToken: true,
  },
}

