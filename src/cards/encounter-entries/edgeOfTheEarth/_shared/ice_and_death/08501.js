// 08501 亡命冰原（Ice and Death）混乱标记参考卡 · scenario · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared（Part I–III 共用印刷提示卡 08501）。
// 卡面：简单/普通 [skull] -X（X=所在地点庇护值一半，向上取整）；[cultist] -2（失败：洗入 1 张
//   忒咳哩-哩，不能则 1 恐惧）；[tablet] -3（失败且每低于难度 1 点：弃牌库顶 1 张并抽取其中弱点）。
//   困难/专家 [skull] -X（X=庇护值）；[cultist] -2（失败且每低 1 点洗入 1 张）；[tablet] -4（同上）。
// 读点：卡面数值口径落在 flags.tokenMeanings（章节 chaos.js 的 tokenMeanings 与本表同源）；
//   三部分各自的 tokenMeanings 由章节 definition 覆写（部分 II/III 有额外规则）。
export default {
  code: '08501', scope: 'scenario', implemented: true,
  flags: {
    tokenMeanings: {
      skull: 'X = 所在地点庇护值（简单/普通：一半向上取整；困难/专家：全值），修正 -X',
      cultist: '简单/普通 -2；困难/专家 -2（失败按差值洗入忒咳哩-哩）',
      tablet: '简单/普通 -3；困难/专家 -4（失败按差值弃牌库顶并抽取弱点）',
    },
    shelterToken: true,
    tekeliliOnFail: true,
  },
}

