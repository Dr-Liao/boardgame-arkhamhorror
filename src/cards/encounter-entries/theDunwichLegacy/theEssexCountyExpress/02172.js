// 02172 卧车
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
// 卡面：卧车与其左边和右边的地点连接。
// 卡面：[action]：获得3资源。请记住你“偷了乘客的行李。”(团队每场游戏仅限一次)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02172', scope: 'location',
  locationRule: {
    actions({ state, add }) {
      if (!state.scenarioFlags.stolePassengersLuggage) add('stealLuggage', '拿走旅客行李：获得 3 资源')
    },
  },
}
