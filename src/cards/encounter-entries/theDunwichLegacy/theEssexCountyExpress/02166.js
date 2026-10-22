// 02166 发动引擎！
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
// 卡面：目标 - 如果车头没有线索，立刻推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02166', scope: 'act',
  actRule: {
    objective(state, { empty }) { return empty('02175') },
    onReveal(state, act, api) { api.finish('r1') },
  },
}
